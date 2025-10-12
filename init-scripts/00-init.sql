CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_cron";

-- Optional: give access to public
GRANT USAGE ON SCHEMA cron TO PUBLIC;