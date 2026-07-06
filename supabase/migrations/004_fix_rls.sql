-- Run this in Supabase SQL Editor if inserts fail with RLS errors.
-- Safe to re-run.

alter table public.refinance_leads enable row level security;

grant usage on schema public to anon;
grant insert, update on public.refinance_leads to anon;

drop policy if exists "anon_insert_refinance_leads" on public.refinance_leads;
drop policy if exists "anon_update_refinance_leads" on public.refinance_leads;

-- Step 1: anon may insert a new lead (email + phone)
create policy "anon_insert_refinance_leads"
  on public.refinance_leads
  for insert
  to anon
  with check (
    email is not null
    and phone is not null
  );

-- Step 2: anon may complete a lead within 24 hours (no SELECT policy needed;
-- the API uses return=minimal and parses the new row id from the Location header).

create policy "anon_update_refinance_leads"
  on public.refinance_leads
  for update
  to anon
  using (
    property_address is null
    and created_at > (now() - interval '24 hours')
  )
  with check (
    property_address is not null
    and loan_balance is not null
  );
