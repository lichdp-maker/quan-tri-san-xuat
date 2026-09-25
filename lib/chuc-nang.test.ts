import { describe, it, expect } from 'vitest'
import {
  MOI_CHUC_NANG,
  NHOM_CHUC_NANG,
  MAC_DINH,
  quyenCuaNguoi,
  coQuyen,
  tachThemBot,
  trangDauTien,
  TEN_CHUC_NANG,
  type MaChucNang,
} from './chuc-nang'
import {
  TINH_TRANG,
  conLamViec,
  duocDangNhap,
  laTinhTrang,
  vuongMac,
  TEN_TINH_TRANG,
  type TinhTrang,
} from './tinh-trang'

describe('danh mục chức năng', () => {
  it('không có mã trùng và mã nào cũng có tên', () => {
    expect(new Set(MOI_CHUC_NANG).size).toBe(MOI_CHUC_NANG.length)
    for (const m of MOI_CHUC_NANG) expect(TEN_CHUC_NANG[m]).toBeTruthy()
  })

  it('mọi mã đều thuộc đúng một nhóm', () => {
    const trongNhom = NHOM_CHUC_NANG.flatMap((n) => n.muc.map((x) => x.ma))
    expect(trongNhom.sort()).toEqual([...MOI_CHUC_NANG].sort())
  })

  it('ba vai trò quản lý có đủ mọi chức năng', () => {
    for (const r of ['SHOP_MANAGER', 'DEPUTY_DIRECTOR', 'DIRECTOR'] as const) {
      expect(MAC_DINH[r]).toEqual(MOI_CHUC_NANG)
    }
  })

  it('công nhân chỉ nhập sản lượng', () => {
    expect(MAC_DINH.WORKER).toEqual(['NHAP_SAN_LUONG'])
  })
})

describe('quyenCuaNguoi', () => {
  it('không chỉnh gì thì đúng bằng mặc định của vai trò', () => {
    expect(quyenCuaNguoi('TEAM_LEADER')).toEqual(quyenCuaNguoi('TEAM_LEADER', [], []))
    expect(quyenCuaNguoi('WORKER')).toEqual(['NHAP_SAN_LUONG'])
  })

  it('thêm được chức năng ngoài vai trò', () => {
    const q = quyenCuaNguoi('WORKER', ['XEM_TONG_HOP'])
    expect(coQuyen(q, 'XEM_TONG_HOP')).toBe(true)
    expect(coQuyen(q, 'NHAP_SAN_LUONG')).toBe(true)
  })

  it('cắt được chức năng của vai trò', () => {
    const q = quyenCuaNguoi('TEAM_LEADER', [], ['CHOT_SO'])
    expect(coQuyen(q, 'CHOT_SO')).toBe(false)
    expect(coQuyen(q, 'XEP_NHAN_SU')).toBe(true)
  })

  it('cắt thắng thêm — quản trị chặn được dứt khoát', () => {
    const q = quyenCuaNguoi('WORKER', ['QT_NGUOI_DUNG'], ['QT_NGUOI_DUNG'])
    expect(coQuyen(q, 'QT_NGUOI_DUNG')).toBe(false)
  })

  it('bỏ qua mã rác gửi lên từ form', () => {
    const q = quyenCuaNguoi('WORKER', ['XOA_HET_DU_LIEU', ''], ['KHONG_CO_THAT'])
    expect(q).toEqual(['NHAP_SAN_LUONG'])
  })

  it('giữ nguyên thứ tự của danh mục, không theo thứ tự người tích', () => {
    const q = quyenCuaNguoi('WORKER', ['QT_CA', 'XEM_TONG_HOP'])
    expect(q).toEqual(MOI_CHUC_NANG.filter((m) => q.includes(m)))
  })
})

