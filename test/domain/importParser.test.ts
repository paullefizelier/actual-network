import { describe, it, expect } from 'vitest'
import {
  parseAmount,
  parsePeriod,
  parseRows,
  matchBySiret
} from '../../app/domain/importParser'

describe('parseAmount', () => {
  it('parses French thousands-separated string with comma decimal', () => {
    expect(parseAmount('1 234,56')).toBe(1234.56)
  })

  it('parses dot-decimal string', () => {
    expect(parseAmount('1234.56')).toBe(1234.56)
  })

  it('returns a number directly', () => {
    expect(parseAmount(1234.5)).toBe(1234.5)
  })

  it('returns null for non-numeric string', () => {
    expect(parseAmount('abc')).toBeNull()
  })

  it('returns null for empty string', () => {
    expect(parseAmount('')).toBeNull()
  })

  it('returns null for null', () => {
    expect(parseAmount(null)).toBeNull()
  })

  it('parses nbsp-separated French amount', () => {
    expect(parseAmount('1 234,56')).toBe(1234.56)
  })
})

describe('parsePeriod', () => {
  it('parses yyyy-mm to yyyy-mm-01', () => {
    expect(parsePeriod('2026-03')).toBe('2026-03-01')
  })

  it('parses yyyy-mm-dd to yyyy-mm-01', () => {
    expect(parsePeriod('2026-03-15')).toBe('2026-03-01')
  })

  it('parses mm/yyyy to yyyy-mm-01', () => {
    expect(parsePeriod('03/2026')).toBe('2026-03-01')
  })

  it('parses dd/mm/yyyy (French day-first) to yyyy-mm-01', () => {
    expect(parsePeriod('01/03/2026')).toBe('2026-03-01')
  })

  it('returns null for junk input', () => {
    expect(parsePeriod('not-a-date')).toBeNull()
  })

  it('accepts a Date object and returns yyyy-mm-01', () => {
    expect(parsePeriod(new Date('2026-03-15'))).toBe('2026-03-01')
  })
})

describe('parseRows', () => {
  const mapping = {
    siret: 'SIRET',
    period: 'Période',
    amount: 'Montant',
    activity_line: 'Ligne'
  }

  it('produces valid ParsedLine for a good row', () => {
    const rows = [
      { SIRET: '123 456 789 00010', Période: '2026-03', Montant: '1 500,00', Ligne: 'consulting' }
    ]
    const { lines, errors } = parseRows(rows, mapping)
    expect(errors).toHaveLength(0)
    expect(lines).toHaveLength(1)
    expect(lines[0].siret).toBe('12345678900010')
    expect(lines[0].period).toBe('2026-03-01')
    expect(lines[0].amount).toBe(1500)
    expect(lines[0].activity_line).toBe('consulting')
    expect(lines[0].raw).toEqual(rows[0])
  })

  it('sets activity_line to null when mapping key absent', () => {
    const mappingNoLine = { siret: 'SIRET', period: 'Période', amount: 'Montant' }
    const rows = [
      { SIRET: '12345678900010', Période: '2026-03', Montant: '500' }
    ]
    const { lines } = parseRows(rows, mappingNoLine)
    expect(lines[0].activity_line).toBeNull()
  })

  it('sends row to errors when siret is missing', () => {
    const rows = [
      { SIRET: '', Période: '2026-03', Montant: '500' }
    ]
    const { lines, errors } = parseRows(rows, mapping)
    expect(lines).toHaveLength(0)
    expect(errors).toHaveLength(1)
    expect(errors[0].row).toBe(0)
    expect(errors[0].reason).toMatch(/siret/i)
  })

  it('sends row to errors when period is unparseable', () => {
    const rows = [
      { SIRET: '12345678900010', Période: 'bad', Montant: '500' }
    ]
    const { lines, errors } = parseRows(rows, mapping)
    expect(lines).toHaveLength(0)
    expect(errors).toHaveLength(1)
    expect(errors[0].reason).toMatch(/period/i)
  })

  it('sends row to errors when amount is unparseable', () => {
    const rows = [
      { SIRET: '12345678900010', Période: '2026-03', Montant: 'N/A' }
    ]
    const { lines, errors } = parseRows(rows, mapping)
    expect(lines).toHaveLength(0)
    expect(errors).toHaveLength(1)
    expect(errors[0].reason).toMatch(/amount/i)
  })

  it('mixes good and bad rows correctly', () => {
    const rows = [
      { SIRET: '12345678900010', Période: '2026-03', Montant: '100' },
      { SIRET: '', Période: '2026-03', Montant: '100' }
    ]
    const { lines, errors } = parseRows(rows, mapping)
    expect(lines).toHaveLength(1)
    expect(errors).toHaveLength(1)
    expect(errors[0].row).toBe(1)
  })
})

describe('matchBySiret', () => {
  const accounts = [
    { id: 'acc-1', siret: '12345678900010', name: 'Acme' },
    { id: 'acc-2', siret: '98765432100020', name: 'Beta' },
    { id: 'acc-3', siret: null, name: 'NoSiret' }
  ]

  const makeLine = (siret: string): import('../../app/domain/importParser').ParsedLine => ({
    siret,
    period: '2026-03-01',
    amount: 100,
    activity_line: null,
    raw: {}
  })

  it('matches line to account by normalized siret', () => {
    const lines = [makeLine('12345678900010')]
    const { matched, unmatched } = matchBySiret(lines, accounts)
    expect(matched).toHaveLength(1)
    expect(matched[0].account.id).toBe('acc-1')
    expect(unmatched).toHaveLength(0)
  })

  it('places unmatched lines in unmatched bucket', () => {
    const lines = [makeLine('00000000000000')]
    const { matched, unmatched } = matchBySiret(lines, accounts)
    expect(matched).toHaveLength(0)
    expect(unmatched).toHaveLength(1)
  })

  it('never matches account with null siret', () => {
    const lines = [makeLine('')]
    const { matched, unmatched } = matchBySiret(lines, accounts)
    expect(matched).toHaveLength(0)
    expect(unmatched).toHaveLength(1)
  })

  it('matches multiple lines to same account', () => {
    const lines = [makeLine('12345678900010'), makeLine('12345678900010')]
    const { matched, unmatched } = matchBySiret(lines, accounts)
    expect(matched).toHaveLength(2)
    expect(matched[0].account.id).toBe('acc-1')
    expect(matched[1].account.id).toBe('acc-1')
    expect(unmatched).toHaveLength(0)
  })

  it('normalizes siret on both sides before comparing (strips spaces)', () => {
    const accountsWithSpaces = [{ id: 'acc-x', siret: '123 456 789 00010', name: 'Test' }]
    const lines = [makeLine('12345678900010')]
    const { matched } = matchBySiret(lines, accountsWithSpaces)
    expect(matched).toHaveLength(1)
    expect(matched[0].account.id).toBe('acc-x')
  })
})
