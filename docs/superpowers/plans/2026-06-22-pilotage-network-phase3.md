# Pilotage Network — Phase 3 : Revenus & attribution — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Importer le CA mensuel (CSV/XLSX) en le rapprochant des comptes par SIRET, et calculer/afficher l'attribution (CA par compte, lift avant/après participation, direct/indirect, efficacité par événement) — le cœur de la promesse « prouver le business généré ».

**Architecture:** La logique d'attribution et de parsing est **pure** (`app/domain/`), testée en TDD, indépendante du framework. L'import se fait **côté client** (lecture du fichier via SheetJS → lignes brutes → parsing pur → matching par SIRET → persistance via la couche `useClientResource` scopée, RLS en garantie). Les `revenue_lines` portent `source` (`import` aujourd'hui, `salesforce` plus tard) — l'attribution lit `revenue_lines` sans connaître la source. Graphes via Unovis.

**Tech Stack:** Nuxt 4, Nuxt UI 4, @nuxtjs/supabase 2, SheetJS (`xlsx`, lecture CSV+XLSX côté client), Unovis (`@unovis/vue` + `@unovis/ts`), Zod, Vitest. Repose sur Phases 1-2.

## Global Constraints

- **Abstraction source CA** : tout CA persiste dans `revenue_lines` avec `source: 'import'`. L'attribution ne lit que `revenue_lines` ; aucun calcul ne suppose la provenance.
- **Scoping client** : toute écriture/lecture via `useClientResource` (RLS = sécurité). `client_id` injecté sur chaque ligne (y compris en insert groupé).
- **Logique pure isolée** : parsing, normalisation SIRET, matching, attribution dans `app/domain/` et `app/utils/`, sans dépendance Nuxt/Supabase → tests unitaires Vitest. Un bug ici fausse les chiffres montrés au client : TDD obligatoire.
- **Dédoublonnage** : l'attribution se fait au niveau **compte** (un compte = son CA compté une fois), jamais par participation.
- **Normalisation SIRET partagée** : UI (Phase 2 `resolveAccount`) et import utilisent la **même** fonction `normalizeSiret` (sinon les SIRET saisis et importés ne matchent pas).
- **Pas de `any`** (ESLint error) ; libellés UI français ; `pnpm lint`/`typecheck`/`build`/`vitest run` passent à chaque tâche.
- **Selects** : champs optionnels liés à un USelectMenu → Zod `.optional()` (jamais `.nullable()`), state `undefined`, `|| null` au submit (convention Phase 2).
- **Supabase REMOTE** : schéma `revenue_lines`/`revenue_imports` déjà créé en Phase 1. Pas de migration. Le contrôleur exécute les commandes réseau (install deps, tests).

---

## Task 1: Normalisation SIRET partagée + insert groupé

**Files:**
- Create: `app/utils/normalizeSiret.ts`, `test/utils/normalizeSiret.test.ts`
- Modify: `app/utils/resolveAccount.ts` (réutiliser `normalizeSiret`), `app/composables/useClientResource.ts` (ajouter `createMany`)

**Interfaces:**
- Produces: `normalizeSiret(value: string | null | undefined): string` (retire espaces/séparateurs, renvoie '' si vide) ; `useClientResource().createMany(payloads: Record<string, unknown>[]): Promise<Row[]>` (injecte client_id sur chaque ligne, un seul insert).

- [ ] **Step 1: Failing test for normalizeSiret**

```ts
// test/utils/normalizeSiret.test.ts
import { describe, it, expect } from 'vitest'
import { normalizeSiret } from '../../app/utils/normalizeSiret'

describe('normalizeSiret', () => {
  it('removes spaces', () => { expect(normalizeSiret('123 456 789 00011')).toBe('12345678900011') })
  it('removes non-digits (dots, dashes)', () => { expect(normalizeSiret('123.456-789')).toBe('123456789') })
  it('returns empty string for null/undefined/empty', () => {
    expect(normalizeSiret(null)).toBe('')
    expect(normalizeSiret(undefined)).toBe('')
    expect(normalizeSiret('   ')).toBe('')
  })
})
```

- [ ] **Step 2: Run → fails.** `pnpm vitest run test/utils/normalizeSiret.test.ts`

- [ ] **Step 3: Implement**

```ts
// app/utils/normalizeSiret.ts
export function normalizeSiret(value: string | null | undefined): string {
  if (!value) return ''
  return value.replace(/\D/g, '')
}
```

- [ ] **Step 4: Refactor `resolveAccount` to use it.** In `app/utils/resolveAccount.ts`, import `normalizeSiret` and replace the local whitespace normalization with it (match on `normalizeSiret(a.siret) === normalizeSiret(siret)`, returning null when the normalized input is empty). Keep its existing tests green.

- [ ] **Step 5: Add `createMany` to `useClientResource`** (in the returned object):

```ts
  async function createMany(payloads: Record<string, unknown>[]): Promise<Row[]> {
    if (payloads.length === 0) return []
    const cid = requireClient()
    const rows = payloads.map(p => withClientId(p, cid))
    const { data, error } = await supabase.from(table).insert(rows as never).select()
    if (error) throw error
    return (data ?? []) as Row[]
  }
```
Add `createMany` to the `return { ... }`.

- [ ] **Step 6: Run all unit tests → green.** `pnpm vitest run` (normalizeSiret + resolveAccount still pass). Then `pnpm typecheck`.

- [ ] **Step 7: Commit** `feat(data): shared normalizeSiret + createMany bulk insert`

---

## Task 2: Domaine d'attribution (pur, TDD)

**Files:**
- Create: `app/domain/attribution.ts`, `test/domain/attribution.test.ts`

**Interfaces:**
- Produces (all pure, framework-free):
  - `type RevenueLine = { account_id: string, period: string, amount: number, activity_line?: string }`
  - `type Participation = { account_id: string, event_id: string, direction: 'direct' | 'indirect', entered_network_at: string | null }`
  - `monthlyTotals(lines: RevenueLine[]): { period: string, amount: number }[]` — sorted by period asc.
  - `accountTotal(lines: RevenueLine[]): number`
  - `computeLift(lines: RevenueLine[], firstParticipation: string | null): { before: number, after: number, delta: number }` — sums amounts with period < firstParticipation vs >= ; if no date, all counts as `after`.
  - `aggregateByDirection(participations: Participation[], totalsByAccount: Map<string, number>): { direct: number, indirect: number }` — each account counted once; an account with any 'direct' participation → direct bucket, else indirect.
  - `eventEfficiency(participations: Participation[], accountsWithRevenue: Set<string>): { event_id: string, total: number, converted: number, rate: number }[]` — per event, share of participations whose account is in accountsWithRevenue.

- [ ] **Step 1: Write the failing tests** (real fixtures, exact expectations):

```ts
// test/domain/attribution.test.ts
import { describe, it, expect } from 'vitest'
import { monthlyTotals, accountTotal, computeLift, aggregateByDirection, eventEfficiency } from '../../app/domain/attribution'

const lines = [
  { account_id: 'a', period: '2026-01-01', amount: 100 },
  { account_id: 'a', period: '2026-02-01', amount: 200 },
  { account_id: 'a', period: '2026-03-01', amount: 50 }
]

describe('accountTotal', () => {
  it('sums amounts', () => { expect(accountTotal(lines)).toBe(350) })
  it('zero for empty', () => { expect(accountTotal([])).toBe(0) })
})

describe('monthlyTotals', () => {
  it('groups by period sorted asc', () => {
    expect(monthlyTotals([...lines].reverse())).toEqual([
      { period: '2026-01-01', amount: 100 },
      { period: '2026-02-01', amount: 200 },
      { period: '2026-03-01', amount: 50 }
    ])
  })
})

describe('computeLift', () => {
  it('splits before/after the first participation', () => {
    expect(computeLift(lines, '2026-02-01')).toEqual({ before: 100, after: 250, delta: 150 })
  })
  it('counts everything as after when no date', () => {
    expect(computeLift(lines, null)).toEqual({ before: 0, after: 350, delta: 350 })
  })
})

describe('aggregateByDirection', () => {
  it('counts each account once; direct wins if any direct participation', () => {
    const parts = [
      { account_id: 'a', event_id: 'e1', direction: 'direct' as const, entered_network_at: null },
      { account_id: 'a', event_id: 'e2', direction: 'indirect' as const, entered_network_at: null },
      { account_id: 'b', event_id: 'e1', direction: 'indirect' as const, entered_network_at: null }
    ]
    const totals = new Map([['a', 350], ['b', 100]])
    expect(aggregateByDirection(parts, totals)).toEqual({ direct: 350, indirect: 100 })
  })
})

describe('eventEfficiency', () => {
  it('computes conversion rate per event', () => {
    const parts = [
      { account_id: 'a', event_id: 'e1', direction: 'direct' as const, entered_network_at: null },
      { account_id: 'b', event_id: 'e1', direction: 'direct' as const, entered_network_at: null }
    ]
    const withRev = new Set(['a'])
    expect(eventEfficiency(parts, withRev)).toEqual([
      { event_id: 'e1', total: 2, converted: 1, rate: 0.5 }
    ])
  })
})
```

- [ ] **Step 2: Run → fails.** `pnpm vitest run test/domain/attribution.test.ts`

- [ ] **Step 3: Implement `app/domain/attribution.ts`** — pure functions matching the interfaces above. No framework imports. Period comparison is lexicographic on `yyyy-mm-dd` strings (valid since zero-padded). `rate` = converted/total (0 when total 0).

- [ ] **Step 4: Run → green.** Then `pnpm typecheck`, `pnpm lint`.

- [ ] **Step 5: Commit** `feat(domain): revenue attribution logic (totals, lift, direction, efficiency)`

---

## Task 3: Parsing d'import + matching (pur, TDD)

**Files:**
- Create: `app/domain/importParser.ts`, `test/domain/importParser.test.ts`

**Interfaces:**
- Produces:
  - `type ColumnMapping = { siret: string, period: string, amount: string, activity_line?: string }` (maps logical field → source column header).
  - `type ParsedLine = { siret: string, period: string, amount: number, activity_line: string | null, raw: Record<string, unknown> }`
  - `parseAmount(value: unknown): number | null` — handles `"1 234,56"` (French), `"1234.56"`, numbers; returns null if unparseable.
  - `parsePeriod(value: unknown): string | null` — accepts `Date`, `"2026-03"`, `"2026-03-15"`, `"03/2026"`, `"01/03/2026"` → returns `yyyy-mm-01`; null if unparseable.
  - `parseRows(rows: Record<string, unknown>[], mapping: ColumnMapping): { lines: ParsedLine[], errors: { row: number, reason: string }[] }` — applies mapping + normalizeSiret + parseAmount + parsePeriod; a row with missing siret/period/amount goes to errors.
  - `matchBySiret<T extends { siret: string | null }>(lines: ParsedLine[], accounts: T[]): { matched: { line: ParsedLine, account: T }[], unmatched: ParsedLine[] }` — uses `normalizeSiret` on both sides.

- [ ] **Step 1: Failing tests** covering: parseAmount (French + dot + number + junk→null); parsePeriod (the listed formats + junk→null); parseRows (good rows → lines, bad row → errors, siret normalized); matchBySiret (match by normalized siret, unmatched bucket, null-siret account safe). Write real fixtures with exact expected values.

- [ ] **Step 2: Run → fails.**

- [ ] **Step 3: Implement `app/domain/importParser.ts`** importing `normalizeSiret` from `~/utils/normalizeSiret`. No SheetJS import here — operates on already-extracted row objects. No `any` (use `unknown` + guards).

- [ ] **Step 4: Run → green;** `pnpm typecheck`, `pnpm lint`.

- [ ] **Step 5: Commit** `feat(domain): CSV/XLSX row parsing + SIRET matching`

---

## Task 4: Écran Import CA (`/import`)

**Files:**
- Create: `app/pages/import.vue`
- Modify: `package.json` (add `xlsx`)

**Interfaces:** Consumes `useClientResource` (`accounts`, `revenue_imports`, `revenue_lines`), `parseRows`/`matchBySiret` (Task 3), `useClientSettings` (store/reuse column mapping in `clients.settings.importMapping`).

- [ ] **Step 1: Add SheetJS** (controller): `pnpm add xlsx`

- [ ] **Step 2: Build the page** — flow:
  1. **Upload** : `UFileUpload`/`input type=file` accept `.csv,.xlsx`. On select, read with SheetJS (`XLSX.read(arrayBuffer)`, `XLSX.utils.sheet_to_json(sheet, { defval: null })`) → `rawRows: Record<string, unknown>[]` + detected `headers: string[]`. SheetJS is used ONLY here (file→rows); all logic stays in the pure domain.
  2. **Mapping** : for each logical field (siret, period, amount, activity_line optional), a `USelectMenu` of detected `headers`. Pre-fill from `clients.settings.importMapping` if present. A "Mémoriser ce mapping" toggle → on commit, save mapping via `useClientSettings`-style update to `clients.settings.importMapping`.
  3. **Preview** : run `parseRows(rawRows, mapping)` then `matchBySiret(lines, accounts)`. Show counts (lignes valides, erreurs, matchées, orphelines) + tables: matched (compte trouvé), unmatched (SIRET inconnu), parse errors.
  4. **Resolve unmatched** : per orphan SIRET, a button "Créer le compte" (creates an `accounts` row name=SIRET-or-blank, siret, status suspect) then re-matches; or "Ignorer".
  5. **Commit** : create a `revenue_imports` row ({ filename, uploaded_by: user id, row_count, matched, unmatched, status: 'done' }), then `revenue_lines` via `createMany` (each: account_id, import_id, period, amount, activity_line||'autre', source 'import'). Toast success. Reset.
  6. **History** : list `revenue_imports` (filename, date, matched/unmatched, status) with a "Annuler" button → `revenue_imports.remove(id)` (cascade deletes its revenue_lines). Confirm modal.
  - French labels. No `any`. Title "Import CA".

- [ ] **Step 3: Verify** (controller) `pnpm lint && pnpm typecheck && pnpm build`.
- [ ] **Step 4: Commit** `feat(ui): revenue import screen (upload, map, match, commit, history)`

---

## Task 5: Graphe CA & lift sur la fiche compte

**Files:**
- Modify: `app/pages/comptes/[id].vue`
- Modify: `package.json` (add `@unovis/vue`, `@unovis/ts`)

**Interfaces:** Consumes `useClientResource('revenue_lines')`, `app/domain/attribution.ts` (`monthlyTotals`, `accountTotal`, `computeLift`).

- [ ] **Step 1: Add Unovis** (controller): `pnpm add @unovis/vue @unovis/ts`

- [ ] **Step 2: Enhance the account detail page**:
  - Load this account's `revenue_lines` (filter by account_id) alongside existing data.
  - Replace the "Graphe CA — Phase 3" placeholder with:
    - **KPIs**: `accountTotal` (CA total), and `computeLift(lines, firstParticipationDate)` showing CA avant / après / delta. `firstParticipationDate` = min `entered_network_at` of the account's participations (null-safe).
    - **Chart**: an Unovis line or bar chart of `monthlyTotals(lines)` (x = period, y = amount). Wrap in `<ClientOnly>` (Unovis is client-only). Use `VisXYContainer` + `VisLine`/`VisAxis` (or `VisStackedBar`). If no revenue lines, show a muted "Aucune donnée de CA importée".
  - French labels; format amounts with `Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' })` via a small local helper.
- [ ] **Step 3: Verify** `pnpm lint && pnpm typecheck && pnpm build`.
- [ ] **Step 4: Commit** `feat(ui): account revenue chart and lift on detail page`

---

## Fin de Phase 3 — critères de réussite

- Aude-Marie dépose son fichier de facturation mensuelle ; l'app le parse, le matche par SIRET, résout les orphelins, et persiste le CA — fini le croisement manuel.
- La fiche compte montre le CA mensuel et le lift avant/après participation (« il a commandé le mois d'après »).
- Toute la logique d'attribution/parsing est pure et couverte par tests unitaires.
- `pnpm lint`, `pnpm typecheck`, `pnpm build`, `pnpm vitest run` passent.
- L'abstraction `revenue_lines.source` reste prête pour un futur connecteur Salesforce.
