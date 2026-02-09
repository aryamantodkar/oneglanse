#!/bin/bash
set -e

echo "🔧 OneScope VPS Initial Setup Script"
echo "====================================="
echo ""

# Check if running as root
if [ "$EUID" -eq 0 ]; then
   echo "⚠️  Please do not run as root. Use a regular user with sudo access."
   exit 1
fi

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi

# Check if Docker Compose is available
if ! docker compose version &> /dev/null; then
    echo "❌ Docker Compose is not available. Please install Docker Compose plugin."
    exit 1
fi

echo "✅ Docker and Docker Compose are installed"
echo ""

# Prompt for GitHub authentication
echo "📦 GitHub Container Registry Authentication"
echo "-------------------------------------------"
echo "You need a GitHub Personal Access Token (PAT) with 'read:packages' scope."
echo ""
echo "To create one:"
echo "1. Go to GitHub Settings → Developer settings → Personal access tokens"
echo "2. Create a new token (classic) with 'read:packages' scope"
echo "3. Copy the token"
echo ""

read -p "Enter your GitHub username: " GITHUB_USERNAME
read -sp "Enter your GitHub PAT: " GITHUB_PAT
echo ""

# Login to GitHub Container Registry
echo "🔐 Logging into GitHub Container Registry..."
echo "$GITHUB_PAT" | docker login ghcr.io -u "$GITHUB_USERNAME" --password-stdin

if [ $? -eq 0 ]; then
    echo "✅ Successfully authenticated with ghcr.io"
else
    echo "❌ Failed to authenticate with ghcr.io"
    exit 1
fi

echo ""

# Check if .env files exist
if [ ! -f .env ]; then
    echo "⚠️  .env file not found. Please create it from .env.example"
    echo "   cp .env.example .env"
    echo "   nano .env"
    exit 1
fi

if [ ! -f apps/agent/.env ]; then
    echo "⚠️  apps/agent/.env file not found. Please create it from apps/agent/.env.example"
    echo "   cp apps/agent/.env.example apps/agent/.env"
    echo "   nano apps/agent/.env"
    exit 1
fi

echo "✅ Environment files found"
echo ""

# Pull images
echo "📥 Pulling Docker images from GitHub Container Registry..."
docker compose pull

if [ $? -eq 0 ]; then
    echo "✅ Successfully pulled Docker images"
else
    echo "❌ Failed to pull Docker images"
    exit 1
fi

echo ""

# Start services
echo "🚀 Starting services..."
docker compose up -d

echo ""
echo "⏳ Waiting for services to start..."
sleep 10

# Check service status
echo ""
echo "📊 Service Status:"
docker compose ps

echo ""
echo "🔄 Running database migrations..."
docker compose run --rm migrate

echo ""
echo "✨ Initial setup complete!"
echo ""
echo "📝 Next steps:"
echo "  1. Check logs: docker compose logs -f"
echo "  2. Access web app: http://localhost:3000 (or your domain)"
echo "  3. Access agent API: http://localhost:3333"
echo ""
echo "📚 Useful commands:"
echo "  - View logs: docker compose logs -f [service]"
echo "  - Check status: docker compose ps"
echo "  - Deploy updates: ./scripts/deploy-vps.sh"
echo "  - Stop services: docker compose down"
echo ""
