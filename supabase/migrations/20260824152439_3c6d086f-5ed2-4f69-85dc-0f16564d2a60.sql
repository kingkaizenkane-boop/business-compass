create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

create table if not exists public.cron_job_config (
  name text primary key,
  endpoint_url text not null,
  token_hash text not null,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant all on public.cron_job_config to service_role;
alter table public.cron_job_config enable row level security;

drop trigger if exists trg_cron_job_config_updated_at on public.cron_job_config;
create trigger trg_cron_job_config_updated_at
before update on public.cron_job_config
for each row execute function public.set_updated_at();

do $$
declare
  raw_token text := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  worker_url text := 'https://project--acb74496-ba47-4140-ad6b-7d91a62eb457.lovable.app/api/public/ai-jobs-worker';
begin
  insert into public.cron_job_config (name, endpoint_url, token_hash)
  values ('ai-jobs-worker', worker_url, encode(extensions.digest(raw_token, 'sha256'), 'hex'))
  on conflict (name) do update
    set endpoint_url = excluded.endpoint_url,
        token_hash = excluded.token_hash,
        enabled = true;

  perform cron.unschedule('ai-jobs-worker') where exists (
    select 1 from cron.job where jobname = 'ai-jobs-worker'
  );

  perform cron.schedule(
    'ai-jobs-worker',
    '* * * * *',
    format($cmd$
      select extensions.net_http_post(
        url := (select endpoint_url from public.cron_job_config where name = 'ai-jobs-worker' and enabled),
        headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer %s'),
        body := '{"source":"pg_cron"}'::jsonb,
        timeout_milliseconds := 25000
      );
    $cmd$, raw_token)
  );
end
$$;