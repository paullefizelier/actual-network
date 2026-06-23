<script setup lang="ts">
import { VisXYContainer, VisLine, VisAxis } from '@unovis/vue'
import type { TableColumn } from '@nuxt/ui'
import type { DashboardData, PartnershipRow } from '~/domain/dashboard'

const eurFormatter = new Intl.NumberFormat('fr-FR', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0
})

function formatEur(amount: number): string {
  return eurFormatter.format(amount)
}

function formatPct(ratio: number): string {
  return `${(ratio * 100).toFixed(1)} %`
}

// Dashboard composable
const { data, loading, load } = useDashboard()

// Partnerships for filter
const partnershipResource = useClientResource<PartnershipRow>('partnerships')
const partnerships = ref<PartnershipRow[]>([])

// Filters
const filterFrom = ref<string | undefined>(undefined)
const filterTo = ref<string | undefined>(undefined)
const filterPartnershipId = ref<string | undefined>(undefined)

const partnershipItems = computed(() =>
  partnerships.value.map(p => ({ label: p.name, value: p.id }))
)

function buildFilters() {
  return {
    from: filterFrom.value,
    to: filterTo.value,
    partnershipId: filterPartnershipId.value
  }
}

async function applyFilters() {
  await load(buildFilters())
}

function resetFilters() {
  filterFrom.value = undefined
  filterTo.value = undefined
  filterPartnershipId.value = undefined
  load()
}

// Empty state
const isEmpty = computed(() => {
  if (!data.value) return true
  return data.value.leads.participations === 0 && data.value.business.total === 0
})

const hasMonthly = computed(() =>
  (data.value?.monthly.length ?? 0) > 0
)

// Tables
type TopPartnershipRow = DashboardData['topPartnerships'][number]
type ByCategoryRow = DashboardData['byCategory'][number]
type EventEfficiencyRow = DashboardData['eventEfficiency'][number] & { rateLabel: string }

const topPartnershipsColumns: TableColumn<TopPartnershipRow>[] = [
  { accessorKey: 'name', header: 'Partenariat' },
  { accessorKey: 'leads', header: 'Leads' }
]

const byCategoryColumns: TableColumn<ByCategoryRow>[] = [
  { accessorKey: 'category', header: 'Catégorie' },
  { accessorKey: 'leads', header: 'Leads' }
]

const eventEfficiencyColumns: TableColumn<EventEfficiencyRow>[] = [
  { accessorKey: 'name', header: 'Événement' },
  { accessorKey: 'total', header: 'Participations' },
  { accessorKey: 'converted', header: 'Convertis' },
  { accessorKey: 'rateLabel', header: 'Taux' }
]

const eventEfficiencyRows = computed<EventEfficiencyRow[]>(() =>
  (data.value?.eventEfficiency ?? [])
    .slice()
    .sort((a, b) => b.rate - a.rate)
    .map(row => ({
      ...row,
      rateLabel: formatPct(row.rate)
    }))
)

// Chart accessors
const chartX = (_d: { period: string, amount: number }, i: number) => i
const chartY = (d: { period: string, amount: number }) => d.amount

