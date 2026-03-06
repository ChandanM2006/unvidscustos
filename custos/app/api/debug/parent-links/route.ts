/**
 * DEBUG ONLY: Check database tables
 * DELETE this file after debugging!
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
        // Schools
        const { data: schools, error: schoolsError } = await supabase
            .from('schools')
            .select('school_id, name, created_at')

        // Links
        const { data: allLinks, error: linksError } = await supabase
            .from('parent_student_links')
            .select('*')

        // Parents
        const { data: parents } = await supabase
            .from('users')
            .select('user_id, full_name, email, role, school_id')
            .eq('role', 'parent')

        // Students  
        const { data: students } = await supabase
            .from('users')
            .select('user_id, full_name, email, role, school_id')
            .eq('role', 'student')

        // All users count
        const { count: totalUsers } = await supabase
            .from('users')
            .select('*', { count: 'exact', head: true })

        return NextResponse.json({
            schools: {
                count: schools?.length || 0,
                data: schools,
                error: schoolsError?.message || null,
            },
            links: {
                count: allLinks?.length || 0,
                data: allLinks,
                error: linksError?.message || null,
            },
            parents: parents?.map(p => ({ id: p.user_id, name: p.full_name, email: p.email, school_id: p.school_id })),
            students: students?.map(s => ({ id: s.user_id, name: s.full_name, email: s.email, school_id: s.school_id })),
            total_users: totalUsers || 0,
            service_key_used: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
        })
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}
