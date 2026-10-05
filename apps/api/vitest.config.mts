import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

// SWC is required so Nest's decorator metadata (emitDecoratorMetadata) survives the test transform.
export default defineConfig({
  test: { globals: false, environment: 'node', include: ['src/**/*.spec.ts', 'test/**/*.e2e-spec.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      // Wiring and declarations carry no logic worth measuring.
      exclude: [
        'src/main.ts',
        'src/**/*.module.ts',
        'src/**/*.dto.ts',
        'src/**/*.entity.ts',
        'src/**/*.port.ts',
        'src/database/migrations/**',
        'src/database/seeds/**',
        'src/database/entities.ts',
        'src/**/*.spec.ts',
      ],
    },
  },
  plugins: [swc.vite({ module: { type: 'es6' } })],
});
