import { defineConfig, devices } from '@playwright/test'

/**
 * E2E chạy trên bản build thật ở máy, không chạy trên Vercel:
 * test sẽ tạo và sửa dữ liệu, không để nó đụng vào CSDL đang dùng thật.
 *
 * Trước khi chạy:  npm run build
 * Chạy:            npm run test:e2e
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: { timeout: 7_000 },
  fullyParallel: false, // dùng chung một CSDL nên chạy tuần tự cho khỏi giẫm chân
  retries: process.env.CI ? 1 : 0,
  reporter: [['list']],

  use: {
    baseURL: process.env.E2E_URL ?? 'http://localhost:3000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    locale: 'vi-VN',
    timezoneId: 'Asia/Ho_Chi_Minh',
  },

  projects: [
    { name: 'may-tinh', use: { ...devices['Desktop Chrome'] } },
    { name: 'dien-thoai', use: { ...devices['Pixel 7'] } },
  ],

  webServer: process.env.E2E_URL
    ? undefined
    : {
        command: 'npm run start',
        url: 'http://localhost:3000/dang-nhap',
        reuseExistingServer: true,
        timeout: 120_000,
      },
})
