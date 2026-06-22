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
