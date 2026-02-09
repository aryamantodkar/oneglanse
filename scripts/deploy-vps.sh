#!/bin/bash
set -e

echo "🚀 Starting OneScope VPS Deployment..."

# Pull latest images from GitHub Container Registry
echo "📥 Pulling latest Docker images..."
docker compose pull

# Stop and remove old containers
echo "🛑 Stopping existing containers..."
docker compose down

# Start services with new images
echo "✅ Starting services with latest images..."
docker compose up -d

# Wait for services to be healthy
echo "⏳ Waiting for services to start..."
sleep 5

# Show running containers
echo ""
echo "📊 Running containers:"
docker compose ps

# Clean up dangling images to save disk space
echo ""
echo "🧹 Cleaning up unused images..."
docker image prune -f

echo ""
echo "✨ Deployment complete!"
echo ""
echo "📝 Useful commands:"
echo "  - View logs: docker compose logs -f [service]"
echo "  - Check status: docker compose ps"
echo "  - Run migrations: docker compose run --rm migrate"
