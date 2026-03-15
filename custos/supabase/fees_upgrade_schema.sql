-- Fee Upgrades: Installments & Additional Fees Support

-- 1. Add type to fee_structures
ALTER TABLE fee_structures ADD COLUMN IF NOT EXISTS fee_type TEXT DEFAULT 'class' CHECK (fee_type IN ('class', 'additional'));

-- 2. Make class_id nullable so we can handle cases without a strict class if needed (though usually we map to students)
ALTER TABLE fee_structures ALTER COLUMN class_id DROP NOT NULL;

-- 3. Drop existing unique constraint that prevents overlapping if not strict class fee
ALTER TABLE fee_structures DROP CONSTRAINT IF EXISTS fee_structures_school_id_class_id_academic_year_key;

-- 4. Recreate unique constraint only for class-level fee structures to prevent duplicate annual fees for the same class
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_class_fee ON fee_structures (school_id, class_id, academic_year) WHERE fee_type = 'class';

-- 5. Create table for Installments
CREATE TABLE IF NOT EXISTS fee_installments (
  installment_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  fee_structure_id UUID REFERENCES fee_structures(fee_structure_id) ON DELETE CASCADE,
  name TEXT NOT NULL, -- e.g., 'Term 1', 'Term 2'
  due_date DATE NOT NULL,
  amount DECIMAL(10, 2) NOT NULL, -- The absolute amount to be paid for this installment
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Create table for Additional Fee Student Mapping
CREATE TABLE IF NOT EXISTS student_additional_fees (
  assignment_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  fee_structure_id UUID REFERENCES fee_structures(fee_structure_id) ON DELETE CASCADE,
  student_id UUID REFERENCES users(user_id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(fee_structure_id, student_id)
);

-- 7. Add installment_id to fee_payments to track which installment was paid
ALTER TABLE fee_payments ADD COLUMN IF NOT EXISTS installment_id UUID REFERENCES fee_installments(installment_id) ON DELETE CASCADE;

-- 8. Add trigger for fee_installments
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = NOW();
   RETURN NEW;
END;
$$ language 'plpgsql';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_fee_installments_updated_at') THEN
    CREATE TRIGGER update_fee_installments_updated_at
      BEFORE UPDATE ON fee_installments
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- 9. RLS Policies for new tables
ALTER TABLE fee_installments ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_additional_fees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage fee installments" ON fee_installments
  FOR ALL USING (
    fee_structure_id IN (
      SELECT fee_structure_id FROM fee_structures 
      WHERE school_id IN (
        SELECT school_id FROM users 
        WHERE email = auth.email() AND role IN ('super_admin', 'sub_admin')
      )
    )
  );

CREATE POLICY "Users view their school fee installments" ON fee_installments
  FOR SELECT USING (
    fee_structure_id IN (
      SELECT fee_structure_id FROM fee_structures 
      WHERE school_id IN (
        SELECT school_id FROM users WHERE email = auth.email()
      )
    )
  );

CREATE POLICY "Admins manage student additional fees" ON student_additional_fees
  FOR ALL USING (
    fee_structure_id IN (
      SELECT fee_structure_id FROM fee_structures 
      WHERE school_id IN (
        SELECT school_id FROM users 
        WHERE email = auth.email() AND role IN ('super_admin', 'sub_admin')
      )
    )
  );

CREATE POLICY "Students view own additional fees" ON student_additional_fees
  FOR SELECT USING (
    student_id IN (
      SELECT user_id FROM users WHERE email = auth.email()
    )
  );
