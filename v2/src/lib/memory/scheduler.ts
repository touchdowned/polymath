/**
 * The one memory model. Every question, term and concept in PolyMath is an Item with a Memory.
 * Lessons, drills, Shorts and Arena all report what happened through `review`, and Home asks
 * `nextUp` what to do. Nothing else in the app decides when something comes back.
 *
 * It is a small spaced-repetition model in the FSRS family:
 *   stability (s)  : days until recall drops to 90%
 *   difficulty (d) : 1 (easy) to 10 (hard), learned from how answers go
 */
export type Kind = 'question' | 'term' | 'concept' | 'exam'
export interface Memory { s: number; d: number; due: number; reps: number; lapses: number; last: number | null }
export interface Item { id: string; kind: Kind; bookId: string | null; sectionId: string | null; order: number }
export interface Signals {
  correct: boolean
  tries?: number          // attempts before the right answer
  seconds?: number        // time taken
  expected?: number       // time a prepared student needs
  hint?: boolean
  revealed?: boolean      // looked at the answer
  skipped?: boolean
  changes?: number        // times the answer was changed
}

export const DAY = 86_400_000
const MIN_S = 10 / (24 * 60)      // ten minutes, in days
const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x))

export const fresh = (): Memory => ({ s: 0, d: 5, due: 0, reps: 0, lapses: 0, last: null })

/** How well it went, 0 to 1. Right-or-wrong is only part of it: slow, hinted or second-try answers count for less. */
export function quality(g: Signals): number {
  if (!g.correct || g.revealed || g.skipped) return 0
  const tries = g.tries ?? 1
  let q = tries <= 1 ? 1 : tries === 2 ? 0.4 : 0.2
  if (g.seconds != null && g.expected) { const r = g.seconds / g.expected; if (r > 1) q *= clamp(1 - (r - 1) * 0.25, 0.5, 1) }
  if (g.hint) q *= 0.5
  if ((g.changes ?? 0) >= 2) q *= 0.88
  return clamp(q, 0, 1)
}

/** Chance of recalling it right now. */
export function recall(m: Memory, now: number): number {
  if (!m.last || m.s <= 0) return 0
  return Math.exp(Math.log(0.9) * ((now - m.last) / DAY) / m.s)
}

/** Apply one answer. Pure: returns the new memory. */
export function review(m: Memory, q: number, now: number): Memory {
  const r = recall(m, now)
  const d = clamp(m.d + (0.6 - q) * 1.2, 1, 10)
  if (q < 0.4) {
    // missed: it comes back in ten minutes, and most of the stability is gone
    const s = Math.max(MIN_S, m.s * 0.3)
    return { s, d, due: now + 10 * 60_000, reps: m.reps + 1, lapses: m.lapses + 1, last: now }
  }
  let s: number
  if (m.reps === 0 || m.s < 1) s = q >= 0.7 ? 3 : 1
  else s = m.s * (1 + ((11 - d) / 4) * (q - 0.3) * (1 + 1.5 * (1 - r)))   // recalling something nearly forgotten strengthens it most
  s = clamp(s, 1, 365)
  return { s, d, due: now + s * DAY, reps: m.reps + 1, lapses: m.lapses, last: now }
}

export type Reason = 'due' | 'new'
export interface Next { item: Item; reason: Reason; overdueDays: number }

/**
 * What to do now. Due reviews first, most overdue relative to their interval first; then new material
 * in the book's own order. `newLimit` caps how much new material is opened per call so reviews never drown.
 */
export function nextUp(items: Item[], mem: Map<string, Memory>, now: number, opts: { limit?: number; newLimit?: number; bookId?: string | null } = {}): Next[] {
  const { limit = 20, newLimit = 8, bookId } = opts
  const pool = bookId ? items.filter((i) => i.bookId === bookId) : items
  const due: Next[] = [], fr: Next[] = []
  for (const item of pool) {
    const m = mem.get(item.id)
    if (!m || m.reps === 0) fr.push({ item, reason: 'new', overdueDays: 0 })
    else if (m.due <= now) due.push({ item, reason: 'due', overdueDays: (now - m.due) / DAY })
  }
  due.sort((a, b) => b.overdueDays / Math.max(mem.get(b.item.id)!.s, MIN_S) - a.overdueDays / Math.max(mem.get(a.item.id)!.s, MIN_S))
  fr.sort((a, b) => a.item.order - b.item.order)
  return [...due, ...fr.slice(0, newLimit)].slice(0, limit)
}

/** Mastery of a set of items, 0 to 1: average chance of recall, counting unseen items as zero. */
export function mastery(items: Item[], mem: Map<string, Memory>, now: number): number {
  if (!items.length) return 0
  let sum = 0
  for (const i of items) { const m = mem.get(i.id); if (m) sum += recall(m, now) }
  return sum / items.length
}

export interface Counts { due: number; fresh: number; learned: number }
export function counts(items: Item[], mem: Map<string, Memory>, now: number): Counts {
  let due = 0, fr = 0, learned = 0
  for (const i of items) { const m = mem.get(i.id); if (!m || m.reps === 0) fr++; else { learned++; if (m.due <= now) due++ } }
  return { due, fresh: fr, learned }
}
