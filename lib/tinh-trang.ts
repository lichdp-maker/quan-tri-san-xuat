/**
 * Tình trạng làm việc của nhân sự.
 *
 * Tách khỏi "tài khoản còn dùng": một người nghỉ phép dài hạn vẫn giữ tài khoản
 * và toàn bộ số liệu cũ, chỉ là không xếp vào chỗ ngồi được cho tới khi quay lại.
 */

export const TINH_TRANG = [
  'DANG_LAM',
  'TANG_CUONG',
  'MUA_VU',
  'NGHI_DAI_HAN',
  'NGHI_VIEC',
] as const

export type TinhTrang = (typeof TINH_TRANG)[number]

export const TEN_TINH_TRANG: Record<TinhTrang, string> = {
  DANG_LAM: 'Đang làm việc',
  TANG_CUONG: 'Tăng cường từ bộ phận khác',
  MUA_VU: 'Lao động mùa vụ',
  NGHI_DAI_HAN: 'Nghỉ phép dài hạn',
  NGHI_VIEC: 'Đã nghỉ việc',
}

/** Nhãn ngắn để hiện trên thẻ người, danh sách. */
export const NHAN_NGAN: Record<TinhTrang, string> = {
  DANG_LAM: 'Đang làm',
  TANG_CUONG: 'Tăng cường',
  MUA_VU: 'Mùa vụ',
  NGHI_DAI_HAN: 'Nghỉ dài hạn',
  NGHI_VIEC: 'Đã nghỉ việc',
}

export const MAU_TINH_TRANG: Record<TinhTrang, string> = {
  DANG_LAM: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  TANG_CUONG: 'bg-sky-50 text-sky-700 border-sky-200',
  MUA_VU: 'bg-violet-50 text-violet-700 border-violet-200',
  NGHI_DAI_HAN: 'bg-amber-50 text-amber-800 border-amber-200',
  NGHI_VIEC: 'bg-slate-100 text-slate-500 border-slate-200',
}

export function laTinhTrang(x: string): x is TinhTrang {
  return (TINH_TRANG as readonly string[]).includes(x)
}

/** Có mặt ở xưởng, xếp được vào chỗ ngồi và nhận phân công. */
export function conLamViec(tt: TinhTrang): boolean {
  return tt === 'DANG_LAM' || tt === 'TANG_CUONG' || tt === 'MUA_VU'
}

/** Được đăng nhập vào hệ thống. Nghỉ việc thì mất quyền vào, số liệu cũ vẫn giữ. */
export function duocDangNhap(tt: TinhTrang): boolean {
  return tt !== 'NGHI_VIEC'
}

/** Câu giải thích khi không xếp chỗ được, để báo đúng lý do thay vì "không hợp lệ". */
export function vuongMac(tt: TinhTrang): string | null {
  if (conLamViec(tt)) return null
  if (tt === 'NGHI_VIEC') return 'đã nghỉ việc'
  return 'đang nghỉ phép dài hạn'
}
