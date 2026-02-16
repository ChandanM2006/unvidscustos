/**
 * CUSTOS School Onboarding Script
 *
 * Automates setting up a new school in the system:
 *   1. Creates the school record
 *   2. Creates super admin user
 *   3. Creates academic year
 *   4. Creates initial classes and sections
 *
 * Usage:
 *   npx ts-node scripts/onboard-school.ts
 *
 *   Or with environment variables:
 *   SCHOOL_NAME="Delhi Public School" \
 *   SCHOOL_CODE="DPS001" \
 *   ADMIN_EMAIL="admin@dps.edu.in" \
 *   npx ts-node scripts/onboard-school.ts
 */

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://rpokptjsbsogyknyivuo.supabase.co',
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
)

// ── Configuration ─────────────────────────────────

interface SchoolConfig {
    name: string
    code: string
    address: string
    city: string
    state: string
    boardType: 'CBSE' | 'ICSE' | 'State Board' | 'Other'
    adminEmail: string
    adminName: string
    adminPassword: string
    classes: Array<{
        grade: string
        name: string
        sections: string[]
    }>
    academicYear: {
        name: string
        start: string // YYYY-MM-DD
        end: string   // YYYY-MM-DD
    }
}

// Default configuration (can be overridden via env vars)
const defaultConfig: SchoolConfig = {
    name: process.env.SCHOOL_NAME || 'Delhi Public School',
    code: process.env.SCHOOL_CODE || 'DPS001',
    address: '123 Education Lane',
    city: 'New Delhi',
    state: 'Delhi',
    boardType: 'CBSE',
    adminEmail: process.env.ADMIN_EMAIL || 'admin@dps.edu.in',
    adminName: process.env.ADMIN_NAME || 'School Admin',
    adminPassword: process.env.ADMIN_PASSWORD || 'Admin@DPS2024!',
    classes: [
        { grade: '6', name: 'Class 6', sections: ['A', 'B'] },
        { grade: '7', name: 'Class 7', sections: ['A', 'B'] },
        { grade: '8', name: 'Class 8', sections: ['A', 'B', 'C'] },
        { grade: '9', name: 'Class 9', sections: ['A', 'B', 'C'] },
        { grade: '10', name: 'Class 10', sections: ['A', 'B'] },
    ],
    academicYear: {
        name: '2024-2025',
        start: '2024-04-01',
        end: '2025-03-31',
    },
}

// ── Onboarding Logic ──────────────────────────────

async function onboardSchool(config: SchoolConfig = defaultConfig) {
    console.log('\n🏫 CUSTOS School Onboarding')
    console.log('═'.repeat(50))
    console.log(`📋 School: ${config.name} (${config.code})`)
    console.log(`📧 Admin:  ${config.adminEmail}`)
    console.log(`📅 Year:   ${config.academicYear.name}`)
    console.log('═'.repeat(50))

    try {
        // Step 1: Create school
        console.log('\n1️⃣ Creating school...')
        const { data: school, error: schoolError } = await supabase
            .from('schools')
            .insert({
                name: config.name,
                code: config.code,
                address: config.address,
                city: config.city,
                state: config.state,
                board_type: config.boardType,
                is_active: true,
            })
            .select()
            .single()

        if (schoolError) {
            // Check if school already exists
            if (schoolError.message.includes('duplicate') || schoolError.message.includes('unique')) {
                console.log('   ⚠️ School already exists, fetching...')
                const { data: existing } = await supabase
                    .from('schools')
                    .select()
                    .eq('code', config.code)
                    .single()
                if (!existing) throw new Error('School exists but cannot be fetched')
                console.log(`   ✅ School: ${existing.name} (ID: ${existing.school_id})`)
                return await continueOnboarding(existing.school_id, config)
            }
            throw schoolError
        }

        console.log(`   ✅ School created: ${school.school_id}`)
        return await continueOnboarding(school.school_id, config)

    } catch (err: any) {
        console.error('\n❌ Onboarding failed:', err.message)
        process.exit(1)
    }
}

