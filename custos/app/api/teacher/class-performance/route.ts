/**
 * CUSTOS: Teacher Class Performance API
 *
 * GET /api/teacher/class-performance?section_id=...
 *     → Returns full class performance overview including:
 *       - Class statistics (averages, counts)
 *       - Per-student performance metrics (ranked)
 *       - Weak topics for each student
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
    verifyTeacherSectionAccess,
    getClassPerformance,
} from '@/lib/analytics/teacherAnalytics'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const sectionId = searchParams.get('section_id')
        const teacherId = searchParams.get('teacherId')

        if (!sectionId || !teacherId) {
            return NextResponse.json(
                { error: 'section_id and teacherId are required' },
                { status: 400 }
            )
        }

        // Verify teacher has access to this section
        const hasAccess = await verifyTeacherSectionAccess(teacherId, sectionId)
        if (!hasAccess) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
        }

        const { stats, students } = await getClassPerformance(sectionId)

        return NextResponse.json({ class_stats: stats, students })
    } catch (err: any) {
        console.error('[Teacher API] class-performance error:', err)
        return NextResponse.json(
            { error: err.message || 'Internal server error' },
            { status: 500 }
        )
    }
}
