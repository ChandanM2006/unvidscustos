# CUSTOS - Role-Based Access Control Matrix

## User Roles
| Role | Description |
|------|-------------|
| **Super Admin** | School owner/principal - full access to everything |
| **Sub Admin** | Vice-principal/IT admin - almost full access |
| **Teacher** | Teaching staff - manage own classes & subjects |
| **Student** | Enrolled students - view own data, take quizzes |
| **Parent** | Parent/Guardian - view linked children's data |

---

## 🔐 COMPLETE ACCESS MATRIX

### Legend:
- ✅ = Full Access (Create, Read, Update, Delete)
- 👁️ = View Only (Read)
- 🔶 = Limited (Own data only)
- ❌ = No Access

---

## 1. USER MANAGEMENT

| Feature | Super Admin | Sub Admin | Teacher | Student | Parent |
|---------|:-----------:|:---------:|:-------:|:-------:|:------:|
| Create Users | ✅ | ✅ | ❌ | ❌ | ❌ |
| View All Users | ✅ | ✅ | 🔶 (own students) | ❌ | ❌ |
| Edit Users | ✅ | ✅ | ❌ | ❌ | ❌ |
| Delete Users | ✅ | ✅ | ❌ | ❌ | ❌ |
| Reset Password | ✅ | ✅ | ❌ | ❌ | ❌ |
| Bulk Import | ✅ | ✅ | ❌ | ❌ | ❌ |
| View Own Profile | ✅ | ✅ | ✅ | ✅ | ✅ |
| Edit Own Profile | ✅ | ✅ | ✅ | 🔶 | 🔶 |

---

## 2. SCHOOL SETUP

| Feature | Super Admin | Sub Admin | Teacher | Student | Parent |
|---------|:-----------:|:---------:|:-------:|:-------:|:------:|
| School Settings | ✅ | 👁️ | ❌ | ❌ | ❌ |
| School Branding | ✅ | ✅ | ❌ | ❌ | ❌ |
| Academic Years | ✅ | ✅ | ❌ | ❌ | ❌ |

---

## 3. CLASS & SECTION MANAGEMENT

| Feature | Super Admin | Sub Admin | Teacher | Student | Parent |
|---------|:-----------:|:---------:|:-------:|:-------:|:------:|
| Create Classes | ✅ | ✅ | ❌ | ❌ | ❌ |
| Edit Classes | ✅ | ✅ | ❌ | ❌ | ❌ |
| Delete Classes | ✅ | ❌ | ❌ | ❌ | ❌ |
| Create Sections | ✅ | ✅ | ❌ | ❌ | ❌ |
| Assign Students to Class | ✅ | ✅ | ❌ | ❌ | ❌ |
| View All Classes | ✅ | ✅ | 👁️ | 🔶 (own) | 🔶 (children) |

---

## 4. SUBJECT MANAGEMENT

| Feature | Super Admin | Sub Admin | Teacher | Student | Parent |
|---------|:-----------:|:---------:|:-------:|:-------:|:------:|
| Create Subjects | ✅ | ✅ | ❌ | ❌ | ❌ |
| Edit Subjects | ✅ | ✅ | ❌ | ❌ | ❌ |
| Delete Subjects | ✅ | ❌ | ❌ | ❌ | ❌ |
| Assign Teacher to Subject | ✅ | ✅ | ❌ | ❌ | ❌ |
| View Subjects | ✅ | ✅ | 👁️ (assigned) | 👁️ (own class) | 👁️ (children) |

---

## 5. TIMETABLE

| Feature | Super Admin | Sub Admin | Teacher | Student | Parent |
|---------|:-----------:|:---------:|:-------:|:-------:|:------:|
| Configure Time Slots | ✅ | ✅ | ❌ | ❌ | ❌ |
| Create/Edit Timetable | ✅ | ✅ | ❌ | ❌ | ❌ |
| View All Timetables | ✅ | ✅ | ❌ | ❌ | ❌ |
| View Own Timetable | ✅ | ✅ | 👁️ | 👁️ | 👁️ (children) |

---

## 6. ATTENDANCE

| Feature | Super Admin | Sub Admin | Teacher | Student | Parent |
|---------|:-----------:|:---------:|:-------:|:-------:|:------:|
| Mark Attendance | ✅ | ✅ | 🔶 (own classes) | ❌ | ❌ |
| Edit Attendance | ✅ | ✅ | 🔶 (same day) | ❌ | ❌ |
| View All Attendance | ✅ | ✅ | 🔶 (own classes) | ❌ | ❌ |
| View Own Attendance | ✅ | ✅ | ✅ | 👁️ | 👁️ (children) |
| Attendance Reports | ✅ | ✅ | 🔶 | ❌ | ❌ |

---

## 7. SYLLABUS / CURRICULUM

| Feature | Super Admin | Sub Admin | Teacher | Student | Parent |
|---------|:-----------:|:---------:|:-------:|:-------:|:------:|
| Upload Syllabus | ✅ | ✅ | 🔶 (own subjects) | ❌ | ❌ |
| Delete Syllabus | ✅ | ✅ | 🔶 (own) | ❌ | ❌ |
| View Syllabus | ✅ | ✅ | 👁️ | 👁️ (own class) | 👁️ (children) |
| AI Analysis | ✅ | ✅ | ✅ | 👁️ | ❌ |

