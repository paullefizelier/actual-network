# Pilotage Network — Phase 4 : Dashboards — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** La page de pilotage que Samuel/Bruno veulent voir : business direct/indirect, volume de leads, % clients, top partenariats, répartition par catégorie, efficacité par événement — filtrable par période et partenariat. Et d'abord protéger l'intégrité des chiffres (garde anti-double-import).

**Architecture:** Agrégation **côté client** dans une fonction pure `buildDashboard` (réutilise le domaine d'attribution Phase 3), chargée par un composable `useDashboard` scopé au client courant. La page consomme le résultat (cartes KPI + graphes Unovis). Logique d'agrégation testée en TDD. (Note : à volume MVP, l'agrégation client-side réutilisant la logique testée est le bon choix ; une agrégation serveur/SQL sera une optimisation d'échelle ultérieure.)

**Tech Stack:** Nuxt 4, Nuxt UI 4, @nuxtjs/supabase 2, Unovis, Vitest. Repose sur Phases 1-3 (domaine `app/domain/attribution.ts`, `useClientResource`).

## Global Constraints

- **Scoping client** : tout chargement via `useClientResource` (RLS = sécurité), scopé au client courant.
- **Réutiliser le domaine** : `accountTotal`, `monthlyTotals`, `aggregateByDirection`, `eventEfficiency` (Phase 3) — ne PAS réimplémenter. L'agrégation dashboard est une fonction pure composant ces briques.
- **Pas de `any`** ; libellés UI français ; montants en `Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' })`.
- **Unovis client-only** : graphes dans `<ClientOnly>`.
- **Selects** : optionnels → `.optional()`/undefined, jamais nullable.
- **ESLint** : commaDangle never, braceStyle 1tbs, max-statements-per-line 1 (it() multi-ligne), no-explicit-any. `pnpm lint`/`typecheck`/`build`/`vitest run` passent à chaque tâche.
- **Supabase REMOTE** : pas de migration. Contrôleur exécute les commandes réseau.

---

## Task 1: Garde anti-double-import (intégrité des chiffres)

**Files:**
- Create: `app/utils/findDuplicatePeriods.ts`, `test/utils/findDuplicatePeriods.test.ts`
- Modify: `app/pages/import.vue`

**Interfaces:**
- Produces: `findDuplicatePeriods(toImport: { account_id: string, period: string }[], existing: { account_id: string, period: string }[]): { account_id: string, period: string }[]` — pure ; renvoie les paires (compte, période) déjà présentes (intersection), dédoublonnées.

- [ ] **Step 1: Failing test**

```ts
// test/utils/findDuplicatePeriods.test.ts
import { describe, it, expect } from 'vitest'
import { findDuplicatePeriods } from '../../app/utils/findDuplicatePeriods'

describe('findDuplicatePeriods', () => {
  it('returns pairs already present in existing', () => {
    const toImport = [
      { account_id: 'a', period: '2026-01-01' },
      { account_id: 'a', period: '2026-02-01' }
    ]
    const existing = [{ account_id: 'a', period: '2026-01-01' }]
    expect(findDuplicatePeriods(toImport, existing)).toEqual([
      { account_id: 'a', period: '2026-01-01' }
    ])
  })

  it('returns empty when no overlap', () => {
    expect(findDuplicatePeriods(
      [{ account_id: 'a', period: '2026-03-01' }],
      [{ account_id: 'a', period: '2026-01-01' }]
    )).toEqual([])
  })

  it('dedupes repeated pairs in the import set', () => {
    const toImport = [
      { account_id: 'a', period: '2026-01-01' },
      { account_id: 'a', period: '2026-01-01' }
    ]
    const existing = [{ account_id: 'a', period: '2026-01-01' }]
    expect(findDuplicatePeriods(toImport, existing)).toEqual([
      { account_id: 'a', period: '2026-01-01' }
    ])
  })
})
```

- [ ] **Step 2: Run → fails.** `pnpm vitest run test/utils/findDuplicatePeriods.test.ts`

- [ ] **Step 3: Implement** `app/utils/findDuplicatePeriods.ts` — build a `Set` of `\`${account_id}|${period}\`` from `existing`; iterate `toImport`, collect pairs whose key is in the set, dedupe via a seen-set. No `any`.

- [ ] **Step 4: Run → green.**

- [ ] **Step 5: Wire into `app/pages/import.vue`** — at the **preview** step, after computing `matched`, load existing revenue_lines for the matched account_ids (`revenueLinesResource.list()` then filter to matched account_ids, or reuse already-loaded data) and compute `duplicates = findDuplicatePeriods(matched.map(m => ({ account_id: m.account.id, period: m.line.period })), existing.map(r => ({ account_id: r.account_id, period: r.period })))`. If `duplicates.length > 0`, show a prominent `UAlert color="warning"` above the commit button: « X ligne(s) concernent des comptes/périodes déjà importés — valider créera des doublons et faussera le CA. Annulez l'import existant d'abord. » The commit button stays enabled (the user may knowingly proceed) but the warning is unmissable. Keep French labels, no `any`.

- [ ] **Step 6: Verify** `pnpm vitest run`, `pnpm lint`, `pnpm typecheck`, `pnpm build`.

- [ ] **Step 7: Commit** `feat(import): warn on duplicate account/period before commit`

---

## Task 2: Agrégation dashboard (pure + composable, TDD)

**Files:**
- Create: `app/domain/dashboard.ts`, `test/domain/dashboard.test.ts`, `app/composables/useDashboard.ts`

**Interfaces:**
- Produces (pure):
  - input types reusing Phase 3: `AccountRow = { id: string, current_status: string }`, `ParticipationRow = { account_id: string, event_id: string, direction: 'direct' | 'indirect', category: string | null, entered_network_at: string | null }`, `RevenueLineRow = { account_id: string, period: string, amount: number }`, `EventRow = { id: string, name: string, partnership_id: string | null }`, `PartnershipRow = { id: string, name: string }`.
  - `buildDashboard(input: { accounts, participations, revenueLines, events, partnerships }): DashboardData` where `DashboardData = { business: { direct: number, indirect: number, total: number }, leads: { participations: number, accounts: number }, statusCounts: { suspect: number, prospect: number, client: number, clientPct: number }, topPartnerships: { partnership_id: string | null, name: string, leads: number }[], byCategory: { category: string, leads: number }[], eventEfficiency: { event_id: string, name: string, total: number, converted: number, rate: number }[], monthly: { period: string, amount: number }[] }`.
  - It composes: `aggregateByDirection` (with a `Map<account_id, accountTotal>` built from revenueLines), `eventEfficiency` (with a `Set` of account_ids having revenue), `monthlyTotals`; computes status counts + clientPct (clients/total, 0 if no accounts); groups participations by partnership (via event→partnership map) and by category (null → "Sans catégorie"); resolves event/partnership names. topPartnerships sorted by leads desc; byCategory sorted by leads desc.
- `useDashboard()` → `{ data: Ref<DashboardData | null>, loading: Ref<boolean>, load(filters?: { from?: string, to?: string, partnershipId?: string }): Promise<void> }` — loads accounts/participations/revenue_lines/events/partnerships via `useClientResource` (scoped), applies the period/partnership filters (period filters revenueLines by `period` range and participations by `entered_network_at`; partnership filters events→participations), then calls `buildDashboard`.

- [ ] **Step 1: Failing tests for `buildDashboard`** — one rich fixture exercising: 2 accounts (1 client, 1 prospect), participations direct+indirect across 2 events of 2 partnerships, revenue on one account, a null category. Assert each `DashboardData` field with exact values (business.direct/indirect/total, leads counts, statusCounts + clientPct, topPartnerships order, byCategory incl. "Sans catégorie", eventEfficiency rates, monthly). Multi-line it().

- [ ] **Step 2: Run → fails.**

- [ ] **Step 3: Implement** `app/domain/dashboard.ts` (pure, imports from `./attribution`) then `app/composables/useDashboard.ts` (uses `useClientResource`, applies filters, calls buildDashboard). No `any`.

- [ ] **Step 4: Run → green;** `pnpm typecheck`, `pnpm lint`.

- [ ] **Step 5: Commit** `feat(domain): dashboard aggregation (build + composable)`

---

## Task 3: Page de pilotage (`/`)

**Files:**
- Modify: `app/pages/index.vue`

**Interfaces:** Consumes `useDashboard` (Task 2), `useClientResource('partnerships')` (for the partnership filter), Unovis.

- [ ] **Step 1: Build the dashboard page** replacing the current placeholder:
  - **Filters bar**: période (deux `UInput type="date"` from/to, optional) + partenariat (`USelectMenu` from partnerships, optional/undefined). On change, call `useDashboard().load(filters)`. A "Réinitialiser" button.
  - **KPI cards** (UCard grid): Business direct / indirect / total (€, formatEur) ; Volume de leads (participations + comptes) ; % clients (statusCounts.clientPct, with suspect/prospect/client breakdown) ; nb partenariats actifs.
  - **Top partenariats** : UTable or bar (Unovis `VisStackedBar`) of topPartnerships (name, leads).
  - **Répartition par catégorie** : UTable/bar of byCategory.
  - **Efficacité par événement** : UTable (événement, participations, convertis, taux %) — sorted by rate; this objectivise « Escort Kids = 0 conversion ».
  - **CA mensuel global** : Unovis line of `monthly` (wrapped `<ClientOnly>`).
  - **Traçabilité** : the % clients / status cards link to `/comptes` (the list) so each figure can be drilled into. (Simple `NuxtLink` to `/comptes`; deep filtering is a nice-to-have.)
  - Loading skeleton/placeholder; empty state if no data ("Aucune donnée — importez du CA et saisissez des leads").
  - French labels; formatEur helper; no `any`.
- [ ] **Step 2: Verify** `pnpm lint`, `pnpm typecheck`, `pnpm build`.
- [ ] **Step 3: Commit** `feat(ui): pilotage dashboard page`

---

## Fin de Phase 4 — critères de réussite

- La page d'accueil montre les indicateurs clés (direct/indirect, leads, % clients, top partenariats, catégories, efficacité par événement), filtrables par période et partenariat.
- Les chiffres réutilisent le domaine d'attribution testé ; l'agrégation est couverte par tests unitaires.
- Le double-import est signalé avant validation (intégrité des chiffres).
- `pnpm lint`, `pnpm typecheck`, `pnpm build`, `pnpm vitest run` passent.
- Le MVP est complet : saisie (Phase 2) → import & attribution (Phase 3) → pilotage (Phase 4), multi-tenant de bout en bout.
