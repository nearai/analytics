import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import typescript from '@rollup/plugin-typescript';
import postcss from 'rollup-plugin-postcss';
import { readFileSync } from 'fs';
import tailwindcss from 'tailwindcss';
import autoprefixer from 'autoprefixer';

const packageJson = JSON.parse(readFileSync('./package.json', 'utf8'));

export default {
  input: 'src/components/index.ts',
  output: [
    {
      file: 'dist/index.cjs',  // Fixed: Use .cjs extension
      format: 'cjs',
      sourcemap: true,
      exports: 'named'
    },
    {
      file: 'dist/index.esm.js',  // Keep as .esm.js
      format: 'esm',
      sourcemap: true,
    },
  ],
  external: [
    // CRITICAL: Don't bundle React internals
    'react',
    'react-dom',
    'react/jsx-runtime',
    'react/jsx-dev-runtime',
    // Dependencies
    'lucide-react',
    'recharts',
  ],
  plugins: [
    // Handle CSS imports - CRITICAL: extract must be true
    postcss({
      extract: true,  // This ensures CSS is extracted
      minimize: true,
      plugins: [
        tailwindcss,
        autoprefixer,
      ],
    }),
    
    resolve({
      browser: true,
      preferBuiltins: false,
    }),
    
    commonjs(),
    
    typescript({
      tsconfig: './tsconfig.build.json',
      declaration: true,
      declarationDir: 'dist',
      exclude: ['**/*.test.*', '**/*.stories.*'],
    }),
  ],
};
