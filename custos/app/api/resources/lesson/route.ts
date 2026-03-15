/**
 * Lesson Resources API
 * 
 * GET  /api/resources/lesson?document_id=...&class_id=...
 *   → Returns lesson resources for a document/class combo
 *
 * POST /api/resources/lesson
 *   → Generate or save lesson resources
 *   Body: { document_id, class_id, subject_id, action: 'generate' | 'save' | 'publish', content? }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const documentId = searchParams.get('document_id')
        const classId = searchParams.get('class_id')
        const studentView = searchParams.get('student') === 'true'

        if (!documentId) {
            return NextResponse.json({ error: 'document_id required' }, { status: 400 })
        }

        let query = supabase
            .from('lesson_resources')
            .select('*')
            .eq('document_id', documentId)

        if (classId) {
            query = query.eq('class_id', classId)
        }

        if (studentView) {
            query = query.eq('status', 'published')
        }

        const { data, error } = await query.maybeSingle()

        if (error && error.code !== 'PGRST116') {
            throw error
        }

        return NextResponse.json({ resource: data || null })
    } catch (err: any) {
        console.error('[Lesson Resources GET] Error:', err)
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { document_id, class_id, subject_id, action, content, resource_type } = body

        if (!document_id || !action) {
            return NextResponse.json({ error: 'document_id and action required' }, { status: 400 })
        }

        // ─── GENERATE ──────────────────────────────────
        if (action === 'generate') {
            // Get all topics for this lesson
            const { data: topics } = await supabase
                .from('lesson_topics')
                .select('topic_id, topic_title, topic_number, content, estimated_duration_minutes, difficulty_level')
                .eq('document_id', document_id)
                .order('topic_number', { ascending: true })

            // Get lesson info
            const { data: doc } = await supabase
                .from('syllabus_documents')
                .select('chapter_title, grade_level, subject_id')
                .eq('document_id', document_id)
                .single()

            // Get subject name
            let subjectName = 'General'
            if (doc?.subject_id) {
                const { data: subjectData } = await supabase
                    .from('subjects')
                    .select('name')
                    .eq('subject_id', doc.subject_id)
                    .single()
                if (subjectData) subjectName = subjectData.name
            }

            const payload = {
                document_id,
                chapter_title: doc?.chapter_title || 'Lesson',
                grade_level: doc?.grade_level || 9,
                subject_name: subjectName,
                topics: topics || [],
                resource_type: resource_type || 'all'
            }

            // Call AI Service for generation
            const response = await fetch('http://localhost:8000/api/resources/generate-lesson', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            })

            if (!response.ok) {
                const errText = await response.text()
                throw new Error(`AI generation failed: ${errText}`)
            }

            const result = await response.json()

            // Upsert into lesson_resources
            const resourceData: any = {
                document_id,
                class_id: class_id || null,
                subject_id: subject_id || doc?.subject_id || null,
                status: 'draft',
                ai_generated: true,
            }

            // Merge generated content
            if (result.content) {
                if (resource_type && resource_type !== 'all') {
                    resourceData[resource_type] = result.content
                } else {
                    if (result.content.lesson_notes) resourceData.lesson_notes = result.content.lesson_notes
                    if (result.content.study_guide) resourceData.study_guide = result.content.study_guide
                    if (result.content.worksheet) resourceData.worksheet = result.content.worksheet
                    if (result.content.revision_notes) resourceData.revision_notes = result.content.revision_notes
                    if (result.content.formulas_list) resourceData.formulas_list = result.content.formulas_list
                }
            }

            // Try upsert
            const { data: existing } = await supabase
                .from('lesson_resources')
                .select('resource_id')
                .eq('document_id', document_id)
                .eq('class_id', class_id || '')
                .maybeSingle()

            let saved
            if (existing) {
                const { data, error } = await supabase
                    .from('lesson_resources')
                    .update(resourceData)
                    .eq('resource_id', existing.resource_id)
                    .select()
                    .single()
                if (error) throw error
                saved = data
            } else {
                const { data, error } = await supabase
                    .from('lesson_resources')
                    .insert(resourceData)
                    .select()
                    .single()
                if (error) throw error
                saved = data
            }

            return NextResponse.json({ resource: saved, generated: true })
        }

        // ─── SAVE (teacher edit) ──────────────────────
        if (action === 'save') {
            if (!content) {
                return NextResponse.json({ error: 'content required for save' }, { status: 400 })
            }

            const { data: existing } = await supabase
                .from('lesson_resources')
                .select('resource_id')
                .eq('document_id', document_id)
                .maybeSingle()

            if (!existing) {
                return NextResponse.json({ error: 'Resource not found' }, { status: 404 })
            }

            const updateData: any = {
                ...content,
                last_edited_at: new Date().toISOString(),
            }

            const { data, error } = await supabase
                .from('lesson_resources')
                .update(updateData)
                .eq('resource_id', existing.resource_id)
                .select()
                .single()

            if (error) throw error

            return NextResponse.json({ resource: data, saved: true })
        }

        // ─── PUBLISH ──────────────────────────────────
        if (action === 'publish') {
            const { data: existing } = await supabase
                .from('lesson_resources')
                .select('resource_id')
                .eq('document_id', document_id)
                .maybeSingle()

            if (!existing) {
                return NextResponse.json({ error: 'Resource not found' }, { status: 404 })
            }

            const { data, error } = await supabase
                .from('lesson_resources')
                .update({
                    status: 'published',
                    published_at: new Date().toISOString(),
                })
                .eq('resource_id', existing.resource_id)
                .select()
                .single()

            if (error) throw error

            return NextResponse.json({ resource: data, published: true })
        }

        // ─── UNPUBLISH ────────────────────────────────
        if (action === 'unpublish') {
            const { data: existing } = await supabase
                .from('lesson_resources')
                .select('resource_id')
                .eq('document_id', document_id)
                .maybeSingle()

            if (!existing) {
                return NextResponse.json({ error: 'Resource not found' }, { status: 404 })
            }

            const { data, error } = await supabase
                .from('lesson_resources')
                .update({
                    status: 'draft',
                    published_at: null,
                })
                .eq('resource_id', existing.resource_id)
                .select()
                .single()

            if (error) throw error

            return NextResponse.json({ resource: data, unpublished: true })
        }

        return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
    } catch (err: any) {
        console.error('[Lesson Resources POST] Error:', err)
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}
