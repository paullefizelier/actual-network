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
