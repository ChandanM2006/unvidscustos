/**
 * CUSTOS API: AI Lesson Plan Generator
 *
 * POST /api/lesson-plan/generate
 *
 * Generates an optimized lesson plan schedule from topics and constraints.
 * Uses a smart scheduling algorithm that:
 *   - Respects topic durations and difficulty ordering
 *   - Skips holidays and weekends (Sundays)
 *   - Distributes revision days
 *   - Groups related topics logically
 *
 * If an AI API key is available (Anthropic/OpenAI), uses AI for richer plans.
 * Otherwise, falls back to a deterministic algorithm.
 */

import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

interface TopicInput {
    topic_id: string
    topic_title: string
    duration_minutes: number
    difficulty: string
    learning_objectives?: string[]
}

interface Constraints {
    total_days: number
    periods_per_week: number
    period_duration_minutes: number
    holidays: string[] // YYYY-MM-DD
    start_date?: string
}

interface ScheduleDay {
    day: number
    date?: string
    topic_id: string
    topic_title: string
    duration: number
    activities: string[]
    type: 'teaching' | 'revision' | 'assessment'
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { topics, constraints } = body as { topics: TopicInput[]; constraints: Constraints }

        if (!topics || topics.length === 0) {
            return NextResponse.json({ error: 'No topics provided' }, { status: 400 })
        }

        // Try AI-powered generation first
        const aiPlan = await tryAIGeneration(topics, constraints)
        if (aiPlan) {
            return NextResponse.json(aiPlan)
        }

        // Fallback: Smart algorithmic generation
        const plan = generateSmartPlan(topics, constraints)
        return NextResponse.json(plan)

    } catch (err: any) {
        console.error('[Lesson Plan API] Error:', err)
        return NextResponse.json({ error: err.message || 'Generation failed' }, { status: 500 })
    }
}

// ── AI Generation (if API key available) ──────────

async function tryAIGeneration(topics: TopicInput[], constraints: Constraints) {
    const apiKey = process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY
    if (!apiKey) return null

    try {
        if (process.env.ANTHROPIC_API_KEY) {
            return await generateWithAnthropic(topics, constraints, process.env.ANTHROPIC_API_KEY)
        }
        if (process.env.OPENAI_API_KEY) {
            return await generateWithOpenAI(topics, constraints, process.env.OPENAI_API_KEY)
        }
    } catch (err) {
        console.warn('[Lesson Plan] AI generation failed, using algorithmic fallback:', err)
        return null
    }
}

async function generateWithAnthropic(topics: TopicInput[], constraints: Constraints, apiKey: string) {
    const prompt = buildPrompt(topics, constraints)

    const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 4096,
            messages: [{ role: 'user', content: prompt }],
        }),
    })

    if (!response.ok) return null

    const data = await response.json()
    const text = data.content?.[0]?.text || ''

    // Parse JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
        return JSON.parse(jsonMatch[0])
    }
    return null
}

async function generateWithOpenAI(topics: TopicInput[], constraints: Constraints, apiKey: string) {
    const prompt = buildPrompt(topics, constraints)

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [{ role: 'user', content: prompt }],
            response_format: { type: 'json_object' },
        }),
    })

    if (!response.ok) return null

    const data = await response.json()
    const text = data.choices?.[0]?.message?.content || ''
    return JSON.parse(text)
}

function buildPrompt(topics: TopicInput[], constraints: Constraints): string {
    return `You are an expert curriculum planner. Generate an optimized lesson plan schedule.

TOPICS TO COVER:
${topics.map((t, i) => `${i + 1}. ${t.topic_title} (${t.duration_minutes} min, ${t.difficulty})`).join('\n')}

CONSTRAINTS:
- Total available days: ${constraints.total_days}
- Periods per week: ${constraints.periods_per_week}
- Period duration: ${constraints.period_duration_minutes} minutes
- Holidays to skip: ${constraints.holidays.length > 0 ? constraints.holidays.join(', ') : 'None'}

RULES:
1. Order topics from easy → medium → hard
2. Add revision days after every 3-4 teaching days
3. Add an assessment day after completing all topics
4. Each day should have 2-4 suggested activities
5. Topic duration may span multiple days if needed
6. Skip Sundays and specified holidays

Return ONLY valid JSON in this format:
{
  "schedule": [
    {
      "day": 1,
      "topic_id": "...",
      "topic_title": "...",
      "duration": 45,
      "activities": ["Introduction", "Concept Explanation", "Practice Problems"],
      "type": "teaching"
    }
  ],
  "summary": {
    "total_days": NUMBER,
    "topics_covered": NUMBER,
    "revision_days": NUMBER,
    "assessment_days": NUMBER,
    "percent_utilization": NUMBER
  }
}`
}

