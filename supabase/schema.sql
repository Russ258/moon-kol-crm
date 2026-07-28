-- Moon Card KOL Affiliate CRM
-- Run this once in the Supabase SQL editor (Project > SQL Editor > New query) on a fresh project.

-- ============================================================
-- ENUMS
-- ============================================================
create type user_role as enum ('admin', 'marketing', 'finance', 'viewer');
create type kol_market as enum ('Hong Kong', 'Taiwan', 'Vietnam', 'Thailand', 'India', 'Other');
create type kol_stage as enum ('prospect', 'contacted', 'negotiating', 'contract_sent', 'signed', 'active', 'paused', 'declined');
create type contract_status as enum ('draft', 'sent', 'signed', 'void');
create type payout_type as enum ('activation_bonus', 'residual', 'ga_pass_reimbursement', 'other');
create type payout_status as enum ('pending', 'paid', 'failed');

-- ============================================================
-- PROFILES  (one row per office team member, mirrors auth.users)
-- ============================================================
create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text,
  role user_role not null default 'viewer',
  created_at timestamptz not null default now()
);

-- Auto-create a profile whenever someone signs in for the first time.
-- New accounts default to 'viewer'; an admin promotes them from the Team page.
create function handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name')
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- Helper used inside RLS policies below.
create function current_role()
returns user_role
language sql
security definer set search_path = public
stable
as $$
  select role from public.profiles where id = auth.uid();
$$;

-- ============================================================
-- KOLS
-- ============================================================
create table kols (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  platform text,                 -- e.g. "YouTube, Instagram"
  handle_or_link text,
  market kol_market not null default 'Other',
  follower_count integer,
  contact_email text,
  contact_telegram text,
  stage kol_stage not null default 'prospect',
  referral_code text unique,     -- placeholder until Tevau's referral architecture is resolved
  wallet_address text,           -- crypto payout address, Tevau pays USDT/USDC only, no bank rails
  notes text,
  created_by uuid references profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index kols_market_idx on kols (market);
create index kols_stage_idx on kols (stage);

-- ============================================================
-- CONTRACTS  (linked proof of an individual KOL's signed agreement)
-- ============================================================
create table contracts (
  id uuid primary key default gen_random_uuid(),
  kol_id uuid not null references kols (id) on delete cascade,
  template_version text not null,        -- e.g. "2026-07 v1, $2 + 0.125%"
  terms_snapshot jsonb,                  -- the exact terms this KOL agreed to, frozen at signing
  file_path text,                        -- path in the 'contracts' storage bucket
  file_url text,                         -- external link, e.g. DocuSign completed envelope
  signature_provider text,               -- "DocuSign", "HelloSign", "manual upload", etc.
  status contract_status not null default 'draft',
  signed_at timestamptz,
  signed_by_name text,
  created_by uuid references profiles (id),
  created_at timestamptz not null default now()
);

create index contracts_kol_idx on contracts (kol_id);

-- ============================================================
-- PAYOUTS
-- ============================================================
create table payouts (
  id uuid primary key default gen_random_uuid(),
  kol_id uuid not null references kols (id) on delete cascade,
  contract_id uuid references contracts (id),
  type payout_type not null,
  amount numeric(12, 2) not null,
  currency text not null default 'USDT',
  wallet_address text,
  status payout_status not null default 'pending',
  paid_at timestamptz,
  reference text,
  created_by uuid references profiles (id),
  created_at timestamptz not null default now()
);

create index payouts_kol_idx on payouts (kol_id);

-- ============================================================
-- PERFORMANCE SNAPSHOTS
-- Manual entry for now. Structured so a future Tevau data feed can write
-- into the same table (source = 'tevau_pipeline') without a schema change.
-- ============================================================
create table performance_snapshots (
  id uuid primary key default gen_random_uuid(),
  kol_id uuid not null references kols (id) on delete cascade,
  period_start date not null,
  period_end date not null,
  referred_signups integer default 0,
  referred_activations integer default 0,
  referred_funded_amount numeric(12, 2) default 0,
  source text not null default 'manual',
  created_at timestamptz not null default now()
);

create index performance_kol_idx on performance_snapshots (kol_id);

-- ============================================================
-- ACTIVITY LOG  (lightweight audit trail)
-- ============================================================
create table activity_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references profiles (id),
  entity_type text not null,   -- 'kol' | 'contract' | 'payout'
  entity_id uuid not null,
  action text not null,        -- 'created' | 'updated' | 'stage_changed' | ...
  detail jsonb,
  created_at timestamptz not null default now()
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table profiles enable row level security;
alter table kols enable row level security;
alter table contracts enable row level security;
alter table payouts enable row level security;
alter table performance_snapshots enable row level security;
alter table activity_log enable row level security;

-- Profiles: everyone signed in can see the office directory; only admins edit roles.
create policy "profiles_select_all" on profiles for select using (auth.uid() is not null);
create policy "profiles_update_self_or_admin" on profiles for update
  using (auth.uid() = id or current_role() = 'admin');

-- KOLs: all signed-in staff can view; marketing + admin can create/edit.
create policy "kols_select_all" on kols for select using (auth.uid() is not null);
create policy "kols_write_marketing" on kols for insert with check (current_role() in ('admin', 'marketing'));
create policy "kols_update_marketing" on kols for update using (current_role() in ('admin', 'marketing'));
create policy "kols_delete_admin" on kols for delete using (current_role() = 'admin');

-- Contracts: hidden from 'viewer' role, since they can contain negotiated terms.
create policy "contracts_select_internal" on contracts for select
  using (current_role() in ('admin', 'marketing', 'finance'));
create policy "contracts_write_marketing" on contracts for insert with check (current_role() in ('admin', 'marketing'));
create policy "contracts_update_marketing" on contracts for update using (current_role() in ('admin', 'marketing'));

-- Payouts: finance + admin can manage; marketing can view (not edit); viewer has no access.
create policy "payouts_select_internal" on payouts for select
  using (current_role() in ('admin', 'finance', 'marketing'));
create policy "payouts_write_finance" on payouts for insert with check (current_role() in ('admin', 'finance'));
create policy "payouts_update_finance" on payouts for update using (current_role() in ('admin', 'finance'));

-- Performance snapshots: same visibility as KOLs, edit by marketing + admin.
create policy "performance_select_all" on performance_snapshots for select using (auth.uid() is not null);
create policy "performance_write_marketing" on performance_snapshots for insert with check (current_role() in ('admin', 'marketing'));

-- Activity log: admins only.
create policy "activity_select_admin" on activity_log for select using (current_role() = 'admin');
create policy "activity_insert_all" on activity_log for insert with check (auth.uid() is not null);

-- ============================================================
-- STORAGE (run in the Storage section, or via the dashboard UI)
-- Create a bucket named "contracts", private (not public), then this
-- policy lets any signed-in staff member with marketing/admin/finance
-- role read files, and marketing/admin upload them.
-- ============================================================
-- insert into storage.buckets (id, name, public) values ('contracts', 'contracts', false);
-- create policy "contracts_bucket_read" on storage.objects for select
--   using (bucket_id = 'contracts' and current_role() in ('admin','marketing','finance'));
-- create policy "contracts_bucket_write" on storage.objects for insert
--   with check (bucket_id = 'contracts' and current_role() in ('admin','marketing'));
