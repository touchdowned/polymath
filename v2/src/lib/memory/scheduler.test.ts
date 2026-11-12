import { describe, it, expect } from 'vitest'
import { quality, review, recall, nextUp, mastery, counts, fresh, DAY, type Item, type Memory } from './scheduler'

const T0 = Date.UTC(2026, 10, 12)
const item = (id: string, order = 0, bookId = 'b1'): Item => ({ id, kind: 'question', bookId, sectionId: null, order })

describe('quality', () => {
  it('is 0 for wrong, revealed or skipped', () => {
    expect(quality({ correct: false })).toBe(0)
    expect(quality({ correct: true, revealed: true })).toBe(0)
    expect(quality({ correct: true, skipped: true })).toBe(0)
  })
  it('is 1 for a clean first-try answer', () => expect(quality({ correct: true, tries: 1, seconds: 10, expected: 20 })).toBe(1))
  it('counts second tries, hints and slowness for less', () => {
    const clean = quality({ correct: true })
    expect(quality({ correct: true, tries: 2 })).toBeLessThan(clean)
    expect(quality({ correct: true, hint: true })).toBe(0.5)
    expect(quality({ correct: true, seconds: 60, expected: 20 })).toBe(0.5)   // never below half for time alone
    expect(quality({ correct: true, changes: 2 })).toBeCloseTo(0.88)
  })
})

describe('review', () => {
  it('brings a miss back in ten minutes and counts a lapse', () => {
    const m = review({ ...fresh(), s: 10, reps: 3, last: T0 - 10 * DAY }, 0, T0)
    expect(m.due - T0).toBe(10 * 60_000); expect(m.lapses).toBe(1); expect(m.s).toBeLessThan(10)
  })
  it('gives a first clean answer three days and a shaky one one day', () => {
    expect(review(fresh(), 1, T0).s).toBe(3); expect(review(fresh(), 0.5, T0).s).toBe(1)
  })
  it('grows the interval with each good review', () => {
    let m: Memory = fresh(), now = T0; const s: number[] = []
    for (let i = 0; i < 5; i++) { m = review(m, 1, now); s.push(m.s); now = m.due }
    for (let i = 1; i < s.length; i++) expect(s[i]).toBeGreaterThan(s[i - 1])
    expect(s[4]).toBeGreaterThan(30)
  })
  it('grows less for hard items than easy ones', () => {
    const base = { ...fresh(), s: 5, reps: 2, last: T0 - 5 * DAY }
    expect(review({ ...base, d: 9 }, 1, T0).s).toBeLessThan(review({ ...base, d: 2 }, 1, T0).s)
  })
  it('never schedules past a year', () => expect(review({ ...fresh(), s: 360, reps: 9, d: 1, last: T0 - 360 * DAY }, 1, T0).s).toBeLessThanOrEqual(365))
})

describe('recall', () => {
  it('is 90% at exactly one stability interval', () => expect(recall({ ...fresh(), s: 4, reps: 1, last: T0 - 4 * DAY }, T0)).toBeCloseTo(0.9))
  it('is 0 for something never seen', () => expect(recall(fresh(), T0)).toBe(0))
})

describe('nextUp', () => {
  const items = [item('a', 0), item('b', 1), item('c', 2), item('d', 3, 'b2')]
  it('puts due reviews before new material, most overdue first', () => {
    const mem = new Map<string, Memory>([
      ['b', { ...fresh(), s: 2, reps: 1, last: T0 - 6 * DAY, due: T0 - 4 * DAY }],
      ['c', { ...fresh(), s: 2, reps: 1, last: T0 - 3 * DAY, due: T0 - 1 * DAY }],
    ])
    expect(nextUp(items, mem, T0).map((n) => n.item.id)).toEqual(['b', 'c', 'a', 'd'])
  })
  it('leaves out things that are not due yet', () => {
    const mem = new Map<string, Memory>([['a', { ...fresh(), s: 5, reps: 1, last: T0, due: T0 + 5 * DAY }]])
    expect(nextUp(items, mem, T0).map((n) => n.item.id)).toEqual(['b', 'c', 'd'])
  })
  it('opens new material in book order, capped', () => expect(nextUp(items, new Map(), T0, { newLimit: 2 }).map((n) => n.item.id)).toEqual(['a', 'b']))
  it('can be limited to one book', () => expect(nextUp(items, new Map(), T0, { bookId: 'b2' }).map((n) => n.item.id)).toEqual(['d']))
})

describe('mastery and counts', () => {
  const items = [item('a'), item('b')]
  const mem = new Map<string, Memory>([['a', { ...fresh(), s: 4, reps: 1, last: T0 - 4 * DAY, due: T0 }]])
  it('averages recall and counts unseen as zero', () => expect(mastery(items, mem, T0)).toBeCloseTo(0.45))
  it('counts due, new and learned', () => expect(counts(items, mem, T0)).toEqual({ due: 1, fresh: 1, learned: 1 }))
})
