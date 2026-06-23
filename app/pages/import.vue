<script setup lang="ts">
import * as XLSX from 'xlsx'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { TableColumn } from '@nuxt/ui'
import type { Database } from '~/types/database'
import { parseRows, matchBySiret } from '~/domain/importParser'
import type { ColumnMapping, ParsedLine } from '~/domain/importParser'

type Account = Database['public']['Tables']['accounts']['Row']
type RevenueImport = Database['public']['Tables']['revenue_imports']['Row']

useHead({ title: 'Import CA' })

const toast = useToast()
const user = useSupabaseUser()
const supabase = useSupabaseClient() as unknown as SupabaseClient<Database>
const { current } = useCurrentClient()

const accountsResource = useClientResource<Account>('accounts')
const revenueImportsResource = useClientResource<RevenueImport>('revenue_imports')
const revenueLinesResource = useClientResource<Record<string, unknown>>('revenue_lines')

// ──────────────────────────────
// Upload state
// ──────────────────────────────
const fileInput = ref<HTMLInputElement | null>(null)
const filename = ref<string | null>(null)
const rawRows = ref<Record<string, unknown>[]>([])
const headers = ref<string[]>([])

// ──────────────────────────────
// Mapping state
// ──────────────────────────────
const mappingSiret = ref<string | undefined>(undefined)
const mappingPeriod = ref<string | undefined>(undefined)
const mappingAmount = ref<string | undefined>(undefined)
const mappingActivityLine = ref<string | undefined>(undefined)
const rememberMapping = ref(false)

function readImportMapping(settings: unknown): Partial<ColumnMapping> {
  if (settings === null || settings === undefined) return {}
  if (typeof settings !== 'object' || Array.isArray(settings)) return {}
  const obj = settings as Record<string, unknown>
  const mapping = obj['importMapping']
  if (!mapping || typeof mapping !== 'object' || Array.isArray(mapping)) return {}
  const m = mapping as Record<string, unknown>
  return {
    siret: typeof m['siret'] === 'string' ? m['siret'] : undefined,
    period: typeof m['period'] === 'string' ? m['period'] : undefined,
    amount: typeof m['amount'] === 'string' ? m['amount'] : undefined,
    activity_line: typeof m['activity_line'] === 'string' ? m['activity_line'] : undefined
  }
}

async function loadSavedMapping(): Promise<void> {
  if (!current.value) return
  const { data, error } = await supabase
    .from('clients')
    .select('settings')
    .eq('id', current.value.id)
    .single()
  if (error) return
  const saved = readImportMapping(data?.settings)
  if (saved.siret) mappingSiret.value = saved.siret
  if (saved.period) mappingPeriod.value = saved.period
  if (saved.amount) mappingAmount.value = saved.amount
  if (saved.activity_line) mappingActivityLine.value = saved.activity_line
}

async function saveMapping(mapping: ColumnMapping): Promise<void> {
  if (!current.value) return
  const { data: existing, error: fetchError } = await supabase
    .from('clients')
    .select('settings')
    .eq('id', current.value.id)
    .single()
  if (fetchError) throw fetchError
  const prevSettings = (
    existing?.settings
    && typeof existing.settings === 'object'
    && !Array.isArray(existing.settings)
  )
    ? (existing.settings as Record<string, unknown>)
    : {}
  const { error } = await supabase
    .from('clients')
    .update({ settings: { ...prevSettings, importMapping: mapping } })
    .eq('id', current.value.id)
  if (error) throw error
}

// ──────────────────────────────
// Accounts
// ──────────────────────────────
const accounts = ref<Account[]>([])

async function loadAccounts(): Promise<void> {
  accounts.value = await accountsResource.list({ order: 'name', ascending: true })
}

// ──────────────────────────────
// History
// ──────────────────────────────
const history = ref<RevenueImport[]>([])
const cancelTarget = ref<RevenueImport | null>(null)
const cancelOpen = ref(false)

async function loadHistory(): Promise<void> {
  history.value = await revenueImportsResource.list({ order: 'created_at', ascending: false })
}

onMounted(async () => {
  await Promise.all([loadAccounts(), loadHistory(), loadSavedMapping()])
})

