/**
 * CUSTOS Sample Data Generator
 *
 * Populates a school with demo data for testing:
 *   1. Creates students with realistic names
 *   2. Generates activity history (30 days)
 *   3. Awards achievements based on activity
 *   4. Creates parent accounts and links
 *
 * Usage:
 *   SCHOOL_ID="..." npx ts-node scripts/generate-sample-data.ts
 */

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://rpokptjsbsogyknyivuo.supabase.co',
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
)

// ── Sample Data ────────────────────────────────────

const STUDENT_NAMES = [
    'Arjun Sharma', 'Priya Patel', 'Rahul Kumar', 'Ananya Gupta',
    'Vikram Singh', 'Sneha Reddy', 'Aditya Joshi', 'Kavya Nair',
    'Rohan Mehta', 'Ishita Kapoor', 'Karan Verma', 'Meera Iyer',
    'Dev Malhotra', 'Sara Khan', 'Nikhil Rao', 'Pooja Desai',
    'Aman Chopra', 'Divya Menon', 'Siddharth Bhat', 'Riya Agarwal',
]

const PARENT_NAMES = [
    'Mr. Sharma', 'Mrs. Patel', 'Mr. Kumar', 'Mrs. Gupta',
    'Mr. Singh', 'Mrs. Reddy', 'Mr. Joshi', 'Mrs. Nair',
    'Mr. Mehta', 'Mrs. Kapoor', 'Mr. Verma', 'Mrs. Iyer',
    'Mr. Malhotra', 'Mrs. Khan', 'Mr. Rao', 'Mrs. Desai',
    'Mr. Chopra', 'Mrs. Menon', 'Mr. Bhat', 'Mrs. Agarwal',
]

const ACHIEVEMENT_TEMPLATES = [
    { name: 'First Steps', description: 'Complete your first daily practice', icon: '👣', category: 'milestone', points: 10 },
    { name: 'Week Warrior', description: 'Complete 7 days in a row', icon: '⚔️', category: 'streak', points: 50 },
    { name: 'Sharp Shooter', description: '90% accuracy on daily practice', icon: '🎯', category: 'performance', points: 30 },
    { name: 'Perfect Score', description: '100% accuracy on any assessment', icon: '💯', category: 'performance', points: 100 },
    { name: 'Marathon Mind', description: '30-day streak', icon: '🏃', category: 'streak', points: 200 },
    { name: 'Speed Demon', description: 'Complete daily practice in under 5 minutes', icon: '⚡', category: 'speed', points: 25 },
    { name: 'Knowledge Seeker', description: 'Practice in 5 different subjects', icon: '📚', category: 'diversity', points: 40 },
    { name: 'Rising Star', description: 'Reach 500 activity points', icon: '⭐', category: 'milestone', points: 50 },
]

// ── Generator ──────────────────────────────────────

