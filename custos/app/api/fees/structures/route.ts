import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

// GET — Fetch fee structures for a school (optionally filtered by class)
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const school_id = searchParams.get('school_id')
        const class_id = searchParams.get('class_id')

        if (!school_id) {
            return NextResponse.json({ error: 'school_id is required' }, { status: 400 })
        }

        let query = supabaseAdmin
            .from('fee_structures')
            .select(`
                *,
                fee_slots (*),
                fee_installments (*),
                student_additional_fees (student_id),
                classes (name, grade_level)
            `)
            .eq('school_id', school_id)
            .order('created_at', { ascending: false })

        if (class_id) {
            query = query.eq('class_id', class_id)
        }

        const { data, error } = await query

        if (error) {
            console.error('Error fetching fee structures:', error)
            // If the schema hasn't been upgraded, fallback to standard query
            if (error.code === '42703' || error.message.includes('fee_installments')) {
                const fallbackQuery = await supabaseAdmin
                    .from('fee_structures')
                    .select(`
                        *,
                        fee_slots (*),
                        classes (name, grade_level)
                    `)
                    .eq('school_id', school_id)
                    .order('created_at', { ascending: false })
                return NextResponse.json({ data: fallbackQuery.data || [] })
            }
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        return NextResponse.json({ data })
    } catch (error) {
        console.error('Error in fee structures GET:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}

// POST — Create a new fee structure with slots
export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { school_id, class_id, academic_year, name, description, slots, fee_type = 'class', installments = [], assigned_students = [] } = body

        if (!school_id || !academic_year || !name) {
            return NextResponse.json(
                { error: 'Missing required fields' },
                { status: 400 }
            )
        }

        const actualClassId = class_id || null

        // Create fee structure
        const { data: structure, error: structureError } = await supabaseAdmin
            .from('fee_structures')
            .insert({
                school_id,
                class_id: actualClassId,
                academic_year,
                name,
                description: description || null,
                fee_type: fee_type
            })
            .select()
            .single()

        if (structureError) {
            console.error('Error creating fee structure:', structureError)
            return NextResponse.json({ error: structureError.message }, { status: 500 })
        }

        // Create fee slots if provided
        if (slots && slots.length > 0) {
            const slotsToInsert = slots.map((slot: { name: string; amount: number; description?: string; is_mandatory?: boolean }, index: number) => ({
                fee_structure_id: structure.fee_structure_id,
                name: slot.name,
                amount: slot.amount,
                description: slot.description || null,
                is_mandatory: slot.is_mandatory !== false,
                display_order: index,
            }))

            await supabaseAdmin.from('fee_slots').insert(slotsToInsert)
        }

        // Add Installments
        if (installments && installments.length > 0) {
            const inserts = installments.map((inst: any) => ({
                fee_structure_id: structure.fee_structure_id,
                name: inst.name,
                due_date: inst.due_date,
                amount: inst.amount
            }))
            const { error: insErr } = await supabaseAdmin.from('fee_installments').insert(inserts)
            if (insErr) {
                console.error("Installment insert error:", insErr)
            }
        }

        // Map Specific Students for Additional Fees
        if (fee_type === 'additional' && assigned_students && assigned_students.length > 0) {
            const studentMap = assigned_students.map((sid: string) => ({
                fee_structure_id: structure.fee_structure_id,
                student_id: sid
            }))
            const { error: stuErr } = await supabaseAdmin.from('student_additional_fees').insert(studentMap)
            if (stuErr) {
                console.error("Student assign error:", stuErr)
            }
        }

        // Fetch complete structure with slots
        const { data: complete } = await supabaseAdmin
            .from('fee_structures')
            .select(`*, fee_slots (*), classes (name, grade_level)`)
            .eq('fee_structure_id', structure.fee_structure_id)
            .single()

        return NextResponse.json({ data: complete }, { status: 201 })
    } catch (error) {
        console.error('Error in fee structures POST:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}

// PUT — Update a fee structure and its slots
export async function PUT(request: NextRequest) {
    try {
        const body = await request.json()
        const { fee_structure_id, name, description, is_active, slots, fee_type, installments, assigned_students } = body

        if (!fee_structure_id) {
            return NextResponse.json({ error: 'fee_structure_id is required' }, { status: 400 })
        }

        // Update structure fields
        const updateData: Record<string, unknown> = {}
        if (name !== undefined) updateData.name = name
        if (description !== undefined) updateData.description = description
        if (is_active !== undefined) updateData.is_active = is_active
        if (fee_type !== undefined) updateData.fee_type = fee_type

        if (Object.keys(updateData).length > 0) {
            const { error } = await supabaseAdmin
                .from('fee_structures')
                .update(updateData)
                .eq('fee_structure_id', fee_structure_id)

            if (error) {
                return NextResponse.json({ error: error.message }, { status: 500 })
            }
        }

        // Replace slots if provided
        if (slots) {
            await supabaseAdmin.from('fee_slots').delete().eq('fee_structure_id', fee_structure_id)
            if (slots.length > 0) {
                const slotsToInsert = slots.map((slot: { name: string; amount: number; description?: string; is_mandatory?: boolean }, index: number) => ({
                    fee_structure_id,
                    name: slot.name,
                    amount: slot.amount,
                    description: slot.description || null,
                    is_mandatory: slot.is_mandatory !== false,
                    display_order: index,
                }))
                await supabaseAdmin.from('fee_slots').insert(slotsToInsert)
            }
        }

        // Replace Installments if provided
        if (installments) {
            await supabaseAdmin.from('fee_installments').delete().eq('fee_structure_id', fee_structure_id)
            if (installments.length > 0) {
                const inserts = installments.map((inst: any) => ({
                    fee_structure_id,
                    name: inst.name,
                    due_date: inst.due_date,
                    amount: inst.amount
                }))
                await supabaseAdmin.from('fee_installments').insert(inserts)
            }
        }

        // Replace Assigned Students
        if (assigned_students !== undefined && fee_type === 'additional') {
            await supabaseAdmin.from('student_additional_fees').delete().eq('fee_structure_id', fee_structure_id)
            if (assigned_students.length > 0) {
                const studentMap = assigned_students.map((sid: string) => ({
                    fee_structure_id,
                    student_id: sid
                }))
                await supabaseAdmin.from('student_additional_fees').insert(studentMap)
            }
        }

        // Return updated structure
        const { data } = await supabaseAdmin
            .from('fee_structures')
            .select(`*, fee_slots (*), classes (name, grade_level)`)
            .eq('fee_structure_id', fee_structure_id)
            .single()

        return NextResponse.json({ data })
    } catch (error) {
        console.error('Error in fee structures PUT:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}

// DELETE — Delete a fee structure
export async function DELETE(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const fee_structure_id = searchParams.get('fee_structure_id')

        if (!fee_structure_id) {
            return NextResponse.json({ error: 'fee_structure_id is required' }, { status: 400 })
        }

        // Check if there are any paid payments
        const { data: payments } = await supabaseAdmin
            .from('fee_payments')
            .select('payment_id')
            .eq('fee_structure_id', fee_structure_id)
            .eq('status', 'paid')
            .limit(1)

        if (payments && payments.length > 0) {
            return NextResponse.json(
                { error: 'Cannot delete fee structure with completed payments. Deactivate it instead.' },
                { status: 400 }
            )
        }

        const { error } = await supabaseAdmin
            .from('fee_structures')
            .delete()
            .eq('fee_structure_id', fee_structure_id)

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Error in fee structures DELETE:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
