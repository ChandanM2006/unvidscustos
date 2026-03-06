/**
 * CUSTOS Brain: Daily Work API
 *
 * POST /api/brain/work/daily
 *   → Generates daily work (10 MCQs + 3-5 homework) using OpenAI
 *   → Supports multiple topics
 *
 * GET  /api/brain/work/daily?class_id=...&date=...
 *   → Returns daily work for a class on a date
 *
 * GET  /api/brain/work/daily?work_id=...&student_id=...
 *   → Returns daily work + student's response for the student view
 *
 * PUT  /api/brain/work/daily
 *   → Publish or update daily work (including question edits)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export const dynamic = 'force-dynamic'

// ─── GET: Fetch daily work ───────────────────────────────

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const workId = searchParams.get('work_id')
        const studentId = searchParams.get('student_id')
        const classId = searchParams.get('class_id')
        const date = searchParams.get('date')
        const subjectId = searchParams.get('subject_id')

        // Mode 1: Fetch specific work + student response
        if (workId && studentId) {
            const { data: work } = await supabase
                .from('brain_daily_work')
                .select('*')
                .eq('work_id', workId)
                .single()

            if (!work) {
                return NextResponse.json({ error: 'Daily work not found' }, { status: 404 })
            }

            const { data: response } = await supabase
                .from('brain_daily_responses')
                .select('*')
                .eq('work_id', workId)
                .eq('student_id', studentId)
                .single()

            // For student view: strip correct answers if not completed
            const isCompleted = response?.mcq_completed
            const mcqForStudent = isCompleted
                ? work.mcq_questions
                : (work.mcq_questions || []).map((q: any) => ({
                    ...q,
                    correct_answer: undefined,
                    explanation: undefined,
                }))

            return NextResponse.json({
                work: {
                    ...work,
                    mcq_questions: mcqForStudent,
                },
                response: response || null,
            })
        }

        // Mode 2: Fetch daily work for a class on a date
        if (classId && date) {
            let query = supabase
                .from('brain_daily_work')
                .select('*')
                .eq('class_id', classId)
                .eq('work_date', date)

            if (subjectId) {
                query = query.eq('subject_id', subjectId)
            }

            const { data: works } = await query.order('created_at', { ascending: false })

            // Get response stats for teacher view
            const workIds = (works || []).map(w => w.work_id)
            let responseStats: Record<string, { completed: number; total: number; avg_score: number }> = {}

            if (workIds.length > 0) {
                const { data: responses } = await supabase
                    .from('brain_daily_responses')
                    .select('work_id, mcq_completed, mcq_score, mcq_total')
                    .in('work_id', workIds)

                for (const r of (responses || [])) {
                    if (!responseStats[r.work_id]) {
                        responseStats[r.work_id] = { completed: 0, total: 0, avg_score: 0 }
                    }
                    responseStats[r.work_id].total++
                    if (r.mcq_completed) {
                        responseStats[r.work_id].completed++
                        responseStats[r.work_id].avg_score += (r.mcq_total > 0 ? (r.mcq_score / r.mcq_total) * 100 : 0)
                    }
                }

                // Calculate averages
                for (const wid of Object.keys(responseStats)) {
                    if (responseStats[wid].completed > 0) {
                        responseStats[wid].avg_score = Math.round(
                            responseStats[wid].avg_score / responseStats[wid].completed
                        )
                    }
                }
            }

            return NextResponse.json({
                works: works || [],
                responseStats,
            })
        }

        return NextResponse.json({ error: 'Provide work_id+student_id or class_id+date' }, { status: 400 })
    } catch (err: any) {
        console.error('[Brain Daily Work] GET error:', err)
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}

// ─── POST: Generate daily work ───────────────────────────

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const {
            plan_id,
            detail_id,
            class_id,
            section_id,
            subject_id,
            topic_ids,      // Array of topic IDs (multi-select)
            topic_id,       // Legacy single topic ID
            work_date,
            teacher_id,
        } = body

        if (!class_id || !subject_id || !work_date) {
            return NextResponse.json(
                { error: 'class_id, subject_id, and work_date are required' },
                { status: 400 }
            )
        }

        // Check if work already exists for this date
        const { data: existing } = await supabase
            .from('brain_daily_work')
            .select('work_id')
            .eq('class_id', class_id)
            .eq('subject_id', subject_id)
            .eq('work_date', work_date)
            .maybeSingle()

        if (existing) {
            // Delete existing to allow regeneration
            await supabase
                .from('brain_daily_work')
                .delete()
                .eq('work_id', existing.work_id)
        }

        // Resolve topics — support both multi and single
        const resolvedTopicIds: string[] = topic_ids || (topic_id ? [topic_id] : [])

        // Get topic content for AI question generation
        let topicData: any[] = []
        if (resolvedTopicIds.length > 0) {
            const { data: topics } = await supabase
                .from('lesson_topics')
                .select('topic_id, topic_title, content, learning_objectives, difficulty_level')
                .in('topic_id', resolvedTopicIds)
            topicData = topics || []
        }

        // Get subject name for context
        const { data: subject } = await supabase
            .from('subjects')
            .select('name')
            .eq('subject_id', subject_id)
            .single()

        // Get class info
        const { data: classInfo } = await supabase
            .from('classes')
            .select('name, grade_level')
            .eq('class_id', class_id)
            .single()

        const subjectName = subject?.name || 'Unknown Subject'
        const gradeLevel = classInfo?.grade_level || 9
        const topicTitles = topicData.map(t => t.topic_title).join(', ') || 'General'

        // ─── Generate Questions via OpenAI ───
        const { mcqQuestions, homeworkQuestions } = await generateQuestionsWithOpenAI(
            topicData,
            subjectName,
            gradeLevel,
            10,
            3
        )

        // Insert the daily work
        const { data: newWork, error: insertErr } = await supabase
            .from('brain_daily_work')
            .insert({
                plan_id: plan_id || null,
                detail_id: detail_id || null,
                class_id,
                section_id: section_id || null,
                subject_id,
                topic_id: resolvedTopicIds[0] || null, // Primary topic
                work_date,
                mcq_questions: mcqQuestions,
                mcq_count: mcqQuestions.length,
                homework_questions: homeworkQuestions,
                homework_count: homeworkQuestions.length,
                status: 'generated',
                created_by: teacher_id || null,
            })
            .select()
            .single()

        if (insertErr) {
            console.error('[Brain Daily Work] Insert error:', insertErr)
            return NextResponse.json({ error: insertErr.message }, { status: 500 })
        }

        return NextResponse.json({
            success: true,
            work: newWork,
            stats: {
                mcq_count: mcqQuestions.length,
                homework_count: homeworkQuestions.length,
                topics: topicTitles,
                subject: subjectName,
            },
        })
    } catch (err: any) {
        console.error('[Brain Daily Work] POST error:', err)
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}

// ─── PUT: Publish, update questions, or edit daily work ──

export async function PUT(request: NextRequest) {
    try {
        const body = await request.json()
        const { work_id, action, mcq_questions, homework_questions } = body

        if (!work_id) {
            return NextResponse.json({ error: 'work_id required' }, { status: 400 })
        }

        if (action === 'publish') {
            const { error } = await supabase
                .from('brain_daily_work')
                .update({ status: 'published', published_at: new Date().toISOString() })
                .eq('work_id', work_id)

            if (error) throw error

            // Create empty response rows for all students in the class
            const { data: work } = await supabase
                .from('brain_daily_work')
                .select('class_id, mcq_count')
                .eq('work_id', work_id)
                .single()

            if (work) {
                const { data: students } = await supabase
                    .from('users')
                    .select('user_id')
                    .eq('role', 'student')
                    .eq('class_id', work.class_id)

                if (students && students.length > 0) {
                    const responseRows = students.map(s => ({
                        work_id,
                        student_id: s.user_id,
                        mcq_total: work.mcq_count,
                    }))

                    await supabase
                        .from('brain_daily_responses')
                        .upsert(responseRows, { onConflict: 'work_id,student_id' })
                }
            }

            return NextResponse.json({ success: true, message: 'Daily work published' })
        }

        // Update questions (teacher edit before publishing)
        if (mcq_questions || homework_questions) {
            const updates: Record<string, any> = {}
            if (mcq_questions) {
                updates.mcq_questions = mcq_questions
                updates.mcq_count = mcq_questions.length
            }
            if (homework_questions) {
                updates.homework_questions = homework_questions
                updates.homework_count = homework_questions.length
            }

            const { error } = await supabase
                .from('brain_daily_work')
                .update(updates)
                .eq('work_id', work_id)
                .eq('status', 'generated') // Can only edit before publishing

            if (error) throw error
            return NextResponse.json({ success: true, message: 'Daily work updated' })
        }

        return NextResponse.json({ error: 'No valid action provided' }, { status: 400 })
    } catch (err: any) {
        console.error('[Brain Daily Work] PUT error:', err)
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}

// ─── OpenAI Question Generation ──────────────────────────

async function generateQuestionsWithOpenAI(
    topicData: any[],
    subjectName: string,
    gradeLevel: number,
    mcqCount: number,
    homeworkCount: number
): Promise<{ mcqQuestions: any[]; homeworkQuestions: any[] }> {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
        console.warn('[Brain Daily Work] No OPENAI_API_KEY, using fallback')
        return fallbackGeneration(topicData, subjectName, gradeLevel, mcqCount, homeworkCount)
    }

    // Build rich topic context
    const topicContext = topicData.map(t => {
        let ctx = `Topic: ${t.topic_title}`
        if (t.learning_objectives && t.learning_objectives.length > 0) {
            ctx += `\nLearning Objectives: ${t.learning_objectives.join(', ')}`
        }
        if (t.content) {
            // Extract text from JSONB content
            const contentStr = typeof t.content === 'string' ? t.content : JSON.stringify(t.content)
            // Limit to 2000 chars to avoid token overflow
            ctx += `\nContent: ${contentStr.substring(0, 2000)}`
        }
        if (t.difficulty_level) {
            ctx += `\nDifficulty: ${t.difficulty_level}`
        }
        return ctx
    }).join('\n\n---\n\n')

    const topicIds = topicData.map(t => t.topic_id)
    const topicTitles = topicData.map(t => t.topic_title).join(', ')

    const prompt = `You are an expert ${subjectName} teacher for Grade ${gradeLevel} students.

TOPICS COVERED TODAY:
${topicContext || `Subject: ${subjectName}, Grade: ${gradeLevel}`}

Generate daily practice work for students. Return ONLY valid JSON.

PART 1: Generate exactly ${mcqCount} Multiple Choice Questions (MCQs):
- Questions must be directly related to the topics listed above
- Mix of difficulties: 3 easy, 4 medium, 3 hard
- Mix of Bloom's taxonomy types: knowledge, comprehension, application, analysis, synthesis
- Each question must have exactly 4 options
- Questions should test real understanding, not just memorization
- Include a brief explanation for the correct answer

PART 2: Generate exactly ${homeworkCount} Homework Questions (theory/written):
- These are written in notebook — short answers, long answers, or critical thinking
- 1 easy (short answer), 1 medium (explain/describe), 1 hard (critical thinking/application)
- Include an expected answer guide for teacher reference

Return this exact JSON structure:
{
  "mcq_questions": [
    {
      "question_id": "mcq_1",
      "topic_id": "${topicIds[0] || 'general'}",
      "question_text": "The actual question text here?",
      "options": ["Option A text", "Option B text", "Option C text", "Option D text"],
      "correct_answer": "The exact text of the correct option",
      "difficulty": "easy|medium|hard",
      "type": "knowledge|comprehension|application|analysis|synthesis",
      "explanation": "Why this answer is correct",
      "format": "mcq"
    }
  ],
  "homework_questions": [
    {
      "question_id": "hw_1",
      "topic_id": "${topicIds[0] || 'general'}",
      "question_text": "The homework question text",
      "difficulty": "easy|medium|hard",
      "type": "comprehension|application|synthesis",
      "format": "short_answer|long_answer|critical_thinking",
      "expected_answer_guide": "Key points the answer should cover"
    }
  ]
}

IMPORTANT:
- Questions must be grade-appropriate for Grade ${gradeLevel}
- Use clear, simple language
- MCQ options should be plausible (no obviously wrong answers)
- Distribute topic_id across the available topics: ${topicIds.join(', ')}
- For topic_id, use the actual UUID from the list above
- question_id should be unique strings like "mcq_1", "mcq_2", "hw_1", "hw_2" etc.`

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
                    { role: 'system', content: `You are a professional ${subjectName} question paper setter for Grade ${gradeLevel}. Generate high-quality, curriculum-aligned questions. Always respond with valid JSON only.` },
                    { role: 'user', content: prompt }
                ],
                response_format: { type: 'json_object' },
                temperature: 0.7,
                max_tokens: 4096,
            }),
        })

        if (!response.ok) {
            const errText = await response.text()
            console.error('[Brain Daily Work] OpenAI API error:', response.status, errText)
            return fallbackGeneration(topicData, subjectName, gradeLevel, mcqCount, homeworkCount)
        }

        const data = await response.json()
        const content = data.choices?.[0]?.message?.content || ''

        let parsed: any
        try {
            parsed = JSON.parse(content)
        } catch {
            // Try to extract JSON from the response
            const jsonMatch = content.match(/\{[\s\S]*\}/)
            if (jsonMatch) {
                parsed = JSON.parse(jsonMatch[0])
            } else {
                console.error('[Brain Daily Work] Failed to parse OpenAI response')
                return fallbackGeneration(topicData, subjectName, gradeLevel, mcqCount, homeworkCount)
            }
        }

        // Assign proper UUIDs to question_ids
        const mcqs = (parsed.mcq_questions || []).map((q: any, i: number) => ({
            ...q,
            question_id: crypto.randomUUID(),
            topic_id: q.topic_id || topicIds[i % topicIds.length] || '',
            format: 'mcq',
        }))

        const homework = (parsed.homework_questions || []).map((q: any, i: number) => ({
            ...q,
            question_id: crypto.randomUUID(),
            topic_id: q.topic_id || topicIds[i % topicIds.length] || '',
        }))

        console.log(`[Brain Daily Work] OpenAI generated ${mcqs.length} MCQs + ${homework.length} homework`)
        return { mcqQuestions: mcqs, homeworkQuestions: homework }

    } catch (err) {
        console.error('[Brain Daily Work] OpenAI error:', err)
        return fallbackGeneration(topicData, subjectName, gradeLevel, mcqCount, homeworkCount)
    }
}

// ─── Fallback (no API key or API failure) ────────────────

function fallbackGeneration(
    topicData: any[],
    subjectName: string,
    gradeLevel: number,
    mcqCount: number,
    homeworkCount: number
): { mcqQuestions: any[]; homeworkQuestions: any[] } {
    const topicTitles = topicData.map(t => t.topic_title).join(', ') || subjectName
    const topicIds = topicData.map(t => t.topic_id)
    const difficulties: Array<'easy' | 'medium' | 'hard'> = ['easy', 'easy', 'medium', 'medium', 'medium', 'hard', 'hard', 'medium', 'easy', 'medium']
    const types: Array<'knowledge' | 'comprehension' | 'application' | 'analysis' | 'synthesis'> =
        ['knowledge', 'knowledge', 'comprehension', 'comprehension', 'application', 'application', 'analysis', 'analysis', 'synthesis', 'knowledge']

    const mcqQuestions = Array.from({ length: mcqCount }, (_, i) => ({
        question_id: crypto.randomUUID(),
        topic_id: topicIds[i % topicIds.length] || '',
        question_text: `[OpenAI unavailable] ${subjectName} - ${topicTitles} - Question ${i + 1} (Grade ${gradeLevel})`,
        options: ['Option A', 'Option B', 'Option C', 'Option D'],
        correct_answer: 'Option A',
        difficulty: difficulties[i % difficulties.length],
        type: types[i % types.length],
        explanation: 'AI generation temporarily unavailable',
        format: 'mcq',
    }))

    const hwFormats: Array<'short_answer' | 'long_answer' | 'critical_thinking'> = ['short_answer', 'long_answer', 'critical_thinking']
    const hwTypes: Array<'comprehension' | 'application' | 'synthesis'> = ['comprehension', 'application', 'synthesis']

    const homeworkQuestions = Array.from({ length: homeworkCount }, (_, i) => ({
        question_id: crypto.randomUUID(),
        topic_id: topicIds[i % topicIds.length] || '',
        question_text: `[OpenAI unavailable] ${subjectName} - ${topicTitles} - Homework ${i + 1} (Grade ${gradeLevel})`,
        difficulty: i === 0 ? 'easy' : i === 1 ? 'medium' : 'hard',
        type: hwTypes[i % hwTypes.length],
        format: hwFormats[i % hwFormats.length],
        expected_answer_guide: 'AI generation temporarily unavailable',
    }))

    return { mcqQuestions, homeworkQuestions }
}
