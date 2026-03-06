import { NextRequest, NextResponse } from 'next/server'
import Razorpay from 'razorpay'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID!,
    key_secret: process.env.RAZORPAY_KEY_SECRET!,
})

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { student_id, fee_structure_id, slots, school_id } = body

        if (!student_id || !fee_structure_id || !slots || !school_id) {
            return NextResponse.json(
                { error: 'Missing required fields' },
                { status: 400 }
            )
        }

        // Calculate total amount from selected slots
        const totalAmount = slots.reduce(
            (sum: number, slot: { amount: number }) => sum + slot.amount,
            0
        )

        if (totalAmount <= 0) {
            return NextResponse.json(
                { error: 'Total amount must be greater than 0' },
                { status: 400 }
            )
        }

        // Cancel any stale 'created' (pending) payments for same student + fee structure
        await supabaseAdmin
            .from('fee_payments')
            .update({ status: 'cancelled' })
            .eq('student_id', student_id)
            .eq('fee_structure_id', fee_structure_id)
            .eq('status', 'created')

        // Generate receipt number
        const receipt = `CUSTOS_${Date.now()}_${Math.random().toString(36).substring(7)}`

        // Create Razorpay order (amount in paise - multiply by 100)
        const order = await razorpay.orders.create({
            amount: Math.round(totalAmount * 100),
            currency: 'INR',
            receipt: receipt,
            notes: {
                student_id,
                fee_structure_id,
                school_id,
            },
        })

        // Save payment record in database with status 'created'
        const { data: payment, error } = await supabaseAdmin
            .from('fee_payments')
            .insert({
                school_id,
                student_id,
                fee_structure_id,
                total_amount: totalAmount,
                slots_paid: slots,
                razorpay_order_id: order.id,
                status: 'created',
                receipt_number: receipt,
            })
            .select()
            .single()

        if (error) {
            console.error('Error creating payment record:', error)
            return NextResponse.json(
                { error: 'Failed to create payment record' },
                { status: 500 }
            )
        }

        return NextResponse.json({
            order_id: order.id,
            amount: order.amount,
            currency: order.currency,
            payment_id: payment.payment_id,
            key_id: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        })
    } catch (error) {
        console.error('Error creating Razorpay order:', error)
        return NextResponse.json(
            { error: 'Failed to create order' },
            { status: 500 }
        )
    }
}
