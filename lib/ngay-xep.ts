/**
 * Quy tắc về NGÀY khi xếp chỗ ngồi.
 *
 * Xưởng xếp người cho ngày mai từ chiều hôm trước, để sáng ra công nhân mở app
 * là biết mình ngồi đâu. Nhưng quá khứ thì không cho sửa: bản ghi sản lượng đã
 * gắn với phân công của ngày đó, sửa lại là số liệu cũ sai theo.
 */

export const SO_NGAY_TOI_DA = 14

const DANG_NGAY = /^\d{4}-\d{2}-\d{2}$/

export function laNgayHopLe(ymd: string): boolean {
  if (!DANG_NGAY.test(ymd)) return false
  const t = Date.parse(`${ymd}T00:00:00.000Z`)
  if (Number.isNaN(t)) return false
  // Chặn kiểu 2026-02-31: Date tự nhảy sang tháng sau
  return new Date(t).toISOString().slice(0, 10) === ymd
}

/** Số ngày từ `tu` đến `den`. Âm là `den` nằm trước. */
export function cachNgay(tu: string, den: string): number {
  return Math.round(
    (Date.parse(`${den}T00:00:00.000Z`) - Date.parse(`${tu}T00:00:00.000Z`)) / 86400000,
  )
}

/** Trả về câu báo lỗi, hoặc null nếu ngày này xếp chỗ được. */
export function kiemTraNgayXep(ymd: string, homNay: string): string | null {
  if (!laNgayHopLe(ymd)) return 'Ngày không hợp lệ.'
  const d = cachNgay(homNay, ymd)
  if (d < 0) return 'Không xếp chỗ cho ngày đã qua — số liệu ngày đó đã chốt.'
  if (d > SO_NGAY_TOI_DA) return `Chỉ xếp trước tối đa ${SO_NGAY_TOI_DA} ngày.`
  return null
}

/** Cộng thêm số ngày vào một "YYYY-MM-DD". */
export function themNgay(ymd: string, soNgay: number): string {
  const d = new Date(`${ymd}T00:00:00.000Z`)
  d.setUTCDate(d.getUTCDate() + soNgay)
  return d.toISOString().slice(0, 10)
}

/** Nhãn ngắn gọn cho người đọc: Hôm nay / Ngày mai / Hôm qua / 25/09. */
export function nhanNgay(ymd: string, homNay: string): string {
  const d = cachNgay(homNay, ymd)
  if (d === 0) return 'Hôm nay'
  if (d === 1) return 'Ngày mai'
  if (d === -1) return 'Hôm qua'
  const [, m, ng] = ymd.split('-')
  return `${ng}/${m}`
}
