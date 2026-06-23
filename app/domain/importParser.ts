import { normalizeSiret } from '~/utils/normalizeSiret'

export type ColumnMapping = {
  siret: string
  period: string
  amount: string
  activity_line?: string
}

export type ParsedLine = {
  siret: string
  period: string
  amount: number
  activity_line: string | null
  raw: Record<string, unknown>
}

// Strips regular whitespace, non-breaking space (U+00A0), narrow no-break space (U+202F)
// Uses RegExp constructor to avoid embedding non-ASCII literals in source
const NBSP = ' '
const NNBSP = ' '

function stripWhitespace(s: string): string {
  return s.replace(/\s/g, '').split(NBSP).join('').split(NNBSP).join('')
}

export function parseAmount(value: unknown): number | null {
  if (value === null || value === undefined) {
    return null
  }
  if (typeof value === 'number') {
    return isFinite(value) ? value : null
  }
  if (typeof value !== 'string') {
    return null
  }
  const stripped = stripWhitespace(value)
  if (stripped === '') {
    return null
  }
  let normalized: string
  if (stripped.includes('.') && !stripped.includes(',')) {
    // dot-decimal: e.g. "1234.56"
    normalized = stripped
  } else if (stripped.includes(',')) {
    // French format: comma is decimal separator, dots were thousands
    normalized = stripped.replace(/\./g, '').replace(',', '.')
  } else {
    normalized = stripped
  }
  const result = Number(normalized)
  if (isNaN(result)) {
    return null
  }
  return result
}

// Regex patterns for period parsing
const RE_YYYY_MM_DD = /^(\d{4})-(\d{2})-\d{2}$/
const RE_YYYY_MM = /^(\d{4})-(\d{2})$/
const RE_MM_YYYY = /^(\d{2})\/(\d{4})$/
const RE_DD_MM_YYYY = /^(\d{2})\/(\d{2})\/(\d{4})$/

export function parsePeriod(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null
  }
  if (value instanceof Date) {
    if (isNaN(value.getTime())) {
      return null
    }
    const year = value.getFullYear()
    const month = String(value.getMonth() + 1).padStart(2, '0')
    return `${year}-${month}-01`
  }
  if (typeof value !== 'string') {
    return null
  }
  const s = value.trim()
  const matchYMD = RE_YYYY_MM_DD.exec(s)
  if (matchYMD) {
    return `${matchYMD[1]}-${matchYMD[2]}-01`
  }
  const matchYM = RE_YYYY_MM.exec(s)
  if (matchYM) {
    return `${matchYM[1]}-${matchYM[2]}-01`
  }
  const matchMY = RE_MM_YYYY.exec(s)
  if (matchMY) {
    return `${matchMY[2]}-${matchMY[1]}-01`
  }
  // dd/mm/yyyy — French day-first: day is [1], month is [2], year is [3]
  const matchDMY = RE_DD_MM_YYYY.exec(s)
  if (matchDMY) {
    return `${matchDMY[3]}-${matchDMY[2]}-01`
  }
  return null
}

export function parseRows(
  rows: Record<string, unknown>[],
  mapping: ColumnMapping
): { lines: ParsedLine[], errors: { row: number, reason: string }[] } {
  const lines: ParsedLine[] = []
  const errors: { row: number, reason: string }[] = []

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]

    const rawSiret = row[mapping.siret]
    const siretStr = typeof rawSiret === 'string' ? rawSiret : String(rawSiret ?? '')
    const normalizedSiret = normalizeSiret(siretStr)
    if (!normalizedSiret) {
      errors.push({ row: i, reason: 'missing or invalid siret' })
      continue
    }

    const parsedPeriod = parsePeriod(row[mapping.period])
    if (parsedPeriod === null) {
      errors.push({ row: i, reason: 'invalid period' })
      continue
    }

    const parsedAmount = parseAmount(row[mapping.amount])
    if (parsedAmount === null) {
      errors.push({ row: i, reason: 'invalid amount' })
      continue
    }

    const activityLine: string | null = mapping.activity_line
      ? (typeof row[mapping.activity_line] === 'string' ? row[mapping.activity_line] as string : null)
      : null

    lines.push({
      siret: normalizedSiret,
      period: parsedPeriod,
      amount: parsedAmount,
      activity_line: activityLine,
      raw: row
    })
  }

  return { lines, errors }
}

export function matchBySiret<T extends { siret: string | null }>(
  lines: ParsedLine[],
  accounts: T[]
): { matched: { line: ParsedLine, account: T }[], unmatched: ParsedLine[] } {
  const matched: { line: ParsedLine, account: T }[] = []
  const unmatched: ParsedLine[] = []

  const accountIndex = new Map<string, T>()
  for (const account of accounts) {
    if (account.siret === null) {
      continue
    }
    const key = normalizeSiret(account.siret)
    if (key) {
      accountIndex.set(key, account)
    }
  }

  for (const line of lines) {
    const key = normalizeSiret(line.siret)
    const account = key ? accountIndex.get(key) : undefined
    if (account !== undefined) {
      matched.push({ line, account })
    } else {
      unmatched.push(line)
    }
  }

  return { matched, unmatched }
}
