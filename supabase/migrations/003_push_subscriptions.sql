-- Melody Masters: daily practice reminders (Web Push).
-- Run once in Supabase → SQL Editor → New query → Run (after schema.sql).

create table if not exists public.push_subscriptions (
  endpoint      text primary key,
  learner_id    uuid references public.learners(id) on delete cascade,
  p256dh        text not null,
  auth          text not null,
  reminder_time text not null default '19:00' check (reminder_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  timezone      text not null default 'Asia/Kolkata',
  enabled       boolean not null default true,
  last_sent_on  date,
  created_at    timestamptz not null default now()
);

create index if not exists push_subscriptions_enabled_idx on public.push_subscriptions (enabled);

-- Server-only, like learners: RLS on with NO policies, so public keys can't read it.
alter table public.push_subscriptions enable row level security;
