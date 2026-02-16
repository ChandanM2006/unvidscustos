# 🏫 CUSTOS Pilot School Setup Checklist

> Complete guide for deploying CUSTOS to a new school.
> Work through each section sequentially. Check off items as completed.

---

## 🔧 Phase 1: Pre-Launch Admin Tasks

### Database Setup
- [ ] Run `supabase/brain_schema.sql` to create Brain tables
- [ ] Run `supabase/parent_student_links.sql` to create parent link tables
- [ ] Run `supabase/parent_teacher_messaging.sql` to create messaging tables
- [ ] Run `supabase/parent_portal_rls.sql` to create parent RLS policies
- [ ] Verify all RLS policies are active: `SELECT * FROM pg_policies;`

### School Onboarding
- [ ] Set env vars: `SCHOOL_NAME`, `SCHOOL_CODE`, `ADMIN_EMAIL`
- [ ] Run: `npx ts-node scripts/onboard-school.ts`
- [ ] Verify school created in Supabase dashboard
- [ ] Verify super admin can log in at `/login`
- [ ] Note down the School ID for later use

---

## 👥 Phase 2: User Creation

### Admin Users
- [ ] Create super admin account (done by onboarding script)
- [ ] Create sub-admin accounts via Admin Panel → Users
- [ ] Assign sub-admins to relevant sections

### Teacher Users
- [ ] Create teacher accounts via Admin Panel → Users
- [ ] Assign teachers to classes and sections
- [ ] Verify teachers can access `/dashboard/teacher`
- [ ] Verify teachers can view Performance page

### Student Users
- [ ] Import student list via CSV upload (Admin Panel → Import)
- [ ] Or create students manually via Admin Panel → Users
- [ ] Assign students to correct classes and sections
- [ ] Set roll numbers if applicable

### Parent Users
- [ ] Create parent accounts via Admin Panel → Users
- [ ] Link parents to children via Admin Panel → Manage Parents
- [ ] Or use API: `POST /api/admin/link-parent`
- [ ] Verify parents can see children on `/dashboard/parent`

---

## ⚙️ Phase 3: System Configuration

### Curriculum Setup
- [ ] Add subjects for each class (Admin Panel → Subjects)
- [ ] Add chapters per subject
- [ ] Add lesson topics per chapter
- [ ] Upload/create MCQ question banks per topic
- [ ] Verify topic count: minimum 10 topics per subject

### Brain Engine Configuration
- [ ] Verify `60/40` weak/strong split is configured
- [ ] Set daily practice question count (default: 10)
- [ ] Set weekly test question count (default: 20)
- [ ] Configure assessment timing expectations

### Achievement Setup
- [ ] Run sample data generator OR manually create achievements
- [ ] Verify achievements display on student dashboard
- [ ] Test achievement criteria triggers

---

## 🧪 Phase 4: Initial Testing

### Functional Tests
- [ ] Student can complete daily practice
- [ ] Brain engine calculates weakness scores correctly
- [ ] Teacher can view class performance
- [ ] Teacher can see individual student performance
- [ ] Parent can only see activity (NOT performance scores)
- [ ] Parent cannot access `student_topic_performance` data
- [ ] Admin can link/unlink parents

### Cron Job Tests
- [ ] Manually trigger daily practice generation: `GET /api/cron/generate-daily-practice?secret=CRON_SECRET`
- [ ] Verify practice generated for all active students
- [ ] Manually trigger weekly test: `GET /api/cron/generate-weekly-tests?secret=CRON_SECRET`
- [ ] Verify weekly test generated correctly

### Data Privacy Tests
- [ ] Log in as student → confirm NO performance rank visible
- [ ] Log in as parent → confirm NO accuracy/scores visible
- [ ] Log in as teacher → confirm performance data IS visible
- [ ] Run: `npx ts-node tests/integration/data-integrity.test.ts`

### Load Tests
- [ ] Run: `npx ts-node tests/load/concurrent-students.test.ts`
- [ ] Verify avg response < 5s, P95 < 10s
- [ ] Check Supabase connection pool limits

---

## 📋 Phase 5: Training

### Admin Training
- [ ] Walk through Admin Panel: Users, Classes, Subjects
- [ ] Demonstrate student creation and import
- [ ] Demonstrate parent linking workflow
- [ ] Show how to view system monitoring

### Teacher Training
- [ ] Walk through Teacher Dashboard
- [ ] Show Performance page: filters, sorting, search
- [ ] Demonstrate bulk messaging
- [ ] Show individual student view
- [ ] Explain Brain engine: 60/40 split, weakness tracking
- [ ] Practice using "Schedule Remedial" and "Assign Practice"

### Parent Orientation
- [ ] Explain what parents CAN see (activity metrics)
- [ ] Explain what parents CANNOT see (performance details)
- [ ] Walk through Parent Dashboard
- [ ] Show how to message teachers
- [ ] Share login credentials

### Student Orientation
- [ ] Walk through Student Dashboard
- [ ] Show daily practice flow
- [ ] Explain streaks and achievements
- [ ] Demonstrate AI chatbot usage
- [ ] Emphasize: practice daily for best results!

---

## 📊 Phase 6: Monitoring & Feedback

### Week 1 Monitoring
- [ ] Check daily practice completion rates
- [ ] Verify cron jobs running (Vercel dashboard)
- [ ] Monitor error logs in Vercel
- [ ] Check database connection usage
- [ ] Review student engagement metrics

### Week 2 Monitoring
- [ ] Review Brain engine weakness calculations
- [ ] Check achievement distribution
- [ ] Collect teacher feedback
- [ ] Collect parent feedback
- [ ] Address any data access concerns

### Month 1 Review
- [ ] Aggregate student activity statistics
- [ ] Present findings to school administration
- [ ] Document any issues/bugs found
- [ ] Plan improvements for next iteration
- [ ] Decide on expanded rollout

---

## 🚨 Emergency Contacts

| Issue | Contact | Action |
|-------|---------|--------|
| System down | DevOps team | Check Vercel status, Supabase status |
| Data breach concern | Security lead | Immediately restrict access, audit logs |
| Parent sees performance data | Backend team | Check RLS policies, audit API responses |
| Cron jobs not running | DevOps team | Check Vercel cron logs, verify CRON_SECRET |
| Database overload | Backend team | Check connection pool, optimize queries |

---

## 📁 Key Files Reference

| File | Purpose |
|------|---------|
| `scripts/onboard-school.ts` | Automate school setup |
| `scripts/generate-sample-data.ts` | Generate test data |
| `supabase/brain_schema.sql` | Brain tables + RLS |
| `supabase/parent_portal_rls.sql` | Parent privacy policies |
| `tests/e2e/adaptive-loop.test.ts` | E2E test suite |
| `tests/integration/data-integrity.test.ts` | Privacy tests |
| `tests/load/concurrent-students.test.ts` | Load tests |
| `vercel.json` | Deployment + cron config |
| `DEPLOYMENT.md` | Deployment guide |

---

*Last updated: Phase 5 implementation*
