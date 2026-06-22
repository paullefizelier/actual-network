import { describe, it, expect } from 'vitest'
import { filterAccounts } from '../../app/utils/filterAccounts'

const rows = [
  { id: '1', name: 'Adrénaline', siret: '12345678900011', current_status: 'client' },
  { id: '2', name: 'Kumo', siret: null, current_status: 'prospect' }
]

describe('filterAccounts', () => {
  it('filters by name (case-insensitive)', () => {
    expect(filterAccounts(rows, { search: 'adré', status: null }).map(r => r.id)).toEqual(['1'])
  })

  it('filters by siret substring', () => {
    expect(filterAccounts(rows, { search: '900011', status: null }).map(r => r.id)).toEqual(['1'])
  })

  it('filters by status', () => {
    expect(filterAccounts(rows, { search: '', status: 'prospect' }).map(r => r.id)).toEqual(['2'])
  })

  it('handles null siret without throwing', () => {
    expect(filterAccounts(rows, { search: 'kumo', status: null }).map(r => r.id)).toEqual(['2'])
  })
})
