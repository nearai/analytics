import { copyFileSync } from 'fs';

// Copy the main type declarations to the root level
copyFileSync('dist/components/index.d.ts', 'dist/index.d.ts');
console.log('TypeScript declarations copied successfully');