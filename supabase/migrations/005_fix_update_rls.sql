-- Step-2 update via RPC (bypasses missing/broken UPDATE RLS policies).
-- Superseded by 006_complete_lead_by_email.sql — run 006 instead if step 2 fails.

create or replace function public.complete_refinance_lead(
  lead_email text,
  lead_phone text,
  address text,
  balance numeric
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_id uuid;
begin
  select id into target_id
  from public.refinance_leads
  where email = lead_email
    and phone = lead_phone
    and property_address is null
    and (loan_balance is null or loan_balance = 0)
  order by created_at desc
  limit 1;

  if target_id is null then
    raise exception 'Lead not found or already completed';
  end if;

  update public.refinance_leads
  set
    property_address = address,
    loan_balance = balance,
    updated_at = now()
  where id = target_id;
end;
$$;

drop function if exists public.complete_refinance_lead(uuid, text, numeric);

grant execute on function public.complete_refinance_lead(text, text, text, numeric) to anon;
