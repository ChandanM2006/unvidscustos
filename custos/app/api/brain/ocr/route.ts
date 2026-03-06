/**
 * CUSTOS Brain: OCR Grading API
 *
 * POST /api/brain/ocr
 *   → Receives a base64 image of a grading index sheet
 *   → Uses OpenAI Vision (gpt-4o-mini) to extract marks
 *   → Returns structured marks data
 */

import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { image_base64, question_count, questions } = body

        if (!image_base64) {
            return NextResponse.json({ error: 'image_base64 is required' }, { status: 400 })
        }

        const apiKey = process.env.OPENAI_API_KEY
        if (!apiKey) {
            console.error('[Brain OCR] No OPENAI_API_KEY configured')
            return NextResponse.json(
                { error: 'OpenAI API key not configured on the server.' },
                { status: 500 }
            )
        }

        // Build context about the questions so OCR knows what to expect
        let questionContext = ''
        if (questions && Array.isArray(questions)) {
            questionContext = questions.map((q: any, i: number) =>
                `Q${i + 1}: Max ${q.marks_possible || q.marks || '?'} marks`
            ).join(', ')
        }

        const prompt = `You are reading a scanned/photographed grading index sheet for a student's weekly test.

The sheet has these columns: Q# (question number), Topic, Difficulty, Type, Max Marks, Mark (teacher's checkmark ✓, half-mark ½, or cross ✗), and Obtained (handwritten marks in red/colored ink).

${questionContext ? `Expected questions: ${questionContext}` : `Expected ${question_count || 'unknown number of'} questions.`}

INSTRUCTIONS:
1. Read EVERY row carefully. Focus on the "Mark" column (✓/½/✗) and the "Obtained" column (handwritten number).
2. The "Obtained" column contains the actual marks awarded — these are usually handwritten numbers in red or colored ink.
3. If a checkmark (✓) appears in the Mark column, the student got full marks for that question.
4. If a cross (✗) appears, the student got 0 marks.
5. If a half mark (½ or partial mark) appears, read the obtained marks carefully.
6. If you cannot read a mark clearly, set marks_obtained to -1.

Return ONLY valid JSON in this exact format:
{
  "results": [
    {"q_no": 1, "marks_obtained": 2, "is_correct": "correct"},
    {"q_no": 2, "marks_obtained": 0, "is_correct": "wrong"},
    {"q_no": 3, "marks_obtained": 1, "is_correct": "partial"}
  ]
}

Rules for is_correct:
- "correct" = got full marks (checkmark ✓)
- "wrong" = got 0 marks (cross ✗)  
- "partial" = got some marks but not full (½ or partial answer)`

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: [{
                    role: 'user',
                    content: [
                        { type: 'text', text: prompt },
                        { type: 'image_url', image_url: { url: image_base64, detail: 'high' } }
                    ]
                }],
                response_format: { type: 'json_object' },
                max_tokens: 2000,
            }),
        })

        if (!response.ok) {
            const errText = await response.text()
            console.error('[Brain OCR] OpenAI API error:', response.status, errText)
            return NextResponse.json(
                { error: `OpenAI API error: ${response.status}` },
                { status: 502 }
            )
        }

        const data = await response.json()
        const content = data.choices?.[0]?.message?.content

        if (!content) {
            return NextResponse.json(
                { error: 'No content in OpenAI response' },
                { status: 502 }
            )
        }

        let parsed: any
        try {
            parsed = JSON.parse(content)
        } catch {
            // Try to extract JSON from the response
            const match = content.match(/\{[\s\S]*\}/)
            if (match) {
                parsed = JSON.parse(match[0])
            } else {
                console.error('[Brain OCR] Failed to parse response:', content)
                return NextResponse.json(
                    { error: 'Failed to parse OCR results' },
                    { status: 500 }
                )
            }
        }

        const ocrResults = parsed.results || parsed.marks || parsed
        if (!Array.isArray(ocrResults)) {
            return NextResponse.json(
                { error: 'OCR returned unexpected format' },
                { status: 500 }
            )
        }

        return NextResponse.json({
            success: true,
            results: ocrResults,
        })

    } catch (err: any) {
        console.error('[Brain OCR] Error:', err)
        return NextResponse.json(
            { error: err.message || 'OCR processing failed' },
            { status: 500 }
        )
    }
}
