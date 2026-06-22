import { describe, it, expect } from 'vitest'
import { resolveAccount } from '../../app/utils/resolveAccount'

const accounts = [
  { id: 'a1', siret: '12345678900011' },
  { id: 'a2', siret: '98765432100022' },
  { id: 'a3', siret: null }
]

describe('resolveAccount', () => {
  it('matches by exact siret', () => {
    expect(resolveAccount(accounts, { siret: '12345678900011' }).match?.id).toBe('a1')
  })

  it('matches ignoring spaces', () => {
    expect(resolveAccount(accounts, { siret: '12345 67890 0011' }).match?.id).toBe('a1')
  })

  it('returns null when siret is null', () => {
    expect(resolveAccount(accounts, { siret: null }).match).toBeNull()
  })

  it('returns null when siret is empty string', () => {
    expect(resolveAccount(accounts, { siret: '' }).match).toBeNull()
  })

  it('returns null when no matching siret', () => {
    expect(resolveAccount(accounts, { siret: '00000000000000' }).match).toBeNull()
  })

  it('is null-safe over accounts with null siret', () => {
    expect(resolveAccount(accounts, { siret: '98765432100022' }).match?.id).toBe('a2')
  })
})
