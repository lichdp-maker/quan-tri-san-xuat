/**
 * Hàng rào này tồn tại vì hai tai nạn đã xảy ra thật khi dựng test:
 * dán nguyên chuỗi mẫu trong tài liệu, và suýt chạy migration lên CSDL sản xuất.
 */
import { describe, it, expect } from 'vitest'
import { kiemTraUrlCsdlTest, cheMatKhau } from './kiem-url-csdl'

const URL_TEST_THAT =
  'postgresql://neondb_owner:npg_AbC123@ep-cool-frost-a1b2c3-test.ap-southeast-1.aws.neon.tech/neondb?sslmode=require'

describe('kiemTraUrlCsdlTest — chặn chuỗi mẫu chưa thay', () => {
  it('chặn đúng chuỗi mẫu trong tài liệu', () => {
    const kq = kiemTraUrlCsdlTest(
      'postgresql://user:pass@ep-xxx-test.ap-southeast-1.aws.neon.tech/neondb?sslmode=require',
    )

    expect(kq.ok).toBe(false)
    if (!kq.ok) expect(kq.loi).toMatch(/chuỗi mẫu/)
  })

  it.each([
    'postgresql://<user>:<pass>@host-test/db',
    'postgresql://username:password@host-test/db',
    'postgresql://a:b@ep-xxxxx-test.neon.tech/db',
    'YOUR_CONNECTION_STRING',
  ])('chặn dạng mẫu "%s"', (url) => {
    expect(kiemTraUrlCsdlTest(url).ok).toBe(false)
  })

  it('luôn chỉ đường lấy chuỗi thật', () => {
    const kq = kiemTraUrlCsdlTest('postgresql://user:pass@ep-xxx-test.neon.tech/db')

    expect(kq.ok).toBe(false)
    if (!kq.ok) expect(kq.loi).toContain('Neon')
  })
})

describe('kiemTraUrlCsdlTest — chặn trỏ nhầm vào CSDL sản xuất', () => {
  it('chặn chuỗi không có dấu hiệu là CSDL test', () => {
    const kq = kiemTraUrlCsdlTest(
      'postgresql://neondb_owner:npg_Xyz@ep-quiet-sun-a9.ap-southeast-1.aws.neon.tech/neondb',
    )

    expect(kq.ok).toBe(false)
    if (!kq.ok) expect(kq.loi).toMatch(/XOÁ SẠCH/)
  })

  it('không in mật khẩu ra thông báo lỗi', () => {
    const kq = kiemTraUrlCsdlTest('postgresql://neondb_owner:npg_BiMat999@ep-abc.neon.tech/neondb')

    expect(kq.ok).toBe(false)
    if (!kq.ok) expect(kq.loi).not.toContain('npg_BiMat999')
  })
})

describe('kiemTraUrlCsdlTest — trường hợp hợp lệ và thiếu dữ liệu', () => {
  it('nhận chuỗi nhánh test thật', () => {
    expect(kiemTraUrlCsdlTest(URL_TEST_THAT).ok).toBe(true)
  })

  it.each([
    'postgresql://u:p@localhost:5432/nhamay_dev',
    'postgresql://u:p@127.0.0.1:5432/local_db',
  ])('nhận CSDL cục bộ "%s"', (url) => {
    expect(kiemTraUrlCsdlTest(url).ok).toBe(true)
  })

  it('chặn khi không khai báo gì', () => {
    expect(kiemTraUrlCsdlTest(undefined).ok).toBe(false)
    expect(kiemTraUrlCsdlTest('   ').ok).toBe(false)
  })

  it('chặn chuỗi không phải PostgreSQL', () => {
    expect(kiemTraUrlCsdlTest('mysql://a:b@host-test/db').ok).toBe(false)
  })
})

describe('cheMatKhau', () => {
  it('giấu mật khẩu, giữ lại phần còn lại để nhận ra đang trỏ vào đâu', () => {
    const che = cheMatKhau(URL_TEST_THAT)

    expect(che).not.toContain('npg_AbC123')
    expect(che).toContain('neondb_owner')
    expect(che).toContain('ep-cool-frost-a1b2c3-test')
    expect(che).toContain('***')
  })

  it('chuỗi không có mật khẩu thì giữ nguyên', () => {
    expect(cheMatKhau('postgresql://localhost:5432/db_test')).toBe('postgresql://localhost:5432/db_test')
  })
})
