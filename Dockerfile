# Dockerfile for NEAR AI Analytics Metrics Service
FROM python:3.12-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    wget \
    build-essential \
    git \
    cron \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy requirements and install Python dependencies directly
COPY requirements.txt /app/
RUN pip install --trusted-host pypi.org --trusted-host pypi.python.org --trusted-host files.pythonhosted.org -r requirements.txt

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
ENV METRICS_BASE_PATH=/data/livebench/leaderboard \
    HOST=0.0.0.0 \
    PORT=8000 \
    PYTHONPATH=/app

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:8000/api/v1/docs || exit 1

# Start cron and run initialization script
CMD ["/app/scripts/init.sh"]