import { createClient } from '@supabase/supabase-js'
// These two values are public by design: every protected row is guarded by row-level security.
export const SUPABASE_URL = 'https://bsphvpcrnuzptrwoivtu.supabase.co'
export const sb = createClient(SUPABASE_URL, 'sb_publishable_redu4JtzMA5FZdkyZ7jrUQ_gNPpAOj_')
export const NAME_DOMAIN = '@users.polymath.invalid'
