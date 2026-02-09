# Quick Reference - OneScope AI Deployment

## 🚀 Common Commands

### VPS Deployment (After Code Push)

```bash
# Quick deployment (recommended)
./scripts/deploy-vps.sh

# Manual deployment
docker compose pull && docker compose down && docker compose up -d
```

### Local Development

```bash
# Start all services (builds from source)
docker compose up

# Start specific service
docker compose up web

# Rebuild after changes
docker compose up --build
```

### View Logs

```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f web
docker compose logs -f agent-worker
docker compose logs -f agent-api
```

### Database Operations

```bash
# Run migrations
docker compose run --rm migrate

# PostgreSQL shell
docker compose exec db psql -U $POSTGRES_USER $POSTGRES_DB

# ClickHouse shell
docker compose exec clickhouse clickhouse-client

# Backup PostgreSQL
docker compose exec db pg_dump -U $POSTGRES_USER $POSTGRES_DB > backup.sql

# Restore PostgreSQL
cat backup.sql | docker compose exec -T db psql -U $POSTGRES_USER $POSTGRES_DB
```

### Service Management

```bash
# Check status
docker compose ps

# Restart service
docker compose restart web

# Stop all
docker compose down

# Stop and remove volumes (⚠️ DESTRUCTIVE)
docker compose down -v
```

## 📦 Images

All images are hosted on GitHub Container Registry:

- Web: `ghcr.io/aryamantodkar/onescope-web:latest`
- Agent: `ghcr.io/aryamantodkar/onescope-agent:latest`
- PostgreSQL: `ghcr.io/aryamantodkar/onescope-postgres:latest`

## 🔄 Workflow

### Developer Flow

1. Make changes locally
2. Test with `docker compose up`
3. Commit and push to `onescope-monorepo` branch
4. GitHub Actions builds and pushes images (~5-10 min)
5. Deploy to VPS with `./scripts/deploy-vps.sh`

### VPS Flow

```bash
# 1. Pull latest images
docker compose pull

# 2. Stop old containers
docker compose down

# 3. Start new containers
docker compose up -d

# 4. Check logs
docker compose logs -f
```

## 🐛 Troubleshooting

### Image Pull Fails

```bash
# Re-authenticate
docker login ghcr.io

# Check credentials
cat ~/.docker/config.json

# Manual pull
docker pull ghcr.io/aryamantodkar/onescope-web:latest
```

### Service Won't Start

```bash
# Check logs
docker compose logs [service]

# Check config
docker compose config

# Verify env vars
cat .env
cat apps/agent/.env
```

### Out of Disk Space

```bash
# Clean up images
docker image prune -a

# Clean up volumes (⚠️ backs up data first!)
docker volume prune

# Check disk usage
df -h
docker system df
```

## 🔐 Authentication

### GitHub Container Registry (One-time Setup)

```bash
# Option 1: Personal Access Token
echo YOUR_PAT | docker login ghcr.io -u aryamantodkar --password-stdin

# Option 2: GitHub CLI
gh auth login
echo $(gh auth token) | docker login ghcr.io -u aryamantodkar --password-stdin
```

## 📊 Monitoring

### Health Checks

```bash
# Web app
curl http://localhost:3000

# Agent API
curl http://localhost:3333/health

# Redis
docker compose exec redis redis-cli ping

# PostgreSQL
docker compose exec db pg_isready

# Container stats
docker stats
```

### Resource Usage

```bash
# Disk usage
docker system df

# Image sizes
docker images | grep onescope

# Container resource limits
docker compose config | grep -A 5 resources
```

## 🔧 Configuration

### Environment Files

- `.env` - Main config (database, auth, API keys)
- `apps/agent/.env` - Agent-specific config (proxy, Redis, auth paths)

### Docker Compose Files

- `docker-compose.yml` - Production (pulls images from ghcr.io)
- `docker-compose.override.yml` - Local dev (builds from source)

### Port Mappings

- `3000` - Web app (bound to 127.0.0.1)
- `3333` - Agent API (bound to 127.0.0.1)
- `5432` - PostgreSQL
- `6379` - Redis
- `8123` - ClickHouse HTTP
- `9000` - ClickHouse Native

## 📚 Links

- GitHub Actions: https://github.com/aryamantodkar/onescopeAI/actions
- GitHub Packages: https://github.com/aryamantodkar?tab=packages
- Docker Compose Docs: https://docs.docker.com/compose/

## ⚡ Quick Fixes

### Container keeps restarting

```bash
# Check logs for error
docker compose logs [service]

# Stop and inspect
docker compose stop [service]
docker inspect [container_name]
```

### Can't connect to database

```bash
# Check if DB is running
docker compose ps db

# Check connection from container
docker compose exec web nc -zv db 5432

# Verify DATABASE_URL in .env
echo $DATABASE_URL
```

### Agent authentication issues

```bash
# Check auth files exist
ls -la /storage/*/state.json

# Re-run agent login locally
pnpm --filter @onescope/agent login

# Copy state files to VPS
scp -r ./agent-data/* user@vps:/path/to/onescope/agent-data/
```