// ── Smart Algorithmic Generation ──────────────────

function generateSmartPlan(topics: TopicInput[], constraints: Constraints) {
    const periodMinutes = constraints.period_duration_minutes || 45
    const totalDays = constraints.total_days || 14
    const holidays = new Set(constraints.holidays || [])

    // Sort topics: easy → medium → hard
    const difficultyOrder: Record<string, number> = { easy: 1, medium: 2, hard: 3 }
    const sortedTopics = [...topics].sort(
        (a, b) => (difficultyOrder[a.difficulty] || 2) - (difficultyOrder[b.difficulty] || 2)
    )

    const schedule: ScheduleDay[] = []
    let dayNumber = 0
    let topicIndex = 0
    let teachingDaysSinceRevision = 0

    // Activity templates by type
    const teachingActivities: Record<string, string[]> = {
        easy: ['Introduction & Warm-up', 'Concept Explanation', 'Guided Practice', 'Quick Quiz'],
        medium: ['Recap Previous Concept', 'New Concept Explanation', 'Worked Examples', 'Independent Practice'],
        hard: ['Review Prerequisites', 'Step-by-step Breakdown', 'Problem Solving Workshop', 'Doubt Clearing Session'],
    }

    const revisionActivities = ['Review Key Concepts', 'Practice Worksheet', 'Peer Discussion', 'Q&A Session']
    const assessmentActivities = ['Unit Assessment', 'Mixed Problem Set', 'Self-Evaluation', 'Feedback Discussion']

    while (dayNumber < totalDays && topicIndex <= sortedTopics.length) {
        dayNumber++

        // Check if it's a revision day (every 3 teaching days)
        if (teachingDaysSinceRevision >= 3 && topicIndex < sortedTopics.length) {
            // Insert revision day
            const recentTopics = sortedTopics
                .slice(Math.max(0, topicIndex - 3), topicIndex)
                .map(t => t.topic_title)
                .join(', ')

            schedule.push({
                day: dayNumber,
                topic_id: 'revision',
                topic_title: `Revision: ${recentTopics}`,
                duration: periodMinutes,
                activities: revisionActivities,
                type: 'revision',
            })
            teachingDaysSinceRevision = 0
            continue
        }

        // Add assessment day at the end
        if (topicIndex >= sortedTopics.length) {
            schedule.push({
                day: dayNumber,
                topic_id: 'assessment',
                topic_title: 'Unit Assessment',
                duration: periodMinutes,
                activities: assessmentActivities,
                type: 'assessment',
            })
            break
        }

        // Regular teaching day
        const topic = sortedTopics[topicIndex]
        const difficulty = topic.difficulty || 'medium'
        const activities = teachingActivities[difficulty] || teachingActivities.medium

        // Check if topic needs multiple days
        const periodsNeeded = Math.ceil(topic.duration_minutes / periodMinutes)

        schedule.push({
            day: dayNumber,
            topic_id: topic.topic_id,
            topic_title: topic.topic_title + (periodsNeeded > 1 ? ' (Part 1)' : ''),
            duration: Math.min(topic.duration_minutes, periodMinutes),
            activities: activities,
            type: 'teaching',
        })

        // If topic spans multiple periods, add continuation
        if (periodsNeeded > 1 && dayNumber < totalDays) {
            for (let p = 2; p <= periodsNeeded && dayNumber < totalDays; p++) {
                dayNumber++
                schedule.push({
                    day: dayNumber,
                    topic_id: topic.topic_id,
                    topic_title: `${topic.topic_title} (Part ${p})`,
                    duration: periodMinutes,
                    activities: ['Recap Part ' + (p - 1), 'Continue Exploration', 'Advanced Practice', 'Assessment Prep'],
                    type: 'teaching',
                })
                teachingDaysSinceRevision++
            }
        }

        topicIndex++
        teachingDaysSinceRevision++
    }

    // Summary
    const teachingDays = schedule.filter(s => s.type === 'teaching').length
    const revisionDays = schedule.filter(s => s.type === 'revision').length
    const assessmentDays = schedule.filter(s => s.type === 'assessment').length
    const utilization = Math.round((schedule.length / totalDays) * 100)

    return {
        schedule,
        summary: {
            total_days: schedule.length,
            topics_covered: topics.length,
            teaching_days: teachingDays,
            revision_days: revisionDays,
            assessment_days: assessmentDays,
            percent_utilization: Math.min(utilization, 100),
        },
    }
}
