import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    fileParallelism: false,
    env: {
      USE_MOCK_AGENT: 'true',
    },
    coverage: {
      provider: 'v8',
      include: ['src/**'],
      exclude: ['src/index.ts', 'src/types/**'],
    },
  },
  ssr: {
    external: ['node:sqlite'],
  },
});
