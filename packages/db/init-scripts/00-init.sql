CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_cron";
CREATE EXTENSION IF NOT EXISTS "http";

DO $$
DECLARE
	app_role text := current_user;
	http_fn record;
BEGIN
	-- Limit pg_cron schema usage to the application role only.
	REVOKE USAGE ON SCHEMA cron FROM PUBLIC;
	EXECUTE format('GRANT USAGE ON SCHEMA cron TO %I', app_role);

	-- Limit http extension function execution to the application role only.
	FOR http_fn IN
		SELECT
			n.nspname AS schema_name,
			p.proname AS function_name,
			pg_get_function_identity_arguments(p.oid) AS function_args
		FROM pg_proc p
		JOIN pg_namespace n ON n.oid = p.pronamespace
		JOIN pg_depend d ON d.objid = p.oid AND d.deptype = 'e'
		JOIN pg_extension e ON e.oid = d.refobjid
		WHERE e.extname = 'http'
	LOOP
		EXECUTE format(
			'REVOKE EXECUTE ON FUNCTION %I.%I(%s) FROM PUBLIC',
			http_fn.schema_name,
			http_fn.function_name,
			http_fn.function_args
		);
		EXECUTE format(
			'GRANT EXECUTE ON FUNCTION %I.%I(%s) TO %I',
			http_fn.schema_name,
			http_fn.function_name,
			http_fn.function_args,
			app_role
		);
	END LOOP;
END;
$$;
