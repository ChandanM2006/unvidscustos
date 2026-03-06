'use client'

/**
 * Smart Navigation Utility — v2
 * 
 * Fixes the system-wide problem of back buttons navigating to wrong pages.
 * 
 * Previous approach used window.history.length which is unreliable because
 * it accumulates across the entire browser tab session, including external
 * sites and redirects, leading to unpredictable router.back() behavior.
 * 
 * New approach:
 * 1. Uses sessionStorage to track the navigation stack within our app
 * 2. On every page load, records the current path
 * 3. goBack() checks if the previous path in our stack is a valid in-app route
 * 4. If it is, we use router.back(); otherwise we use the fallback
 * 5. Provides role-aware dashboard routing to prevent cross-role navigation
 */

import { useRouter, usePathname } from 'next/navigation'
import { useCallback, useEffect, useRef } from 'react'

// ─── Role → Dashboard Mapping ──────────────────────────

const ROLE_DASHBOARDS: Record<string, string> = {
    super_admin: '/dashboard',
    sub_admin: '/dashboard',
    teacher: '/dashboard/teacher',
    student: '/dashboard/student',
    parent: '/dashboard/parent',
}

/**
 * Returns the correct dashboard home for a given role
 */
export function getDashboardHome(role: string): string {
    return ROLE_DASHBOARDS[role] || '/dashboard'
}

// ─── Navigation Stack (sessionStorage) ─────────────────

const NAV_STACK_KEY = 'custos_nav_stack'

function getNavStack(): string[] {
    if (typeof window === 'undefined') return []
    try {
        const raw = sessionStorage.getItem(NAV_STACK_KEY)
        return raw ? JSON.parse(raw) : []
    } catch {
        return []
    }
}

function setNavStack(stack: string[]) {
    if (typeof window === 'undefined') return
    try {
        // Keep stack at a reasonable size (last 50 entries)
        const trimmed = stack.slice(-50)
        sessionStorage.setItem(NAV_STACK_KEY, JSON.stringify(trimmed))
    } catch { }
}

function pushToNavStack(path: string) {
    const stack = getNavStack()
    // Don't push duplicates (e.g., re-renders on the same page)
    if (stack.length > 0 && stack[stack.length - 1] === path) return
    stack.push(path)
    setNavStack(stack)
}

function popFromNavStack(): string | null {
    const stack = getNavStack()
    if (stack.length <= 1) return null // Nothing to go back to
    stack.pop() // Remove current page
    const previous = stack[stack.length - 1] || null
    setNavStack(stack)
    return previous
}

function peekPreviousInStack(): string | null {
    const stack = getNavStack()
    if (stack.length <= 1) return null
    return stack[stack.length - 2] || null
}

// ─── useSmartBack Hook ─────────────────────────────────

/**
 * Custom hook that provides smart back navigation.
 * 
 * Usage:
 *   const { goBack } = useSmartBack('/dashboard/student')
 *   <button onClick={goBack}>← Back</button>
 * 
 * How it works:
 *   1. Tracks navigation stack in sessionStorage
 *   2. On goBack(), checks if the previous page is a valid in-app route
 *   3. If the previous page is the same role's area or a shared page,
 *      uses router.back() for smooth UX
 *   4. Otherwise uses router.push(fallbackRoute) to ensure predictable nav
 */
export function useSmartBack(fallbackRoute: string) {
    const router = useRouter()
    const pathname = usePathname()
    const hasRegistered = useRef(false)

    // Register current page in the nav stack on mount
    useEffect(() => {
        if (!hasRegistered.current && pathname) {
            pushToNavStack(pathname)
            hasRegistered.current = true
        }
    }, [pathname])

    const goBack = useCallback(() => {
        const previous = peekPreviousInStack()

        if (previous && isValidBackTarget(previous, fallbackRoute)) {
            // The previous page is a valid in-app page in the same area
            popFromNavStack()
            router.back()
        } else {
            // No valid history — use the fallback
            // Replace current entry so back doesn't loop
            router.push(fallbackRoute)
        }
    }, [router, fallbackRoute])

    return { goBack, router }
}

/**
 * Checks whether `previousPath` is a valid back-navigation target.
 * 
 * Rules:
 * - Must be within the /dashboard area
 * - Must not be a cross-role redirect trap (e.g., student going back to /dashboard
 *   which would redirect them again)
 * - Must be a reasonable parent/sibling of the fallback route
 */
function isValidBackTarget(previousPath: string, fallbackRoute: string): boolean {
    // Must be an in-app dashboard route
    if (!previousPath.startsWith('/dashboard')) return false

    // Get the role area from the fallback route
    // e.g., /dashboard/student → 'student', /dashboard/teacher → 'teacher'
    const fallbackSegments = fallbackRoute.split('/')
    const fallbackRoleArea = fallbackSegments[2] || '' // 'student', 'teacher', 'parent', 'manage', etc.

    const previousSegments = previousPath.split('/')
    const previousRoleArea = previousSegments[2] || '' // '' means /dashboard (admin)

    // If fallback is a role-specific dashboard (student/teacher/parent),
    // only allow going back to pages in the same role area or shared pages
    if (['student', 'teacher', 'parent'].includes(fallbackRoleArea)) {
        // Allow same-role pages
        if (previousRoleArea === fallbackRoleArea) return true

        // Allow shared pages that all roles can access
        if (['notifications', 'live', 'mcq', 'resources', 'progress'].includes(previousRoleArea)) return true

        // Allow manage pages (teachers may navigate to admin manage pages)
        if (fallbackRoleArea === 'teacher' && previousRoleArea === 'manage') return true

        // Block cross-role navigation (e.g., student → /dashboard which is admin)
        return false
    }

    // Admin fallback (/dashboard) — allow any dashboard sub-page
    if (fallbackRoute === '/dashboard') {
        return true
    }

    // Admin manage pages — allow any dashboard page
    if (fallbackRoute.startsWith('/dashboard/manage')) {
        return previousPath.startsWith('/dashboard')
    }

    return true
}

// ─── Role-Aware Dashboard Redirect ─────────────────────

/**
 * Redirects user to their role-appropriate dashboard.
 * Use this instead of router.push('/dashboard') in auth checks.
 */
export function redirectToDashboard(router: ReturnType<typeof useRouter>, role: string) {
    router.replace(getDashboardHome(role))
}

/**
 * Redirects to login page
 */
export function redirectToLogin(router: ReturnType<typeof useRouter>) {
    router.push('/login')
}
