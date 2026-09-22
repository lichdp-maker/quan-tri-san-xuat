/**
 * Quy tắc mật khẩu — nguồn duy nhất của sự thật.
 *
 * Người dùng là công nhân bấm trên điện thoại nên mật khẩu thực tế là mã PIN số.
 * Đổi lại độ ngắn, phải chặn những dãy ai cũng đoán ra ngay.
 */

export const DO_DAI_TOI_THIEU = 6

/** Những dãy bị dùng nhiều nhất, cấm hẳn. */
const CAM = new Set([
  '123456',
  '654321',
  '111111',
  '000000',
  '222222',
  '333333',
  '444444',
  '555555',
  '666666',
  '777777',
  '888888',
  '999999',
  '123123',
  '112233',
  '121212',
  'abcdef',
  'qwerty',
  'password',
  'matkhau',
  'emic123',
  '12345678',
  '87654321',
])

export type KetQuaKiemTra = { ok: true } | { ok: false; loi: string }

/**
 * Kiểm tra một mật khẩu mới có dùng được không.
 * maNhanVien truyền vào để cấm đặt mật khẩu trùng chính mã nhân viên.
 */
export function kiemTraMatKhau(matKhau: string, maNhanVien?: string): KetQuaKiemTra {
  const mk = matKhau.trim()

  if (mk.length < DO_DAI_TOI_THIEU) {
    return { ok: false, loi: `Mật khẩu phải từ ${DO_DAI_TOI_THIEU} ký tự trở lên.` }
  }
  if (mk.length > 72) {
    return { ok: false, loi: 'Mật khẩu dài quá 72 ký tự.' }
  }
  if (CAM.has(mk.toLowerCase())) {
    return { ok: false, loi: 'Mật khẩu này quá dễ đoán, chọn dãy khác.' }
  }
  if (maNhanVien && mk.toUpperCase() === maNhanVien.trim().toUpperCase()) {
    return { ok: false, loi: 'Mật khẩu không được trùng mã nhân viên.' }
  }
  if (/^(.)\1+$/.test(mk)) {
    return { ok: false, loi: 'Mật khẩu không được là một ký tự lặp lại.' }
  }
  if (laDaySoLienTiep(mk)) {
    return { ok: false, loi: 'Mật khẩu không được là dãy số liên tiếp.' }
  }
  return { ok: true }
}

/** "123456" hoặc "987654" — tăng hoặc giảm đều một đơn vị. */
function laDaySoLienTiep(mk: string): boolean {
  if (!/^\d+$/.test(mk) || mk.length < 3) return false
  const buoc = Number(mk[1]) - Number(mk[0])
  if (buoc !== 1 && buoc !== -1) return false
  for (let i = 2; i < mk.length; i++) {
    if (Number(mk[i]) - Number(mk[i - 1]) !== buoc) return false
  }
  return true
}

/** Sinh mã PIN ngẫu nhiên hợp lệ để cấp cho người mới. */
export function sinhPin(doDai = DO_DAI_TOI_THIEU): string {
  for (let lan = 0; lan < 50; lan++) {
    let pin = ''
    for (let i = 0; i < doDai; i++) pin += Math.floor(Math.random() * 10)
    if (kiemTraMatKhau(pin).ok) return pin
  }
  return String(Date.now()).slice(-doDai)
}
