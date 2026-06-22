# Pilotage Network — Phase 2 : Registre & CRUD — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Permettre à la régie de gérer tout le registre depuis l'UI — partenariats, événements, comptes (vue tableur), contacts, participations (saisie des leads) et catégories configurables — scopé au client courant.

**Architecture:** Couche d'accès données générique scopée au `client_id` courant (composable `useClientResource`), au-dessus des tables Phase 1. Écrans Nuxt UI 4 (UTable, UForm+Zod, UModal). La logique pure (scoping, schémas de validation, prédicats de filtre) est testée en Vitest ; l'UI est validée par lint+typecheck+build.

**Tech Stack:** Nuxt 4, Nuxt UI 4.3, @nuxtjs/supabase 2, Zod (validation), Vitest. Repose sur la Phase 1 (RLS multi-tenant, `useCurrentClient`).

## Global Constraints

- **Scoping client obligatoire** : toute lecture/écriture passe par `useClientResource`, qui filtre/insère `client_id = current.id`. Jamais de requête supabase non scopée dans l'UI.
- **RLS reste la garantie** : le scoping applicatif est pour l'UX (afficher le bon client) ; la sécurité reste la RLS Postgres de la Phase 1.
- **Validation** : formulaires via `UForm :schema` avec **Zod**. Pas de validation maison.
- **Libellés UI en français** ; identifiants de code en anglais.
- **Lint** : ESLint stylistic `commaDangle: never`, `braceStyle: 1tbs`. `pnpm lint`, `pnpm typecheck`, `pnpm build`, `pnpm vitest run` doivent passer à chaque tâche.
- **Supabase REMOTE** : pas de migration dans cette phase (schéma déjà en place). Le contrôleur exécute les commandes réseau si besoin.
- **Enums** (rappel Phase 1) : `account_status` (suspect/prospect/client), `direction` (direct/indirect), `lead_level` (reseau/patron/interne), `activity_line`, `member_role`.

---

## Pattern CRUD partagé (référence — écrit une fois, réutilisé par les tâches UI)

Chaque écran de liste suit ce squelette (les tâches précisent colonnes, schéma et libellés) :

```vue
<script setup lang="ts">
import { z } from 'zod'
import type { TableColumn } from '@nuxt/ui'

const toast = useToast()
const resource = useClientResource<Row>('TABLE')
const rows = ref<Row[]>([])
const loading = ref(true)
const open = ref(false)
const editing = ref<Row | null>(null)

async function refresh() {
  loading.value = true
  try { rows.value = await resource.list() } catch (e) { toast.add({ title: 'Erreur de chargement', color: 'error' }) } finally { loading.value = false }
}
onMounted(refresh)

const schema = z.object({ /* per-task */ })
type State = z.output<typeof schema>
const state = reactive<Partial<State>>({})

function openCreate() { editing.value = null; Object.assign(state, EMPTY_STATE); open.value = true }
function openEdit(row: Row) { editing.value = row; Object.assign(state, pickEditable(row)); open.value = true }

async function onSubmit() {
  try {
    if (editing.value) await resource.update(editing.value.id, { ...state })
    else await resource.create({ ...state })
    toast.add({ title: 'Enregistré', color: 'success' })
    open.value = false
    await refresh()
  } catch (e) { toast.add({ title: "Échec de l'enregistrement", color: 'error' }) }
}

async function onDelete(row: Row) {
  try { await resource.remove(row.id); toast.add({ title: 'Supprimé', color: 'success' }); await refresh() }
  catch (e) { toast.add({ title: 'Échec de la suppression', color: 'error' }) }
}

const columns: TableColumn<Row>[] = [ /* per-task, last column = actions */ ]
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <h1 class="text-xl font-semibold">TITRE</h1>
      <UButton icon="i-lucide-plus" @click="openCreate">Ajouter</UButton>
    </div>
    <UTable :data="rows" :columns="columns" :loading="loading" />
    <UModal v-model:open="open" :title="editing ? 'Modifier' : 'Ajouter'">
      <template #body>
        <UForm :schema="schema" :state="state" class="space-y-4" @submit="onSubmit">
          <!-- per-task UFormField blocks -->
          <div class="flex justify-end gap-2">
            <UButton color="neutral" variant="ghost" @click="open = false">Annuler</UButton>
            <UButton type="submit">Enregistrer</UButton>
          </div>
        </UForm>
      </template>
    </UModal>
  </div>
</template>
```

