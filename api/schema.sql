-- ─────────────────────────────────────────────────────────────────────────────
-- LUNATIONS — Supabase Database Schema
-- Run this entire file in: Supabase Dashboard → SQL Editor → New Query
-- ─────────────────────────────────────────────────────────────────────────────

-- Enable UUID extension (usually already enabled)
create extension if not exists "uuid-ossp";

-- ─── PROFILES ────────────────────────────────────────────────────────────────
-- One row per user, linked to Supabase Auth
create table if not exists profiles (
  id            uuid references auth.users(id) on delete cascade primary key,
  name          text,
  dob           date,
  birth_time    time,
  rising        text,
  notes         text,
  settings      jsonb default '{}',
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- ─── ENTRIES ─────────────────────────────────────────────────────────────────
-- One row per journal day per user
create table if not exists entries (
  id            uuid default uuid_generate_v4() primary key,
  user_id       uuid references auth.users(id) on delete cascade not null,
  entry_date    date not null,
  energy        smallint check (energy between 1 and 10),
  mood          smallint check (mood between 1 and 10),
  clarity       smallint check (clarity between 1 and 10),
  creativity    smallint check (creativity between 1 and 10),
  qualities     text[],
  text          text,
  dream         text,
  intention     text,
  -- Astro snapshot saved with entry
  phase         text,
  phase_age     smallint,
  phase_pct     smallint,
  moon_sign     text,
  sun_sign      text,
  tithi         text,
  tithi_quality text,
  nakshatra     text,
  nakshatra_pada smallint,
  vara          text,
  planets       text[],
  active_transits text[],
  -- Metadata
  created_at    timestamptz default now(),
  updated_at    timestamptz default now(),
  unique(user_id, entry_date)
);

-- ─── INTENTIONS ──────────────────────────────────────────────────────────────
-- Cycle intentions (one per lunar cycle per user)
create table if not exists intentions (
  id            uuid default uuid_generate_v4() primary key,
  user_id       uuid references auth.users(id) on delete cascade not null,
  cycle_key     date not null,  -- date of the new moon starting the cycle
  text          text not null,
  created_at    timestamptz default now(),
  unique(user_id, cycle_key)
);

-- ─── ROW LEVEL SECURITY ───────────────────────────────────────────────────────
-- Users can only read/write their own data

alter table profiles enable row level security;
alter table entries enable row level security;
alter table intentions enable row level security;

-- Profiles policies
create policy "Users can view own profile"
  on profiles for select using (auth.uid() = id);
create policy "Users can insert own profile"
  on profiles for insert with check (auth.uid() = id);
create policy "Users can update own profile"
  on profiles for update using (auth.uid() = id);

-- Entries policies
create policy "Users can view own entries"
  on entries for select using (auth.uid() = user_id);
create policy "Users can insert own entries"
  on entries for insert with check (auth.uid() = user_id);
create policy "Users can update own entries"
  on entries for update using (auth.uid() = user_id);
create policy "Users can delete own entries"
  on entries for delete using (auth.uid() = user_id);

-- Intentions policies
create policy "Users can view own intentions"
  on intentions for select using (auth.uid() = user_id);
create policy "Users can insert own intentions"
  on intentions for insert with check (auth.uid() = user_id);
create policy "Users can update own intentions"
  on intentions for update using (auth.uid() = user_id);

-- ─── UPDATED_AT TRIGGER ───────────────────────────────────────────────────────
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger entries_updated_at
  before update on entries
  for each row execute function update_updated_at();

create trigger profiles_updated_at
  before update on profiles
  for each row execute function update_updated_at();

-- ─── INDEXES ─────────────────────────────────────────────────────────────────
create index if not exists entries_user_date on entries(user_id, entry_date desc);
create index if not exists entries_phase on entries(user_id, phase);
create index if not exists intentions_user_cycle on intentions(user_id, cycle_key);