// ──────────────────────────────
// File handling
// ──────────────────────────────
async function onFileChange(event: Event): Promise<void> {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return
  filename.value = file.name
  const buf = await file.arrayBuffer()
  // cellDates: emit real Date objects for date-typed cells (period columns),
  // so parsePeriod receives a Date rather than an Excel serial number.
  const wb = XLSX.read(buf, { type: 'array', cellDates: true })
  const sheetName = wb.SheetNames[0]
  if (!sheetName) {
    toast.add({ title: 'Fichier vide ou invalide', color: 'error' })
    return
  }
  const sheet = wb.Sheets[sheetName]
  if (!sheet) {
    toast.add({ title: 'Feuille introuvable', color: 'error' })
    return
  }
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: null }) as Record<string, unknown>[]
  rawRows.value = rows
  const firstRow = rows[0]
  headers.value = firstRow ? Object.keys(firstRow) : []
  // Reset mapping fields that are no longer present in the new file
  if (mappingSiret.value && !headers.value.includes(mappingSiret.value)) mappingSiret.value = undefined
  if (mappingPeriod.value && !headers.value.includes(mappingPeriod.value)) mappingPeriod.value = undefined
  if (mappingAmount.value && !headers.value.includes(mappingAmount.value)) mappingAmount.value = undefined
  if (mappingActivityLine.value && !headers.value.includes(mappingActivityLine.value)) mappingActivityLine.value = undefined
}

// ──────────────────────────────
// Mapping completeness
// ──────────────────────────────
const mappingComplete = computed((): boolean => {
  return !!(mappingSiret.value && mappingPeriod.value && mappingAmount.value)
})

const activeMapping = computed((): ColumnMapping | null => {
  if (!mappingComplete.value) return null
  return {
    siret: mappingSiret.value as string,
    period: mappingPeriod.value as string,
    amount: mappingAmount.value as string,
    activity_line: mappingActivityLine.value ?? undefined
  }
})

// ──────────────────────────────
// Preview (parsed + matched)
// ──────────────────────────────
const preview = computed((): {
  lines: ParsedLine[]
  errors: { row: number, reason: string }[]
  matched: { line: ParsedLine, account: Account }[]
  unmatched: ParsedLine[]
} | null => {
  if (!activeMapping.value || rawRows.value.length === 0) return null
  const { lines, errors } = parseRows(rawRows.value, activeMapping.value)
  const { matched, unmatched } = matchBySiret(lines, accounts.value)
  return { lines, errors, matched, unmatched }
})

// Unique unmatched SIRETs for account creation
const unmatchedSirets = computed((): string[] => {
  if (!preview.value) return []
  const seen = new Set<string>()
  for (const l of preview.value.unmatched) {
    seen.add(l.siret)
  }
  return Array.from(seen)
})

// ──────────────────────────────
// Create account for unmatched SIRET
// ──────────────────────────────
const creatingAccount = ref<Set<string>>(new Set())

async function createAccountForSiret(siret: string): Promise<void> {
  creatingAccount.value = new Set([...creatingAccount.value, siret])
  try {
    await accountsResource.create({
      name: siret,
      siret,
      current_status: 'suspect'
    })
    await loadAccounts()
    toast.add({ title: `Compte créé pour ${siret}`, color: 'success' })
  } catch {
    toast.add({ title: 'Erreur lors de la création du compte', color: 'error' })
  } finally {
    const next = new Set(creatingAccount.value)
    next.delete(siret)
    creatingAccount.value = next
  }
}

// ──────────────────────────────
// Commit
// ──────────────────────────────
const committing = ref(false)

async function commit(): Promise<void> {
  if (!preview.value || !filename.value) return
  const { lines, matched, unmatched } = preview.value
  committing.value = true
  try {
    const importRow = await revenueImportsResource.create({
      filename: filename.value,
      uploaded_by: user.value?.id ?? null,
      row_count: lines.length,
      matched: matched.length,
      unmatched: unmatched.length,
      status: 'done'
    }) as RevenueImport

    // Coerce any out-of-enum activity value to 'autre' so the insert never fails
    // on the activity_line enum (talent/emploi/formation/autre).
    const ACTIVITY_LINES = ['talent', 'emploi', 'formation', 'autre']
    const coerceActivity = (v: string | null): string => {
      const k = (v ?? '').trim().toLowerCase()
      return ACTIVITY_LINES.includes(k) ? k : 'autre'
    }

    const linePayloads: Record<string, unknown>[] = matched.map(m => ({
      account_id: m.account.id,
      import_id: importRow.id,
      period: m.line.period,
      amount: m.line.amount,
      activity_line: coerceActivity(m.line.activity_line),
      source: 'import'
    }))

    if (linePayloads.length > 0) {
      try {
        await revenueLinesResource.createMany(linePayloads)
      } catch (linesErr) {
        // Roll back the import header so we never leave an orphan import with no lines.
        await revenueImportsResource.remove(importRow.id).catch(() => {})
        throw linesErr
      }
    }

    if (rememberMapping.value && activeMapping.value) {
      await saveMapping(activeMapping.value)
    }

    toast.add({
      title: 'Import terminé',
      description: `${matched.length} ligne(s) importée(s), ${unmatched.length} non matchée(s).`,
      color: 'success'
    })

    // Reset upload state
    filename.value = null
    rawRows.value = []
    headers.value = []
    if (fileInput.value) fileInput.value.value = ''

    await loadHistory()
  } catch {
    toast.add({ title: 'Erreur lors de l\'import', color: 'error' })
    await loadHistory()
  } finally {
    committing.value = false
  }
}