describe('coQuyen', () => {
  it('đúng khi có ít nhất một trong các mã hỏi tới', () => {
    expect(coQuyen(['XEM_TONG_HOP'], 'QT_CA', 'XEM_TONG_HOP')).toBe(true)
    expect(coQuyen(['XEM_TONG_HOP'], 'QT_CA')).toBe(false)
    expect(coQuyen([], 'XEM_TONG_HOP')).toBe(false)
  })
})

describe('tachThemBot', () => {
  it('đi vòng tròn: tách ra rồi dựng lại đúng bộ đã chọn', () => {
    const cacBo: Array<[Parameters<typeof tachThemBot>[0], MaChucNang[]]> = [
      ['WORKER', ['NHAP_SAN_LUONG', 'XEM_TONG_HOP']],
      ['TEAM_LEADER', []],
      ['ENGINEER', MOI_CHUC_NANG],
      ['DIRECTOR', ['XEM_TONG_HOP']],
    ]
    for (const [role, chon] of cacBo) {
      const { them, bot } = tachThemBot(role, chon)
      expect(quyenCuaNguoi(role, them, bot)).toEqual(
        MOI_CHUC_NANG.filter((m) => chon.includes(m)),
      )
    }
  })

  it('chọn đúng bộ mặc định thì không lưu chênh lệch nào', () => {
    const { them, bot } = tachThemBot('PLANNER', [...MAC_DINH.PLANNER])
    expect(them).toEqual([])
    expect(bot).toEqual([])
  })
})

describe('trangDauTien', () => {
  it('đưa mỗi người về đúng màn hình chính của họ', () => {
    expect(trangDauTien(MAC_DINH.DIRECTOR)).toBe('/bang-dieu-khien')
    expect(trangDauTien(MAC_DINH.WORKER)).toBe('/cong-nhan')
    expect(trangDauTien(MAC_DINH.TEAM_LEADER)).toBe('/to-truong')
    expect(trangDauTien(MAC_DINH.PLANNER)).toBe('/bang-dieu-khien')
    expect(trangDauTien(['XEM_MAT_BANG'])).toBe('/so-do-xuong')
  })

  it('không có chức năng nào thì về trang đổi mật khẩu, không văng lỗi', () => {
    expect(trangDauTien([])).toBe('/doi-mat-khau')
  })
})

describe('tình trạng làm việc', () => {
  it('mỗi tình trạng đều có tên tiếng Việt', () => {
    for (const t of TINH_TRANG) expect(TEN_TINH_TRANG[t]).toBeTruthy()
  })

  it('người có mặt ở xưởng mới xếp được chỗ', () => {
    expect(conLamViec('DANG_LAM')).toBe(true)
    expect(conLamViec('TANG_CUONG')).toBe(true)
    expect(conLamViec('MUA_VU')).toBe(true)
    expect(conLamViec('NGHI_DAI_HAN')).toBe(false)
    expect(conLamViec('NGHI_VIEC')).toBe(false)
  })

  it('chỉ nghỉ việc mới mất quyền đăng nhập', () => {
    expect(duocDangNhap('NGHI_DAI_HAN')).toBe(true)
    expect(duocDangNhap('NGHI_VIEC')).toBe(false)
  })

  it('nêu đúng lý do khi không xếp được', () => {
    expect(vuongMac('DANG_LAM')).toBeNull()
    expect(vuongMac('NGHI_VIEC')).toBe('đã nghỉ việc')
    expect(vuongMac('NGHI_DAI_HAN')).toBe('đang nghỉ phép dài hạn')
  })

  it('nhận đúng chuỗi gửi lên từ form', () => {
    expect(laTinhTrang('MUA_VU')).toBe(true)
    expect(laTinhTrang('NGHI_TET')).toBe(false)
  })

  it('người nghỉ việc thì đương nhiên không còn làm việc', () => {
    for (const t of TINH_TRANG as readonly TinhTrang[]) {
      if (!duocDangNhap(t)) expect(conLamViec(t)).toBe(false)
    }
  })
})
