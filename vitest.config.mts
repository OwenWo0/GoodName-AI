import { defineConfig } from 'vitest/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    coverage: {
      provider: 'v8',
      include: ['src/lib/**/*.ts'],
      exclude: ['src/lib/types.ts'],
    },
  },
  resolve: {
    alias: { '@': path.resolve(fileURLToPath(import.meta.url), '..', 'src') },
  },
});
