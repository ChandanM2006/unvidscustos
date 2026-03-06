import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    }
)

export async function PUT(request: NextRequest) {
    try {
        const body = await request.json()
        const { user_id, full_name, role, class_id, section_id } = body

        if (!user_id || !full_name || !role) {
            return NextResponse.json(
                { error: 'Missing required fields: user_id, full_name, role' },
                { status: 400 }
            )
        }

        const updateData: any = {
            full_name,
            role,
            class_id: class_id || null,
            section_id: section_id || null
        }

        const { data, error } = await supabaseAdmin
            .from('users')
            .update(updateData)
            .eq('user_id', user_id)
            .select()
            .single()

        if (error) {
            console.error('[Update User] Error:', error)
            return NextResponse.json({ error: error.message }, { status: 400 })
        }

        return NextResponse.json({
            success: true,
            user: data,
            message: 'User updated successfully'
        })

    } catch (error: any) {
        console.error('[Update User] Server error:', error)
        return NextResponse.json(
            { error: error.message || 'Server error' },
            { status: 500 }
        )
    }
}
