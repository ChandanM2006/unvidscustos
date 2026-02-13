# 🧪 **CUSTOS - COMPLETE ONBOARDING TEST GUIDE**

**Date:** January 20, 2026  
**Purpose:** Test the complete onboarding flow from Platform Owner to End Users

---

## 🎯 **COMPLETE TEST FLOW**

### **Step 1: Platform Owner Creates School**

1. **Go to:** `http://localhost:3000/platform`
2. **Click:** "Manage Schools" button
3. **Click:** "Create New School"
4. **Fill in:**
   - School Name: `Demo School`
   - Address: `123 Test Street`
   - Admin Name: `John Admin`
   - Admin Email: `admin@demo.school`
   - Password: Click "Generate" or enter your own
5. **Click:** "Create School"
6. **Save credentials** that appear on screen!

---

### **Step 2: Super Admin Logs In**

1. **Sign out** from current session (if any)
2. **Go to:** `http://localhost:3000/login`
3. **Enter:** The credentials you saved from Step 1
4. **You should see:** Dashboard with school name

---

### **Step 3: Set Up School Structure**

#### **3.1 Create Academic Year**
1. **Go to:** Manage → Academic Years
2. **Click:** "Add Academic Year"
3. **Enter:** 
   - Name: `2025-2026`
   - Check "Is Current"
4. **Save**

#### **3.2 Create Classes**
1. **Go to:** Manage → Classes
2. **Create:** 
   - Class 1 (Grade 1)
   - Class 2 (Grade 2)
   - Class 10 (Grade 10)

#### **3.3 Create Sections**
1. **Go to:** Manage → Sections
2. **Create for each class:**
   - Section A
   - Section B

#### **3.4 Create Subjects**
1. **Go to:** Manage → Subjects
2. **Create:**
   - Mathematics (for Class 10)
   - Science (for Class 10)
   - English (for all)

---

### **Step 4: Add Users**

#### **4.1 Add Individual Users**
1. **Go to:** Manage → Users
2. **Click:** "Add User"
3. **Create a Teacher:**
   - Name: `Ms. Teacher`
   - Email: `teacher@demo.school`
   - Password: `password123`
   - Role: `Teacher`
   - Class: `Class 10`
4. **Create Students:**
   - Same process with Role: `Student`

#### **4.2 Bulk Import (AI Vision)**
1. **Click:** "Bulk Import"
2. **Select Role:** Student / Teacher / etc.
3. **Upload:** Photo of class register
4. **Select Class/Section**
5. **Click:** "Extract Student Names"
6. **Review and Create**

---

### **Step 5: Upload Syllabus (AI-Powered)**

1. **Go to:** Manage → Syllabus → Upload
2. **Select:** Class 10 Mathematics
3. **Upload:** PDF of syllabus/textbook
4. **AI will extract:** Chapters, topics, formulas
5. **Review and Save**

---

### **Step 6: Generate Lesson Plans (AI)**

1. **Go to:** Manage → Lesson Plans → Create
2. **Select:** Syllabus → Topics
3. **Set:** Date range, periods per week
4. **Click:** "Generate AI Lesson Plan"
5. **Review the daily schedule**
6. **Save**

---

### **Step 7: Generate Resources & MCQs (AI)**

1. **Go to:** Manage → Topics
2. **Select a topic**
3. **Generate:**
   - Lesson Notes
   - Study Guide
   - Worksheet
   - MCQs
4. **View and download**

---

### **Step 8: Daily Operations**

#### **8.1 Mark Attendance**
1. **Go to:** Manage → Attendance
2. **Select:** Class, Section, Date
3. **Mark:** Present/Absent for each student
4. **Save**

#### **8.2 View/Edit Timetable**
1. **Go to:** Manage → Timetable
2. **Select:** Class, Section
3. **Click cells** to assign subjects/teachers
4. **Save**

#### **8.3 Enter Marks**
1. **Go to:** Manage → Report Cards
2. **Select:** Class, Exam
3. **Enter marks** for each student
4. **Grades auto-calculate**
5. **Save**

---

### **Step 9: Promote Students**

1. **Go to:** Manage → Promotions
2. **Select:** From Year, From Class
3. **Select:** To Year, To Class
4. **Choose** Promote/Retain for each
5. **Execute**

---

### **Step 10: Create Announcements**

1. **Go to:** Notifications (bell icon)
2. **Click:** "New Announcement"
3. **Write** title and content
4. **Select** audience and priority
5. **Publish**

---

## ✅ **FEATURE CHECKLIST**

| Feature | Path | Test Status |
|---------|------|-------------|
| Platform Owner - Create School | `/platform/schools` | ⬜ |
| Super Admin Login | `/login` | ⬜ |
| Create Academic Year | `/manage/academic-years` | ⬜ |
| Create Classes | `/manage/classes` | ⬜ |
| Create Sections | `/manage/sections` | ⬜ |
| Create Subjects | `/manage/subjects` | ⬜ |
| **Add Single User with Role** | `/manage/users` | ⬜ |
| Bulk Import with Role | `/manage/bulk-import` | ⬜ |
| Upload Syllabus (AI) | `/manage/syllabus/upload` | ⬜ |
| Create Lesson Plan (AI) | `/manage/lesson-plans/create` | ⬜ |
| Generate Resources (AI) | `/manage/topics/[id]/resources` | ⬜ |
| Generate MCQs (AI) | `/manage/topics/[id]/mcq` | ⬜ |
| Mark Attendance | `/manage/attendance` | ⬜ |
| Edit Timetable | `/manage/timetable` | ⬜ |
| Enter Marks | `/manage/report-cards` | ⬜ |
| Promote Students | `/manage/promotions` | ⬜ |
| Create Announcement | `/dashboard/notifications` | ⬜ |
| View Progress | `/dashboard/progress` | ⬜ |

---

## 🔧 **PREREQUISITES**

1. **Development servers running:**
   ```bash
   # Terminal 1 - Frontend
   npm run dev
   
   # Terminal 2 - AI Service
   cd ai-service
   python main.py
   ```

2. **Supabase connected** with `.env.local` configured

3. **All SQL schemas executed** in Supabase

---

## 🐛 **COMMON ISSUES**

| Issue | Solution |
|-------|----------|
| "User already exists" | Use different email |
| AI not working | Check if AI service is running |
| Dropdown empty | Run SQL migrations |
| RLS error | Check Supabase policies |

---

**Start testing! 🚀**
