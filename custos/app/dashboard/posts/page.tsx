'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import {
    ArrowLeft, Plus, X, Camera, Upload, Edit3, Loader2,
    Image as ImageIcon, FileText, Trash2, Clock, User,
    Send, Heart, Sparkles, Newspaper, PenTool, File
} from 'lucide-react'

interface Post {
    post_id: string
    school_id: string
    author_id: string
    title: string | null
    content: string | null
    media_url: string | null
    post_type: 'photo' | 'file' | 'blog'
    created_at: string
    author?: {
        full_name: string
        role: string
    }
}

const POST_TYPE_CONFIG = {
    photo: { label: 'Photo', icon: Camera, color: 'from-pink-500 to-rose-600', emoji: '📸' },
    file: { label: 'File / Document', icon: Upload, color: 'from-blue-500 to-cyan-600', emoji: '📄' },
    blog: { label: 'Blog / Announcement', icon: PenTool, color: 'from-amber-500 to-orange-600', emoji: '✍️' },
}

export default function PostsPage() {
    const router = useRouter()
    const fileInputRef = useRef<HTMLInputElement>(null)
    const cameraInputRef = useRef<HTMLInputElement>(null)

    const [loading, setLoading] = useState(true)
    const [user, setUser] = useState<any>(null)
    const [schoolId, setSchoolId] = useState<string | null>(null)
    const [isAdmin, setIsAdmin] = useState(false)
    const [posts, setPosts] = useState<Post[]>([])

    // Create post state
    const [showCreatePanel, setShowCreatePanel] = useState(false)
    const [createStep, setCreateStep] = useState<'type' | 'content'>('type')
    const [postType, setPostType] = useState<'photo' | 'file' | 'blog'>('blog')
    const [title, setTitle] = useState('')
    const [content, setContent] = useState('')
    const [selectedFile, setSelectedFile] = useState<File | null>(null)
    const [filePreview, setFilePreview] = useState<string | null>(null)
    const [submitting, setSubmitting] = useState(false)

    useEffect(() => {
        loadInitialData()
    }, [])

    async function loadInitialData() {
        try {
            const { data: { session } } = await supabase.auth.getSession()
            if (!session) {
                router.push('/login')
                return
            }

            const { data: userData } = await supabase
                .from('users')
                .select('*')
                .eq('email', session.user.email)
                .single()

            if (!userData) {
                router.push('/login')
                return
            }

            setUser(userData)
            setSchoolId(userData.school_id)
            const admin = ['super_admin', 'sub_admin'].includes(userData.role)
            setIsAdmin(admin)

            // Load posts
            await loadPosts(userData.school_id)
        } catch (error) {
            console.error('Error loading data:', error)
        } finally {
            setLoading(false)
        }
    }

    async function loadPosts(sid?: string) {
        const id = sid || schoolId
        if (!id) return

        try {
            const res = await fetch(`/api/posts?school_id=${id}`)
            const data = await res.json()

            if (data.posts) {
                setPosts(data.posts)
            }
        } catch (error) {
            console.error('Error loading posts:', error)
            // Fallback: load directly from supabase
            const { data } = await supabase
                .from('posts')
                .select('*')
                .eq('school_id', id)
                .order('created_at', { ascending: false })

            if (data) {
                setPosts(data as Post[])
            }
        }
    }

    function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>, type: 'photo' | 'file') {
        const file = e.target.files?.[0]
        if (!file) return

        setSelectedFile(file)
        setPostType(type)

        // Create preview for images
        if (file.type.startsWith('image/')) {
            const reader = new FileReader()
            reader.onload = (ev) => setFilePreview(ev.target?.result as string)
            reader.readAsDataURL(file)
        } else {
            setFilePreview(null)
        }

        setCreateStep('content')
    }

    async function submitPost() {
        if (!schoolId || !user) return
        if (postType === 'blog' && !content && !title) return
        if ((postType === 'photo' || postType === 'file') && !selectedFile) return

        setSubmitting(true)
        try {
            const formData = new FormData()
            formData.append('school_id', schoolId)
            formData.append('author_id', user.user_id)
            formData.append('post_type', postType)
            formData.append('title', title)
            formData.append('content', content)

            if (selectedFile) {
                formData.append('file', selectedFile)
            }

            const res = await fetch('/api/posts', {
                method: 'POST',
                body: formData,
            })

            const data = await res.json()

            if (!res.ok) {
                throw new Error(data.error || 'Failed to create post')
            }

            // Reset and reload
            resetCreateForm()
            await loadPosts()
        } catch (error: any) {
            console.error('Error creating post:', error)
            alert('Error creating post: ' + error.message)
        } finally {
            setSubmitting(false)
        }
    }

    async function deletePost(postId: string) {
        if (!confirm('Delete this post? This cannot be undone.')) return

        try {
            const res = await fetch(`/api/posts?post_id=${postId}`, { method: 'DELETE' })
            if (!res.ok) throw new Error('Failed to delete post')
            await loadPosts()
        } catch (error: any) {
            console.error('Error deleting post:', error)
            alert('Error: ' + error.message)
        }
    }

    function resetCreateForm() {
        setShowCreatePanel(false)
        setCreateStep('type')
        setPostType('blog')
        setTitle('')
        setContent('')
        setSelectedFile(null)
        setFilePreview(null)
    }

    function formatTimeAgo(dateStr: string): string {
        const now = new Date()
        const date = new Date(dateStr)
        const seconds = Math.floor((now.getTime() - date.getTime()) / 1000)

        if (seconds < 60) return 'just now'
        if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
        if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
        if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    }

    function getRoleDisplay(role: string): string {
        const map: Record<string, string> = {
            super_admin: 'Admin',
            sub_admin: 'Admin',
            teacher: 'Teacher',
            student: 'Student',
        }
        return map[role] || role
    }

    function getBackPath() {
        if (!user) return '/dashboard'
        if (user.role === 'teacher') return '/dashboard/teacher'
        if (user.role === 'student') return '/dashboard/student'
        if (user.role === 'parent') return '/dashboard/parent'
        return '/dashboard'
    }

    function isImageUrl(url: string): boolean {
        return /\.(jpg|jpeg|png|gif|webp|svg|bmp)(\?|$)/i.test(url)
    }

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-rose-950 to-slate-900">
                <Loader2 className="w-12 h-12 text-rose-400 animate-spin" />
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-rose-950 to-slate-900">
            {/* Hidden file inputs */}
            <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => handleFileSelect(e, 'photo')}
            />
            <input
                ref={fileInputRef}
                type="file"
                accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt"
                className="hidden"
                onChange={(e) => handleFileSelect(e, 'file')}
            />

            {/* Header */}
            <header className="bg-white/5 backdrop-blur-lg border-b border-white/10 px-6 py-4 sticky top-0 z-20">
                <div className="max-w-3xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => router.push(getBackPath())}
                            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                        >
                            <ArrowLeft className="w-5 h-5 text-rose-300" />
                        </button>
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-gradient-to-r from-rose-500 to-orange-600 rounded-xl flex items-center justify-center">
                                <Newspaper className="w-5 h-5 text-white" />
                            </div>
                            <div>
                                <h1 className="text-xl font-bold text-white">Posts</h1>
                                <p className="text-xs text-rose-300/70">Announcements & Updates</p>
                            </div>
                        </div>
                    </div>
                </div>
            </header>

            <main className="max-w-3xl mx-auto p-6">
                {/* Create Post Card (Admin Only) */}
                {isAdmin && !showCreatePanel && (
                    <div className="bg-white/5 backdrop-blur-lg rounded-2xl border border-white/10 p-5 mb-6">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-r from-rose-500 to-orange-600 flex items-center justify-center text-white font-bold">
                                {user?.full_name?.charAt(0) || 'A'}
                            </div>
                            <button
                                onClick={() => {
                                    setShowCreatePanel(true)
                                    setCreateStep('type')
                                }}
                                className="flex-1 px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white/40 text-sm text-left hover:bg-white/10 transition-colors"
                            >
                                Share an announcement, photo, or document...
                            </button>
                        </div>

                        <div className="flex gap-2">
                            <button
                                onClick={() => cameraInputRef.current?.click()}
                                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-pink-500/10 text-pink-400 hover:bg-pink-500/20 transition-colors text-sm font-medium"
                            >
                                <Camera className="w-4 h-4" />
                                Take Photo
                            </button>
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-colors text-sm font-medium"
                            >
                                <Upload className="w-4 h-4" />
                                Upload File
                            </button>
                            <button
                                onClick={() => {
                                    setPostType('blog')
                                    setShowCreatePanel(true)
                                    setCreateStep('content')
                                }}
                                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 transition-colors text-sm font-medium"
                            >
                                <PenTool className="w-4 h-4" />
                                Write Blog
                            </button>
                        </div>
                    </div>
                )}

                {/* Create Post Panel */}
                {showCreatePanel && (
                    <div className="bg-white/5 backdrop-blur-lg rounded-2xl border border-white/10 overflow-hidden mb-6 animate-[fadeIn_0.3s_ease-out]">
                        {/* Panel Header */}
                        <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Sparkles className="w-5 h-5 text-amber-400" />
                                <h3 className="font-bold text-white">
                                    {createStep === 'type' ? 'Create Post' : `New ${POST_TYPE_CONFIG[postType].label}`}
                                </h3>
                            </div>
                            <button
                                onClick={resetCreateForm}
                                className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
                            >
                                <X className="w-5 h-5 text-white/50" />
                            </button>
                        </div>

                        {createStep === 'type' ? (
                            /* Step 1: Choose type */
                            <div className="p-5 grid grid-cols-3 gap-3">
                                {Object.entries(POST_TYPE_CONFIG).map(([key, config]) => (
                                    <button
                                        key={key}
                                        onClick={() => {
                                            if (key === 'photo') {
                                                cameraInputRef.current?.click()
                                            } else if (key === 'file') {
                                                fileInputRef.current?.click()
                                            } else {
                                                setPostType(key as any)
                                                setCreateStep('content')
                                            }
                                        }}
                                        className="p-5 rounded-2xl border border-white/10 hover:border-white/20 hover:bg-white/5 transition-all text-center group"
                                    >
                                        <div className={`w-14 h-14 mx-auto rounded-2xl bg-gradient-to-r ${config.color} flex items-center justify-center mb-3 group-hover:scale-110 transition-transform`}>
                                            <config.icon className="w-6 h-6 text-white" />
                                        </div>
                                        <p className="text-white font-medium text-sm">{config.label}</p>
                                        <p className="text-white/40 text-xs mt-1">
                                            {key === 'photo' ? 'Use camera' : key === 'file' ? 'Upload document' : 'Write announcement'}
                                        </p>
                                    </button>
                                ))}
                            </div>
                        ) : (
                            /* Step 2: Content */
                            <div className="p-5 space-y-4">
                                {/* File Preview */}
                                {selectedFile && (
                                    <div className="bg-white/5 rounded-xl p-4 flex items-center gap-3">
                                        {filePreview ? (
                                            <img src={filePreview} alt="Preview" className="w-20 h-20 rounded-xl object-cover" />
                                        ) : (
                                            <div className="w-20 h-20 rounded-xl bg-white/10 flex items-center justify-center">
                                                <File className="w-8 h-8 text-white/40" />
                                            </div>
                                        )}
                                        <div className="flex-1 min-w-0">
                                            <p className="text-white text-sm font-medium truncate">{selectedFile.name}</p>
                                            <p className="text-white/40 text-xs">
                                                {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                                            </p>
                                        </div>
                                        <button
                                            onClick={() => {
                                                setSelectedFile(null)
                                                setFilePreview(null)
                                            }}
                                            className="p-1.5 hover:bg-white/10 rounded-lg"
                                        >
                                            <X className="w-4 h-4 text-white/50" />
                                        </button>
                                    </div>
                                )}

                                <div>
                                    <input
                                        type="text"
                                        value={title}
                                        onChange={e => setTitle(e.target.value)}
                                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-rose-500/50 text-lg font-semibold"
                                        placeholder="Title (optional)"
                                    />
                                </div>

                                <div>
                                    <textarea
                                        value={content}
                                        onChange={e => setContent(e.target.value)}
                                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-rose-500/50 resize-none"
                                        rows={postType === 'blog' ? 8 : 3}
                                        placeholder={postType === 'blog' ? 'Write your announcement or blog post here...' : 'Add a caption or description...'}
                                    />
                                </div>

                                {/* Additional file upload for blog type */}
                                {postType === 'blog' && !selectedFile && (
                                    <button
                                        onClick={() => fileInputRef.current?.click()}
                                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-dashed border-white/20 text-white/50 hover:text-white/70 hover:bg-white/10 transition-all text-sm w-full justify-center"
                                    >
                                        <ImageIcon className="w-4 h-4" />
                                        Attach Image or Document (optional)
                                    </button>
                                )}

                                <div className="flex justify-between items-center pt-2">
                                    <button
                                        onClick={() => {
                                            if (selectedFile) {
                                                setSelectedFile(null)
                                                setFilePreview(null)
                                            }
                                            setCreateStep('type')
                                        }}
                                        className="text-white/50 hover:text-white text-sm transition-colors"
                                    >
                                        ← Back
                                    </button>
                                    <button
                                        onClick={submitPost}
                                        disabled={submitting || (postType === 'blog' && !content && !title) || ((postType === 'photo' || postType === 'file') && !selectedFile)}
                                        className="px-6 py-2.5 bg-gradient-to-r from-rose-500 to-orange-600 text-white rounded-xl hover:from-rose-600 hover:to-orange-700 transition-all font-medium disabled:opacity-50 flex items-center gap-2 shadow-lg shadow-rose-500/25"
                                    >
                                        {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                                        Publish Post
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Posts Feed */}
                {posts.length === 0 ? (
                    <div className="bg-white/5 backdrop-blur-lg rounded-2xl border border-white/10 p-12 text-center">
                        <Newspaper className="w-16 h-16 text-rose-400/20 mx-auto mb-4" />
                        <h3 className="text-white font-bold text-lg mb-2">No Posts Yet</h3>
                        <p className="text-white/40 text-sm">
                            {isAdmin ? 'Create your first post to share with the school!' : 'Check back for updates from your school.'}
                        </p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {posts.map(post => {
                            const typeConfig = POST_TYPE_CONFIG[post.post_type] || POST_TYPE_CONFIG.blog

                            return (
                                <div
                                    key={post.post_id}
                                    className="bg-white/5 backdrop-blur-lg rounded-2xl border border-white/10 overflow-hidden hover:border-white/20 transition-all"
                                >
                                    {/* Post Header */}
                                    <div className="px-5 py-4 flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-10 h-10 rounded-full bg-gradient-to-r ${typeConfig.color} flex items-center justify-center text-white font-bold text-sm`}>
                                                {post.author?.full_name?.charAt(0) || 'A'}
                                            </div>
                                            <div>
                                                <p className="text-white font-medium text-sm">
                                                    {post.author?.full_name || 'Admin'}
                                                </p>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-white/40 text-xs">
                                                        {post.author?.role ? getRoleDisplay(post.author.role) : ''}
                                                    </span>
                                                    <span className="text-white/20">•</span>
                                                    <span className="text-white/40 text-xs flex items-center gap-1">
                                                        <Clock className="w-3 h-3" />
                                                        {formatTimeAgo(post.created_at)}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium bg-gradient-to-r ${typeConfig.color} text-white`}>
                                                {typeConfig.emoji} {typeConfig.label}
                                            </span>
                                            {isAdmin && (
                                                <button
                                                    onClick={() => deletePost(post.post_id)}
                                                    className="p-1.5 hover:bg-red-500/20 rounded-lg transition-colors"
                                                >
                                                    <Trash2 className="w-4 h-4 text-red-400" />
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    {/* Post Content */}
                                    <div className="px-5 pb-4">
                                        {post.title && (
                                            <h3 className="text-white font-bold text-lg mb-2">{post.title}</h3>
                                        )}
                                        {post.content && (
                                            <p className="text-white/70 text-sm whitespace-pre-wrap leading-relaxed">
                                                {post.content}
                                            </p>
                                        )}
                                    </div>

                                    {/* Media */}
                                    {post.media_url && (
                                        <div className="border-t border-white/5">
                                            {isImageUrl(post.media_url) ? (
                                                <img
                                                    src={post.media_url}
                                                    alt={post.title || 'Post image'}
                                                    className="w-full max-h-[500px] object-cover"
                                                />
                                            ) : (
                                                <a
                                                    href={post.media_url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="flex items-center gap-3 px-5 py-4 hover:bg-white/5 transition-colors"
                                                >
                                                    <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center">
                                                        <FileText className="w-6 h-6 text-blue-400" />
                                                    </div>
                                                    <div>
                                                        <p className="text-white text-sm font-medium">View Document</p>
                                                        <p className="text-white/40 text-xs">Click to open attached file</p>
                                                    </div>
                                                </a>
                                            )}
                                        </div>
                                    )}

                                    {/* Post Footer */}
                                    <div className="px-5 py-3 border-t border-white/5 flex items-center gap-4">
                                        <span className="text-white/30 text-xs">
                                            {new Date(post.created_at).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                                        </span>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}
            </main>

            <style jsx>{`
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(-10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            `}</style>
        </div>
    )
}
