CREATE DATABASE IF NOT EXISTS analytics;

CREATE TABLE IF NOT EXISTS analytics.user_prompts (
    id String,
    user_id String,
    workspace_id String,
    prompt String,
    created_at DateTime DEFAULT now()
) ENGINE = ReplacingMergeTree()
PRIMARY KEY (workspace_id, prompt)
ORDER BY (workspace_id, prompt, created_at);

CREATE TABLE IF NOT EXISTS analytics.prompt_responses (
    id String,
    prompt_id String,
    prompt String,
    user_id String,
    workspace_id String,
    model String,
    model_provider LowCardinality(String),
    response String,
    sources Array(Tuple(
        title String,
        cited_text String,
        url String,
        domain Nullable(String),
        favicon Nullable(String)
    )),
    is_analysed Bool DEFAULT false,
    prompt_run_at DateTime,
    created_at DateTime DEFAULT now()
)
ENGINE = ReplacingMergeTree()
PARTITION BY toYYYYMM(prompt_run_at)
ORDER BY (workspace_id, prompt_run_at, model_provider, prompt_id);

CREATE TABLE IF NOT EXISTS analytics.prompt_analysis (
    id String,
    prompt_id String,
    workspace_id String,
    user_id String,
    model_provider LowCardinality(String),
    brand_analysis String DEFAULT '',
    prompt_run_at DateTime,
    created_at DateTime DEFAULT now()
)
ENGINE = MergeTree
PARTITION BY toYYYYMM(prompt_run_at)
ORDER BY (
    workspace_id,
    prompt_id,
    prompt_run_at,
    model_provider
);

-- Migration: Add prompt column if it doesn't exist (safe to run multiple times)
ALTER TABLE analytics.prompt_analysis ADD COLUMN IF NOT EXISTS prompt String DEFAULT '';