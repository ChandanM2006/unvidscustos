/**
 * CUSTOS: AI Tutor Chatbot API (OpenAI GPT)
 *
 * POST /api/student/tutor
 *   Body: { message, session_id?, topic_id?, photo_data?, student_id }
 *   → Streams AI response via SSE
 *   → Auto-flags for teacher if 3+ doubts on same topic in 7 days
 *   → Saves all messages to chat_messages + student_doubts
 */

import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const {
            message,
            session_id,
            topic_id,
            photo_data,
            student_id,
        } = body

        if (!message && !photo_data) {
            return new Response(
                JSON.stringify({ error: 'message or photo_data is required' }),
                { status: 400, headers: { 'Content-Type': 'application/json' } }
            )
        }

        if (!student_id) {
            return new Response(
                JSON.stringify({ error: 'student_id is required' }),
                { status: 400, headers: { 'Content-Type': 'application/json' } }
            )
        }

        // ─── 1. Get or create session ────────────────────
        let sessionId = session_id
        if (!sessionId) {
            const { data: newSession, error: sessErr } = await supabase
                .from('chat_sessions')
                .insert({
                    student_id,
                    topic_id: topic_id || null,
                    title: (message || 'Photo question').substring(0, 100),
                })
                .select('session_id')
                .single()

            if (sessErr || !newSession) {
                console.error('[Tutor] Session create error:', sessErr)
                return new Response(
                    JSON.stringify({ error: 'Failed to create session' }),
                    { status: 500, headers: { 'Content-Type': 'application/json' } }
                )
            }
            sessionId = newSession.session_id
        }

        // ─── 2. Save user message ───────────────────────
        await supabase.from('chat_messages').insert({
            session_id: sessionId,
            role: 'user',
            content: message || '[Photo uploaded]',
            photo_url: photo_data ? '[pending_upload]' : null,
        })

        // ─── 3. Get context for better AI response ──────
        let topicName = ''
        let topicContext = ''

        if (topic_id) {
            const { data: topicData } = await supabase
                .from('lesson_topics')
                .select('topic_name')
                .eq('topic_id', topic_id)
                .single()

            topicName = topicData?.topic_name || ''

            const { data: perf } = await supabase
                .from('student_topic_performance')
                .select('accuracy_percentage, total_attempts')
                .eq('student_id', student_id)
                .eq('topic_id', topic_id)
                .single()

            if (perf) {
                topicContext = `Student's current accuracy on ${topicName}: ${perf.accuracy_percentage}%, with ${perf.total_attempts} attempts.`
            }
        }

        // ─── 4. Get recent chat history for context ─────
        const { data: recentMessages } = await supabase
            .from('chat_messages')
            .select('role, content')
            .eq('session_id', sessionId)
            .order('created_at', { ascending: true })
            .limit(10)

        const chatHistory = (recentMessages || []).slice(-8).map(m => ({
            role: m.role as 'user' | 'assistant',
            content: m.content,
        }))

        // ─── 5. Build the system prompt ─────────────────
        const systemPrompt = buildSystemPrompt(topicName, topicContext)

        // ─── 6. Build OpenAI messages array ─────────────
        const openaiMessages: Array<{ role: string; content: any }> = [
            { role: 'system', content: systemPrompt },
        ]

        // Add chat history (skip last since we'll add it fresh)
        for (const msg of chatHistory.slice(0, -1)) {
            if (msg.role === 'user' || msg.role === 'assistant') {
                openaiMessages.push({ role: msg.role, content: msg.content })
            }
        }

        // Add current message (with photo if applicable)
        if (photo_data) {
            openaiMessages.push({
                role: 'user',
                content: [
                    {
                        type: 'image_url',
                        image_url: {
                            url: `data:image/jpeg;base64,${photo_data}`,
                        },
                    },
                    {
                        type: 'text',
                        text: message || 'Please help me understand this problem. Explain step by step.',
                    },
                ],
            })
        } else {
            openaiMessages.push({ role: 'user', content: message })
        }

        // ─── 7. Call OpenAI API with streaming ──────────
        const apiKey = process.env.OPENAI_API_KEY

        if (!apiKey) {
            // Fallback: generate a helpful mock response
            const mockResponse = generateMockResponse(message, topicName)
            return await handleMockResponse(
                mockResponse, sessionId, student_id, topic_id, message, supabase
            )
        }

        const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: photo_data ? 'gpt-4o' : 'gpt-4o-mini',
                max_tokens: 500,
                messages: openaiMessages,
                stream: true,
            }),
        })

        if (!openaiResponse.ok) {
            const errorText = await openaiResponse.text()
            console.error('[Tutor] OpenAI API error:', errorText)

            // Fallback to mock
            const mockResponse = generateMockResponse(message, topicName)
            return await handleMockResponse(
                mockResponse, sessionId, student_id, topic_id, message, supabase
            )
        }

        // ─── 8. Stream response to client ───────────────
        let fullResponse = ''
        const encoder = new TextEncoder()

        const stream = new ReadableStream({
            async start(controller) {
                try {
                    const reader = openaiResponse.body!.getReader()
                    const decoder = new TextDecoder()
                    let buffer = ''

                    while (true) {
                        const { done, value } = await reader.read()
                        if (done) break

                        buffer += decoder.decode(value, { stream: true })
                        const lines = buffer.split('\n')
                        buffer = lines.pop() || ''

                        for (const line of lines) {
                            if (line.startsWith('data: ')) {
                                const jsonStr = line.slice(6).trim()
                                if (jsonStr === '[DONE]') continue

                                try {
                                    const event = JSON.parse(jsonStr)
                                    const delta = event.choices?.[0]?.delta?.content
                                    if (delta) {
                                        fullResponse += delta
                                        controller.enqueue(
                                            encoder.encode(`data: ${JSON.stringify({ text: delta, session_id: sessionId })}\n\n`)
                                        )
                                    }
                                } catch {
                                    // Skip malformed JSON
                                }
                            }
                        }
                    }

                    // Send done signal
                    controller.enqueue(
                        encoder.encode(`data: ${JSON.stringify({
                            done: true,
                            session_id: sessionId,
                            full_response: fullResponse,
                        })}\n\n`)
                    )

                    controller.close()

                    // Save AI response + check escalation
                    await saveAndCheck(
                        sessionId, fullResponse, student_id, topic_id, message, supabase
                    )
                } catch (err) {
                    console.error('[Tutor] Stream error:', err)
                    controller.close()
                }
            },
        })

        return new Response(stream, {
            headers: {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
            },
        })
    } catch (err: any) {
        console.error('[Tutor] Error:', err)
        return new Response(
            JSON.stringify({ error: err.message || 'Internal server error' }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        )
    }
}