async function generateSampleData() {
    console.log('\n📊 CUSTOS Sample Data Generator')
    console.log('═'.repeat(50))

    // Get school
    const schoolId = process.env.SCHOOL_ID
    let school: any

    if (schoolId) {
        const { data } = await supabase.from('schools').select().eq('school_id', schoolId).single()
        school = data
    } else {
        // Use the first school
        const { data } = await supabase.from('schools').select().limit(1).single()
        school = data
    }

    if (!school) {
        console.error('❌ No school found. Run onboard-school.ts first.')
        process.exit(1)
    }

    console.log(`🏫 School: ${school.name} (${school.school_id})`)

    // Get classes and sections
    const { data: classes } = await supabase
        .from('classes')
        .select('class_id, name, grade_level')
        .eq('school_id', school.school_id)
        .order('grade_level')

    if (!classes || classes.length === 0) {
        console.error('❌ No classes found. Run onboard-school.ts first.')
        process.exit(1)
    }

    const { data: sections } = await supabase
        .from('sections')
        .select('section_id, name, class_id')
        .eq('school_id', school.school_id)

    if (!sections || sections.length === 0) {
        console.error('❌ No sections found. Run onboard-school.ts first.')
        process.exit(1)
    }

    // ── Step 1: Create Achievements ──
    console.log('\n1️⃣ Creating achievements...')
    for (const ach of ACHIEVEMENT_TEMPLATES) {
        const { error } = await supabase
            .from('achievements')
            .upsert({
                name: ach.name,
                description: ach.description,
                icon: ach.icon,
                category: ach.category,
                points_awarded: ach.points,
                criteria: {},
                school_id: school.school_id,
                is_active: true,
            }, { onConflict: 'name,school_id' })

        if (error) {
            console.log(`   ⚠️ ${ach.name}: ${error.message}`)
        }
    }
    console.log(`   ✅ ${ACHIEVEMENT_TEMPLATES.length} achievements created`)

    // Get achievement IDs
    const { data: achievements } = await supabase
        .from('achievements')
        .select('achievement_id, name')
        .eq('school_id', school.school_id)

    // ── Step 2: Create Students ──
    console.log('\n2️⃣ Creating students...')
    const studentIds: string[] = []
    let studentIndex = 0

    for (const cls of classes) {
        const classSections = sections.filter(s => s.class_id === cls.class_id)
        if (classSections.length === 0) continue

        // 3-5 students per section
        for (const sec of classSections) {
            const count = Math.min(3 + Math.floor(Math.random() * 3), STUDENT_NAMES.length - studentIndex)
            for (let i = 0; i < count && studentIndex < STUDENT_NAMES.length; i++) {
                const name = STUDENT_NAMES[studentIndex]
                const email = `${name.toLowerCase().replace(/\s+/g, '.').replace(/\./g, '.')}@student.custos.in`

                const { data: student, error } = await supabase
                    .from('users')
                    .upsert({
                        email,
                        full_name: name,
                        role: 'student',
                        school_id: school.school_id,
                        class_id: cls.class_id,
                        section_id: sec.section_id,
                        is_active: true,
                    }, { onConflict: 'email' })
                    .select()
                    .single()

                if (error) {
                    console.log(`   ⚠️ ${name}: ${error.message}`)
                } else {
                    studentIds.push(student.user_id)
                }
                studentIndex++
            }
        }
    }
    console.log(`   ✅ ${studentIds.length} students created`)

    // ── Step 3: Generate Activity History ──
    console.log('\n3️⃣ Generating 30-day activity history...')
    const today = new Date()
    let phaseCount = 0

    for (const sid of studentIds) {
        // Random engagement level: high (0.8), medium (0.6), low (0.3)
        const engagement = [0.8, 0.6, 0.3][Math.floor(Math.random() * 3)]
        let streak = 0

        for (let d = 29; d >= 0; d--) {
            const date = new Date(today)
            date.setDate(today.getDate() - d)
            const dateStr = date.toISOString().split('T')[0]

            // Skip weekends with lower probability
            const isWeekend = date.getDay() === 0 || date.getDay() === 6
            const completed = Math.random() < (isWeekend ? engagement * 0.5 : engagement)

            if (completed) {
                streak++
                const accuracy = 50 + Math.floor(Math.random() * 50) // 50-100%
                const timeTaken = 180 + Math.floor(Math.random() * 600) // 3-13 minutes

                const { error } = await supabase
                    .from('assessment_phases')
                    .upsert({
                        student_id: sid,
                        phase_type: 'daily',
                        scheduled_date: dateStr,
                        status: 'completed',
                        total_questions: 10,
                        correct_answers: Math.round(10 * (accuracy / 100)),
                        score_percentage: accuracy,
                        time_taken_seconds: timeTaken,
                        completed_at: new Date(date.getTime() + timeTaken * 1000).toISOString(),
                    }, { onConflict: 'student_id,phase_type,scheduled_date' })

                if (!error) phaseCount++
            } else {
                streak = 0
                const { error } = await supabase
                    .from('assessment_phases')
                    .upsert({
                        student_id: sid,
                        phase_type: 'daily',
                        scheduled_date: dateStr,
                        status: 'missed',
                        total_questions: 10,
                        correct_answers: 0,
                    }, { onConflict: 'student_id,phase_type,scheduled_date' })
            }
        }

        // Update student scores
        const { data: phases } = await supabase
            .from('assessment_phases')
            .select('status')
            .eq('student_id', sid)
            .eq('phase_type', 'daily')
            .eq('status', 'completed')

        const completedCount = phases?.length || 0
        const activityScore = completedCount * 10 + streak * 5

        await supabase
            .from('student_scores')
            .upsert({
                student_id: sid,
                activity_score: activityScore,
                daily_streak: streak,
                longest_streak: Math.max(streak, Math.floor(completedCount * 0.3)),
                weekly_completions: Math.min(completedCount, 7),
                total_attempts: completedCount,
                last_updated: new Date().toISOString(),
            }, { onConflict: 'student_id' })
    }
    console.log(`   ✅ ${phaseCount} assessment phases created`)

    // ── Step 4: Award Achievements ──
    console.log('\n4️⃣ Awarding achievements...')
    let achCount = 0

    if (achievements && achievements.length > 0) {
        for (const sid of studentIds) {
            // Award 1-4 random achievements
            const count = 1 + Math.floor(Math.random() * 4)
            const shuffled = [...achievements].sort(() => Math.random() - 0.5)

            for (let i = 0; i < Math.min(count, shuffled.length); i++) {
                const ach = shuffled[i]
                const daysAgo = Math.floor(Math.random() * 30)
                const earnedAt = new Date()
                earnedAt.setDate(earnedAt.getDate() - daysAgo)

                const { error } = await supabase
                    .from('student_achievements')
                    .upsert({
                        student_id: sid,
                        achievement_id: ach.achievement_id,
                        earned_at: earnedAt.toISOString(),
                    }, { onConflict: 'student_id,achievement_id' })

                if (!error) achCount++
            }
        }
    }
    console.log(`   ✅ ${achCount} achievements awarded`)

    // ── Step 5: Create Parents ──
    console.log('\n5️⃣ Creating parent accounts...')
    let parentCount = 0
    let linkCount = 0

    for (let i = 0; i < Math.min(studentIds.length, PARENT_NAMES.length); i++) {
        const parentName = PARENT_NAMES[i]
        const parentEmail = `${parentName.toLowerCase().replace(/[.\s]+/g, '.')}@parent.custos.in`

        const { data: parent, error: parentError } = await supabase
            .from('users')
            .upsert({
                email: parentEmail,
                full_name: parentName,
                role: 'parent',
                school_id: school.school_id,
                is_active: true,
            }, { onConflict: 'email' })
            .select()
            .single()

        if (parentError) {
            console.log(`   ⚠️ ${parentName}: ${parentError.message}`)
            continue
        }
        parentCount++

        // Link parent to child
        const { error: linkError } = await supabase
            .from('parent_student_links')
            .upsert({
                parent_id: parent.user_id,
                student_id: studentIds[i],
                relationship: 'parent',
                school_id: school.school_id,
                is_primary: true,
            }, { onConflict: 'parent_id,student_id' })

        if (!linkError) linkCount++
    }
    console.log(`   ✅ ${parentCount} parents created, ${linkCount} links established`)

    // ── Summary ──
    console.log('\n' + '═'.repeat(50))
    console.log('✅ Sample data generation complete!')
    console.log(`\n📊 Created:`)
    console.log(`   Students:      ${studentIds.length}`)
    console.log(`   Assessments:   ${phaseCount}`)
    console.log(`   Achievements:  ${achCount}`)
    console.log(`   Parents:       ${parentCount}`)
    console.log(`   Parent Links:  ${linkCount}`)
    console.log('═'.repeat(50))
}

// Run
generateSampleData()
    .then(() => process.exit(0))
    .catch(err => {
        console.error('\n💥 Fatal error:', err)
        process.exit(1)
    })
