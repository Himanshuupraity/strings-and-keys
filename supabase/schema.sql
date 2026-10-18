-- Melody Masters: learner profiles + progress.
-- Run this once in Supabase → SQL Editor → New query → Run.
-- (Already set up before PINs existed? Run supabase/migrations/002_learner_pin.sql instead.)

create table if not exists public.learners (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(name) between 1 and 40),
  -- Lower-cased, trimmed name so "Asha" and " asha " are the same learner.
  name_key    text not null unique,
  -- The learner's full progress backup (same format as Settings → Download backup).
  data        jsonb,
  -- Optional 4-digit PIN: salted scrypt hash only (checked by the app's server), plus lockout state.
  pin_hash         text,
  pin_attempts     int not null default 0,
  pin_locked_until timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists learners_updated_at_idx on public.learners (updated_at desc);

-- Lock the table: Row Level Security on, with NO policies, so the public anon/publishable key
-- cannot read or write it. Only the app's server (using the secret / service_role key) can.
alter table public.learners enable row level security;
