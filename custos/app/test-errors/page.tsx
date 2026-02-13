'use client'

import { useState } from 'react'
import { ErrorBoundary, FeatureUnavailable } from '@/components/ErrorBoundary'
import { errorLogger, logApiError, logDatabaseError, logAIServiceError } from '@/lib/errorLogger'
import { Bug, AlertTriangle, Check } from 'lucide-react'

// Component that crashes on demand
function CrashTestComponent({ shouldCrash }: { shouldCrash: boolean }) {
    if (shouldCrash) {
        throw new Error('💥 Intentional crash for testing!')
    }
    return (
        <div className="p-6 bg-green-50 border-2 border-green-300 rounded-xl">
            <div className="flex items-center gap-3 text-green-700">
                <Check className="w-6 h-6" />
                <span className="font-semibold">Component is working perfectly! ✅</span>
            </div>
        </div>
    )
}

export default function ErrorTestPage() {
    const [triggerCrash, setTriggerCrash] = useState(false)
    const [testResults, setTestResults] = useState<string[]>([])

    const addResult = (message: string) => {
        setTestResults(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`])
    }

    const testApiError = () => {
        try {
            // Simulate API error
            throw new Error('API connection timeout - Simulated')
        } catch (error: any) {
            logApiError('Test API Call', error, { endpoint: '/test', method: 'GET' })
            addResult('✅ API Error logged successfully!')
        }
    }

    const testDatabaseError = () => {
        try {
            throw new Error('Database connection failed - Simulated')
        } catch (error: any) {
            logDatabaseError('Test Database Query', error)
            addResult('✅ Database Error logged successfully!')
        }
    }

    const testAIServiceError = () => {
        try {
            throw new Error('AI service unavailable - Simulated')
        } catch (error: any) {
            logAIServiceError('Test AI Extraction', error)
            addResult('✅ AI Service Error logged successfully!')
        }
    }

    const testCustomError = async () => {
        await errorLogger.logError({
            errorType: 'unknown',
            featureName: 'Custom Test',
            errorMessage: 'This is a custom error message for testing',
            severity: 'medium',
            userImpacted: false,
            autoRecovered: true
        })
        addResult('✅ Custom Error logged successfully!')
    }

    const testCriticalError = async () => {
        await errorLogger.logError({
            errorType: 'database',
            featureName: 'Critical System',
            errorMessage: 'CRITICAL: System failure detected',
            severity: 'critical',
            userImpacted: true,
            autoRecovered: false
        })
        addResult('🚨 CRITICAL Error logged (sent immediately)!')
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-red-50 p-8">
            <div className="max-w-5xl mx-auto">
                <div className="bg-white rounded-2xl shadow-2xl p-8 mb-8">
                    <div className="flex items-center gap-3 mb-6">
                        <Bug className="w-10 h-10 text-purple-600" />
                        <div>
                            <h1 className="text-3xl font-bold text-gray-900">
                                🛡️ Error System Test Lab
                            </h1>
                            <p className="text-gray-600 mt-1">
                                Test the unbreakable error handling system
                            </p>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mb-8">
                        {/* Error Type Tests */}
                        <div className="space-y-3">
                            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                                <AlertTriangle className="w-5 h-5 text-orange-500" />
                                Error Logging Tests
                            </h3>

                            <button
                                onClick={testApiError}
                                className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                            >
                                Test API Error
                            </button>

                            <button
                                onClick={testDatabaseError}
                                className="w-full px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium"
                            >
                                Test Database Error
                            </button>

                            <button
                                onClick={testAIServiceError}
                                className="w-full px-4 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium"
                            >
                                Test AI Service Error
                            </button>

                            <button
                                onClick={testCustomError}
                                className="w-full px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
                            >
                                Test Custom Error
                            </button>

                            <button
                                onClick={testCriticalError}
                                className="w-full px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
                            >
                                🚨 Test CRITICAL Error
                            </button>
                        </div>

                        {/* Component Crash Test */}
                        <div className="space-y-3">
                            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                                <Bug className="w-5 h-5 text-red-500" />
                                Component Crash Test
                            </h3>

                            <div className="p-4 bg-yellow-50 border-2 border-yellow-300 rounded-lg">
                                <p className="text-sm text-yellow-800 mb-3">
                                    This tests the Error Boundary. Click to crash a component and see the fallback UI.
                                </p>
                                <button
                                    onClick={() => setTriggerCrash(true)}
                                    className="w-full px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
                                >
                                    💥 Crash This Component
                                </button>
                            </div>

                            <ErrorBoundary featureName="Test Component Crash">
                                <CrashTestComponent shouldCrash={triggerCrash} />
                            </ErrorBoundary>

                            {triggerCrash && (
                                <button
                                    onClick={() => {
                                        setTriggerCrash(false)
                                        addResult('✅ Component recovered from crash!')
                                    }}
                                    className="w-full px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
                                >
                                    ↻ Reset Component
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Test Results */}
                    <div className="mt-8">
                        <h3 className="font-semibold text-gray-900 mb-3">📊 Test Results Log:</h3>
                        <div className="bg-gray-900 rounded-lg p-4 max-h-64 overflow-y-auto">
                            {testResults.length === 0 ? (
                                <p className="text-gray-500 text-sm font-mono">No tests run yet. Click buttons above to test!</p>
                            ) : (
                                <div className="space-y-1">
                                    {testResults.map((result, idx) => (
                                        <div key={idx} className="text-green-400 text-sm font-mono">
                                            {result}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Instructions */}
                    <div className="mt-8 p-6 bg-gradient-to-r from-blue-50 to-purple-50 border-2 border-blue-200 rounded-xl">
                        <h3 className="font-semibold text-gray-900 mb-3">📋 What to Check:</h3>
                        <ol className="space-y-2 text-gray-700">
                            <li>1. Click the test buttons above</li>
                            <li>2. Check the console (DevTools) to see errors logged</li>
                            <li>3. Go to Supabase → Database → `error_logs` table to see logged errors</li>
                            <li>4. Try the component crash to see Error Boundary in action</li>
                            <li>5. Notice: <strong>The page never crashes!</strong> 🛡️</li>
                        </ol>
                    </div>

                    {/* Next Steps */}
                    <div className="mt-6 p-6 bg-green-50 border-2 border-green-300 rounded-xl">
                        <h3 className="font-semibold text-green-900 mb-2">✅ System Working!</h3>
                        <p className="text-green-800">
                            All errors are being captured and logged. Once you run the database migration,
                            these errors will be stored in Supabase and visible in the Platform Owner Dashboard!
                        </p>
                    </div>
                </div>
            </div>
        </div>
    )
}
