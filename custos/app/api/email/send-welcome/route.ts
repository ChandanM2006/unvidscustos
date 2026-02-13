import { NextRequest, NextResponse } from 'next/server'
import { sendWelcomeEmail } from '@/lib/email'

export async function POST(req: NextRequest) {
    try {
        const { email, userName, role, schoolName } = await req.json()

        if (!email || !userName) {
            return NextResponse.json({ error: 'Email and userName required' }, { status: 400 })
        }

        // Send welcome email
        const result = await sendWelcomeEmail({
            to: email,
            userName,
            role: role || 'User',
            schoolName: schoolName || 'Your School'
        })

        if (!result.success) {
            console.error('Welcome email send failed:', result.error)
            return NextResponse.json({ error: 'Failed to send welcome email' }, { status: 500 })
        }

        return NextResponse.json({
            success: true,
            message: 'Welcome email sent successfully'
        })

    } catch (error: any) {
        console.error('Send welcome error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
