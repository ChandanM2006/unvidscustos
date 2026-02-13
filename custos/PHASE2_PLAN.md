# Phase 2: The Structure - Implementation Plan

## 🎯 **Goal**
Build the school organizational structure (Classes, Sections) and enable bulk user creation with Vision AI.

---

## 📋 **Deliverables**

### **Week 1: Foundation**
1. ✅ **Class Management UI**
   - Create/Edit/Delete classes
   - List all classes with grade levels
   - Assign class IDs

2. ✅ **Section Management UI**
   - Create sections within classes
   - Link sections to classes
   - Display class-section hierarchy

3. ✅ **User Management UI (Basic)**
   - View all users (students, teachers, sub-admins)
   - Filter by role and class
   - Delete users
   - Manual user creation form

### **Week 2: AI Integration**
4. ✅ **Python FastAPI Server**
   - Setup FastAPI project structure
   - CORS configuration for Next.js
   - Health check endpoint
   - Deployment ready

5. ✅ **Vision AI - Student Roster Extraction**
   - Endpoint: `POST /api/vision/extract-roster`
   - Google Gemini Vision API integration
   - Upload image → Extract student names
   - Return structured JSON

6. ✅ **Bulk User Creation**
   - Frontend: Image upload UI
   - Process Vision AI response
   - Bulk insert students into database
   - Success/error feedback

---

## 🏗️ **Architecture**

```
Frontend (Next.js)          Backend (FastAPI)         AI Service
┌─────────────┐            ┌──────────────┐         ┌─────────────┐
│             │            │              │         │             │
│  Manage UI  │────────────│  /extract    │────────│  Gemini     │
│  - Classes  │   Image    │  -roster     │  API   │  Vision API │
│  - Sections │            │              │        │             │
│  - Students │◄───────────│  Returns     │        │             │
│             │   JSON     │  JSON        │        │             │
└─────────────┘            └──────────────┘         └─────────────┘
      │                           │
      │                           │
      ▼                           │
┌─────────────┐                   │
│  Supabase   │◄──────────────────┘
│  Database   │  Bulk Insert
└─────────────┘
```

---

## 📁 **Files to Create**

### **Frontend (Next.js)**
1. `app/dashboard/manage/classes/page.tsx` - Class management
2. `app/dashboard/manage/sections/page.tsx` - Section management
3. `app/dashboard/manage/users/page.tsx` - User management
4. `components/ui/data-table.tsx` - Reusable table component
5. `components/ui/modal.tsx` - Modal for forms
6. `lib/api.ts` - API client for FastAPI

### **Backend (Python)**
1. `ai-service/main.py` - FastAPI entry point
2. `ai-service/routers/vision.py` - Vision AI endpoints
3. `ai-service/services/gemini.py` - Gemini API integration
4. `ai-service/models/schemas.py` - Pydantic models
5. `ai-service/requirements.txt` - Python dependencies
6. `ai-service/.env` - Environment variables

---

## 🔑 **Key Features**

### **1. Class Management**
- Create class with name and grade level
- Edit class details
- Delete class (with confirmation)
- View all classes in a table

### **2. Section Management**
- Create section within a class
- Assign section name (A, B, C, etc.)
- Link to parent class
- Delete section

### **3. User Management**
- **View Users:**
  - Filterable table (by role, class, section)
  - Search by name or email
  - Pagination
- **Manual Creation:**
  - Form to create single user
  - Set role, class, section
  - Auto-generate email or custom
- **Bulk Creation (Vision AI):**
  - Upload photo of handwritten list
  - AI extracts names
  - Preview extracted names
  - Confirm and bulk create

### **4. Vision AI Integration**
- **Input:** Image file (JPG, PNG)
- **Process:** Gemini Vision API analyzes image
- **Output:** JSON array of student names
- **Example:**
  ```json
  {
    "students": [
      {"name": "Rohan Kumar"},
      {"name": "Priya Sharma"},
      {"name": "Amit Patel"}
    ]
  }
  ```

---

## 🛠️ **Tech Stack**

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend** | Next.js 14 + TypeScript | UI and routing |
| **UI Components** | Shadcn/UI + TanStack Table | Data tables |
| **Backend** | Python FastAPI | AI endpoints |
| **AI** | Google Gemini Vision API | OCR and extraction |
| **Database** | Supabase PostgreSQL | Data storage |
| **Validation** | Pydantic | Schema validation |

---

## 📊 **Database Updates**

### **New Tables (Already Created)**
- ✅ `classes` - School classes
- ✅ `sections` - Class sections
- ✅ `users` - All user types

### **New Relationships**
- `users.class_id` → `classes.class_id`
- `users.section_id` → `sections.section_id`
- `sections.class_id` → `classes.class_id`

---

## 🚀 **Implementation Order**

### **Day 1-2: Class & Section Management**
1. Create class management UI
2. Create section management UI
3. Test CRUD operations

### **Day 3-4: User Management UI**
1. Build user list table
2. Create manual user form
3. Implement filters and search

### **Day 5-6: Python FastAPI Setup**
1. Initialize FastAPI project
2. Setup Gemini API credentials
3. Create health check endpoint
4. Test server locally

### **Day 7: Vision AI Integration**
1. Build `/extract-roster` endpoint
2. Integrate Gemini Vision API
3. Test with sample images
4. Return structured JSON

### **Day 8-9: Bulk User Creation**
1. Build image upload UI
2. Connect to FastAPI endpoint
3. Display extracted names
4. Bulk insert into Supabase
5. Success/error handling

### **Day 10: Testing & Polish**
1. End-to-end testing
2. Error handling
3. UI polish
4. Documentation

---

## ✅ **Success Criteria**

Phase 2 is complete when:
- [ ] Can create classes and sections via UI
- [ ] Can view all users in a filterable table
- [ ] Can manually create a single user
- [ ] FastAPI server is running
- [ ] Can upload image and extract names via Vision AI
- [ ] Can bulk create students from extracted names
- [ ] All data persists in Supabase

---

## 🎓 **What You'll Learn**

- Building CRUD interfaces in Next.js
- Data table management with TanStack Table
- Setting up Python FastAPI
- Integrating Google Gemini Vision API
- File upload handling
- Bulk database operations

---

**Ready to build! Let's start with Class Management UI.** 🚀
