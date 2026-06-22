-- supabase/seed.sql (référence ; à exécuter via le dashboard distant)
insert into clients (name, slug) values ('Actual', 'actual')
  on conflict (slug) do nothing;
