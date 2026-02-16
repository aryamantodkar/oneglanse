-- Migration to rename google-overview to google-ai-overview in existing data
-- This updates any workspace that has "google-overview" in their enabled_providers

UPDATE workspaces
SET enabled_providers = REPLACE(enabled_providers, '"google-overview"', '"google-ai-overview"')
WHERE enabled_providers LIKE '%"google-overview"%';