Row-action cells use a `#actions-cell="{ row }"` slot with edit/delete `UButton`s (delete behind a `UModal` or `confirm`). `Row` types come from `app/types/database.ts` (`Database['public']['Tables']['<table>']['Row']`).

---

## Task 1: Couche d'accès données scopée client + dépendance Zod

**Files:**
- Create: `app/composables/useClientResource.ts`, `test/composables/useClientResource.test.ts`
- Modify: `package.json` (add `zod`)

**Interfaces:**
- Produces: pure `withClientId(payload, clientId)` ; `useClientResource<Row>(table)` → `{ list, create, update, remove }` scoping every call to `current.id`. Consumed by all Phase 2 UI tasks.

- [ ] **Step 1: Add Zod** (controller-run if sandboxed)

Run: `pnpm add zod`
Expected: zod in dependencies.

- [ ] **Step 2: Write failing test for the pure helper**

```ts
// test/composables/useClientResource.test.ts
import { describe, it, expect } from 'vitest'
import { withClientId } from '../../app/composables/useClientResource'

describe('withClientId', () => {
  it('injects client_id into the payload', () => {
    expect(withClientId({ name: 'X' }, 'cid')).toEqual({ name: 'X', client_id: 'cid' })
  })
  it('overrides any client_id already present (current client wins)', () => {
    expect(withClientId({ name: 'X', client_id: 'other' }, 'cid')).toEqual({ name: 'X', client_id: 'cid' })
  })
})
```

- [ ] **Step 3: Run → fails** (`pnpm vitest run test/composables/useClientResource.test.ts`) — `withClientId` undefined.

- [ ] **Step 4: Implement the composable**

```ts
// app/composables/useClientResource.ts
import type { Database } from '~/types/database'

type TableName = keyof Database['public']['Tables']

export function withClientId<T extends Record<string, unknown>>(payload: T, clientId: string) {
  return { ...payload, client_id: clientId }
}

export function useClientResource<Row>(table: TableName) {
  const supabase = useSupabaseClient<Database>()
  const { current } = useCurrentClient()

  function requireClient(): string {
    if (!current.value) throw new Error('Aucun client sélectionné')
    return current.value.id
  }

  async function list(opts?: { columns?: string, order?: string, ascending?: boolean }): Promise<Row[]> {
    const { data, error } = await supabase
      .from(table)
      .select(opts?.columns ?? '*')
      .eq('client_id', requireClient())
      .order(opts?.order ?? 'created_at', { ascending: opts?.ascending ?? false })
    if (error) throw error
    return (data ?? []) as Row[]
  }

  async function create(payload: Record<string, unknown>): Promise<Row> {
    const { data, error } = await supabase
      .from(table)
      .insert(withClientId(payload, requireClient()) as never)
      .select()
      .single()
    if (error) throw error
    return data as Row
  }

  async function update(id: string, payload: Record<string, unknown>): Promise<Row> {
    const { data, error } = await supabase
      .from(table)
      .update(payload as never)
      .eq('id', id)
      .eq('client_id', requireClient())
      .select()
      .single()
    if (error) throw error
    return data as Row
  }

  async function remove(id: string): Promise<void> {
    const { error } = await supabase
      .from(table)
      .delete()
      .eq('id', id)
      .eq('client_id', requireClient())
    if (error) throw error
  }

  return { list, create, update, remove }
}
```

- [ ] **Step 5: Run → passes.** Run typecheck to confirm the `Database` generic + casts compile: `pnpm typecheck`.

- [ ] **Step 6: Commit**

```bash
git add app/composables/useClientResource.ts test/composables/useClientResource.test.ts package.json pnpm-lock.yaml
git commit -m "feat(data): client-scoped resource composable + zod"
```

---

## Task 2: CRUD Partenariats (`/partenariats`) — pattern-setter

**Files:**
- Create: `app/pages/partenariats.vue`

**Interfaces:**
- Consumes: `useClientResource` (Task 1). Row = `partnerships`.
- Produces: établit le pattern CRUD réutilisé par les tâches suivantes.

