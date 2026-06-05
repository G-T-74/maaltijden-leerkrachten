import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

async function test() {
  const { data, error } = await supabase
    .from('user_schools')
    .select(`
      user_id,
      school_id,
      profiles ( id, first_name, last_name, role )
    `)
    // .eq('school_id', '...') // Just get all for testing
  
  console.log('Result profiles:', JSON.stringify(data, null, 2))
  console.log('Error profiles:', error)

  const { data: d2, error: e2 } = await supabase
    .from('user_schools')
    .select(`
      user_id,
      school_id,
      profiles:user_id ( id, first_name, last_name, role )
    `)
  console.log('Result profiles:user_id:', JSON.stringify(d2, null, 2))
  console.log('Error profiles:user_id:', e2)
}

test()
