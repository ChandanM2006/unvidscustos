-- Default Time Slots for CUSTOS Timetable
-- Run this in Supabase SQL Editor
-- 
-- NOTE: Time slots are the SAME for all days. 
-- The day_of_week is stored in timetable_entries, not in slots.

DO $$
DECLARE
    v_school_id UUID;
BEGIN
    -- Get the first school (or specify your school_id)
    SELECT school_id INTO v_school_id FROM schools LIMIT 1;
    
    IF v_school_id IS NULL THEN
        RAISE EXCEPTION 'No school found. Create a school first.';
    END IF;

    -- Delete existing slots for this school (if any)
    DELETE FROM timetable_slots WHERE school_id = v_school_id;

    -- Insert default time slots (8 periods + breaks)
    INSERT INTO timetable_slots (school_id, slot_number, slot_name, start_time, end_time, is_break) VALUES
    (v_school_id, 1, 'Period 1', '08:00', '08:45', false),
    (v_school_id, 2, 'Period 2', '08:45', '09:30', false),
    (v_school_id, 3, 'Period 3', '09:30', '10:15', false),
    (v_school_id, 4, 'Short Break', '10:15', '10:30', true),
    (v_school_id, 5, 'Period 4', '10:30', '11:15', false),
    (v_school_id, 6, 'Period 5', '11:15', '12:00', false),
    (v_school_id, 7, 'Lunch', '12:00', '12:45', true),
    (v_school_id, 8, 'Period 6', '12:45', '13:30', false),
    (v_school_id, 9, 'Period 7', '13:30', '14:15', false),
    (v_school_id, 10, 'Period 8', '14:15', '15:00', false);

    RAISE NOTICE 'Time slots created successfully for school %', v_school_id;
END $$;

-- Verify the slots were created
SELECT slot_number, slot_name, start_time, end_time, is_break
FROM timetable_slots 
ORDER BY slot_number;
