import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

// Default from email - using Resend's test domain
// For production, verify your own domain at resend.com/domains
const FROM_EMAIL = 'Custos School <onboarding@resend.dev>'

interface SendInvitationEmailParams {
    to: string
    userName: string
    role: string
    schoolName: string
    inviteLink: string
}

interface SendOTPEmailParams {
    to: string
    userName: string
    otpCode: string
}

interface SendWelcomeEmailParams {
    to: string
    userName: string
    role: string
    schoolName: string
}

export async function sendInvitationEmail({
    to,
    userName,
    role,
    schoolName,
    inviteLink
}: SendInvitationEmailParams) {
    try {
        const { data, error } = await resend.emails.send({
            from: FROM_EMAIL,
            to: [to],
            subject: `You're invited to join ${schoolName} on Custos!`,
            html: `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f5f5;">
    <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
        <div style="background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); border-radius: 16px 16px 0 0; padding: 40px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 28px;">🎓 Welcome to Custos!</h1>
        </div>
        <div style="background: white; border-radius: 0 0 16px 16px; padding: 40px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
            <h2 style="color: #1f2937; margin-top: 0;">Hello ${userName}! 👋</h2>
            <p style="color: #4b5563; font-size: 16px; line-height: 1.6;">
                You've been invited to join <strong>${schoolName}</strong> as a <strong style="color: #6366f1;">${role}</strong>.
            </p>
            <p style="color: #4b5563; font-size: 16px; line-height: 1.6;">
                Click the button below to complete your registration:
            </p>
            <div style="text-align: center; margin: 30px 0;">
                <a href="${inviteLink}" style="display: inline-block; background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); color: white; text-decoration: none; padding: 16px 32px; border-radius: 12px; font-weight: 600; font-size: 16px;">
                    Complete Registration →
                </a>
            </div>
            <p style="color: #9ca3af; font-size: 14px; line-height: 1.6;">
                This invitation link will expire in 7 days. If you didn't expect this email, you can safely ignore it.
            </p>
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
            <p style="color: #9ca3af; font-size: 12px; text-align: center;">
                Powered by Custos School Management System
            </p>
        </div>
    </div>
</body>
</html>
            `
        })

        if (error) {
            console.error('Email send error:', error)
            return { success: false, error }
        }

        return { success: true, data }
    } catch (error) {
        console.error('Email send exception:', error)
        return { success: false, error }
    }
}

export async function sendOTPEmail({
    to,
    userName,
    otpCode
}: SendOTPEmailParams) {
    try {
        const { data, error } = await resend.emails.send({
            from: FROM_EMAIL,
            to: [to],
            subject: `Your verification code: ${otpCode}`,
            html: `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f5f5;">
    <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
        <div style="background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); border-radius: 16px 16px 0 0; padding: 40px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 28px;">🔐 Verification Code</h1>
        </div>
        <div style="background: white; border-radius: 0 0 16px 16px; padding: 40px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
            <h2 style="color: #1f2937; margin-top: 0;">Hi ${userName}!</h2>
            <p style="color: #4b5563; font-size: 16px; line-height: 1.6;">
                Your verification code is:
            </p>
            <div style="text-align: center; margin: 30px 0;">
                <div style="display: inline-block; background: #f3f4f6; padding: 20px 40px; border-radius: 12px; font-family: monospace; font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #1f2937;">
                    ${otpCode}
                </div>
            </div>
            <p style="color: #4b5563; font-size: 16px; line-height: 1.6;">
                This code will expire in <strong>15 minutes</strong>.
            </p>
            <p style="color: #9ca3af; font-size: 14px; line-height: 1.6;">
                If you didn't request this code, please ignore this email.
            </p>
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
            <p style="color: #9ca3af; font-size: 12px; text-align: center;">
                Powered by Custos School Management System
            </p>
        </div>
    </div>
</body>
</html>
            `
        })

        if (error) {
            console.error('OTP email error:', error)
            return { success: false, error }
        }

        return { success: true, data }
    } catch (error) {
        console.error('OTP email exception:', error)
        return { success: false, error }
    }
}

export async function sendWelcomeEmail({
    to,
    userName,
    role,
    schoolName
}: SendWelcomeEmailParams) {
    try {
        const { data, error } = await resend.emails.send({
            from: FROM_EMAIL,
            to: [to],
            subject: `Welcome to ${schoolName}! 🎉`,
            html: `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f5f5;">
    <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
        <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); border-radius: 16px 16px 0 0; padding: 40px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 28px;">🎉 Registration Complete!</h1>
        </div>
        <div style="background: white; border-radius: 0 0 16px 16px; padding: 40px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
            <h2 style="color: #1f2937; margin-top: 0;">Welcome aboard, ${userName}! 🚀</h2>
            <p style="color: #4b5563; font-size: 16px; line-height: 1.6;">
                Your account has been successfully created at <strong>${schoolName}</strong>.
            </p>
            <div style="background: #f0fdf4; border-radius: 12px; padding: 20px; margin: 20px 0;">
                <p style="color: #166534; margin: 0; font-weight: 600;">✅ Your Role: ${role}</p>
            </div>
            <p style="color: #4b5563; font-size: 16px; line-height: 1.6;">
                You can now log in to access your dashboard and start using all the features.
            </p>
            <div style="text-align: center; margin: 30px 0;">
                <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/login" style="display: inline-block; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; text-decoration: none; padding: 16px 32px; border-radius: 12px; font-weight: 600; font-size: 16px;">
                    Go to Login →
                </a>
            </div>
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
            <p style="color: #9ca3af; font-size: 12px; text-align: center;">
                Powered by Custos School Management System
            </p>
        </div>
    </div>
</body>
</html>
            `
        })

        if (error) {
            console.error('Welcome email error:', error)
            return { success: false, error }
        }

        return { success: true, data }
    } catch (error) {
        console.error('Welcome email exception:', error)
        return { success: false, error }
    }
}
