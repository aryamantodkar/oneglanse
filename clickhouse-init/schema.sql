CREATE DATABASE IF NOT EXISTS analytics;

CREATE TABLE IF NOT EXISTS analytics.user_prompts (
    id String,
    user_id String,
    workspace_id String,
    prompt String,
    created_at DateTime DEFAULT now()
) ENGINE = ReplacingMergeTree()
PRIMARY KEY (user_id, workspace_id, prompt)
ORDER BY (user_id, workspace_id, prompt, created_at);

CREATE TABLE IF NOT EXISTS analytics.prompt_responses (
    id String,
    prompt_id String,
    user_id String,
    workspace_id String,
    model String,
    model_provider String,
    response String,

    citations Array(Tuple(
        title String,
        url String,
        start_index Nullable(Int32),
        end_index Nullable(Int32),
        cited_text String
    )),

    sources Array(Tuple(
        title String,
        url String,
        page_age Nullable(String)
    )),

    prompt_run_at DateTime,
    created_at DateTime DEFAULT now() 
)
ENGINE = MergeTree()
PARTITION BY toYYYYMM(prompt_run_at)
ORDER BY (workspace_id, prompt_run_at, model_provider, prompt_id);

CREATE TABLE IF NOT EXISTS analytics.prompt_analysis (
    id String,
    prompt_id String,
    workspace_id String,
    user_id String,
    model_provider LowCardinality(String),
    brand_metrics JSON,
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