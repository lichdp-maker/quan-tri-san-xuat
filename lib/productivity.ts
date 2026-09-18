/**
 * Quy tắc tính năng suất — nguồn duy nhất của sự thật.
 * Mọi màn hình và báo cáo đều gọi các hàm ở đây, không tự tính lại.
 *
 * Nguyên tắc đã chốt:
 *  - Định mức tính bằng GIÂY/đơn vị, lấy từ bảng định mức công nghệ.
 *  - Năng suất đánh giá THEO TỪNG NGUYÊN CÔNG, không gộp cả ca.
 *  - Đạt khi năng suất > ngưỡng của nguyên công (mặc định 100%).
 *  - Sản phẩm hỏng không được tính vào giờ chuẩn làm được.
 *  - Thời gian dừng máy được trừ khỏi giờ công trước khi tính.
 */

export const MAX_PLAUSIBLE_PERFORMANCE = 200 // % — trên mức này thì cảnh báo nhập nhầm

export type EntryInput = {
  qtyOk: number
  standardSeconds: number
  workedMinutes: number
  downtimeMinutes?: number
  targetPercent?: number
}

export type EntryResult = {
  earnedSeconds: number
  netMinutes: number
  performance: number | null // % ; null khi không tính được
  isAchieved: boolean | null
  warning?: 'NO_NET_TIME' | 'IMPLAUSIBLE' | 'NO_STANDARD'
}

/** Năng suất của MỘT bản ghi (một người × một nguyên công × một mốc giờ). */
export function calcEntry(input: EntryInput): EntryResult {
  const { qtyOk, standardSeconds, workedMinutes } = input
  const downtime = input.downtimeMinutes ?? 0
  const target = input.targetPercent ?? 100

  const earnedSeconds = Math.max(0, qtyOk) * Math.max(0, standardSeconds)
  const netMinutes = Math.max(0, workedMinutes - downtime)

  if (standardSeconds <= 0) {
    return { earnedSeconds: 0, netMinutes, performance: null, isAchieved: null, warning: 'NO_STANDARD' }
  }
  if (netMinutes <= 0) {
    return { earnedSeconds, netMinutes, performance: null, isAchieved: null, warning: 'NO_NET_TIME' }
  }

  const performance = round2((earnedSeconds / 60 / netMinutes) * 100)
  return {
    earnedSeconds,
    netMinutes,
    performance,
    isAchieved: performance > target,
    warning: performance > MAX_PLAUSIBLE_PERFORMANCE ? 'IMPLAUSIBLE' : undefined,
  }
}

/**
 * Gộp nhiều bản ghi (theo người, theo tổ, theo lệnh, theo kỳ).
 * Dùng cho báo cáo tổng hợp — KHÔNG thay thế đánh giá đạt/không đạt theo nguyên công.
 */
export function aggregate(entries: Array<Pick<EntryResult, 'earnedSeconds' | 'netMinutes'>>) {
  const earnedSeconds = entries.reduce((a, e) => a + e.earnedSeconds, 0)
  const netMinutes = entries.reduce((a, e) => a + e.netMinutes, 0)
  return {
    earnedSeconds,
    netMinutes,
    performance: netMinutes > 0 ? round2((earnedSeconds / 60 / netMinutes) * 100) : null,
  }
}

/** Tỷ lệ đạt chất lượng. */
export function qualityRate(qtyOk: number, qtyDefect: number): number | null {
  const total = qtyOk + qtyDefect
  return total > 0 ? round2((qtyOk / total) * 100) : null
}

/** Độ dài thực của một mốc giờ, đã trừ nghỉ giữa khoảng. */
export function slotMinutes(startTime: string, endTime: string, breakMinutes = 0): number {
  const [sh, sm] = startTime.split(':').map(Number)
  const [eh, em] = endTime.split(':').map(Number)
  let minutes = eh * 60 + em - (sh * 60 + sm)
  if (minutes < 0) minutes += 24 * 60 // mốc vắt qua nửa đêm
  return Math.max(0, minutes - breakMinutes)
}

/**
 * Kiểm tra tổng thời gian một người khai trong CÙNG một mốc giờ.
 * Một người làm nhiều nguyên công / nhiều lệnh trong một mốc, tổng phút không được vượt độ dài mốc.
 */
export function validateSlotAllocation(
  entries: Array<{ workedMinutes: number }>,
  slotDurationMinutes: number,
): { ok: boolean; totalMinutes: number; overBy: number } {
  const totalMinutes = entries.reduce((a, e) => a + e.workedMinutes, 0)
  const overBy = Math.max(0, totalMinutes - slotDurationMinutes)
  return { ok: overBy === 0, totalMinutes, overBy }
}

/**
 * Chia đều phần thời gian còn lại của mốc cho các nguyên công chưa khai giờ.
 * Dùng để gợi ý mặc định trên giao diện, công nhân vẫn sửa được.
 */
export function suggestMinutes(slotDurationMinutes: number, operationCount: number): number {
  if (operationCount <= 0) return 0
  return Math.floor(slotDurationMinutes / operationCount)
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
