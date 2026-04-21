#!/usr/bin/env bash
# OneGlanse VPS setup — Ubuntu 22.04 / 24.04
# Run as a non-root user with sudo privileges.
set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

info()    { echo -e "${CYAN}→${NC} $*"; }
success() { echo -e "${GREEN}✓${NC} $*"; }
warn()    { echo -e "${YELLOW}!${NC} $*"; }
fatal()   { echo -e "${RED}✗${NC} $*" >&2; exit 1; }
header()  { echo -e "\n${BOLD}$*${NC}"; }

require_cmd() { command -v "$1" >/dev/null 2>&1; }
has_group() { id -nG "$USER" | tr ' ' '\n' | grep -qx "$1"; }
docker_socket_access() { docker info >/dev/null 2>&1; }

DOCKER_GROUP_PENDING=0

if [[ "${EUID:-$(id -u)}" -eq 0 ]]; then
  fatal "Run this script as a non-root user with sudo privileges."
fi

# ─── Gather inputs ────────────────────────────────────────────────────────────

header "OneGlanse — VPS Setup"
echo "This script installs all dependencies, clones the repo, configures nginx + HTTPS,"
echo "and starts the app-only self-hosted stack."
echo ""
warn "Run this as the user who will own the OneGlanse process (not root)."
echo ""

read -rp "Your domain for the app (e.g. app.yourdomain.com): " DOMAIN
[[ -z "$DOMAIN" ]] && fatal "Domain is required."

read -rp "Install directory [/home/$USER/oneglanse]: " INSTALL_DIR
INSTALL_DIR="${INSTALL_DIR:-/home/$USER/oneglanse}"

echo ""
echo "LLM provider for response analysis:"
select LLM_CHOICE in "OpenAI (GPT)" "Anthropic (Claude)"; do
  case $REPLY in
    1) LLM_PROVIDER="openai"; break ;;
    2) LLM_PROVIDER="claude"; break ;;
    *) echo "Enter 1 or 2." ;;
  esac
done

if [[ "$LLM_PROVIDER" == "openai" ]]; then
  read -rsp "OpenAI API key (sk-...): " OPENAI_KEY; echo ""
  [[ -z "$OPENAI_KEY" ]] && fatal "OpenAI key is required."
else
  read -rsp "Anthropic API key (sk-ant-...): " ANTHROPIC_KEY; echo ""
  [[ -z "$ANTHROPIC_KEY" ]] && fatal "Anthropic key is required."
fi

read -rp "Residential proxy API URL (required on VPS): " PROXY_URL
[[ -z "$PROXY_URL" ]] && fatal "Residential proxy API URL is required on VPS."

read -rsp "Auth upload token [auto-generate if blank]: " AUTH_TOKEN; echo ""
if [[ -z "$AUTH_TOKEN" ]]; then
  if require_cmd openssl; then
    AUTH_TOKEN="$(openssl rand -hex 32)"
  else
    AUTH_TOKEN="$(node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))")"
  fi
  info "Generated auth upload token automatically."
fi

echo ""
info "Settings:"
echo "  Domain:       $DOMAIN"
echo "  Install dir:  $INSTALL_DIR"
echo "  LLM:          $LLM_PROVIDER"
echo ""
read -rp "Continue? (y/N) " CONFIRM
[[ "$CONFIRM" =~ ^[Yy]$ ]] || { echo "Aborted."; exit 0; }

# ─── Install dependencies ─────────────────────────────────────────────────────

header "1 / 6 — Installing dependencies"

if ! require_cmd docker; then
  info "Installing Docker..."
  curl -fsSL https://get.docker.com | sh
else
  success "Docker already installed"
fi

if ! has_group docker; then
  info "Adding $USER to the docker group..."
  sudo usermod -aG docker "$USER"
  DOCKER_GROUP_PENDING=1
else
  success "User already has docker group access"
fi

if ! require_cmd node; then
  info "Installing Node.js 20..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y nodejs
else
  success "Node.js already installed ($(node -v))"
fi

if ! require_cmd git; then
  info "Installing git..."
  sudo apt-get install -y git
else
  success "git already installed"
fi

if ! require_cmd nginx; then
  info "Installing nginx + certbot..."
  sudo apt install -y nginx certbot python3-certbot-nginx
else
  success "nginx already installed"
fi

# ─── Clone / update repo ──────────────────────────────────────────────────────

header "2 / 6 — Cloning OneGlanse"

if [[ -d "$INSTALL_DIR/.git" ]]; then
  info "Repo exists at $INSTALL_DIR — pulling latest..."
  git -C "$INSTALL_DIR" pull
else
  info "Cloning into $INSTALL_DIR..."
  git clone --depth 1 https://github.com/aryamantodkar/oneglanse "$INSTALL_DIR"
fi

cd "$INSTALL_DIR"

# ─── Configure .env ───────────────────────────────────────────────────────────

header "3 / 6 — Configuring .env"

if [[ ! -f .env ]]; then
  cp .env.example .env
  info "Created .env from .env.example"
fi

set_env() {
  local key="$1" val="$2"
  if grep -q "^${key}=" .env; then
    sed -i "s|^${key}=.*|${key}=${val}|" .env
  else
    echo "${key}=${val}" >> .env
  fi
}

