# Deployment Guide

This guide covers the automated CI/CD deployment process for OneScope AI.

## Overview

The deployment system uses GitHub Actions to automatically build Docker images on every push to `master` branch, then pushes them to GitHub Container Registry (ghcr.io). The VPS simply pulls pre-built images for fast deployment.

### Architecture

```
GitHub Actions (on push to master):
├── Build web image → ghcr.io/aryamantodkar/onescope-web:latest
├── Build agent image → ghcr.io/aryamantodkar/onescope-agent:latest
└── Build postgres image → ghcr.io/aryamantodkar/onescope-postgres:latest

VPS Deployment:
├── docker compose pull (pull pre-built images)
└── docker compose up -d (start services)
```

## Initial VPS Setup

### 1. Authenticate with GitHub Container Registry

On your VPS, you need to authenticate with GitHub Container Registry once:

```bash
# Generate a Personal Access Token (PAT) on GitHub:
# Settings → Developer settings → Personal access tokens → Tokens (classic)
# Create token with 'read:packages' scope

# Login to ghcr.io (replace with your username and token)
echo YOUR_PAT_TOKEN | docker login ghcr.io -u aryamantodkar --password-stdin
```

**Alternative**: Use GitHub CLI:
```bash
gh auth login
echo $(gh auth token) | docker login ghcr.io -u aryamantodkar --password-stdin
```

### 2. Clone Repository

```bash
cd /path/to/deployment
git clone https://github.com/aryamantodkar/onescopeAI.git
cd onescopeAI
```

### 3. Set Up Environment Variables

```bash
# Copy and configure environment variables
cp .env.example .env
nano .env  # Edit with your values

# Agent-specific env vars
cp apps/agent/.env.example apps/agent/.env
nano apps/agent/.env  # Edit with your values
```

### 4. Initial Deployment

```bash
# Pull latest images
docker compose pull

# Start services
docker compose up -d

# Run database migrations
docker compose run --rm migrate

# Check logs
docker compose logs -f
```

## Regular Deployment Workflow

### Developer Workflow

1. Make code changes locally
2. Commit and push to `master`:
   ```bash
   git add .
   git commit -m "Your changes"
   git push origin master
   ```
3. GitHub Actions automatically builds and pushes images (takes ~5-10 minutes)
4. Check build status at: https://github.com/aryamantodkar/onescopeAI/actions

### VPS Deployment

Once GitHub Actions completes successfully:

```bash
# SSH to VPS
ssh user@your-vps

# Navigate to project directory
cd /path/to/onescopeAI

# Deploy using the deployment script
./scripts/deploy-vps.sh
```

**Or manually:**
```bash
docker compose pull
docker compose down
docker compose up -d
```

## Image Tags

GitHub Actions creates two tags for each build:

- `latest` - Always points to the most recent master build
- `sha-XXXXXXX` - Specific commit for rollback capability

## Rollback Procedure

If you need to rollback to a previous version:

### Option 1: Use Specific Commit SHA

```bash
# Find the commit SHA from GitHub
# Edit docker-compose.yml temporarily to use specific tag:
# image: ghcr.io/aryamantodkar/onescope-web:sha-abc1234

# Pull and restart
docker compose pull
docker compose up -d
```

### Option 2: Use Git History

```bash
# Check git history to find working commit
git log --oneline

# Checkout that commit
git checkout abc1234

# Use docker-compose.override.yml to build locally
docker compose build
docker compose up -d

# When fixed, return to master
git checkout master
```

## Local Development

Local development still works as before - the `docker-compose.override.yml` file ensures local builds from source:

```bash
# Local development (builds from source)
docker compose up

# This automatically uses docker-compose.override.yml
# which builds images locally instead of pulling from registry
```

## Monitoring

### Check GitHub Actions Status

Visit: https://github.com/aryamantodkar/onescopeAI/actions

### View VPS Container Status

```bash
# List running containers
docker compose ps

# View logs
docker compose logs -f web
docker compose logs -f agent-worker
docker compose logs -f agent-api

# Check resource usage
docker stats
```

### Health Checks

```bash
# Check web app
curl http://localhost:3000

# Check agent API
curl http://localhost:3333/health

# Check Redis
docker compose exec redis redis-cli ping

# Check PostgreSQL
docker compose exec db psql -U $POSTGRES_USER -c "SELECT 1"
```

## Database Operations

### Run Migrations

```bash
docker compose run --rm migrate
```

### Backup Database

```bash
# PostgreSQL backup
docker compose exec db pg_dump -U $POSTGRES_USER $POSTGRES_DB > backup.sql

# ClickHouse backup (if needed)
docker compose exec clickhouse clickhouse-client --query "BACKUP DATABASE analytics TO Disk('backups', 'backup.zip')"
```

### Restore Database

```bash
# PostgreSQL restore
cat backup.sql | docker compose exec -T db psql -U $POSTGRES_USER $POSTGRES_DB
```

## Troubleshooting

### Images Not Pulling

```bash
# Check authentication
docker login ghcr.io

# Manually pull specific image
docker pull ghcr.io/aryamantodkar/onescope-web:latest

# Check image exists
docker images | grep onescope
```

### GitHub Actions Build Failing

1. Check GitHub Actions logs
2. Verify Dockerfile syntax
3. Check for missing dependencies
4. Ensure GITHUB_TOKEN has packages write permission

### Services Not Starting

```bash
# Check logs for errors
docker compose logs

# Check specific service
docker compose logs web

# Verify environment variables
docker compose config

# Check disk space
df -h
```

### Permission Denied on VPS

```bash
# Ensure Docker is running
sudo systemctl status docker

# Add user to docker group
sudo usermod -aG docker $USER
newgrp docker
```

## Image Size Optimization

Current approximate image sizes:
- Web: ~500MB
- Agent: ~1.2GB (large due to Playwright)
- PostgreSQL: ~300MB

To reduce sizes:
1. Use multi-stage builds (already implemented)
2. Add `.dockerignore` to exclude unnecessary files
3. Use Alpine base images where possible

## Security Notes

- Never commit `.env` files or secrets
- Keep GitHub Container Registry packages private for proprietary code
- Rotate Personal Access Tokens periodically
- Use GitHub Secrets for sensitive build-time variables
- Regularly update base images for security patches

## Environment Variables

Required environment variables (see `.env.example`):

### Database
- `POSTGRES_USER`
- `POSTGRES_PASSWORD`
- `POSTGRES_DB`
- `DATABASE_URL`
- `CLICKHOUSE_HOST`
- `CLICKHOUSE_PASSWORD`

### Authentication
- `BETTER_AUTH_SECRET`
- `BETTER_AUTH_URL`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`

### Agent
- `REDIS_HOST`
- `REDIS_PORT`
- `API_TOKEN`
- `PROXY_SERVER` (optional)
- `DEBUG` (optional, set to `true` for debug logs)

### API Keys (if using)
- `OPENAI_API_KEY`
- `ANTHROPIC_API_KEY`

## Future Enhancements

- Automated testing in CI pipeline
- Staging environment for testing
- Multi-architecture builds (ARM + AMD64)
- Image vulnerability scanning
- Semantic versioning tags
- Automated rollback on failure
- Health check monitoring
- Prometheus metrics
