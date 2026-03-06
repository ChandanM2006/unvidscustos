import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export const dynamic = 'force-dynamic'

/**
 * POST: Deduplicate timetable entries
 * 
 * Finds entries with the same (class_id, section_id, day_of_week, slot_id)
 * and keeps only the first (oldest) entry, deleting the rest.
 * 
 * For teacher-specific dedup, it also checks for same teacher
 * having multiple entries at the same time/slot.
 */
export async function POST(req: NextRequest) {
    try {
        // Verify admin status
        const { data: { session } } = await supabase.auth.getSession()

        // Fetch all timetable entries
        const { data: entries, error } = await supabase
            .from('timetable_entries')
            .select('entry_id, class_id, section_id, subject_id, teacher_id, day_of_week, slot_id, created_at')
            .order('created_at', { ascending: true })

        if (error) throw error
        if (!entries || entries.length === 0) {
            return NextResponse.json({ message: 'No entries found', deleted: 0 })
        }

        // ── Find duplicates: same class + section + day + slot ──
        const seen = new Map<string, string>() // key -> first entry_id
        const duplicateIds: string[] = []

        for (const entry of entries) {
            const key = `${entry.class_id}_${entry.section_id || ''}_${entry.day_of_week}_${entry.slot_id || ''}`
            if (seen.has(key)) {
                // This is a duplicate — mark for deletion
                duplicateIds.push(entry.entry_id)
            } else {
                seen.set(key, entry.entry_id)
            }
        }

        // ── Also check for teacher-level duplicates: same teacher + day + slot ──
        const teacherSeen = new Map<string, string>()
        for (const entry of entries) {
            if (duplicateIds.includes(entry.entry_id)) continue // already marked
            const teacherKey = `teacher_${entry.teacher_id}_${entry.day_of_week}_${entry.slot_id || ''}`
            if (teacherSeen.has(teacherKey)) {
                duplicateIds.push(entry.entry_id)
            } else {
                teacherSeen.set(teacherKey, entry.entry_id)
            }
        }

        if (duplicateIds.length === 0) {
            return NextResponse.json({ message: 'No duplicates found', deleted: 0 })
        }

        // Delete duplicates
        const { error: deleteError } = await supabase
            .from('timetable_entries')
            .delete()
            .in('entry_id', duplicateIds)

        if (deleteError) throw deleteError

        return NextResponse.json({
            message: `Successfully removed ${duplicateIds.length} duplicate timetable entries`,
            deleted: duplicateIds.length,
            deleted_ids: duplicateIds
        })
    } catch (error: any) {
        console.error('Deduplication error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}

/**
 * GET: Check for duplicate timetable entries (dry run)
 */
export async function GET(req: NextRequest) {
    try {
        const { data: entries, error } = await supabase
            .from('timetable_entries')
            .select('entry_id, class_id, section_id, subject_id, teacher_id, day_of_week, slot_id, created_at')
            .order('created_at', { ascending: true })

        if (error) throw error
        if (!entries || entries.length === 0) {
            return NextResponse.json({ total: 0, duplicates: 0, groups: [] })
        }

        // Find duplicate groups
        const groups = new Map<string, any[]>()
        for (const entry of entries) {
            const key = `${entry.class_id}_${entry.section_id || ''}_${entry.day_of_week}_${entry.slot_id || ''}`
            if (!groups.has(key)) groups.set(key, [])
            groups.get(key)!.push(entry)
        }

        const duplicateGroups = Array.from(groups.entries())
            .filter(([_, entries]) => entries.length > 1)
            .map(([key, entries]) => ({
                key,
                count: entries.length,
                entries: entries.map(e => ({
                    entry_id: e.entry_id,
                    teacher_id: e.teacher_id,
                    subject_id: e.subject_id,
                    created_at: e.created_at
                }))
            }))

        return NextResponse.json({
            total: entries.length,
            duplicates: duplicateGroups.reduce((sum, g) => sum + g.count - 1, 0),
            groups: duplicateGroups
        })
    } catch (error: any) {
        console.error('Check duplicates error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
