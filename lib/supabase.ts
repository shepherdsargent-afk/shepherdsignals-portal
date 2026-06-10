import { createBrowserClient } from '@supabase/ssr'

const SUPABASE_URL = 'https://zsqrtnrfjxdjwqvssbtb.supabase.co'
const SUPABASE_ANON_KEY = 'sb_publishable__aye-L8jUf8pwLGH58P_2g_Ul0DJqKn'

export function createClient() {
  return createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY)
}