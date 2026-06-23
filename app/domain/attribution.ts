export type RevenueLine = {
  account_id: string
  period: string
  amount: number
  activity_line?: string
}

export type Participation = {
  account_id: string
  event_id: string
  direction: 'direct' | 'indirect'
  entered_network_at: string | null
}

export function accountTotal(lines: RevenueLine[]): number {
  return lines.reduce((sum, line) => sum + line.amount, 0)
}

export function monthlyTotals(
  lines: RevenueLine[]
): Array<{ period: string, amount: number }> {
  const byPeriod = new Map<string, number>()

  for (const line of lines) {
    const current = byPeriod.get(line.period) ?? 0
    byPeriod.set(line.period, current + line.amount)
  }

  const sorted = Array.from(byPeriod.entries())
    .sort(([periodA], [periodB]) => periodA.localeCompare(periodB))
    .map(([period, amount]) => ({ period, amount }))

  return sorted
}

export function computeLift(
  lines: RevenueLine[],
  firstParticipation: string | null
): { before: number, after: number, delta: number } {
  let before = 0
  let after = 0

  for (const line of lines) {
    if (firstParticipation === null) {
      after += line.amount
    } else if (line.period < firstParticipation) {
      before += line.amount
    } else {
      after += line.amount
    }
  }

  return {
    before,
    after,
    delta: after - before
  }
}

export function aggregateByDirection(
  participations: Participation[],
  totalsByAccount: Map<string, number>
): { direct: number, indirect: number } {
  const seenAccounts = new Set<string>()
  let direct = 0
  let indirect = 0

  // First pass: determine direction for each account
  const accountDirection = new Map<string, 'direct' | 'indirect'>()

  for (const participation of participations) {
    if (!accountDirection.has(participation.account_id)) {
      accountDirection.set(participation.account_id, participation.direction)
    } else if (participation.direction === 'direct') {
      // Direct wins over indirect
      accountDirection.set(participation.account_id, 'direct')
    }
  }

  // Second pass: aggregate by final direction
  for (const [accountId, direction] of accountDirection.entries()) {
    if (!seenAccounts.has(accountId)) {
      seenAccounts.add(accountId)
      const amount = totalsByAccount.get(accountId) ?? 0
      if (direction === 'direct') {
        direct += amount
      } else {
        indirect += amount
      }
    }
  }

  return { direct, indirect }
}

export function eventEfficiency(
  participations: Participation[],
  accountsWithRevenue: Set<string>
): Array<{
  event_id: string
  total: number
  converted: number
  rate: number
}> {
  const byEvent = new Map<
    string,
    { total: number, converted: number }
  >()

  for (const participation of participations) {
    const current = byEvent.get(participation.event_id) ?? {
      total: 0,
      converted: 0
    }

    current.total += 1
    if (accountsWithRevenue.has(participation.account_id)) {
      current.converted += 1
    }

    byEvent.set(participation.event_id, current)
  }

  const results = Array.from(byEvent.entries())
    .map(([eventId, { total, converted }]) => ({
      event_id: eventId,
      total,
      converted,
      rate: total > 0 ? converted / total : 0
    }))
    .sort((a, b) => a.event_id.localeCompare(b.event_id))

  return results
}
