/**
 * Máy chủ Vercel chạy giờ UTC, nhà máy chạy giờ Việt Nam.
 * Sai một tiếng ở đây là sản lượng nhảy sang nhầm ngày làm việc.
 */
import { describe, it, expect } from 'vitest'
import {
  ngayHomNay,
  gioHienTai,
  ngayLamViec,
  mocThoiGian,
  soPhut,
  truoc,
  dinhDangNgay,
} from './date'

describe('ngayHomNay — ngày làm việc theo giờ Việt Nam', () => {
  it('sau 17h UTC đã là ngày hôm sau ở nhà máy', () => {
    // 21/09 23:30 UTC = 22/09 06:30 giờ VN
    expect(ngayHomNay(new Date('2026-09-21T23:30:00Z'))).toBe('2026-09-22')
  })

  it('trước 17h UTC vẫn là ngày hôm đó', () => {
    // 21/09 16:59 UTC = 21/09 23:59 giờ VN
    expect(ngayHomNay(new Date('2026-09-21T16:59:00Z'))).toBe('2026-09-21')
  })

  it('rạng sáng UTC vẫn cùng ngày với buổi sáng ở nhà máy', () => {
    expect(ngayHomNay(new Date('2026-09-22T00:30:00Z'))).toBe('2026-09-22')
  })
})

describe('gioHienTai', () => {
  it('trả giờ Việt Nam dạng HH:mm', () => {
    expect(gioHienTai(new Date('2026-09-22T02:40:00Z'))).toBe('09:40')
  })

  it('qua nửa đêm UTC vẫn ra giờ sáng ở nhà máy', () => {
    expect(gioHienTai(new Date('2026-09-21T23:00:00Z'))).toBe('06:00')
  })
})

describe('ngayLamViec', () => {
  it('luôn là nửa đêm UTC để khớp cột @db.Date của Postgres', () => {
    expect(ngayLamViec('2026-09-22').toISOString()).toBe('2026-09-22T00:00:00.000Z')
  })
})

describe('mocThoiGian — chụp lại mốc giờ thật lúc nhập', () => {
  it('bù lệch +07:00 cho mốc buổi sáng', () => {
    expect(mocThoiGian('2026-09-22', '09:30').toISOString()).toBe('2026-09-22T02:30:00.000Z')
  })

  it('bù lệch +07:00 cho mốc cuối ca', () => {
    expect(mocThoiGian('2026-09-22', '19:40').toISOString()).toBe('2026-09-22T12:40:00.000Z')
  })
})

describe('soPhut', () => {
  it('trừ nghỉ giữa khoảng', () => {
    expect(soPhut('11:40', '14:30', 60)).toBe(110)
    expect(soPhut('16:20', '19:40', 30)).toBe(170)
  })

  it('không nghỉ thì giữ nguyên', () => {
    expect(soPhut('09:30', '11:40')).toBe(130)
  })

  it('không bao giờ trả số âm', () => {
    expect(soPhut('08:00', '09:00', 120)).toBe(0)
  })
})

describe('truoc', () => {
  it('so sánh được hai chuỗi HH:mm', () => {
    expect(truoc('09:30', '11:40')).toBe(true)
    expect(truoc('19:40', '09:30')).toBe(false)
  })

  it('bằng nhau thì không tính là trước', () => {
    expect(truoc('09:30', '09:30')).toBe(false)
  })
})

describe('dinhDangNgay', () => {
  it('đổi sang dd/mm/yyyy như người Việt đọc', () => {
    expect(dinhDangNgay('2026-09-22')).toBe('22/09/2026')
  })
})
