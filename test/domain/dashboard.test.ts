import { describe, it, expect } from 'vitest'
import { buildDashboard } from '../../app/domain/dashboard'

const accounts = [
  { id: 'acc1', current_status: 'client' },
  { id: 'acc2', current_status: 'prospect' }
]

const partnerships = [
  { id: 'p1', name: 'Partenaire Alpha' },
  { id: 'p2', name: 'Partenaire Beta' }
]

const events = [
  { id: 'e1', name: 'Événement 1', partnership_id: 'p1' },
  { id: 'e2', name: 'Événement 2', partnership_id: 'p2' }
]

// acc1 participates in e1 (direct, "Réseau") and e2 (direct, "Réseau")
// acc2 participates in e1 only (indirect, null category)
const participations = [
  { account_id: 'acc1', event_id: 'e1', direction: 'direct' as const, category: 'Réseau', entered_network_at: '2026-01-15' },
  { account_id: 'acc2', event_id: 'e1', direction: 'indirect' as const, category: null, entered_network_at: '2026-01-20' },
  { account_id: 'acc1', event_id: 'e2', direction: 'direct' as const, category: 'Réseau', entered_network_at: '2026-02-10' }
]

// Revenue on acc1 only (acc2 has none)
const revenueLines = [
  { account_id: 'acc1', period: '2026-01-01', amount: 100 },
  { account_id: 'acc1', period: '2026-02-01', amount: 200 }
]

describe('buildDashboard', () => {
  it(
    'computes every DashboardData field from a two-account fixture',
    () => {
      const result = buildDashboard({ accounts, participations, revenueLines, events, partnerships })

      // business: acc1 is direct (300 total), acc2 is indirect (0 total)
      expect(result.business).toEqual({ direct: 300, indirect: 0, total: 300 })

      // leads: 3 participations, 2 distinct accounts
      expect(result.leads).toEqual({ participations: 3, accounts: 2 })

      // statusCounts: 1 client, 1 prospect, 0 suspect; clientPct = 0.5
      expect(result.statusCounts).toEqual({
        suspect: 0,
        prospect: 1,
        client: 1,
        clientPct: 0.5
      })

      // topPartnerships: p1 has 2 leads (acc1+acc2 via e1), p2 has 1 lead (acc1 via e2)
      expect(result.topPartnerships).toEqual([
        { partnership_id: 'p1', name: 'Partenaire Alpha', leads: 2 },
        { partnership_id: 'p2', name: 'Partenaire Beta', leads: 1 }
      ])

      // byCategory: "Réseau"=2 (acc1 in e1 and e2), "Sans catégorie"=1 (acc2 in e1 with null)
      expect(result.byCategory).toEqual([
        { category: 'Réseau', leads: 2 },
        { category: 'Sans catégorie', leads: 1 }
      ])

      // eventEfficiency: e1 has 2 participations (acc1 has revenue → converted=1, rate=0.5)
      //                  e2 has 1 participation (acc1 has revenue → converted=1, rate=1)
      // sorted by event_id asc per attribution.ts
      expect(result.eventEfficiency).toEqual([
        { event_id: 'e1', name: 'Événement 1', total: 2, converted: 1, rate: 0.5 },
        { event_id: 'e2', name: 'Événement 2', total: 1, converted: 1, rate: 1 }
      ])

      // monthly: acc1 lines only (acc2 has none)
      expect(result.monthly).toEqual([
        { period: '2026-01-01', amount: 100 },
        { period: '2026-02-01', amount: 200 }
      ])
    }
  )

  it(
    'handles "Sans partenariat" when event has no partnership_id',
    () => {
      const result = buildDashboard({
        accounts: [{ id: 'acc1', current_status: 'client' }],
        participations: [
          { account_id: 'acc1', event_id: 'e1', direction: 'direct' as const, category: null, entered_network_at: null }
        ],
        revenueLines: [],
        events: [{ id: 'e1', name: 'Événement Solo', partnership_id: null }],
        partnerships: []
      })

      expect(result.topPartnerships).toEqual([
        { partnership_id: null, name: 'Sans partenariat', leads: 1 }
      ])

      expect(result.byCategory).toEqual([
        { category: 'Sans catégorie', leads: 1 }
      ])
    }
  )

  it(
    'returns zero clientPct when there are no accounts',
    () => {
      const result = buildDashboard({
        accounts: [],
        participations: [],
        revenueLines: [],
        events: [],
        partnerships: []
      })

      expect(result.statusCounts.clientPct).toBe(0)
    }
  )
})
