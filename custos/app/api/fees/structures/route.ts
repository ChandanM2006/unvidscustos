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
        const { school_id, class_id, academic_year, name, description, slots } = body

        if (!school_id || !class_id || !academic_year || !name) {
            return NextResponse.json(
                { error: 'Missing required fields: school_id, class_id, academic_year, name' },
                { status: 400 }
            )
        }

        // Create fee structure
        const { data: structure, error: structureError } = await supabaseAdmin
            .from('fee_structures')
            .insert({
                school_id,
                class_id,
                academic_year,
                name,
                description: description || null,
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

            const { error: slotsError } = await supabaseAdmin
                .from('fee_slots')
                .insert(slotsToInsert)

            if (slotsError) {
                console.error('Error creating fee slots:', slotsError)
                // Rollback — delete the structure
                await supabaseAdmin
                    .from('fee_structures')
                    .delete()
                    .eq('fee_structure_id', structure.fee_structure_id)
                return NextResponse.json({ error: slotsError.message }, { status: 500 })
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
        const { fee_structure_id, name, description, is_active, slots } = body

        if (!fee_structure_id) {
            return NextResponse.json({ error: 'fee_structure_id is required' }, { status: 400 })
        }

        // Update structure fields
        const updateData: Record<string, unknown> = {}
        if (name !== undefined) updateData.name = name
        if (description !== undefined) updateData.description = description
        if (is_active !== undefined) updateData.is_active = is_active

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
            // Delete existing slots
            await supabaseAdmin
                .from('fee_slots')
                .delete()
                .eq('fee_structure_id', fee_structure_id)

            // Insert new slots
            if (slots.length > 0) {
                const slotsToInsert = slots.map((slot: { name: string; amount: number; description?: string; is_mandatory?: boolean }, index: number) => ({
                    fee_structure_id,
                    name: slot.name,
                    amount: slot.amount,
                    description: slot.description || null,
                    is_mandatory: slot.is_mandatory !== false,
                    display_order: index,
                }))

                const { error: slotsError } = await supabaseAdmin
                    .from('fee_slots')
                    .insert(slotsToInsert)

                if (slotsError) {
                    return NextResponse.json({ error: slotsError.message }, { status: 500 })
                }
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
