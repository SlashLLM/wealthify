-- Grants required for anon key + RLS policies to work via PostgREST

grant usage on schema public to anon;

grant insert, update on public.refinance_leads to anon;
