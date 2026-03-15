import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://rpokptjsbsogyknyivuo.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJwb2twdGpzYnNvZ3lrbnlpdnVvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODQ5MzIxMSwiZXhwIjoyMDg0MDY5MjExfQ.DaWwqukjpeZEHm592olcM1arv2VBm3dPVDFi6Zo5Hk4'

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

async function check() {
  const { data, error } = await supabase.from('timetable_entries').select('*').limit(1)
  console.log('columns', data && data.length ? Object.keys(data[0]) : [], error)
}
check()
