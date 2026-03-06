# 🧠 CUSTOS BRAIN — Adaptive Learning Intelligence

> The Brain is not a single feature — it is the **central nervous system** that connects
> every part of CUSTOS: timetable, lesson plans, assessments, study materials, doubts,
> analytics, grading, and student profiles. Every data point flows through it.

---

## 🔁 The Core Loop: 3-Phase Adaptive Assessment

```
┌─────────────────────────────────────────────────────────────────┐
│                     TIMETABLE + LESSON PLAN                     │
│         (auto-scheduled, follows school calendar)               │
│  Subject → Lesson → Topics → Sub-topics (each has unique IDs)  │
└─────────────────┬───────────────────────────────────────────────┘
                  │ Topic taught today
                  ▼
┌─────────────────────────────────────────────────────────────────┐
│  PHASE 1: DAILY (MCQs on mobile, evening after class)          │
│                                                                 │
│  • Covers the topic(s) taught in class THAT DAY                │
│  • 10 adaptive MCQs on student's phone                         │
│  • 60% questions from WEAK sub-topics (based on past data)     │
│  • 40% questions from STRONG sub-topics (reinforcement)        │
│  • Data collected: accuracy, time per question, weakness score │
│  • Points awarded to Activity Score (visible, motivational)    │
└─────────────────┬───────────────────────────────────────────────┘
                  │ After 5-6 daily phases complete a week
                  ▼
┌─────────────────────────────────────────────────────────────────┐
│  PHASE 2: WEEKLY (Paper test in class, every week)             │
│                                                                 │
│  • Covers ALL topics from the daily phases of that week        │
│  • 20 MCQs, timed — taken in class under teacher supervision   │
│  • 60% from the student's WEAKEST topics of the week           │
│  • 40% from topics they scored well on                         │
│  • Teacher monitors live via Brain dashboard                   │
│  • Data feeds back into weakness recalculation                 │
└─────────────────┬───────────────────────────────────────────────┘
                  │ After all weekly phases of a lesson/chapter
                  ▼
┌─────────────────────────────────────────────────────────────────┐
│  PHASE 3: LESSON-WISE (Comprehensive test, end of chapter)     │
│                                                                 │
│  • Covers ALL topics from the weekly phases of the chapter     │
│  • 30 MCQs, timed (45 min) — taken in class                   │
│  • 60% from student's weakest topics across the whole lesson   │
│  • 40% from strong topics                                      │
│  • Final mastery evaluation for the lesson                     │
│  • Data summarized for report cards & parent view              │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📊 The 60/40 Algorithm

Every assessment phase uses the **60/40 split rule**:

```
Total Questions = 10 (daily) | 20 (weekly) | 30 (lesson)

Weak Questions  = ceil(total × 0.6)  →  prioritized by weakness_score
Strong Questions = floor(total × 0.4) →  random from mastered topics

weakness_score = f(accuracy, time, recency)
  = (100 - accuracy%) × 0.4    ─ How often they get it wrong
  + avg_time_penalty  × 0.3    ─ How slow they are
  + recency_decay     × 0.3    ─ How recently they practiced

  weakness >= 50 → WEAK topic
  weakness <  50 → STRONG topic
