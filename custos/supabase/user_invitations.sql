-- User Invitation System Schema
-- Run this in Supabase SQL Editor

-- Create user_invitations table for pending registrations
CREATE TABLE IF NOT EXISTS user_invitations (
    invite_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Basic Info (entered by admin)
    full_name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    role TEXT NOT NULL CHECK (role IN ('student', 'teacher', 'parent', 'sub_admin')),
    
    -- School context
    school_id UUID REFERENCES schools(school_id) ON DELETE CASCADE,
    
    -- Role-specific data stored as JSON
    -- For student: {class_id, section_id}
    -- For teacher: {subjects: [], classes: []}
    -- For parent: {student_invite_id} or linked after student registers
    metadata JSONB DEFAULT '{}',
    
    -- Parent info (when adding student)
    parent1_name TEXT,
    parent1_email TEXT,
    parent1_phone TEXT,
    parent1_relationship TEXT DEFAULT 'parent',
    
    parent2_name TEXT,
    parent2_email TEXT,
    parent2_phone TEXT,
    parent2_relationship TEXT DEFAULT 'parent',
    
    -- Invitation tracking
    invite_token TEXT UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
    invite_sent_at TIMESTAMP WITH TIME ZONE,
    invite_method TEXT DEFAULT 'email', -- 'email', 'sms', 'both'
    invite_resent_count INTEGER DEFAULT 0,
    
    -- Status tracking
    status TEXT DEFAULT 'pending' CHECK (status IN (
        'pending',      -- Created, not sent
        'invited',      -- Invitation sent
        'clicked',      -- User clicked the link
        'registering',  -- User is filling the form
        'registered',   -- User completed registration
        'active'        -- User account is active
    )),
    
    -- OTP for verification
    otp_code TEXT,
    otp_expires_at TIMESTAMP WITH TIME ZONE,
    otp_attempts INTEGER DEFAULT 0,
    
    -- After registration links to actual user
    user_id UUID REFERENCES users(user_id),
    registered_at TIMESTAMP WITH TIME ZONE,
    
    -- Audit
    created_by UUID REFERENCES users(user_id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_invitations_school ON user_invitations(school_id);
CREATE INDEX IF NOT EXISTS idx_invitations_token ON user_invitations(invite_token);
CREATE INDEX IF NOT EXISTS idx_invitations_email ON user_invitations(email);
CREATE INDEX IF NOT EXISTS idx_invitations_phone ON user_invitations(phone);
CREATE INDEX IF NOT EXISTS idx_invitations_status ON user_invitations(status);

-- Enable RLS
ALTER TABLE user_invitations ENABLE ROW LEVEL SECURITY;

-- Admins can manage invitations for their school
CREATE POLICY "Admins manage invitations" ON user_invitations
    FOR ALL TO authenticated
    USING (
        school_id IN (
            SELECT school_id FROM users 
            WHERE user_id = auth.uid() 
            AND role IN ('super_admin', 'sub_admin')
        )
    );

-- Anyone can view by token (for registration)
CREATE POLICY "View by token" ON user_invitations
    FOR SELECT TO anon, authenticated
    USING (invite_token IS NOT NULL);

-- Function to generate OTP
CREATE OR REPLACE FUNCTION generate_otp()
RETURNS TEXT AS $$
BEGIN
    RETURN LPAD(FLOOR(RANDOM() * 1000000)::TEXT, 6, '0');
END;
$$ LANGUAGE plpgsql;

-- Function to create invitation with OTP
CREATE OR REPLACE FUNCTION create_invitation_with_otp(
    p_invite_id UUID
)
RETURNS VOID AS $$
BEGIN
    UPDATE user_invitations
    SET 
        otp_code = generate_otp(),
        otp_expires_at = NOW() + INTERVAL '15 minutes',
        otp_attempts = 0
    WHERE invite_id = p_invite_id;
END;
$$ LANGUAGE plpgsql;

-- Add column to users table for invite tracking
ALTER TABLE users ADD COLUMN IF NOT EXISTS invite_id UUID REFERENCES user_invitations(invite_id);
ALTER TABLE users ADD COLUMN IF NOT EXISTS registration_method TEXT DEFAULT 'admin_created';
-- 'admin_created', 'self_registered', 'bulk_import'

SELECT 'User invitation system created!' as status;
