'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { ArrowLeft, Calendar, BookOpen, Layers, Wand2, Check, X, Loader2 } from 'lucide-react'

// Interfaces
interface SyllabusDocument {
    document_id: string
    chapter_title: string
    grade_level: number
    subjects: {
        name: string
        code: string
    }
}

interface Topic {
    topic_id: string
    topic_number: number
    topic_title: string
    estimated_duration_minutes: number
    difficulty_level: string
}

interface LessonPlanReview {
    schedule: any[]
    summary: any
}

interface ClassItem {
    class_id: string
    name: string
    section: string
}

interface AcademicYear {
    year_id: string
    year_name: string
}

export default function CreateLessonPlanPage() {
    const router = useRouter()

    // States
    const [loading, setLoading] = useState(false)
    const [step, setStep] = useState<1 | 2>(1) // 1: Config, 2: Review

    // Data Loading
    const [documents, setDocuments] = useState<SyllabusDocument[]>([])
    const [topics, setTopics] = useState<Topic[]>([])

    // Form Selection
    const [selectedDocId, setSelectedDocId] = useState<string>('')
    const [selectedTopicIds, setSelectedTopicIds] = useState<string[]>([])
    const [startDate, setStartDate] = useState('')
    const [endDate, setEndDate] = useState('')
    const [periodsPerWeek, setPeriodsPerWeek] = useState(5)

    // AI Result
    const [generatedPlan, setGeneratedPlan] = useState<LessonPlanReview | null>(null)
    const [generating, setGenerating] = useState(false)

    // New State for Context
    const [classes, setClasses] = useState<ClassItem[]>([])
    const [academicYears, setAcademicYears] = useState<AcademicYear[]>([])
    const [selectedClassId, setSelectedClassId] = useState('')
    const [selectedYearId, setSelectedYearId] = useState('')
    const [userId, setUserId] = useState<string | null>(null)
    const [isSaving, setIsSaving] = useState(false)

    // Load Initial Data
    useEffect(() => {
        checkUser()
        loadDocuments()
        loadClasses()
        loadAcademicYears()
    }, [])

    // Load Topics when Document Changes
    useEffect(() => {
        if (selectedDocId) {
            loadTopics(selectedDocId)
        } else {
            setTopics([])
            setSelectedTopicIds([])
        }
    }, [selectedDocId])

    async function checkUser() {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) setUserId(user.id)
    }

    async function loadClasses() {
        const { data, error } = await supabase
            .from('classes')
            .select('*')
            .order('name', { ascending: true })

        if (error) {
            console.error('Error loading classes:', error)
        }
        setClasses(data || [])
    }

    async function loadAcademicYears() {
        const { data, error } = await supabase
            .from('academic_years')
            .select('*')
            .order('created_at', { ascending: false })

        if (error) {
            console.error('Error loading academic years:', error)
        }
        setAcademicYears(data || [])
        // Auto-select first available year (or the one marked is_current)
        if (data && data.length > 0) {
            const currentYear = data.find((y: any) => y.is_current) || data[0]
            setSelectedYearId(currentYear.year_id)
        }
    }

    async function loadDocuments() {
        try {
            const { data, error } = await supabase
                .from('syllabus_documents')
                .select(`
                    document_id,
                    chapter_title,
                    grade_level,
                    subjects:subject_id (name, code)
                `)
                .order('created_at', { ascending: false })

            if (error) throw error
            const formattedData = (data || []).map((item: any) => ({
                ...item,
                subjects: Array.isArray(item.subjects) ? item.subjects[0] : item.subjects
            }))
            setDocuments(formattedData)
        } catch (error: any) {
            console.error('Error loading documents:', error)
            alert('Failed to load syllabus documents')
        }
    }

    async function loadTopics(docId: string) {
        try {
            const { data, error } = await supabase
                .from('lesson_topics')
                .select('*')
                .eq('document_id', docId)
                .order('topic_number', { ascending: true })

            if (error) throw error
            setTopics(data || [])
            // Select all topics by default
            if (data) setSelectedTopicIds(data.map(t => t.topic_id))
        } catch (error: any) {
            console.error('Error loading topics:', error)
        }
    }

    const toggleTopic = (id: string) => {
        if (selectedTopicIds.includes(id)) {
            setSelectedTopicIds(selectedTopicIds.filter(tid => tid !== id))
        } else {
            setSelectedTopicIds([...selectedTopicIds, id])
        }
    }

    async function handleGenerate() {
        // Detailed validation
        const missing = []
        if (!selectedClassId) missing.push('Class')
        if (!selectedYearId) missing.push('Academic Year')
        if (!selectedDocId) missing.push('Syllabus')
        if (selectedTopicIds.length === 0) missing.push('Topics (select at least one)')
        if (!startDate) missing.push('Start Date')
        if (!endDate) missing.push('End Date')

        if (missing.length > 0) {
            alert('Missing required fields:\n• ' + missing.join('\n• '))
            return
        }

        setGenerating(true)
        try {
            // Prepare payload
            const selectedTopics = topics.filter(t => selectedTopicIds.includes(t.topic_id))

            const payload = {
                topics: selectedTopics.map(t => ({
                    topic_id: t.topic_id,
                    topic_title: t.topic_title,
                    duration_minutes: t.estimated_duration_minutes || 45,
                    difficulty: t.difficulty_level || 'medium',
                    learning_objectives: [] // Add if available
                })),
                constraints: {
                    total_days: calculateDaysBetween(startDate, endDate),
                    periods_per_week: periodsPerWeek,
                    period_duration_minutes: 45, // Default
                    holidays: [] // Can add input later
                }
            }

            // Call AI Service
            // Note: In local dev, use localhost:8000
            const response = await fetch('http://localhost:8000/api/lesson-plan/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            })

            if (!response.ok) throw new Error('AI Generation failed')

            const data = await response.json()
            setGeneratedPlan(data)
            setStep(2)

        } catch (error: any) {
            console.error('Error generating plan:', error)
            alert('Failed to generate lesson plan: ' + error.message)
        } finally {
            setGenerating(false)
        }
    }

    function calculateDaysBetween(start: string, end: string) {
        const diff = new Date(end).getTime() - new Date(start).getTime()
        return Math.floor(diff / (1000 * 60 * 60 * 24)) + 1
    }

    async function handleSave() {
        if (!generatedPlan || !selectedDocId || !userId) return
        setIsSaving(true)

        try {
            // 1. Create Master Lesson Plan
            const { data: planData, error: planError } = await supabase
                .from('lesson_plans')
                .insert({
                    document_id: selectedDocId,
                    teacher_id: userId,
                    class_id: selectedClassId,
                    academic_year_id: selectedYearId,
                    start_date: startDate,
                    end_date: endDate,
                    total_periods: generatedPlan.schedule.length, // approximation
                    periods_per_week: periodsPerWeek,
                    ai_schedule: generatedPlan,
                    status: 'published' // Auto-publish for now
                })
                .select()
                .single()

            if (planError) throw planError

            // 2. Create Daily Lesson Details
            const dailyDetails = generatedPlan.schedule.map((dayItem: any) => ({
                plan_id: planData.plan_id,
                topic_id: dayItem.topic_id, // Ensure AI returns this or we map it
                // Calculate date based on day number
                lesson_date: addDays(startDate, dayItem.day - 1),
                day_number: dayItem.day,
                period_number: 1, // Phase 1: Assume 1 period per day entry
                topic_content: {
                    title: dayItem.topic_title,
                    activities: dayItem.activities
                },
                status: 'scheduled'
            }))

            // Note: topic_id might be needed from AI response or matching logic
            // For this refined step, we'll try to insert what we have

            const { error: detailsError } = await supabase
                .from('daily_lesson_details')
                .insert(dailyDetails)

            if (detailsError) throw detailsError

            alert('Lesson Plan Saved Successfully!')
            router.push('/dashboard/manage/lesson-plans')

        } catch (error: any) {
            console.error('Error saving plan:', error)
            alert('Failed to save plan: ' + error.message)
        } finally {
            setIsSaving(false)
        }
    }

    // Helper
    function addDays(date: string, days: number) {
        const result = new Date(date)
        result.setDate(result.getDate() + days)
        return result.toISOString().split('T')[0]
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50 p-8">
            <div className="max-w-4xl mx-auto">
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => {
                                if (step === 2) setStep(1)
                                else router.push('/dashboard/manage/lesson-plans')
                            }}
                            className="p-2 hover:bg-white rounded-lg transition-colors"
                        >
                            <ArrowLeft className="w-6 h-6 text-gray-600" />
                        </button>
                        <div>
                            <h1 className="text-3xl font-bold text-gray-900">
                                {step === 1 ? 'Create AI Lesson Plan' : 'Review Generated Plan'}
                            </h1>
                            <p className="text-gray-600">
                                {step === 1 ? 'Configure settings for magical generation' : 'AI has optimized your schedule'}
                            </p>
                        </div>
                    </div>
                </div>

                {step === 1 && (
                    <div className="bg-white rounded-2xl shadow-xl p-8 space-y-8">
                        {/* 0. Context Selection (New) */}
                        <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Class</label>
                                <select
                                    value={selectedClassId}
                                    onChange={(e) => setSelectedClassId(e.target.value)}
                                    className="w-full p-3 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-purple-500 text-gray-900"
                                >
                                    <option value="">-- Select Class --</option>
                                    {classes.map(c => (
                                        <option key={c.class_id} value={c.class_id}>{c.name} {c.section}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Academic Year</label>
                                <select
                                    value={selectedYearId}
                                    onChange={(e) => setSelectedYearId(e.target.value)}
                                    className="w-full p-3 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-purple-500 bg-gray-50 text-gray-900"
                                    disabled // Auto-selected active year
                                >
                                    {academicYears.map(y => (
                                        <option key={y.year_id} value={y.year_id}>{y.year_name}</option>
                                    ))}
                                </select>
                            </div>
                        </section>

                        {/* 1. Select Syllabus */}
                        <section>
                            <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                                <BookOpen className="w-5 h-5 text-purple-600" />
                                Select Syllabus
                            </h3>
                            <select
                                value={selectedDocId}
                                onChange={(e) => setSelectedDocId(e.target.value)}
                                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition-all text-gray-900"
                            >
                                <option value="">-- Choose a Chapter --</option>
                                {documents.map(doc => (
                                    <option key={doc.document_id} value={doc.document_id}>
                                        {doc.subjects.code} - {doc.chapter_title} (Grade {doc.grade_level})
                                    </option>
                                ))}
                            </select>
                        </section>

                        {/* 2. Configure Topics */}
                        {loading ? (
                            <div className="flex justify-center py-8">
                                <Loader2 className="w-8 h-8 text-purple-600 animate-spin" />
                            </div>
                        ) : topics.length > 0 && (
                            <section>
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                                        <Layers className="w-5 h-5 text-blue-600" />
                                        Select Topics to Cover
                                    </h3>
                                    <span className="text-sm text-gray-500">
                                        {selectedTopicIds.length} / {topics.length} selected
                                    </span>
                                </div>
                                <div className="grid grid-cols-1 gap-2 max-h-60 overflow-y-auto pr-2">
                                    {topics.map(topic => (
                                        <div
                                            key={topic.topic_id}
                                            onClick={() => toggleTopic(topic.topic_id)}
                                            className={`p-3 rounded-lg border cursor-pointer transition-all flex items-center gap-3 ${selectedTopicIds.includes(topic.topic_id)
                                                ? 'bg-purple-50 border-purple-300'
                                                : 'bg-white border-gray-200 hover:border-purple-200'
                                                }`}
                                        >
                                            <div className={`w-5 h-5 rounded border flex items-center justify-center ${selectedTopicIds.includes(topic.topic_id)
                                                ? 'bg-purple-600 border-purple-600'
                                                : 'border-gray-400'
                                                }`}>
                                                {selectedTopicIds.includes(topic.topic_id) && <Check className="w-3 h-3 text-white" />}
                                            </div>
                                            <div>
                                                <p className="font-medium text-gray-900">{topic.topic_title}</p>
                                                <p className="text-xs text-gray-500">
                                                    Duration: {topic.estimated_duration_minutes} min • {topic.difficulty_level}
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </section>
                        )}

                        {/* 3. Schedule Constraints */}
                        <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                                    <Calendar className="w-5 h-5 text-green-600" />
                                    Timeline
                                </h3>
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                                        <input
                                            type="date"
                                            value={startDate}
                                            onChange={(e) => setStartDate(e.target.value)}
                                            className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none text-gray-900 bg-white"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Target End Date</label>
                                        <input
                                            type="date"
                                            value={endDate}
                                            onChange={(e) => setEndDate(e.target.value)}
                                            className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none text-gray-900 bg-white"
                                        />
                                    </div>
                                </div>
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-gray-900 mb-4">Settings</h3>
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Periods per Week</label>
                                        <input
                                            type="number"
                                            min="1" max="10"
                                            value={periodsPerWeek || 5}
                                            onChange={(e) => {
                                                const val = parseInt(e.target.value)
                                                setPeriodsPerWeek(isNaN(val) ? 5 : val)
                                            }}
                                            className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none text-gray-900 bg-white"
                                        />
                                    </div>
                                    {/* Holiday selector placeholder */}
                                    <div className="p-4 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                                        <p className="text-sm text-gray-500 text-center">Holiday configuration coming soon</p>
                                    </div>
                                </div>
                            </div>
                        </section>

                        {/* Action */}
                        <div className="flex justify-end pt-4">
                            <button
                                onClick={handleGenerate}
                                disabled={generating || !selectedDocId}
                                className={`px-8 py-4 rounded-xl font-bold text-lg flex items-center gap-3 transition-all ${generating
                                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                    : 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:shadow-lg hover:scale-[1.02]'
                                    }`}
                            >
                                {generating ? (
                                    <>
                                        <Loader2 className="w-6 h-6 animate-spin" />
                                        Generating Plan...
                                    </>
                                ) : (
                                    <>
                                        <Wand2 className="w-6 h-6" />
                                        Generate Magic Plan
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                )}

                {step === 2 && generatedPlan && (
                    <div className="space-y-6">
                        {/* Summary Card */}
                        <div className="bg-white rounded-xl shadow-lg p-6 flex justify-between items-center">
                            <div>
                                <h3 className="text-xl font-bold text-gray-900">Plan Summary</h3>
                                <div className="flex gap-6 mt-2 text-gray-600">
                                    <p>Days: <span className="font-semibold text-purple-600">{generatedPlan.summary.total_days}</span></p>
                                    <p>Topics: <span className="font-semibold text-blue-600">{generatedPlan.summary.topics_covered}</span></p>
                                    <p>Utilization: <span className="font-semibold text-green-600">{generatedPlan.summary.percent_utilization}%</span></p>
                                </div>
                            </div>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setStep(1)} // Back to edit
                                    className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                                >
                                    Adjust Settings
                                </button>
                                <button
                                    onClick={handleSave}
                                    className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold shadow-md"
                                >
                                    Save & Publish
                                </button>
                            </div>
                        </div>

                        {/* Schedule Timeline */}
                        <div className="bg-white rounded-xl shadow-xl overflow-hidden">
                            <div className="p-6 border-b border-gray-100 bg-gray-50">
                                <h3 className="font-bold text-gray-900">Generated Schedule</h3>
                            </div>
                            <div className="divide-y divide-gray-100">
                                {generatedPlan.schedule.map((dayItem: any, idx: number) => (
                                    <div key={idx} className="p-6 flex gap-6 hover:bg-gray-50 transition-colors">
                                        <div className="flex-shrink-0 w-24 text-center">
                                            <div className="text-xs font-bold text-gray-500 uppercase tracking-wider">Day</div>
                                            <div className="text-3xl font-extrabold text-purple-600">{dayItem.day}</div>
                                            <div className="text-xs text-gray-400 mt-1">{dayItem.duration} min</div>
                                        </div>
                                        <div className="flex-1">
                                            <h4 className="text-lg font-bold text-gray-900 mb-1">{dayItem.topic_title}</h4>
                                            <div className="flex gap-2 mb-2">
                                                {dayItem.activities?.map((act: string, i: number) => (
                                                    <span key={i} className="px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded-full border border-blue-100 font-medium">
                                                        {act}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
