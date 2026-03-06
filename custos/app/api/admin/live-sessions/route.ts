import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export const dynamic = 'force-dynamic'

// GET: Fetch all live sessions for today (admin monitoring)
export async function GET(req: NextRequest) {
    try {
        const today = new Date().toISOString().split('T')[0]

        // Get all sessions for today
        const { data: sessions, error } = await supabase
            .from('live_class_sessions')
            .select('*')
            .eq('session_date', today)
            .order('started_at', { ascending: false })

        if (error) throw error

        if (!sessions || sessions.length === 0) {
            return NextResponse.json({ sessions: [] })
        }

        // Enrich with names
        const teacherIds = [...new Set(sessions.map((s: any) => s.teacher_id))]
        const classIds = [...new Set(sessions.map((s: any) => s.class_id))]
        const sectionIds = [...new Set(sessions.map((s: any) => s.section_id).filter(Boolean))]
        const subjectIds = [...new Set(sessions.map((s: any) => s.subject_id))]

        const [teachersRes, classesRes, sectionsRes, subjectsRes] = await Promise.all([
            supabase.from('users').select('user_id, full_name').in('user_id', teacherIds),
            supabase.from('classes').select('class_id, name').in('class_id', classIds),
            sectionIds.length > 0
                ? supabase.from('sections').select('section_id, name').in('section_id', sectionIds)
                : { data: [] },
            supabase.from('subjects').select('subject_id, name').in('subject_id', subjectIds),
        ])

        const teacherMap = new Map((teachersRes.data || []).map((t: any) => [t.user_id, t.full_name]))
        const classMap = new Map((classesRes.data || []).map((c: any) => [c.class_id, c.name]))
        const sectionMap = new Map((sectionsRes.data || []).map((s: any) => [s.section_id, s.name]))
        const subjectMap = new Map((subjectsRes.data || []).map((s: any) => [s.subject_id, s.name]))

        // Get slot times
        const slotIds = [...new Set(sessions.map((s: any) => s.slot_id).filter(Boolean))]
        let slotMap = new Map<string, { start_time: string; end_time: string }>()
        if (slotIds.length > 0) {
            const { data: slots } = await supabase
                .from('timetable_slots')
                .select('slot_id, start_time, end_time')
                .in('slot_id', slotIds)
            slotMap = new Map((slots || []).map((s: any) => [s.slot_id, { start_time: s.start_time, end_time: s.end_time }]))
        }

        const enriched = sessions.map((s: any) => ({
            ...s,
            teacher_name: teacherMap.get(s.teacher_id) || 'Unknown',
            class_name: classMap.get(s.class_id) || 'Unknown',
            section_name: sectionMap.get(s.section_id) || '',
            subject_name: subjectMap.get(s.subject_id) || 'Unknown',
            slot_start_time: slotMap.get(s.slot_id)?.start_time || '',
            slot_end_time: slotMap.get(s.slot_id)?.end_time || '',
        }))

        return NextResponse.json({ sessions: enriched })
    } catch (error: any) {
        console.error('GET admin live-sessions error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
