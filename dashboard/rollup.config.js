import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import typescript from '@rollup/plugin-typescript';
import { readFileSync } from 'fs';

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
    typescript({
      tsconfig: './tsconfig.build.json',
      declaration: true,
      declarationDir: 'dist',
      rootDir: 'src',
      exclude: ['**/*.test.*', '**/*.stories.*'],
    }),
    
    resolve({
      browser: true,
      preferBuiltins: false,
    }),
    
    commonjs(),
  ],
};