- [ ] **Step 1: Build the page** following the Shared CRUD pattern, with:
  - `const resource = useClientResource<Partnership>('partnerships')` where `type Partnership = Database['public']['Tables']['partnerships']['Row']`.
  - Zod schema: `z.object({ name: z.string().min(1, 'Nom requis'), type: z.string().optional(), notes: z.string().optional() })`.
  - Columns: `name` (header "Nom"), `type` (header "Type"), actions.
  - Form fields: `UFormField name="name" label="Nom" required` → UInput ; `type` → UInput (placeholder "ex. Club sportif") ; `notes` → UTextarea.
  - Title "Partenariats".
  - Delete behind a confirm `UModal` (title "Supprimer ce partenariat ?", body warns events restent mais perdent le lien).

```vue
<!-- app/pages/partenariats.vue -->
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
    toast.add({ title: "Échec de l'enregistrement", color: 'error' })
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
      <UButton icon="i-lucide-plus" @click="openCreate">
        Ajouter
      </UButton>
    </div>

    <UTable :data="rows" :columns="columns" :loading="loading">
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

    <UModal v-model:open="open" :title="editing ? 'Modifier le partenariat' : 'Nouveau partenariat'">
      <template #body>
        <UForm :schema="schema" :state="state" class="space-y-4" @submit="onSubmit">
          <UFormField name="name" label="Nom" required>
            <UInput v-model="state.name" class="w-full" />
          </UFormField>
          <UFormField name="type" label="Type">
            <UInput v-model="state.type" placeholder="ex. Club sportif" class="w-full" />
          </UFormField>
          <UFormField name="notes" label="Notes">
            <UTextarea v-model="state.notes" :rows="3" class="w-full" />
          </UFormField>
          <div class="flex justify-end gap-2">
            <UButton color="neutral" variant="ghost" @click="open = false">
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
```

- [ ] **Step 2: Verify** (controller): `pnpm lint && pnpm typecheck && pnpm build`. Note: delete here is immediate via toast; a confirm dialog is added in Task 3's pattern if desired — keep immediate for partnerships (low risk).

- [ ] **Step 3: Commit** `feat(ui): partnerships CRUD page`

---

## Task 3: CRUD Événements (`/evenements`)

**Files:** Create `app/pages/evenements.vue`

**Interfaces:** Consumes `useClientResource` ; Row = `events` ; reads `partnerships` for the relation select.

- [ ] **Step 1: Build the page** following the Shared CRUD pattern, with these specifics:
  - Load partnerships too (for the select + to display the partnership name): `const partResource = useClientResource<Partnership>('partnerships')`; build a `Map<id,name>`.
  - Row type `events`. Zod schema:
    ```ts
    const schema = z.object({
      name: z.string().min(1, 'Nom requis'),
      partnership_id: z.string().uuid().nullable().optional(),
      type: z.string().optional(),
      date: z.string().optional(),       // ISO yyyy-mm-dd
      lieu: z.string().optional(),
      notes: z.string().optional()
    })
    ```
  - Columns: `name` ("Nom"), a computed partnership name cell (`#partnership-cell`), `type` ("Type"), `date` ("Date"), `lieu` ("Lieu"), actions.
  - Form fields: name (required, UInput); partnership_id via `USelectMenu` populated from partnerships (`items` = `[{label, value:id}]`, allow empty); type (UInput, placeholder "ex. business club, jeu concours, hospitalité"); date via `UInput type="date"` (store as string); lieu (UInput); notes (UTextarea).
  - A top filter: `USelectMenu` "Filtrer par partenariat" → filters `rows` client-side by `partnership_id`.
  - Title "Événements".

- [ ] **Step 2: Verify** `pnpm lint && pnpm typecheck && pnpm build`.
- [ ] **Step 3: Commit** `feat(ui): events CRUD page with partnership relation and filter`

---

## Task 4: Comptes — vue tableur (`/comptes`)

**Files:** Create `app/pages/comptes/index.vue`

**Interfaces:** Consumes `useClientResource` ; Row = `accounts`.

