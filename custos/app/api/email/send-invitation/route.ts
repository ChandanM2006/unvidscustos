import { NextRequest, NextResponse } from 'next/server'
import { sendInvitationEmail } from '@/lib/email'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
    try {
        const { inviteId } = await req.json()

        if (!inviteId) {
            return NextResponse.json({ error: 'Invite ID required' }, { status: 400 })
        }

        // Get invitation details
        const { data: invite, error: fetchError } = await supabaseAdmin
            .from('user_invitations')
            .select('*, schools:school_id(name)')
            .eq('invite_id', inviteId)
            .single()

        if (fetchError || !invite) {
            return NextResponse.json({ error: 'Invitation not found' }, { status: 404 })
        }

        if (!invite.email) {
            return NextResponse.json({ error: 'No email address for this invitation' }, { status: 400 })
        }

        // Generate invite link
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
        const inviteLink = `${baseUrl}/join?token=${invite.invite_token}`

        // Send email
        const result = await sendInvitationEmail({
            to: invite.email,
            userName: invite.full_name,
            role: invite.role,
            schoolName: invite.schools?.name || 'Your School',
            inviteLink
        })

        if (!result.success) {
            console.error('Email send failed:', result.error)
            return NextResponse.json({ error: 'Failed to send email' }, { status: 500 })
        }

        // Update invitation status
        await supabaseAdmin
            .from('user_invitations')
            .update({
                status: 'invited',
                invite_sent_at: new Date().toISOString(),
                invite_resent_count: (invite.invite_resent_count || 0) + 1
            })
            .eq('invite_id', inviteId)

        return NextResponse.json({
            success: true,
            message: 'Invitation email sent successfully',
            emailId: result.data?.id
        })

    } catch (error: any) {
        console.error('Send invitation error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
