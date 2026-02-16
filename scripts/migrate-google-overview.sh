#!/bin/bash

# Migration script to rename google-overview to google-ai-overview in database
# Run this on your VPS where Docker is running

set -e

echo "🔄 Running migration: google-overview → google-ai-overview"
echo "================================================"

# SQL migration
SQL_MIGRATION="
UPDATE workspaces
SET enabled_providers = REPLACE(enabled_providers, '\"google-overview\"', '\"google-ai-overview\"')
WHERE enabled_providers LIKE '%\"google-overview\"%';
"

# Run migration using docker compose
echo "📊 Executing SQL migration..."
docker compose exec -T db psql -U postgres -d onescope -c "$SQL_MIGRATION"

# Verify the update
echo ""
echo "✅ Verifying migration..."
VERIFICATION="
SELECT id, name, enabled_providers
FROM workspaces
WHERE enabled_providers LIKE '%google%'
LIMIT 5;
"

docker compose exec -T db psql -U postgres -d onescope -c "$VERIFICATION"

echo ""
echo "✅ Migration complete!"
echo "================================================"
echo ""
echo "🔍 Check the output above to verify 'google-ai-overview' is present"
echo "    and 'google-overview' is no longer in enabled_providers"
