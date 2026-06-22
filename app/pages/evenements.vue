<script setup lang="ts">
import { z } from 'zod'
import type { TableColumn } from '@nuxt/ui'
import type { Database } from '~/types/database'

type EventRow = Database['public']['Tables']['events']['Row']
type Partnership = Database['public']['Tables']['partnerships']['Row']

const toast = useToast()
const resource = useClientResource<EventRow>('events')
const partResource = useClientResource<Partnership>('partnerships')

const rows = ref<EventRow[]>([])
const partnerships = ref<Partnership[]>([])
const loading = ref(true)
const open = ref(false)
const editing = ref<EventRow | null>(null)
const filterPartnerId = ref<string | null>(null)

const partnershipMap = computed(() => {
  const map = new Map<string, string>()
  for (const p of partnerships.value) {
    map.set(p.id, p.name)
  }
  return map
})

const partnershipItems = computed(() =>
  partnerships.value.map(p => ({ label: p.name, value: p.id }))
)

const filterItems = computed(() => [
  { label: 'Tous les partenariats', value: null },
  ...partnershipItems.value
])

const filteredRows = computed(() => {
  if (!filterPartnerId.value) return rows.value
  return rows.value.filter(r => r.partnership_id === filterPartnerId.value)
})

const schema = z.object({
  name: z.string().min(1, 'Nom requis'),
  partnership_id: z.string().uuid().nullable().optional(),
  type: z.string().optional(),
  date: z.string().optional(),
  lieu: z.string().optional(),
  notes: z.string().optional()
})
type State = z.output<typeof schema>
const state = reactive<Partial<State>>({
  name: '',
  partnership_id: null,
  type: '',
  date: '',
  lieu: '',
  notes: ''
})

async function refresh() {
  loading.value = true
  try {
    [rows.value, partnerships.value] = await Promise.all([
      resource.list({ order: 'date', ascending: false }),
      partResource.list({ order: 'name', ascending: true })
    ])
  } catch {
    toast.add({ title: 'Erreur de chargement', color: 'error' })
  } finally {
    loading.value = false
  }
}
onMounted(refresh)

function openCreate() {
  editing.value = null
  Object.assign(state, { name: '', partnership_id: null, type: '', date: '', lieu: '', notes: '' })
  open.value = true
}

function openEdit(row: EventRow) {
  editing.value = row
  Object.assign(state, {
    name: row.name,
    partnership_id: row.partnership_id ?? null,
    type: row.type ?? '',
    date: row.date ?? '',
    lieu: row.lieu ?? '',
    notes: row.notes ?? ''
  })
  open.value = true
}

async function onSubmit() {
  try {
    const payload = {
      name: state.name!,
      partnership_id: state.partnership_id || null,
      type: state.type || null,
      date: state.date || null,
      lieu: state.lieu || null,
      notes: state.notes || null
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

async function onDelete(row: EventRow) {
  try {
    await resource.remove(row.id)
    toast.add({ title: 'Supprimé', color: 'success' })
    await refresh()
  } catch {
    toast.add({ title: 'Échec de la suppression', color: 'error' })
  }
}

const columns: TableColumn<EventRow>[] = [
  { accessorKey: 'name', header: 'Nom' },
  { id: 'partnership', header: 'Partenariat' },
  { accessorKey: 'type', header: 'Type' },
  { accessorKey: 'date', header: 'Date' },
  { accessorKey: 'lieu', header: 'Lieu' },
  { id: 'actions' }
]
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <h1 class="text-xl font-semibold">
        Événements
      </h1>
      <UButton
        icon="i-lucide-plus"
        @click="openCreate"
      >
        Ajouter
      </UButton>
    </div>

    <div class="flex items-center gap-3">
      <USelectMenu
        v-model="filterPartnerId"
        :items="filterItems"
        value-key="value"
        placeholder="Filtrer par partenariat"
        class="w-64"
        clearable
      />
    </div>

    <UTable
      :data="filteredRows"
      :columns="columns"
      :loading="loading"
    >
      <template #partnership-cell="{ row }">
        {{ row.original.partnership_id ? (partnershipMap.get(row.original.partnership_id) ?? '—') : '—' }}
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
      :title="editing ? 'Modifier l\'événement' : 'Nouvel événement'"
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
            label="Nom"
            required
          >
            <UInput
              v-model="state.name"
              class="w-full"
            />
          </UFormField>

          <UFormField
            name="partnership_id"
            label="Partenariat"
          >
            <USelectMenu
              v-model="state.partnership_id"
              :items="partnershipItems"
              value-key="value"
              placeholder="Sélectionner un partenariat"
              class="w-full"
              clearable
            />
          </UFormField>

          <UFormField
            name="type"
            label="Type"
          >
            <UInput
              v-model="state.type"
              placeholder="ex. business club, jeu concours, hospitalité"
              class="w-full"
            />
          </UFormField>

          <UFormField
            name="date"
            label="Date"
          >
            <UInput
              v-model="state.date"
              type="date"
              class="w-full"
            />
          </UFormField>

          <UFormField
            name="lieu"
            label="Lieu"
          >
            <UInput
              v-model="state.lieu"
              class="w-full"
            />
          </UFormField>

          <UFormField
            name="notes"
            label="Notes"
          >
            <UTextarea
              v-model="state.notes"
              :rows="3"
              class="w-full"
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
