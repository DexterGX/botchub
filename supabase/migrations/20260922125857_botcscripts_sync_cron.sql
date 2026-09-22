-- Enables the automated botcscripts.com sync's scheduling (Diego's ask,
-- 2026-09-22 — see claude/decisions.md). pg_cron fires a job roughly every
-- 10 minutes; pg_net is what lets a plain SQL cron job make the actual
-- outbound HTTP call to the Edge Function (supabase/functions/
-- botcscripts-sync) without needing an external scheduler.
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- The anon/publishable key is, by design, safe to embed here — it's the
-- same key already shipped in the app's client-side bundle. It's only
-- being used to satisfy the Edge Function's verify_jwt gate (any
-- project-issued JWT passes that check); the function does its actual
-- database writes with the service-role key it reads from its own Deno
-- environment, not from this caller's identity.
select cron.schedule(
  'botcscripts-sync',
  '*/10 * * * *',
  $$
  select net.http_post(
    url := 'https://obbompizywdihikbfswe.supabase.co/functions/v1/botcscripts-sync',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9iYm9tcGl6eXdkaWhpa2Jmc3dlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc4NTg0MjksImV4cCI6MjEwMzQzNDQyOX0.nAhdAYpjibsBaYR31ul2bUFCQbZxJBrGQD1CAwPea24'
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
  $$
);
