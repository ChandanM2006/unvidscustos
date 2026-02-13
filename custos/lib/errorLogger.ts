// Error Logging Service
// Captures and logs all errors to database

import { supabase } from '@/lib/supabase'

export type ErrorType = 'api' | 'database' | 'ai_service' | 'frontend' | 'auth' | 'unknown'
export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical'

interface LogErrorParams {
    errorType: ErrorType
    featureName: string
    errorMessage: string
    stackTrace?: string
    severity?: ErrorSeverity
    userImpacted?: boolean
    requestUrl?: string
    requestMethod?: string
    requestData?: any
    autoRecovered?: boolean
}

class ErrorLogger {
    private static instance: ErrorLogger
    private errorQueue: any[] = []
    private isProcessing = false

    private constructor() {
        // Start background processing
        this.startBackgroundProcessing()
    }

    static getInstance(): ErrorLogger {
        if (!ErrorLogger.instance) {
            ErrorLogger.instance = new ErrorLogger()
        }
        return ErrorLogger.instance
    }

    /**
     * Log an error to the database
     */
    async logError(params: LogErrorParams): Promise<void> {
        try {
            const {
                errorType,
                featureName,
                errorMessage,
                stackTrace,
                severity = 'medium',
                userImpacted = true,
                requestUrl,
                requestMethod,
                requestData,
                autoRecovered = false
            } = params

            // Get current user and school from session (if available)
            const { data: { session } } = await supabase.auth.getSession()
            const userId = session?.user?.id || null

            // Get school_id from user metadata (if available)
            const schoolId = session?.user?.user_metadata?.school_id || null

            // Capture system state
            const systemState = this.captureSystemState()

            // Create error log entry
            const errorLog = {
                error_type: errorType,
                feature_name: featureName,
                error_message: errorMessage,
                stack_trace: stackTrace,
                severity,
                user_impacted: userImpacted,
                request_url: requestUrl || window?.location?.href,
                request_method: requestMethod,
                request_data: requestData,
                system_state: systemState,
                auto_recovered: autoRecovered,
                user_id: userId,
                school_id: schoolId
            }

            // Add to queue for batch processing
            this.errorQueue.push(errorLog)

            // Also log to console in development
            if (process.env.NODE_ENV === 'development') {
                console.group(`🚨 Error Logged: ${featureName}`)
                console.error('Type:', errorType)
                console.error('Severity:', severity)
                console.error('Message:', errorMessage)
                if (stackTrace) console.error('Stack:', stackTrace)
                console.groupEnd()
            }

            // If critical, send immediately
            if (severity === 'critical') {
                await this.processQueue()
            }

        } catch (error) {
            // Fallback: if error logging fails, just console.error
            console.error('Failed to log error:', error)
        }
    }

    /**
     * Capture current system state
     */
    private captureSystemState(): any {
        try {
            const state: any = {
                timestamp: new Date().toISOString(),
                userAgent: navigator?.userAgent,
                platform: navigator?.platform,
                language: navigator?.language,
                onLine: navigator?.onLine,
            }

            // Performance metrics (if available)
            if (performance && performance.memory) {
                state.memory = {
                    usedJSHeapSize: performance.memory.usedJSHeapSize,
                    totalJSHeapSize: performance.memory.totalJSHeapSize,
                    jsHeapSizeLimit: performance.memory.jsHeapSizeLimit
                }
            }

            // Screen info
            if (screen) {
                state.screen = {
                    width: screen.width,
                    height: screen.height,
                    availWidth: screen.availWidth,
                    availHeight: screen.availHeight
                }
            }

            return state
        } catch {
            return {}
        }
    }

    /**
     * Process error queue (batch insert to database)
     */
    private async processQueue(): Promise<void> {
        if (this.isProcessing || this.errorQueue.length === 0) return

        this.isProcessing = true

        try {
            const errorsToLog = [...this.errorQueue]
            this.errorQueue = []

            const { error } = await supabase
                .from('error_logs')
                .insert(errorsToLog)

            if (error) {
                console.error('Failed to insert error logs:', error)
                // Put them back in queue to retry
                this.errorQueue.unshift(...errorsToLog)
            }
        } catch (error) {
            console.error('Error processing queue:', error)
        } finally {
            this.isProcessing = false
        }
    }

    /**
     * Start background processing (every 5 seconds)
     */
    private startBackgroundProcessing(): void {
        setInterval(() => {
            if (this.errorQueue.length > 0) {
                this.processQueue()
            }
        }, 5000) // Process every 5 seconds
    }

    /**
     * Check if a feature should be disabled
     */
    async checkFeatureStatus(featureKey: string): Promise<boolean> {
        try {
            const { data: { session } } = await supabase.auth.getSession()
            const schoolId = session?.user?.user_metadata?.school_id

            if (!schoolId) return true // If no school, allow feature

            const { data, error } = await supabase
                .from('feature_status')
                .select('is_enabled')
                .eq('school_id', schoolId)
                .eq('feature_key', featureKey)
                .single()

            if (error || !data) return true // If no record, feature is enabled

            return data.is_enabled
        } catch {
            return true // On error, don't block features
        }
    }

    /**
     * Disable a feature after repeated errors
     */
    async disableFeature(featureKey: string, reason: string): Promise<void> {
        try {
            const { data: { session } } = await supabase.auth.getSession()
            const schoolId = session?.user?.user_metadata?.school_id

            if (!schoolId) return

            await supabase
                .from('feature_status')
                .upsert({
                    school_id: schoolId,
                    feature_key: featureKey,
                    feature_name: featureKey.replace(/_/g, ' ').toUpperCase(),
                    is_enabled: false,
                    disabled_reason: reason,
                    disabled_at: new Date().toISOString()
                })

            console.warn(`⚠️ Feature disabled: ${featureKey} - ${reason}`)
        } catch (error) {
            console.error('Failed to disable feature:', error)
        }
    }
}

// Export singleton instance
export const errorLogger = ErrorLogger.getInstance()

// Helper functions for common error scenarios
export const logApiError = (featureName: string, error: any, requestData?: any) => {
    errorLogger.logError({
        errorType: 'api',
        featureName,
        errorMessage: error.message || 'API request failed',
        stackTrace: error.stack,
        severity: 'high',
        requestData
    })
}

export const logDatabaseError = (featureName: string, error: any) => {
    errorLogger.logError({
        errorType: 'database',
        featureName,
        errorMessage: error.message || 'Database operation failed',
        stackTrace: error.stack,
        severity: 'critical',
        userImpacted: true
    })
}

export const logAIServiceError = (featureName: string, error: any) => {
    errorLogger.logError({
        errorType: 'ai_service',
        featureName,
        errorMessage: error.message || 'AI service request failed',
        stackTrace: error.stack,
        severity: 'medium',
        autoRecovered: false
    })
}

export const logFrontendError = (featureName: string, error: any) => {
    errorLogger.logError({
        errorType: 'frontend',
        featureName,
        errorMessage: error.message || 'Frontend error occurred',
        stackTrace: error.stack,
        severity: 'low'
    })
}
