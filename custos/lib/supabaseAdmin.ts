import { createClient } from '@supabase/supabase-js'

// This client uses the Service Role key — it BYPASSES RLS
// ONLY use this in server-side API routes, NEVER expose to the browser
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
})
