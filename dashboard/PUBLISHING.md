# Publishing Guide

This guide explains how to publish the `@nearai/analytics-dashboard` package to npm.

## Prerequisites

1. **NPM Token**: A maintainer must add an `NPM_TOKEN` secret to the GitHub repository settings
   - Go to GitHub repository → Settings → Secrets and variables → Actions
   - Add a new repository secret named `NPM_TOKEN`
   - The token value should be from an npm account with publish permissions to the `@nearai` organization

2. **npm Account Setup**: The npm token must be from an account that has access to publish to the `@nearai` scope

## Publishing Process

Publishing is automated via GitHub Actions. To publish a new version:

1. **Update the version** in `package.json`:
   ```bash
   cd dashboard
   npm version patch|minor|major
   ```

2. **Push the version tag**:
   ```bash
   git push origin main --tags
   ```

3. **Automatic Publishing**: The GitHub workflow will:
   - Build the package
   - Update package.json for npm publishing
   - Publish to npm registry as `@nearai/analytics-dashboard`
   - Create a GitHub release

## What Gets Published

The published package includes:
- Built React components in the `build/` directory
- Source TypeScript components in `src/components/`
- README.md and documentation

## Manual Publishing (Emergency)

If automatic publishing fails, you can publish manually:

```bash
cd dashboard
npm ci
npm run build

# Publish (requires NPM_TOKEN environment variable)
npm publish --access public
```

## Troubleshooting

- **403 Forbidden**: Check that the npm token has correct permissions for the `@nearai` scope
- **Version already exists**: Increment the version number in package.json
- **Build failures**: Ensure all dependencies are properly installed and the build succeeds locally

## Usage After Publishing

Once published, other projects can install and use the package:

```bash
npm install @nearai/analytics-dashboard
```

```jsx
import { Dashboard } from '@nearai/analytics-dashboard';
```

See [WEB_COMPONENT_USAGE.md](./WEB_COMPONENT_USAGE.md) for detailed usage documentation.