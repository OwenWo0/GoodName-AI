import { defineConfig } from 'vitest/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  // vitest 4 = rolldown-vite：JSX 转译走 oxc，esbuild.jsx 会被静默忽略。
  // tsconfig jsx=preserve 下，缺此配置则 import-analysis 拒收含 JSX 的 .tsx（组件测试载不入）。
  oxc: { jsx: 'automatic' },
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
