#!/bin/bash
set -e

echo "Starting AI Agent Analytics Metrics Service..."

# Start cron daemon for daily scraping
echo "Starting cron daemon..."
service cron start

# Function to run livebench scraper
run_livebench_scraper() {
    echo "Running LiveBench scraper..."
    cd /app/livebench
    
    # Set the output directory to match METRICS_BASE_PATH
    export HOME=/data
    
    # Check if Playwright browsers are available
    if ! playwright install --help > /dev/null 2>&1; then
        echo "Warning: Playwright is not available. Skipping LiveBench scraping."
        return 1
    fi
    
    # Try to install browsers if not already present
    if [ ! -d "/root/.cache/ms-playwright/chromium_headless_shell-1169" ]; then
        echo "Playwright browsers not found. Attempting to install..."
        if ! playwright install chromium; then
            echo "Warning: Failed to install Playwright browsers. This may be due to SSL certificate issues in restricted environments."
            echo "LiveBench scraping will be skipped. The metrics service will run with limited functionality."
            return 1
        fi
    fi
    
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
        return 0
    else
        echo "Warning: LiveBench scraper failed, metrics service will run with limited functionality"
        return 1
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