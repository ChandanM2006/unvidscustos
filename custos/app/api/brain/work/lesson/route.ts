/**
 * CUSTOS Brain: Lesson-Wise Work API
 *
 * POST /api/brain/work/lesson  → Generate lesson/chapter test (deepest AI analysis)
 * GET  /api/brain/work/lesson  → Fetch lesson work
 * PUT  /api/brain/work/lesson  → Edit, publish, grade, complete
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

        if (workId) {
            const { data: work } = await supabase.from('brain_lesson_work').select('*').eq('work_id', workId).single()
            if (!work) return NextResponse.json({ error: 'Not found' }, { status: 404 })
            const { data: responses } = await supabase
                .from('brain_lesson_responses')
                .select('*, users!brain_lesson_responses_student_id_fkey(full_name, email)')
                .eq('work_id', workId).order('created_at')
            const { data: students } = await supabase.from('users').select('user_id, full_name').eq('role', 'student').eq('class_id', work.class_id)
            return NextResponse.json({ work, responses: responses || [], students: students || [] })
        }

        if (classId) {
            let query = supabase.from('brain_lesson_work').select('*').eq('class_id', classId)
            if (subjectId) query = query.eq('subject_id', subjectId)
            const { data } = await query.order('created_at', { ascending: false }).limit(20)
            return NextResponse.json({ works: data || [] })
        }

        return NextResponse.json({ error: 'Provide work_id or class_id' }, { status: 400 })
    } catch (err: any) {
        console.error('[Brain Lesson] GET error:', err)
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}

// ─── POST: Generate lesson test ──────────────────────────

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const {
            class_id, section_id, subject_id, document_id,
            teacher_id, total_marks = 60, question_count = 20,
        } = body

        if (!class_id || !subject_id || !document_id) {
            return NextResponse.json({ error: 'class_id, subject_id, document_id required' }, { status: 400 })
        }

        // Check existing
        const { data: existing } = await supabase
            .from('brain_lesson_work').select('work_id')
            .eq('class_id', class_id).eq('subject_id', subject_id).eq('document_id', document_id)
            .maybeSingle()
        if (existing) await supabase.from('brain_lesson_work').delete().eq('work_id', existing.work_id)

        // ─── Get chapter/document info ───
        const { data: doc } = await supabase
            .from('syllabus_documents')
            .select('document_id, chapter_title, chapter_number, content, grade_level')
            .eq('document_id', document_id).single()

        // ─── Get ALL topics for this chapter ───
        const { data: topics } = await supabase
            .from('lesson_topics')
            .select('topic_id, topic_title, content, difficulty_level, learning_objectives')
            .eq('document_id', document_id).order('topic_number')
        const topicData = topics || []
        const topicIds = topicData.map(t => t.topic_id)

        // ─── Collect ALL daily work data for these topics ───
        let dailyCount = 0, weeklyCount = 0
        let allDailyComplete = false, allWeeklyComplete = false
        const combinedAnalysis: any = { weak_topics: [], strong_topics: [], daily_count: 0, weekly_count: 0, avg_daily_score: 0, avg_weekly_score: 0, coverage_percent: 0 }

        // Daily work matching these topics
        const { data: dailyWorks } = await supabase
            .from('brain_daily_work')
            .select('work_id, topic_id, status')
            .eq('class_id', class_id).eq('subject_id', subject_id)
            .in('topic_id', topicIds.length > 0 ? topicIds : ['none'])
        dailyCount = (dailyWorks || []).length
        allDailyComplete = dailyCount > 0 && (dailyWorks || []).every(d => d.status === 'completed' || d.status === 'published')

        // Get daily response data for analysis
        const dailyWorkIds = (dailyWorks || []).map(d => d.work_id)
        const topicScores = new Map<string, { dailyTotal: number; dailyCorrect: number; dailyCount: number; weeklyTotal: number; weeklyCorrect: number; weeklyCount: number }>()

        if (dailyWorkIds.length > 0) {
            const { data: dailyResps } = await supabase
                .from('brain_daily_responses')
                .select('work_id, mcq_score, mcq_total, mcq_completed')
                .in('work_id', dailyWorkIds).eq('mcq_completed', true)

            for (const dw of (dailyWorks || [])) {
                if (!dw.topic_id) continue
                const entry = topicScores.get(dw.topic_id) || { dailyTotal: 0, dailyCorrect: 0, dailyCount: 0, weeklyTotal: 0, weeklyCorrect: 0, weeklyCount: 0 }
                const resps = (dailyResps || []).filter(r => r.work_id === dw.work_id)
                for (const r of resps) {
                    entry.dailyCorrect += (r.mcq_score || 0)
                    entry.dailyTotal += (r.mcq_total || 0)
                    entry.dailyCount++
                }
                topicScores.set(dw.topic_id, entry)
            }
        }

        // Weekly work data
        const { data: weeklyWorks } = await supabase
            .from('brain_weekly_work')
            .select('work_id, topics_covered, status')
            .eq('class_id', class_id).eq('subject_id', subject_id)
            .in('status', ['completed', 'corrected', 'in_progress', 'published'])
        weeklyCount = (weeklyWorks || []).length
        allWeeklyComplete = weeklyCount > 0 && (weeklyWorks || []).every(w => w.status === 'completed')

        if ((weeklyWorks || []).length > 0) {
            const weeklyWorkIds = weeklyWorks!.map(w => w.work_id)
            const { data: weeklyResps } = await supabase
                .from('brain_weekly_responses')
                .select('work_id, total_marks_obtained, total_marks_possible, percentage, question_marks, status')
                .in('work_id', weeklyWorkIds).eq('status', 'graded')

            for (const wr of (weeklyResps || [])) {
                const qMarks = (wr.question_marks || []) as any[]
                for (const qm of qMarks) {
                    if (!qm.topic_id || !topicIds.includes(qm.topic_id)) continue
                    const entry = topicScores.get(qm.topic_id) || { dailyTotal: 0, dailyCorrect: 0, dailyCount: 0, weeklyTotal: 0, weeklyCorrect: 0, weeklyCount: 0 }
                    entry.weeklyTotal++
                    if (qm.is_correct === true || qm.is_correct === 'correct') entry.weeklyCorrect++
                    else if (qm.is_correct === 'partial') entry.weeklyCorrect += 0.5
                    entry.weeklyCount++
                    topicScores.set(qm.topic_id, entry)
                }
            }
        }

        // Build combined analysis
        let totalDailyScore = 0, totalWeeklyScore = 0, dCount = 0, wCount = 0
        const topicsCoveredByData = new Set<string>()
        for (const [topicId, scores] of topicScores) {
            const topic = topicData.find(t => t.topic_id === topicId)
            const dailyPct = scores.dailyTotal > 0 ? Math.round((scores.dailyCorrect / scores.dailyTotal) * 100) : -1
            const weeklyPct = scores.weeklyTotal > 0 ? Math.round((scores.weeklyCorrect / scores.weeklyTotal) * 100) : -1
            const combined = dailyPct >= 0 && weeklyPct >= 0 ? Math.round((dailyPct * 0.4 + weeklyPct * 0.6)) : dailyPct >= 0 ? dailyPct : weeklyPct >= 0 ? weeklyPct : 50

            if (dailyPct >= 0) { totalDailyScore += dailyPct; dCount++ }
            if (weeklyPct >= 0) { totalWeeklyScore += weeklyPct; wCount++ }
            topicsCoveredByData.add(topicId)

            const entry = { topic_id: topicId, title: topic?.topic_title || 'Unknown', daily_avg: dailyPct, weekly_avg: weeklyPct, combined_avg: combined }
            if (combined < 60) combinedAnalysis.weak_topics.push(entry)
            else combinedAnalysis.strong_topics.push(entry)
        }

        // Add topics with no data as neutral
        for (const t of topicData) {
            if (!topicsCoveredByData.has(t.topic_id)) {
                combinedAnalysis.weak_topics.push({ topic_id: t.topic_id, title: t.topic_title, daily_avg: -1, weekly_avg: -1, combined_avg: 50 })
            }
        }

        combinedAnalysis.daily_count = dailyCount
        combinedAnalysis.weekly_count = weeklyCount
        combinedAnalysis.avg_daily_score = dCount > 0 ? Math.round(totalDailyScore / dCount) : 0
        combinedAnalysis.avg_weekly_score = wCount > 0 ? Math.round(totalWeeklyScore / wCount) : 0
        combinedAnalysis.coverage_percent = topicIds.length > 0 ? Math.round((topicsCoveredByData.size / topicIds.length) * 100) : 0

        // ─── Get subject + class info ───
        const { data: subject } = await supabase.from('subjects').select('name').eq('subject_id', subject_id).single()
        const { data: classInfo } = await supabase.from('classes').select('name, grade_level').eq('class_id', class_id).single()
        const subjectName = subject?.name || 'Unknown'
        const gradeLevel = doc?.grade_level || classInfo?.grade_level || 9

        // ─── Generate questions via OpenAI ───
        const questions = await generateLessonQuestionsWithOpenAI(
            topicData, combinedAnalysis, subjectName, gradeLevel,
            doc?.chapter_title || 'Chapter', question_count, total_marks
        )

        const gradingIndex = questions.map((q: any, i: number) => ({
            q_no: i + 1,
            topic_title: topicData.find(t => t.topic_id === q.topic_id)?.topic_title || 'General',
            difficulty: q.difficulty, bloom_type: q.bloom_type, marks: q.marks,
            correct_indicator: '☐ Correct  ☐ Partial  ☐ Wrong',
        }))
        const actualTotalMarks = questions.reduce((s: number, q: any) => s + (q.marks || 1), 0)

        const { data: newWork, error: insertErr } = await supabase.from('brain_lesson_work').insert({
            class_id, section_id: section_id || null, subject_id, document_id,
            chapter_title: doc?.chapter_title || null, chapter_number: doc?.chapter_number || null,
            topics_included: topicData.map(t => ({ topic_id: t.topic_id, topic_title: t.topic_title, difficulty_level: t.difficulty_level })),
            combined_analysis: combinedAnalysis,
            daily_work_count: dailyCount, weekly_work_count: weeklyCount,
            all_daily_complete: allDailyComplete, all_weekly_complete: allWeeklyComplete,
            questions, question_count: questions.length, total_marks: actualTotalMarks,
            grading_index: gradingIndex, status: 'generated', created_by: teacher_id || null,
        }).select().single()

        if (insertErr) { console.error('[Brain Lesson] Insert error:', insertErr); return NextResponse.json({ error: insertErr.message }, { status: 500 }) }

        return NextResponse.json({
            success: true, work: newWork,
            stats: { topics: topicData.length, daily_count: dailyCount, weekly_count: weeklyCount, questions: questions.length, total_marks: actualTotalMarks, coverage: combinedAnalysis.coverage_percent },
        })
    } catch (err: any) {
        console.error('[Brain Lesson] POST error:', err)
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}

// ─── PUT ─────────────────────────────────────────────────

export async function PUT(request: NextRequest) {
    try {
        const body = await request.json()
        const { work_id, action, questions, grading_data, teacher_id } = body
        if (!work_id) return NextResponse.json({ error: 'work_id required' }, { status: 400 })

        // Edit questions
        if (questions) {
            const totalMarks = questions.reduce((s: number, q: any) => s + (q.marks || 1), 0)
            const gradingIndex = questions.map((q: any, i: number) => ({ q_no: i + 1, topic_title: q.topic_title || 'General', difficulty: q.difficulty, bloom_type: q.bloom_type, marks: q.marks, correct_indicator: '☐ Correct  ☐ Partial  ☐ Wrong' }))
            await supabase.from('brain_lesson_work').update({ questions, question_count: questions.length, total_marks: totalMarks, grading_index: gradingIndex }).eq('work_id', work_id).in('status', ['generated'])
            return NextResponse.json({ success: true, message: 'Questions updated' })
        }

        // Publish
        if (action === 'publish') {
            const { data: work } = await supabase.from('brain_lesson_work').select('class_id, total_marks').eq('work_id', work_id).single()
            if (!work) throw new Error('Not found')
            await supabase.from('brain_lesson_work').update({ status: 'published', published_at: new Date().toISOString() }).eq('work_id', work_id)
            const { data: students } = await supabase.from('users').select('user_id').eq('role', 'student').eq('class_id', work.class_id)
            if (students?.length) {
                await supabase.from('brain_lesson_responses').upsert(
                    students.map(s => ({ work_id, student_id: s.user_id, total_marks_possible: work.total_marks, status: 'pending' })),
                    { onConflict: 'work_id,student_id' }
                )
            }
            return NextResponse.json({ success: true, message: 'Published' })
        }

        if (action === 'start_grading') {
            await supabase.from('brain_lesson_work').update({ status: 'in_progress' }).eq('work_id', work_id)
            return NextResponse.json({ success: true })
        }

        // Grade student
        if (action === 'grade_student' && grading_data) {
            const { student_id, question_marks, teacher_notes, grading_method = 'manual' } = grading_data
            if (!student_id || !question_marks) return NextResponse.json({ error: 'student_id and question_marks required' }, { status: 400 })
            const totalObtained = question_marks.reduce((s: number, q: any) => s + (q.marks_obtained || 0), 0)
            const totalPossible = question_marks.reduce((s: number, q: any) => s + (q.marks_possible || 0), 0)
            const percentage = totalPossible > 0 ? Math.round((totalObtained / totalPossible) * 100 * 100) / 100 : 0
            await supabase.from('brain_lesson_responses').update({
                question_marks, total_marks_obtained: totalObtained, total_marks_possible: totalPossible,
                percentage, grading_method, status: 'graded', graded_by: teacher_id || null, graded_at: new Date().toISOString(), teacher_notes: teacher_notes || null,
            }).eq('work_id', work_id).eq('student_id', student_id)
            return NextResponse.json({ success: true, student_id, total_obtained: totalObtained, total_possible: totalPossible, percentage })
        }

        // Complete — push to performance
        if (action === 'complete') {
            const { data: responses } = await supabase.from('brain_lesson_responses').select('*').eq('work_id', work_id).eq('status', 'graded')
            for (const resp of (responses || [])) {
                const topicResults = new Map<string, { correct: number; total: number }>()
                for (const qm of (resp.question_marks || []) as any[]) {
                    if (!qm.topic_id) continue
                    const e = topicResults.get(qm.topic_id) || { correct: 0, total: 0 }
                    e.total++
                    if (qm.is_correct === true || qm.is_correct === 'correct') e.correct++
                    else if (qm.is_correct === 'partial') e.correct += 0.5
                    topicResults.set(qm.topic_id, e)
                }
                for (const [topicId, r] of topicResults) {
                    const acc = (r.correct / r.total) * 100
                    const { data: ex } = await supabase.from('student_topic_performance').select('*').eq('student_id', resp.student_id).eq('topic_id', topicId).single()
                    if (ex) {
                        const nt = ex.total_attempts + r.total, nc = ex.correct_answers + r.correct
                        const na = (nc / nt) * 100, w = Math.max(0, Math.min(100, 100 - na))
                        await supabase.from('student_topic_performance').update({ total_attempts: nt, correct_answers: nc, accuracy_percentage: Math.round(na * 10) / 10, weakness_score: Math.round(w * 10) / 10, is_weak_topic: w >= 40, last_assessed_at: new Date().toISOString() }).eq('performance_id', ex.performance_id)
                    } else {
                        const w = Math.max(0, Math.min(100, 100 - acc))
                        await supabase.from('student_topic_performance').insert({ student_id: resp.student_id, topic_id: topicId, total_attempts: r.total, correct_answers: r.correct, accuracy_percentage: Math.round(acc * 10) / 10, weakness_score: Math.round(w * 10) / 10, is_weak_topic: w >= 40, last_assessed_at: new Date().toISOString() })
                    }
                }
                // Update student_scores — lesson test weighted most heavily
                const { data: sc } = await supabase.from('student_scores').select('*').eq('student_id', resp.student_id).single()
                if (sc) {
                    const np = (sc.performance_score * 0.5) + (resp.percentage * 0.5)
                    await supabase.from('student_scores').update({ performance_score: Math.round(np * 10) / 10, activity_score: (sc.activity_score || 0) + 25 }).eq('student_id', resp.student_id)
                }
            }
            await supabase.from('brain_lesson_work').update({ status: 'completed', corrected_at: new Date().toISOString() }).eq('work_id', work_id)
            return NextResponse.json({ success: true, message: 'Lesson test completed', students_updated: (responses || []).length })
        }

        return NextResponse.json({ error: 'No valid action' }, { status: 400 })
    } catch (err: any) {
        console.error('[Brain Lesson] PUT error:', err)
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}

// ─── OpenAI Generation ───────────────────────────────────

async function generateLessonQuestionsWithOpenAI(
    topicData: any[], analysis: any, subjectName: string, gradeLevel: number,
    chapterTitle: string, count: number, totalMarks: number
): Promise<any[]> {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) return fallbackLessonGen(topicData, subjectName, gradeLevel, count, totalMarks)

    const weakList = (analysis.weak_topics || []).map((t: any) => `${t.title} (combined avg: ${t.combined_avg}% — WEAK, daily: ${t.daily_avg >= 0 ? t.daily_avg + '%' : 'N/A'}, weekly: ${t.weekly_avg >= 0 ? t.weekly_avg + '%' : 'N/A'})`).join('\n')
    const strongList = (analysis.strong_topics || []).map((t: any) => `${t.title} (combined avg: ${t.combined_avg}%)`).join('\n')
    const topicCtx = topicData.map(t => {
        let c = `Topic: ${t.topic_title} (${t.difficulty_level || 'medium'})`
        if (t.learning_objectives?.length) c += `\nObjectives: ${t.learning_objectives.join(', ')}`
        if (t.content) { const s = typeof t.content === 'string' ? t.content : JSON.stringify(t.content); c += `\nContent: ${s.substring(0, 1200)}` }
        return c
    }).join('\n---\n')
    const topicIds = topicData.map(t => t.topic_id)

    const prompt = `You are an expert ${subjectName} exam paper setter for Grade ${gradeLevel}.

LESSON/CHAPTER SUMMATIVE TEST for: "${chapterTitle}"
This is the FINAL comprehensive test for this chapter. It covers ALL topics.
Total questions: ${count}, Total marks: ${totalMarks}

STUDENT PERFORMANCE DATA (combined from daily MCQs + weekly tests):
WEAK TOPICS (60% of questions):
${weakList || 'None — distribute evenly'}

STRONG TOPICS (40% of questions):
${strongList || 'None — distribute evenly'}

Data coverage: ${analysis.coverage_percent}%
Daily tests completed: ${analysis.daily_count}, avg: ${analysis.avg_daily_score}%
Weekly tests completed: ${analysis.weekly_count}, avg: ${analysis.avg_weekly_score}%

TOPIC DETAILS:
${topicCtx}

GENERATE A MIX OF:
- Fill in the blanks (1 mark each) — 3 questions
- True/False with reason (1 mark) — 2 questions
- Short Answer (2 marks) — 4 questions
- Long Answer (4 marks) — 3 questions
- Application/Problem Solving (5 marks) — 3 questions
- Critical Thinking / HOTS (5 marks) — 2 questions
- Diagram/Illustration based (3 marks) — if applicable

RULES:
1. ~60% from WEAK topics, ~40% from STRONG
2. Cover ALL topics in the chapter at least once
3. Marks must sum to ${totalMarks}
4. Grade-appropriate for Grade ${gradeLevel}
5. Include expected_answer + marking_rubric

Return ONLY valid JSON:
{
  "questions": [
    { "question_id": "lq_1", "topic_id": "uuid", "question_text": "...", "question_type": "fill_blank|true_false|short_answer|long_answer|application|critical_thinking|diagram", "marks": 2, "difficulty": "easy|medium|hard", "bloom_type": "knowledge|comprehension|application|analysis|synthesis|evaluation", "expected_answer": "...", "marking_rubric": "...", "is_from_weak_topic": true }
  ]
}

Available topic_ids: ${topicIds.join(', ')}`

    try {
        const res = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: [
                    { role: 'system', content: `Professional ${subjectName} chapter test setter for Grade ${gradeLevel}. Create comprehensive, curriculum-aligned questions. Respond with valid JSON only.` },
                    { role: 'user', content: prompt },
                ],
                response_format: { type: 'json_object' }, temperature: 0.7, max_tokens: 4096,
            }),
        })
        if (!res.ok) return fallbackLessonGen(topicData, subjectName, gradeLevel, count, totalMarks)
        const data = await res.json()
        const content = data.choices?.[0]?.message?.content || ''
        let parsed: any
        try { parsed = JSON.parse(content) } catch { const m = content.match(/\{[\s\S]*\}/); if (m) parsed = JSON.parse(m[0]); else return fallbackLessonGen(topicData, subjectName, gradeLevel, count, totalMarks) }
        return (parsed.questions || []).map((q: any, i: number) => ({ ...q, question_id: crypto.randomUUID(), topic_id: q.topic_id || topicIds[i % topicIds.length] || '' }))
    } catch { return fallbackLessonGen(topicData, subjectName, gradeLevel, count, totalMarks) }
}

function fallbackLessonGen(topicData: any[], subjectName: string, gradeLevel: number, count: number, totalMarks: number): any[] {
    const tids = topicData.map(t => t.topic_id)
    const mPerQ = Math.round(totalMarks / count)
    const types = ['fill_blank', 'true_false', 'short_answer', 'short_answer', 'long_answer', 'long_answer', 'application', 'application', 'critical_thinking', 'diagram']
    const diffs = ['easy', 'easy', 'medium', 'medium', 'medium', 'hard', 'hard', 'medium', 'hard', 'medium']
    const blooms = ['knowledge', 'knowledge', 'comprehension', 'application', 'analysis', 'synthesis', 'evaluation', 'application', 'synthesis', 'comprehension']
    return Array.from({ length: count }, (_, i) => ({
        question_id: crypto.randomUUID(), topic_id: tids[i % tids.length] || '', question_text: `[AI unavailable] ${subjectName} - Lesson Q${i + 1} (Grade ${gradeLevel})`,
        question_type: types[i % types.length], marks: mPerQ, difficulty: diffs[i % diffs.length], bloom_type: blooms[i % blooms.length],
        expected_answer: 'AI generation temporarily unavailable', marking_rubric: `${mPerQ} mark(s)`, is_from_weak_topic: i < Math.round(count * 0.6),
    }))
}