// ─── Helpers ─────────────────────────────────────────────

function buildSystemPrompt(topicName: string, topicContext: string): string {
    return `You are a friendly, patient tutor for a school student.${topicName ? ` You are helping with: ${topicName}.` : ''
        }

${topicContext ? `Student Context: ${topicContext}` : ''}

Guidelines:
- Use simple, age-appropriate language suitable for a school student
- Break down complex concepts into clear, numbered steps
- Provide worked examples whenever possible
- Use analogies and real-world connections
- Encourage the student and build confidence
- If the question is unclear, ask a clarifying question
- Never give direct homework answers — guide the student to discover the answer
- Use bullet points and numbered lists for clarity
- If explaining math, show each step clearly
- If an image/photo is provided, analyze the problem in the photo and help solve it

Keep responses concise (under 200 words) but thorough. Use emojis sparingly for engagement.`
}

function generateMockResponse(question: string, topicName: string): string {
    const q = (question || '').toLowerCase()

    if (q.includes('fraction') || q.includes('denominator')) {
        return `Great question about fractions! 🎯

Here's how to add fractions with different denominators:

**Step 1:** Find the LCD (Least Common Denominator)
**Step 2:** Convert each fraction to have the LCD
**Step 3:** Add the numerators
**Step 4:** Simplify if possible

**Example:** 1/2 + 1/3
- LCD of 2 and 3 = 6
- 1/2 = 3/6
- 1/3 = 2/6
- 3/6 + 2/6 = **5/6** ✅

Would you like to try a practice problem? 😊`
    }

    if (q.includes('algebra') || q.includes('equation') || q.includes('variable')) {
        return `Let me help you with algebra! 📐

The key idea: **whatever you do to one side of the equation, do the same to the other side.**

**Example:** Solve 2x + 5 = 13
1. Subtract 5 from both sides: 2x = 8
2. Divide both sides by 2: x = 4
3. Check: 2(4) + 5 = 13 ✅

Think of the equation as a balanced scale — keep it balanced!

What specific equation are you working on?`
    }

    return `${topicName ? `Great question about **${topicName}**!` : 'Great question!'} 🧠

Let me break this down for you:

1. **Identify** what the question is asking
2. **Recall** the relevant formula or concept
3. **Apply** it step by step
4. **Verify** your answer

Could you share more details about the specific part you're stuck on? I'd love to help guide you through it! 😊`
}

