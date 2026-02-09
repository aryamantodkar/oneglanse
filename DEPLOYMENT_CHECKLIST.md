# Deployment Checklist

Use this checklist to ensure smooth deployment of the CI/CD pipeline.

## Pre-Deployment Checklist

### Local Repository

- [ ] All changes committed and pushed to `onescope-monorepo` branch
- [ ] `.env.example` is up to date with all required variables
- [ ] `apps/agent/.env.example` is up to date
- [ ] Code tested locally with `docker compose up`

### GitHub Repository

- [ ] Repository exists: https://github.com/aryamantodkar/onescopeAI
- [ ] Branch `onescope-monorepo` exists
- [ ] GitHub Actions enabled for the repository
- [ ] GitHub Container Registry enabled

### GitHub Personal Access Token

- [ ] Token created with `read:packages` scope
- [ ] Token saved securely (needed for VPS authentication)
- [ ] Token has write access if you need to push images manually

## Initial VPS Setup Checklist

### VPS Prerequisites

- [ ] Docker installed and running
- [ ] Docker Compose plugin installed (v2+)
- [ ] User has Docker permissions (added to docker group)
- [ ] Git installed
- [ ] Sufficient disk space (at least 10GB free)
- [ ] Ports 3000 and 3333 available (or configured in nginx)

### Repository Setup on VPS

- [ ] Repository cloned: `git clone https://github.com/aryamantodkar/onescopeAI.git`
- [ ] On correct branch: `git checkout onescope-monorepo`
- [ ] `.env` file created from `.env.example`
- [ ] `apps/agent/.env` file created from example
- [ ] All environment variables configured correctly

### Authentication

- [ ] GitHub Container Registry login successful
  ```bash
  echo $PAT | docker login ghcr.io -u aryamantodkar --password-stdin
  ```
- [ ] Credentials saved in `~/.docker/config.json`
- [ ] Can pull images manually:
  ```bash
  docker pull ghcr.io/aryamantodkar/onescope-web:latest
  ```

### Initial Deployment

- [ ] Run setup script: `./scripts/setup-vps.sh`
- [ ] All images pulled successfully
- [ ] All services started: `docker compose ps`
- [ ] Database migrations ran successfully
- [ ] No errors in logs: `docker compose logs`

### Service Health Checks

- [ ] Web app accessible: `curl http://localhost:3000`
- [ ] Agent API accessible: `curl http://localhost:3333/health`
- [ ] PostgreSQL responding: `docker compose exec db pg_isready`
- [ ] ClickHouse responding: `docker compose exec clickhouse clickhouse-client --query "SELECT 1"`
- [ ] Redis responding: `docker compose exec redis redis-cli ping`

### Nginx/Reverse Proxy (if applicable)

- [ ] Nginx configured to proxy port 3000
- [ ] Nginx configured to proxy port 3333
- [ ] SSL certificates installed
- [ ] Domain pointing to VPS IP
- [ ] Firewall configured (ufw/iptables)

## First GitHub Actions Build Checklist

### Trigger Build

- [ ] Code pushed to `onescope-monorepo` branch
- [ ] GitHub Actions workflow visible in Actions tab
- [ ] Build started automatically

### Monitor Build

- [ ] Build running: https://github.com/aryamantodkar/onescopeAI/actions
- [ ] All three jobs (build-web, build-agent, build-postgres) started
- [ ] No errors in workflow logs
- [ ] All jobs completed successfully (green checkmarks)

### Verify Images

- [ ] Images visible in GitHub Packages: https://github.com/aryamantodkar?tab=packages
- [ ] Three packages created:
  - `onescope-web`
  - `onescope-agent`
  - `onescope-postgres`
- [ ] Images tagged with `:latest`
- [ ] Images tagged with `:sha-XXXXXXX`

## First Production Deployment Checklist

### Pre-Deployment

- [ ] GitHub Actions build completed successfully
- [ ] SSH access to VPS established
- [ ] Current services are running
- [ ] Database backup created (if production data exists)

### Deployment

- [ ] Navigate to project directory: `cd /path/to/onescopeAI`
- [ ] Pull latest code: `git pull origin onescope-monorepo`
- [ ] Run deployment script: `./scripts/deploy-vps.sh`
- [ ] Script completes without errors

### Post-Deployment Verification

- [ ] All services running: `docker compose ps`
- [ ] No restart loops: check `RESTART` count is 0
- [ ] No errors in logs: `docker compose logs --tail=50`
- [ ] Web app accessible
- [ ] Agent API accessible
- [ ] Database connection working
- [ ] Application functionality working as expected

## Ongoing Deployment Checklist

Use this for regular deployments:

### Before Each Deployment

- [ ] GitHub Actions build passed
- [ ] Changes reviewed and approved
- [ ] Breaking changes documented
- [ ] Database migrations prepared (if needed)
- [ ] Backup created (if needed)

### Deployment Steps

- [ ] SSH to VPS
- [ ] Navigate to project directory
- [ ] Pull latest code (optional, if compose file changed)
- [ ] Run `./scripts/deploy-vps.sh`
- [ ] Monitor deployment output

### After Deployment

- [ ] Services restarted successfully
- [ ] Logs show no errors
- [ ] Health checks pass
- [ ] Critical functionality tested
- [ ] Monitor for 5-10 minutes

## Rollback Checklist

If something goes wrong:

### Immediate Actions

- [ ] Identify the issue from logs
- [ ] Determine if rollback is needed
- [ ] Choose rollback method:
  - Quick: Use previous git commit
  - Specific: Use image tag `:sha-XXXXXXX`

### Rollback Steps

- [ ] Stop current services: `docker compose down`
- [ ] Checkout previous commit or edit image tags
- [ ] Pull images: `docker compose pull`
- [ ] Start services: `docker compose up -d`
- [ ] Verify services running
- [ ] Test functionality
- [ ] Monitor logs

### Post-Rollback

- [ ] Document what went wrong
- [ ] Create issue/ticket for fix
- [ ] Test fix locally before redeploying
- [ ] Update team on status

## Maintenance Checklist

### Weekly

- [ ] Check disk space: `df -h`
- [ ] Review logs for errors
- [ ] Check container resource usage: `docker stats`
- [ ] Verify backups are current

### Monthly

- [ ] Clean up old images: `docker image prune -a`
- [ ] Review and rotate access tokens
- [ ] Update base images (security patches)
- [ ] Review error logs and fix recurring issues

### As Needed

- [ ] Update environment variables
- [ ] Run database migrations
- [ ] Update nginx configuration
- [ ] Renew SSL certificates

## Troubleshooting Checklist

### Build Failures

- [ ] Check GitHub Actions logs
- [ ] Verify Dockerfile syntax
- [ ] Check for missing dependencies
- [ ] Verify GitHub token permissions

### Deployment Failures

- [ ] Check Docker login status
- [ ] Verify network connectivity
- [ ] Check disk space
- [ ] Review environment variables
- [ ] Check service dependencies

### Service Failures

- [ ] Check container logs: `docker compose logs [service]`
- [ ] Verify environment variables
- [ ] Check database connectivity
- [ ] Review resource limits
- [ ] Check for port conflicts

## Emergency Contacts

- **GitHub Issues**: https://github.com/aryamantodkar/onescopeAI/issues
- **Documentation**: See DEPLOYMENT.md and QUICK_REFERENCE.md

## Notes

- Always test in local environment first
- Keep backups before major changes
- Document any custom configurations
- Monitor resource usage during deployment
- Set up alerts for service failures (future enhancement)

---

**Version**: 1.0
**Last Updated**: 2026-02-09
