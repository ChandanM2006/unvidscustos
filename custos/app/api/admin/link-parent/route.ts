/**
 * CUSTOS Admin API: Link Parent to Child
 *
 * POST /api/admin/link-parent
 *     → Creates parent-child relationship
 *     → Only admins can access
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { parent_id, child_id, admin_id, relationship = 'parent' } = body

        if (!parent_id || !child_id || !admin_id) {
            return NextResponse.json(
                { error: 'parent_id, child_id, and admin_id are required' },
                { status: 400 }
            )
        }

        // Verify admin permission
        const { data: adminUser } = await supabase
            .from('users')
            .select('user_id, role, school_id')
            .eq('user_id', admin_id)
            .single()

        if (!adminUser || !['super_admin', 'sub_admin'].includes(adminUser.role)) {
            return NextResponse.json({ error: 'Admin permission required' }, { status: 403 })
        }

        // Verify parent exists and is 'parent' role
        const { data: parentUser } = await supabase
            .from('users')
            .select('user_id, role, full_name, school_id')
            .eq('user_id', parent_id)
            .single()

        if (!parentUser) {
            return NextResponse.json({ error: 'Parent user not found' }, { status: 404 })
        }

        if (parentUser.role !== 'parent') {
            return NextResponse.json({ error: 'User is not a parent' }, { status: 400 })
        }

        // Verify child exists and is 'student' role
        const { data: childUser } = await supabase
            .from('users')
            .select('user_id, role, full_name, school_id')
            .eq('user_id', child_id)
            .single()

        if (!childUser) {
            return NextResponse.json({ error: 'Student user not found' }, { status: 404 })
        }

        if (childUser.role !== 'student') {
            return NextResponse.json({ error: 'User is not a student' }, { status: 400 })
        }

        // Check if link already exists
        const { data: existing } = await supabase
            .from('parent_student_links')
            .select('link_id')
            .eq('parent_id', parent_id)
            .eq('student_id', child_id)
            .single()

        if (existing) {
            return NextResponse.json({ error: 'Link already exists', link_id: existing.link_id }, { status: 409 })
        }

        // Create parent-child link
        const { data: newLink, error: insertError } = await supabase
            .from('parent_student_links')
            .insert({
                parent_id,
                student_id: child_id,
                relationship,
                is_primary: true,
                school_id: adminUser.school_id,
            })
            .select()
            .single()

        if (insertError) {
            throw new Error(`Failed to link: ${insertError.message}`)
        }

        // Send notification to parent
        try {
            await supabase
                .from('notifications')
                .insert({
                    user_id: parent_id,
                    title: '👨‍👩‍👧‍👦 Child Linked',
                    message: `You can now view ${childUser.full_name}'s activity on your dashboard.`,
                    type: 'success',
                    action_url: '/dashboard/parent',
                    action_label: 'View Dashboard',
                })
        } catch (notifErr) {
            // Non-critical, don't fail the request
            console.warn('[Link Parent] Notification failed:', notifErr)
        }

        return NextResponse.json({
            success: true,
            link_id: newLink.link_id,
            parent_name: parentUser.full_name,
            child_name: childUser.full_name,
            relationship,
        })
    } catch (err: any) {
        console.error('[Link Parent API] Error:', err)
        return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 })
    }
}

// DELETE /api/admin/link-parent (Unlink)
export async function DELETE(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const linkId = searchParams.get('link_id')
        const adminId = searchParams.get('admin_id')

        if (!linkId || !adminId) {
            return NextResponse.json({ error: 'link_id and admin_id required' }, { status: 400 })
        }

        // Verify admin
        const { data: admin } = await supabase
            .from('users')
            .select('role')
            .eq('user_id', adminId)
            .single()

        if (!admin || !['super_admin', 'sub_admin'].includes(admin.role)) {
            return NextResponse.json({ error: 'Admin permission required' }, { status: 403 })
        }

        const { error } = await supabase
            .from('parent_student_links')
            .delete()
            .eq('link_id', linkId)

        if (error) throw error

        return NextResponse.json({ success: true })
    } catch (err: any) {
        console.error('[Unlink Parent API] Error:', err)
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}