```

This ensures:
- Students **practice what they struggle with** (targeted remediation)
- Students **don't forget what they know** (spaced reinforcement)
- The system gets **smarter over time** (more data = better targeting)

---

## 🎭 Dual Grading System (2-Face Scoring)

### Performance Score (HIDDEN — for analysis only)
```
┌─────────────────────────────────────────────────┐
│  PERFORMANCE SCORE = f(accuracy across topics)  │
│                                                 │
│  • Calculated from brain data (MCQ results)     │
│  • Used for: analytics, teacher insights,       │
│    weakness detection, class comparisons         │
│                                                 │
│  VISIBILITY HIERARCHY:                          │
│  ┌───────────┬────────┬──────────┬────────────┐ │
│  │           │Student │ Teacher  │   Admin    │ │
│  ├───────────┼────────┼──────────┼────────────┤ │
│  │ Student's │   ❌   │   ✅     │    ✅      │ │
│  │ score     │        │ (own     │ (all)      │ │
│  │           │        │ students)│            │ │
│  ├───────────┼────────┼──────────┼────────────┤ │
│  │ Teacher's │   ❌   │   ❌     │    ✅      │ │
│  │ score*    │        │          │            │ │
│  └───────────┴────────┴──────────┴────────────┘ │
│                                                 │
│  * Teacher's score is derived from their        │
│    students' aggregate performance              │
│                                                 │
│  WHY HIDDEN: Avoids harmful comparisons between │
│  students. Teacher doesn't feel judged by peers.│
└─────────────────────────────────────────────────┘
```

### Activity Score (VISIBLE — for motivation)
```
┌─────────────────────────────────────────────────┐
│  ACTIVITY SCORE = sum of engagement points      │
│                                                 │
│  • daily_complete:    +25 points                │
│  • weekly_complete:   +50 points                │
│  • lesson_complete:   +75 points                │
│  • streak_increment:  +10 points                │
│  • doubt_asked:       +5 points                 │
│  • achievement_earn:  variable                  │
│                                                 │
│  + Streaks (consecutive days practicing)        │
│  + Badges (achievements earned)                 │
│  + Weekly completions count                     │
│                                                 │
│  VISIBLE TO: self, peers (leaderboard),         │
│  parents, teachers, admins                      │
│                                                 │
│  WHY VISIBLE: Drives healthy competition based  │
│  on EFFORT, not intelligence. A struggling      │
│  student who practices daily scores higher than │
│  a gifted student who doesn't engage.           │
└─────────────────────────────────────────────────┘
```

---

## 🗺 Content Hierarchy (unique IDs at every level)

```
School
 └─ Subjects (subject_id)          e.g. Mathematics
     └─ Syllabus Documents         e.g. "Number Systems" (Grade 9)
         └─ Lessons/Chapters       (document_id)
             └─ Topics             (topic_id)    e.g. "Irrational Numbers"
                 └─ Sub-topics     (sub-topic within topic_content JSONB)

Every MCQ question is tagged with topic_id.
Every student's weakness is tracked per topic_id.
This allows granular analysis: "Student X is weak at
'Operations on Real Numbers' but strong at 'Exponents'"
```

---

## 🔗 How Everything Connects

```
                        ┌──────────────┐
                        │  TIMETABLE   │ ← School admin configures
                        │  (schedule)  │
                        └──────┬───────┘
                               │ drives
                        ┌──────▼───────┐
                        │ LESSON PLAN  │ ← AI generates from syllabus
                        │ (ai_schedule)│    + teacher holidays config
                        └──────┬───────┘
                               │ maps topic → date
                        ┌──────▼───────────────┐
                        │ DAILY TOPIC SCHEDULE  │ ← "This topic was covered
                        │ (daily_topic_schedule)│    in class today"
                        └──────┬───────────────┘
                               │ triggers
                  ┌────────────▼────────────────┐
                  │    🧠  B R A I N  E N G I N E    │
                  │                              │
                  │  1. Calculate weakness per    │
                  │     student per topic         │
                  │  2. Generate 60/40 MCQ set    │
                  │  3. Assign assessment phase   │
                  │  4. Collect answers           │
                  │  5. Update weaknesses         │
                  │  6. Update dual scores        │
                  │  7. Award achievements        │
                  └──┬────────┬────────┬─────────┘
                     │        │        │
          ┌──────────▼──┐  ┌──▼─────┐  ┌▼──────────────┐
          │   STUDENT   │  │TEACHER │  │    ADMIN      │
          │   VIEWS     │  │ VIEWS  │  │    VIEWS      │
          ├─────────────┤  ├────────┤  ├───────────────┤
          │ • Practice  │  │ • Brain│  │ • School-wide │
          │   (daily,   │  │   dash │  │   analytics   │
          │   weekly,   │  │ • Class│  │ • Teacher     │
          │   lesson)   │  │   perf │  │   performance │
          │ • Activity  │  │ • Per- │  │ • All students│
          │   score     │  │  student│  │   all classes │
          │ • Streak +  │  │  detail│  │ • Performance │
          │   badges    │  │ • Doubts│  │   rankings    │
          │ • AI Tutor  │  │   inbox│  │ • Reports     │
          │ • Doubts    │  │ • Study│  └───────────────┘
          │ • Study     │  │  mats  │
          │   materials │  │  review│
          └─────────────┘  └────────┘
