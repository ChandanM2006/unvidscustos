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
        const { email, password, full_name, role, school_id, class_id, section_id, roll_number, student_id } = body

        // Validate required fields
        if (!email || !password || !full_name || !role || !school_id) {
            return NextResponse.json(
                { error: 'Missing required fields: email, password, full_name, role, school_id' },
                { status: 400 }
            )
        }

        // Create user in Supabase Auth using admin API (bypasses email confirmation)
        let { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: { full_name, role }
        })

        // Handle stale auth record: user was deleted from `users` table but auth record remained
        if (authError && authError.message.toLowerCase().includes('already been registered')) {
            console.log('Stale auth record detected for', email, '— cleaning up and retrying...')

            // Find the existing auth user by email
            const { data: listData } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 })
            const existingAuthUser = listData?.users?.find(u => u.email === email)

            if (existingAuthUser) {
                // Delete stale auth user
                await supabaseAdmin.auth.admin.deleteUser(existingAuthUser.id)
                // Also clean up any stale users table entry (just in case)
                await supabaseAdmin.from('users').delete().eq('email', email)
                console.log('Stale auth user deleted, retrying creation...')
            }

            // Retry creation
            const retry = await supabaseAdmin.auth.admin.createUser({
                email,
                password,
                email_confirm: true,
                user_metadata: { full_name, role }
            })
            authData = retry.data
            authError = retry.error
        }

        if (authError) {
            console.error('Auth error:', authError)
            return NextResponse.json(
                { error: authError.message },
                { status: 400 }
            )
        }

        // Insert user into our users table
        if (!authData?.user) {
            return NextResponse.json({ error: 'Failed to create auth user' }, { status: 500 })
        }

        const insertData: any = {
            user_id: authData.user.id,
            email,
            full_name,
            role,
            school_id,
            class_id: class_id || null,
            section_id: section_id || null,
        }
        // Only include roll_number if provided (column may not exist yet)
        if (roll_number) {
            insertData.roll_number = roll_number
        }

        const { data: userData, error: insertError } = await supabaseAdmin
            .from('users')
            .insert(insertData)
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

        // ── Parent-child link ─────────────────────────────────────────────────
        // If this is a parent registering via invite and they have a linked student,
        // insert parent_student_links server-side (bypasses RLS — client-side insert fails silently)
        if (role === 'parent' && student_id && authData?.user?.id) {
            const { error: linkError } = await supabaseAdmin
                .from('parent_student_links')
                .insert({
                    parent_id: authData.user.id,
                    student_id,
                    school_id,
                    relationship: 'parent'
                })
            if (linkError) {
                console.error('[create user] parent_student_links insert failed:', linkError)
                // Non-fatal — user is created, link failure is logged
            } else {
                console.log('[create user] parent_student_links created:', authData.user.id, '→', student_id)
            }
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
