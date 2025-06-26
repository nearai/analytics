import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import typescript from '@rollup/plugin-typescript';
import postcss from 'rollup-plugin-postcss';
import { readFileSync } from 'fs';
import tailwindcss from 'tailwindcss';
import autoprefixer from 'autoprefixer';

// Read package.json to get external dependencies
const packageJson = JSON.parse(readFileSync('./package.json', 'utf8'));

export default {
  input: 'src/components/index.ts',
  output: [
    {
      file: 'dist/index.js',
      format: 'cjs',
      sourcemap: true,
    },
    {
      file: 'dist/index.esm.js',
      format: 'esm',
      sourcemap: true,
    },
  ],
  external: [
    // Don't bundle React, ReactDOM, or other peer dependencies
    ...Object.keys(packageJson.peerDependencies || {}),
    // Don't bundle regular dependencies either - they'll be installed separately
    ...Object.keys(packageJson.dependencies || {}),
  ],
  plugins: [
    // Handle CSS imports
    postcss({
      extract: 'index.css', // Extract CSS to separate file
      minimize: true,
      plugins: [
        tailwindcss,
        autoprefixer,
      ],
    }),
    
    // Resolve node modules
    resolve({
      browser: true,
      preferBuiltins: false,
    }),
    
    // Convert CommonJS to ES modules
    commonjs(),
    
    // Compile TypeScript
    typescript({
      tsconfig: './tsconfig.json',
      declaration: true,
      declarationDir: 'dist',
      rootDir: 'src',
      exclude: ['**/*.test.*', '**/*.stories.*'],
    }),
  ],
};