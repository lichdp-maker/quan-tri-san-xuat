import { describe, it, expect } from 'vitest'
import {
  laNgayHopLe,
  cachNgay,
  kiemTraNgayXep,
  themNgay,
  nhanNgay,
  SO_NGAY_TOI_DA,
} from './ngay-xep'

describe('laNgayHopLe', () => {
  it('nhận ngày đúng dạng', () => {
    expect(laNgayHopLe('2026-09-23')).toBe(true)
    expect(laNgayHopLe('2024-02-29')).toBe(true) // năm nhuận
  })

  it('loại ngày sai dạng hoặc không tồn tại', () => {
    expect(laNgayHopLe('')).toBe(false)
    expect(laNgayHopLe('23/09/2026')).toBe(false)
    expect(laNgayHopLe('2026-9-3')).toBe(false)
    expect(laNgayHopLe('2026-02-31')).toBe(false)
    expect(laNgayHopLe('2026-13-01')).toBe(false)
    expect(laNgayHopLe('2025-02-29')).toBe(false)
  })
})

describe('cachNgay', () => {
  it('đếm đúng cả khi vắt qua tháng', () => {
    expect(cachNgay('2026-09-23', '2026-09-24')).toBe(1)
    expect(cachNgay('2026-09-23', '2026-09-23')).toBe(0)
    expect(cachNgay('2026-09-23', '2026-09-22')).toBe(-1)
    expect(cachNgay('2026-09-30', '2026-10-01')).toBe(1)
    expect(cachNgay('2026-12-31', '2027-01-01')).toBe(1)
  })
})

describe('kiemTraNgayXep', () => {
  const homNay = '2026-09-23'

  it('cho xếp hôm nay và ngày mai', () => {
    expect(kiemTraNgayXep(homNay, homNay)).toBeNull()
    expect(kiemTraNgayXep('2026-09-24', homNay)).toBeNull()
  })

  it('cho xếp đúng tới mốc tối đa, chặn khi vượt', () => {
    expect(kiemTraNgayXep(themNgay(homNay, SO_NGAY_TOI_DA), homNay)).toBeNull()
    expect(kiemTraNgayXep(themNgay(homNay, SO_NGAY_TOI_DA + 1), homNay)).toContain('tối đa')
  })

  it('chặn ngày đã qua — số liệu cũ đã chốt', () => {
    expect(kiemTraNgayXep('2026-09-22', homNay)).toContain('đã qua')
  })

  it('chặn ngày rác', () => {
    expect(kiemTraNgayXep('hôm nào đó', homNay)).toBe('Ngày không hợp lệ.')
  })
})

describe('themNgay', () => {
  it('cộng trừ đúng qua mốc tháng và năm', () => {
    expect(themNgay('2026-09-23', 1)).toBe('2026-09-24')
    expect(themNgay('2026-09-30', 1)).toBe('2026-10-01')
    expect(themNgay('2026-01-01', -1)).toBe('2025-12-31')
    expect(themNgay('2026-09-23', 0)).toBe('2026-09-23')
  })
})

describe('nhanNgay', () => {
  const homNay = '2026-09-23'

  it('gọi tên ba ngày gần nhất theo cách người ta nói', () => {
    expect(nhanNgay('2026-09-23', homNay)).toBe('Hôm nay')
    expect(nhanNgay('2026-09-24', homNay)).toBe('Ngày mai')
    expect(nhanNgay('2026-09-22', homNay)).toBe('Hôm qua')
  })

  it('ngày xa thì ghi ngày/tháng', () => {
    expect(nhanNgay('2026-09-28', homNay)).toBe('28/09')
    expect(nhanNgay('2026-10-01', homNay)).toBe('01/10')
  })
})
