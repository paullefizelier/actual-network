import { describe, it, expect } from 'vitest'
import { findDuplicatePeriods } from '../../app/utils/findDuplicatePeriods'

describe('findDuplicatePeriods', () => {
  it('returns pairs already present in existing', () => {
    const toImport = [
      { account_id: 'a', period: '2026-01-01' },
      { account_id: 'a', period: '2026-02-01' }
    ]
    const existing = [{ account_id: 'a', period: '2026-01-01' }]
    expect(findDuplicatePeriods(toImport, existing)).toEqual([
      { account_id: 'a', period: '2026-01-01' }
    ])
  })

  it('returns empty when no overlap', () => {
    expect(findDuplicatePeriods(
      [{ account_id: 'a', period: '2026-03-01' }],
      [{ account_id: 'a', period: '2026-01-01' }]
    )).toEqual([])
  })

  it('dedupes repeated pairs in the import set', () => {
    const toImport = [
      { account_id: 'a', period: '2026-01-01' },
      { account_id: 'a', period: '2026-01-01' }
    ]
    const existing = [{ account_id: 'a', period: '2026-01-01' }]
    expect(findDuplicatePeriods(toImport, existing)).toEqual([
      { account_id: 'a', period: '2026-01-01' }
    ])
  })
})
