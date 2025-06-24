#!/bin/bash
set -e

echo "$(date): Starting daily LiveBench scraper..."

# Set working directory and environment
cd /app/livebench
export HOME=/data

# Install playwright browsers if not already installed
if [ ! -d "/root/.cache/ms-playwright" ]; then
    echo "$(date): Installing Playwright browsers..."
    playwright install chromium || echo "$(date): Warning: Failed to install Playwright browsers"
fi

# Run the livebench scraper
if python download.py; then
    echo "$(date): LiveBench scraper completed successfully"
    
    # Update symlink if needed
    if [ -d "/data/.analytics/livebench/leaderboard" ]; then
        if [ ! -L "/data/livebench/leaderboard" ]; then
            ln -sf /data/.analytics/livebench/leaderboard /data/livebench/leaderboard
        fi
    fi
else
    echo "$(date): Warning: Daily LiveBench scraper failed"
fi

echo "$(date): Daily scrape completed"