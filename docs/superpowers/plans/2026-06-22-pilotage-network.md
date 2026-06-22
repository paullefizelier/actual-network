# Pilotage Network — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construire le MVP du back-office de pilotage Actual Network qui remplace le Google Sheet : registre des comptes/contacts/participations, import du CA mensuel matché par SIRET, et dashboards de ROI, le tout multi-tenant et isolé par RLS.

**Architecture:** Nuxt 4 (SSR + server routes) en front/orchestration, Supabase (Postgres + Auth + Storage + RLS) en back. Modèle centré « Compte » (clé SIRET). Logique d'attribution en code pur isolé du framework (`app/domain/`), testée en TDD. Isolation multi-tenant gérée en base via Row Level Security, pas dans le code applicatif.

**Tech Stack:** Nuxt 4.4, Nuxt UI 4.8, @nuxtjs/supabase 2, Supabase CLI (Postgres local), Unovis (charts), Vitest (tests), TypeScript.

## Global Constraints

- **Multi-tenant dès J1** : toute table métier porte `client_id` ; isolation par RLS Postgres, jamais uniquement dans le code Nuxt.
- **Auth** : Supabase Auth email + mot de passe uniquement. Pas d'inscription ouverte (comptes créés par admin).
- **Source CA abstraite** : tout CA atterrit dans `revenue_lines.source` (`import` aujourd'hui, `salesforce` demain). Le pilotage lit `revenue_lines` sans connaître la source.
- **Qualification hybride** : champs structurels fixes (enums) + catégories configurables dans `clients.settings` (jsonb).
- **Lift non stocké** : toujours calculé depuis `revenue_lines` + dates de participation.
- **TDD** sur toute la logique de domaine et le parsing d'import. RLS testée par intégration.
- **Langue** : libellés UI et noms de colonnes métier en français ; identifiants de code en anglais.
- **Lint** : ESLint stylistic `commaDangle: never`, `braceStyle: 1tbs` (déjà configuré).

---

## Découpage en phases

Le MVP est livré en 4 plans séquentiels. Chacun produit un logiciel qui marche et se teste seul.

- **Phase 1 — Fondations** *(détaillée ci-dessous)* : Supabase local, schéma complet, RLS multi-tenant, auth, contexte tenant, app shell. Livrable : on se connecte, les données sont isolées par client, la navigation existe.
- **Phase 2 — Registre & CRUD** *(roadmap ci-dessous)* : partenariats, événements, comptes, contacts, participations. Livrable : on gère tout le registre depuis l'UI.
- **Phase 3 — Revenus & attribution** *(roadmap ci-dessous)* : import CSV/XLSX, matching SIRET, calcul du lift. Livrable : on importe le CA et on voit le ROI par compte.
- **Phase 4 — Dashboards** *(roadmap ci-dessous)* : indicateurs de pilotage. Livrable : la page d'accueil de pilotage.

Les phases 2-4 seront développées en détail bite-sized juste avant leur exécution.

---

# PHASE 1 — FONDATIONS

## Structure des fichiers (Phase 1)

- `supabase/config.toml` — config projet Supabase local (généré par `supabase init`).
- `supabase/migrations/0001_core.sql` — enums, `clients`, `memberships`, fonction `auth_has_client_access`.
- `supabase/migrations/0002_domain.sql` — tables métier (partnerships → revenue_imports).
- `supabase/migrations/0003_rls.sql` — activation RLS + policies sur toutes les tables.
- `supabase/seed.sql` — données de dev (client Actual + 2 clients de test pour l'isolation).
- `.env` — `SUPABASE_URL`, `SUPABASE_KEY`, `SUPABASE_SERVICE_KEY` (local).
- `nuxt.config.ts` — ajout module `@nuxtjs/supabase` + `redirectOptions`.
- `app/types/database.ts` — types TS générés depuis le schéma Supabase.
- `app/composables/useCurrentClient.ts` — état du client (tenant) courant + liste des memberships.
- `app/middleware/auth.global.ts` — (fourni par le module ; on configure les redirections).
- `app/pages/login.vue` — écran de connexion email/mot de passe.
- `app/layouts/default.vue` — app shell (sidebar nav + topbar : switcher client + menu user).
- `app/pages/index.vue` — page d'accueil (placeholder dashboard, remplacé en Phase 4).
- `vitest.config.ts` + `test/setup.ts` — config tests.
- `test/rls/isolation.test.ts` — test d'intégration isolation multi-tenant.

---

> **Workflow Supabase : REMOTE.** Ce projet utilise un projet Supabase **hébergé**, pas de stack locale Docker. Les migrations sont appliquées avec `supabase db push` sur le projet lié (`supabase link` déjà fait). On n'utilise jamais `supabase start` / `supabase migration up`. Les tests d'intégration tournent contre la base distante et nettoient leurs données en teardown. `SUPABASE_URL`/`SUPABASE_KEY`/`SUPABASE_SERVICE_KEY` pointent vers le projet distant.

## Task 1: Brancher le module Nuxt sur le projet Supabase distant

**Files:**
- Create: `.env` (fait par l'utilisateur), `.gitignore` (compléter)
- Modify: `nuxt.config.ts`

**Interfaces:**
- Produces: variables d'env `SUPABASE_URL`, `SUPABASE_KEY`, `SUPABASE_SERVICE_KEY` (projet distant) ; module Supabase actif fournissant `useSupabaseClient()`, `useSupabaseUser()`, `serverSupabaseClient()`.

- [ ] **Step 1: Vérifier le lien au projet distant**

`supabase link` est déjà fait par l'utilisateur. Vérifier :
```bash
cd /Users/paulefizelier/Documents/actual/actual-network
supabase projects list
```
Expected: le projet lié apparaît avec une coche `●`.

- [ ] **Step 2: Vérifier le `.env`** (configuré par l'utilisateur)

Le `.env` contient les credentials du projet **distant** :
```bash
SUPABASE_URL="https://<project-ref>.supabase.co"
SUPABASE_KEY="<anon key du projet distant>"
SUPABASE_SERVICE_KEY="<service_role key du projet distant>"
```

- [ ] **Step 3: S'assurer que `.gitignore` ignore les secrets et artefacts**

Vérifier / ajouter dans `.gitignore` :
```
.env
.env.*
supabase/.branches
supabase/.temp
```

- [ ] **Step 4: Ajouter le module Supabase à `nuxt.config.ts`**

```ts
export default defineNuxtConfig({
  modules: ['@nuxt/eslint', '@nuxt/ui', '@nuxt/scripts', '@nuxtjs/supabase'],

  devtools: {
    enabled: true
  },

  css: ['~/assets/css/main.css'],

  supabase: {
    types: '~/types/database.ts',
    redirectOptions: {
      login: '/login',
      callback: '/confirm',
      exclude: ['/login'],
      saveRedirectToCookie: true
    }
  },

  routeRules: {},

  compatibilityDate: '2025-01-15',

  eslint: {
    config: {
      stylistic: {
        commaDangle: 'never',
        braceStyle: '1tbs'
      }
    }
  }
})
```
Note : on retire `'/': { prerender: true }` — toutes les pages deviennent authentifiées/dynamiques.

- [ ] **Step 5: Vérifier que le serveur démarre**

Run: `pnpm dev`
Expected: serveur up sans erreur ; un accès à `/` redirige vers `/login` (le middleware du module protège tout sauf `exclude`).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: init supabase local and wire @nuxtjs/supabase module"
```

---

## Task 2: Migration core — enums, clients, memberships, helper RLS

**Files:**
- Create: `supabase/migrations/0001_core.sql`

**Interfaces:**
- Produces: enums (`account_status`, `direction`, `lead_level`, `activity_line`, `revenue_source`, `member_role`) ; tables `clients(id, name, slug, settings, created_at)`, `memberships(id, user_id, client_id, role, created_at)` ; fonction `public.auth_has_client_access(target uuid) returns boolean`.

- [ ] **Step 1: Écrire la migration core**

```sql
-- supabase/migrations/0001_core.sql

create extension if not exists "pgcrypto";

create type account_status as enum ('suspect', 'prospect', 'client');
create type direction      as enum ('direct', 'indirect');
create type lead_level      as enum ('reseau', 'patron', 'interne');
create type activity_line   as enum ('talent', 'emploi', 'formation', 'autre');
create type revenue_source  as enum ('import', 'salesforce');
create type member_role      as enum ('admin', 'member');

create table clients (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  slug       text not null unique,
  settings   jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table memberships (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  client_id  uuid not null references clients (id) on delete cascade,
  role       member_role not null default 'member',
  created_at timestamptz not null default now(),
  unique (user_id, client_id)
);

create index on memberships (user_id);
create index on memberships (client_id);

-- Vrai si l'utilisateur courant est membre du client cible.
create or replace function public.auth_has_client_access(target uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from memberships m
    where m.client_id = target
      and m.user_id = auth.uid()
  );
$$;
```

- [ ] **Step 2: Appliquer la migration sur le projet distant**

Run: `supabase db push`
Expected: `Applying migration 0001_core.sql...` sur le projet distant, sans erreur.

- [ ] **Step 3: Vérifier les objets créés**

Via le **dashboard Supabase du projet distant** (Table Editor / SQL Editor) : vérifier la présence des tables `clients`, `memberships` et des types enum (`select typname from pg_type where typname in ('account_status','direction','lead_level','activity_line','revenue_source','member_role');`).
Expected: 6 types enum + 2 tables présents.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0001_core.sql
git commit -m "feat(db): core schema — enums, clients, memberships, RLS helper"
```

---

## Task 3: Migration domaine — tables métier

**Files:**
- Create: `supabase/migrations/0002_domain.sql`

**Interfaces:**
- Consumes: `clients`, enums (Task 2).
- Produces: tables `partnerships`, `events`, `accounts`, `contacts`, `participations`, `revenue_lines`, `revenue_imports`, toutes avec `client_id uuid not null references clients`.

- [ ] **Step 1: Écrire la migration domaine**

```sql
-- supabase/migrations/0002_domain.sql

create table partnerships (
  id         uuid primary key default gen_random_uuid(),
  client_id  uuid not null references clients (id) on delete cascade,
  name       text not null,
  type       text,
  notes      text,
  created_at timestamptz not null default now()
);

create table events (
  id             uuid primary key default gen_random_uuid(),
  client_id      uuid not null references clients (id) on delete cascade,
  partnership_id uuid references partnerships (id) on delete set null,
  name           text not null,
  type           text,
  date           date,
  lieu           text,
  notes          text,
  created_at     timestamptz not null default now()
);

create table accounts (
  id              uuid primary key default gen_random_uuid(),
  client_id       uuid not null references clients (id) on delete cascade,
  siret           text,
  name            text not null,
  effectif        text,
  secteur         text,
  marche_public   boolean not null default false,
  current_status  account_status not null default 'suspect',
  became_client_at date,
  created_at      timestamptz not null default now(),
  unique (client_id, siret)
);

create table contacts (
  id         uuid primary key default gen_random_uuid(),
  client_id  uuid not null references clients (id) on delete cascade,
  account_id uuid not null references accounts (id) on delete cascade,
  nom        text,
  prenom     text,
  fonction   text,
  email      text,
  tel        text,
  lead_level lead_level,
  created_at timestamptz not null default now()
);

create table participations (
  id                uuid primary key default gen_random_uuid(),
  client_id         uuid not null references clients (id) on delete cascade,
  account_id        uuid not null references accounts (id) on delete cascade,
  event_id          uuid not null references events (id) on delete cascade,
  contact_id        uuid references contacts (id) on delete set null,
  direction         direction not null,
  category          text,
  entered_network_at date,
  status_at_entry   account_status,
  notes             text,
  created_at        timestamptz not null default now()
);

create table revenue_imports (
  id         uuid primary key default gen_random_uuid(),
  client_id  uuid not null references clients (id) on delete cascade,
  filename   text not null,
  uploaded_by uuid references auth.users (id) on delete set null,
  row_count  integer not null default 0,
  matched    integer not null default 0,
  unmatched  integer not null default 0,
  status     text not null default 'pending',
  created_at timestamptz not null default now()
);

create table revenue_lines (
  id            uuid primary key default gen_random_uuid(),
  client_id     uuid not null references clients (id) on delete cascade,
  account_id    uuid not null references accounts (id) on delete cascade,
  import_id     uuid references revenue_imports (id) on delete cascade,
  period        date not null,
  amount        numeric(14,2) not null,
  activity_line activity_line not null default 'autre',
  source        revenue_source not null default 'import',
  created_at    timestamptz not null default now()
);

create index on partnerships (client_id);
create index on events (client_id);
create index on accounts (client_id);
create index on accounts (client_id, siret);
create index on contacts (client_id, account_id);
create index on participations (client_id, account_id);
create index on participations (client_id, event_id);
create index on revenue_lines (client_id, account_id);
create index on revenue_lines (client_id, period);
```

- [ ] **Step 2: Appliquer la migration sur le projet distant**

Run: `supabase db push`
Expected: appliqué sans erreur.

- [ ] **Step 3: Régénérer les types TS depuis le projet distant**

Run: `supabase gen types typescript --linked > app/types/database.ts`
Expected: fichier `app/types/database.ts` contenant `Database` avec toutes les tables.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0002_domain.sql app/types/database.ts
git commit -m "feat(db): domain tables (accounts/contacts/participations/revenue)"
```

---

## Task 4: RLS — policies + test d'isolation multi-tenant

**Files:**
- Create: `supabase/migrations/0003_rls.sql`, `supabase/seed.sql`, `vitest.config.ts`, `test/setup.ts`, `test/rls/isolation.test.ts`

**Interfaces:**
- Consumes: toutes les tables + `auth_has_client_access` (Tasks 2-3).
- Produces: RLS active sur toutes les tables métier ; garantie testée « client A ne voit jamais client B ».

- [ ] **Step 1: Écrire le test d'isolation (qui doit échouer)**

```ts
// test/rls/isolation.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'

const URL = process.env.SUPABASE_URL!
const ANON = process.env.SUPABASE_KEY!
const SERVICE = process.env.SUPABASE_SERVICE_KEY!

const admin = createClient(URL, SERVICE, { auth: { persistSession: false } })

let clientA: string
let clientB: string
let userId: string
const userA = { email: 'a@test.dev', password: 'password123' }

beforeAll(async () => {
  // Seed deux clients + un compte chacun, via service role (bypass RLS)
  const { data: ca } = await admin.from('clients').insert({ name: 'A', slug: 'a' }).select().single()
  const { data: cb } = await admin.from('clients').insert({ name: 'B', slug: 'b' }).select().single()
  clientA = ca!.id
  clientB = cb!.id
  await admin.from('accounts').insert({ client_id: clientA, name: 'Compte A' })
  await admin.from('accounts').insert({ client_id: clientB, name: 'Compte B' })

  // Créer userA, membre de clientA seulement
  const { data: u } = await admin.auth.admin.createUser({ email: userA.email, password: userA.password, email_confirm: true })
  userId = u.user!.id
  await admin.from('memberships').insert({ user_id: userId, client_id: clientA, role: 'admin' })
})

afterAll(async () => {
  // Nettoyer la base distante : cascade supprime comptes/memberships
  await admin.from('clients').delete().in('id', [clientA, clientB])
  if (userId) await admin.auth.admin.deleteUser(userId)
})

describe('RLS multi-tenant isolation', () => {
  it('un membre de A ne voit que les comptes de A', async () => {
    const c = createClient(URL, ANON, { auth: { persistSession: false } })
    await c.auth.signInWithPassword(userA)
    const { data } = await c.from('accounts').select('client_id')
    expect(data).toBeTruthy()
    expect(data!.every(r => r.client_id === clientA)).toBe(true)
    expect(data!.length).toBe(1)
  })
})
```

- [ ] **Step 2: Config Vitest + setup env**

```ts
// vitest.config.ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    setupFiles: ['test/setup.ts'],
    include: ['test/**/*.test.ts']
  }
})
```

```ts
// test/setup.ts
import { config } from 'dotenv'
config()
```
Installer la dépendance de test : `pnpm add -D vitest dotenv @supabase/supabase-js`

- [ ] **Step 3: Lancer le test → il échoue**

Run: `pnpm vitest run test/rls/isolation.test.ts`
Expected: FAIL — sans RLS, le membre de A voit 2 comptes (A et B), donc `length` ≠ 1.

- [ ] **Step 4: Écrire la migration RLS**

```sql
-- supabase/migrations/0003_rls.sql

alter table clients         enable row level security;
alter table memberships     enable row level security;
alter table partnerships    enable row level security;
alter table events          enable row level security;
alter table accounts        enable row level security;
alter table contacts        enable row level security;
alter table participations  enable row level security;
alter table revenue_imports enable row level security;
alter table revenue_lines   enable row level security;

-- clients : visible si membre
create policy client_access on clients
  for select using (public.auth_has_client_access(id));

-- memberships : l'utilisateur voit ses propres lignes
create policy own_memberships on memberships
  for select using (user_id = auth.uid());

-- Macro pour les tables métier : accès complet si membre du client_id de la ligne
do $$
declare t text;
begin
  foreach t in array array[
    'partnerships','events','accounts','contacts',
    'participations','revenue_imports','revenue_lines'
  ] loop
    execute format($f$
      create policy %1$s_all on %1$I
        for all
        using (public.auth_has_client_access(client_id))
        with check (public.auth_has_client_access(client_id));
    $f$, t);
  end loop;
end $$;
```

- [ ] **Step 5: Appliquer et relancer le test → il passe**

Run: `supabase db push && pnpm vitest run test/rls/isolation.test.ts`
Expected: PASS — le membre de A ne voit qu'1 compte, celui de A. Le teardown nettoie les données de test sur la base distante.

- [ ] **Step 6: Créer le client Actual sur le projet distant**

`supabase db push` ne joue **pas** `seed.sql` (réservé à `supabase db reset` local). On garde `supabase/seed.sql` comme référence, mais on insère le client Actual via le **SQL Editor du dashboard distant** :

```sql
-- supabase/seed.sql (référence ; à exécuter via le dashboard distant)
insert into clients (name, slug) values ('Actual', 'actual')
  on conflict (slug) do nothing;
```

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/0003_rls.sql supabase/seed.sql vitest.config.ts test/
git commit -m "feat(db): RLS policies + multi-tenant isolation integration test"
```

---

## Task 5: Auth — écran de connexion email/mot de passe

**Files:**
- Create: `app/pages/login.vue`, `app/pages/confirm.vue`
- Test: manuel (connexion)

**Interfaces:**
- Consumes: module Supabase (`useSupabaseClient`, `useSupabaseUser`), redirections de Task 1.
- Produces: page `/login` fonctionnelle ; après login l'utilisateur est redirigé vers `/`.

- [ ] **Step 1: Créer un utilisateur de test (régie) sur le projet distant**

Via le **dashboard Supabase distant** → Authentication → Add user : créer un utilisateur email + mot de passe (cocher « auto-confirm »). Puis, dans le **SQL Editor distant**, le rendre membre d'Actual :
```sql
insert into memberships (user_id, client_id, role)
select u.id, c.id, 'admin'
from auth.users u, clients c
where c.slug = 'actual'
order by u.created_at desc
limit 1;
```

- [ ] **Step 2: Écrire la page de login**

```vue
<!-- app/pages/login.vue -->
<script setup lang="ts">
definePageMeta({ layout: false })
const supabase = useSupabaseClient()
const user = useSupabaseUser()
const email = ref('')
const password = ref('')
const error = ref('')
const loading = ref(false)

watchEffect(() => {
  if (user.value) navigateTo('/')
})

async function onSubmit() {
  loading.value = true
  error.value = ''
  const { error: e } = await supabase.auth.signInWithPassword({
    email: email.value,
    password: password.value
  })
  loading.value = false
  if (e) error.value = 'Identifiants invalides'
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center p-4">
    <UCard class="w-full max-w-sm">
      <template #header>
        <h1 class="text-lg font-semibold">Pilotage Network</h1>
      </template>
      <form class="space-y-4" @submit.prevent="onSubmit">
        <UFormField label="Email">
          <UInput v-model="email" type="email" autocomplete="email" class="w-full" />
        </UFormField>
        <UFormField label="Mot de passe">
          <UInput v-model="password" type="password" autocomplete="current-password" class="w-full" />
        </UFormField>
        <UAlert v-if="error" color="error" :title="error" />
        <UButton type="submit" block :loading="loading">Se connecter</UButton>
      </form>
    </UCard>
  </div>
</template>
```

- [ ] **Step 3: Page de callback**

```vue
<!-- app/pages/confirm.vue -->
<script setup lang="ts">
definePageMeta({ layout: false })
const user = useSupabaseUser()
watchEffect(() => {
  if (user.value) navigateTo('/')
})
</script>

<template>
  <div class="min-h-screen flex items-center justify-center">Connexion…</div>
</template>
```

- [ ] **Step 4: Vérifier le flux**

Run: `pnpm dev`, aller sur `/`, être redirigé vers `/login`, se connecter avec l'utilisateur de test.
Expected: redirection vers `/` une fois connecté ; rester connecté au refresh.

- [ ] **Step 5: Commit**

```bash
git add app/pages/login.vue app/pages/confirm.vue
git commit -m "feat(auth): email/password login screen"
```

---

## Task 6: Contexte tenant — composable client courant + memberships

**Files:**
- Create: `app/composables/useCurrentClient.ts`
- Test: `test/composables/useCurrentClient.test.ts` (logique de sélection pure)

**Interfaces:**
- Consumes: `useSupabaseClient`, table `memberships` + `clients`.
- Produces: `useCurrentClient()` → `{ clients: Ref<ClientRow[]>, current: Ref<ClientRow | null>, setCurrent(id: string): void, load(): Promise<void> }`. `pickDefaultClient(clients, savedId)` exporté et testable.

- [ ] **Step 1: Écrire le test de la sélection par défaut (échoue)**

```ts
// test/composables/useCurrentClient.test.ts
import { describe, it, expect } from 'vitest'
import { pickDefaultClient } from '../../app/composables/useCurrentClient'

const clients = [{ id: '1', name: 'A', slug: 'a' }, { id: '2', name: 'B', slug: 'b' }]

describe('pickDefaultClient', () => {
  it('reprend le client sauvegardé s\'il existe encore', () => {
    expect(pickDefaultClient(clients, '2')!.id).toBe('2')
  })
  it('prend le premier client si aucun sauvegardé', () => {
    expect(pickDefaultClient(clients, null)!.id).toBe('1')
  })
  it('prend le premier si le sauvegardé n\'existe plus', () => {
    expect(pickDefaultClient(clients, '99')!.id).toBe('1')
  })
  it('renvoie null si aucun client', () => {
    expect(pickDefaultClient([], '1')).toBeNull()
  })
})
```

- [ ] **Step 2: Lancer → échoue**

Run: `pnpm vitest run test/composables/useCurrentClient.test.ts`
Expected: FAIL — `pickDefaultClient` non défini.

- [ ] **Step 3: Implémenter le composable**

```ts
// app/composables/useCurrentClient.ts
export interface ClientRow { id: string, name: string, slug: string }

export function pickDefaultClient(clients: ClientRow[], savedId: string | null): ClientRow | null {
  if (clients.length === 0) return null
  if (savedId) {
    const found = clients.find(c => c.id === savedId)
    if (found) return found
  }
  return clients[0]
}

const STORAGE_KEY = 'an:current-client'

export function useCurrentClient() {
  const supabase = useSupabaseClient()
  const clients = useState<ClientRow[]>('clients', () => [])
  const current = useState<ClientRow | null>('current-client', () => null)

  async function load() {
    const { data } = await supabase
      .from('clients')
      .select('id, name, slug')
      .order('name')
    clients.value = (data as ClientRow[]) ?? []
    const saved = import.meta.client ? localStorage.getItem(STORAGE_KEY) : null
    current.value = pickDefaultClient(clients.value, saved)
  }

  function setCurrent(id: string) {
    const found = clients.value.find(c => c.id === id) ?? null
    current.value = found
    if (found && import.meta.client) localStorage.setItem(STORAGE_KEY, found.id)
  }

  return { clients, current, setCurrent, load }
}
```

- [ ] **Step 4: Lancer → passe**

Run: `pnpm vitest run test/composables/useCurrentClient.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add app/composables/useCurrentClient.ts test/composables/useCurrentClient.test.ts
git commit -m "feat(tenant): current-client composable with default selection logic"
```

---

## Task 7: App shell — layout sidebar + topbar avec switcher client

**Files:**
- Create: `app/layouts/default.vue`
- Modify: `app/app.vue` (simplifier en `<UApp><NuxtLayout><NuxtPage /></NuxtLayout></UApp>`), `app/pages/index.vue` (placeholder), supprimer `app/components/TemplateMenu.vue` et `app/components/AppLogo.vue` si plus utilisés
- Test: manuel

**Interfaces:**
- Consumes: `useCurrentClient` (Task 6), `useSupabaseClient`.
- Produces: layout `default` enveloppant les pages avec navigation + sélecteur de client + déconnexion.

- [ ] **Step 1: Simplifier `app/app.vue`**

```vue
<!-- app/app.vue -->
<script setup lang="ts">
useHead({ htmlAttrs: { lang: 'fr' } })
</script>

<template>
  <UApp>
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>
```

- [ ] **Step 2: Créer le layout par défaut**

```vue
<!-- app/layouts/default.vue -->
<script setup lang="ts">
const supabase = useSupabaseClient()
const { clients, current, setCurrent, load } = useCurrentClient()
await load()

const nav = [
  { label: 'Pilotage', icon: 'i-lucide-gauge', to: '/' },
  { label: 'Comptes', icon: 'i-lucide-building-2', to: '/comptes' },
  { label: 'Partenariats', icon: 'i-lucide-handshake', to: '/partenariats' },
  { label: 'Événements', icon: 'i-lucide-calendar', to: '/evenements' },
  { label: 'Import CA', icon: 'i-lucide-upload', to: '/import' },
  { label: 'Réglages', icon: 'i-lucide-settings', to: '/reglages' }
]

const clientItems = computed(() => clients.value.map(c => ({
  label: c.name,
  onSelect: () => setCurrent(c.id)
})))

async function logout() {
  await supabase.auth.signOut()
  await navigateTo('/login')
}
</script>

<template>
  <div class="min-h-screen flex">
    <aside class="w-60 border-r border-default p-4 flex flex-col gap-2">
      <div class="font-semibold px-2 py-3">Pilotage Network</div>
      <UNavigationMenu orientation="vertical" :items="nav" />
    </aside>
    <div class="flex-1 flex flex-col">
      <header class="h-14 border-b border-default flex items-center justify-between px-4">
        <UDropdownMenu :items="clientItems">
          <UButton variant="ghost" icon="i-lucide-chevron-down" trailing>
            {{ current?.name ?? 'Aucun client' }}
          </UButton>
        </UDropdownMenu>
        <div class="flex items-center gap-2">
          <UColorModeButton />
          <UButton variant="ghost" icon="i-lucide-log-out" @click="logout">Déconnexion</UButton>
        </div>
      </header>
      <main class="flex-1 p-6"><slot /></main>
    </div>
  </div>
</template>
```

- [ ] **Step 3: Placeholder de la page d'accueil**

```vue
<!-- app/pages/index.vue -->
<script setup lang="ts">
const { current } = useCurrentClient()
</script>

<template>
  <div>
    <h1 class="text-xl font-semibold mb-2">Pilotage</h1>
    <p class="text-muted">Client courant : {{ current?.name ?? '—' }}. Dashboards en Phase 4.</p>
  </div>
</template>
```

- [ ] **Step 4: Nettoyer les composants template inutilisés**

```bash
git rm app/components/TemplateMenu.vue app/components/AppLogo.vue
```

- [ ] **Step 5: Vérifier**

Run: `pnpm dev` puis se connecter.
Expected: app shell avec sidebar, switcher affichant « Actual », déconnexion fonctionnelle. `pnpm lint` et `pnpm typecheck` passent.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(ui): app shell layout with client switcher and logout"
```

---

## Fin de Phase 1 — critères de réussite

- On se connecte en email/mot de passe ; tout est protégé sauf `/login`.
- Le test d'intégration RLS passe : un membre de A ne voit jamais les données de B.
- L'app shell affiche la navigation, le client courant, et permet la déconnexion.
- `pnpm lint`, `pnpm typecheck` et `pnpm vitest run` passent.

---

# PHASE 2 — REGISTRE & CRUD *(roadmap)*

Produit : gestion complète du registre depuis l'UI. Tâches prévues (à détailler avant exécution) :

- **Couche d'accès données** : composables `useTable` génériques scopés au `client_id` courant (insert/select/update injectent `current.id`).
- **Partenariats** : page liste + création/édition (UModal + UForm), table Nuxt UI.
- **Événements** : liste filtrable par partenariat + CRUD (type, date, lieu).
- **Comptes** : vue « tableur » (UTable) filtrable/triable (statut, direction, partenariat, catégorie, niveau du lead) + recherche nom/SIRET. Création à la volée par SIRET (dédoublonnage via `unique (client_id, siret)`).
- **Fiche compte** : identité + onglets contacts / participations. Édition inline des contacts.
- **Participations (saisie lead)** : formulaire complet (compte, contact, événement, direction, catégorie, statut à l'entrée, notes) ; création de compte/contact à la volée.
- **Réglages client** : édition des catégories configurables dans `clients.settings` (jsonb).
- Skill **nuxt-ui** invoquée pour les patterns Table/Form/Modal.

# PHASE 3 — REVENUS & ATTRIBUTION *(roadmap)*

Produit : import du CA et ROI par compte. Tâches prévues :

- **Domaine `app/domain/attribution.ts`** (code pur, TDD) : `computeAccountRevenue`, `computeLift(participations, revenueLines)`, `aggregateByDirection`, `eventEfficiency`. Tests unitaires sur jeux de données fixtures.
- **Parsing import `app/domain/import-parser.ts`** (TDD) : parse CSV + XLSX, mapping de colonnes paramétrable, normalisation SIRET, sortie lignes typées. Fixtures représentatives.
- **Matching SIRET `app/domain/siret-match.ts`** (TDD) : rapproche lignes parsées ↔ `accounts`, retourne `{ matched, unmatched }`.
- **Server route `/server/api/import`** : upload (Storage), parse, matching, persistance des `revenue_lines` rattachées à `revenue_imports` ; endpoint d'annulation de batch.
- **Écran Import CA** : upload → mapping colonnes → pré-visualisation (matchées/orphelines) → résolution (créer compte / ignorer / rapprocher) → validation. Historique des imports.
- **Fiche compte enrichie** : graphe CA mensuel (Unovis) avec repères de participations → lift visible.

# PHASE 4 — DASHBOARDS *(roadmap)*

Produit : page d'accueil de pilotage. Tâches prévues :

- **Server routes d'agrégation** ou requêtes Supabase (vues SQL) pour : business direct/indirect, volume de leads, répartition par statut (% clients), top partenariats, répartition par catégorie, efficacité par événement.
- **Page `/` dashboard** : cartes KPI + graphes Unovis, filtres période + partenariat, chiffres cliquables (drill-down vers la liste des comptes).
- Skill **nuxt-ui** pour le dashboard layout.
