<script setup lang="ts">
import { z } from 'zod'
import type { TableColumn } from '@nuxt/ui'
import type { Database } from '~/types/database'
import { filterAccounts } from '~/utils/filterAccounts'

type Account = Database['public']['Tables']['accounts']['Row']

const toast = useToast()
const resource = useClientResource<Account>('accounts')
const rows = ref<Account[]>([])
const loading = ref(true)
const open = ref(false)
const editing = ref<Account | null>(null)

const searchQuery = ref('')
const statusFilter = ref<string | null>(null)

const statusItems = [
  { label: 'Tous', value: null },
  { label: 'Suspect', value: 'suspect' },
  { label: 'Prospect', value: 'prospect' },
  { label: 'Client', value: 'client' }
]

const filteredRows = computed(() =>
  filterAccounts(rows.value, { search: searchQuery.value, status: statusFilter.value })
)

const schema = z.object({
  name: z.string().min(1, 'Nom requis'),
  siret: z.string().regex(/^\d{14}$/, 'SIRET = 14 chiffres').optional().or(z.literal('')),
  effectif: z.string().optional(),
  secteur: z.string().optional(),
  marche_public: z.boolean().optional(),
  current_status: z.enum(['suspect', 'prospect', 'client'])
})
type State = z.output<typeof schema>
const state = reactive<Partial<State>>({
  name: '',
  siret: '',
  effectif: '',
  secteur: '',
  marche_public: false,
  current_status: 'suspect'
})

async function refresh() {
  loading.value = true
  try {
    rows.value = await resource.list({ order: 'name', ascending: true })
  } catch {
    toast.add({ title: 'Erreur de chargement', color: 'error' })
  } finally {
    loading.value = false
  }
}
onMounted(refresh)

function openCreate() {
  editing.value = null
  Object.assign(state, {
    name: '',
    siret: '',
    effectif: '',
    secteur: '',
    marche_public: false,
    current_status: 'suspect'
  })
  open.value = true
}

function openEdit(row: Account) {
  editing.value = row
  Object.assign(state, {
    name: row.name,
    siret: row.siret ?? '',
    effectif: row.effectif ?? '',
    secteur: row.secteur ?? '',
    marche_public: row.marche_public,
    current_status: row.current_status
  })
  open.value = true
}

async function onSubmit() {
  try {
    const payload = {
      name: state.name,
      siret: state.siret === '' ? null : (state.siret ?? null),
      effectif: state.effectif === '' ? null : (state.effectif ?? null),
      secteur: state.secteur === '' ? null : (state.secteur ?? null),
      marche_public: state.marche_public ?? false,
      current_status: state.current_status ?? 'suspect'
    }
    if (editing.value) {
      await resource.update(editing.value.id, payload)
    } else {
      await resource.create(payload)
    }
    toast.add({ title: 'Enregistré', color: 'success' })
    open.value = false
    await refresh()
  } catch {
    toast.add({ title: 'Échec de l\'enregistrement', color: 'error' })
  }
}

async function onDelete(row: Account) {
  try {
    await resource.remove(row.id)
    toast.add({ title: 'Supprimé', color: 'success' })
    await refresh()
  } catch {
    toast.add({ title: 'Échec de la suppression', color: 'error' })
  }
}

const statusBadgeColor: Record<string, 'neutral' | 'warning' | 'success'> = {
  suspect: 'neutral',
  prospect: 'warning',
  client: 'success'
}

const columns: TableColumn<Account>[] = [
  { accessorKey: 'name', header: 'Entreprise' },
  { accessorKey: 'siret', header: 'SIRET' },
  { accessorKey: 'current_status', header: 'Statut' },
  { accessorKey: 'effectif', header: 'Effectif' },
  { accessorKey: 'secteur', header: 'Secteur' },
  { accessorKey: 'marche_public', header: 'Marché public' },
  { id: 'actions' }
]
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <h1 class="text-xl font-semibold">
        Comptes
      </h1>
      <UButton
        icon="i-lucide-plus"
        @click="openCreate"
      >
        Ajouter
      </UButton>
    </div>

    <div class="flex gap-3">
      <UInput
        v-model="searchQuery"
        placeholder="Rechercher par nom ou SIRET…"
        icon="i-lucide-search"
        class="w-72"
      />
      <USelectMenu
        v-model="statusFilter"
        :items="statusItems"
        value-key="value"
        placeholder="Tous les statuts"
        class="w-48"
      />
    </div>

    <UTable
      :data="filteredRows"
      :columns="columns"
      :loading="loading"
    >
      <template #name-cell="{ row }">
        <NuxtLink
          :to="`/comptes/${row.original.id}`"
          class="font-medium hover:underline"
        >
          {{ row.original.name }}
        </NuxtLink>
      </template>

      <template #current_status-cell="{ row }">
        <UBadge
          :color="statusBadgeColor[row.original.current_status] ?? 'neutral'"
          variant="subtle"
        >
          {{ row.original.current_status }}
        </UBadge>
      </template>

      <template #marche_public-cell="{ row }">
        {{ row.original.marche_public ? '✓' : '—' }}
      </template>

      <template #actions-cell="{ row }">
        <div class="flex gap-1 justify-end">
          <UButton
            icon="i-lucide-pencil"
            color="neutral"
            variant="ghost"
            size="sm"
            @click="openEdit(row.original)"
          />
          <UButton
            icon="i-lucide-trash-2"
            color="error"
            variant="ghost"
            size="sm"
            @click="onDelete(row.original)"
          />
        </div>
      </template>
    </UTable>

    <UModal
      v-model:open="open"
      :title="editing ? 'Modifier le compte' : 'Nouveau compte'"
    >
      <template #body>
        <UForm
          :schema="schema"
          :state="state"
          class="space-y-4"
          @submit="onSubmit"
        >
          <UFormField
            name="name"
            label="Nom de l'entreprise"
            required
          >
            <UInput
              v-model="state.name"
              class="w-full"
            />
          </UFormField>

          <UFormField
            name="siret"
            label="SIRET"
          >
            <UInput
              v-model="state.siret"
              inputmode="numeric"
              placeholder="14 chiffres"
              class="w-full"
            />
          </UFormField>

          <UFormField
            name="current_status"
            label="Statut"
          >
            <USelectMenu
              v-model="state.current_status"
              :items="[
                { label: 'Suspect', value: 'suspect' },
                { label: 'Prospect', value: 'prospect' },
                { label: 'Client', value: 'client' }
              ]"
              value-key="value"
              class="w-full"
            />
          </UFormField>

          <UFormField
            name="effectif"
            label="Effectif"
          >
            <UInput
              v-model="state.effectif"
              placeholder="ex. 50-200"
              class="w-full"
            />
          </UFormField>

          <UFormField
            name="secteur"
            label="Secteur"
          >
            <UInput
              v-model="state.secteur"
              placeholder="ex. Industrie"
              class="w-full"
            />
          </UFormField>

          <UFormField
            name="marche_public"
            label="Soumis aux marchés publics"
          >
            <USwitch
              v-model="state.marche_public"
            />
          </UFormField>

          <div class="flex justify-end gap-2">
            <UButton
              color="neutral"
              variant="ghost"
              @click="open = false"
            >
              Annuler
            </UButton>
            <UButton type="submit">
              Enregistrer
            </UButton>
          </div>
        </UForm>
      </template>
    </UModal>
  </div>
</template>
