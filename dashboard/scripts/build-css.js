import fs from 'fs';
import postcss from 'postcss';
import tailwindcss from 'tailwindcss';
import autoprefixer from 'autoprefixer';
import prefixwrap from 'postcss-prefixwrap';

const css = `
@tailwind base;
@tailwind components;
@tailwind utilities;

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
    'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue',
    sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

code {
  font-family: source-code-pro, Menlo, Monaco, Consolas, 'Courier New',
    monospace;
}

.analytics-dashboard {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

/* Apply box-sizing to all children */
.analytics-dashboard *,
.analytics-dashboard *::before,
.analytics-dashboard *::after {
  box-sizing: border-box;
}

::-webkit-scrollbar { 
  width: 8px; 
  height: 8px; 
}

::-webkit-scrollbar-track { 
  background: #f3f4f6; 
}

::-webkit-scrollbar-thumb { 
  background: #d1d5db; 
  border-radius: 4px; 
}

::-webkit-scrollbar-thumb:hover { 
  background: #9ca3af; 
}
`;

async function buildCSS() {
  try {
    console.log('Building dashboard CSS...');
    
    const result = await postcss([
      tailwindcss(),
      autoprefixer(),
      prefixwrap('.analytics-dashboard')
    ]).process(css, { from: undefined });

    // Properly escape the CSS for JavaScript string
    const cssString = result.css
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r');

    const output = `// Auto-generated file - do not edit manually
// Run 'npm run build-css' to regenerate
export const DASHBOARD_CSS = "${cssString}";
`;

    // Ensure the src directory exists
    if (!fs.existsSync('src')) {
      fs.mkdirSync('src', { recursive: true });
    }

    fs.writeFileSync('src/dashboard-styles.ts', output);
    console.log('✅ Dashboard CSS generated successfully at src/dashboard-styles.ts');
    
  } catch (error) {
    console.error('❌ Error building CSS:', error);
    process.exit(1);
  }
}

buildCSS();