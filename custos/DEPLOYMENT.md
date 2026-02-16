# 🚀 CUSTOS Deployment Guide

> Deploy CUSTOS School Management System to Vercel + Supabase

---

## Pre-Deployment Checklist

- [ ] All environment variables ready (see `.env.production`)
- [ ] Database schema applied (all SQL files)
- [ ] RLS policies verified active
- [ ] Pilot school onboarded (run `scripts/onboard-school.ts`)
- [ ] Sample data generated (optional: `scripts/generate-sample-data.ts`)
- [ ] All tests passing locally

---

## Step 1: Database Migration

Run these SQL files in order on your Supabase project:

```bash
# In Supabase SQL Editor, run each file:
1. supabase/brain_schema.sql           # Core Brain tables + RLS
2. supabase/parent_student_links.sql   # Parent-child linking
3. supabase/parent_teacher_messaging.sql # Messaging system
4. supabase/parent_portal_rls.sql      # Parent privacy policies
```

Verify:
```sql
SELECT tablename, policyname FROM pg_policies 
WHERE schemaname = 'public' 
ORDER BY tablename;
```

Expected: 15+ RLS policies across tables.

---

## Step 2: Environment Variables (Vercel)

1. Go to **Vercel Dashboard → Your Project → Settings → Environment Variables**
2. Add these variables for **Production** environment:

| Variable | Value | Notes |
|----------|-------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://xxx.supabase.co` | Your Supabase URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJ...` | Public anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJ...` | ⚠️ Secret! Server-only |
| `ANTHROPIC_API_KEY` | `sk-ant-...` | For AI Brain engine |
| `CRON_SECRET` | `random-32-char-string` | Secure cron endpoints |
| `NEXT_PUBLIC_APP_URL` | `https://your-domain.com` | App base URL |
| `RESEND_API_KEY` | `re_...` | Email service (optional) |
| `OPENAI_API_KEY` | `sk-...` | AI chatbot (optional) |

---

## Step 3: Deploy to Vercel

```bash
# Option 1: Git push (auto-deploy)
git add .
git commit -m "feat: parent portal + deployment config"
git push origin main

# Option 2: Vercel CLI
npx vercel --prod
```

---

## Step 4: Verify Cron Jobs

In **Vercel Dashboard → Your Project → Cron**:

| Cron Job | Schedule | Purpose |
|----------|----------|---------|
| `/api/cron/generate-daily-practice` | `30 7 * * 1-6` | Daily MCQs Mon-Sat |
| `/api/cron/generate-weekly-tests` | `30 9 * * 0` | Weekly test on Sundays |

Test manually:
```bash
curl -X GET "https://your-domain.com/api/cron/generate-daily-practice?secret=YOUR_CRON_SECRET"
```

---

## Step 5: DNS Configuration (Custom Domain)

1. Go to **Vercel → Domains**
2. Add your custom domain (e.g., `custos.school.edu.in`)
3. Configure DNS:
   - **A Record**: `76.76.21.21`
   - **CNAME**: `cname.vercel-dns.com`
4. Enable SSL (automatic with Vercel)

---

## Step 6: Post-Deployment Testing

### Quick Smoke Tests
```bash
# Health check
curl https://your-domain.com/api/health

# Student analytics
curl "https://your-domain.com/api/student/analytics?studentId=test"

# Parent children
curl "https://your-domain.com/api/parent/children?parentId=test"
```

### Full Test Suite
```bash
# E2E tests
NEXT_PUBLIC_APP_URL=https://your-domain.com npx ts-node tests/e2e/adaptive-loop.test.ts

# Data integrity
NEXT_PUBLIC_APP_URL=https://your-domain.com npx ts-node tests/integration/data-integrity.test.ts

# Load test
NEXT_PUBLIC_APP_URL=https://your-domain.com npx ts-node tests/load/concurrent-students.test.ts
```

---

## Step 7: Monitoring Setup

### Vercel Built-in
- **Analytics**: Enable in Vercel Dashboard → Analytics
- **Logs**: Monitor in Vercel Dashboard → Logs
- **Error Tracking**: Check Functions tab for errors

### Supabase Monitoring
- **Database**: Dashboard → Database → Monitoring
- **Auth**: Dashboard → Auth → Users
- **RLS**: Periodically audit `pg_policies`

### Key Metrics to Watch
| Metric | Target | Alert If |
|--------|--------|----------|
| API Response Time (avg) | < 2s | > 5s |
| API Response Time (P95) | < 5s | > 10s |
| Daily Practice Completion | > 60% | < 30% |
| Cron Job Success Rate | 100% | Any failure |
| Database Connections | < 50% pool | > 80% pool |

---

## Rollback Procedure

If issues are found post-deploy:

```bash
# Rollback to previous deployment
vercel rollback

# Or redeploy a specific commit
git checkout <last-good-commit>
vercel --prod
```

For database rollback:
- Use Supabase point-in-time recovery (PITR)
- Or run migration down scripts

---

## Security Hardening

- [ ] ⚠️ Remove `.env.production` from Git (it's a template)
- [ ] Verify `SUPABASE_SERVICE_ROLE_KEY` is NOT exposed client-side
- [ ] Verify RLS policies block unauthorized access
- [ ] Run data-integrity tests to confirm no data leaks
- [ ] Enable Supabase rate limiting
- [ ] Configure CORS if using custom domain

---

*Last updated: Phase 5 implementation*
