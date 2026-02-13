import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

// Create admin client with service role key
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

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { email, password, full_name, role, school_id, class_id, section_id } = body

        // Validate required fields
        if (!email || !password || !full_name || !role || !school_id) {
            return NextResponse.json(
                { error: 'Missing required fields: email, password, full_name, role, school_id' },
                { status: 400 }
            )
        }

        // Create user in Supabase Auth using admin API (bypasses email confirmation)
        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: true, // Auto-confirm email
            user_metadata: {
                full_name,
                role
            }
        })

        if (authError) {
            console.error('Auth error:', authError)
            return NextResponse.json(
                { error: authError.message },
                { status: 400 }
            )
        }

        // Insert user into our users table
        const { data: userData, error: insertError } = await supabaseAdmin
            .from('users')
            .insert({
                user_id: authData.user.id,
                email,
                full_name,
                role,
                school_id,
                class_id: class_id || null,
                section_id: section_id || null
            })
            .select()
            .single()

        if (insertError) {
            // Rollback: delete the auth user if users table insert fails
            await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
            console.error('Insert error:', insertError)
            return NextResponse.json(
                { error: insertError.message },
                { status: 400 }
            )
        }

        return NextResponse.json({
            success: true,
            user: userData,
            message: 'User created successfully'
        })

    } catch (error: any) {
        console.error('Server error:', error)
        return NextResponse.json(
            { error: error.message || 'Server error' },
            { status: 500 }
        )
    }
}
