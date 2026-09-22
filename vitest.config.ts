import { defineConfig } from 'vitest/config'
import path from 'node:path'

/**
 * Test đơn vị — logic thuần, không đụng CSDL, chạy trong vài giây.
 *
 * Ngưỡng coverage chỉ đặt cho lib/, vì đó là nơi chứa quyết định: công thức
 * năng suất, ngày giờ, mật khẩu, phân quyền. Server action nằm ở bộ tích hợp
 * (vitest.tich-hop.config.ts) vì chúng cần CSDL thật mới chạy có ý nghĩa —
 * đo coverage của chúng ở đây chỉ ra một con số 0 vô nghĩa.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['lib/**/*.test.ts'],
    exclude: ['node_modules/**', 'e2e/**', '.next/**', 'tests/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['lib/**/*.ts'],
      // prisma.ts chỉ khởi tạo client; session.ts đụng cookie và jose nên chỉ
      // chạy được trong Next — phần quyết định của nó đã tách sang quyen.ts.
      exclude: ['lib/prisma.ts', 'lib/session.ts', '**/*.test.ts'],
      thresholds: {
        statements: 90,
        branches: 85,
        functions: 90,
        lines: 90,
      },
    },
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, '.') },
  },
})
