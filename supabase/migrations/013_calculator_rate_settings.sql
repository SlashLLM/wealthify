-- Singleton settings for refinance calculator new rate (manual vs auto Special)

create table if not exists public.calculator_rate_settings (
  id int primary key default 1 check (id = 1),
  manual_enabled boolean not null default false,
  manual_rate numeric,
  updated_at timestamptz not null default now()
);

insert into public.calculator_rate_settings (id)
values (1)
on conflict (id) do nothing;

grant select, update on public.calculator_rate_settings to anon;

drop policy if exists "anon_select_calculator_rate_settings" on public.calculator_rate_settings;
create policy "anon_select_calculator_rate_settings"
  on public.calculator_rate_settings
  for select
  to anon
  using (true);

drop policy if exists "anon_update_calculator_rate_settings" on public.calculator_rate_settings;
create policy "anon_update_calculator_rate_settings"
  on public.calculator_rate_settings
  for update
  to anon
  using (true)
  with check (true);

notify pgrst, 'reload schema';
