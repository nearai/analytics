# Analytics Dashboard Test Application

This is a minimal TypeScript application that demonstrates how to use the `@nearai/analytics-dashboard` npm package and serves as a test for its correctness.

## Overview

The application integrates the Analytics Dashboard with a specific model comparison configuration:

```tsx
<Dashboard config={{
  views: ['model_comparison'],
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

- Node.js 16+ and npm
- The metrics service running at `http://localhost:8000` (for the dashboard to display data)

## Installation and Running

1. Install dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npm run dev
```

3. Open your browser and navigate to the URL shown in the terminal (typically `http://localhost:5173`)

## Building for Production

To create a production build:

```bash
npm run build
```

The build files will be in the `dist/` directory.

## Usage as Integration Example

This application serves as a practical example of:

1. **Installing the package**: `npm install @nearai/analytics-dashboard`
2. **Importing the component**: `import { Dashboard } from '@nearai/analytics-dashboard'`
3. **Including styles**: `import '@nearai/analytics-dashboard/style.css'`
4. **Configuring the dashboard**: Using the Dashboard component with proper TypeScript configuration
5. **Model comparison setup**: Demonstrating the COMPARE_MODELS metric selection

## Testing NPM Package Correctness

This application validates that:
- The published npm package can be installed correctly
- The Dashboard component can be imported and used
- TypeScript types are properly exported
- CSS styles are included and functional
- The model comparison configuration works as expected

## Notes

- Ensure your metrics service is running before testing the dashboard functionality
- The dashboard requires data from the metrics API to display meaningful content
- This example focuses on model comparison but the dashboard supports many other configurations

## Local Development Testing

For testing local changes to the dashboard package before publishing:

1. Change the dependency in `package.json` to use the local version:
```json
"@nearai/analytics-dashboard": "file:../dashboard"
```

2. Rebuild the dashboard package:
```bash
cd ../dashboard && npm run build
```

3. Reinstall dependencies and test:
```bash
rm -rf node_modules package-lock.json
npm install
npm run build
```