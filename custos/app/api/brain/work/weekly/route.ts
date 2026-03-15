/**
 * CUSTOS Brain: Weekly Work API
 *
 * POST /api/brain/work/weekly
 *   → Generates weekly test paper using OpenAI
 *   → Analyzes class-wide daily data for 60/40 topic split
 *
 * GET  /api/brain/work/weekly?class_id=...&subject_id=...&week_start=...
 *   → Returns weekly work for a class/subject/week
 *
 * GET  /api/brain/work/weekly?work_id=...
 *   → Returns specific weekly work with responses
 *
 * PUT  /api/brain/work/weekly
 *   → Update questions (edit), publish, start grading, or complete
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export const dynamic = 'force-dynamic'

// ─── GET ─────────────────────────────────────────────────

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const workId = searchParams.get('work_id')
        const classId = searchParams.get('class_id')
        const subjectId = searchParams.get('subject_id')
        const weekStart = searchParams.get('week_start')

        // Mode 1: Get specific work with all responses
        if (workId) {
            const { data: work } = await supabase
                .from('brain_weekly_work')
                .select('*')
                .eq('work_id', workId)
                .single()

            if (!work) {
                return NextResponse.json({ error: 'Weekly work not found' }, { status: 404 })
            }

            // Get all student responses
            const { data: responses } = await supabase
                .from('brain_weekly_responses')
                .select('*, users!brain_weekly_responses_student_id_fkey(full_name, email)')
                .eq('work_id', workId)
                .order('created_at')

            // Get class students for status overview
            const { data: students } = await supabase
                .from('users')
                .select('user_id, full_name')
                .eq('role', 'student')
                .eq('class_id', work.class_id)

            return NextResponse.json({
                work,
                responses: responses || [],
                students: students || [],
            })
        }

        // Mode 2: List weekly works for a class
        if (classId) {
            let query = supabase
                .from('brain_weekly_work')
                .select('*')
                .eq('class_id', classId)

            if (subjectId) query = query.eq('subject_id', subjectId)
            if (weekStart) query = query.eq('week_start', weekStart)

            const { data: works } = await query.order('week_start', { ascending: false }).limit(20)

            return NextResponse.json({ works: works || [] })
        }

        return NextResponse.json({ error: 'Provide work_id or class_id' }, { status: 400 })
    } catch (err: any) {
        console.error('[Brain Weekly Work] GET error:', err)
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}

// ─── POST: Generate weekly test ──────────────────────────

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const {
            class_id,
            section_id,
            subject_id,
            topic_ids, // array of topic UUIDs that have completed daily work
            work_label, // custom title
            teacher_id,
            total_marks = 40,
            question_count = 15,
        } = body

        if (!class_id || !subject_id || !topic_ids || topic_ids.length === 0) {
            return NextResponse.json(
                { error: 'class_id, subject_id, and topic_ids are required' },
                { status: 400 }
            )
        }



        // ─── Step 1: Collect daily work data ONLY for the selected topics ───
        const { data: dailyWorks } = await supabase
            .from('brain_daily_work')
            .select('work_id, topic_id, mcq_questions, subject_id')
            .eq('class_id', class_id)
            .eq('subject_id', subject_id)
            .in('topic_id', topic_ids)
            .in('status', ['published', 'completed'])

        // Ensure we load the topic data for the selected topics
        let topicData: any[] = []
        if (topic_ids.length > 0) {
            const { data } = await supabase
                .from('lesson_topics')
                .select('topic_id, topic_title, difficulty_level, learning_objectives, content')
                .in('topic_id', topic_ids)
            topicData = data || []
        }

        // ─── Step 2: Analyze class-wide performance (from daily responses) ───
        const workIds = (dailyWorks || []).map(d => d.work_id)
        let classAnalysis: any = { weak_topics: [], strong_topics: [] }
        let topicsCovered: any[] = []

        if (workIds.length > 0) {
            const { data: responses } = await supabase
                .from('brain_daily_responses')
                .select('work_id, mcq_score, mcq_total, mcq_completed')
                .in('work_id', workIds)
                .eq('mcq_completed', true)

            // Aggregate scores per topic
            const topicScores = new Map<string, { totalScore: number; totalPossible: number; count: number }>()

            for (const dw of (dailyWorks || [])) {
                if (!dw.topic_id) continue

                const workResponses = (responses || []).filter(r => r.work_id === dw.work_id)
                const topicEntry = topicScores.get(dw.topic_id) || { totalScore: 0, totalPossible: 0, count: 0 }

                for (const r of workResponses) {
                    topicEntry.totalScore += (r.mcq_score || 0)
                    topicEntry.totalPossible += (r.mcq_total || 0)
                    topicEntry.count++
                }
                topicScores.set(dw.topic_id, topicEntry)
            }

            // Classify weak vs strong
            for (const [topicId, scores] of topicScores) {
                const avgScore = scores.totalPossible > 0
                    ? Math.round((scores.totalScore / scores.totalPossible) * 100)
                    : 50
                const topic = topicData.find(t => t.topic_id === topicId)
                const entry = {
                    topic_id: topicId,
                    title: topic?.topic_title || 'Unknown',
                    avg_score: avgScore,
                    student_count: scores.count,
                }

                if (avgScore < 60) {
                    classAnalysis.weak_topics.push(entry)
                } else {
                    classAnalysis.strong_topics.push(entry)
                }

                topicsCovered.push({
                    topic_id: topicId,
                    topic_title: topic?.topic_title || 'Unknown',
                    daily_avg_score: avgScore,
                    is_weak: avgScore < 60,
                })
            }
        }

        // Even if no daily data, include topics from the syllabus
        if (topicsCovered.length === 0 && topicData.length > 0) {
            topicsCovered = topicData.map(t => ({
                topic_id: t.topic_id,
                topic_title: t.topic_title,
                daily_avg_score: 50,
                is_weak: false,
            }))
        }

        // ─── Step 3: Get subject + class info ───
        const { data: subject } = await supabase
            .from('subjects').select('name').eq('subject_id', subject_id).single()
        const { data: classInfo } = await supabase
            .from('classes').select('name, grade_level').eq('class_id', class_id).single()

        const subjectName = subject?.name || 'Unknown'
        const gradeLevel = classInfo?.grade_level || 9

        // Label for the generated work
        const today = new Date().toISOString()
        const finalLabel = work_label || `Weekly Test (${new Date().toLocaleDateString()})`

        // ─── Step 4: Generate questions via OpenAI ───
        const questions = await generateWeeklyQuestionsWithOpenAI(
            topicData,
            classAnalysis,
            subjectName,
            gradeLevel,
            question_count,
            total_marks
        )

        // Build grading index
        const gradingIndex = questions.map((q: any, i: number) => ({
            q_no: i + 1,
            topic_title: topicData.find((t: any) => t.topic_id === q.topic_id)?.topic_title || 'General',
            difficulty: q.difficulty,
            bloom_type: q.bloom_type,
            marks: q.marks,
            correct_indicator: '☐ Correct  ☐ Partial  ☐ Wrong',
        }))

        const actualTotalMarks = questions.reduce((sum: number, q: any) => sum + (q.marks || 1), 0)

        // ─── Step 5: Insert ──
        const { data: newWork, error: insertErr } = await supabase
            .from('brain_weekly_work')
            .insert({
                class_id,
                section_id: section_id || null,
                subject_id,
                week_start: today.split('T')[0], // Give it a valid date but this acts merely as creation date
                week_end: today.split('T')[0],
                week_label: finalLabel,
                topics_covered: topicsCovered,
                class_analysis: classAnalysis,
                questions,
                question_count: questions.length,
                total_marks: actualTotalMarks,
                grading_index: gradingIndex,
                status: 'generated',
                created_by: teacher_id || null,
            })
            .select()
            .single()

        if (insertErr) {
            console.error('[Brain Weekly] Insert error:', insertErr)
            return NextResponse.json({ error: insertErr.message }, { status: 500 })
        }

        return NextResponse.json({
            success: true,
            work: newWork,
            stats: {
                topics_analyzed: topicsCovered.length,
                weak_topics: classAnalysis.weak_topics.length,
                strong_topics: classAnalysis.strong_topics.length,
                questions_generated: questions.length,
                total_marks: actualTotalMarks,
            },
        })
    } catch (err: any) {
        console.error('[Brain Weekly] POST error:', err)
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}

// ─── PUT: Update, publish, grade ─────────────────────────

export async function PUT(request: NextRequest) {
    try {
        const body = await request.json()
        const { work_id, action, questions, grading_data, teacher_id } = body

        if (!work_id) {
            return NextResponse.json({ error: 'work_id required' }, { status: 400 })
        }

        // Action: edit questions
        if (questions) {
            const totalMarks = questions.reduce((s: number, q: any) => s + (q.marks || 1), 0)
            const gradingIndex = questions.map((q: any, i: number) => ({
                q_no: i + 1,
                topic_title: q.topic_title || 'General',
                difficulty: q.difficulty,
                bloom_type: q.bloom_type,
                marks: q.marks,
                correct_indicator: '☐ Correct  ☐ Partial  ☐ Wrong',
            }))

            const { error } = await supabase
                .from('brain_weekly_work')
                .update({
                    questions,
                    question_count: questions.length,
                    total_marks: totalMarks,
                    grading_index: gradingIndex,
                })
                .eq('work_id', work_id)
                .in('status', ['generated'])

            if (error) throw error
            return NextResponse.json({ success: true, message: 'Questions updated' })
        }

        // Action: publish
        if (action === 'publish') {
            const { data: work } = await supabase
                .from('brain_weekly_work')
                .select('class_id, question_count, total_marks')
                .eq('work_id', work_id)
                .single()

            if (!work) throw new Error('Work not found')

            await supabase
                .from('brain_weekly_work')
                .update({ status: 'published', published_at: new Date().toISOString() })
                .eq('work_id', work_id)

            // Create empty response rows for all students
            const { data: students } = await supabase
                .from('users')
                .select('user_id')
                .eq('role', 'student')
                .eq('class_id', work.class_id)

            if (students && students.length > 0) {
                const rows = students.map(s => ({
                    work_id,
                    student_id: s.user_id,
                    total_marks_possible: work.total_marks,
                    status: 'pending',
                }))
                await supabase
                    .from('brain_weekly_responses')
                    .upsert(rows, { onConflict: 'work_id,student_id' })
            }

            return NextResponse.json({ success: true, message: 'Published & student rows created' })
        }

        // Action: start grading
        if (action === 'start_grading') {
            await supabase
                .from('brain_weekly_work')
                .update({ status: 'in_progress' })
                .eq('work_id', work_id)
            return NextResponse.json({ success: true })
        }

        // Action: submit grades for a student
        if (action === 'grade_student' && grading_data) {
            const {
                student_id,
                question_marks,
                teacher_notes,
                grading_method = 'manual',
            } = grading_data

            if (!student_id || !question_marks) {
                return NextResponse.json({ error: 'student_id and question_marks required' }, { status: 400 })
            }

            const totalObtained = question_marks.reduce(
                (s: number, q: any) => s + (q.marks_obtained || 0), 0
            )
            const totalPossible = question_marks.reduce(
                (s: number, q: any) => s + (q.marks_possible || 0), 0
            )
            const percentage = totalPossible > 0
                ? Math.round((totalObtained / totalPossible) * 100 * 100) / 100
                : 0

            const { error } = await supabase
                .from('brain_weekly_responses')
                .update({
                    question_marks,
                    total_marks_obtained: totalObtained,
                    total_marks_possible: totalPossible,
                    percentage,
                    grading_method,
                    status: 'graded',
                    graded_by: teacher_id || null,
                    graded_at: new Date().toISOString(),
                    teacher_notes: teacher_notes || null,
                })
                .eq('work_id', work_id)
                .eq('student_id', student_id)

            if (error) throw error
            return NextResponse.json({
                success: true,
                student_id,
                total_obtained: totalObtained,
                total_possible: totalPossible,
                percentage,
            })
        }

        // Action: complete (finalize all grades and push to performance)
        if (action === 'complete') {
            const { data: work } = await supabase
                .from('brain_weekly_work')
                .select('*')
                .eq('work_id', work_id)
                .single()

            if (!work) throw new Error('Work not found')

            const { data: responses } = await supabase
                .from('brain_weekly_responses')
                .select('*')
                .eq('work_id', work_id)
                .eq('status', 'graded')

            // Push results to student_topic_performance
            for (const resp of (responses || [])) {
                const qMarks = (resp.question_marks || []) as any[]

                // Group by topic
                const topicResults = new Map<string, { correct: number; total: number }>()
                for (const qm of qMarks) {
                    if (!qm.topic_id) continue
                    const entry = topicResults.get(qm.topic_id) || { correct: 0, total: 0 }
                    entry.total++
                    if (qm.is_correct === true || qm.is_correct === 'correct') entry.correct++
                    else if (qm.is_correct === 'partial') entry.correct += 0.5
                    topicResults.set(qm.topic_id, entry)
                }

                // Update performance
                for (const [topicId, results] of topicResults) {
                    const accuracy = (results.correct / results.total) * 100

                    const { data: existing } = await supabase
                        .from('student_topic_performance')
                        .select('*')
                        .eq('student_id', resp.student_id)
                        .eq('topic_id', topicId)
                        .single()

                    if (existing) {
                        const newTotal = existing.total_attempts + results.total
                        const newCorrect = existing.correct_answers + results.correct
                        const newAccuracy = (newCorrect / newTotal) * 100
                        const weakness = Math.max(0, Math.min(100, 100 - newAccuracy))

                        await supabase
                            .from('student_topic_performance')
                            .update({
                                total_attempts: newTotal,
                                correct_answers: newCorrect,
                                accuracy_percentage: Math.round(newAccuracy * 10) / 10,
                                weakness_score: Math.round(weakness * 10) / 10,
                                is_weak_topic: weakness >= 40,
                                last_assessed_at: new Date().toISOString(),
                            })
                            .eq('performance_id', existing.performance_id)
                    } else {
                        const weakness = Math.max(0, Math.min(100, 100 - accuracy))
                        await supabase
                            .from('student_topic_performance')
                            .insert({
                                student_id: resp.student_id,
                                topic_id: topicId,
                                total_attempts: results.total,
                                correct_answers: results.correct,
                                accuracy_percentage: Math.round(accuracy * 10) / 10,
                                weakness_score: Math.round(weakness * 10) / 10,
                                is_weak_topic: weakness >= 40,
                                last_assessed_at: new Date().toISOString(),
                            })
                    }
                }

                // Update student_scores
                const { data: scoreRow } = await supabase
                    .from('student_scores')
                    .select('*')
                    .eq('student_id', resp.student_id)
                    .single()

                if (scoreRow) {
                    const newPerf = (scoreRow.performance_score * 0.6) + (resp.percentage * 0.4)
                    const newActivity = (scoreRow.activity_score || 0) + 15
                    await supabase
                        .from('student_scores')
                        .update({
                            performance_score: Math.round(newPerf * 10) / 10,
                            activity_score: newActivity,
                        })
                        .eq('student_id', resp.student_id)
                }
            }

            await supabase
                .from('brain_weekly_work')
                .update({ status: 'completed', corrected_at: new Date().toISOString() })
                .eq('work_id', work_id)

            return NextResponse.json({
                success: true,
                message: 'Weekly test completed',
                students_updated: (responses || []).length,
            })
        }

        return NextResponse.json({ error: 'No valid action' }, { status: 400 })
    } catch (err: any) {
        console.error('[Brain Weekly] PUT error:', err)
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}

// ─── OpenAI Question Generation ──────────────────────────

async function generateWeeklyQuestionsWithOpenAI(
    topicData: any[],
    classAnalysis: any,
    subjectName: string,
    gradeLevel: number,
    questionCount: number,
    totalMarks: number
): Promise<any[]> {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
        console.warn('[Brain Weekly] No OPENAI_API_KEY, using fallback')
        return fallbackWeeklyGeneration(topicData, subjectName, gradeLevel, questionCount, totalMarks)
    }

    const weakTopics = (classAnalysis.weak_topics || []).map((t: any) =>
        `${t.title} (class avg: ${t.avg_score}% — WEAK)`
    ).join('\n')

    const strongTopics = (classAnalysis.strong_topics || []).map((t: any) =>
        `${t.title} (class avg: ${t.avg_score}%)`
    ).join('\n')

    const topicContext = topicData.map(t => {
        let ctx = `Topic: ${t.topic_title} (${t.difficulty_level || 'medium'})`
        if (t.learning_objectives?.length > 0) {
            ctx += `\nObjectives: ${t.learning_objectives.join(', ')}`
        }
        if (t.content) {
            const str = typeof t.content === 'string' ? t.content : JSON.stringify(t.content)
            ctx += `\nContent: ${str.substring(0, 1500)}`
        }
        return ctx
    }).join('\n---\n')

    const topicIds = topicData.map(t => t.topic_id)

    // Calculate mark distribution
    const weakQuestionCount = Math.round(questionCount * 0.6)
    const strongQuestionCount = questionCount - weakQuestionCount

    const prompt = `You are an expert ${subjectName} exam paper setter for Grade ${gradeLevel}.

WEEKLY TEST CONTEXT:
This is a formal written weekly test based on topics covered this week.
Total questions: ${questionCount}
Total marks: ${totalMarks}

CLASS-WIDE PERFORMANCE ANALYSIS:
WEAK TOPICS (60% of questions should come from these):
${weakTopics || 'None identified — distribute evenly'}

STRONG TOPICS (40% of questions):
${strongTopics || 'None identified — distribute evenly'}

TOPIC DETAILS:
${topicContext}

QUESTION FORMAT REQUIREMENTS:
Generate a mix of question types for a written exam (NOT MCQ):
- Short Answer (1-2 marks): Define terms, state properties, give examples
- Long Answer (3-4 marks): Explain concepts, solve problems with steps, compare/contrast
- Critical Thinking / Application (5 marks): Real-world application, analyze scenarios, prove theorems

DIFFICULTY MIX:
- 30% Easy (knowledge/recall)
- 40% Medium (comprehension/application)  
- 30% Hard (analysis/synthesis/evaluation)

IMPORTANT RULES:
1. ~60% of questions from WEAK topics (where class scored <60%)
2. ~40% from STRONG topics
3. Total marks must sum to ${totalMarks}
4. Questions must be grade-appropriate for Grade ${gradeLevel}
5. Include clear marking rubric / expected answer for each question
6. Use Bloom's taxonomy types in the bloom_type field

Return ONLY valid JSON:
{
  "questions": [
    {
      "question_id": "wq_1",
      "topic_id": "uuid-here",
      "question_text": "Full question text with any sub-parts",
      "question_type": "short_answer|long_answer|critical_thinking|numerical|diagram",
      "marks": 2,
      "difficulty": "easy|medium|hard",
      "bloom_type": "knowledge|comprehension|application|analysis|synthesis|evaluation",
      "expected_answer": "Key points / model answer",
      "marking_rubric": "How to award marks: 1 mark for X, 1 mark for Y",
      "is_from_weak_topic": true
    }
  ]
}

Available topic_ids: ${topicIds.join(', ')}`

    try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: [
                    {
                        role: 'system',
                        content: `You are a professional ${subjectName} examination paper setter for Grade ${gradeLevel}. Create high-quality, curriculum-aligned written test questions. Always respond with valid JSON only.`,
                    },
                    { role: 'user', content: prompt },
                ],
                response_format: { type: 'json_object' },
                temperature: 0.7,
                max_tokens: 4096,
            }),
        })

        if (!response.ok) {
            const errText = await response.text()
            console.error('[Brain Weekly] OpenAI error:', response.status, errText)
            return fallbackWeeklyGeneration(topicData, subjectName, gradeLevel, questionCount, totalMarks)
        }

        const data = await response.json()
        const content = data.choices?.[0]?.message?.content || ''
        let parsed: any

        try {
            parsed = JSON.parse(content)
        } catch {
            const match = content.match(/\{[\s\S]*\}/)
            if (match) parsed = JSON.parse(match[0])
            else return fallbackWeeklyGeneration(topicData, subjectName, gradeLevel, questionCount, totalMarks)
        }

        return (parsed.questions || []).map((q: any, i: number) => ({
            ...q,
            question_id: crypto.randomUUID(),
            topic_id: q.topic_id || topicIds[i % topicIds.length] || '',
        }))
    } catch (err) {
        console.error('[Brain Weekly] OpenAI error:', err)
        return fallbackWeeklyGeneration(topicData, subjectName, gradeLevel, questionCount, totalMarks)
    }
}

function fallbackWeeklyGeneration(
    topicData: any[],
    subjectName: string,
    gradeLevel: number,
    count: number,
    totalMarks: number
): any[] {
    const topicIds = topicData.map(t => t.topic_id)
    const marksPerQ = Math.round(totalMarks / count)
    const types = ['short_answer', 'short_answer', 'long_answer', 'long_answer', 'critical_thinking']
    const difficulties = ['easy', 'easy', 'medium', 'medium', 'hard']
    const blooms = ['knowledge', 'comprehension', 'application', 'analysis', 'synthesis']

    return Array.from({ length: count }, (_, i) => ({
        question_id: crypto.randomUUID(),
        topic_id: topicIds[i % topicIds.length] || '',
        question_text: `[OpenAI unavailable] ${subjectName} - Weekly Q${i + 1} (Grade ${gradeLevel})`,
        question_type: types[i % types.length],
        marks: marksPerQ,
        difficulty: difficulties[i % difficulties.length],
        bloom_type: blooms[i % blooms.length],
        expected_answer: 'AI generation temporarily unavailable',
        marking_rubric: `${marksPerQ} mark(s) for correct answer`,
        is_from_weak_topic: i < Math.round(count * 0.6),
    }))
}

// ─── Helpers ─────────────────────────────────────────────

function formatDate(dateStr: string): string {
    const d = new Date(dateStr)
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    return `${months[d.getMonth()]} ${d.getDate()}`
}
