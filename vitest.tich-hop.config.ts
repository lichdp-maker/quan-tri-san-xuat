import { defineConfig } from 'vitest/config'
import path from 'node:path'

/**
 * Test tích hợp — chạy trên CSDL test thật, không mock Prisma.
 *
 * Cần tệp .env.test có DATABASE_URL_TEST trỏ vào một CSDL RIÊNG.
 * tests/moi-truong.ts từ chối chạy nếu URL không nhận ra được là CSDL test,
 * vì bộ test xoá sạch bảng trước mỗi lần chạy.
 *
 * Chạy tuần tự: các test dùng chung một CSDL nên chạy song song sẽ giẫm chân nhau.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    setupFiles: ['./tests/moi-truong.ts'],
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 30_000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['app/**/actions.ts'],
      exclude: ['**/*.test.ts'],
      // Ngưỡng đặt theo phần thật sự đáng bảo vệ: phân quyền và bộ đếm tiến độ.
      // Các nhánh còn lại (tạo lệnh, sửa định mức) chưa có test tích hợp — nâng
      // dần khi thêm test, đừng hạ ngưỡng để cho qua.
      thresholds: {
        statements: 45,
        branches: 60,
        functions: 40,
        lines: 45,
      },
    },
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, '.') },
  },
})