```

---

## 📚 Study Materials (AI-Generated, Teacher-Approved)

For each topic, the Brain generates 3 types of material:

| Type | Purpose | Content |
|------|---------|---------|
| **Quick Notes** | Fast revision before tests | Bullet points, key formulas, mnemonics |
| **Practice Questions** | Self-assessment | Worked examples with step-by-step solutions |
| **Detailed Notes** | Deep understanding | Full explanations, diagrams, real-world applications |

**Flow:**
1. AI generates materials from syllabus content
2. Teacher reviews & can suggest edits
3. Approved materials become available to students
4. Brain tracks which materials each student accessed (data point!)

---

## 💬 Personal AI Chatbot (Doubt System)

```
Student asks doubt → AI answers immediately
                   ↓
        Topic is tagged (topic_id)
                   ↓
        Doubt stored in student_doubts table
                   ↓
        If student asks > N doubts on same topic:
           → Flag to teacher automatically
           → Teacher gets notification
           → Teacher can respond with human answer
                   ↓
        All doubt data feeds into Brain:
           → High doubt count on topic = likely weak topic
           → Brain may increase that topic's weight in next 60/40 split
```

---

## 📈 Data Flow Summary

Every interaction creates data that feeds the Brain:

| Source | Data Collected | Used For |
|--------|---------------|----------|
| Daily MCQs | Accuracy, time, topic weakness | 60/40 question selection |
| Weekly Tests | Comprehensive topic mastery | Weekly performance trends |
| Lesson Tests | Chapter-level understanding | Report cards, parent view |
| Doubts | Topics students struggle with | Weakness confirmation |
| Study Materials | What students access/skip | Engagement tracking |
| Attendance | Physical presence | Correlation with performance |
| Timetable | What was taught when | Auto-scheduling daily MCQs |
| Lesson Plans | Topic sequence + timeline | Brain knows what's coming next |

---

## 🗄 Database Tables (Brain Schema)

| Table | Purpose |
|-------|---------|
| `student_topic_performance` | Per-student, per-topic weakness scores (THE BRAIN) |
| `assessment_phases` | Each MCQ session (daily/weekly/lesson) with 60/40 composition |
| `student_scores` | Dual grading: hidden performance + visible activity |
| `student_doubts` | AI chatbot Q&A with teacher escalation |
| `daily_topic_schedule` | Links timetable → topics → daily MCQ trigger |
| `achievements` | Master list of earnable badges |
| `student_achievements` | Which students earned which badges |
| `lesson_topics` | Topic hierarchy with unique IDs |
| `student_activity_scores` | Per-session activity records |

---

## 🏗 Implementation Status

| Component | Status | Location |
|-----------|--------|----------|
| Brain types | ✅ Done | `lib/types/brain.ts` |
| Brain engine (60/40) | ✅ Done | `lib/analytics/brainEngine.ts` |
| Brain schema + RLS | ✅ Done | `supabase/brain_schema.sql` |
| Practice API (GET/POST/PUT) | ✅ Done | `app/api/brain/practice/route.ts` |
| Activity API | ✅ Done | `app/api/brain/activity/route.ts` |
| Student Practice Page | ✅ Done | `app/dashboard/student/practice/page.tsx` |
| Teacher Brain Dashboard | ✅ Done | `app/dashboard/teacher/brain/page.tsx` |
| AI Tutor (student chatbot) | ✅ Done | `app/dashboard/student/tutor/page.tsx` |
| Student Doubts (teacher view) | ✅ Done | `app/dashboard/teacher/doubts/page.tsx` |
| Study Materials (resources) | ✅ Done | `app/dashboard/manage/topics/[id]/resources/` |
| Daily auto-schedule trigger | 🔄 Pending | Cron job to mark daily topics |
| Teacher material approvals | 🔄 Pending | Review workflow for AI content |
| Admin performance analytics | 🔄 Pending | School-wide Brain dashboard |
| Teacher performance scoring | 🔄 Pending | Aggregate of student performance |

---

## 🎯 Key Design Principles

1. **Every subject → lesson → topic → sub-topic has a unique ID**
   - Enables granular tracking down to the smallest concept

2. **60/40 is non-negotiable**
   - The split ensures both remediation AND retention

3. **Performance scores are NEVER shown to students**
   - Prevents anxiety, comparisons, and gaming the system
   - Teachers use it for targeted intervention

4. **Activity scores drive engagement**
   - Rewards effort, not talent
   - A struggling student who practices daily outranks a gifted student who doesn't

5. **The Brain gets smarter over time**
   - More data → better weakness detection → more targeted questions
   - The loop is self-reinforcing

6. **Everything is connected**
   - Timetable drives lesson plans drives daily practice drives analytics
   - No feature exists in isolation
