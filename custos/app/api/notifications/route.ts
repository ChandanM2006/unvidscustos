/**
 * CUSTOS: Notifications API
 *
 * GET  /api/notifications?user_id=...
 *      → Returns user's notifications
 *
 * POST /api/notifications
 *      → Creates a new notification
 *      → Body: { user_id, title, message, type?, action_url?, action_label? }
 *
 * PATCH /api/notifications
 *      → Mark notification(s) as read
 *      → Body: { notification_ids: string[] }
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
        const userId = searchParams.get('user_id')

        if (!userId) {
            return NextResponse.json({ error: 'user_id required' }, { status: 400 })
        }

        const { data, error } = await supabase
            .from('notifications')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(50)

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        return NextResponse.json({
            notifications: data || [],
            unread_count: (data || []).filter(n => !n.is_read).length,
        })
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}

export async function POST(request: NextRequest) {
    try {
        const { user_id, title, message, type, action_url, action_label, metadata } = await request.json()

        if (!user_id || !title || !message) {
            return NextResponse.json(
                { error: 'user_id, title, and message are required' },
                { status: 400 }
            )
        }

        const { data, error } = await supabase
            .from('notifications')
            .insert({
                user_id,
                title,
                message,
                type: type || 'info',
                action_url: action_url || null,
                action_label: action_label || null,
                metadata: metadata || {},
            })
            .select()
            .single()

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        return NextResponse.json({ notification: data })
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}

export async function PATCH(request: NextRequest) {
    try {
        const { notification_ids } = await request.json()

        if (!notification_ids || !Array.isArray(notification_ids)) {
            return NextResponse.json(
                { error: 'notification_ids array required' },
                { status: 400 }
            )
        }

        const { error } = await supabase
            .from('notifications')
            .update({
                is_read: true,
                read_at: new Date().toISOString(),
            })
            .in('notification_id', notification_ids)

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        return NextResponse.json({ success: true })
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}
