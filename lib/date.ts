/**
 * Múi giờ nhà máy. Mọi thứ hiển thị và mọi "ngày làm việc" đều theo giờ Việt Nam,
 * kể cả khi máy chủ chạy ở UTC (Vercel).
 */
export const TZ = 'Asia/Ho_Chi_Minh'

/** Chuỗi "YYYY-MM-DD" của thời điểm hiện tại theo giờ Việt Nam. */
export function ngayHomNay(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
}

/** "HH:mm" của thời điểm hiện tại theo giờ Việt Nam. */
export function gioHienTai(now = new Date()): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(now)
}

/** Đổi "YYYY-MM-DD" thành Date để lưu vào cột @db.Date (luôn là nửa đêm UTC). */
export function ngayLamViec(ymd: string): Date {
  return new Date(`${ymd}T00:00:00.000Z`)
}

/** Ghép ngày làm việc + "HH:mm" thành mốc thời gian thật (UTC), bù lệch +07:00. */
export function mocThoiGian(ymd: string, hhmm: string): Date {
  return new Date(`${ymd}T${hhmm}:00.000+07:00`)
}

/** Số phút giữa hai "HH:mm", đã trừ nghỉ giữa khoảng. Hỗ trợ mốc vắt qua nửa đêm. */
export function soPhut(batDau: string, ketThuc: string, nghi = 0): number {
  const [h1, m1] = batDau.split(':').map(Number)
  const [h2, m2] = ketThuc.split(':').map(Number)
  let phut = h2 * 60 + m2 - (h1 * 60 + m1)
  if (phut < 0) phut += 24 * 60
  return Math.max(0, phut - nghi)
}

/** So sánh hai chuỗi "HH:mm". */
export function truoc(a: string, b: string): boolean {
  return a.localeCompare(b) < 0
}

export function dinhDangNgay(ymd: string): string {
  const [y, m, d] = ymd.split('-')
  return `${d}/${m}/${y}`
}
