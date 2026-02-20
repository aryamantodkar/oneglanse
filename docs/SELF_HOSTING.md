# OneScope AI — Complete Self-Hosting Guide

This guide walks you through hosting OneScope AI on your own server, from a completely fresh Ubuntu 22.04 VPS to a fully running production stack. Every command is explained so you understand what each step does and why it's necessary.

---

## Table of Contents

1. [What You're Deploying](#1-what-youre-deploying)
2. [Server Requirements](#2-server-requirements)
3. [Domain & DNS Setup](#3-domain--dns-setup)
4. [Server Preparation](#4-server-preparation)
5. [Install Docker & Dependencies](#5-install-docker--dependencies)
6. [Install nginx & SSL Certificates](#6-install-nginx--ssl-certificates)
7. [Clone & Configure the Repository](#7-clone--configure-the-repository)
8. [Configure All Environment Variables](#8-configure-all-environment-variables)
9. [Configure Google OAuth](#9-configure-google-oauth)
10. [Configure Proxy Pool for Browser Agents](#10-configure-proxy-pool-for-browser-agents)
11. [Authenticate Browser Sessions](#11-authenticate-browser-sessions)
12. [Pull & Deploy Docker Images](#12-pull--deploy-docker-images)
13. [Verify Everything Is Working](#13-verify-everything-is-working)
14. [Set Up Automated Backups](#14-set-up-automated-backups)
15. [Set Up Monitoring](#15-set-up-monitoring)
16. [Updating to New Versions](#16-updating-to-new-versions)
17. [Firewall & Security Hardening](#17-firewall--security-hardening)
18. [Troubleshooting Common Issues](#18-troubleshooting-common-issues)
19. [Architecture Reference](#19-architecture-reference)

---

## 1. What You're Deploying

OneScope AI runs as 7 Docker containers managed by Docker Compose. Here's what each service does and how they communicate:

```
                          Internet
                              │
                    ┌─────────▼─────────┐
                    │   nginx (host)     │  ← Reverse proxy + SSL termination
                    │   Port 80 → 443   │    Runs on the host OS (not Docker)
                    └────────┬──────────┘
                             │ proxy_pass
              ┌──────────────▼──────────────────┐
              │        Docker Network            │
              │                                 │
   ┌──────────▼──────────┐    ┌────────────────▼──┐
   │   web (Next.js)      │    │  agent-api (HTTP)  │
   │   Port 3000          │    │  Port 3333          │
   │   - Dashboard UI     │    │  - Upload auth      │
   │   - tRPC API         │    │    sessions         │
   │   - Auth (better-auth│    │  - Health check     │
   └─┬──────────────┬─────┘    └────────────────────┘
     │              │
     │    ┌─────────▼───────┐    ┌──────────────────┐
     │    │ agent-worker     │    │  migrate (one-shot│
     │    │ (no port)        │    │  runs migrations, │
     │    │ - BullMQ worker  │    │  then exits)      │
     │    │ - Playwright     │    └──────────────────┘
     │    │ - 5 LLM agents   │
     │    └────────┬─────────┘
     │             │
     │    ┌────────▼───────────────────────────────┐
     │    │              Redis                       │
     │    │  - BullMQ job queue ("onescope-agent")   │
     │    │  - Job progress tracking (key-value)     │
     │    │  - Session cache                         │
     │    └────────────────────────────────────────┘
     │
     ├── db (PostgreSQL 16 with pg_cron + http extensions)
     │   - Users, sessions, organizations
     │   - Workspaces, workspace members
     │   - Scheduled prompt cron jobs (via pg_cron)
     │
     └── clickhouse (Analytics database)
         - user_prompts (what was asked)
         - prompt_responses (LLM responses + sources)
         - prompt_analysis (brand analysis results from OpenAI)
```

**Data flow for a single prompt job:**
1. User submits prompts via the web dashboard
2. Web server stores prompts in ClickHouse, queues jobs in Redis (BullMQ)
3. `agent-worker` picks up a job, launches Chromium, navigates to ChatGPT/Claude/Perplexity/Gemini
4. Agent submits the prompt, extracts the response and sources
5. Results stored back to ClickHouse
6. Analysis service calls OpenAI GPT-4 to analyze the response
7. Analysis results stored to ClickHouse, dashboard updates

---

## 2. Server Requirements

### Minimum Specification (1 concurrent browser session)

| Resource | Minimum | Why |
|----------|---------|-----|
| CPU | 4 vCPU | Chromium rendering + Next.js + PostgreSQL + ClickHouse all compete |
| RAM | 8 GB | Chromium alone uses 500MB–2GB per session. Add 1–2GB for everything else |
| Storage | 50 GB SSD | Docker images ~5GB, ClickHouse data grows over time |
| Bandwidth | 100 Mbps | Browser automation downloads full web pages |
| OS | Ubuntu 22.04 LTS or Debian 12 | These are the tested and supported distros |

### Recommended Specification (2-3 concurrent sessions)

| Resource | Recommended |
|----------|-------------|
| CPU | 8 vCPU |
| RAM | 16 GB |
| Storage | 100 GB NVMe SSD |
| Bandwidth | 1 Gbps |

### Cloud Provider Recommendations

- **Hetzner Cloud** (EU): Best price-performance. CX31 (~€14/month) for minimum, CX41 (~€22/month) for recommended.
- **DigitalOcean** (Global): Droplet 4GB (minimum, tight), 8GB or 16GB recommended.
- **Vultr** (Global): Similar to DigitalOcean in pricing.
- **AWS EC2**: t3.large (minimum), t3.xlarge (recommended). More expensive than above.
- **Avoid shared-CPU VPS** (most budget hosts under $5/month): Chromium rendering requires consistent CPU access.

### Network Requirements

- A static public IP address
- Ports 22 (SSH), 80 (HTTP), and 443 (HTTPS) open in both your cloud provider's firewall AND the server's `ufw` firewall
- A domain name you control (for DNS configuration)

---

## 3. Domain & DNS Setup

### Step 1: Choose Your Domain

You need a domain name pointing to your server. If you don't have one, register at Namecheap, Cloudflare, or any registrar.

### Step 2: Get Your Server's IP

```bash
# On your server (after Step 4), find the public IP:
curl -4 ifconfig.me
# Output: 123.45.67.89  ← This is your public IP
```

### Step 3: Create DNS Records

Log into your domain registrar's DNS management panel and create:

| Type | Name | Value | TTL |
|------|------|-------|-----|
| A | `@` (or `yourdomain.com`) | `123.45.67.89` | 300 |
| A | `www` | `123.45.67.89` | 300 |

**Optional** — if you want the agent API on a subdomain:
| A | `api` | `123.45.67.89` | 300 |

### Step 4: Verify DNS Propagation

DNS changes can take 5 minutes to 48 hours to propagate globally. Check:

```bash
# Check if DNS has propagated (from your local machine):
dig +short yourdomain.com
# Should output: 123.45.67.89

# Cross-check using Google's DNS servers (most reliable):
nslookup yourdomain.com 8.8.8.8
# Should show: Address: 123.45.67.89

# Check from a third-party site:
# Visit: https://dnschecker.org/#A/yourdomain.com
```

**Do not proceed to Step 6 (SSL setup) until DNS is propagated.** Let's Encrypt validates domain ownership by making an HTTP request to your domain — if DNS isn't set up, SSL setup will fail.

---

## 4. Server Preparation

Connect to your server via SSH:
```bash
ssh root@123.45.67.89
```

### Update the System

Always start with a full system update. This ensures you have security patches before installing anything:

```bash
# Update the package list (fetches info about available packages):
apt update

# Upgrade all installed packages to their latest versions:
apt upgrade -y

# Remove packages that are no longer needed:
apt autoremove -y
```

### Install Essential Tools

```bash
apt install -y \
  curl \           # HTTP client (used in health checks, downloading scripts)
  wget \           # Another HTTP client (needed for ClickHouse health check)
  git \            # Version control (cloning the repo)
  unzip \          # Extracting archives
  ufw \            # Uncomplicated Firewall (UFW — simplifies iptables)
  fail2ban \       # Bans IPs that repeatedly fail SSH logins
  htop \           # Interactive process monitor (better than top)
  nano             # Text editor (vim works too — use whichever you prefer)
```

### Create a Non-Root User

**Never run your application as root.** If a container escapes, root access means full server compromise. Create a dedicated user:

```bash
# Create user named 'onescope':
useradd -m -s /bin/bash onescope

# Set a strong password:
passwd onescope

# Give the user sudo access (for admin tasks):
usermod -aG sudo onescope

# Add to docker group so they can run docker without sudo:
# (Do this AFTER installing Docker in Step 5)
# usermod -aG docker onescope

# Switch to the new user for the rest of setup:
su - onescope
```

---

## 5. Install Docker & Dependencies

### Install Docker Engine

Docker provides an official install script that handles all the distribution-specific setup:

```bash
# Download and run the official Docker install script:
curl -fsSL https://get.docker.com | sh

# The script:
# 1. Detects your Linux distribution
# 2. Adds Docker's APT repository
# 3. Installs docker-ce, docker-ce-cli, containerd.io, docker-compose-plugin
# 4. Starts the Docker daemon

# Enable Docker to start on boot:
systemctl enable docker

# Start Docker now (if not already running):
systemctl start docker

# Verify installation:
docker --version
# Output: Docker version 27.x.x, build xxxxxxx

docker compose version
# Output: Docker Compose version v2.x.x
```

### Add Your User to the Docker Group

```bash
# Allow the 'onescope' user to run docker without sudo:
usermod -aG docker onescope

# IMPORTANT: You must log out and back in for this to take effect:
su - onescope

# Verify (should NOT require sudo):
docker ps
# Output: CONTAINER ID   IMAGE   COMMAND   CREATED   STATUS   PORTS   NAMES
```

---

## 6. Install nginx & SSL Certificates

### Why nginx as a Reverse Proxy?

Your Docker containers (`web` on port 3000, `agent-api` on port 3333) listen on localhost. nginx sits in front of them, handles SSL/TLS termination (encrypting/decrypting HTTPS), and routes requests to the right container. This is the standard pattern for serving web applications — it keeps your app containers simple (just HTTP, no SSL) while nginx handles the security layer.

### Install nginx

```bash
# Install nginx web server:
apt install -y nginx

# Enable and start nginx:
systemctl enable nginx
systemctl start nginx

# Verify nginx is running:
systemctl status nginx
# Should show: active (running)

# Test the default page (from another terminal or browser):
curl http://yourdomain.com
# Should return nginx's default HTML page
```

### Install Certbot (Let's Encrypt SSL)

Certbot automates obtaining and renewing free SSL certificates from Let's Encrypt:

```bash
# Install certbot and its nginx plugin:
apt install -y certbot python3-certbot-nginx
```

### Obtain SSL Certificate

```bash
# Get certificate for your domain:
# --nginx: automatically configure nginx
# --non-interactive: don't prompt for input
# --agree-tos: agree to Let's Encrypt terms of service
# --email: your email (for expiry notices + account recovery)
# -d: domain(s) to get a certificate for

certbot --nginx \
  -d yourdomain.com \
  -d www.yourdomain.com \
  --non-interactive \
  --agree-tos \
  --email your@email.com

# Verify certificate was issued:
certbot certificates
# Should show your domain with expiry date (~90 days from now)

# Certbot automatically sets up a cron job to renew the certificate
# before it expires. You can verify the renewal works:
certbot renew --dry-run
# Should output: Congratulations, all simulated renewals succeeded
```

### Configure nginx

Create the nginx configuration for OneScope AI:

```bash
# Create the configuration file:
nano /etc/nginx/sites-available/onescope
```

Paste the following configuration (replace `yourdomain.com` throughout):

```nginx
# /etc/nginx/sites-available/onescope

# Redirect all HTTP traffic to HTTPS:
server {
    listen 80;
    listen [::]:80;
    server_name yourdomain.com www.yourdomain.com;

    # Let's Encrypt ACME challenge (for certificate renewal):
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    # Redirect everything else to HTTPS:
    location / {
        return 301 https://$host$request_uri;
    }
}

# Main HTTPS server block:
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name yourdomain.com www.yourdomain.com;

    # SSL certificates (Certbot fills these in automatically):
    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    # SSL security settings (Mozilla's recommended intermediate config):
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_tickets off;

    # OCSP Stapling (improves handshake performance):
    ssl_stapling on;
    ssl_stapling_verify on;
    resolver 8.8.8.8 8.8.4.4 valid=300s;
    resolver_timeout 5s;

    # Security Headers:
    # HSTS: tells browsers to always use HTTPS for 1 year (+ subdomains):
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
    # Prevent your site from being embedded in iframes (clickjacking protection):
    add_header X-Frame-Options "SAMEORIGIN" always;
    # Prevent MIME-type sniffing (XSS protection):
    add_header X-Content-Type-Options "nosniff" always;
    # Referrer Policy: don't leak your full URL to external sites:
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    # Content Security Policy (adjust as needed for your specific usage):
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https:;" always;

    # Gzip compression for text responses (reduces bandwidth):
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml;

    # Proxy to Next.js web app:
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;

        # Required for WebSocket support (Next.js dev uses HMR over WS):
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';

        # Pass the original host and client IP to the app:
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Don't cache proxy responses (Next.js handles its own caching):
        proxy_cache_bypass $http_upgrade;

        # Timeouts (important for long-running requests like LLM analysis):
        proxy_read_timeout 300s;   # 5 minutes for analysis requests
        proxy_connect_timeout 10s;
        proxy_send_timeout 60s;
    }

    # Optional: expose agent API at /api/agent/ (if you want a single domain):
    # location /api/agent/ {
    #     proxy_pass http://127.0.0.1:3333/;
    #     proxy_http_version 1.1;
    #     proxy_set_header Host $host;
    #     proxy_set_header X-Real-IP $remote_addr;
    # }
}
```

Activate the configuration:

```bash
# Create a symlink from sites-available to sites-enabled:
# (This is the nginx convention for enabling configurations)
ln -s /etc/nginx/sites-available/onescope /etc/nginx/sites-enabled/

# Remove the default nginx page (it conflicts on port 80):
rm /etc/nginx/sites-enabled/default

# Test the configuration syntax:
nginx -t
# Should output: syntax is ok / test is successful

# Reload nginx to apply the new configuration:
systemctl reload nginx
```

---

## 7. Clone & Configure the Repository

```bash
# Switch to your application user:
su - onescope

# Create the application directory:
mkdir -p /opt/onescope
cd /opt/onescope

# Clone the repository:
git clone https://github.com/YOUR_USERNAME/onescopeAI.git .
# Note the trailing dot — clones into the current directory

# You should now see:
ls -la
# apps/  packages/  docker-compose.yml  Dockerfile  .env.example  etc.
```

---

## 8. Configure All Environment Variables

The application requires two `.env` files. Every variable is explained in detail below.

### Main `.env` File (Web App + Database)

```bash
cp .env.example .env
nano .env
```

Fill in the file as follows (replace all `CHANGE_ME` values):

```bash
# ════════════════════════════════════════════════════════
# POSTGRESQL (Relational Database)
# ════════════════════════════════════════════════════════

# Connection string format: postgresql://USER:PASS@HOST:PORT/DB
# HOST is 'db' because Docker Compose creates a DNS name for each service.
# Inside Docker, containers reach each other by service name.
DATABASE_URL=postgresql://onescope:CHANGE_ME_DB_PASSWORD@db:5432/onescope

# PostgreSQL credentials used by the Dockerfile.postgres to initialize the database:
POSTGRES_USER=onescope
POSTGRES_PASSWORD=CHANGE_ME_DB_PASSWORD  # Must match the password in DATABASE_URL
POSTGRES_DB=onescope

# ════════════════════════════════════════════════════════
# CLICKHOUSE (Analytics Database)
# ════════════════════════════════════════════════════════

# HTTP interface for queries (used by @clickhouse/client):
CLICKHOUSE_URL=http://clickhouse:8123
CLICKHOUSE_DB=analytics
CLICKHOUSE_USER=default
CLICKHOUSE_PASSWORD=CHANGE_ME_CH_PASSWORD

# ════════════════════════════════════════════════════════
# REDIS (Job Queue + Session Cache)
# ════════════════════════════════════════════════════════

# Individual settings (used by some services):
REDIS_HOST=redis
REDIS_PORT=6379

# Full URL (used by others — keep consistent with HOST/PORT above):
REDIS_URL=redis://redis:6379

# ════════════════════════════════════════════════════════
# AUTHENTICATION (better-auth)
# ════════════════════════════════════════════════════════

# Secret key for signing session tokens and cookies.
# MUST be at least 32 characters. If this changes, all existing sessions are invalidated.
# Generate with: openssl rand -base64 48
BETTER_AUTH_SECRET=CHANGE_ME_AT_LEAST_32_CHARS_LONG

# The PUBLIC URL of your application. Used for:
# - OAuth callback URLs (must match what you register in Google Console)
# - Absolute URLs in emails (password reset, invitations)
# - Cookie domain setting
# Use your actual domain (with https):
BETTER_AUTH_URL=https://yourdomain.com

# ════════════════════════════════════════════════════════
# INTERNAL API SECURITY
# ════════════════════════════════════════════════════════

# Token that protects internal-only endpoints (e.g., scheduled analysis cron).
# These endpoints should ONLY be callable from within your infrastructure.
# Generate with: openssl rand -hex 32
INTERNAL_CRON_SECRET=CHANGE_ME_GENERATE_WITH_OPENSSL

# ════════════════════════════════════════════════════════
# GOOGLE OAUTH (for user authentication)
# ════════════════════════════════════════════════════════

# Get these from Google Cloud Console (see Step 9 for full instructions):
GOOGLE_CLIENT_ID=CHANGE_ME.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=CHANGE_ME_GOOGLE_SECRET

# ════════════════════════════════════════════════════════
# OPENAI API (for brand analysis — NOT for browser automation)
# ════════════════════════════════════════════════════════

# Used by packages/services/src/analysis/runAnalysis.ts to analyze LLM responses.
# The browser automation agents do NOT use this key — they automate real browser sessions.
# Required model: gpt-4.1 or gpt-4o (analysis uses large context windows)
OPENAI_API_KEY=sk-CHANGE_ME

# ════════════════════════════════════════════════════════
# SERVICE URLS (internal, container-to-container)
# ════════════════════════════════════════════════════════

# These are used for server-side calls (e.g., Next.js API routes calling the agent API).
# Use Docker service names — they resolve within the Docker network:
APP_URL=http://web:3000
API_BASE_URL=http://web:3000

# This is the PUBLIC URL shown to browsers (must be HTTPS in production):
NEXT_PUBLIC_API_URL=https://yourdomain.com

# ════════════════════════════════════════════════════════
# DEBUGGING
# ════════════════════════════════════════════════════════

# Set to 'true' to save browser screenshots when authentication fails.
# Useful for debugging why agents can't log in, but increases disk usage.
DEBUG_ENABLED=false
```

### Agent `.env` File

```bash
cp apps/agent/.env.example apps/agent/.env
nano apps/agent/.env
```

```bash
# ════════════════════════════════════════════════════════
# STORAGE PATHS
# ════════════════════════════════════════════════════════

# Where auth sessions are stored INSIDE the Docker container.
# The 'agent_storage' Docker volume is mounted to /storage in the container.
# Don't change this unless you also change the volume mount in docker-compose.yml.
VPS_AUTH_PROFILE_PATH=/storage

# For local development only (where sessions are stored on your Mac/PC):
LOCAL_AUTH_PROFILE_PATH=./storage

# ════════════════════════════════════════════════════════
# REDIS CONNECTION (for the agent worker)
# ════════════════════════════════════════════════════════

REDIS_HOST=redis
REDIS_PORT=6379

# ════════════════════════════════════════════════════════
# VPS SETTINGS
# ════════════════════════════════════════════════════════

# Your VPS username (used by upload-session script to SSH/SCP files):
VPS_USER=onescope

# The public-facing URL of your agent API (for uploading sessions from local):
VPS_API_URL=https://yourdomain.com

# ════════════════════════════════════════════════════════
# PROXY CONFIGURATION
# ════════════════════════════════════════════════════════

# The browser agents need residential proxies to avoid bot detection.
# Without proxies, ChatGPT/Claude/Perplexity will block the automated requests.

# Option A: API-based proxy pool (recommended for production)
# Your proxy provider's API returns a list of proxy IPs to use:
PROXY_API_URL=https://your-proxy-provider.com/api/get-proxies

# Option B: Manual proxy file (simpler, good for testing)
# A text file with one proxy per line: http://user:pass@host:port
PROXY_MANUAL_FILE=/storage/proxies.txt

# Which mode to use: 'api', 'manual', or 'auto' (tries API first, falls back to manual):
PROXY_SOURCE_MODE=auto

# Direct proxy settings (alternative to PROXY_API_URL):
# Use this if you have a single proxy server instead of a pool:
# PROXY_SERVER=http://proxy.example.net:9999
# PROXY_USERNAME=changeme
# PROXY_PASSWORD=changeme

# ════════════════════════════════════════════════════════
# AGENT API AUTHENTICATION
# ════════════════════════════════════════════════════════

# Token required to call the agent API's /upload-sessions endpoint.
# Generate with: openssl rand -hex 32
# Must match the value in your VPS upload-session script.
API_AUTH_TOKEN=CHANGE_ME_GENERATE_WITH_OPENSSL

# ════════════════════════════════════════════════════════
# WORKER CONFIGURATION
# ════════════════════════════════════════════════════════

# How many concurrent browser sessions to run simultaneously.
# Each session uses ~1-2GB RAM. Calculate: (Total RAM - 4GB overhead) / 2GB = concurrency
# For 8GB server: (8 - 4) / 2 = 2
# For 16GB server: (16 - 4) / 2 = 6
AGENT_WORKER_CONCURRENCY=2

# Whether to save screenshots when things fail (useful for debugging):
DEBUG_ENABLED=false
```

### Generate Strong Secrets

```bash
# Generate BETTER_AUTH_SECRET:
openssl rand -base64 48
# Output: 3r+K2mN...etc (48 random bytes, base64 encoded)

# Generate INTERNAL_CRON_SECRET:
openssl rand -hex 32
# Output: 8a4f2b... (32 random bytes, hex encoded = 64 chars)

# Generate API_AUTH_TOKEN:
openssl rand -hex 32

# Generate database password (alphanumeric only — easier to put in connection strings):
openssl rand -base64 24 | tr -dc '[:alnum:]' | head -c 32
# Output: 32 alphanumeric chars
```

---

## 9. Configure Google OAuth

Google OAuth allows users to sign in with their Google account. Here's how to set it up:

### Step 1: Create a Google Cloud Project

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Click the project dropdown at the top → **New Project**
3. Name it "OneScope AI" (or anything descriptive)
4. Click **Create**
5. Make sure the new project is selected in the dropdown

### Step 2: Enable Required APIs

1. In the left sidebar, go to **APIs & Services** → **Library**
2. Search for "Google+ API" and click **Enable**
3. Search for "Google People API" and click **Enable**
4. Return to **APIs & Services** → **OAuth consent screen**

### Step 3: Configure OAuth Consent Screen

1. Choose **External** (allows any Google account to sign in)
2. Fill in:
   - **App name:** OneScope AI
   - **User support email:** your@email.com
   - **Developer contact:** your@email.com
3. Click **Save and Continue** through the remaining steps
4. On **Scopes**: click **Add or Remove Scopes** → add `.../auth/userinfo.email` and `.../auth/userinfo.profile`
5. On **Test users** (while in development): add your Google email so you can test
6. Click **Back to Dashboard**

### Step 4: Create OAuth Credentials

1. Go to **APIs & Services** → **Credentials**
2. Click **+ Create Credentials** → **OAuth Client ID**
3. Choose **Web application**
4. Name it "OneScope AI Web"
5. Under **Authorized JavaScript origins**, add:
   ```
   https://yourdomain.com
   ```
6. Under **Authorized redirect URIs**, add:
   ```
   https://yourdomain.com/api/auth/callback/google
   ```
   ⚠️ This URI must match EXACTLY — including the protocol (`https://`), domain, and path.
7. Click **Create**
8. A popup shows your **Client ID** and **Client Secret** → copy both to your `.env`:
   ```bash
   GOOGLE_CLIENT_ID=12345678-abcdefg.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=GOCSPX-xxxxxxxxxxxxxxxxxxxxxxx
   ```

### Step 5: Publish the OAuth App

While in development, Google limits OAuth to "test users." To allow any user to sign in:
1. Go to **OAuth consent screen**
2. Click **Publish App** → **Confirm**

---

## 10. Configure Proxy Pool for Browser Agents

The browser agents (ChatGPT, Claude, Perplexity, Gemini, AI Overview) navigate real websites. These sites have bot detection that blocks datacenter IPs. **Residential proxies** route your traffic through real home internet connections, appearing as regular users.

### What Makes a Good Proxy for This Use Case

| Property | Why It Matters |
|----------|----------------|
| **Residential IPs** | Datacenter IPs are immediately blocked by anti-bot systems. Residential IPs belong to real ISPs and home connections. |
| **Geographic diversity** | Different countries have different content — you want to test from the target market. |
| **HTTP/HTTPS support** | Playwright's proxy support requires HTTP(S) proxies. SOCKS proxies need extra configuration. |
| **High uptime** | The agent has retry logic, but frequent proxy failures slow down job processing. |
| **Rotating or sticky IPs** | Rotating IPs help if a session gets blocked. Sticky IPs maintain the same IP for a full session. |

### Supported Proxy Providers

Any provider that gives you proxies in the format `http://username:password@host:port` works. Well-known options:
- Bright Data (formerly Luminati)
- Oxylabs
- Smartproxy
- PacketStream (budget option)

### Configuration Option A: API-Based Proxy Pool

If your provider has an API that returns a list of proxy IPs:

```bash
# apps/agent/.env:
PROXY_SOURCE_MODE=api
PROXY_API_URL=https://api.yourprovider.com/get-proxies?count=50&country=us&format=json

# The agent code expects the API to return JSON like:
# [
#   { "proxy": "http://user:pass@host1:port", "country": "US" },
#   { "proxy": "http://user:pass@host2:port", "country": "US" }
# ]
# Check apps/agent/src/lib/browser/proxyPool.ts for the exact expected format
```

### Configuration Option B: Manual Proxy File

Create a text file with one proxy per line:

```bash
# On your server, create the proxy list file:
mkdir -p /opt/onescope/storage
nano /opt/onescope/storage/proxies.txt
```

Format (one per line):
```
http://username:password@proxy1.example.com:9999
http://username:password@proxy2.example.com:9999
http://username:password@proxy3.example.com:9999
```

```bash
# apps/agent/.env:
PROXY_SOURCE_MODE=manual
PROXY_MANUAL_FILE=/storage/proxies.txt
```

### Testing Your Proxies

Before deploying, verify your proxies work:

```bash
# Test a proxy manually:
curl --proxy http://username:password@proxyhost:port https://httpbin.org/ip
# Should return the proxy's IP, not your server's IP
```

---

## 11. Authenticate Browser Sessions

This is the most complex step. The agents need authenticated sessions for each LLM provider — they don't create accounts or handle OAuth programmatically. Instead, you log in manually once, and the agent saves the browser session (cookies + localStorage) for reuse.

### Understanding Browser Sessions

Playwright saves authentication state as a JSON file containing:
- Session cookies
- localStorage values
- Other browser state

These files live in `/storage/{provider}/{provider}-auth.json` inside the `agent_storage` Docker volume.

### Approach 1: Authenticate Locally, Upload to Server

This is the recommended approach. You authenticate on your local machine (where you have a display/GUI) and upload the session to the server.

**On your local development machine:**

```bash
# 1. Install dependencies:
pnpm install

# 2. Authenticate each provider (opens a real browser window):
pnpm auth:openai        # Opens ChatGPT — log in with your OpenAI account
pnpm auth:anthropic     # Opens Claude — log in with your Anthropic account
pnpm auth:perplexity    # Opens Perplexity — log in
pnpm auth:google        # Opens Google — log in (used for both Gemini + AI Overview)

# 3. Verify sessions were saved locally:
ls -la storage/
# Should show: openai/  anthropic/  perplexity/  google/

# 4. Upload sessions to your server:
pnpm upload-session
# This calls the agent API's /upload-sessions endpoint with your auth token
```

**The upload-session script** (`apps/agent/src/auth/upload-session.ts`):
- Reads each session file from `./storage/`
- Makes a POST request to `https://yourdomain.com/api/upload-sessions`
- Includes your `API_AUTH_TOKEN` in the Authorization header
- The agent API writes the session to the Docker volume at `/storage/{provider}/`

### Approach 2: Authenticate Directly on the Server (Headless)

If you can't authenticate locally (e.g., you need a fresh server-only setup), use X virtual framebuffer:

```bash
# On the server, install Xvfb (virtual display):
apt install -y xvfb

# Start a virtual display:
Xvfb :99 -screen 0 1920x1080x24 &
export DISPLAY=:99

# Now Playwright can open a browser window (rendered to the virtual display):
# Install dependencies:
pnpm install

# Run auth (the browser runs headlessly via Xvfb):
pnpm auth:openai

# To see what's happening remotely (optional):
# Install x11vnc for remote viewing:
# apt install x11vnc
# x11vnc -display :99 -nopw -listen 0.0.0.0 -xkb &
# Then connect with VNC viewer: your-server-ip:5900
```

### How Long Do Sessions Last?

| Provider | Session Duration | Notes |
|----------|-----------------|-------|
| OpenAI | 30 days | Needs re-auth monthly |
| Anthropic | ~7 days | More frequent re-auth needed |
| Perplexity | 30 days | |
| Google | ~14 days | Shared between Gemini + AI Overview |

### Session Expiry Detection

The agent checks authentication status after launching each browser session. When `isAuthenticated()` returns `false`:
- The agent logs an auth error
- The job fails with an `AuthError`
- BullMQ marks the job as failed
- The job does NOT automatically retry (auth errors are terminal — you must re-authenticate)

Set up a monitoring alert (see Section 15) to notify you when auth errors appear in logs.

---

## 12. Pull & Deploy Docker Images

### Authenticate with GitHub Container Registry

If you're using the private images from `ghcr.io/aryamantodkar/`:

```bash
# Create a GitHub Personal Access Token (PAT) with `read:packages` scope:
# github.com → Settings → Developer settings → Personal access tokens → Fine-grained tokens

# Login with your PAT:
echo YOUR_GITHUB_PAT | docker login ghcr.io -u YOUR_GITHUB_USERNAME --password-stdin
```

If you forked the repo and built your own images, use your own registry credentials.

### Pull Images

```bash
cd /opt/onescope

# Pull all images defined in docker-compose.yml:
docker compose pull

# This downloads:
# - ghcr.io/aryamantodkar/onescope-web:latest    (~500MB)
# - ghcr.io/aryamantodkar/onescope-agent:latest  (~1.5GB — includes Chromium)
# - ghcr.io/aryamantodkar/onescope-postgres:latest (~400MB)
# - redis:7-alpine                                 (~30MB)
# - clickhouse/clickhouse-server:latest            (~600MB)
```

### Run Database Migrations

Always run migrations BEFORE starting the web app. Migrations create or update database tables. If the web app starts before migrations run, it will try to query tables that don't exist yet:

```bash
# Run the migration container (it runs once, applies migrations, then exits):
docker compose run --rm migrate

# This:
# 1. Starts just the 'db' and 'migrate' containers
# 2. Runs 'pnpm --filter @onescope/db db:migrate'
# 3. Creates all PostgreSQL tables
# 4. Exits with code 0 on success
```

### Start All Services

```bash
# Start everything in detached mode (runs in the background):
docker compose up -d

# Check that all containers started successfully:
docker compose ps
```

Expected output:
```
NAME                    IMAGE                          STATUS
onescope-web            onescope-web:latest            Up (healthy)
onescope-agent-api      onescope-agent:latest          Up (healthy)
onescope-agent-worker   onescope-agent:latest          Up
postgres_db             onescope-postgres:latest       Up (healthy)
clickhouse_db           clickhouse-server:latest       Up
redis                   redis:7-alpine                 Up
```

If any service shows `(unhealthy)` or `Exit 1`, check its logs:
```bash
docker compose logs --tail=100 service-name
```

---

## 13. Verify Everything Is Working

Work through this checklist top-to-bottom:

### 13.1 — Network Layer

```bash
# Verify nginx is routing correctly:
curl -I https://yourdomain.com
# Expected: HTTP/2 200

# Check SSL certificate is valid:
curl -v https://yourdomain.com 2>&1 | grep -E "SSL|certificate|expire"
# Should show certificate details and no errors
```

### 13.2 — Database Connectivity

```bash
# Connect to PostgreSQL from inside the Docker network:
docker compose exec db psql -U onescope -d onescope -c "\dt"
# Should list all tables (user, session, workspace, etc.)

# Test ClickHouse:
docker compose exec clickhouse clickhouse-client --query "SHOW TABLES FROM analytics"
# Should list: user_prompts, prompt_responses, prompt_analysis
```

### 13.3 — Agent API Health

```bash
# Check the agent API's health endpoint:
curl http://localhost:3333/health | python3 -m json.tool
```

Expected response:
```json
{
  "status": "ok",
  "redis": "connected",
  "auth": {
    "openai": true,
    "anthropic": true,
    "perplexity": true,
    "google": true
  }
}
```

If any provider shows `false`, re-run the auth process for that provider.

### 13.4 — Web Application

```bash
# Check the web app responds:
curl -s -o /dev/null -w "%{http_code}" https://yourdomain.com
# Expected: 200

# Check the tRPC health endpoint (if exists):
curl https://yourdomain.com/api/trpc/health
```

### 13.5 — End-to-End Functional Test

1. Open `https://yourdomain.com` in your browser
2. Click **Sign in with Google**
3. Complete Google OAuth flow — should redirect to the dashboard
4. Click **Create Workspace** → fill in name and country → create it
5. Navigate to **Prompts** → add a test prompt like "Tell me about [your brand]"
6. Click **Run Analysis** (or equivalent)
7. Watch `agent-worker` logs:
   ```bash
   docker compose logs -f agent-worker
   ```
   You should see logs like:
   ```
   [worker] Picked up job openai for workspace ws_xxxx
   [agent] Launching OpenAI agent...
   [agent] Authentication: OK
   [agent] Running prompt 1/1: "Tell me about..."
   [agent] Response received (1234 chars)
   [agent] Sources extracted: 5
   [worker] Job completed successfully
   ```
8. Return to the dashboard — the response should appear within 1-2 minutes

---

## 14. Set Up Automated Backups

Backups protect against data loss from hardware failures, accidental deletions, or ransomware. Set them up before you have meaningful data.

### What to Backup

| Data | Location | Importance |
|------|----------|-----------|
| PostgreSQL | `db_data` Docker volume | CRITICAL — user accounts, workspaces |
| ClickHouse | `clickhouse_data` Docker volume | HIGH — all analysis results |
| Agent sessions | `agent_storage` Docker volume | MEDIUM — can re-authenticate if lost |
| Configuration | `/opt/onescope/*.env` | HIGH — secrets can't be recovered |

### Backup Script

Create the backup script:

```bash
nano /opt/onescope/backup.sh
```

```bash
#!/bin/bash
# /opt/onescope/backup.sh — Daily backup script for OneScope AI

set -e  # Exit immediately if any command fails

# Configuration:
BACKUP_DIR="/opt/backups/onescope"
COMPOSE_DIR="/opt/onescope"
DATE=$(date +%Y-%m-%d_%H-%M-%S)
RETENTION_DAYS=30  # Keep backups for 30 days

# Create backup directory if it doesn't exist:
mkdir -p "$BACKUP_DIR"

echo "[$(date)] Starting OneScope backup..."

# ── PostgreSQL Backup ──────────────────────────────────────────────────────────
echo "[$(date)] Backing up PostgreSQL..."

# pg_dump creates a SQL dump that can recreate the entire database.
# The -T flag excludes tables that don't need to be backed up.
docker compose -f "$COMPOSE_DIR/docker-compose.yml" exec -T db \
  pg_dump \
    --username=onescope \
    --dbname=onescope \
    --format=custom \              # Custom format: compressed, faster restore
    --verbose \
  | gzip > "$BACKUP_DIR/postgres_$DATE.dump.gz"

echo "[$(date)] PostgreSQL backup complete: postgres_$DATE.dump.gz"

# ── ClickHouse Backup ──────────────────────────────────────────────────────────
echo "[$(date)] Backing up ClickHouse..."

# Export each table as CSV (readable + portable format):
for table in user_prompts prompt_responses prompt_analysis; do
  docker compose -f "$COMPOSE_DIR/docker-compose.yml" exec -T clickhouse \
    clickhouse-client \
      --database=analytics \
      --query="SELECT * FROM $table FORMAT CSV" \
    | gzip > "$BACKUP_DIR/clickhouse_${table}_$DATE.csv.gz"
  echo "[$(date)]   ✓ $table exported"
done

# ── Configuration Backup ───────────────────────────────────────────────────────
echo "[$(date)] Backing up configuration..."

# Encrypt the .env files before backing up (they contain secrets):
# Using openssl with AES-256-CBC encryption
# You'll need your BACKUP_ENCRYPTION_KEY to decrypt
if [ -n "$BACKUP_ENCRYPTION_KEY" ]; then
  tar -czf - "$COMPOSE_DIR/.env" "$COMPOSE_DIR/apps/agent/.env" | \
    openssl enc -aes-256-cbc -salt -k "$BACKUP_ENCRYPTION_KEY" \
    -out "$BACKUP_DIR/config_$DATE.tar.gz.enc"
  echo "[$(date)] Configuration backup encrypted"
else
  # Fallback: unencrypted (less secure — consider setting BACKUP_ENCRYPTION_KEY)
  tar -czf "$BACKUP_DIR/config_$DATE.tar.gz" \
    "$COMPOSE_DIR/.env" \
    "$COMPOSE_DIR/apps/agent/.env"
  echo "[$(date)] WARNING: Configuration backup is NOT encrypted. Set BACKUP_ENCRYPTION_KEY."
fi

# ── Cleanup Old Backups ────────────────────────────────────────────────────────
echo "[$(date)] Removing backups older than $RETENTION_DAYS days..."
find "$BACKUP_DIR" -name "*.gz" -mtime +$RETENTION_DAYS -delete
find "$BACKUP_DIR" -name "*.enc" -mtime +$RETENTION_DAYS -delete
echo "[$(date)] Cleanup complete."

echo "[$(date)] Backup finished successfully."
echo "[$(date)] Backup size: $(du -sh $BACKUP_DIR | cut -f1)"
```

Make it executable and test:

```bash
chmod +x /opt/onescope/backup.sh

# Test the backup script:
/opt/onescope/backup.sh

# Verify backup files were created:
ls -lh /opt/backups/onescope/
```

### Schedule Automatic Backups

```bash
# Open the cron editor for the onescope user:
crontab -e

# Add this line (runs at 3:00 AM every day):
0 3 * * * /opt/onescope/backup.sh >> /var/log/onescope-backup.log 2>&1

# The >> appends to the log file; 2>&1 redirects stderr to the same file
```

### Offsite Backup (Highly Recommended)

Storing backups on the same server as the data defeats the purpose. Copy backups to a separate location:

```bash
# Option A: Rclone to S3/Backblaze B2/Cloudflare R2 (free 10GB tier):
apt install -y rclone
rclone config  # Follow interactive setup for your cloud storage provider

# Add to backup.sh after the cleanup section:
rclone sync "$BACKUP_DIR" remote:onescope-backups/
echo "[$(date)] Synced to remote storage"

# Option B: rsync to another server:
rsync -avz "$BACKUP_DIR" backup-user@backup-server.com:/backups/onescope/
```

### Restore from Backup

```bash
# Restore PostgreSQL:
docker compose exec -T db \
  pg_restore \
    --username=onescope \
    --dbname=onescope \
    --verbose \
    --clean \              # Drop existing objects before restoring
  < <(gunzip -c /opt/backups/onescope/postgres_2025-01-15_03-00-00.dump.gz)

# Restore ClickHouse:
gunzip -c /opt/backups/onescope/clickhouse_prompt_responses_2025-01-15.csv.gz | \
  docker compose exec -T clickhouse \
    clickhouse-client \
      --database=analytics \
      --query="INSERT INTO prompt_responses FORMAT CSV"
```

---

## 15. Set Up Monitoring

### Real-Time Log Monitoring

```bash
# Watch all services in real-time:
docker compose logs -f

# Watch a specific service:
docker compose logs -f agent-worker  # Agent execution logs
docker compose logs -f web           # Next.js app logs

# Search logs for errors:
docker compose logs | grep -i "error\|failed\|crash" | tail -50

# Watch logs from the last 1 hour:
docker compose logs --since 1h
```

### Resource Usage

```bash
# Live resource usage (like task manager for Docker):
docker stats

# Output shows per-container CPU%, Memory, Network I/O, Block I/O
# Watch for agent-worker going above 4GB RAM — Chromium leak indicator

# Disk usage:
df -h /var/lib/docker/volumes
du -sh /opt/backups/onescope/
```

### Self-Hosted Uptime Monitor (Uptime Kuma)

Add Uptime Kuma to `docker-compose.yml` for a web-based uptime dashboard:

```yaml
# Add to docker-compose.yml:
uptime-kuma:
  image: louislam/uptime-kuma:1
  container_name: uptime-kuma
  restart: unless-stopped
  ports:
    - "127.0.0.1:3001:3001"  # Access via localhost (proxy through nginx if needed)
  volumes:
    - uptime_kuma_data:/app/data

# Add to volumes section:
volumes:
  # ... existing volumes ...
  uptime_kuma_data:
```

Then add to nginx config (optional, to access via `https://yourdomain.com/status`):
```nginx
location /status {
    proxy_pass http://127.0.0.1:3001;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
}
```

Configure Uptime Kuma to monitor:
1. `https://yourdomain.com` (web app — HTTP 200 check)
2. `http://localhost:3333/health` (agent API — HTTP 200 check)
3. PostgreSQL via TCP ping on port 5432
4. Redis via TCP ping on port 6379

Set up notifications (email, Slack, Discord, Telegram) so you're alerted when services go down.

---

## 16. Updating to New Versions

### Zero-Downtime Rolling Update

```bash
cd /opt/onescope

# 1. Pull the latest code (for docker-compose.yml changes):
git pull

# 2. Pull latest Docker images:
docker compose pull

# 3. Run migrations if schema changed:
# (Safe to run even if no migrations — it just reports "no migrations to run")
docker compose run --rm migrate

# 4. Restart services one at a time (minimizes downtime):

# Restart web app (users see a brief 502 while nginx retries, ~5 seconds):
docker compose up -d --no-deps web

# Restart agent API (sessions uploads paused ~10 seconds):
docker compose up -d --no-deps agent-api

# Restart agent worker:
# This stops the current worker (in-flight job may be abandoned and retried),
# then starts the new version. SIGTERM triggers graceful shutdown if implemented.
docker compose up -d --no-deps agent-worker

# 5. Verify all services came back up:
docker compose ps
```

### Emergency Rollback

If the new version is broken:

```bash
# Pull the previous version (by SHA tag if you know it):
docker pull ghcr.io/aryamantodkar/onescope-web:sha-abc1234
docker pull ghcr.io/aryamantodkar/onescope-agent:sha-abc1234

# Or roll back the entire stack:
git checkout previous-working-tag
docker compose pull
docker compose up -d
```

---

## 17. Firewall & Security Hardening

### UFW Firewall Rules

```bash
# Reset to defaults first:
ufw --force reset

# Default policies: deny incoming, allow outgoing:
ufw default deny incoming
ufw default allow outgoing

# Allow essential services:
ufw allow 22/tcp    # SSH — CRITICAL: don't forget this or you'll be locked out!
ufw allow 80/tcp    # HTTP (nginx, for redirect to HTTPS)
ufw allow 443/tcp   # HTTPS (nginx)

# Enable the firewall:
ufw --force enable

# Verify rules:
ufw status verbose
```

### SSH Hardening

```bash
# Edit SSH configuration:
nano /etc/ssh/sshd_config
```

Add or modify:
```
# Disable password authentication (use SSH keys only):
PasswordAuthentication no

# Disable root login via SSH:
PermitRootLogin no

# Allow only specific users:
AllowUsers onescope

# Use only SSH protocol version 2:
Protocol 2

# Limit login attempts:
MaxAuthTries 3

# Set idle timeout (1 hour):
ClientAliveInterval 3600
ClientAliveCountMax 1
```

```bash
# Restart SSH daemon (don't close your current session first!):
systemctl restart sshd

# Test in a new terminal that you can still connect before closing the old one:
ssh onescope@yourdomain.com
```

### fail2ban Configuration

fail2ban automatically bans IPs that repeatedly fail to log in:

```bash
# Create a local configuration file (overrides defaults):
nano /etc/fail2ban/jail.local
```

```ini
[DEFAULT]
# Ban for 1 hour after 5 failed attempts in 10 minutes:
bantime = 3600
findtime = 600
maxretry = 5

# Email notification for bans (optional):
# destemail = your@email.com
# action = %(action_mwl)s

[sshd]
enabled = true
port = ssh
```

```bash
systemctl restart fail2ban

# Check fail2ban status:
fail2ban-client status
fail2ban-client status sshd
```

### Docker Security Notes

- Docker containers run as root inside the container by default. Your `web` and `agent` Dockerfiles should include a `USER` instruction to drop to a non-root user.
- Never expose the Docker socket (`/var/run/docker.sock`) to containers unless absolutely necessary.
- Regularly update base images: `docker compose pull && docker compose up -d` pulls security patches.

---

## 18. Troubleshooting Common Issues

### Agent Worker Not Processing Jobs

**Symptoms:** Jobs sit in the queue indefinitely. `agent-worker` logs show no activity.

```bash
# Check worker logs:
docker compose logs --tail=100 agent-worker

# Common causes:
# 1. Redis connection failed:
docker compose exec agent-worker redis-cli -h redis ping
# Should return: PONG

# 2. Job queue has stalled jobs:
docker compose exec redis redis-cli
> LLEN bull:onescope-agent:wait      # Number of waiting jobs
> LLEN bull:onescope-agent:active    # Number of in-progress (stalled) jobs

# 3. Environment variable missing:
docker compose exec agent-worker env | grep REDIS
```

### Auth Sessions Expired

**Symptoms:** Logs show `Auth failed: session expired` or `isAuthenticated: false`.

```bash
# Check which sessions are expired:
curl http://localhost:3333/health | python3 -m json.tool
# Look for providers with "false" in the auth object

# Re-authenticate on your local machine and re-upload:
pnpm auth:openai    # (or whichever provider is expired)
pnpm upload-session
```

### ClickHouse Not Responding

**Symptoms:** Analysis fails with "Connection refused" or "ClickHouse error".

```bash
# Check ClickHouse logs:
docker compose logs --tail=50 clickhouse

# Test connectivity from the web container:
docker compose exec web curl http://clickhouse:8123/ping
# Should return: Ok.

# Check if the analytics schema was created:
docker compose exec clickhouse clickhouse-client --query "SHOW TABLES FROM analytics"
# Should list: user_prompts, prompt_responses, prompt_analysis
# If empty: the init script didn't run. Check docker-compose.yml volume mount for clickhouse-init.
```

### PostgreSQL Migration Failed

**Symptoms:** `migrate` container exits with error code.

```bash
# Read migration error:
docker compose logs migrate

# Common fixes:
# 1. DATABASE_URL is wrong — check it points to the 'db' service:
echo $DATABASE_URL  # Should be: postgresql://user:pass@db:5432/dbname

# 2. Database doesn't exist yet — it should be created by the Dockerfile.postgres init scripts.
# Check: docker compose logs db | grep "database system was shut down"

# 3. Migration file has a syntax error:
docker compose exec db psql -U onescope -d onescope -c "SELECT * FROM drizzle.__drizzle_migrations"
```

### Google OAuth "redirect_uri_mismatch" Error

**Symptoms:** After Google login, redirected back with "Error 400: redirect_uri_mismatch".

**Fix:** The redirect URI in your Google Console must EXACTLY match. Check:
1. No trailing slash: `https://yourdomain.com/api/auth/callback/google` ✅
2. No `http://` — must be `https://`
3. No port number in production URL
4. The `BETTER_AUTH_URL` in `.env` matches your actual domain exactly

### Chromium Crashes (OOM)

**Symptoms:** Agent-worker crashes with `signal: killed (SIGKILL)` or "Browser disconnected unexpectedly".

**Cause:** Chromium ran out of shared memory (needs at least 1GB for `/dev/shm`).

**Fix:** Verify `shm_size: "1gb"` is in the `agent-worker` service in `docker-compose.yml`:

```yaml
agent-worker:
  shm_size: "1gb"  # This must be present
```

If it is present, reduce `AGENT_WORKER_CONCURRENCY` — too many concurrent browser sessions exceed available RAM.

---

## 19. Architecture Reference

### Docker Volume Reference

| Volume | Stores | Backup? |
|--------|--------|---------|
| `db_data` | PostgreSQL data files | CRITICAL |
| `clickhouse_data` | ClickHouse data files | HIGH |
| `redis_data` | Redis AOF/RDB persistence | LOW (ephemeral queue) |
| `agent_storage` | Browser auth sessions + proxy files | MEDIUM |

### Port Reference (localhost only)

| Port | Service | Protocol |
|------|---------|----------|
| 3000 | web (Next.js) | HTTP → proxied by nginx |
| 3333 | agent-api | HTTP → proxied by nginx (optional) |
| 5432 | PostgreSQL | TCP (localhost only) |
| 6379 | Redis | TCP (internal Docker) |
| 8123 | ClickHouse HTTP | TCP (localhost only) |
| 9000 | ClickHouse native | TCP (localhost only) |
| 80, 443 | nginx | HTTP/HTTPS → public internet |

### Service Dependency Graph

```
web depends on → db (healthy) + migrate (complete) + redis (healthy) + clickhouse (healthy)
agent-worker depends on → redis (healthy)
agent-api depends on → redis (started)
migrate depends on → db (healthy)
```

### File Layout on Server

```
/opt/onescope/
├── docker-compose.yml
├── Dockerfile
├── Dockerfile.agent
├── Dockerfile.postgres
├── .env                        ← Web app secrets (never commit)
├── apps/
│   └── agent/
│       └── .env                ← Agent secrets (never commit)
└── packages/
    └── db/
        ├── init-scripts/       ← PostgreSQL init SQL (committed)
        └── clickhouse-init/    ← ClickHouse init SQL (committed)

/opt/backups/onescope/
├── postgres_2025-01-15_03-00-00.dump.gz
├── clickhouse_prompt_responses_2025-01-15.csv.gz
└── config_2025-01-15.tar.gz

/var/log/
└── onescope-backup.log         ← Backup execution logs
```
