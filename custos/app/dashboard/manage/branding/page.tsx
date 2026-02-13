'use client'

import { useState, useEffect } from 'react'
import { supabase, type School } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { Upload, Save, ArrowLeft } from 'lucide-react'

export default function BrandingPage() {
    const router = useRouter()
    const [loading, setLoading] = useState(false)
    const [school, setSchool] = useState<School | null>(null)
    const [formData, setFormData] = useState({
        name: '',
        primary_color: '#2563eb',
        secondary_color: '#7c3aed',
        logo_url: ''
    })

    useEffect(() => {
        loadSchoolData()
    }, [])

    const loadSchoolData = async () => {
        try {
            const { data: { session } } = await supabase.auth.getSession()
            if (!session) return

            const { data: userData } = await supabase
                .from('users')
                .select('school_id')
                .eq('email', session.user.email)
                .single()

            if (userData?.school_id) {
                const { data: schoolData } = await supabase
                    .from('schools')
                    .select('*')
                    .eq('school_id', userData.school_id)
                    .single()

                if (schoolData) {
                    setSchool(schoolData)
                    setFormData({
                        name: schoolData.name || '',
                        primary_color: schoolData.config_json?.primary_color || '#2563eb',
                        secondary_color: schoolData.config_json?.secondary_color || '#7c3aed',
                        logo_url: schoolData.config_json?.logo_url || ''
                    })
                }
            }
        } catch (error) {
            console.error('Error loading school data:', error)
        }
    }

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)

        try {
            const { data: { session } } = await supabase.auth.getSession()
            if (!session) return

            const { data: userData } = await supabase
                .from('users')
                .select('school_id')
                .eq('email', session.user.email)
                .single()

            const schoolData = {
                name: formData.name,
                config_json: {
                    logo_url: formData.logo_url,
                    primary_color: formData.primary_color,
                    secondary_color: formData.secondary_color
                }
            }

            if (school) {
                await supabase
                    .from('schools')
                    .update(schoolData)
                    .eq('school_id', school.school_id)
            } else if (userData?.school_id) {
                await supabase
                    .from('schools')
                    .insert({
                        school_id: userData.school_id,
                        ...schoolData
                    })
            }

            alert('School branding saved successfully!')
            router.push('/dashboard')
        } catch (error) {
            console.error('Error saving school data:', error)
            alert('Failed to save school branding')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50">
            <header className="bg-white border-b border-gray-200 shadow-sm">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-16">
                        <button
                            onClick={() => router.push('/dashboard/manage')}
                            className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 transition-colors"
                        >
                            <ArrowLeft className="w-5 h-5" />
                            <span>Back to Manage</span>
                        </button>
                        <h1 className="text-xl font-semibold text-gray-800">School Branding</h1>
                        <div className="w-32"></div>
                    </div>
                </div>
            </header>

            <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8">
                    <div className="mb-8">
                        <h2 className="text-2xl font-bold text-gray-900 mb-2">Customize Your School</h2>
                        <p className="text-gray-600">
                            Set up your school's branding to create a personalized experience for all users.
                        </p>
                    </div>

                    <form onSubmit={handleSave} className="space-y-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                School Name *
                            </label>
                            <input
                                type="text"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                required
                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                placeholder="e.g., St. Mary's High School"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Logo URL (Optional)
                            </label>
                            <input
                                type="url"
                                value={formData.logo_url}
                                onChange={(e) => setFormData({ ...formData, logo_url: e.target.value })}
                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                placeholder="https://example.com/logo.png"
                            />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Primary Color
                                </label>
                                <div className="flex space-x-3">
                                    <input
                                        type="color"
                                        value={formData.primary_color}
                                        onChange={(e) => setFormData({ ...formData, primary_color: e.target.value })}
                                        className="w-16 h-12 rounded-lg border border-gray-300 cursor-pointer"
                                    />
                                    <input
                                        type="text"
                                        value={formData.primary_color}
                                        onChange={(e) => setFormData({ ...formData, primary_color: e.target.value })}
                                        className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Secondary Color
                                </label>
                                <div className="flex space-x-3">
                                    <input
                                        type="color"
                                        value={formData.secondary_color}
                                        onChange={(e) => setFormData({ ...formData, secondary_color: e.target.value })}
                                        className="w-16 h-12 rounded-lg border border-gray-300 cursor-pointer"
                                    />
                                    <input
                                        type="text"
                                        value={formData.secondary_color}
                                        onChange={(e) => setFormData({ ...formData, secondary_color: e.target.value })}
                                        className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="mt-8 p-6 bg-gray-50 rounded-xl border border-gray-200">
                            <p className="text-sm font-medium text-gray-700 mb-4">Preview:</p>
                            <div
                                className="p-6 rounded-lg text-white"
                                style={{
                                    background: `linear-gradient(135deg, ${formData.primary_color}, ${formData.secondary_color})`
                                }}
                            >
                                <h3 className="text-2xl font-bold mb-2">{formData.name || 'Your School Name'}</h3>
                                <p className="text-white/90">Welcome to your personalized dashboard</p>
                            </div>
                        </div>

                        <div className="flex justify-end space-x-4 pt-6">
                            <button
                                type="button"
                                onClick={() => router.push('/dashboard/manage')}
                                className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={loading}
                                className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all disabled:opacity-50 flex items-center space-x-2"
                            >
                                <Save className="w-4 h-4" />
                                <span>{loading ? 'Saving...' : 'Save Branding'}</span>
                            </button>
                        </div>
                    </form>
                </div>
            </main>
        </div>
    )
}
