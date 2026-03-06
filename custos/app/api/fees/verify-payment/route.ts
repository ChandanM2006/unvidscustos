import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const {
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature,
            payment_id,
        } = body

        if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !payment_id) {
            return NextResponse.json(
                { error: 'Missing required verification fields' },
                { status: 400 }
            )
        }

        // Verify signature
        const generatedSignature = crypto
            .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET!)
            .update(`${razorpay_order_id}|${razorpay_payment_id}`)
            .digest('hex')

        const isValid = generatedSignature === razorpay_signature

        if (!isValid) {
            // Update payment as failed
            await supabaseAdmin
                .from('fee_payments')
                .update({
                    status: 'failed',
                    razorpay_payment_id,
                    razorpay_signature,
                })
                .eq('payment_id', payment_id)

            return NextResponse.json(
                { error: 'Payment verification failed - invalid signature' },
                { status: 400 }
            )
        }

        // Payment is verified — update the record
        const { data: payment, error } = await supabaseAdmin
            .from('fee_payments')
            .update({
                status: 'paid',
                razorpay_payment_id,
                razorpay_signature,
                paid_at: new Date().toISOString(),
            })
            .eq('payment_id', payment_id)
            .select()
            .single()

        if (error) {
            console.error('Error updating payment:', error)
            return NextResponse.json(
                { error: 'Failed to update payment record' },
                { status: 500 }
            )
        }

        return NextResponse.json({
            success: true,
            message: 'Payment verified successfully',
            payment,
        })
    } catch (error) {
        console.error('Error verifying payment:', error)
        return NextResponse.json(
            { error: 'Payment verification failed' },
            { status: 500 }
        )
    }
}
