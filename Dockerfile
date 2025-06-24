# Dockerfile for AI Agent Analytics Metrics Service
FROM python:3.12-slim

# Install system dependencies including Playwright dependencies
RUN apt-get update && apt-get install -y \
    curl \
    wget \
    build-essential \
    git \
    cron \
    ca-certificates \
    libglib2.0-0 \
    libnss3 \
    libnspr4 \
    libdbus-1-3 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libxkbcommon0 \
    libatspi2.0-0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libpango-1.0-0 \
    libcairo2 \
    libasound2 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy requirements and install Python dependencies directly
COPY requirements.txt /app/
RUN pip install --trusted-host pypi.org --trusted-host pypi.python.org --trusted-host files.pythonhosted.org -r requirements.txt

# Install Playwright browsers (may fail in environments with SSL issues)
RUN playwright install-deps || echo "Warning: Failed to install Playwright system dependencies"
RUN playwright install chromium || echo "Warning: Failed to install Playwright browsers due to SSL certificate issues"

# Copy source code
COPY canonical_metrics/ /app/canonical_metrics/
COPY integrations/livebench/scrape_livebench_scores/ /app/livebench/

# Copy scripts
COPY scripts/ /app/scripts/

# Create data directory structure
RUN mkdir -p /data/livebench/leaderboard

# Set up cron for daily scraping
RUN chmod +x /app/scripts/daily-scrape.sh && \
    echo "0 2 * * * /app/scripts/daily-scrape.sh >> /var/log/livebench-scrape.log 2>&1" | crontab -

# Create startup script
RUN chmod +x /app/scripts/init.sh

# Expose metrics service port
EXPOSE 8000

# Set environment variables
ENV HOST=0.0.0.0 \
    PORT=8000 \
    PYTHONPATH=/app

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:8000/api/v1/docs || exit 1

# Start cron and run initialization script
CMD ["/app/scripts/init.sh"]