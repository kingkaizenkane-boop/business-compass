select cron.unschedule('ai-jobs-worker');

select cron.schedule(
  'ai-jobs-worker',
  '*/2 * * * *',
  $cron$
    select net.http_post(
      url := cfg.endpoint_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer 215ce26846b94993a31e45353a75b4432bf58d050b9f470a98200fef5ce21b3a'
      ),
      body := '{"source":"pg_cron"}'::jsonb,
      timeout_milliseconds := 25000
    )
    from public.cron_job_config cfg
    where cfg.name = 'ai-jobs-worker' and cfg.enabled;
  $cron$
);