// ──────────────────────────────
// Cancel import
// ──────────────────────────────
function openCancel(row: RevenueImport): void {
  cancelTarget.value = row
  cancelOpen.value = true
}

async function confirmCancel(): Promise<void> {
  if (!cancelTarget.value) return
  try {
    await revenueImportsResource.remove(cancelTarget.value.id)
    toast.add({ title: 'Import annulé', color: 'success' })
    cancelOpen.value = false
    cancelTarget.value = null
    await loadHistory()
  } catch {
    toast.add({ title: 'Erreur lors de la suppression', color: 'error' })
  }
}

// ──────────────────────────────
// Table columns
// ──────────────────────────────
const matchedColumns: TableColumn<{ line: ParsedLine, account: Account }>[] = [
  { accessorKey: 'account', header: 'Compte', cell: ({ row }) => row.original.account.name },
  { accessorKey: 'line', header: 'SIRET', cell: ({ row }) => row.original.line.siret },
  { id: 'period', header: 'Période', cell: ({ row }) => row.original.line.period },
  { id: 'amount', header: 'Montant', cell: ({ row }) => row.original.line.amount.toLocaleString('fr-FR', { minimumFractionDigits: 2 }) + ' €' }
]

const unmatchedColumns: TableColumn<ParsedLine>[] = [
  { accessorKey: 'siret', header: 'SIRET' },
  { accessorKey: 'period', header: 'Période' },
  { accessorKey: 'amount', header: 'Montant', cell: ({ row }) => row.original.amount.toLocaleString('fr-FR', { minimumFractionDigits: 2 }) + ' €' }
]

const errorColumns: TableColumn<{ row: number, reason: string }>[] = [
  { accessorKey: 'row', header: 'Ligne' },
  { accessorKey: 'reason', header: 'Raison' }
]

const historyColumns: TableColumn<RevenueImport>[] = [
  { accessorKey: 'filename', header: 'Fichier' },
  { accessorKey: 'created_at', header: 'Date', cell: ({ row }) => new Date(row.original.created_at).toLocaleDateString('fr-FR') },
  { accessorKey: 'matched', header: 'Matchées' },
  { accessorKey: 'unmatched', header: 'Non matchées' },
  { accessorKey: 'status', header: 'Statut' },
  { id: 'actions' }
]
</script>

