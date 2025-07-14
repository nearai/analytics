import fs from 'fs';
import postcss from 'postcss';
import tailwindcss from 'tailwindcss';
import autoprefixer from 'autoprefixer';
import prefixwrap from 'postcss-prefixwrap';

const css = `
@tailwind base;
@tailwind components;
@tailwind utilities;

/* Your custom styles */
::-webkit-scrollbar { width: 8px; height: 8px; }
::-webkit-scrollbar-track { background: #f3f4f6; }
::-webkit-scrollbar-thumb { background: #d1d5db; border-radius: 4px; }
::-webkit-scrollbar-thumb:hover { background: #9ca3af; }
`;

postcss([
  tailwindcss(),
  autoprefixer(),
  prefixwrap('.analytics-dashboard')
])
  .process(css, { from: undefined })
  .then(result => {
    const cssString = result.css.replace(/\n/g, '\\n').replace(/"/g, '\\"');
    const output = `export const DASHBOARD_CSS = "${cssString}";`;
    fs.writeFileSync('src/dashboard-styles.ts', output);
  });