- [ ] **Step 1: Build the list page** (Shared CRUD pattern) with:
  - Columns: `name` ("Entreprise", cell links to `/comptes/[id]`), `siret` ("SIRET"), `current_status` ("Statut", rendered as `UBadge` colored: suspect=neutral, prospect=warning, client=success), `effectif` ("Effectif"), `secteur` ("Secteur"), `marche_public` ("Marché public", ✓/—), actions.
  - Filters bar: search `UInput` (filters name OR siret client-side, case-insensitive) + `USelectMenu` status filter (Tous/suspect/prospect/client). Extract the filter predicate to a pure function `filterAccounts(rows, { search, status })` in `app/utils/filterAccounts.ts` and unit-test it.
  - Create/edit form (Zod):
    ```ts
    const schema = z.object({
      name: z.string().min(1, 'Nom requis'),
      siret: z.string().regex(/^\d{14}$/, 'SIRET = 14 chiffres').optional().or(z.literal('')),
      effectif: z.string().optional(),
      secteur: z.string().optional(),
      marche_public: z.boolean().optional(),
      current_status: z.enum(['suspect', 'prospect', 'client'])
    })
    ```
    Fields: name (required), siret (UInput, inputmode numeric), current_status (USelectMenu of the 3 statuses, default 'suspect'), effectif (UInput), secteur (UInput), marche_public (USwitch "Soumis aux marchés publics").
  - Title "Comptes".

- [ ] **Step 2: Unit test the filter** — `test/utils/filterAccounts.test.ts`:
  ```ts
  import { describe, it, expect } from 'vitest'
  import { filterAccounts } from '../../app/utils/filterAccounts'
  const rows = [
    { id: '1', name: 'Adrénaline', siret: '12345678900011', current_status: 'client' },
    { id: '2', name: 'Kumo', siret: null, current_status: 'prospect' }
  ] as any[]
  it('filters by name (case-insensitive)', () => { expect(filterAccounts(rows, { search: 'adré', status: null }).map(r => r.id)).toEqual(['1']) })
  it('filters by siret substring', () => { expect(filterAccounts(rows, { search: '900011', status: null }).map(r => r.id)).toEqual(['1']) })
  it('filters by status', () => { expect(filterAccounts(rows, { search: '', status: 'prospect' }).map(r => r.id)).toEqual(['2']) })
  it('handles null siret without throwing', () => { expect(filterAccounts(rows, { search: 'kumo', status: null }).map(r => r.id)).toEqual(['2']) })
  ```
  Implement `filterAccounts` (RED→GREEN).
- [ ] **Step 3: Verify** lint+typecheck+build+vitest.
- [ ] **Step 4: Commit** `feat(ui): accounts table view with filters`

---

## Task 5: Fiche compte (`/comptes/[id]`) + contacts inline

**Files:** Create `app/pages/comptes/[id].vue`

**Interfaces:** Consumes `useClientResource` for `accounts`, `contacts`, `participations`, `events`.

- [ ] **Step 1: Build the detail page**:
  - Read `id` from route. Load the account (scoped), its contacts, its participations (join event name via a separate events fetch + Map).
  - **Identity card** (UCard): name, SIRET, effectif, secteur, statut (UBadge), marché public, became_client_at. An "Modifier" button reusing the account form (can import the same Zod schema; for simplicity, a local edit modal like Task 4).
  - **Contacts** section: UTable of contacts (nom, prénom, fonction, email, tel, lead_level) with inline add/edit (UModal) and delete. Zod schema for contact:
    ```ts
    z.object({ nom: z.string().optional(), prenom: z.string().optional(), fonction: z.string().optional(), email: z.string().email('Email invalide').optional().or(z.literal('')), tel: z.string().optional(), lead_level: z.enum(['reseau','patron','interne']).nullable().optional() })
    ```
    On create, inject `account_id` (the current account) in addition to client_id (the resource handles client_id; pass account_id in the payload).
  - **Participations timeline** section: list participations ordered by `entered_network_at` desc, each showing event name, date, direction (UBadge), status_at_entry, category, notes. Read-only here (creation in Task 6). A placeholder note: "Graphe CA — Phase 3".
  - Loading + not-found handling (if account null → UAlert "Compte introuvable").
- [ ] **Step 2: Verify** lint+typecheck+build.
- [ ] **Step 3: Commit** `feat(ui): account detail page with contacts and participations timeline`

---

