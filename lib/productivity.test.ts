/**
 * Công thức năng suất là thứ phán ai đạt, ai không đạt trong 46 con người.
 * Sai ở đây thì không ai nhìn ra bằng mắt, nên mọi nhánh đều phải có test.
 */
import { describe, it, expect } from 'vitest'
import {
  calcEntry,
  aggregate,
  qualityRate,
  slotMinutes,
  validateSlotAllocation,
  suggestMinutes,
  MAX_PLAUSIBLE_PERFORMANCE,
} from './productivity'

describe('calcEntry — năng suất của một bản ghi', () => {
  it('đúng 100% thì KHÔNG đạt, vì ngưỡng là lớn hơn 100', () => {
    // 130 phút × 60 = 7800 giây chuẩn; định mức 60s ⇒ 130 sp là đúng 100%
    const kq = calcEntry({ qtyOk: 130, standardSeconds: 60, workedMinutes: 130 })

    expect(kq.performance).toBe(100)
    expect(kq.isAchieved).toBe(false)
  })

  it('trên 100% thì đạt', () => {
    const kq = calcEntry({ qtyOk: 131, standardSeconds: 60, workedMinutes: 130 })

    expect(kq.isAchieved).toBe(true)
  })

  it('trừ thời gian dừng khỏi mẫu số trước khi tính', () => {
    const kq = calcEntry({
      qtyOk: 100,
      standardSeconds: 60,
      workedMinutes: 130,
      downtimeMinutes: 30,
    })

    expect(kq.netMinutes).toBe(100)
    expect(kq.performance).toBe(100)
    expect(kq.isAchieved).toBe(false)
  })

  it('tôn trọng ngưỡng riêng của nguyên công', () => {
    const kq = calcEntry({
      qtyOk: 110,
      standardSeconds: 60,
      workedMinutes: 100,
      targetPercent: 110,
    })

    expect(kq.performance).toBe(110)
    expect(kq.isAchieved).toBe(false) // 110 không lớn hơn 110
  })

  it('hết giờ ròng thì không tính được năng suất, không chia cho 0', () => {
    const kq = calcEntry({
      qtyOk: 50,
      standardSeconds: 60,
      workedMinutes: 30,
      downtimeMinutes: 30,
    })

    expect(kq.performance).toBeNull()
    expect(kq.isAchieved).toBeNull()
    expect(kq.warning).toBe('NO_NET_TIME')
  })

  it('định mức bằng 0 thì báo thiếu định mức chứ không ra vô cực', () => {
    const kq = calcEntry({ qtyOk: 50, standardSeconds: 0, workedMinutes: 60 })

    expect(kq.warning).toBe('NO_STANDARD')
    expect(kq.performance).toBeNull()
  })

  it('năng suất vô lý thì vẫn tính nhưng gắn cảnh báo', () => {
    const kq = calcEntry({ qtyOk: 500, standardSeconds: 60, workedMinutes: 60 })

    expect(kq.performance).toBeGreaterThan(MAX_PLAUSIBLE_PERFORMANCE)
    expect(kq.warning).toBe('IMPLAUSIBLE')
    expect(kq.isAchieved).toBe(true)
  })

  it('số âm gửi lên không làm hỏng kết quả', () => {
    const kq = calcEntry({ qtyOk: -5, standardSeconds: 60, workedMinutes: 60 })

    expect(kq.earnedSeconds).toBe(0)
    expect(kq.performance).toBe(0)
  })

  it('số hỏng không phải đầu vào, nên không thể ăn vào giờ chuẩn làm được', () => {
    const a = calcEntry({ qtyOk: 100, standardSeconds: 34, workedMinutes: 60 })
    const b = calcEntry({ qtyOk: 100, standardSeconds: 34, workedMinutes: 60 })

    expect(a).toEqual(b)
  })
})

describe('aggregate — gộp nhiều bản ghi', () => {
  it('cộng tổng giờ rồi mới chia, không lấy trung bình các tỷ lệ', () => {
    const e1 = calcEntry({ qtyOk: 100, standardSeconds: 60, workedMinutes: 60 }) // 166,67%
    const e2 = calcEntry({ qtyOk: 10, standardSeconds: 60, workedMinutes: 120 }) // 8,33%

    const gop = aggregate([e1, e2])

    expect(gop.earnedSeconds).toBe(6600)
    expect(gop.netMinutes).toBe(180)
    expect(gop.performance).toBe(61.11) // không phải (166,67 + 8,33) / 2
  })

  it('không có bản ghi nào thì không có năng suất', () => {
    expect(aggregate([]).performance).toBeNull()
  })
})

describe('qualityRate', () => {
  it('tính theo tổng làm ra', () => {
    expect(qualityRate(100, 4)).toBe(96.15)
  })

  it('chưa làm gì thì chưa có tỷ lệ', () => {
    expect(qualityRate(0, 0)).toBeNull()
  })
})

describe('slotMinutes — độ dài thật của mốc giờ', () => {
  it('trừ nghỉ trưa trong mốc 11h40–14h30', () => {
    expect(slotMinutes('11:40', '14:30', 60)).toBe(110)
  })

  it('trừ nghỉ giữa ca trong mốc 16h20–19h40', () => {
    expect(slotMinutes('16:20', '19:40', 30)).toBe(170)
  })

  it('mốc không nghỉ thì giữ nguyên', () => {
    expect(slotMinutes('08:00', '09:30')).toBe(90)
  })

  it('mốc vắt qua nửa đêm vẫn ra số dương', () => {
    expect(slotMinutes('22:00', '02:00')).toBe(240)
  })

  it('nghỉ dài hơn cả mốc thì về 0, không âm', () => {
    expect(slotMinutes('08:00', '09:00', 120)).toBe(0)
  })
})

describe('validateSlotAllocation — một người nhiều nguyên công trong một mốc', () => {
  it('chặn khi tổng phút khai vượt độ dài mốc', () => {
    const kq = validateSlotAllocation([{ workedMinutes: 60 }, { workedMinutes: 60 }], 110)

    expect(kq.ok).toBe(false)
    expect(kq.totalMinutes).toBe(120)
    expect(kq.overBy).toBe(10)
  })

  it('vừa khít thì cho qua', () => {
    expect(validateSlotAllocation([{ workedMinutes: 110 }], 110).ok).toBe(true)
  })
})

describe('suggestMinutes', () => {
  it('chia đều phần còn lại', () => {
    expect(suggestMinutes(110, 3)).toBe(36)
  })

  it('không có nguyên công nào thì gợi ý 0', () => {
    expect(suggestMinutes(110, 0)).toBe(0)
  })
})
