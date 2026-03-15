import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// GET - Fetch all posts for a school
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const schoolId = searchParams.get('school_id')
        const role = searchParams.get('role')

        if (!schoolId) {
            return NextResponse.json({ error: 'school_id is required' }, { status: 400 })
        }

        let query = supabase
            .from('posts')
            .select(`
                *,
                author:users!author_id(full_name, role)
            `)
            .eq('school_id', schoolId)

        // Filter based on role if provided and not an admin
        if (role && role !== 'super_admin' && role !== 'sub_admin') {
            query = query.or(`target_audience.eq.all,target_audience.eq.${role}`)
        }

        const { data, error } = await query.order('created_at', { ascending: false })

        if (error) throw error

        return NextResponse.json({ posts: data })
    } catch (error: any) {
        console.error('Error fetching posts:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}

// POST - Create a new post
export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData()

        const schoolId = formData.get('school_id') as string
        const authorId = formData.get('author_id') as string
        const title = formData.get('title') as string
        const content = formData.get('content') as string
        const postType = formData.get('post_type') as string
        const targetAudience = (formData.get('target_audience') as string) || 'all'
        const file = formData.get('file') as File | null

        if (!schoolId || !authorId || !postType) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
        }

        let mediaUrl = null

        // Handle file upload to Supabase Storage
        if (file && file.size > 0) {
            const fileExt = file.name.split('.').pop()
            const fileName = `${schoolId}/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`

            const arrayBuffer = await file.arrayBuffer()
            const buffer = Buffer.from(arrayBuffer)

            const { data: uploadData, error: uploadError } = await supabase
                .storage
                .from('posts')
                .upload(fileName, buffer, {
                    contentType: file.type,
                    upsert: false,
                })

            if (uploadError) {
                console.error('Upload error:', uploadError)
                // If bucket doesn't exist, try to create it
                if (uploadError.message?.includes('not found') || uploadError.message?.includes('Bucket')) {
                    // Bucket needs to be created in Supabase dashboard
                    return NextResponse.json({
                        error: 'Storage bucket "posts" not found. Please create it in Supabase Dashboard > Storage.'
                    }, { status: 500 })
                }
                throw uploadError
            }

            const { data: publicUrl } = supabase
                .storage
                .from('posts')
                .getPublicUrl(fileName)

            mediaUrl = publicUrl.publicUrl
        }

        // Insert post record
        const { data, error } = await supabase
            .from('posts')
            .insert({
                school_id: schoolId,
                author_id: authorId,
                title: title || null,
                content: content || null,
                media_url: mediaUrl,
                post_type: postType,
                target_audience: targetAudience,
            })
            .select(`
                *,
                author:users!author_id(full_name, role)
            `)
            .single()

        if (error) throw error

        return NextResponse.json({ post: data })
    } catch (error: any) {
        console.error('Error creating post:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}

// DELETE - Delete a post
export async function DELETE(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const postId = searchParams.get('post_id')

        if (!postId) {
            return NextResponse.json({ error: 'post_id is required' }, { status: 400 })
        }

        // Get the post first to delete the file from storage
        const { data: post } = await supabase
            .from('posts')
            .select('media_url')
            .eq('post_id', postId)
            .single()

        if (post?.media_url) {
            // Extract file path from URL and delete from storage
            const url = new URL(post.media_url)
            const path = url.pathname.split('/storage/v1/object/public/posts/')[1]
            if (path) {
                await supabase.storage.from('posts').remove([path])
            }
        }

        const { error } = await supabase
            .from('posts')
            .delete()
            .eq('post_id', postId)

        if (error) throw error

        return NextResponse.json({ success: true })
    } catch (error: any) {
        console.error('Error deleting post:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
