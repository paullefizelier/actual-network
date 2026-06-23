import { describe, it, expect } from 'vitest'
import {
  monthlyTotals,
  accountTotal,
  computeLift,
  aggregateByDirection,
  eventEfficiency
} from '../../app/domain/attribution'

const lines = [
  { account_id: 'a', period: '2026-01-01', amount: 100 },
  { account_id: 'a', period: '2026-02-01', amount: 200 },
  { account_id: 'a', period: '2026-03-01', amount: 50 }
]

describe('accountTotal', () => {
  it('sums amounts', () => {
    expect(accountTotal(lines)).toBe(350)
  })

  it('zero for empty', () => {
    expect(accountTotal([])).toBe(0)
  })
})

describe('monthlyTotals', () => {
  it('groups by period sorted asc', () => {
    expect(monthlyTotals([...lines].reverse())).toEqual([
      { period: '2026-01-01', amount: 100 },
      { period: '2026-02-01', amount: 200 },
      { period: '2026-03-01', amount: 50 }
    ])
  })
})

describe('computeLift', () => {
  it('splits before/after the first participation', () => {
    expect(computeLift(lines, '2026-02-01')).toEqual({
      before: 100,
      after: 250,
      delta: 150
    })
  })

  it('counts everything as after when no date', () => {
    expect(computeLift(lines, null)).toEqual({
      before: 0,
      after: 350,
      delta: 350
    })
  })
})

describe('aggregateByDirection', () => {
  it('counts each account once; direct wins if any direct participation', () => {
    const parts = [
      { account_id: 'a', event_id: 'e1', direction: 'direct' as const, entered_network_at: null },
      { account_id: 'a', event_id: 'e2', direction: 'indirect' as const, entered_network_at: null },
      { account_id: 'b', event_id: 'e1', direction: 'indirect' as const, entered_network_at: null }
    ]
    const totals = new Map([
      ['a', 350],
      ['b', 100]
    ])
    expect(aggregateByDirection(parts, totals)).toEqual({
      direct: 350,
      indirect: 100
    })
  })
})

describe('eventEfficiency', () => {
  it('computes conversion rate per event', () => {
    const parts = [
      { account_id: 'a', event_id: 'e1', direction: 'direct' as const, entered_network_at: null },
      { account_id: 'b', event_id: 'e1', direction: 'direct' as const, entered_network_at: null }
    ]
    const withRev = new Set(['a'])
    expect(eventEfficiency(parts, withRev)).toEqual([
      { event_id: 'e1', total: 2, converted: 1, rate: 0.5 }
    ])
  })
})
