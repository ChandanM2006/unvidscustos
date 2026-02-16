'use client'

import React, { Component, ErrorInfo, ReactNode } from 'react'
import { errorLogger } from '@/lib/errorLogger'
import { AlertTriangle, RefreshCw, Home } from 'lucide-react'

interface Props {
    children: ReactNode
    fallback?: ReactNode
    featureName?: string
}

interface State {
    hasError: boolean
    error: Error | null
    errorInfo: ErrorInfo | null
}

/**
 * Global Error Boundary
 * Catches all React errors and prevents crashes
 */
export class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props)
        this.state = {
            hasError: false,
            error: null,
            errorInfo: null
        }
    }

    static getDerivedStateFromError(error: Error): State {
        // Update state so the next render will show the fallback UI
        return {
            hasError: true,
            error,
            errorInfo: null
        }
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        // Log error to our monitoring system
        errorLogger.logError({
            errorType: 'frontend',
            featureName: this.props.featureName || 'Unknown Feature',
            errorMessage: error.message,
            stackTrace: error.stack || (errorInfo.componentStack ?? undefined),
            severity: 'high',
            userImpacted: true
        })

        // Update state with error details
        this.setState({
            error,
            errorInfo
        })

        // Also log to console in development
        if (process.env.NODE_ENV === 'development') {
            console.error('Error caught by boundary:', error, errorInfo)
        }
    }

    handleReset = () => {
        this.setState({
            hasError: false,
            error: null,
            errorInfo: null
        })
    }

    render() {
        if (this.state.hasError) {
            // If custom fallback provided, use it
            if (this.props.fallback) {
                return this.props.fallback
            }

            // Default elegant error UI
            return (
                <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 via-orange-50 to-yellow-50 p-4">
                    <div className="max-w-2xl w-full bg-white rounded-2xl shadow-2xl p-8 border-2 border-red-200">
                        <div className="flex items-center justify-center mb-6">
                            <div className="w-20 h-20 bg-gradient-to-br from-red-500 to-orange-500 rounded-full flex items-center justify-center">
                                <AlertTriangle className="w-10 h-10 text-white" />
                            </div>
                        </div>

                        <h1 className="text-3xl font-bold text-gray-900 text-center mb-3">
                            Oops! Something went wrong
                        </h1>

                        <p className="text-gray-600 text-center mb-6">
                            Don't worry! Our team has been notified and we're working on it.
                            The rest of the application is still working fine.
                        </p>

                        {process.env.NODE_ENV === 'development' && this.state.error && (
                            <div className="mb-6 p-4 bg-gray-100 rounded-lg border border-gray-300">
                                <h3 className="text-sm font-semibold text-gray-700 mb-2">Error Details (Dev Mode):</h3>
                                <p className="text-xs text-red-600 font-mono mb-2">
                                    {this.state.error.message}
                                </p>
                                {this.state.errorInfo && (
                                    <details className="text-xs text-gray-600 font-mono">
                                        <summary className="cursor-pointer text-blue-600 hover:text-blue-800">
                                            View Stack Trace
                                        </summary>
                                        <pre className="mt-2 whitespace-pre-wrap overflow-x-auto">
                                            {this.state.errorInfo.componentStack}
                                        </pre>
                                    </details>
                                )}
                            </div>
                        )}

                        <div className="flex gap-4">
                            <button
                                onClick={this.handleReset}
                                className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all font-semibold flex items-center justify-center gap-2 shadow-lg hover:shadow-xl"
                            >
                                <RefreshCw className="w-5 h-5" />
                                Try Again
                            </button>
                            <button
                                onClick={() => window.location.href = '/dashboard'}
                                className="flex-1 px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors font-semibold flex items-center justify-center gap-2"
                            >
                                <Home className="w-5 h-5" />
                                Go Home
                            </button>
                        </div>

                        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                            <p className="text-sm text-blue-800">
                                <strong>✨ Good News:</strong> This error has been automatically logged and
                                our monitoring system has captured all the details. You can continue using
                                other features of the application without any issues.
                            </p>
                        </div>
                    </div>
                </div>
            )
        }

        return this.props.children
    }
}

/**
 * Feature-specific error fallback component
 */
export const FeatureUnavailable: React.FC<{ featureName?: string }> = ({ featureName = 'This feature' }) => {
    return (
        <div className="p-8 bg-yellow-50 border-2 border-yellow-300 rounded-xl text-center">
            <div className="w-16 h-16 bg-yellow-400 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="w-8 h-8 text-yellow-900" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">
                {featureName} is Temporarily Unavailable
            </h3>
            <p className="text-gray-700 mb-4">
                We're experiencing technical difficulties with this feature.
                Our team has been notified and is working on a fix.
            </p>
            <p className="text-sm text-gray-600">
                You can continue using other features of the application without any issues.
            </p>
            <button
                onClick={() => window.location.reload()}
                className="mt-6 px-6 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-colors font-medium"
            >
                Refresh Page
            </button>
        </div>
    )
}
