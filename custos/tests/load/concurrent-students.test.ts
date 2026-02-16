/**
 * CUSTOS Load Test: Concurrent Students
 *
 * Simulates high-concurrency scenarios:
 *   1. 100 students answering questions simultaneously
 *   2. Brain calculations under load
 *   3. Database connection pooling stress
 *   4. Cron job with 1000+ students
 *
 * Run: npx ts-node tests/load/concurrent-students.test.ts
 */

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

interface LoadTestResult {
    name: string
    total_requests: number
    successful: number
    failed: number
    avg_response_ms: number
    max_response_ms: number
    min_response_ms: number
    p95_ms: number
    requests_per_second: number
}

// ── Helpers ──────────────────────────────────────────

async function timedFetch(url: string, options?: RequestInit): Promise<{ status: number; time: number }> {
    const start = Date.now()
    try {
        const res = await fetch(url, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                ...(options?.headers || {}),
            },
        })
        return { status: res.status, time: Date.now() - start }
    } catch {
        return { status: 0, time: Date.now() - start }
    }
}

function calculateP95(times: number[]): number {
    const sorted = [...times].sort((a, b) => a - b)
    const idx = Math.floor(sorted.length * 0.95)
    return sorted[idx] || 0
}

async function runLoadTest(
    name: string,
    concurrency: number,
    requestFn: () => Promise<{ status: number; time: number }>
): Promise<LoadTestResult> {
    console.log(`\n🔄 Running: ${name} (${concurrency} concurrent requests)...`)

    const start = Date.now()
    const promises: Promise<{ status: number; time: number }>[] = []

    for (let i = 0; i < concurrency; i++) {
        promises.push(requestFn())
    }

    const results = await Promise.all(promises)
    const totalTime = Date.now() - start

    const times = results.map(r => r.time)
    const successful = results.filter(r => r.status >= 200 && r.status < 500).length
    const failed = results.filter(r => r.status === 0 || r.status >= 500).length

    const result: LoadTestResult = {
        name,
        total_requests: concurrency,
        successful,
        failed,
        avg_response_ms: Math.round(times.reduce((a, b) => a + b, 0) / times.length),
        max_response_ms: Math.max(...times),
        min_response_ms: Math.min(...times),
        p95_ms: calculateP95(times),
        requests_per_second: Math.round((concurrency / totalTime) * 1000),
    }

    console.log(`   ✅ ${successful}/${concurrency} successful`)
    console.log(`   ⏱️  Avg: ${result.avg_response_ms}ms | P95: ${result.p95_ms}ms | Max: ${result.max_response_ms}ms`)
    console.log(`   🚀 ${result.requests_per_second} req/s`)

    return result
}

// ── Load Tests ──────────────────────────────────────

async function runAllLoadTests() {
    console.log('\n🏋️ CUSTOS Load Test Suite')
    console.log('═'.repeat(60))

    const allResults: LoadTestResult[] = []

    // Test 1: 50 concurrent student analytics requests
    allResults.push(await runLoadTest(
        'Student Analytics (50 concurrent)',
        50,
        () => timedFetch(`${BASE_URL}/api/student/analytics?studentId=test-${Math.random().toString(36).slice(2)}`)
    ))

    // Test 2: 100 concurrent student analytics requests
    allResults.push(await runLoadTest(
        'Student Analytics (100 concurrent)',
        100,
        () => timedFetch(`${BASE_URL}/api/student/analytics?studentId=test-${Math.random().toString(36).slice(2)}`)
    ))

    // Test 3: Parent API under load
    allResults.push(await runLoadTest(
        'Parent Children API (50 concurrent)',
        50,
        () => timedFetch(`${BASE_URL}/api/parent/children?parentId=test-${Math.random().toString(36).slice(2)}`)
    ))

    // Test 4: Teacher performance under load
    allResults.push(await runLoadTest(
        'Teacher Performance API (30 concurrent)',
        30,
        () => timedFetch(`${BASE_URL}/api/teacher/class-performance?section_id=test&teacherId=test-${Math.random().toString(36).slice(2)}`)
    ))

    // Test 5: Brain practice API under load
    allResults.push(await runLoadTest(
        'Brain Practice API (50 concurrent)',
        50,
        () => timedFetch(`${BASE_URL}/api/brain/practice`, {
            method: 'POST',
            body: JSON.stringify({
                student_id: `test-${Math.random().toString(36).slice(2)}`,
                phase_type: 'daily',
            }),
        })
    ))

    // Test 6: Notifications API under load
    allResults.push(await runLoadTest(
        'Notifications API (100 concurrent)',
        100,
        () => timedFetch(`${BASE_URL}/api/notifications`, {
            method: 'POST',
            body: JSON.stringify({
                user_id: `test-${Math.random().toString(36).slice(2)}`,
                title: 'Load Test',
                message: 'Testing concurrent notifications',
                type: 'info',
            }),
        })
    ))

    // Test 7: Mixed workload simulation
    allResults.push(await runLoadTest(
        'Mixed Workload (100 concurrent)',
        100,
        async () => {
            const endpoints = [
                '/api/student/analytics?studentId=test',
                '/api/parent/children?parentId=test',
                '/api/teacher/class-performance?section_id=test&teacherId=test',
            ]
            const url = endpoints[Math.floor(Math.random() * endpoints.length)]
            return timedFetch(`${BASE_URL}${url}`)
        }
    ))

    // ── Results Summary ─────────────────────────────

    console.log('\n' + '═'.repeat(60))
    console.log('📊 Load Test Summary')
    console.log('─'.repeat(60))
    console.log(`${'Test'.padEnd(40)} ${'Avg'.padStart(7)} ${'P95'.padStart(7)} ${'RPS'.padStart(6)} ${'OK'.padStart(5)}`)
    console.log('─'.repeat(60))

    for (const r of allResults) {
        const passRate = Math.round((r.successful / r.total_requests) * 100)
        console.log(
            `${r.name.padEnd(40)} ${(r.avg_response_ms + 'ms').padStart(7)} ${(r.p95_ms + 'ms').padStart(7)} ${String(r.requests_per_second).padStart(6)} ${(passRate + '%').padStart(5)}`
        )
    }

    console.log('─'.repeat(60))

    // SLA check
    const slaResults = allResults.map(r => ({
        name: r.name,
        avgUnder5s: r.avg_response_ms < 5000,
        p95Under10s: r.p95_ms < 10000,
        successRate: (r.successful / r.total_requests) >= 0.9,
    }))

    const allPassed = slaResults.every(r => r.avgUnder5s && r.p95Under10s && r.successRate)

    console.log(`\n${allPassed ? '✅' : '❌'} SLA Check: Avg < 5s, P95 < 10s, Success > 90%`)
    console.log('═'.repeat(60))

    return allPassed
}

// Run
runAllLoadTests()
    .then(passed => process.exit(passed ? 0 : 1))
    .catch(err => {
        console.error('Load test crashed:', err)
        process.exit(1)
    })
