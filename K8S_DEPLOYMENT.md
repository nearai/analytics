# Kubernetes Deployment Guide

This document explains how to deploy the AI Agent Analytics service to Kubernetes using the provided manifest.

## Prerequisites

- Kubernetes cluster with AWS Load Balancer Controller installed
- Access to the `production` namespace
- The ECR image `543900120763.dkr.ecr.us-west-2.amazonaws.com/prod-analytics-service:latest` should be available

## Deployment

Apply the manifest to your cluster:

```bash
kubectl apply -f k8s-manifest.yaml
```

## What's Deployed

The manifest creates three resources:

1. **Deployment** (`analytics-service`):
   - Single replica of the analytics service
   - Runs on port 8000
   - Includes readiness and liveness probes on `/health` endpoint
   - Resource limits: 1 CPU, 1Gi memory (requests: 500m CPU, 512Mi memory)

2. **Service** (`analytics-service`):
   - Exposes the deployment on port 8000
   - Load balances traffic to the pods

3. **Ingress** (`analytics-service-ingress`):
   - Uses AWS Application Load Balancer
   - Terminates SSL with the provided certificate
   - Routes traffic from `analytics-service.devingtools.com` to the service

## Verification

Check the deployment status:

```bash
# Check pods
kubectl get pods -n production -l app=analytics-service

# Check service
kubectl get svc -n production analytics-service

# Check ingress
kubectl get ingress -n production analytics-service-ingress

# Check logs
kubectl logs -n production -l app=analytics-service -f
```

## Health Checks

The service provides health endpoints:

- **Health check**: `GET /health`
- **API documentation**: `GET /api/v1/docs`
- **Root endpoint**: `GET /`

## Key Configuration

- **Port**: Service runs on port 8000
- **Health endpoints**: Uses `/health` for probes
- **Environment**: Configured with HOST=0.0.0.0, PORT=8000, LOG_LEVEL=info
- **SSL**: Automatically redirects HTTP to HTTPS on port 443

## Troubleshooting

If the service doesn't start:

1. Check pod logs: `kubectl logs -n production -l app=analytics-service`
2. Verify the ECR image is accessible
3. Check if the `production` namespace exists
4. Ensure AWS Load Balancer Controller is running in the cluster
