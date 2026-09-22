import { describe, it, expect } from 'vitest'
import { kiemTraMatKhau, sinhPin, DO_DAI_TOI_THIEU } from './mat-khau'

describe('kiemTraMatKhau — chặn mật khẩu dễ đoán', () => {
  it.each(['123456', '654321', '111111', '000000', '121212', 'qwerty', 'password'])(
    'chặn "%s"',
    (mk) => {
      expect(kiemTraMatKhau(mk).ok).toBe(false)
    },
  )

  it('chặn dãy số liên tiếp dù dài hơn 6 ký tự', () => {
    expect(kiemTraMatKhau('1234567').ok).toBe(false)
    expect(kiemTraMatKhau('9876543').ok).toBe(false)
  })

  it('chặn một ký tự lặp lại', () => {
    expect(kiemTraMatKhau('777777').ok).toBe(false)
    expect(kiemTraMatKhau('aaaaaaaa').ok).toBe(false)
  })

  it(`chặn mật khẩu ngắn hơn ${DO_DAI_TOI_THIEU} ký tự`, () => {
    expect(kiemTraMatKhau('12345').ok).toBe(false)
  })

  it('chặn mật khẩu trùng chính mã nhân viên, không phân biệt hoa thường', () => {
    expect(kiemTraMatKhau('emic1143', 'EMIC1143').ok).toBe(false)
  })

  it('chặn mật khẩu dài quá mức argon2 xử lý', () => {
    expect(kiemTraMatKhau('a'.repeat(100)).ok).toBe(false)
  })
})

describe('kiemTraMatKhau — nhận mật khẩu dùng được', () => {
  it.each(['482913', '740265', 'EmicX92', 'mai2018!'])('nhận "%s"', (mk) => {
    expect(kiemTraMatKhau(mk).ok).toBe(true)
  })

  it('luôn kèm lý do khi từ chối, để hiện thẳng cho người dùng', () => {
    const kq = kiemTraMatKhau('123456')

    expect(kq.ok).toBe(false)
    if (!kq.ok) expect(kq.loi.length).toBeGreaterThan(10)
  })
})

describe('sinhPin', () => {
  it('sinh ra PIN luôn hợp lệ với chính quy tắc trên', () => {
    for (let i = 0; i < 500; i++) {
      const pin = sinhPin()

      expect(pin).toMatch(/^\d{6}$/)
      expect(kiemTraMatKhau(pin).ok).toBe(true)
    }
  })

  it('không sinh ra cùng một PIN cho mọi người', () => {
    const bo = new Set(Array.from({ length: 200 }, () => sinhPin()))

    expect(bo.size).toBeGreaterThan(150)
  })
})
