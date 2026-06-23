-- supabase/migrations/0004_clients_update_policy.sql
-- The clients table only had a SELECT policy (0003), so updating clients.settings
-- (configurable categories, import column mapping) was silently blocked by RLS
-- (0 rows updated). Allow members of a client to update that client's row.

create policy client_update on clients
  for update
  using (public.auth_has_client_access(id))
  with check (public.auth_has_client_access(id));