<template>
  <div class="space-y-8">
    <h1 class="text-xl font-semibold">
      Import CA
    </h1>

    <!-- ── Step 1: Upload ────────────────────────────────────── -->
    <UCard>
      <template #header>
        <span class="font-medium">1. Charger un fichier</span>
      </template>
      <div class="flex items-center gap-4">
        <input
          ref="fileInput"
          type="file"
          accept=".csv,.xlsx"
          class="hidden"
          @change="onFileChange"
        >
        <UButton
          icon="i-lucide-upload"
          variant="outline"
          @click="fileInput?.click()"
        >
          Choisir un fichier (.csv / .xlsx)
        </UButton>
        <span
          v-if="filename"
          class="text-sm text-neutral-600"
        >
          {{ filename }} — {{ rawRows.length }} ligne(s) détectée(s)
        </span>
      </div>
    </UCard>

    <!-- ── Step 2: Mapping ───────────────────────────────────── -->
    <UCard v-if="filename && headers.length > 0">
      <template #header>
        <span class="font-medium">2. Correspondance des colonnes</span>
      </template>
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label class="mb-1 block text-sm font-medium">Colonne SIRET *</label>
          <USelectMenu
            v-model="mappingSiret"
            :items="headers"
            placeholder="Sélectionner…"
            class="w-full"
          />
        </div>
        <div>
          <label class="mb-1 block text-sm font-medium">Colonne Période *</label>
          <USelectMenu
            v-model="mappingPeriod"
            :items="headers"
            placeholder="Sélectionner…"
            class="w-full"
          />
        </div>
        <div>
          <label class="mb-1 block text-sm font-medium">Colonne Montant *</label>
          <USelectMenu
            v-model="mappingAmount"
            :items="headers"
            placeholder="Sélectionner…"
            class="w-full"
          />
        </div>
        <div>
          <label class="mb-1 block text-sm font-medium">Colonne Ligne d'activité (optionnel)</label>
          <USelectMenu
            v-model="mappingActivityLine"
            :items="headers"
            placeholder="Sélectionner…"
            class="w-full"
          />
        </div>
      </div>
      <div class="mt-4 flex items-center gap-2">
        <USwitch
          v-model="rememberMapping"
          label="Mémoriser ce mapping"
        />
      </div>
    </UCard>

    <!-- ── Step 3: Preview ───────────────────────────────────── -->
    <template v-if="preview">
      <UCard>
        <template #header>
          <span class="font-medium">3. Aperçu de l'import</span>
        </template>
        <div class="mb-4 flex flex-wrap gap-3">
          <UBadge color="neutral">
            {{ preview.lines.length }} ligne(s) valide(s)
          </UBadge>
          <UBadge color="success">
            {{ preview.matched.length }} matchée(s)
          </UBadge>
          <UBadge
            :color="preview.unmatched.length > 0 ? 'warning' : 'neutral'"
          >
            {{ preview.unmatched.length }} non matchée(s)
          </UBadge>
          <UBadge
            :color="preview.errors.length > 0 ? 'error' : 'neutral'"
          >
            {{ preview.errors.length }} erreur(s)
          </UBadge>
        </div>

        <!-- Matched table -->
        <template v-if="preview.matched.length > 0">
          <p class="mb-2 text-sm font-medium text-green-700">
            Lignes matchées
          </p>
          <UTable
            :data="preview.matched"
            :columns="matchedColumns"
            class="mb-6"
          />
        </template>

        <!-- Unmatched table + resolve -->
        <template v-if="preview.unmatched.length > 0">
          <p class="mb-2 text-sm font-medium text-amber-700">
            Lignes non matchées (SIRET inconnu)
          </p>
          <UTable
            :data="preview.unmatched"
            :columns="unmatchedColumns"
            class="mb-4"
          />
          <div class="space-y-2">
            <p class="text-sm font-medium">
              Créer les comptes manquants
            </p>
            <div
              v-for="siret in unmatchedSirets"
              :key="siret"
              class="flex items-center gap-3"
            >
              <span class="font-mono text-sm">{{ siret }}</span>
              <UButton
                size="sm"
                variant="outline"
                :loading="creatingAccount.has(siret)"
                @click="createAccountForSiret(siret)"
              >
                Créer le compte
              </UButton>
            </div>
          </div>
        </template>

        <!-- Errors table -->
        <template v-if="preview.errors.length > 0">
          <p class="mb-2 mt-6 text-sm font-medium text-red-700">
            Erreurs de parsing
          </p>
          <UTable
            :data="preview.errors"
            :columns="errorColumns"
          />
        </template>
      </UCard>

      <!-- ── Step 4: Commit ──────────────────────────────────── -->
      <UCard v-if="preview.matched.length > 0">
        <template #header>
          <span class="font-medium">4. Valider l'import</span>
        </template>
        <p class="mb-4 text-sm text-neutral-600">
          {{ preview.matched.length }} ligne(s) seront importées.
          {{ preview.unmatched.length }} ligne(s) non matchée(s) seront ignorées.
        </p>
        <UButton
          color="primary"
          :loading="committing"
          icon="i-lucide-check"
          @click="commit"
        >
          Confirmer l'import
        </UButton>
      </UCard>

      <UAlert
        v-else-if="preview.lines.length === 0 && preview.errors.length > 0"
        color="error"
        title="Aucune ligne valide"
        description="Vérifiez le mapping des colonnes ou le contenu du fichier."
      />
    </template>

    <!-- ── History ────────────────────────────────────────────── -->
    <UCard>
      <template #header>
        <span class="font-medium">Historique des imports</span>
      </template>
      <UTable
        :data="history"
        :columns="historyColumns"
        :empty-label="'Aucun import effectué'"
      >
        <template #actions-cell="{ row }">
          <UButton
            icon="i-lucide-x"
            color="error"
            variant="ghost"
            size="sm"
            @click="openCancel(row.original)"
          />
        </template>
      </UTable>
    </UCard>

    <!-- ── Cancel confirm modal ──────────────────────────────── -->
    <UModal
      v-model:open="cancelOpen"
      title="Annuler l'import"
    >
      <template #body>
        <p class="mb-4 text-sm">
          Confirmer la suppression de l'import
          <strong>{{ cancelTarget?.filename }}</strong> ?
          Toutes les lignes de CA associées seront supprimées.
        </p>
        <div class="flex justify-end gap-2">
          <UButton
            color="neutral"
            variant="ghost"
            @click="cancelOpen = false"
          >
            Retour
          </UButton>
          <UButton
            color="error"
            @click="confirmCancel"
          >
            Supprimer
          </UButton>
        </div>
      </template>
    </UModal>
  </div>
</template>
