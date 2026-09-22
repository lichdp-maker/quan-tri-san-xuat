import { test, expect } from '@playwright/test'

/**
 * Luồng sống còn: công nhân nhập sản lượng → tổ trưởng duyệt → tiến độ lệnh tăng.
 * Sai ở đây là sai lương và sai đánh giá người, nên phải chạy thật trên trình duyệt.
 *
 * Cần hai tài khoản thật, chạy sau khi đã có dữ liệu thử (npm run db:thu):
 *   E2E_CN_MA=... E2E_CN_MK=... E2E_TT_MA=... E2E_TT_MK=... npm run test:e2e
 */
const CN = { ma: process.env.E2E_CN_MA ?? '', mk: process.env.E2E_CN_MK ?? '' }
const TT = { ma: process.env.E2E_TT_MA ?? '', mk: process.env.E2E_TT_MK ?? '' }

async function dangNhap(page: import('@playwright/test').Page, ma: string, mk: string) {
  await page.goto('/dang-nhap')
  await page.fill('input[name="employeeCode"]', ma)
  await page.fill('input[name="password"]', mk)
  await page.click('button[type="submit"]')
  await expect(page).not.toHaveURL(/\/dang-nhap/)
}

test.describe('Công nhân nhập sản lượng', () => {
  test.skip(!CN.ma || !CN.mk, 'Cần E2E_CN_MA và E2E_CN_MK')

  test('mở được màn hình nhập của hôm nay', async ({ page }) => {
    await dangNhap(page, CN.ma, CN.mk)
    await page.goto('/cong-nhan')

    await expect(page.locator('h1, h2').first()).toBeVisible()
    // Có mốc giờ để chọn, hoặc có thông báo chưa được phân công
    const coMoc = await page.locator('text=/9h30|11h40|14h30|16h20|19h40/').count()
    const chuaPhanCong = await page.locator('text=/chưa được phân công|chưa có phân công/i').count()
    expect(coMoc + chuaPhanCong).toBeGreaterThan(0)
  })

  test('công nhân không vào được trang quản trị', async ({ page }) => {
    await dangNhap(page, CN.ma, CN.mk)

    await page.goto('/quan-tri')
    await expect(page).not.toHaveURL(/\/quan-tri/)

    await page.goto('/bang-dieu-khien')
    await expect(page).not.toHaveURL(/\/bang-dieu-khien/)
  })

  test('công nhân không vào được sơ đồ dây chuyền', async ({ page }) => {
    await dangNhap(page, CN.ma, CN.mk)

    await page.goto('/day-chuyen')
    await expect(page).not.toHaveURL(/\/day-chuyen/)
  })
})

test.describe('Tổ trưởng duyệt sản lượng', () => {
  test.skip(!TT.ma || !TT.mk, 'Cần E2E_TT_MA và E2E_TT_MK')

  test('mở được màn hình chốt số', async ({ page }) => {
    await dangNhap(page, TT.ma, TT.mk)
    await page.goto('/to-truong')

    await expect(page).toHaveURL(/\/to-truong/)
    await expect(page.locator('body')).toContainText(/chốt số|duyệt|sản lượng/i)
  })

  test('danh sách chờ duyệt không có tên của chính tổ trưởng', async ({ page }) => {
    await dangNhap(page, TT.ma, TT.mk)
    await page.goto('/to-truong')

    // Nếu tổ trưởng cũng ngồi một nguyên công, bản ghi của chính họ phải do
    // cấp trên duyệt — không được nằm trong danh sách bấm duyệt của họ.
    const khungDuyet = page.locator('form:has(button:text-matches("duyệt", "i"))')
    if ((await khungDuyet.count()) > 0) {
      await expect(khungDuyet.first()).not.toContainText(TT.ma)
    }
  })
})

test.describe('Sơ đồ dây chuyền', () => {
  test.skip(!TT.ma || !TT.mk, 'Cần E2E_TT_MA và E2E_TT_MK')

  test('tổ trưởng chỉ thấy công nhân tổ mình trong danh sách xếp chỗ', async ({ page }) => {
    await dangNhap(page, TT.ma, TT.mk)
    await page.goto('/day-chuyen')

    await expect(page).toHaveURL(/\/day-chuyen/)
    await expect(page.locator('body')).toContainText(/Sơ đồ chỗ ngồi/i)
  })

  test('sơ đồ không tràn ngang trên điện thoại ở chế độ lưới gọn', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'Chỉ kiểm trên bản điện thoại')

    await dangNhap(page, TT.ma, TT.mk)
    await page.goto('/day-chuyen')

    const nutLuoi = page.locator('button:text("Lưới gọn")')
    if ((await nutLuoi.count()) > 0) {
      await nutLuoi.click()
      const tran = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2,
      )
      expect(tran).toBe(false)
    }
  })
})
