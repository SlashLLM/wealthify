-- Add full name to refinance calculator leads

alter table public.refinance_leads
  add column if not exists full_name text;

notify pgrst, 'reload schema';
