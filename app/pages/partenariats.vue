<script setup lang="ts">
import { z } from 'zod'
import type { TableColumn } from '@nuxt/ui'
import type { Database } from '~/types/database'

type Partnership = Database['public']['Tables']['partnerships']['Row']

const toast = useToast()
const resource = useClientResource<Partnership>('partnerships')
const rows = ref<Partnership[]>([])
const loading = ref(true)
const open = ref(false)
const editing = ref<Partnership | null>(null)

const schema = z.object({
  name: z.string().min(1, 'Nom requis'),
  type: z.string().optional(),
  notes: z.string().optional()
})
type State = z.output<typeof schema>
const state = reactive<Partial<State>>({ name: '', type: '', notes: '' })

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
  Object.assign(state, { name: '', type: '', notes: '' })
  open.value = true
}
function openEdit(row: Partnership) {
  editing.value = row
  Object.assign(state, { name: row.name, type: row.type ?? '', notes: row.notes ?? '' })
  open.value = true
}

async function onSubmit() {
  try {
    if (editing.value) {
      await resource.update(editing.value.id, { ...state })
    } else {
      await resource.create({ ...state })
    }
    toast.add({ title: 'Enregistré', color: 'success' })
    open.value = false
    await refresh()
  } catch {
    toast.add({ title: 'Échec de l\'enregistrement', color: 'error' })
  }
}

async function onDelete(row: Partnership) {
  try {
    await resource.remove(row.id)
    toast.add({ title: 'Supprimé', color: 'success' })
    await refresh()
  } catch {
    toast.add({ title: 'Échec de la suppression', color: 'error' })
  }
}

const columns: TableColumn<Partnership>[] = [
  { accessorKey: 'name', header: 'Nom' },
  { accessorKey: 'type', header: 'Type' },
  { id: 'actions' }
]
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <h1 class="text-xl font-semibold">
        Partenariats
      </h1>
      <UButton
        icon="i-lucide-plus"
        @click="openCreate"
      >
        Ajouter
      </UButton>
    </div>

    <UTable
      :data="rows"
      :columns="columns"
      :loading="loading"
    >
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
      :title="editing ? 'Modifier le partenariat' : 'Nouveau partenariat'"
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
            name="type"
            label="Type"
          >
            <UInput
              v-model="state.type"
              placeholder="ex. Club sportif"
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
