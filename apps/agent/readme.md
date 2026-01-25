# Onescope Agent

Automates LLM data fetching directly from the ChatGPT UI.

---

## 🚀 Quick Start (Recommended)

**One-command setup for first-time users:**

```bash
make init
```

This will automatically:
- Install all dependencies (pnpm, chisel)
- Set up SSH keys
- Configure your VPS
- Deploy the application
- Start local services
- Run authentication

**See [QUICKSTART.md](QUICKSTART.md) for detailed guide.**

---

## 📋 Manual Setup

For step-by-step control, see the sections below.

## Local Setup


## Self-Hosting on VPS

### Step 1: Connect to your server

```bash
# SSH into your VPS
ssh root@YOUR_SERVER_IP

# Accept fingerprint when prompted
# Type: yes
```

---

### Step 2: Initial system setup

#### Update the system

```bash
sudo apt update && sudo apt upgrade -y
```

#### Set timezone

```bash
timedatectl set-timezone UTC
timedatectl  # Verify
```

#### Create non-root user

```bash
# Create user
adduser onescope

# Give sudo access
sudo usermod -aG sudo onescope

# Switch to new user
sudo su - onescope
```

---

### Step 3: Install core dependencies

#### Install system packages

```bash
sudo apt install -y \
  curl \
  git \
  build-essential \
  ca-certificates \
  gnupg \
  lsb-release
```

#### Install Node.js (LTS)

```bash
# Add NodeSource repository
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -

# Install Node.js
sudo apt install -y nodejs

# Verify installation
node -v
npm -v
```

#### Install pnpm

```bash
sudo npm install -g pnpm
pnpm -v  # Verify
```

#### Install PM2

```bash
sudo npm install -g pm2
pm2 --version  # Verify
```

---

### Step 4: Install Redis

```bash
# Install Redis server
sudo apt install -y redis-server

# Enable auto-start
sudo systemctl enable redis-server
sudo systemctl start redis-server

# Verify it's running
redis-cli ping
# Should return: PONG
```

---

### Step 5: Clone and setup the project

```bash
# Clone repository
git clone https://github.com/aryamantodkar/onescope-agent.git
cd onescope-agent

# Install dependencies
pnpm install
pnpm exec playwright install chromium

# Automatic installation
sudo pnpm exec playwright install-deps chromium
```

**If the above fails, install manually:**

```bash
sudo apt update
sudo apt install -y \
  libatk-bridge2.0-0 \
  libatk1.0-0 \
  libcups2 \
  libxkbcommon0 \
  libgtk-3-0 \
  libnss3 \
  libxss1 \
  libasound2 \
  libgbm1 \
  libdrm2 \
  libxcomposite1 \
  libxdamage1 \
  libxrandr2 \
  libxshmfence1 \
  libpangocairo-1.0-0 \
  fonts-liberation
```

---

### Add .env.vps

```bash
nano .env.vps
```
## Paste this content

```bash
NODE_ENV=production

AUTH_PROFILE_PATH=/home/onescope/onescope-agent/storage

REDIS_HOST=127.0.0.1
REDIS_PORT=6379
```

Save this file.

### Auth Login for different providers (On your local machine, not on the vps)

```bash
pnpm run auth
```

Enter VPS password when asked in cli to store auth session.

You're done.

### PM2 Server (persistent background process)

## Step 9: Start the server

```bash
pnpm run start

pnpm run startup 
OR
sudo env PATH=$PATH:/usr/bin /usr/lib/node_modules/pm2/bin/pm2 startup systemd -u onescope --hp /home/onescope

pnpm run save
```

#### Manage the server

```bash
pnpm run stop      # Stop the server
pnpm run restart   # Restart the server
pnpm run logs      # View logs
pnpm run status    # Check status
```

**Note**: When switching modes (e.g. headed → headless), stop and delete the process first:

```bash
pnpm run stop
pm2 delete onescope-agent
pnpm run start:headless:no-extract
```

Browser-based login to ChatGPT is required on first run. Your session will be saved for subsequent runs.

---

## ENV CHANGES 

Run this command, to reflect env changes.

```bash
pm2 kill
rm -rf ~/.pm2
```

## Use Existing Browser Session

Run this command, to open existing chats and debug extraction in isolation.

```bash
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
  --remote-debugging-port=9222 \
  --user-data-dir=/tmp/onescope-dev \
  --no-first-run \
  --no-default-browser-check
```

## Notes

- **Detection**: Headed mode is more reliable and less likely to trigger captchas
- **UI Changes**: The agent relies on UI selectors; breaking changes may require updates


pkill -f xpra || true
pkill -f chromium || true
pkill -f Xvfb || true

XPRA_LOG="keyboard=debug,mouse=debug" \
xpra start \
  --bind-tcp=0.0.0.0:14500 \
  --html=on \
  --daemon=no \
  --exit-with-children \
  --start-child="chromium-browser --no-sandbox https://www.chatgpt.com/auth/login"

./chisel server --port 8080 --reverse

./chisel client 82.208.23.245:8080 R:1080:socks