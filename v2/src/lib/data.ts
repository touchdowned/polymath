import { sb } from './supabase'

export interface Book { id: string; v1Id: string | null; title: string; subject: string | null; tone: string | null; pages: number | null; status: string }
export interface V1Book { id: string; name: string; subject?: string; pages?: number; pdfName?: string }
export interface Profile { rating: number; rank: string; wins: number; losses: number; draws: number }
export interface Leader { name: string; rating: number; mine: boolean }

const TONES = ['#3d63f5', '#e5484d', '#12a67a', '#7a4fd6', '#f59e0b', '#0ea5e9', '#d6409f', '#65a30d', '#f97316', '#14b8a6', '#6366f1', '#be123c']
export const toneFor = (n: number) => TONES[n % TONES.length]
/** Black or white, whichever reads on this colour. */
export function inkOn(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex); if (!m) return '#fff'
  const n = parseInt(m[1], 16), L = (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255
  return L > 0.62 ? '#1a1a1a' : '#fff'
}

export async function books(): Promise<Book[]> {
  const { data, error } = await sb.from('v2_books').select('id,v1_id,title,subject,tone,pages,status').order('created_at')
  if (error) throw error
  return (data ?? []).map((r) => ({ id: r.id, v1Id: r.v1_id, title: r.title, subject: r.subject, tone: r.tone, pages: r.pages, status: r.status }))
}
/** Books uploaded in version 1, read from that version's saved list. */
export async function v1Books(): Promise<V1Book[]> {
  const { data, error } = await sb.from('kv').select('value').eq('key', 'ws:list').maybeSingle()
  if (error) throw error
  return Array.isArray(data?.value) ? (data!.value as V1Book[]).filter((w) => w && w.id && w.name) : []
}
/** Carry version-1 books over. Safe to run twice: each book comes across once. */
export async function importV1(userId: string): Promise<number> {
  const [old, cur] = await Promise.all([v1Books(), books()])
  const have = new Set(cur.map((b) => b.v1Id))
  const rows = old.filter((w) => !have.has(w.id)).map((w, k) => ({
    user_id: userId, v1_id: w.id, title: w.name, subject: w.subject ?? null, pages: w.pages ?? null,
    tone: toneFor(cur.length + k), storage_path: w.pdfName ? `${userId}/${w.id}` : null,
  }))
  if (!rows.length) return 0
  const { error } = await sb.from('v2_books').insert(rows)
  if (error) throw error
  return rows.length
}
export async function profile(name: string): Promise<Profile | null> {
  const { data, error } = await sb.rpc('pm_profile', { p_name: name || null })
  if (error || !data) return null
  return { rating: Number(data.rating ?? 100), rank: String(data.rank ?? ''), wins: data.wins ?? 0, losses: data.losses ?? 0, draws: data.draws ?? 0 }
}
export async function leaderboard(limit = 10): Promise<Leader[]> {
  const { data, error } = await sb.rpc('pm_leaderboard', { p_limit: limit })
  if (error || !Array.isArray(data)) return []
  return data.map((r: any) => ({ name: String(r.name ?? ''), rating: Number(r.rating ?? 0), mine: !!r.mine }))
}
