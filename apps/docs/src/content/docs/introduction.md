# Introduction

OneGlanse tracks how your brand appears in LLM responses across providers.

## What this deployment includes

- `apps/web`: authenticated dashboard
- `apps/agent`: prompt execution workers
- Redis queues for provider jobs
- ClickHouse analytics tables for responses and analysis

## What this docs app covers

- Local and production setup
- Required runtime environment variables
- Docker/VPS deployment flow
- Proxy and worker behavior
