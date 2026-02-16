/**
 * CUSTOS: Topic Report API
 *
 * GET /api/teacher/topic-report?topic_id=...&section_id=...
 *     → Returns per-topic performance breakdown for a class
 */

import { NextRequest, NextResponse } from 'next/server'
import { getTopicClassReport } from '@/lib/analytics/teacherAnalytics'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const topicId = searchParams.get('topic_id')
        const sectionId = searchParams.get('section_id')

        if (!topicId || !sectionId) {
            return NextResponse.json(
                { error: 'topic_id and section_id are required' },
                { status: 400 }
            )
        }

        const report = await getTopicClassReport(topicId, sectionId)

        if (!report) {
            return NextResponse.json(
                { error: 'Topic not found' },
                { status: 404 }
            )
        }

        return NextResponse.json(report)
    } catch (err: any) {
        console.error('[Teacher API] topic-report error:', err)
        return NextResponse.json(
            { error: err.message || 'Internal server error' },
            { status: 500 }
        )
    }
}