---

## 8. MCQ / QUIZZES

| Feature | Super Admin | Sub Admin | Teacher | Student | Parent |
|---------|:-----------:|:---------:|:-------:|:-------:|:------:|
| Create MCQs | ✅ | ✅ | 🔶 (own subjects) | ❌ | ❌ |
| Edit/Delete MCQs | ✅ | ✅ | 🔶 (own) | ❌ | ❌ |
| Take Quizzes | ❌ | ❌ | ❌ | ✅ | ❌ |
| View Own Results | ✅ | ✅ | ✅ | 👁️ | 👁️ (children) |
| View All Results | ✅ | ✅ | 🔶 (own students) | ❌ | ❌ |

---

## 9. STUDENT PROMOTION

| Feature | Super Admin | Sub Admin | Teacher | Student | Parent |
|---------|:-----------:|:---------:|:-------:|:-------:|:------:|
| Execute Promotion | ✅ | ✅ | ❌ | ❌ | ❌ |
| View Promotion History | ✅ | ✅ | 👁️ | 👁️ (own) | 👁️ (children) |

---

## 10. REPORT CARDS / GRADES

| Feature | Super Admin | Sub Admin | Teacher | Student | Parent |
|---------|:-----------:|:---------:|:-------:|:-------:|:------:|
| Create Report Cards | ✅ | ✅ | ❌ | ❌ | ❌ |
| Enter Grades | ✅ | ✅ | 🔶 (own subjects) | ❌ | ❌ |
| View All Report Cards | ✅ | ✅ | 🔶 | ❌ | ❌ |
| View Own Report Card | ✅ | ✅ | ✅ | 👁️ | 👁️ (children) |
| Download Report Card | ✅ | ✅ | ✅ | ✅ | ✅ |

---

## 11. NOTIFICATIONS

| Feature | Super Admin | Sub Admin | Teacher | Student | Parent |
|---------|:-----------:|:---------:|:-------:|:-------:|:------:|
| Send School-wide | ✅ | ✅ | ❌ | ❌ | ❌ |
| Send to Classes | ✅ | ✅ | 🔶 (own classes) | ❌ | ❌ |
| Send to Individual | ✅ | ✅ | 🔶 | ❌ | ❌ |
| View Notifications | ✅ | ✅ | 👁️ | 👁️ | 👁️ |

---

## 12. LESSON PLANS (FUTURE)

| Feature | Super Admin | Sub Admin | Teacher | Student | Parent |
|---------|:-----------:|:---------:|:-------:|:-------:|:------:|
| Create Lesson Plans | ✅ | ✅ | 🔶 (own subjects) | ❌ | ❌ |
| View All Plans | ✅ | ✅ | 🔶 | ❌ | ❌ |
| Approve Plans | ✅ | ✅ | ❌ | ❌ | ❌ |

---

## 13. HOMEWORK / ASSIGNMENTS (FUTURE)

| Feature | Super Admin | Sub Admin | Teacher | Student | Parent |
|---------|:-----------:|:---------:|:-------:|:-------:|:------:|
| Create Assignment | ✅ | ✅ | 🔶 (own subjects) | ❌ | ❌ |
| Submit Assignment | ❌ | ❌ | ❌ | ✅ | ❌ |
| Grade Assignment | ✅ | ✅ | 🔶 | ❌ | ❌ |
| View Assignments | ✅ | ✅ | 🔶 | 👁️ (own) | 👁️ (children) |

---

## 14. LEAVE MANAGEMENT (FUTURE)

| Feature | Super Admin | Sub Admin | Teacher | Student | Parent |
|---------|:-----------:|:---------:|:-------:|:-------:|:------:|
| Apply Leave (Teacher) | ❌ | ❌ | ✅ | ❌ | ❌ |
| Apply Leave (Student) | ❌ | ❌ | ❌ | ✅ | ✅ |
| Approve Leave | ✅ | ✅ | ❌ | ❌ | ❌ |
| View Leave History | ✅ | ✅ | 🔶 (own) | 🔶 (own) | 🔶 (children) |

---

## 15. FEE MANAGEMENT (FUTURE)

| Feature | Super Admin | Sub Admin | Teacher | Student | Parent |
|---------|:-----------:|:---------:|:-------:|:-------:|:------:|
| Create Fee Structure | ✅ | 🔶 | ❌ | ❌ | ❌ |
| Record Payment | ✅ | ✅ | ❌ | ❌ | ❌ |
| View All Fees | ✅ | ✅ | ❌ | ❌ | ❌ |
| View Own Fees | ✅ | ✅ | ❌ | 👁️ | 👁️ (children) |
| Pay Fees Online | ❌ | ❌ | ❌ | ❌ | ✅ |

---

## 16. MESSAGING (FUTURE)

