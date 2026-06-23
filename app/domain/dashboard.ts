import {
  accountTotal,
  aggregateByDirection,
  eventEfficiency as computeEventEfficiency,
  monthlyTotals
} from './attribution'

export type AccountRow = {
  id: string
  current_status: string
}

export type ParticipationRow = {
  account_id: string
  event_id: string
  direction: 'direct' | 'indirect'
  category: string | null
  entered_network_at: string | null
}

export type RevenueLineRow = {
  account_id: string
  period: string
  amount: number
}

export type EventRow = {
  id: string
  name: string
  partnership_id: string | null
}

export type PartnershipRow = {
  id: string
  name: string
}

export type DashboardData = {
  business: { direct: number, indirect: number, total: number }
  leads: { participations: number, accounts: number }
  statusCounts: { suspect: number, prospect: number, client: number, clientPct: number }
  topPartnerships: { partnership_id: string | null, name: string, leads: number }[]
  byCategory: { category: string, leads: number }[]
  eventEfficiency: { event_id: string, name: string, total: number, converted: number, rate: number }[]
  monthly: { period: string, amount: number }[]
}

export type BuildDashboardInput = {
  accounts: AccountRow[]
  participations: ParticipationRow[]
  revenueLines: RevenueLineRow[]
  events: EventRow[]
  partnerships: PartnershipRow[]
}

export function buildDashboard(input: BuildDashboardInput): DashboardData {
  const { accounts, participations, revenueLines, events, partnerships } = input

  // Build lookup maps
  const eventsMap = new Map<string, EventRow>()
  for (const event of events) {
    eventsMap.set(event.id, event)
  }

  const partnershipsMap = new Map<string, PartnershipRow>()
  for (const partnership of partnerships) {
    partnershipsMap.set(partnership.id, partnership)
  }

  // Group revenueLines by account_id
  const linesByAccount = new Map<string, RevenueLineRow[]>()
  for (const line of revenueLines) {
    const existing = linesByAccount.get(line.account_id) ?? []
    existing.push(line)
    linesByAccount.set(line.account_id, existing)
  }

  // totalsByAccount: Map<account_id, accountTotal>
  const totalsByAccount = new Map<string, number>()
  for (const [accountId, lines] of linesByAccount.entries()) {
    totalsByAccount.set(accountId, accountTotal(lines))
  }

  // business
  const { direct, indirect } = aggregateByDirection(participations, totalsByAccount)
  const business = { direct, indirect, total: direct + indirect }

  // leads
  const distinctAccounts = new Set<string>()
  for (const p of participations) {
    distinctAccounts.add(p.account_id)
  }
  const leads = { participations: participations.length, accounts: distinctAccounts.size }

  // statusCounts
  let suspect = 0
  let prospect = 0
  let client = 0
  for (const account of accounts) {
    if (account.current_status === 'suspect') suspect++
    else if (account.current_status === 'prospect') prospect++
    else if (account.current_status === 'client') client++
  }
  const clientPct = accounts.length > 0 ? client / accounts.length : 0
  const statusCounts = { suspect, prospect, client, clientPct }

  // topPartnerships: group participations by partnership (via event→partnership)
  const partnershipLeads = new Map<string | null, number>()
  for (const p of participations) {
    const event = eventsMap.get(p.event_id)
    const partnershipKey = event?.partnership_id ?? null
    const current = partnershipLeads.get(partnershipKey) ?? 0
    partnershipLeads.set(partnershipKey, current + 1)
  }
  const topPartnerships = Array.from(partnershipLeads.entries())
    .map(([partnershipId, leadsCount]) => {
      const name =
        partnershipId !== null
          ? (partnershipsMap.get(partnershipId)?.name ?? 'Sans partenariat')
          : 'Sans partenariat'
      return { partnership_id: partnershipId, name, leads: leadsCount }
    })
    .sort((a, b) => b.leads - a.leads)

  // byCategory: group participations by category (null/'' → "Sans catégorie")
  const categoryLeads = new Map<string, number>()
  for (const p of participations) {
    const category = p.category !== null && p.category !== '' ? p.category : 'Sans catégorie'
    const current = categoryLeads.get(category) ?? 0
    categoryLeads.set(category, current + 1)
  }
  const byCategory = Array.from(categoryLeads.entries())
    .map(([category, leadsCount]) => ({ category, leads: leadsCount }))
    .sort((a, b) => b.leads - a.leads)

  // eventEfficiency: accounts with any revenue
  const accountsWithRevenue = new Set<string>()
  for (const line of revenueLines) {
    accountsWithRevenue.add(line.account_id)
  }
  const efficiencyRows = computeEventEfficiency(participations, accountsWithRevenue)
  const eventEfficiency = efficiencyRows.map(row => ({
    ...row,
    name: eventsMap.get(row.event_id)?.name ?? row.event_id
  }))

  // monthly
  const monthly = monthlyTotals(revenueLines)

  return {
    business,
    leads,
    statusCounts,
    topPartnerships,
    byCategory,
    eventEfficiency,
    monthly
  }
}
