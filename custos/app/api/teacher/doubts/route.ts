/**
 * CUSTOS: Teacher Doubts API
 *
 * GET  /api/teacher/doubts?teacherId=...
 *      → Returns flagged student doubts needing teacher attention
 *
 * POST /api/teacher/doubts
 *      → Teacher responds to a doubt
 *      → Body: { doubt_id, response_text, teacherId }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const teacherId = searchParams.get('teacherId')

        if (!teacherId) {
            return NextResponse.json({ error: 'teacherId required' }, { status: 400 })
        }

        // Get teacher's school
        const { data: teacher } = await supabase
            .from('users')
            .select('school_id, role')
            .eq('user_id', teacherId)
            .single()

        if (!teacher || !['teacher', 'super_admin', 'sub_admin'].includes(teacher.role)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
        }

        // Get all flagged doubts from students in the teacher's school
        const { data: flaggedDoubts, error } = await supabase
            .from('student_doubts')
            .select(`
                doubt_id,
                student_id,
                topic_id,
                doubt_text,
                ai_response,
                teacher_response,
                status,
                flagged_for_teacher,
                created_at,
                lesson_topics(topic_name),
                users!student_id!inner(school_id)
            `)
            .eq('users.school_id', teacher.school_id)
            .eq('flagged_for_teacher', true)
            .is('teacher_response', null)
            .order('created_at', { ascending: false })
            .limit(50)

        if (error) {
            console.error('[Teacher Doubts] Fetch error:', error)
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        // Get student names
        const studentIds = [...new Set((flaggedDoubts || []).map(d => d.student_id))]
        const { data: studentNames } = studentIds.length > 0
            ? await supabase
                .from('users')
                .select('user_id, full_name, class_id, section_id')
                .in('user_id', studentIds)
            : { data: [] }

        const nameMap = new Map<string, any>()
        for (const s of studentNames || []) {
            nameMap.set(s.user_id, s)
        }

        const enrichedDoubts = (flaggedDoubts || []).map(d => ({
            ...d,
            student_name: nameMap.get(d.student_id)?.full_name || 'Unknown',
            topic_name: (d.lesson_topics as any)?.topic_name || null,
        }))

        // Group by student
        const byStudent = new Map<string, any[]>()
        for (const d of enrichedDoubts) {
            if (!byStudent.has(d.student_id)) byStudent.set(d.student_id, [])
            byStudent.get(d.student_id)!.push(d)
        }

        return NextResponse.json({
            total_flagged: enrichedDoubts.length,
            students_needing_help: byStudent.size,
            doubts: enrichedDoubts,
        })
    } catch (err: any) {
        console.error('[Teacher Doubts] Error:', err)
        return NextResponse.json(
            { error: err.message || 'Internal server error' },
            { status: 500 }
        )
    }
}

export async function POST(request: NextRequest) {
    try {
        const { doubt_id, response_text, teacherId } = await request.json()

        if (!doubt_id || !response_text || !teacherId) {
            return NextResponse.json(
                { error: 'doubt_id, response_text, and teacherId are required' },
                { status: 400 }
            )
        }

        // Update doubt with teacher response
        const { error: updateErr } = await supabase
            .from('student_doubts')
            .update({
                teacher_response: response_text,
                status: 'teacher_answered',
                flagged_for_teacher: false,
                resolved_by: teacherId,
            })
            .eq('doubt_id', doubt_id)

        if (updateErr) {
            return NextResponse.json({ error: updateErr.message }, { status: 500 })
        }

        // Get the doubt to find the student
        const { data: doubt } = await supabase
            .from('student_doubts')
            .select('student_id')
            .eq('doubt_id', doubt_id)
            .single()

        // Send notification to student
        if (doubt) {
            await supabase.from('notifications').insert({
                user_id: doubt.student_id,
                title: '👨‍🏫 Teacher Responded!',
                message: 'Your teacher answered your doubt. Check it now!',
                type: 'info',
                action_url: `/dashboard/student/tutor?doubt_id=${doubt_id}`,
                action_label: 'View Response',
            })
        }

        return NextResponse.json({ success: true })
    } catch (err: any) {
        console.error('[Teacher Doubts] POST error:', err)
        return NextResponse.json(
            { error: err.message || 'Internal server error' },
            { status: 500 }
        )
    }
}
