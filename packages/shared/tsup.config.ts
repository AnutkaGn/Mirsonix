import { defineConfig } from 'tsup';

export default defineConfig((options) => ({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  // Cleaning in watch mode briefly empties dist and breaks consumers that are mid-compile.
  clean: !options.watch,
  sourcemap: true,
}));
