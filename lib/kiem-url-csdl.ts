/**
 * Kiểm chuỗi kết nối trước khi cho phép chạy bất cứ thứ gì lên CSDL test.
 *
 * Hai loại tai nạn cần chặn, và cả hai đều đã xảy ra thật:
 *  1. Dán nguyên chuỗi mẫu trong tài liệu, chưa thay bằng chuỗi thật.
 *  2. Trỏ nhầm vào CSDL đang chạy sản xuất — bộ test xoá sạch mọi bảng.
 */

/** Dấu hiệu của chuỗi mẫu chưa thay. */
const DAU_HIEU_MAU = [
  'ep-xxx',
  'user:pass',
  'username:password',
  '<',
  'chuỗi kết nối',
  'YOUR_',
  'xxxxx',
]

/** Tên nhánh hoặc tên CSDL phải chứa một trong các từ này. */
const TU_KHOA_TEST = ['test', 'dev', 'local', 'branch']

export type KetQuaKiemUrl = { ok: true } | { ok: false; loi: string }

export function kiemTraUrlCsdlTest(url: string | undefined, tenTep = '.env.test'): KetQuaKiemUrl {
  const u = (url ?? '').trim()

  if (!u) {
    return { ok: false, loi: `Tệp ${tenTep} chưa khai báo DATABASE_URL.` }
  }

  const thap = u.toLowerCase()
  const mau = DAU_HIEU_MAU.find((d) => thap.includes(d.toLowerCase()))
  if (mau) {
    return {
      ok: false,
      loi:
        `DATABASE_URL trong ${tenTep} vẫn còn là chuỗi mẫu (thấy "${mau}").\n` +
        'Thay bằng chuỗi kết nối thật của nhánh test trên Neon:\n' +
        '  Neon Console > dự án > nút Connect > ô Branch chọn nhánh test > Copy snippet',
    }
  }

  if (!u.startsWith('postgres://') && !u.startsWith('postgresql://')) {
    return { ok: false, loi: `DATABASE_URL trong ${tenTep} phải bắt đầu bằng postgresql://` }
  }

  if (!TU_KHOA_TEST.some((t) => thap.includes(t))) {
    return {
      ok: false,
      loi:
        `DATABASE_URL trong ${tenTep} trông không giống CSDL test.\n` +
        'Bộ test XOÁ SẠCH mọi bảng trước mỗi lần chạy, nên tên nhánh hoặc tên CSDL ' +
        `bắt buộc phải chứa một trong: ${TU_KHOA_TEST.join(', ')}.\n` +
        `Đang trỏ tới: ${cheMatKhau(u)}`,
    }
  }

  return { ok: true }
}

/** Che mật khẩu trước khi in chuỗi kết nối ra màn hình hoặc log. */
export function cheMatKhau(url: string): string {
  return url.replace(/\/\/([^:/@]+):[^@]*@/, '//$1:***@')
}
