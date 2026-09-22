import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['lib/**/*.test.ts', 'app/**/*.test.ts', 'tests/**/*.test.ts'],
    // Playwright chạy riêng bằng npm run test:e2e
    exclude: ['node_modules/**', 'e2e/**', '.next/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      // Chỉ tính phần logic: công thức, ngày giờ, mật khẩu, server action.
      // Không tính JSX hiển thị — test nó tốn công mà bắt được ít lỗi.
      include: ['lib/**/*.ts', 'app/**/actions.ts'],
      exclude: ['lib/prisma.ts', '**/*.test.ts'],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 75,
        statements: 80,
      },
    },
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, '.') },
  },
})
