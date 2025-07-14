# Analytics Dashboard Test Application

This is a minimal TypeScript application that demonstrates how to use the `@nearai/analytics-dashboard` npm package and serves as a test for its correctness.

## Overview

The application integrates the Analytics Dashboard with a specific model comparison configuration:

```tsx
<Dashboard config={{
  views: ['model_comparison'],
  metrics_service_url: 'http://localhost:8000/api/v1/',
  viewConfigs: {
    model_comparison: {
      view_type: 'table',
      view_name: 'Compare Models',
      metricSelection: 'COMPARE_MODELS',
      refreshRate: undefined
    }
  }
}} />
```

## Prerequisites

- Node.js 23+ and npm
- The metrics service running at `http://localhost:8000` (for the dashboard to display data)

## Installation and Running

1. Install dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npm run build
npm run dev
```

3. Open your browser and navigate to the URL shown in the terminal (typically `http://localhost:5173`)

## Testing NPM Package Correctness

To test the correctness of the published npm package, you can use this application by switching to the published version:

### For Testing Published Package

1. Update the dependency in `package.json`:
```json
"@nearai/analytics-dashboard": "^0.1.5"
```

2. Reinstall dependencies:
```bash
rm -rf node_modules package-lock.json
npm upgrade
npm install
```

3. Test the build:
```bash
npm run build
npm run dev
```

**Note**: The current configuration uses the local file version for development. Once the updated dashboard package is published with proper exports, the test can use the published version.
