#!/bin/bash
set -e

echo "Starting AI Agent Analytics Metrics Service..."

# Start cron daemon for daily scraping
echo "Starting cron daemon..."
service cron start

# Install playwright browsers if not already installed
if [ ! -d "/root/.cache/ms-playwright" ]; then
    echo "Installing Playwright browsers..."
    playwright install chromium || echo "Warning: Failed to install Playwright browsers"
fi

# Function to run livebench scraper
run_livebench_scraper() {
    echo "Running LiveBench scraper..."
    cd /app/livebench
    
    # Set the output directory to match METRICS_BASE_PATH
    export HOME=/data
    
    # Run the scraper
    if python download.py; then
        echo "LiveBench scraper completed successfully"
        
        # Check if data was created
        if [ -d "/data/.analytics/livebench/leaderboard" ]; then
            echo "Found LiveBench data, setting up metrics path..."
            # Create symlink if not already exists
            if [ ! -L "/data/livebench/leaderboard" ]; then
                ln -sf /data/.analytics/livebench/leaderboard /data/livebench/leaderboard
            fi
        fi
    else
        echo "Warning: LiveBench scraper failed, metrics service will run with limited functionality"
    fi
}

# Run initial scraping
run_livebench_scraper

# Start the metrics service
echo "Starting metrics service..."
cd /app/canonical_metrics

# Set PYTHONPATH to include the src directory
export PYTHONPATH="/app/canonical_metrics/src:$PYTHONPATH"

# Run the metrics service
exec python -m metrics_service