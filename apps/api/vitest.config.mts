import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

// SWC is required so Nest's decorator metadata (emitDecoratorMetadata) survives the test transform.
export default defineConfig({
  test: { globals: false, environment: 'node', include: ['src/**/*.spec.ts', 'test/**/*.e2e-spec.ts'] },
  plugins: [swc.vite({ module: { type: 'es6' } })],
});
