import { createBrowserClient } from '@supabase/ssr'

const SUPABASE_URL = 'https://lmrgzsfvzzdoatpddjvb.supabase.co'
const SUPABASE_ANON_KEY = 'sb_publishable_FMvUe_M8D-jNTKtpbX6kZQ_Kci692JO'

export function createClient() {
  return createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY)
}