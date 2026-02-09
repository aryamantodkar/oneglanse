# CI/CD Setup Complete ✅

GitHub Actions CI/CD pipeline has been successfully configured for OneScope AI.

## What Was Implemented

### 1. GitHub Actions Workflow (`.github/workflows/docker-build.yml`)

- **Triggers**: Automatically runs on push to `onescope-monorepo` branch (also supports manual triggers)
- **Jobs**: Builds 3 Docker images in parallel:
  - `onescope-web` - Next.js web application
  - `onescope-agent` - Playwright automation agent
  - `onescope-postgres` - PostgreSQL with custom initialization

- **Features**:
  - Docker layer caching for faster builds
  - Multi-tag strategy (`:latest` and `:sha-XXXXXXX`)
  - Conditional postgres build (only when Dockerfile changes)
  - Pushes to GitHub Container Registry (ghcr.io)

### 2. Production Docker Compose (`docker-compose.yml`)

**Changed from:**
```yaml
build:
  context: .
  dockerfile: Dockerfile
```

**Changed to:**
```yaml
image: ghcr.io/aryamantodkar/onescope-web:latest
pull_policy: always
```

All services now pull pre-built images from GitHub Container Registry.

### 3. Local Development Override (`docker-compose.override.yml`)

Created to preserve local development workflow:
- Automatically merged when running `docker compose` locally
- Builds images from source (not pulling from registry)
- Developers can still use `docker compose up` as before

### 4. VPS Deployment Scripts

#### `scripts/setup-vps.sh` - Initial VPS Setup
- Interactive script for first-time deployment
- Authenticates with GitHub Container Registry
- Pulls images and starts services
- Runs initial database migrations

#### `scripts/deploy-vps.sh` - Regular Deployments
- Simple deployment script for updates
- Pulls latest images
- Restarts services
- Cleans up old images

### 5. Documentation

- **DEPLOYMENT.md** - Comprehensive deployment guide
  - Initial VPS setup instructions
  - Regular deployment workflow
  - Rollback procedures
  - Troubleshooting guide

- **QUICK_REFERENCE.md** - Quick command reference
  - Common commands
  - Troubleshooting tips
  - Health checks
  - Configuration overview

## How It Works

### Before (Manual Process)
```
VPS:
├── git pull
├── docker compose build  ← 10-15 minutes
└── docker compose up
```

### After (Automated Process)
```
GitHub Actions (on push):
├── Build web image (parallel)
├── Build agent image (parallel)
├── Build postgres image (parallel)
└── Push to ghcr.io

VPS:
├── docker compose pull    ← 2-3 minutes
└── docker compose up -d
```

**Time Saved**: ~10 minutes per deployment + VPS resource savings

## Next Steps

### 1. Initial Setup (Required Before First Use)

On your VPS, run the setup script:

```bash
# Clone repository (if not already done)
git clone https://github.com/aryamantodkar/onescopeAI.git
cd onescopeAI

# Create environment files
cp .env.example .env
nano .env  # Configure your values

cp apps/agent/.env.example apps/agent/.env
nano apps/agent/.env  # Configure your values

# Run initial setup
./scripts/setup-vps.sh
```

The setup script will:
1. Prompt for GitHub credentials
2. Authenticate with ghcr.io
3. Pull Docker images
4. Start all services
5. Run database migrations

### 2. Test the Workflow

```bash
# Make a small change locally
echo "# Test CI/CD" >> README.md

# Commit and push to onescope-monorepo branch
git add README.md
git commit -m "Test CI/CD pipeline"
git push origin onescope-monorepo

# Monitor GitHub Actions
# Visit: https://github.com/aryamantodkar/onescopeAI/actions

# Once build completes (green checkmark), deploy to VPS
ssh user@your-vps
cd /path/to/onescopeAI
./scripts/deploy-vps.sh
```

### 3. Make GitHub Packages Private (Recommended)

If your code is proprietary:

1. Go to: https://github.com/aryamantodkar?tab=packages
2. For each package (onescope-web, onescope-agent, onescope-postgres):
   - Click on the package
   - Go to "Package settings"
   - Change visibility to "Private"

## Files Created

```
.github/
  workflows/
    docker-build.yml          # GitHub Actions workflow

scripts/
  setup-vps.sh               # Initial VPS setup script
  deploy-vps.sh              # Regular deployment script

docker-compose.override.yml  # Local development overrides
DEPLOYMENT.md                # Comprehensive deployment guide
QUICK_REFERENCE.md           # Quick command reference
CI_CD_SETUP.md              # This file
```

## Files Modified

```
docker-compose.yml           # Changed to use ghcr.io images
```

## Environment Variables Needed

### GitHub Actions (Automatic)
- `GITHUB_TOKEN` - Automatically provided, no action needed

### VPS (One-time Setup)
- GitHub Personal Access Token with `read:packages` scope
- Created during `setup-vps.sh` execution

## Rollback Procedure

If a deployment causes issues:

### Option 1: Quick Rollback (Using Git)
```bash
# On VPS
cd /path/to/onescopeAI
git log --oneline  # Find last working commit
git checkout <commit-hash>
docker compose pull  # Pull images from that commit
docker compose up -d
```

### Option 2: Specific Image Tag
```bash
# Edit docker-compose.yml temporarily
# Change: image: ghcr.io/aryamantodkar/onescope-web:latest
# To: image: ghcr.io/aryamantodkar/onescope-web:sha-abc1234

docker compose pull
docker compose up -d

# When fixed, revert docker-compose.yml and redeploy
```

## Monitoring Build Status

- **GitHub Actions**: https://github.com/aryamantodkar/onescopeAI/actions
- **Container Registry**: https://github.com/aryamantodkar?tab=packages

## Expected Build Times

- Web image: ~3-5 minutes
- Agent image: ~5-8 minutes (Playwright installation is large)
- Postgres image: ~1-2 minutes
- **Total**: ~8-12 minutes (parallel builds)

## Image Sizes (Approximate)

- Web: ~500MB
- Agent: ~1.2GB (includes Playwright browsers)
- Postgres: ~300MB

## Security Best Practices

1. ✅ Never commit `.env` files
2. ✅ Use GitHub Secrets for sensitive data
3. ✅ Keep Personal Access Tokens secure
4. ✅ Set packages to private for proprietary code
5. ✅ Rotate tokens periodically

## Troubleshooting

### Build Fails in GitHub Actions

1. Check workflow logs in Actions tab
2. Verify Dockerfile syntax
3. Ensure dependencies are available
4. Check for build-time errors

### VPS Can't Pull Images

```bash
# Re-authenticate
docker login ghcr.io

# Check credentials
cat ~/.docker/config.json

# Manual pull test
docker pull ghcr.io/aryamantodkar/onescope-web:latest
```

### Services Won't Start After Deployment

```bash
# Check logs
docker compose logs -f

# Verify environment variables
docker compose config

# Check individual service
docker compose logs web
```

## Future Enhancements

- [ ] Add automated testing in CI
- [ ] Set up staging environment
- [ ] Add image vulnerability scanning
- [ ] Implement semantic versioning
- [ ] Add Slack/Discord notifications
- [ ] Set up automated rollback on failure
- [ ] Add performance monitoring

## Support

For issues or questions:
1. Check DEPLOYMENT.md for detailed guides
2. Check QUICK_REFERENCE.md for common commands
3. Review GitHub Actions logs
4. Check Docker logs on VPS

---

**Status**: ✅ Ready for use
**Last Updated**: 2026-02-09
**Maintained By**: OneScope AI Team
