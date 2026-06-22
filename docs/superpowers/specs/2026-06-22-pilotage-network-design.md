# Pilotage Network — Spec de conception (MVP)

**Date :** 2026-06-22
**Auteur :** Paul Lefizelier
**Statut :** Validé (brainstorming)

## 1. Contexte & objectif

Actual Network est la régie / cellule partenariats d'Actual Group. Elle pilote des
partenariats sportifs (Stade Toulousain, boxe…), invite clients & prospects à des
événements (loges, business clubs, jeu concours « La Recrue »), génère des leads, et
doit **prouver le business généré** : « tel prospect est passé par tel événement → le
mois suivant il a commandé X € ».

Aujourd'hui ce pilotage repose sur un Google Sheet rempli à la main, croisé avec des
extractions Salesforce, un Looker et un tableau croisé dynamique de facturation
mensuelle Actual. Coût : ~2 à 3 jours/mois, avec risque de perte d'information.

**Objectif du MVP :** un back-office réellement utilisable qui **remplace le Google
Sheet** d'Aude-Marie — saisie des leads/participations, import du CA mensuel matché par
SIRET, et dashboards de pilotage du ROI des partenariats.

### Périmètre

**Dans le MVP (chantier A — back-office de pilotage) :**
- Gestion des partenariats (assets) et des événements (opérations).
- Registre des comptes (entreprises) et contacts, avec qualification.
- Saisie des participations (point de contact compte × événement).
- Import du CA mensuel (CSV/XLSX) matché par SIRET, avec résolution des orphelins.
- Dashboards de pilotage (direct/indirect, leads, statuts, top partenariats,
  attribution/lift, efficacité par événement).
- Multi-tenant + RLS dès le jour 1 ; seuls les utilisateurs régie se connectent.

