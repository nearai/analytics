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
    
    # Check if Playwright browsers are available in the correct location
    if ! playwright install --help > /dev/null 2>&1; then
        echo "Warning: Playwright is not available. Skipping LiveBench scraping."
        return 1
    fi
    
    # Check for browsers in the default Playwright cache location
    PLAYWRIGHT_CACHE_DIR="/root/.cache/ms-playwright"
    if [ ! -d "$PLAYWRIGHT_CACHE_DIR" ] || [ -z "$(ls -A $PLAYWRIGHT_CACHE_DIR 2>/dev/null)" ]; then
        echo "Playwright browsers not found in $PLAYWRIGHT_CACHE_DIR. Attempting to install..."
        if ! playwright install chromium; then
            echo "Warning: Failed to install Playwright browsers. This may be due to SSL certificate issues in restricted environments."
            echo "LiveBench scraping will be skipped. The metrics service will run with limited functionality."
            return 1
        fi
    fi
    
    # Set environment variables for the scraper
    # Keep HOME as /root so Playwright can find browsers, but set custom output path via env var
    export LIVEBENCH_OUTPUT_DIR="/data/.analytics/livebench/leaderboard"
    export PLAYWRIGHT_BROWSERS_PATH="/root/.cache/ms-playwright"
    
    # Create output directory
    mkdir -p "$LIVEBENCH_OUTPUT_DIR"
    
    # Run the scraper with explicit browser path
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
cd /app/metrics_service

# Set PYTHONPATH to include the src directory
export PYTHONPATH="/app/metrics_service/src:$PYTHONPATH"

# Run the metrics service
exec python -m metrics_service