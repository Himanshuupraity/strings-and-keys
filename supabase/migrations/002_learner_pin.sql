-- Melody Masters: optional 4-digit PIN per learner profile.
-- Run once in Supabase → SQL Editor → New query → Run. Safe to run more than once.
-- Only a salted scrypt hash of the PIN is stored; the app's server checks it.

alter table public.learners add column if not exists pin_hash text;
alter table public.learners add column if not exists pin_attempts int not null default 0;
alter table public.learners add column if not exists pin_locked_until timestamptz;
