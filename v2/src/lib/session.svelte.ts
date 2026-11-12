import { sb, NAME_DOMAIN, SUPABASE_URL } from './supabase'
import type { User } from '@supabase/supabase-js'

// One place that knows who is signed in. Same accounts as version 1.
export const session = $state<{ user: User | null; ready: boolean }>({ user: null, ready: false })

sb.auth.getSession().then(({ data }) => { session.user = data.session?.user ?? null; session.ready = true })
sb.auth.onAuthStateChange((_e, s) => { session.user = s?.user ?? null; session.ready = true })

const toEmail = (id: string) => (id.includes('@') ? id.trim() : id.trim().toLowerCase() + NAME_DOMAIN)
export const displayName = (u: User | null) =>
  !u ? '' : (u.email ?? '').endsWith(NAME_DOMAIN) ? (u.email ?? '').slice(0, -NAME_DOMAIN.length) : (u.user_metadata?.name ?? u.email ?? '')

export async function signIn(id: string, password: string) {
  const { error } = await sb.auth.signInWithPassword({ email: toEmail(id), password })
  if (error) throw new Error(/invalid/i.test(error.message) ? 'That username or password is wrong.' : error.message)
}
export async function signUp(username: string, password: string) {
  const r = await fetch(SUPABASE_URL + '/functions/v1/account', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ action: 'signup', username, password, origin: location.origin }),
  })
  const j = await r.json().catch(() => ({}))
  if (!r.ok || j.error) throw new Error(j.error || 'Could not create the account.')
  await signIn(username, password)
}
export const signOut = () => sb.auth.signOut({ scope: 'local' })
