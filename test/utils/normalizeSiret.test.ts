import { describe, it, expect } from 'vitest'
import { normalizeSiret } from '../../app/utils/normalizeSiret'

describe('normalizeSiret', () => {
  it('removes spaces', () => { expect(normalizeSiret('123 456 789 00011')).toBe('12345678900011') })
  it('removes non-digits (dots, dashes)', () => { expect(normalizeSiret('123.456-789')).toBe('123456789') })
  it('returns empty string for null/undefined/empty', () => {
    expect(normalizeSiret(null)).toBe('')
    expect(normalizeSiret(undefined)).toBe('')
    expect(normalizeSiret('   ')).toBe('')
  })
})