async function continueOnboarding(schoolId: string, config: SchoolConfig) {

    // Step 2: Create admin user in Auth
    console.log('\n2️⃣ Creating super admin user...')
    let adminUserId: string

    try {
        const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
            email: config.adminEmail,
            password: config.adminPassword,
            email_confirm: true,
        })

        if (authError) {
            if (authError.message.includes('already') || authError.message.includes('exists')) {
                console.log('   ⚠️ Auth user already exists')
                // Try to get existing user
                const { data: { users } } = await supabase.auth.admin.listUsers()
                const existing = users?.find(u => u.email === config.adminEmail)
                adminUserId = existing?.id || 'existing-admin'
            } else {
                throw authError
            }
        } else {
            adminUserId = authUser.user.id
            console.log(`   ✅ Auth user created: ${adminUserId}`)
        }
    } catch (err: any) {
        console.log(`   ⚠️ Auth user creation skipped: ${err.message}`)
        adminUserId = 'placeholder-admin'
    }

    // Create admin in users table
    const { data: adminUser, error: adminError } = await supabase
        .from('users')
        .upsert({
            user_id: adminUserId!,
            email: config.adminEmail,
            full_name: config.adminName,
            role: 'super_admin',
            school_id: schoolId,
            is_active: true,
        }, { onConflict: 'email' })
        .select()
        .single()

    if (adminError) {
        console.log(`   ⚠️ Admin user table entry: ${adminError.message}`)
    } else {
        console.log(`   ✅ Admin user: ${adminUser.full_name}`)
    }

    // Step 3: Create academic year
    console.log('\n3️⃣ Creating academic year...')
    const { data: year, error: yearError } = await supabase
        .from('academic_years')
        .upsert({
            school_id: schoolId,
            year_name: config.academicYear.name,
            start_date: config.academicYear.start,
            end_date: config.academicYear.end,
            is_current: true,
        }, { onConflict: 'school_id,year_name' })
        .select()
        .single()

    if (yearError) {
        console.log(`   ⚠️ Academic year: ${yearError.message}`)
    } else {
        console.log(`   ✅ Academic year: ${year.year_name}`)
    }

    // Step 4: Create classes and sections
    console.log('\n4️⃣ Creating classes and sections...')
    let classCount = 0
    let sectionCount = 0

    for (const cls of config.classes) {
        const { data: classData, error: classError } = await supabase
            .from('classes')
            .upsert({
                name: cls.name,
                school_id: schoolId,
                grade_level: cls.grade,
                academic_year_id: year?.year_id,
            }, { onConflict: 'school_id,name,academic_year_id' })
            .select()
            .single()

        if (classError) {
            console.log(`   ⚠️ ${cls.name}: ${classError.message}`)
            continue
        }
        classCount++

        for (const sec of cls.sections) {
            const { error: secError } = await supabase
                .from('sections')
                .upsert({
                    name: `Section ${sec}`,
                    class_id: classData.class_id,
                    school_id: schoolId,
                }, { onConflict: 'class_id,name' })

            if (secError) {
                console.log(`   ⚠️ ${cls.name} - ${sec}: ${secError.message}`)
            } else {
                sectionCount++
            }
        }
    }
    console.log(`   ✅ Created ${classCount} classes, ${sectionCount} sections`)

    // Summary
    console.log('\n' + '═'.repeat(50))
    console.log('✅ School onboarding complete!')
    console.log(`\n📋 Summary:`)
    console.log(`   School:   ${config.name} (${config.code})`)
    console.log(`   School ID: ${schoolId}`)
    console.log(`   Admin:    ${config.adminEmail}`)
    console.log(`   Year:     ${config.academicYear.name}`)
    console.log(`   Classes:  ${classCount}`)
    console.log(`   Sections: ${sectionCount}`)
    console.log(`\n🔑 Login with:`)
    console.log(`   Email:    ${config.adminEmail}`)
    console.log(`   Password: ${config.adminPassword}`)
    console.log('═'.repeat(50))

    return { schoolId, adminUserId }
}

// ── Run ─────────────────────────────────────────

onboardSchool()
    .then(() => {
        console.log('\n🎉 Done!')
        process.exit(0)
    })
    .catch(err => {
        console.error('\n💥 Fatal error:', err)
        process.exit(1)
    })
