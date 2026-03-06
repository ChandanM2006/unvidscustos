import { NextRequest, NextResponse } from 'next/server'
import { sendOTPEmail } from '@/lib/email'
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
            .select('*')
            .eq('invite_id', inviteId)
            .single()

        if (fetchError || !invite) {
            return NextResponse.json({ error: 'Invitation not found' }, { status: 404 })
        }

        if (!invite.email) {
            return NextResponse.json({ error: 'No email address for this invitation' }, { status: 400 })
        }

        // Generate OTP
        const otpCode = Math.floor(100000 + Math.random() * 900000).toString()
        const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString() // 15 minutes

        // Save OTP to database
        await supabaseAdmin
            .from('user_invitations')
            .update({
                otp_code: otpCode,
                otp_expires_at: expiresAt,
                otp_attempts: 0
            })
            .eq('invite_id', inviteId)

        // Try to send email
        const result = await sendOTPEmail({
            to: invite.email,
            userName: invite.full_name,
            otpCode
        })

        if (!result.success) {
            console.error('OTP email send failed:', result.error)
            // In development, log the OTP so the flow isn't blocked
            console.log(`\n📧 OTP EMAIL FAILED — Fallback for development:`)
            console.log(`   Email: ${invite.email}`)
            console.log(`   OTP Code: ${otpCode}`)
            console.log(`   Expires: ${expiresAt}\n`)

            // Still return success — OTP is saved in DB, user can use it
            // This prevents blocking the registration flow when email service is down
            return NextResponse.json({
                success: true,
                message: 'OTP generated (email delivery failed — check server console for code)',
                emailSent: false,
                expiresAt,
                // Only include OTP in development for testing
                ...(process.env.NODE_ENV === 'development' ? { devOtp: otpCode } : {})
            })
        }

        return NextResponse.json({
            success: true,
            message: 'OTP sent successfully',
            emailSent: true,
            expiresAt
        })

    } catch (error: any) {
        console.error('Send OTP error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
