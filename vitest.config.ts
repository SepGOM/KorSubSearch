import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'node:path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  ssr: {
    // vitest 번들러가 실험적 내장 모듈 node:sqlite 를 "sqlite" 로 잘못 해석해
    // 외부 패키지로 찾으려는 문제 회피 — 항상 Node의 실제 내장 모듈을 쓰게 한다.
    external: ['node:sqlite'],
  },
  optimizeDeps: {
    exclude: ['node:sqlite'],
  },
  test: {
    server: {
      deps: {
        external: ['node:sqlite'],
      },
    },
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/unit/**/*.test.ts', 'tests/unit/**/*.test.tsx', 'tests/integration/**/*.test.ts'],
  },
})
