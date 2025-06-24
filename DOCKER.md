# AI Agent Analytics Metrics Service - Docker

This directory contains Docker configuration for running the AI Agent Analytics Metrics Service with automated LiveBench data scraping.

## Features

- **Metrics Service**: FastAPI service serving analytics data on port 8000
- **Automated LiveBench Scraping**: Downloads leaderboard data on startup and daily at 2 AM
- **Persistent Data**: LiveBench data is persisted using Docker volumes
- **Health Checks**: Built-in health monitoring
- **Minimal Configuration**: Works out of the box with sensible defaults

## Quick Start

### Using Docker Compose (Recommended)

```bash
# Build and start the service
docker compose up -d

# View logs
docker compose logs -f

# Check service status
docker compose ps

# Stop the service
docker compose down
```

The service will be available at: http://localhost:8000

### Using Docker CLI

```bash
# Build the image
docker build -t metrics-service .

# Run the container
docker run -d \
  --name metrics-service \
  -p 8000:8000 \
  -v livebench_data:/data \
  metrics-service

# View logs
docker logs -f metrics-service
```

## API Endpoints

Once running, visit:
- **Interactive API Documentation**: http://localhost:8000/api/v1/docs
- **Alternative Documentation**: http://localhost:8000/api/v1/redoc

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `HOST` | `0.0.0.0` | Service host |
| `PORT` | `8000` | Service port |
| `LOG_LEVEL` | `info` | Logging level |

**Note**: `METRICS_BASE_PATH` is not set by default. Performance metrics will be fetched from a service URL when configured. Evaluation metrics (LiveBench) are stored locally in `~/.analytics/livebench/leaderboard`.

### Custom Configuration

Create a `.env` file or override in docker-compose.yml:

```yaml
environment:
  # Performance metrics source (to be configured)
  # - PERFORMANCE_METRICS_URL=https://your-metrics-service.com/api
  - HOST=0.0.0.0
  - PORT=8000
  - LOG_LEVEL=debug
```

## Data Management

The service handles two types of metrics data:

### Performance Metrics
- Fetched from a service URL (to be configured)
- Not stored locally in Docker containers
- Endpoints will return errors until service URL is configured

### Evaluation Metrics (LiveBench)
- Initial scraping happens on container startup
- Daily scraping runs at 2 AM UTC via cron
- Data is stored in `~/.analytics/livebench/leaderboard` inside the container
- Symlinked to `/data/livebench/leaderboard` for access

### Persistent Storage

Evaluation data persists between container restarts using Docker volumes:

```bash
# Backup evaluation data
docker run --rm -v livebench_data:/data -v $(pwd):/backup alpine tar czf /backup/livebench-backup.tar.gz -C /data .

# Restore evaluation data
docker run --rm -v livebench_data:/data -v $(pwd):/backup alpine tar xzf /backup/livebench-backup.tar.gz -C /data
```

## Troubleshooting

### Check Service Health

```bash
# Using docker compose
docker compose exec metrics-service curl http://localhost:8000/api/v1/docs

# Using docker CLI
docker exec metrics-service curl http://localhost:8000/api/v1/docs
```

### View Scraper Logs

```bash
# Using docker compose
docker compose exec metrics-service tail -f /var/log/livebench-scrape.log

# Using docker CLI  
docker exec metrics-service tail -f /var/log/livebench-scrape.log
```

### Manual Scraping

```bash
# Run scraper manually
docker compose exec metrics-service /app/scripts/daily-scrape.sh
```

### Common Issues

1. **Service starts but no data**: Check if initial LiveBench scraping succeeded in logs
2. **Connection refused**: Ensure port 8000 is not in use by another service
3. **Playwright errors**: The container includes Chromium, but some network restrictions may apply

## Development

### Building from Source

```bash
# Development build with reload
docker build -t metrics-service:dev .
docker run -p 8000:8000 -e LOG_LEVEL=debug metrics-service:dev
```

### Local Development

For local development, see the individual README files:
- [Canonical Metrics](canonical_metrics/README.md)
- [LiveBench Scraper](integrations/livebench/scrape_livebench_scores/README.md)