## Task 6: Saisie d'un lead (participation)

**Files:** Create `app/pages/leads/nouveau.vue` ; add a "Nouveau lead" button in the layout nav (modify `app/layouts/default.vue` to add `{ label: 'Nouveau lead', icon: 'i-lucide-user-plus', to: '/leads/nouveau' }`).

**Interfaces:** Consumes `useClientResource` for `accounts`, `contacts`, `events`, `participations`. Reads `clients.settings` categories (Task 7) if present, else free text.

- [ ] **Step 1: Build the lead-entry form** — the key data-entry screen:
  - **Account selection / creation on the fly**: a `USelectMenu` searchable over existing accounts (label = name + siret). An "Ou créer un compte" toggle reveals name + siret fields; on submit, if creating, `accounts.create({ name, siret, current_status: 'suspect' })` first, then use its id. If a SIRET matches an existing account, warn and reuse it (dedup — call `accounts.list` and match by siret).
  - **Contact** (optional): select among the chosen account's contacts, or create one inline (nom, prénom, fonction, email).
  - **Event**: `USelectMenu` over events (label = name + date).
  - **Participation fields**: `direction` (URadioGroup direct/indirect, required), `category` (USelectMenu from client settings categories if any, else UInput free text), `status_at_entry` (USelectMenu suspect/prospect/client), `entered_network_at` (UInput type date), `notes` (UTextarea).
  - Zod schema covering required: account (resolved id), event_id (required), direction (required enum).
  - On submit: resolve/create account → resolve/create contact → `participations.create({ account_id, event_id, contact_id, direction, category, status_at_entry, entered_network_at, notes })`. Toast success, reset form (or navigate to the account detail `/comptes/{account_id}`).
  - Extract the SIRET-dedup resolution to a pure helper `resolveAccount(existing, { siret })` in `app/utils/resolveAccount.ts` returning `{ match: Account | null }`, unit-tested.
- [ ] **Step 2: Unit test** `resolveAccount` (match by normalized siret, null-safe) in `test/utils/resolveAccount.test.ts` (RED→GREEN).
- [ ] **Step 3: Verify** lint+typecheck+build+vitest.
- [ ] **Step 4: Commit** `feat(ui): lead (participation) entry with on-the-fly account/contact creation`

---

## Task 7: Réglages — catégories configurables (`/reglages`)

**Files:** Create `app/pages/reglages.vue` ; Create `app/composables/useClientSettings.ts`

**Interfaces:** Reads/writes `clients.settings` jsonb for the current client.

- [ ] **Step 1: Settings composable** `useClientSettings()` → `{ categories: Ref<string[]>, load(), saveCategories(list: string[]) }`. `load()` selects `settings` from `clients` where id = current.id ; categories = `settings.categories ?? []`. `saveCategories` updates `clients.settings` merging `{ ...settings, categories }`. Extract a pure `readCategories(settings: unknown): string[]` (null/shape-safe) and unit-test it.
- [ ] **Step 2: Unit test** `readCategories` (`test/composables/useClientSettings.test.ts`): returns [] for null/undefined/missing key, returns array when present, ignores non-array.
- [ ] **Step 3: Settings page** `/reglages`: a `UInputTags` (or list + add/remove) bound to categories, a "Enregistrer" button calling `saveCategories`. Show current client name. Title "Réglages".
- [ ] **Step 4: Wire categories into the lead form** (Task 6): the `category` USelectMenu reads `useClientSettings().categories` (already loaded). If empty, fall back to free-text UInput.
- [ ] **Step 5: Verify** lint+typecheck+build+vitest.
- [ ] **Step 6: Commit** `feat(ui): client settings — configurable lead categories`

---

## Fin de Phase 2 — critères de réussite

- Depuis l'UI, la régie peut gérer partenariats, événements, comptes, contacts, participations et catégories — le tout scopé au client courant.
- La vue Comptes remplace visuellement le Google Sheet ; la fiche compte montre la timeline des participations.
- La saisie d'un lead crée compte/contact à la volée avec dédoublonnage par SIRET.
- `pnpm lint`, `pnpm typecheck`, `pnpm build`, `pnpm vitest run` passent. Logique pure (scoping, filtre comptes, resolveAccount, readCategories) couverte par tests unitaires.
