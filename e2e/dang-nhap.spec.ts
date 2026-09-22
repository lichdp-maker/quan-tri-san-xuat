import { test, expect } from '@playwright/test'

/**
 * Cổng vào hệ thống. Đây là chỗ duy nhất người ngoài chạm tới được,
 * nên mọi hành vi bảo mật ở đây phải có test chạy thật trên trình duyệt.
 *
 * Cần biến môi trường để biết một tài khoản thật mà thử:
 *   E2E_MA=EMIC1053  E2E_MK=<mat khau that>  npm run test:e2e
 */
const MA = process.env.E2E_MA ?? ''
const MK = process.env.E2E_MK ?? ''

test.describe('Trang đăng nhập', () => {
  test('chưa đăng nhập thì mọi đường dẫn đều đá về trang đăng nhập', async ({ page }) => {
    for (const duong of ['/', '/cong-nhan', '/to-truong', '/bang-dieu-khien', '/quan-tri']) {
      await page.goto(duong)
      await expect(page).toHaveURL(/\/dang-nhap/)
    }
  })

  test('sai mật khẩu và sai mã nhân viên cho ra CÙNG một thông báo', async ({ page }) => {
    await page.goto('/dang-nhap')

    await page.fill('input[name="employeeCode"]', 'KHONGCOMA99')
    await page.fill('input[name="password"]', 'saibet123')
    await page.click('button[type="submit"]')
    const loiSaiMa = await page.locator('text=/không đúng/i').first().textContent()

    await page.goto('/dang-nhap')
    await page.fill('input[name="employeeCode"]', MA || 'EMIC1053')
    await page.fill('input[name="password"]', 'chac-chan-sai-999')
    await page.click('button[type="submit"]')
    const loiSaiMk = await page.locator('text=/không đúng/i').first().textContent()

    // Khác nhau là lộ mã nào có thật trong hệ thống
    expect(loiSaiMa?.trim()).toBe(loiSaiMk?.trim())
  })

  test('không nhìn thấy họ tên đầy đủ khi dò mã nhân viên', async ({ page }) => {
    await page.goto('/dang-nhap')
    await page.fill('input[name="employeeCode"]', MA || 'EMIC1053')
    await page.waitForTimeout(1200) // chờ tra tên

    const chu = await page.locator('body').innerText()
    // Tên hiện ra phải là dạng rút gọn "N. T. T. Hà", không phải họ tên đầy đủ
    expect(chu).not.toMatch(/Nguyễn\s+Thị\s+\w+\s+\w+/)
  })

  test('cookie phiên là HttpOnly và không đọc được từ JavaScript', async ({ page, context }) => {
    test.skip(!MA || !MK, 'Cần E2E_MA và E2E_MK để đăng nhập thật')

    await page.goto('/dang-nhap')
    await page.fill('input[name="employeeCode"]', MA)
    await page.fill('input[name="password"]', MK)
    await page.click('button[type="submit"]')
    await expect(page).not.toHaveURL(/\/dang-nhap/)

    const cookies = await context.cookies()
    const phien = cookies.find((c) => c.name === 'phien')

    expect(phien).toBeDefined()
    expect(phien?.httpOnly).toBe(true)
    expect(phien?.sameSite).toBe('Lax')

    const doDuoc = await page.evaluate(() => document.cookie)
    expect(doDuoc).not.toContain('phien')
  })

  test('đăng xuất rồi thì quay lại không vào được nữa', async ({ page }) => {
    test.skip(!MA || !MK, 'Cần E2E_MA và E2E_MK để đăng nhập thật')

    await page.goto('/dang-nhap')
    await page.fill('input[name="employeeCode"]', MA)
    await page.fill('input[name="password"]', MK)
    await page.click('button[type="submit"]')
    await expect(page).not.toHaveURL(/\/dang-nhap/)

    await page.click('text=/đăng xuất/i')
    await expect(page).toHaveURL(/\/dang-nhap/)

    await page.goBack()
    await page.goto('/cong-nhan')
    await expect(page).toHaveURL(/\/dang-nhap/)
  })
})

test.describe('Header bảo mật', () => {
  test('máy chủ trả đủ header bảo mật', async ({ request }) => {
    const res = await request.get('/dang-nhap')
    const h = res.headers()

    expect(h['x-frame-options']).toBe('DENY')
    expect(h['x-content-type-options']).toBe('nosniff')
    expect(h['referrer-policy']).toBe('strict-origin-when-cross-origin')
    expect(h['strict-transport-security']).toContain('max-age=')
    expect(h['x-powered-by']).toBeUndefined()
  })
})
