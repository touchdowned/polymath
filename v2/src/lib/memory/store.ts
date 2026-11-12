import { sb } from '../supabase'
import { fresh, quality, review, type Item, type Memory, type Signals } from './scheduler'

const ms = (t: string | null) => (t ? Date.parse(t) : 0)

/** Everything this person can study, and what they remember of it. */
export async function loadAll(): Promise<{ items: Item[]; mem: Map<string, Memory> }> {
  const [i, m] = await Promise.all([
    sb.from('v2_items').select('id,kind,book_id,section_id,ord').order('ord'),
    sb.from('v2_memory').select('item_id,s,d,due,reps,lapses,last'),
  ])
  if (i.error) throw i.error
  if (m.error) throw m.error
  const items: Item[] = (i.data ?? []).map((r) => ({ id: r.id, kind: r.kind, bookId: r.book_id, sectionId: r.section_id, order: r.ord }))
  const mem = new Map<string, Memory>((m.data ?? []).map((r) => [r.item_id, { s: r.s, d: r.d, due: ms(r.due), reps: r.reps, lapses: r.lapses, last: r.last ? ms(r.last) : null }]))
  return { items, mem }
}

/** Record one answer from any mode. Returns the updated memory so the caller can react at once. */
export async function record(userId: string, itemId: string, signals: Signals, mode: string, mem: Map<string, Memory>, now = Date.now()): Promise<Memory> {
  const q = quality(signals)
  const next = review(mem.get(itemId) ?? fresh(), q, now)
  mem.set(itemId, next)
  const row = { user_id: userId, item_id: itemId, s: next.s, d: next.d, due: new Date(next.due).toISOString(), reps: next.reps, lapses: next.lapses, last: new Date(now).toISOString() }
  const [a, b] = await Promise.all([
    sb.from('v2_memory').upsert(row),
    sb.from('v2_reviews').insert({ user_id: userId, item_id: itemId, q, signals, mode }),
  ])
  if (a.error) throw a.error
  if (b.error) throw b.error
  return next
}