async function handleMockResponse(
    response: string,
    sessionId: string,
    studentId: string,
    topicId: string | null,
    question: string,
    db: any
): Promise<Response> {
    const encoder = new TextEncoder()

    // Save and check
    await saveAndCheck(sessionId, response, studentId, topicId, question, db)

    // Stream the mock response word by word for realistic effect
    const words = response.split(' ')
    const stream = new ReadableStream({
        async start(controller) {
            for (let i = 0; i < words.length; i++) {
                const text = (i === 0 ? '' : ' ') + words[i]
                controller.enqueue(
                    encoder.encode(`data: ${JSON.stringify({ text, session_id: sessionId })}\n\n`)
                )
                await new Promise(r => setTimeout(r, 30))
            }

            controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({
                    done: true,
                    session_id: sessionId,
                    full_response: response,
                })}\n\n`)
            )
            controller.close()
        },
    })

    return new Response(stream, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
        },
    })
}

async function saveAndCheck(
    sessionId: string,
    aiResponse: string,
    studentId: string,
    topicId: string | null,
    question: string,
    db: any
) {
    // Save AI message to chat_messages
    await db.from('chat_messages').insert({
        session_id: sessionId,
        role: 'assistant',
        content: aiResponse,
    })

    // Save to student_doubts for teacher visibility
    await db.from('student_doubts').insert({
        student_id: studentId,
        topic_id: topicId || null,
        doubt_text: question || '[Photo uploaded]',
        ai_response: aiResponse,
        status: 'ai_answered',
    })

    // Check if needs teacher escalation (3+ doubts same topic in 7 days)
    if (topicId) {
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
        const { data: recentDoubts } = await db
            .from('student_doubts')
            .select('doubt_id')
            .eq('student_id', studentId)
            .eq('topic_id', topicId)
            .gte('created_at', sevenDaysAgo)

        if (recentDoubts && recentDoubts.length >= 3) {
            // Flag the latest doubt for teacher
            await db
                .from('student_doubts')
                .update({ flagged_for_teacher: true, status: 'escalated' })
                .eq('student_id', studentId)
                .eq('topic_id', topicId)
                .order('created_at', { ascending: false })
                .limit(1)

            // Create notification for teachers
            const { data: student } = await db
                .from('users')
                .select('full_name, section_id')
                .eq('user_id', studentId)
                .single()

            if (student) {
                const { data: teachers } = await db
                    .from('users')
                    .select('user_id')
                    .eq('role', 'teacher')

                const topicData = await db
                    .from('lesson_topics')
                    .select('topic_name')
                    .eq('topic_id', topicId)
                    .single()

                for (const teacher of teachers || []) {
                    await db.from('notifications').insert({
                        user_id: teacher.user_id,
                        title: '⚠️ Student Needs Help',
                        message: `${student.full_name} has asked ${recentDoubts.length} questions about ${topicData?.data?.topic_name || 'a topic'} this week`,
                        type: 'alert',
                        action_url: `/dashboard/teacher/students/${studentId}`,
                    })
                }
            }
        }
    }
}
