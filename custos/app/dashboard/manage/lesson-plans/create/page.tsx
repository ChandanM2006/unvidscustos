'use client'

import { useState, useEffect } from 'react'
import { useSmartBack } from '@/lib/navigation'
import { supabase } from '@/lib/supabase'
import { ArrowLeft, Calendar, BookOpen, Layers, Wand2, Check, X, Loader2, Clock } from 'lucide-react'

// Interfaces
interface SyllabusDocument {
    document_id: string
    chapter_title: string
    chapter_number: number
    grade_level: number
    subject_id: string
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
    grade_level: number
    section?: string
}

interface AcademicYear {
    year_id: string
    year_name: string
}

interface TeacherAssignment {
    class_id: string
    subject_id: string
    class_name: string
    grade_level: number
    subject_name: string
    subject_code: string
}

export default function CreateLessonPlanPage() {
    const { goBack, router } = useSmartBack('/dashboard/manage/lesson-plans')

    // States
    const [loading, setLoading] = useState(true)
    const [step, setStep] = useState<1 | 2>(1) // 1: Config, 2: Review

    // Data Loading
    const [documents, setDocuments] = useState<SyllabusDocument[]>([])
    const [filteredDocuments, setFilteredDocuments] = useState<SyllabusDocument[]>([])
    const [topics, setTopics] = useState<Topic[]>([])

    // Form Selection
    const [selectedDocId, setSelectedDocId] = useState<string>('')
    const [selectedTopicIds, setSelectedTopicIds] = useState<string[]>([])
    const [startDate, setStartDate] = useState('')
    const [endDate, setEndDate] = useState('')
    const [periodsPerWeek, setPeriodsPerWeek] = useState(0)
    const [periodsAutoDetected, setPeriodsAutoDetected] = useState(false)
    const [holidays, setHolidays] = useState<string[]>([])
    const [newHoliday, setNewHoliday] = useState('')

    // AI Result
    const [generatedPlan, setGeneratedPlan] = useState<LessonPlanReview | null>(null)
    const [generating, setGenerating] = useState(false)

    // Context
    const [teacherClasses, setTeacherClasses] = useState<ClassItem[]>([])
    const [teacherAssignments, setTeacherAssignments] = useState<TeacherAssignment[]>([])
    const [academicYears, setAcademicYears] = useState<AcademicYear[]>([])
    const [selectedClassId, setSelectedClassId] = useState('')
    const [selectedYearId, setSelectedYearId] = useState('')
    const [userId, setUserId] = useState<string | null>(null)
    const [userSchoolId, setUserSchoolId] = useState<string | null>(null)
    const [isSaving, setIsSaving] = useState(false)

    // Load Initial Data
    useEffect(() => {
        initPage()
    }, [])

    // When class changes → filter documents + auto-detect periods
    useEffect(() => {
        if (selectedClassId && userId) {
            filterDocumentsForClass(selectedClassId)
            autoDetectPeriodsPerWeek(selectedClassId)
        } else {
            setFilteredDocuments([])
            setPeriodsPerWeek(0)
            setPeriodsAutoDetected(false)
        }
        // Reset downstream selections
        setSelectedDocId('')
        setTopics([])
        setSelectedTopicIds([])
    }, [selectedClassId])

    // Load topics when document changes
    useEffect(() => {
        if (selectedDocId) {
            loadTopics(selectedDocId)
        } else {
            setTopics([])
            setSelectedTopicIds([])
        }
    }, [selectedDocId])

    async function initPage() {
        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return
            setUserId(user.id)

            // Get user's school_id and role
            const { data: userData } = await supabase
                .from('users')
                .select('school_id, role')
                .eq('user_id', user.id)
                .single()

            if (!userData?.school_id) return
            setUserSchoolId(userData.school_id)

            const isAdmin = ['super_admin', 'sub_admin'].includes(userData.role)

            // Load in parallel
            await Promise.all([
                loadTeacherAssignments(user.id, userData.school_id, isAdmin),
                loadAllDocuments(userData.school_id),
                loadAcademicYears(userData.school_id)
            ])
        } catch (error) {
            console.error('Error initializing page:', error)
        } finally {
            setLoading(false)
        }
    }

    /**
     * Load classes assigned to this teacher from timetable_entries.
     * This gives us the unique class_id + subject_id combinations for this teacher.
     */
    async function loadTeacherAssignments(teacherId: string, schoolId: string, isAdmin: boolean) {
        try {
            if (isAdmin) {
                // Admins see all classes
                const { data: classesData } = await supabase
                    .from('classes')
                    .select('class_id, name, grade_level')
                    .eq('school_id', schoolId)
                    .order('grade_level', { ascending: true })

                setTeacherClasses(classesData || [])
                setTeacherAssignments([]) // Admins don't need assignment filtering
                return
            }

            // For teachers: get their class+subject assignments from timetable_entries
            // Step 1: Get the raw timetable entries (just IDs — no joins)
            const { data: entries, error } = await supabase
                .from('timetable_entries')
                .select('class_id, subject_id')
                .eq('teacher_id', teacherId)

            if (error) {
                console.error('Error loading timetable entries:', error)
                // Fallback: try teacher_subjects table
                await loadFromTeacherSubjects(teacherId, schoolId)
                return
            }

            if (!entries || entries.length === 0) {
                // Fallback: try teacher_subjects table
                await loadFromTeacherSubjects(teacherId, schoolId)
                return
            }

            // Step 2: Get unique class IDs and subject IDs
            const uniqueClassIds = [...new Set(entries.map(e => e.class_id))]
            const uniqueSubjectIds = [...new Set(entries.map(e => e.subject_id))]

            // Step 3: Fetch class and subject details separately
            const [classesResult, subjectsResult] = await Promise.all([
                supabase
                    .from('classes')
                    .select('class_id, name, grade_level')
                    .in('class_id', uniqueClassIds),
                supabase
                    .from('subjects')
                    .select('subject_id, name, code')
                    .in('subject_id', uniqueSubjectIds)
            ])

            const classLookup = new Map<string, { name: string; grade_level: number }>()
            for (const c of (classesResult.data || [])) {
                classLookup.set(c.class_id, { name: c.name, grade_level: c.grade_level })
            }

            const subjectLookup = new Map<string, { name: string; code: string }>()
            for (const s of (subjectsResult.data || [])) {
                subjectLookup.set(s.subject_id, { name: s.name, code: s.code })
            }

            // Step 4: Deduplicate class+subject combinations
            const assignmentMap = new Map<string, TeacherAssignment>()
            const classMap = new Map<string, ClassItem>()

            for (const entry of entries) {
                const classInfo = classLookup.get(entry.class_id)
                const subjectInfo = subjectLookup.get(entry.subject_id)

                if (!classInfo || !subjectInfo) continue

                const key = `${entry.class_id}_${entry.subject_id}`
                if (!assignmentMap.has(key)) {
                    assignmentMap.set(key, {
                        class_id: entry.class_id,
                        subject_id: entry.subject_id,
                        class_name: classInfo.name,
                        grade_level: classInfo.grade_level,
                        subject_name: subjectInfo.name,
                        subject_code: subjectInfo.code
                    })
                }

                if (!classMap.has(entry.class_id)) {
                    classMap.set(entry.class_id, {
                        class_id: entry.class_id,
                        name: classInfo.name,
                        grade_level: classInfo.grade_level
                    })
                }
            }

            const uniqueClasses = Array.from(classMap.values()).sort((a, b) => a.grade_level - b.grade_level)
            setTeacherClasses(uniqueClasses)
            setTeacherAssignments(Array.from(assignmentMap.values()))

        } catch (error) {
            console.error('Error loading teacher assignments:', error)
        }
    }

    /**
     * Fallback: If timetable_entries is empty, use teacher_subjects table.
     * If that's also empty, load ALL classes so the page is still usable.
     */
    async function loadFromTeacherSubjects(teacherId: string, schoolId: string) {
        try {
            // Step 1: Get subject IDs assigned to this teacher
            const { data: assignments } = await supabase
                .from('teacher_subjects')
                .select('subject_id')
                .eq('teacher_id', teacherId)

            if (assignments && assignments.length > 0) {
                // Step 2: Get subject details 
                const subjectIds = assignments.map(a => a.subject_id)
                const { data: subjectsData } = await supabase
                    .from('subjects')
                    .select('subject_id, name, code, grade_levels')
                    .in('subject_id', subjectIds)

                // Get all grade levels from assigned subjects
                const gradeLevels = new Set<number>()
                for (const subj of (subjectsData || [])) {
                    if (subj?.grade_levels) {
                        for (const gl of subj.grade_levels) {
                            gradeLevels.add(gl)
                        }
                    }
                }

                // Get classes matching those grade levels
                if (gradeLevels.size > 0) {
                    const { data: classesData } = await supabase
                        .from('classes')
                        .select('class_id, name, grade_level')
                        .eq('school_id', schoolId)
                        .in('grade_level', Array.from(gradeLevels))
                        .order('grade_level')

                    if (classesData && classesData.length > 0) {
                        setTeacherClasses(classesData)
                        return
                    }
                }
            }
        } catch (err) {
            console.error('Error loading teacher_subjects:', err)
        }

        // Final fallback: load ALL classes for the school
        // (timetable not configured yet — still let them use the page)
        console.log('[LessonPlan] No timetable or teacher_subjects found. Showing all school classes.')
        const { data: allClasses } = await supabase
            .from('classes')
            .select('class_id, name, grade_level')
            .eq('school_id', schoolId)
            .order('grade_level', { ascending: true })

        setTeacherClasses(allClasses || [])
        setTeacherAssignments([]) // No filtering — show all chapters
    }

    async function loadAcademicYears(schoolId: string) {
        const { data, error } = await supabase
            .from('academic_years')
            .select('*')
            .eq('school_id', schoolId)
            .order('created_at', { ascending: false })

        if (error) {
            console.error('Error loading academic years:', error)
        }
        setAcademicYears(data || [])
        if (data && data.length > 0) {
            const currentYear = data.find((y: any) => y.is_current) || data[0]
            setSelectedYearId(currentYear.year_id)
        }
    }

    /**
     * Load ALL syllabus documents for the school (we filter client-side based on class selection)
     */
    async function loadAllDocuments(schoolId: string) {
        try {
            const { data: schoolSubjects } = await supabase
                .from('subjects')
                .select('subject_id')
                .eq('school_id', schoolId)

            const subjectIds = schoolSubjects?.map(s => s.subject_id) || []
            if (subjectIds.length === 0) {
                setDocuments([])
                return
            }

            const { data, error } = await supabase
                .from('syllabus_documents')
                .select(`
                    document_id,
                    chapter_title,
                    chapter_number,
                    grade_level,
                    subject_id,
                    subjects:subject_id (name, code)
                `)
                .in('subject_id', subjectIds)
                .order('chapter_number', { ascending: true })

            if (error) throw error
            const formattedData = (data || []).map((item: any) => ({
                ...item,
                subjects: Array.isArray(item.subjects) ? item.subjects[0] : item.subjects
            }))
            setDocuments(formattedData)
        } catch (error: any) {
            console.error('Error loading documents:', error)
        }
    }

    /**
     * Filter documents to only show chapters matching:
     * - The grade_level of the selected class
     * - The subject(s) the teacher teaches for that class (from timetable)
     */
    function filterDocumentsForClass(classId: string) {
        const selectedClass = teacherClasses.find(c => c.class_id === classId)
        if (!selectedClass) {
            setFilteredDocuments([])
            return
        }

        // Get subject IDs the teacher teaches for this specific class
        const teacherSubjectIdsForClass = teacherAssignments
            .filter(a => a.class_id === classId)
            .map(a => a.subject_id)

        let filtered: SyllabusDocument[]

        if (teacherSubjectIdsForClass.length > 0) {
            // Teacher: filter by grade_level AND teacher's assigned subjects for this class
            filtered = documents.filter(doc =>
                doc.grade_level === selectedClass.grade_level &&
                teacherSubjectIdsForClass.includes(doc.subject_id)
            )
        } else {
            // Admin or no assignment data: filter by grade_level only
            filtered = documents.filter(doc =>
                doc.grade_level === selectedClass.grade_level
            )
        }

        // Sort by subject code, then chapter number
        filtered.sort((a, b) => {
            const subA = a.subjects?.code || ''
            const subB = b.subjects?.code || ''
            if (subA !== subB) return subA.localeCompare(subB)
            return (a.chapter_number || 0) - (b.chapter_number || 0)
        })

        setFilteredDocuments(filtered)
    }

    /**
     * Auto-detect periods per week from timetable_entries.
     * Count how many periods this teacher has for the selected class
     * (across all days of the week, for the subject they're about to plan).
     */
    async function autoDetectPeriodsPerWeek(classId: string) {
        if (!userId) return

        try {
            // Count all timetable entries for this teacher + class
            // (We count distinct day_of_week + slot_id combinations)
            const { data: entries, error } = await supabase
                .from('timetable_entries')
                .select('entry_id, day_of_week, slot_id, subject_id')
                .eq('teacher_id', userId)
                .eq('class_id', classId)

            if (error) {
                console.error('Error detecting periods:', error)
                setPeriodsPerWeek(5) // Default fallback
                setPeriodsAutoDetected(false)
                return
            }

            if (entries && entries.length > 0) {
                // For now, count total periods per week for this class
                // (teacher may teach multiple subjects to same class)
                setPeriodsPerWeek(entries.length)
                setPeriodsAutoDetected(true)
                console.log(`[LessonPlan] Auto-detected ${entries.length} periods/week from timetable`)
            } else {
                // No timetable data found — set reasonable default
                setPeriodsPerWeek(5)
                setPeriodsAutoDetected(false)
            }
        } catch (error) {
            console.error('Error detecting periods from timetable:', error)
            setPeriodsPerWeek(5)
            setPeriodsAutoDetected(false)
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
        if (!selectedDocId) missing.push('Syllabus Chapter')
        if (selectedTopicIds.length === 0) missing.push('Topics (select at least one)')
        if (!startDate) missing.push('Start Date')
        if (!endDate) missing.push('End Date')

        if (missing.length > 0) {
            alert('Missing required fields:\n• ' + missing.join('\n• '))
            return
        }

        setGenerating(true)
        try {
            const selectedTopics = topics.filter(t => selectedTopicIds.includes(t.topic_id))

            const payload = {
                topics: selectedTopics.map(t => ({
                    topic_id: t.topic_id,
                    topic_title: t.topic_title,
                    duration_minutes: t.estimated_duration_minutes || 45,
                    difficulty: t.difficulty_level || 'medium',
                    learning_objectives: []
                })),
                constraints: {
                    total_days: calculateDaysBetween(startDate, endDate),
                    periods_per_week: periodsPerWeek,
                    period_duration_minutes: 45,
                    holidays: holidays,
                    start_date: startDate
                }
            }

            const response = await fetch('/api/lesson-plan/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            })

            if (!response.ok) {
                const errData = await response.json().catch(() => null)
                throw new Error(errData?.error || `Generation failed (${response.status})`)
            }

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
            const { data: planData, error: planError } = await supabase
                .from('lesson_plans')
                .insert({
                    document_id: selectedDocId,
                    teacher_id: userId,
                    class_id: selectedClassId,
                    academic_year_id: selectedYearId,
                    start_date: startDate,
                    end_date: endDate,
                    total_periods: generatedPlan.schedule.length,
                    periods_per_week: periodsPerWeek,
                    ai_schedule: generatedPlan,
                    status: 'published'
                })
                .select()
                .single()

            if (planError) throw planError

            const validTopicIds = new Set(topics.map(t => t.topic_id))

            const dailyDetails = generatedPlan.schedule
                .filter((dayItem: any) => {
                    return dayItem.topic_id && validTopicIds.has(dayItem.topic_id)
                })
                .map((dayItem: any) => ({
                    plan_id: planData.plan_id,
                    topic_id: dayItem.topic_id,
                    lesson_date: addDays(startDate, dayItem.day - 1),
                    day_number: dayItem.day,
                    period_number: 1,
                    topic_content: {
                        title: dayItem.topic_title,
                        activities: dayItem.activities,
                        type: dayItem.type || 'teaching'
                    },
                    status: 'scheduled'
                }))

            if (dailyDetails.length > 0) {
                const { error: detailsError } = await supabase
                    .from('daily_lesson_details')
                    .insert(dailyDetails)

                if (detailsError) throw detailsError
            }

            alert(`Lesson Plan Saved! ${dailyDetails.length} teaching days + ${generatedPlan.schedule.length - dailyDetails.length} revision/assessment days scheduled.`)
            router.push('/dashboard/manage/lesson-plans')

        } catch (error: any) {
            console.error('Error saving plan:', error)
            alert('Failed to save plan: ' + (error.message || JSON.stringify(error)))
        } finally {
            setIsSaving(false)
        }
    }

    function addDays(date: string, days: number) {
        const result = new Date(date)
        result.setDate(result.getDate() + days)
        return result.toISOString().split('T')[0]
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50 flex items-center justify-center">
                <div className="text-center">
                    <Loader2 className="w-10 h-10 text-purple-600 animate-spin mx-auto mb-3" />
                    <p className="text-gray-600 font-medium">Loading your assignments...</p>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50 p-8">
            <div className="max-w-4xl mx-auto">
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => {
                                if (step === 2) setStep(1)
                                else goBack()
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
                        {/* 0. Context Selection */}
                        <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Class</label>
                                <select
                                    value={selectedClassId}
                                    onChange={(e) => setSelectedClassId(e.target.value)}
                                    className="w-full p-3 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-purple-500 text-gray-900"
                                >
                                    <option value="">-- Select Class --</option>
                                    {teacherClasses.map(c => (
                                        <option key={c.class_id} value={c.class_id}>
                                            {c.name} (Grade {c.grade_level})
                                        </option>
                                    ))}
                                </select>
                                {teacherClasses.length === 0 && (
                                    <p className="text-xs text-amber-600 mt-1">
                                        No classes assigned. Ask admin to set up your timetable.
                                    </p>
                                )}
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

                        {/* 1. Select Syllabus — filtered by class + teacher subject */}
                        {selectedClassId && (
                            <section>
                                <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                                    <BookOpen className="w-5 h-5 text-purple-600" />
                                    Select Syllabus
                                </h3>
                                {filteredDocuments.length > 0 ? (
                                    <select
                                        value={selectedDocId}
                                        onChange={(e) => setSelectedDocId(e.target.value)}
                                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition-all text-gray-900"
                                    >
                                        <option value="">-- Choose a Chapter --</option>
                                        {filteredDocuments.map(doc => (
                                            <option key={doc.document_id} value={doc.document_id}>
                                                {doc.subjects?.code} - {doc.chapter_title}
                                            </option>
                                        ))}
                                    </select>
                                ) : (
                                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
                                        No syllabus chapters found for your assigned subjects in this class. Please ask admin to upload the textbook first.
                                    </div>
                                )}
                            </section>
                        )}

                        {/* 2. Configure Topics */}
                        {topics.length > 0 && (
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
                                    {/* Periods per Week — auto-detected from timetable */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1.5">
                                            Periods per Week
                                            {periodsAutoDetected && (
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full font-medium">
                                                    <Clock className="w-3 h-3" />
                                                    Auto from timetable
                                                </span>
                                            )}
                                        </label>
                                        <input
                                            type="number"
                                            min="1" max="30"
                                            value={periodsPerWeek || ''}
                                            onChange={(e) => {
                                                const val = parseInt(e.target.value)
                                                setPeriodsPerWeek(isNaN(val) ? 0 : val)
                                                setPeriodsAutoDetected(false) // user overrode it
                                            }}
                                            className={`w-full p-2 border rounded-lg focus:ring-2 focus:ring-purple-500 outline-none text-gray-900 ${periodsAutoDetected
                                                ? 'bg-green-50 border-green-300'
                                                : 'bg-white border-gray-300'
                                                }`}
                                            readOnly={periodsAutoDetected}
                                        />
                                        {periodsAutoDetected && (
                                            <button
                                                type="button"
                                                onClick={() => setPeriodsAutoDetected(false)}
                                                className="text-xs text-purple-600 hover:text-purple-800 mt-1 underline"
                                            >
                                                Override manually
                                            </button>
                                        )}
                                        {!periodsAutoDetected && !selectedClassId && (
                                            <p className="text-xs text-gray-400 mt-1">Select a class to auto-detect from timetable</p>
                                        )}
                                        {!periodsAutoDetected && selectedClassId && periodsPerWeek > 0 && (
                                            <p className="text-xs text-amber-500 mt-1">No timetable data found — using default. You can adjust.</p>
                                        )}
                                    </div>
                                    {/* Holiday Configuration */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Holidays to Skip</label>
                                        <div className="flex gap-2 mb-2">
                                            <input
                                                type="date"
                                                value={newHoliday}
                                                onChange={(e) => setNewHoliday(e.target.value)}
                                                min={startDate || undefined}
                                                max={endDate || undefined}
                                                className="flex-1 p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none text-gray-900 bg-white text-sm"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    if (newHoliday && !holidays.includes(newHoliday)) {
                                                        setHolidays([...holidays, newHoliday].sort())
                                                        setNewHoliday('')
                                                    }
                                                }}
                                                disabled={!newHoliday}
                                                className="px-3 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                                            >
                                                Add
                                            </button>
                                        </div>
                                        {holidays.length > 0 ? (
                                            <div className="flex flex-wrap gap-1.5">
                                                {holidays.map(h => (
                                                    <span
                                                        key={h}
                                                        className="inline-flex items-center gap-1 px-2 py-1 bg-red-50 text-red-700 border border-red-200 rounded-md text-xs font-medium"
                                                    >
                                                        {new Date(h + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                                                        <button
                                                            onClick={() => setHolidays(holidays.filter(d => d !== h))}
                                                            className="text-red-400 hover:text-red-600 ml-0.5"
                                                        >
                                                            <X className="w-3 h-3" />
                                                        </button>
                                                    </span>
                                                ))}
                                            </div>
                                        ) : (
                                            <p className="text-xs text-gray-400">No holidays added. Sundays are skipped automatically.</p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </section>

                        {/* Action */}
                        <div className="flex justify-end pt-4">
                            <button
                                onClick={handleGenerate}
                                disabled={generating || !selectedDocId || !selectedClassId}
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
                                    onClick={() => setStep(1)}
                                    className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                                >
                                    Adjust Settings
                                </button>
                                <button
                                    onClick={handleSave}
                                    disabled={isSaving}
                                    className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold shadow-md disabled:opacity-50"
                                >
                                    {isSaving ? (
                                        <span className="flex items-center gap-2">
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            Saving...
                                        </span>
                                    ) : 'Save & Publish'}
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
