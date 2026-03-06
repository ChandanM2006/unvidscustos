/**
 * CUSTOS API: AI Textbook Extraction
 * 
 * POST /api/syllabus/extract-textbook
 * 
 * Accepts a file upload (PDF/DOCX/PPTX/Image), extracts raw text,
 * then uses OpenAI to identify chapters, topics, key points, formulas, etc.
 * 
 * Extraction strategy (in order):
 *   1. OpenAI GPT-4o vision (sends each PDF page as image — works with scanned PDFs too)
 *   2. pdf-parse (for selectable-text PDFs)
 *   3. OpenAI Vision (for image files)
 *   4. Python AI service (DOCX/PPTX)
 *   5. Raw text decode fallback
 */

import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const OPENAI_API_KEY = process.env.OPENAI_API_KEY

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData()
        const file = formData.get('file') as File

        if (!file) {
            return NextResponse.json({ error: 'No file provided' }, { status: 400 })
        }

        if (!OPENAI_API_KEY) {
            return NextResponse.json({ error: 'OpenAI API key not configured' }, { status: 500 })
        }

        const buffer = Buffer.from(await file.arrayBuffer())
        console.log(`[Extract] File: ${file.name}, Type: ${file.type}, Size: ${(file.size / 1024).toFixed(1)}KB`)

        let extractedText = ''

        // ── Determine file type ──
        const isPDF = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
        const isImage = file.type?.startsWith('image/')

        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // STRATEGY 1 (PDF): OpenAI GPT-4o multimodal — send PDF as base64 image
        // Handles scanned PDFs, complex layouts, and mixed-language content
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        if (isPDF) {
            try {
                console.log(`[Extract] Trying OpenAI multimodal PDF extraction...`)
                extractedText = await extractPDFWithOpenAI(buffer)
                console.log(`[Extract] OpenAI multimodal extracted: ${extractedText.length} chars`)
            } catch (err: any) {
                console.error(`[Extract] OpenAI multimodal PDF error: ${err.message}`)
            }

            // Fallback: try pdf-parse if OpenAI multimodal didn't get enough text
            if (!extractedText || extractedText.trim().length < 50) {
                try {
                    console.log(`[Extract] Trying pdf-parse fallback...`)
                    // eslint-disable-next-line @typescript-eslint/no-require-imports
                    const pdfParse = require('pdf-parse')
                    const pdfData = await pdfParse(buffer)
                    const parsedText = pdfData.text || ''
                    console.log(`[Extract] pdf-parse result: ${pdfData.numpages} pages, ${parsedText.length} chars`)

                    if (parsedText.trim().length > (extractedText?.trim().length || 0)) {
                        extractedText = parsedText
                    }
                } catch (err: any) {
                    console.error(`[Extract] pdf-parse error: ${err.message}`)
                }
            }
        }

        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // STRATEGY 2 (Images): OpenAI Vision
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        if (isImage && (!extractedText || extractedText.trim().length < 50)) {
            try {
                console.log(`[Extract] Trying OpenAI Vision for image...`)
                const base64Image = buffer.toString('base64')
                const visionResponse = await fetch('https://api.openai.com/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${OPENAI_API_KEY}`
                    },
                    body: JSON.stringify({
                        model: 'gpt-4o-mini',
                        messages: [{
                            role: 'user',
                            content: [
                                {
                                    type: 'text',
                                    text: 'Extract ALL text from this textbook/syllabus page. Include headings, paragraphs, formulas, examples, and any other text. Be thorough and preserve structure.'
                                },
                                {
                                    type: 'image_url',
                                    image_url: { url: `data:${file.type};base64,${base64Image}`, detail: 'high' }
                                }
                            ]
                        }],
                        max_tokens: 4000
                    })
                })
                if (visionResponse.ok) {
                    const vData = await visionResponse.json()
                    extractedText = vData.choices?.[0]?.message?.content || ''
                    console.log(`[Extract] Vision extracted: ${extractedText.length} chars`)
                } else {
                    const errText = await visionResponse.text()
                    console.error(`[Extract] Vision API error: ${errText.substring(0, 300)}`)
                }
            } catch (e: any) {
                console.error(`[Extract] Vision error: ${e.message}`)
            }
        }

        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // STRATEGY 3 (DOCX/PPTX/other): Python AI service
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        if (!isPDF && !isImage && (!extractedText || extractedText.trim().length < 50)) {
            try {
                console.log(`[Extract] Trying Python AI service...`)
                const aiFormData = new FormData()
                aiFormData.append('file', file)
                const aiResponse = await fetch('http://localhost:8000/api/syllabus/extract', {
                    method: 'POST',
                    body: aiFormData,
                })
                if (aiResponse.ok) {
                    const aiData = await aiResponse.json()
                    extractedText = JSON.stringify(aiData, null, 2)
                    console.log(`[Extract] Python service: ${extractedText.length} chars`)
                }
            } catch (e: any) {
                console.error(`[Extract] Python service error: ${e.message}`)
                // Last resort: raw decode
                extractedText = new TextDecoder('utf-8', { fatal: false }).decode(buffer)
                console.log(`[Extract] Raw decode fallback: ${extractedText.length} chars`)
            }
        }

        // ── Check if we got anything usable ──
        if (!extractedText || extractedText.trim().length < 20) {
            console.error(`[Extract] All extraction strategies failed. Final length: ${extractedText?.length || 0}`)
            return NextResponse.json(
                { error: 'Could not extract text from this file. All extraction methods failed. Please try a different file or ensure the PDF is not heavily encrypted.' },
                { status: 400 }
            )
        }

        console.log(`[Extract] Sending ${extractedText.length} chars to OpenAI for chapter analysis...`)

        // ── Analyze textbook content with OpenAI ──
        const result = await analyzeTextbook(extractedText)
        console.log(`[Extract] Done: ${result.total_chapters} chapters found`)

        return NextResponse.json(result)

    } catch (error: any) {
        console.error('[Extract] Error:', error)
        return NextResponse.json(
            { error: error.message || 'Failed to extract textbook' },
            { status: 500 }
        )
    }
}