needs_secret() {
  local key="$1" current=""
  current="$(grep "^${key}=" .env | head -n1 | cut -d= -f2- || true)"
  [[ -z "$current" || "$current" == "replace-me" || "$current" == "changeme" ]]
}

set_env "APP_URL"      "https://${DOMAIN}"
set_env "API_BASE_URL" "https://${DOMAIN}"
set_env "AGENT_AUTH_UPLOAD_TOKEN" "$AUTH_TOKEN"
set_env "ONEGLANSE_APP_MODE" "self-host"

if [[ "$LLM_PROVIDER" == "openai" ]]; then
  set_env "OPENAI_API_KEY" "$OPENAI_KEY"
else
  set_env "ANTHROPIC_API_KEY" "$ANTHROPIC_KEY"
  set_env "ANALYSIS_LLM_PROVIDER" "claude"
fi

set_env "THORDATA_PROXY_API_URL" "$PROXY_URL"
if needs_secret "BETTER_AUTH_SECRET"; then
  set_env "BETTER_AUTH_SECRET" "$(openssl rand -hex 32)"
fi
if needs_secret "INTERNAL_CRON_SECRET"; then
  set_env "INTERNAL_CRON_SECRET" "$(node -e "console.log(require('node:crypto').randomUUID())")"
fi

success ".env configured"

# ─── Start the stack ──────────────────────────────────────────────────────────

header "4 / 6 — Starting OneGlanse"

info "Starting the app from published Docker images..."
if docker_socket_access; then
  node scripts/run-compose.mjs bootstrap
elif [[ "$DOCKER_GROUP_PENDING" -eq 1 ]]; then
  info "Current shell does not yet include the docker group — bootstrapping with sudo using the docker group for this first run."
  printf -v SELF_HOST_CMD 'cd %q && node scripts/run-compose.mjs bootstrap' "$INSTALL_DIR"
  sudo -u "$USER" -g docker env "HOME=$HOME" "PATH=$PATH" bash -lc "$SELF_HOST_CMD"
else
  fatal "Current shell cannot access Docker. Run 'newgrp docker' or sign out and back in, then re-run this script."
fi

info "Waiting for web container to become healthy..."
for i in $(seq 1 30); do
  if curl -sf http://127.0.0.1:3000 >/dev/null 2>&1; then
    success "Web app is responding on port 3000"
    break
  fi
  sleep 3
  if [[ $i -eq 30 ]]; then
    warn "Web app not responding after 90s — check 'docker logs oneglanse-web'"
  fi
done

# ─── Configure nginx ──────────────────────────────────────────────────────────

header "5 / 6 — Configuring nginx"

NGINX_CONF="/etc/nginx/sites-available/oneglanse"

sudo tee "$NGINX_CONF" > /dev/null <<EOF
server {
    listen 80;
    server_name ${DOMAIN};

    location / {
        proxy_pass         http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade \$http_upgrade;
        proxy_set_header   Connection 'upgrade';
        proxy_set_header   Host \$host;
        proxy_set_header   X-Real-IP \$remote_addr;
        proxy_set_header   X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 120s;
    }
}
EOF

if [[ ! -L /etc/nginx/sites-enabled/oneglanse ]]; then
  sudo ln -s "$NGINX_CONF" /etc/nginx/sites-enabled/oneglanse
fi
sudo rm -f /etc/nginx/sites-enabled/default

sudo nginx -t
sudo systemctl reload nginx
success "nginx configured for $DOMAIN"

info "Obtaining SSL certificate via Let's Encrypt..."
sudo certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos -m "admin@${DOMAIN}" || \
  warn "certbot failed — DNS may not have propagated yet. Run: sudo certbot --nginx -d $DOMAIN"

# ─── Firewall ─────────────────────────────────────────────────────────────────

header "6 / 6 — Configuring firewall"

if require_cmd ufw; then
  sudo ufw allow OpenSSH
  sudo ufw allow 'Nginx Full'
  sudo ufw allow 3333/tcp
  sudo ufw --force enable
  success "ufw configured (SSH + HTTP/HTTPS + auth upload allowed)"
else
  warn "ufw not found — configure your firewall manually"
fi

# ─── Done ─────────────────────────────────────────────────────────────────────

echo ""
echo -e "${GREEN}${BOLD}Setup complete!${NC}"
echo ""
echo "  App URL:        https://${DOMAIN}"
echo "  Install dir:    ${INSTALL_DIR}"
echo ""
echo "Next steps:"
echo "  1. On your local machine, set in .env:"
echo "       ONEGLANSE_VPS_IP=<your VPS IP>"
echo "       AGENT_AUTH_UPLOAD_TOKEN=${AUTH_TOKEN}"
echo "  2. Run: pnpm auth  (sign in to providers locally)"
echo "  3. Run: pnpm upload:vps  (transfer sessions to this VPS)"
echo "  4. Open https://${DOMAIN}, create your account, and add prompts."
echo ""
echo "To update in the future:"
echo "  cd ${INSTALL_DIR} && git pull && node scripts/run-compose.mjs bootstrap"
echo ""
