interface PeriodPair {
  account_id: string
  period: string
}

export function findDuplicatePeriods(
  toImport: PeriodPair[],
  existing: PeriodPair[]
): PeriodPair[] {
  const existingKeys = new Set<string>(
    existing.map(r => `${r.account_id}|${r.period}`)
  )
  const seen = new Set<string>()
  const result: PeriodPair[] = []
  for (const pair of toImport) {
    const key = `${pair.account_id}|${pair.period}`
    if (existingKeys.has(key) && !seen.has(key)) {
      seen.add(key)
      result.push(pair)
    }
  }
  return result
}
