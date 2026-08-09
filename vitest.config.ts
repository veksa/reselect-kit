import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['src/**/*.ts'],
      // Benchmarks are not run by `vitest run`, so counting them only dilutes
      // the number the report exists to give.
      exclude: ['src/**/*.test.ts', 'src/**/*.bench.ts', 'src/__data__/**', 'src/index.ts'],
    },
  },
});
