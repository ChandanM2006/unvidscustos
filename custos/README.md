# CUSTOS 1.0 - AI Operating System for Schools

## Phase 1: The Shell ✅

**Goal:** Authentication + Basic Dashboard + School Branding

---

## 🚀 Tech Stack

- **Frontend:** Next.js 14 (App Router) + TypeScript
- **UI:** Tailwind CSS + Shadcn/UI components
- **Backend:** Supabase (PostgreSQL + Auth)
- **AI Engine:** Python FastAPI (Coming in Phase 2)

---

## 📁 Project Structure

```
custos/
├── app/
│   ├── login/              # Authentication page
│   ├── dashboard/          # Super Admin dashboard
│   │   └── manage/         # School branding setup
│   ├── globals.css         # Global styles
│   ├── layout.tsx          # Root layout
│   └── page.tsx            # Root redirect
├── lib/
│   ├── supabase.ts         # Supabase client & types
│   └── utils.ts            # Utility functions
├── supabase/
│   └── schema.sql          # Database schema
└── .env.local              # Environment variables
```

---

## 🛠️ Setup Instructions

### 1. Install Dependencies

```bash
cd custos
npm install
```

### 2. Setup Supabase

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Copy your project URL and anon key
3. Update `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

### 3. Create Database Tables

1. Open your Supabase project dashboard
2. Go to **SQL Editor**
3. Copy and paste the contents of `supabase/schema.sql`
4. Click **Run** to create all tables

### 4. Create Your First Super Admin

In Supabase SQL Editor, run:

```sql
-- 1. Create a school
INSERT INTO schools (school_id, name, config_json)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Demo School',
  '{"primary_color": "#2563eb", "secondary_color": "#7c3aed"}'::jsonb
);

-- 2. Create a super admin user
-- First, create the auth user in Supabase Auth UI, then:
INSERT INTO users (school_id, role, email, full_name)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'super_admin',
  'admin@demo.school',  -- Use the same email as Supabase Auth
  'Super Admin'
);
```

### 5. Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🎯 Phase 1 Features

### ✅ Completed

- [x] Next.js project setup with TypeScript
- [x] Supabase integration
- [x] Beautiful login page with gradient design
- [x] Super Admin dashboard with:
  - [x] Time-based greetings (Good Morning/Afternoon/Evening)
  - [x] Profile icon with initials
  - [x] Module navigation (Manage, Reports, Calendar, Post)
  - [x] Role-based access control
- [x] School branding setup page:
  - [x] School name input
  - [x] Logo URL upload
  - [x] Primary & secondary color pickers
  - [x] Live preview of branding
- [x] Database schema with:
  - [x] Multi-tenancy (schools table)
  - [x] User roles (super_admin, sub_admin, teacher, student)
  - [x] Classes & Sections
  - [x] Syllabus Nodes (DNA system)
  - [x] Question Bank
  - [x] Posts/Announcements

---

## 🎨 Design Features

- **Modern Gradients:** Blue-to-purple gradients throughout
- **Smooth Animations:** Hover effects and transitions
- **Responsive Design:** Works on desktop, tablet, and mobile
- **Time-Aware UI:** Greetings change based on time of day
- **White-Label Ready:** Each school gets custom branding

---

## 🔐 Authentication Flow

1. User visits `/` → Redirected to `/login`
2. User enters email/password → Supabase Auth validates
3. System checks `users` table for role
4. User redirected to `/dashboard` with role-based access

---

## 📊 Database Schema Highlights

### The DNA System (Syllabus Nodes)

```
MATH_10              (Subject)
├── MATH_10_01       (Topic: Fractions)
│   ├── MATH_10_01_SUB01  (Subtopic: Basic Fractions)
│   ├── MATH_10_01_SUB02  (Subtopic: Equivalent Fractions)
│   └── MATH_10_01_SUB03  (Subtopic: Adding Fractions)
└── MATH_10_02       (Topic: Algebra)
```

Every question is linked to a specific node, enabling:
- Precise weakness detection
- 60/40 adaptive learning
- Concept-level analytics

---

## 🚧 Next Steps (Phase 2)

- [ ] Vision AI for student roster extraction
- [ ] Class/Section management UI
- [ ] Bulk user creation
- [ ] Python FastAPI service setup
- [ ] First AI integration endpoint

---

## 🐛 Troubleshooting

### "Invalid API key" error
- Check that `.env.local` has correct Supabase credentials
- Restart dev server after changing `.env.local`

### "User not found" after login
- Make sure you created a user in the `users` table with the same email as Supabase Auth

### Database connection issues
- Verify your Supabase project is active
- Check that schema.sql was executed successfully

---

## 📝 Notes

- This is **Phase 1** - the foundation
- Focus: Authentication, branding, and dashboard shell
- No AI features yet (coming in Phase 2)
- All pages are fully responsive and production-ready

---

## 🎓 Learning Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [Supabase Documentation](https://supabase.com/docs)
- [Tailwind CSS](https://tailwindcss.com/docs)

---

**Built with ❤️ for the future of education**
