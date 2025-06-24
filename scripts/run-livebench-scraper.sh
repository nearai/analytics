#!/bin/bash
# Utility script to run the LiveBench scraper manually in a Docker container

set -e

echo "Running LiveBench scraper manually..."

if ! docker compose ps | grep -q "analytics-metrics-service-1"; then
    echo "Error: metrics-service container is not running"
    echo "Please start it first with: docker compose up -d"
    exit 1
fi

echo "Executing scraper in running container..."
docker compose exec metrics-service /app/scripts/daily-scrape.sh

echo "Done! Check container logs for details:"
echo "  docker compose logs -f"