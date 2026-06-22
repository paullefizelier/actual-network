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