**Hors MVP (anticipé dans l'archi, pas construit) :**
- Chantier B : formulaires publics de capture d'inscription aux événements (SIRET obligatoire).
- Connecteur Salesforce / finance Actual (l'import CSV reste la source pour le MVP).
- Utilisateurs côté client (lecture seule sur leur tenant) et côté réseau/agences.
- Environnement physiquement séparé par client (base/projet dédié).

## 2. Décisions d'architecture validées

1. **Modèle centré « Compte » (SIRET).** L'entité pivot est l'entreprise. Contacts et
   participations sont des satellites ; le CA se rattache au compte par SIRET. Règle
   nativement les doublons et le double comptage.
2. **Multi-tenant dès le jour 1.** Toutes les données rattachées à un `client_id`,
   isolation stricte via Row Level Security Postgres/Supabase. Prépare la souveraineté
   et l'arrivée d'autres clients.
3. **Abstraction « source de revenus ».** Tout CA atterrit dans `revenue_lines` avec un
   champ `source`. Aujourd'hui `import` ; demain `salesforce` écrit dans la même table.
   Le pilotage lit `revenue_lines` sans connaître la source.
4. **Qualification hybride.** Socle de champs structurels fixes (statut
   suspect/prospect/client, direct/indirect, niveau du lead) + catégories configurables
   par client (`clients.settings` jsonb).
5. **Lift calculé, non stocké.** Dérivé des `revenue_lines` et des dates de
   participation. Donnée non dupliquée = pas d'incohérence.

## 3. Stack

- **Front/SSR :** Nuxt 4 + Nuxt UI 4 (composants Table, Form, Modal, Card, dashboard layout).
- **Back :** Supabase (Postgres + Auth + Storage + RLS).
- **Logique sensible :** server routes Nuxt (`/server/api`) pour import & matching.
- **Graphes :** Unovis (lib mise en avant par la doc dashboard Nuxt UI).
- **Tests :** Vitest (unitaires) + tests d'intégration RLS contre Supabase local.

## 4. Modèle de données

Toutes les tables portent un `client_id` (sauf `clients`). Clés étrangères + index sur
`client_id` et `siret`.

| Entité | Rôle | Champs clés |
|---|---|---|
| **clients** | Tenant | `name`, `slug`, `settings` (jsonb : catégories configurables) |
| **memberships** | Accès régie ↔ client | `user_id`, `client_id`, `role` (`admin`/`member`) |
| **partnerships** | Assets | `name`, `type`, `notes` |
| **events** | Opérations | `partnership_id`, `name`, `type`, `date`, `lieu`, `notes` |
| **accounts** | **Pivot** = entreprise | `siret` (unique/client), `name`, `effectif`, `secteur`, `marche_public` (bool), `current_status` (suspect/prospect/client), `became_client_at` |
| **contacts** | Personnes | `account_id`, `nom`, `prenom`, `fonction`, `email`, `tel`, `lead_level` (réseau/patron/chez nous) |
| **participations** | Point de contact compte×événement | `account_id`, `event_id`, `contact_id?`, `direct_indirect`, `category`, `entered_network_at`, `status_at_entry`, `notes` |
| **revenue_lines** | Facturation mensuelle | `account_id`, `period` (mois), `amount`, `activity_line` (talent/emploi/formation), `source` (`import`/`salesforce`) |
| **revenue_imports** | Trace d'import | `filename`, `uploaded_by`, `row_count`, `matched`, `unmatched`, `status` |

**Enums fixes :** `account_status` (suspect/prospect/client), `direction` (direct/indirect),
`lead_level` (reseau/patron/interne), `activity_line` (talent/emploi/formation/autre),
`revenue_source` (import/salesforce), `member_role` (admin/member).

## 5. Ingestion du CA & attribution

### Flux d'import
1. Upload du fichier de facturation mensuelle (Storage Supabase).
2. Server route : parse CSV/XLSX, mapping des colonnes (SIRET, période, montant, ligne
   d'activité). Mapping mémorisé par client (format stable).
3. Matching par SIRET contre `accounts` → écran de pré-visualisation : lignes matchées
   vs orphelines (SIRET inconnu).
4. Résolution des orphelines (créer le compte / ignorer / rapprocher) → validation →
   création des `revenue_lines` rattachées à `revenue_imports` (annulation/rejeu possible).

### Logique d'attribution (code pur, testé en TDD)
- **CA par compte** = somme des `revenue_lines`, ventilable par mois / ligne d'activité.
- **Lift d'un compte** = CA après 1ʳᵉ participation − CA avant (fenêtre comparable).
- **Direct vs indirect** = agrégation selon `participations.direction`.
- **Efficacité d'un événement** = % de participations ayant généré du CA.
- **Dédoublonnage CA** : attribution au niveau compte, pas par participation (pas de
  double comptage si plusieurs participations).

## 6. Sécurité & multi-tenant

- Isolation par **RLS Postgres**, pas dans le code Nuxt. Fonction SQL réutilisable
  `auth_has_client_access(client_id)` ; policy sur chaque table : accès si membre du
  `client_id` de la ligne.
- `memberships` lie utilisateur ↔ client(s) + rôle.
- Server routes sensibles : contexte utilisateur, jamais de clé service qui contourne la
  RLS (sauf admin explicite et tracé).
- **Auth :** Supabase Auth email + mot de passe. Pas d'inscription ouverte ; comptes
  régie créés par un admin.
- **MVP :** tous les utilisateurs régie membres du client « Actual ». Sélecteur de
  client dans la barre du haut (prêt pour le 2e client sans refonte).
- **Souveraineté — limite assumée :** dans ce MVP les données vivent dans une base
  Supabase d'Actual Network, isolées logiquement par RLS. L'environnement physiquement
  séparé par client est compatible avec l'archi mais relève d'une étape ultérieure.

## 7. Écrans (Nuxt UI 4)

1. **Connexion** — email/mot de passe.
2. **Dashboard / Pilotage** (accueil) — indicateurs (section 8).
3. **Comptes** — vue « tableur » filtrable/triable (statut, direction, partenariat,
   catégorie, niveau du lead), recherche nom/SIRET. Remplace visuellement le Sheet.
4. **Fiche compte** (cœur de valeur) — identité (SIRET, effectif, secteur, statut,
   marché public), timeline des participations, graphe CA mensuel avec repère des
   participations (on *voit* le lift), liste des contacts.
5. **Contacts** — gérés depuis la fiche compte + vue liste globale.
6. **Partenariats & Événements** — CRUD assets + opérations (type, date, lieu).
7. **Import CA** — upload → mapping → pré-visualisation (matchées/orphelines) →
   résolution → validation. Historique des imports + annulation de batch.
8. **Saisie / édition d'un lead (participation)** — compte (création à la volée si SIRET
   inconnu), contact, événement, direction, catégorie, statut à l'entrée, notes.
9. **Réglages client** — catégories configurables, infos du client.

Priorité UX : écrans **7 (import CA)** et **8 (nouveau lead)** — la saisie quotidienne.

## 8. Dashboard / indicateurs

- **Business généré** : total direct (assets) vs indirect (prospects), en € de marge.
- **Volume de leads** générés par l'activité network.
- **Répartition par statut** : suspects/prospects/clients + % clients.
- **Top partenariats** par nombre de leads.
- **Répartition par source/catégorie** : business club / events / hospitalité.
- **Attribution / lift** : comptes avec CA avant/après participation.
- **Efficacité par événement** : taux de conversion.

Tous filtrables par période et partenariat, scopés au client courant. Chaque chiffre est
traçable (clic → comptes derrière) : « on explique chaque donnée ».

## 9. Tests & qualité

- **Logique d'attribution** (matching SIRET, lift, agrégations, dédoublonnage) : code
  pur isolé des frameworks (`domain/`), tests unitaires Vitest en TDD.
- **Parsing d'import** (CSV/XLSX, mapping, orphelins) : unitaires sur fixtures.
- **RLS** : tests d'intégration contre Supabase local — client A ne voit jamais client B.
- **Écrans** : smoke tests légers.

Découpage en unités à responsabilité unique : domaine (sans dépendance framework) ↔
server routes (orchestration) ↔ UI (consommation).