/**
 * Extract text from a PDF using OpenAI GPT-4o multimodal.
 * Sends the PDF as a base64 data URL — GPT-4o can read PDFs directly.
 * This handles scanned, selectable, and complex PDFs.
 */
async function extractPDFWithOpenAI(buffer: Buffer): Promise<string> {
    const base64Data = buffer.toString('base64')

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${OPENAI_API_KEY}`
        },
        body: JSON.stringify({
            model: 'gpt-4o',
            messages: [{
                role: 'user',
                content: [
                    {
                        type: 'text',
                        text: `You are a textbook content extractor. Extract ALL text content from this PDF document.

Instructions:
- Extract every heading, paragraph, chapter title, table of contents, topic name, and text body
- Preserve the structure: chapter numbers, section headings, sub-sections
- Include formulas, examples, definitions, key terms
- If there is a Table of Contents, extract it completely
- Be thorough — do not skip any content
- Output the extracted text in a clean, readable format
- Do NOT add any commentary — just the raw extracted text from the document`
                    },
                    {
                        type: 'file',
                        file: {
                            filename: 'textbook.pdf',
                            file_data: `data:application/pdf;base64,${base64Data}`
                        }
                    }
                ]
            }],
            max_tokens: 16000
        })
    })

    if (!response.ok) {
        const errText = await response.text()
        throw new Error(`OpenAI API error ${response.status}: ${errText.substring(0, 300)}`)
    }

    const data = await response.json()
    const text = data.choices?.[0]?.message?.content || ''

    if (!text || text.trim().length < 10) {
        throw new Error('OpenAI returned empty or very short text')
    }

    return text
}


async function analyzeTextbook(content: string): Promise<any> {
    // Send up to 60k chars for better coverage
    const textForAI = content.substring(0, 60000)

    const prompt = `You are an expert curriculum analyst. Analyze the following textbook/syllabus content and extract ALL chapters/units with their detailed topics.

CONTENT:
${textForAI}

TASK: Identify every chapter or unit and list all topics within each one.

Return a JSON object with this EXACT structure:
{
    "textbook_title": "Title of the textbook",
    "total_chapters": 5,
    "chapters": [
        {
            "chapter_number": 1,
            "chapter_title": "Chapter Title",
            "topics": ["Topic 1: Specific subtopic", "Topic 2: Another subtopic"],
            "key_points": ["Key concept 1", "Key concept 2"],
            "formulas": [],
            "estimated_periods": 8,
            "difficulty_level": "easy",
            "summary": "Brief 1-2 sentence summary"
        }
    ]
}

Rules:
- Extract EVERY chapter/unit you can find
- Each chapter must have specific, detailed topics
- difficulty_level: "easy", "medium", or "hard"
- estimated_periods: number of 45-minute class periods needed
- Be thorough — include all topics within each chapter
- If formulas aren't applicable, use empty array []
- Topics must be specific enough for a teacher to plan a lesson
- Use the table of contents if present to identify all chapters`

    try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${OPENAI_API_KEY}`
            },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.3,
                response_format: { type: 'json_object' },
                max_tokens: 4000
            })
        })

        if (!response.ok) {
            const err = await response.text()
            console.error('[Extract] OpenAI analysis error:', err.substring(0, 300))
            return generateFallbackStructure(content)
        }

        const data = await response.json()
        const result = JSON.parse(data.choices[0].message.content)

        if (!result.chapters || !Array.isArray(result.chapters) || result.chapters.length === 0) {
            return generateFallbackStructure(content)
        }

        return result
    } catch (err: any) {
        console.error('[Extract] AI analysis failed:', err.message)
        return generateFallbackStructure(content)
    }
}

function generateFallbackStructure(content: string): any {
    const chapterPattern = /(?:chapter|unit|lesson)\s+(\d+)[:\s.\-]*([^\n]+)/gi
    const chapters = []
    let match

    while ((match = chapterPattern.exec(content)) !== null) {
        chapters.push({
            chapter_number: parseInt(match[1]),
            chapter_title: match[2].trim().substring(0, 100),
            topics: ['Introduction', 'Core concepts', 'Practice exercises'],
            key_points: ['Review textbook for details'],
            formulas: [],
            estimated_periods: 6,
            difficulty_level: 'medium',
            summary: match[2].trim().substring(0, 80)
        })
    }

    if (chapters.length === 0) {
        chapters.push({
            chapter_number: 1,
            chapter_title: 'Uploaded Content',
            topics: ['Content from uploaded file'],
            key_points: ['Review and update chapter information'],
            formulas: [],
            estimated_periods: 10,
            difficulty_level: 'medium',
            summary: 'Auto-extraction produced limited results. Please review.'
        })
    }

    return {
        textbook_title: 'Uploaded Textbook',
        total_chapters: chapters.length,
        chapters
    }
}
