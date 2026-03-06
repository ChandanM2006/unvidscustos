-- CUSTOS Fee Management Schema
-- Razorpay Integration for School Fee Collection

-- 1. Fee Structures — Defines the fee template for a class (e.g., Class 10 fee breakdown)
CREATE TABLE fee_structures (
  fee_structure_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id UUID REFERENCES schools(school_id) ON DELETE CASCADE,
  class_id UUID REFERENCES classes(class_id) ON DELETE CASCADE,
  academic_year TEXT NOT NULL, -- e.g., '2025-2026'
  name TEXT NOT NULL, -- e.g., 'Annual Fee Structure 2025-2026'
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(school_id, class_id, academic_year)
);

-- 2. Fee Slots — Individual fee components within a structure
-- Schools can add any number of custom-named slots
CREATE TABLE fee_slots (
  fee_slot_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  fee_structure_id UUID REFERENCES fee_structures(fee_structure_id) ON DELETE CASCADE,
  name TEXT NOT NULL, -- e.g., 'Tuition Fee', 'Lab Fee', 'Library Fee', etc.
  amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
  description TEXT,
  is_mandatory BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Fee Payments — Records of actual payments made via Razorpay
CREATE TABLE fee_payments (
  payment_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id UUID REFERENCES schools(school_id) ON DELETE CASCADE,
  student_id UUID REFERENCES users(user_id) ON DELETE CASCADE,
  fee_structure_id UUID REFERENCES fee_structures(fee_structure_id) ON DELETE CASCADE,
  
  -- Amount breakdown
  total_amount DECIMAL(10, 2) NOT NULL,
  slots_paid JSONB NOT NULL DEFAULT '[]'::jsonb, -- Array of { fee_slot_id, name, amount }
  
  -- Razorpay details
  razorpay_order_id TEXT,
  razorpay_payment_id TEXT,
  razorpay_signature TEXT,
  
  -- Payment status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'created', 'paid', 'failed', 'refunded')),
  paid_at TIMESTAMP WITH TIME ZONE,
  
  -- Metadata
  payment_method TEXT, -- 'card', 'upi', 'netbanking', 'wallet'
  receipt_number TEXT,
  notes JSONB DEFAULT '{}'::jsonb,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_fee_structures_school ON fee_structures(school_id);
CREATE INDEX idx_fee_structures_class ON fee_structures(class_id);
CREATE INDEX idx_fee_slots_structure ON fee_slots(fee_structure_id);
CREATE INDEX idx_fee_payments_school ON fee_payments(school_id);
CREATE INDEX idx_fee_payments_student ON fee_payments(student_id);
CREATE INDEX idx_fee_payments_status ON fee_payments(status);
CREATE INDEX idx_fee_payments_razorpay ON fee_payments(razorpay_order_id);

-- RLS
ALTER TABLE fee_structures ENABLE ROW LEVEL SECURITY;
ALTER TABLE fee_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE fee_payments ENABLE ROW LEVEL SECURITY;

-- Fee Structures: Admins can CRUD, others can read their school's
CREATE POLICY "Admins manage fee structures" ON fee_structures
  FOR ALL USING (
    school_id IN (
      SELECT school_id FROM users 
      WHERE email = auth.email() AND role IN ('super_admin', 'sub_admin')
    )
  );

CREATE POLICY "Users can view their school fee structures" ON fee_structures
  FOR SELECT USING (
    school_id IN (
      SELECT school_id FROM users WHERE email = auth.email()
    )
  );

-- Fee Slots: Follow parent fee_structure access
CREATE POLICY "Admins manage fee slots" ON fee_slots
  FOR ALL USING (
    fee_structure_id IN (
      SELECT fee_structure_id FROM fee_structures 
      WHERE school_id IN (
        SELECT school_id FROM users 
        WHERE email = auth.email() AND role IN ('super_admin', 'sub_admin')
      )
    )
  );

CREATE POLICY "Users can view fee slots" ON fee_slots
  FOR SELECT USING (
    fee_structure_id IN (
      SELECT fee_structure_id FROM fee_structures 
      WHERE school_id IN (
        SELECT school_id FROM users WHERE email = auth.email()
      )
    )
  );

-- Fee Payments: Admins see all, parents/students see their own
CREATE POLICY "Admins manage fee payments" ON fee_payments
  FOR ALL USING (
    school_id IN (
      SELECT school_id FROM users 
      WHERE email = auth.email() AND role IN ('super_admin', 'sub_admin')
    )
  );

CREATE POLICY "Students view own payments" ON fee_payments
  FOR SELECT USING (
    student_id IN (
      SELECT user_id FROM users WHERE email = auth.email()
    )
  );

-- Triggers for updated_at
CREATE TRIGGER update_fee_structures_updated_at BEFORE UPDATE ON fee_structures
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_fee_slots_updated_at BEFORE UPDATE ON fee_slots
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_fee_payments_updated_at BEFORE UPDATE ON fee_payments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
