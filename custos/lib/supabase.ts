import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Database Types
export type UserRole = 'super_admin' | 'sub_admin' | 'teacher' | 'student'

export interface School {
    school_id: string
    name: string
    config_json: {
        logo_url?: string
        primary_color?: string
        secondary_color?: string
    }
    created_at: string
}

export interface User {
    user_id: string
    school_id: string
    role: UserRole
    email: string
    full_name: string
    class_id?: string
    section_id?: string
    created_at: string
}

export interface Class {
    class_id: string
    school_id: string
    name: string
    grade_level: number
    created_at: string
}

export interface Section {
    section_id: string
    class_id: string
    name: string
    created_at: string
}
