alter table public.media_jobs
  add column if not exists progress smallint not null default 0 check (progress between 0 and 100),
  add column if not exists provider_status text,
  add column if not exists poll_count integer not null default 0,
  add column if not exists last_polled_at timestamptz,
  add column if not exists next_poll_at timestamptz;

create index if not exists media_jobs_polling_idx
  on public.media_jobs(status, next_poll_at)
  where status = 'processing';
