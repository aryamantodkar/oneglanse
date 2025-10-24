CREATE DATABASE IF NOT EXISTS analytics;

CREATE TABLE IF NOT EXISTS analytics.user_prompts (
    id String,                
    user_id String,
    workspace_id String,
    prompt String,
    sentiment Float32 DEFAULT 0,  
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
    modelProvider String,
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
    created_at DateTime DEFAULT now(),
    PRIMARY KEY (id)
) ENGINE = MergeTree()
ORDER BY (id, prompt_id, created_at, user_id);