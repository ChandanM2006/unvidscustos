/**
 * CUSTOS: Teacher Student Detail API
 *
 * GET /api/teacher/student-detail/[id]?teacherId=...
 *     → Returns comprehensive deep-dive data for a single student
 *     → Full performance + activity + doubts + concerning patterns
 */

import { NextRequest, NextResponse } from 'next/server'
import { getStudentDeepDive } from '@/lib/analytics/teacherAnalytics'

export const dynamic = 'force-dynamic'

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: studentId } = await params

        if (!studentId) {
            return NextResponse.json(
                { error: 'student ID is required' },
                { status: 400 }
            )
        }

        const deepDive = await getStudentDeepDive(studentId)

        if (!deepDive) {
            return NextResponse.json(
                { error: 'Student not found' },
                { status: 404 }
            )
        }

        return NextResponse.json(deepDive)
    } catch (err: any) {
        console.error('[Teacher API] student-detail error:', err)
        return NextResponse.json(
            { error: err.message || 'Internal server error' },
            { status: 500 }
        )
    }
}