| Feature | Super Admin | Sub Admin | Teacher | Student | Parent |
|---------|:-----------:|:---------:|:-------:|:-------:|:------:|
| Message Anyone | ✅ | ✅ | ❌ | ❌ | ❌ |
| Teacher ↔ Parent | ✅ | ✅ | ✅ | ❌ | ✅ |
| Teacher ↔ Student | ✅ | ✅ | ✅ | ✅ | ❌ |
| View All Messages | ✅ | ❌ | ❌ | ❌ | ❌ |

---

## 17. AI DOUBT SOLVER

| Feature | Super Admin | Sub Admin | Teacher | Student | Parent |
|---------|:-----------:|:---------:|:-------:|:-------:|:------:|
| Ask Questions | ✅ | ✅ | ✅ | ✅ | ❌ |
| View AI Analytics | ✅ | ✅ | 🔶 | ❌ | ❌ |

---

## 🔒 NAVIGATION ACCESS

### Dashboard Access
| Dashboard | Super Admin | Sub Admin | Teacher | Student | Parent |
|-----------|:-----------:|:---------:|:-------:|:-------:|:------:|
| `/dashboard` (Admin) | ✅ | ✅ | ❌ | ❌ | ❌ |
| `/dashboard/teacher` | ❌ | ❌ | ✅ | ❌ | ❌ |
| `/dashboard/student` | ❌ | ❌ | ❌ | ✅ | ❌ |
| `/dashboard/parent` | ❌ | ❌ | ❌ | ❌ | ✅ |

### Management Pages Access
| Page | Super Admin | Sub Admin | Teacher | Student | Parent |
|------|:-----------:|:---------:|:-------:|:-------:|:------:|
| `/dashboard/manage` | ✅ | ✅ | ❌ | ❌ | ❌ |
| `/dashboard/manage/users` | ✅ | ✅ | ❌ | ❌ | ❌ |
| `/dashboard/manage/classes` | ✅ | ✅ | ❌ | ❌ | ❌ |
| `/dashboard/manage/sections` | ✅ | ✅ | ❌ | ❌ | ❌ |
| `/dashboard/manage/subjects` | ✅ | ✅ | ❌ | ❌ | ❌ |
| `/dashboard/manage/timetable` | ✅ | ✅ | ❌ | ❌ | ❌ |
| `/dashboard/manage/timetable/settings` | ✅ | ✅ | ❌ | ❌ | ❌ |
| `/dashboard/manage/syllabus` | ✅ | ✅ | ✅ | ❌ | ❌ |
| `/dashboard/manage/topics` | ✅ | ✅ | ✅ | ❌ | ❌ |
| `/dashboard/manage/promotions` | ✅ | ✅ | ❌ | ❌ | ❌ |
| `/dashboard/manage/academic-years` | ✅ | ✅ | ❌ | ❌ | ❌ |
| `/dashboard/manage/attendance` | ✅ | ✅ | ❌ | ❌ | ❌ |

---

## 📋 IMPLEMENTATION STATUS

| Feature | Role Check Implemented? |
|---------|:----------------------:|
| Timetable Management | ✅ |
| Timetable Settings | ✅ |
| Syllabus Upload | ✅ |
| Student Dashboard | ✅ |
| Teacher Dashboard | ✅ |
| Parent Dashboard | ✅ |
| User Management | ✅ |
| Class Management | ✅ |
| Section Management | ✅ |
| Subject Management | ✅ |
| Promotions | ✅ |
| Academic Years | ✅ |
| Topics/MCQ | ✅ |
| Lesson Plans | ✅ |
| Notifications | ✅ (isStaff check built-in) |
| Report Cards | ✅ |
| Parent-Student Linking | ✅ NEW |
| Parent-Teacher Messaging | ✅ NEW |

---

## ✅ COMPLETED FEATURES

1. **Role Checks on ALL Admin Pages**
   - Classes, Sections, Subjects, Timetable, Promotions, Academic Years
   - Topics/MCQ, Lesson Plans, Report Cards
   - Notifications (with isStaff conditional features)

2. **Parent-Student Linking UI** (`/dashboard/manage/parent-links`)
   - Admin can view all parents and their linked children
   - Link/unlink students from parent accounts
   - Search parents by name or email

3. **Parent-Teacher Messaging** (`/dashboard/parent/messages`)
   - Parents can message teachers about specific children
   - Conversation history with read receipts
   - Clear child context in every message

4. **Teacher Messaging** (`/dashboard/teacher/messages`)
   - Teachers see which parent AND which student the message is about
   - Respond to parent inquiries
   - Unread message count

5. **User Invitation System** ✨ NEW
   - `/dashboard/manage/users/add` - Add user with parent fields for students
   - `/dashboard/manage/users/invitations` - View & manage pending invitations
   - `/join?token=xxx` - Self-registration page for invited users
   - Auto-link parents to students when both register

---

## 🗄️ NEW DATABASE TABLES REQUIRED

Run these SQL files in Supabase SQL Editor:

1. `supabase/parent_teacher_messaging.sql`:
   - `parent_teacher_messages` table

2. `supabase/user_invitations.sql` ✨ NEW:
   - `user_invitations` table for pending registrations
   - OTP verification support
   - Parent info on student invitations

3. `supabase/fix_role_constraint.sql`:
   - Adds 'parent' to allowed roles