onMounted(async () => {
  const [, loadedPartnerships] = await Promise.all([
    load(),
    partnershipResource.list()
  ])
  partnerships.value = loadedPartnerships
})
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <h1 class="text-xl font-semibold">
        Pilotage réseau
      </h1>
    </div>

    <!-- Filters bar -->
    <UCard>
      <div class="flex flex-wrap items-end gap-4">
        <div class="flex flex-col gap-1">
          <label class="text-xs text-muted font-medium uppercase tracking-wide">Période — du</label>
          <UInput
            v-model="filterFrom"
            type="date"
            class="w-44"
            @change="applyFilters"
          />
        </div>
        <div class="flex flex-col gap-1">
          <label class="text-xs text-muted font-medium uppercase tracking-wide">Au</label>
          <UInput
            v-model="filterTo"
            type="date"
            class="w-44"
            @change="applyFilters"
          />
        </div>
        <div class="flex flex-col gap-1">
          <label class="text-xs text-muted font-medium uppercase tracking-wide">Partenariat</label>
          <USelectMenu
            v-model="filterPartnershipId"
            :items="partnershipItems"
            value-key="value"
            placeholder="Tous"
            clearable
            class="w-56"
            @update:model-value="applyFilters"
          />
        </div>
        <UButton
          color="neutral"
          variant="ghost"
          icon="i-lucide-rotate-ccw"
          @click="resetFilters"
        >
          Réinitialiser
        </UButton>
      </div>
    </UCard>

    <!-- Loading -->
    <div
      v-if="loading"
      class="flex justify-center py-16"
    >
      <UIcon
        name="i-lucide-loader-circle"
        class="size-8 animate-spin text-muted"
      />
    </div>

    <template v-else-if="data">
      <!-- Empty state -->
      <UAlert
        v-if="isEmpty"
        color="neutral"
        icon="i-lucide-inbox"
        title="Aucune donnée"
        description="Aucune donnée — importez du CA et saisissez des leads."
      />

      <template v-else>
        <!-- KPI grid -->
        <div class="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <!-- Business direct -->
          <UCard>
            <p class="text-xs text-muted font-medium uppercase tracking-wide mb-1">
              CA direct
            </p>
            <p class="text-lg font-semibold">
              {{ formatEur(data.business.direct) }}
            </p>
          </UCard>

          <!-- Business indirect -->
          <UCard>
            <p class="text-xs text-muted font-medium uppercase tracking-wide mb-1">
              CA indirect
            </p>
            <p class="text-lg font-semibold">
              {{ formatEur(data.business.indirect) }}
            </p>
          </UCard>

          <!-- Business total -->
          <UCard>
            <p class="text-xs text-muted font-medium uppercase tracking-wide mb-1">
              CA total réseau
            </p>
            <p class="text-lg font-semibold">
              {{ formatEur(data.business.total) }}
            </p>
          </UCard>

          <!-- Leads -->
          <UCard>
            <p class="text-xs text-muted font-medium uppercase tracking-wide mb-1">
              Volume de leads
            </p>
            <p class="text-lg font-semibold">
              {{ data.leads.participations }}
              <span class="text-sm font-normal text-muted">participations</span>
            </p>
            <p class="text-sm text-muted mt-1">
              {{ data.leads.accounts }} comptes distincts
            </p>
          </UCard>

          <!-- % clients — linked to /comptes -->
          <NuxtLink
            to="/comptes"
            class="col-span-2 block hover:opacity-90 transition-opacity"
          >
            <UCard>
              <p class="text-xs text-muted font-medium uppercase tracking-wide mb-1">
                % clients
              </p>
              <p class="text-lg font-semibold">
                {{ formatPct(data.statusCounts.clientPct) }}
              </p>
              <div class="flex gap-4 mt-2 text-sm text-muted">
                <span>
                  <UBadge
                    color="neutral"
                    variant="subtle"
                    size="sm"
                  >Suspect</UBadge>
                  {{ data.statusCounts.suspect }}
                </span>
                <span>
                  <UBadge
                    color="warning"
                    variant="subtle"
                    size="sm"
                  >Prospect</UBadge>
                  {{ data.statusCounts.prospect }}
                </span>
                <span>
                  <UBadge
                    color="success"
                    variant="subtle"
                    size="sm"
                  >Client</UBadge>
                  {{ data.statusCounts.client }}
                </span>
              </div>
            </UCard>
          </NuxtLink>

          <!-- Nb partenariats -->
          <UCard class="col-span-2">
            <p class="text-xs text-muted font-medium uppercase tracking-wide mb-1">
              Partenariats
            </p>
            <p class="text-lg font-semibold">
              {{ data.topPartnerships.length }}
            </p>
          </UCard>
        </div>

        <!-- Tables row -->
        <div class="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <!-- Top partenariats -->
          <UCard>
            <template #header>
              <p class="text-sm font-medium">
                Top partenariats
              </p>
            </template>
            <UTable
              :data="data.topPartnerships"
              :columns="topPartnershipsColumns"
            />
          </UCard>

          <!-- Répartition par catégorie -->
          <UCard>
            <template #header>
              <p class="text-sm font-medium">
                Répartition par catégorie
              </p>
            </template>
            <UTable
              :data="data.byCategory"
              :columns="byCategoryColumns"
            />
          </UCard>
        </div>

        <!-- Efficacité par événement -->
        <UCard>
          <template #header>
            <p class="text-sm font-medium">
              Efficacité par événement
            </p>
          </template>
          <UTable
            :data="eventEfficiencyRows"
            :columns="eventEfficiencyColumns"
          />
        </UCard>

        <!-- CA mensuel global -->
        <UCard>
          <template #header>
            <p class="text-sm font-medium">
              CA mensuel global
            </p>
          </template>

          <div
            v-if="!hasMonthly"
            class="flex items-center justify-center py-12 text-sm text-muted italic"
          >
            Aucune donnée de CA sur la période
          </div>

          <ClientOnly v-else>
            <VisXYContainer
              :data="data.monthly"
              :height="240"
            >
              <VisLine
                :x="chartX"
                :y="chartY"
              />
              <VisAxis
                type="x"
                :tick-format="(i: number) => data!.monthly[i]?.period?.slice(0, 7) ?? ''"
              />
              <VisAxis type="y" />
            </VisXYContainer>
          </ClientOnly>
        </UCard>
      </template>
    </template>
  </div>
</template>
