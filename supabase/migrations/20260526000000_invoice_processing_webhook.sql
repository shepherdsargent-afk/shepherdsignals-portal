-- ─────────────────────────────────────────────────────────────────────────────
-- Invoice Processing Webhook
-- Fires on every INSERT to invoices table and calls the Next.js API route.
--
-- SETUP STEPS (run once):
--   1. Enable pg_net:  CREATE EXTENSION IF NOT EXISTS pg_net;
--   2. Set your webhook secret (replace the value):
--      ALTER DATABASE postgres SET "app.webhook_secret" TO 'your_secret_here';
--   3. Run this migration.
--
-- The WEBHOOK_SECRET value must match what you set in Vercel env vars.
-- ─────────────────────────────────────────────────────────────────────────────

-- Enable pg_net for outbound HTTP from Postgres triggers
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Function: called after each invoice INSERT
CREATE OR REPLACE FUNCTION trigger_invoice_processing()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  _secret text;
  _url text := 'https://portal.shepherdsignals.com/api/process-invoice';
BEGIN
  -- Read webhook secret from database settings
  _secret := current_setting('app.webhook_secret', true);

  -- Non-blocking HTTP POST via pg_net
  PERFORM net.http_post(
    url     := _url,
    headers := jsonb_build_object(
      'Content-Type',      'application/json',
      'x-webhook-secret',  COALESCE(_secret, '')
    ),
    body    := jsonb_build_object(
      'type',    TG_OP,
      'table',   TG_TABLE_NAME,
      'record',  row_to_json(NEW)
    )
  );

  RETURN NEW;
END;
$$;

-- Drop old trigger if it exists, then create fresh
DROP TRIGGER IF EXISTS invoice_processing_trigger ON invoices;

CREATE TRIGGER invoice_processing_trigger
  AFTER INSERT ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION trigger_invoice_processing();
