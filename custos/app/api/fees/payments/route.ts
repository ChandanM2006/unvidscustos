import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

// GET — Fetch payments for a school or student
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const school_id = searchParams.get('school_id')
        const student_id = searchParams.get('student_id')

        if (!school_id && !student_id) {
            return NextResponse.json(
                { error: 'school_id or student_id is required' },
                { status: 400 }
            )
        }

        let query = supabaseAdmin
            .from('fee_payments')
            .select(`
                *,
                fee_structures (name, academic_year, classes (name, grade_level)),
                users!fee_payments_student_id_fkey (full_name, email, class_id)
            `)
            .neq('status', 'cancelled')
            .order('created_at', { ascending: false })

        if (school_id) {
            query = query.eq('school_id', school_id)
        }

        if (student_id) {
            query = query.eq('student_id', student_id)
        }

        const { data, error } = await query

        if (error) {
            console.error('Error fetching payments:', error)
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        return NextResponse.json({ data })
    } catch (error) {
        console.error('Error in payments GET:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
