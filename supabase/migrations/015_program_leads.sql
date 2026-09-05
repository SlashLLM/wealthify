-- Partner Circle / Wealthify Score sign-up leads

create table if not exists public.program_leads (
  id uuid primary key default gen_random_uuid(),
  program text not null check (program in ('partner-circle', 'wealthify-score')),
  full_name text not null,
  email text not null,
  phone text not null,
  created_at timestamptz default now()
);

create index if not exists program_leads_created_at_idx
  on public.program_leads (created_at desc);

alter table public.program_leads enable row level security;

drop policy if exists "anon_insert_program_leads" on public.program_leads;
drop policy if exists "anon_select_program_leads" on public.program_leads;

create policy "anon_insert_program_leads"
  on public.program_leads
  for insert
  to anon
  with check (
    full_name is not null
    and email is not null
    and phone is not null
  );

-- Admin listings run server-side through the anon key (see api/admin/program-leads.js),
-- which is only reachable behind the requireAdmin session guard.
create policy "anon_select_program_leads"
  on public.program_leads
  for select
  to anon
  using (true);

grant usage on schema public to anon;
grant insert, select on public.program_leads to anon;

notify pgrst, 'reload schema';
