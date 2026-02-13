-- CUSTOS Database Schema
-- Phase 1: Core Tables for Authentication and School Setup

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Schools Table (Multi-tenancy)
CREATE TABLE schools (
  school_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  config_json JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Users Table (All roles: super_admin, sub_admin, teacher, student)
CREATE TABLE users (
  user_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id UUID REFERENCES schools(school_id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('super_admin', 'sub_admin', 'teacher', 'student')),
  email TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  class_id UUID,
  section_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Classes Table
CREATE TABLE classes (
  class_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id UUID REFERENCES schools(school_id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  grade_level INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(school_id, name, grade_level)
);

-- 4. Sections Table
CREATE TABLE sections (
  section_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  class_id UUID REFERENCES classes(class_id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(class_id, name)
);

-- 5. Subjects Table
CREATE TABLE subjects (
  subject_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  class_id UUID REFERENCES classes(class_id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  teacher_id UUID REFERENCES users(user_id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(class_id, name)
);

-- 6. Syllabus Nodes (The DNA System)
CREATE TABLE syllabus_nodes (
  node_id TEXT PRIMARY KEY, -- e.g., 'MATH_10_01_SUB03'
  parent_id TEXT REFERENCES syllabus_nodes(node_id) ON DELETE CASCADE,
  school_id UUID REFERENCES schools(school_id) ON DELETE CASCADE,
  class_id UUID REFERENCES classes(class_id) ON DELETE CASCADE,
  subject_id UUID REFERENCES subjects(subject_id) ON DELETE CASCADE,
  node_type TEXT NOT NULL CHECK (node_type IN ('subject', 'topic', 'subtopic')),
  title TEXT NOT NULL,
  content TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. Question Bank
CREATE TABLE question_bank (
  question_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  linked_node_id TEXT REFERENCES syllabus_nodes(node_id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  options JSONB, -- For MCQs: ['A', 'B', 'C', 'D']
  correct_answer TEXT,
  difficulty TEXT CHECK (difficulty IN ('easy', 'medium', 'hard')),
  question_type TEXT CHECK (question_type IN ('knowledge', 'comprehension', 'application', 'analysis', 'synthesis')),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 8. Posts/Announcements Table
CREATE TABLE posts (
  post_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id UUID REFERENCES schools(school_id) ON DELETE CASCADE,
  author_id UUID REFERENCES users(user_id) ON DELETE CASCADE,
  title TEXT,
  content TEXT,
  media_url TEXT,
  post_type TEXT CHECK (post_type IN ('photo', 'file', 'blog')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_users_school ON users(school_id);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_classes_school ON classes(school_id);
CREATE INDEX idx_sections_class ON sections(class_id);
CREATE INDEX idx_subjects_class ON subjects(class_id);
CREATE INDEX idx_syllabus_parent ON syllabus_nodes(parent_id);
CREATE INDEX idx_syllabus_class ON syllabus_nodes(class_id);
CREATE INDEX idx_questions_node ON question_bank(linked_node_id);
CREATE INDEX idx_posts_school ON posts(school_id);

-- Row Level Security (RLS) Policies
ALTER TABLE schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE syllabus_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE question_bank ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;

-- Basic RLS Policies (can be expanded based on requirements)
-- Allow authenticated users to read their school's data
CREATE POLICY "Users can view their school data" ON schools
  FOR SELECT USING (auth.uid() IN (
    SELECT user_id FROM users WHERE school_id = schools.school_id
  ));

CREATE POLICY "Users can view users in their school" ON users
  FOR SELECT USING (school_id IN (
    SELECT school_id FROM users WHERE email = auth.email()
  ));

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_schools_updated_at BEFORE UPDATE ON schools
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_classes_updated_at BEFORE UPDATE ON classes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sections_updated_at BEFORE UPDATE ON sections
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_subjects_updated_at BEFORE UPDATE ON subjects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_syllabus_nodes_updated_at BEFORE UPDATE ON syllabus_nodes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
❓ Questions to Clarify:
1. Lesson Plan Generation:
When does this happen?

A) Before teaching (teacher reviews/edits before class)?
B) Auto-generated when syllabus uploaded?
C) Teacher triggers "Generate Plan" button?
What's included in lesson plan?

Learning objectives
Teaching activities
Time allocation
Resources needed
Assessment criteria