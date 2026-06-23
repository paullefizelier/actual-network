import type { Ref } from 'vue'
import { ref } from 'vue'
import {
  buildDashboard,
  type AccountRow,
  type ParticipationRow,
  type RevenueLineRow,
  type EventRow,
  type PartnershipRow,
  type DashboardData
} from '~/domain/dashboard'

export type DashboardFilters = {
  from?: string
  to?: string
  partnershipId?: string
}

export function useDashboard(): {
  data: Ref<DashboardData | null>
  loading: Ref<boolean>
  load: (filters?: DashboardFilters) => Promise<void>
} {
  const data = ref<DashboardData | null>(null)
  const loading = ref(false)

  const accountResource = useClientResource<AccountRow>('accounts')
  const participationResource = useClientResource<ParticipationRow>('participations')
  const revenueLineResource = useClientResource<RevenueLineRow>('revenue_lines')
  const eventResource = useClientResource<EventRow>('events')
  const partnershipResource = useClientResource<PartnershipRow>('partnerships')

  async function load(filters?: DashboardFilters): Promise<void> {
    loading.value = true
    try {
      const [accounts, allParticipations, allRevenueLines, allEvents, partnerships]
        = await Promise.all([
          accountResource.list(),
          participationResource.list(),
          revenueLineResource.list(),
          eventResource.list(),
          partnershipResource.list()
        ])

      // Filter events by partnershipId if provided
      let filteredEvents = allEvents
      if (filters?.partnershipId !== undefined) {
        filteredEvents = allEvents.filter(
          e => e.partnership_id === filters.partnershipId
        )
      }

      // Determine which event_ids belong to the filtered set
      const allowedEventIds = new Set<string>(filteredEvents.map(e => e.id))

      // Filter participations: by event set and optional entered_network_at range
      let filteredParticipations = allParticipations
      if (filters?.partnershipId !== undefined) {
        filteredParticipations = filteredParticipations.filter(
          p => allowedEventIds.has(p.event_id)
        )
      }
      if (filters?.from !== undefined) {
        const from = filters.from
        filteredParticipations = filteredParticipations.filter(
          p => p.entered_network_at !== null && p.entered_network_at >= from
        )
      }
      if (filters?.to !== undefined) {
        const to = filters.to
        filteredParticipations = filteredParticipations.filter(
          p => p.entered_network_at !== null && p.entered_network_at <= to
        )
      }

      // Filter revenueLines by period range if provided
      let filteredRevenueLines = allRevenueLines
      if (filters?.from !== undefined) {
        const from = filters.from
        filteredRevenueLines = filteredRevenueLines.filter(r => r.period >= from)
      }
      if (filters?.to !== undefined) {
        const to = filters.to
        filteredRevenueLines = filteredRevenueLines.filter(r => r.period <= to)
      }

      data.value = buildDashboard({
        accounts,
        participations: filteredParticipations,
        revenueLines: filteredRevenueLines,
        events: filteredEvents,
        partnerships
      })
    } finally {
      loading.value = false
    }
  }

  return { data, loading, load }
}
