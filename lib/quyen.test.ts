/**
 * Phân quyền là chỗ một lỗi im lặng cho phép người này sửa số của người kia.
 * Mọi nhánh đều phải có test, kể cả nhánh "đúng ra phải từ chối".
 */
import { describe, it, expect } from 'vitest'
import {
  caoHon,
  ngoaiPhamViTo,
  duocDuyetBanGhi,
  locBanGhiDuocDuyet,
  lenhConNhanSanLuong,
  duocSuaNguoiDung,
  duocDatLaiMatKhau,
  phienConHieuLuc,
  DEM_GIAY,
} from './quyen'

const TO_TRUONG = { id: 'tt1', role: 'TEAM_LEADER' as const, teamId: 'to1' }
const TO_TRUONG_KHONG_TO = { id: 'tt9', role: 'TEAM_LEADER' as const, teamId: null }
const QUAN_LY_XUONG = { id: 'qlx', role: 'SHOP_MANAGER' as const, teamId: null }
const GIAM_DOC = { id: 'gd', role: 'DIRECTOR' as const, teamId: null }

describe('caoHon — thứ bậc quyền', () => {
  it('cấp trên tác động được lên cấp dưới', () => {
    expect(caoHon('DIRECTOR', 'SHOP_MANAGER')).toBe(true)
    expect(caoHon('SHOP_MANAGER', 'TEAM_LEADER')).toBe(true)
    expect(caoHon('TEAM_LEADER', 'WORKER')).toBe(true)
  })

  it('cấp dưới không với lên cấp trên', () => {
    expect(caoHon('SHOP_MANAGER', 'DIRECTOR')).toBe(false)
  })

  it('ngang hàng thì không tác động lên nhau được', () => {
    expect(caoHon('SHOP_MANAGER', 'SHOP_MANAGER')).toBe(false)
    expect(caoHon('TEAM_LEADER', 'ENGINEER')).toBe(false)
  })
})

describe('ngoaiPhamViTo', () => {
  it('tổ trưởng làm việc trong tổ mình', () => {
    expect(ngoaiPhamViTo('TEAM_LEADER', 'to1', 'to1')).toBe(false)
  })

  it('tổ trưởng không với sang tổ khác', () => {
    expect(ngoaiPhamViTo('TEAM_LEADER', 'to1', 'to2')).toBe(true)
  })

  it('tổ trưởng chưa thuộc tổ nào thì không làm được gì', () => {
    expect(ngoaiPhamViTo('TEAM_LEADER', null, 'to1')).toBe(true)
  })

  it('đối tượng không thuộc tổ nào cũng ngoài phạm vi tổ trưởng', () => {
    expect(ngoaiPhamViTo('TEAM_LEADER', 'to1', null)).toBe(true)
  })

  it('cấp quản lý thì toàn xưởng', () => {
    expect(ngoaiPhamViTo('SHOP_MANAGER', null, 'to2')).toBe(false)
    expect(ngoaiPhamViTo('DIRECTOR', null, 'to7')).toBe(false)
  })
})

describe('duocDuyetBanGhi — không ai tự chấm điểm cho mình', () => {
  it('tổ trưởng không duyệt được sản lượng của chính mình', () => {
    expect(duocDuyetBanGhi(TO_TRUONG, { userId: 'tt1', teamId: 'to1' })).toBe(false)
  })

  it('quản lý xưởng cũng không tự duyệt cho mình', () => {
    expect(duocDuyetBanGhi(QUAN_LY_XUONG, { userId: 'qlx', teamId: null })).toBe(false)
  })

  it('tổ trưởng duyệt được người trong tổ', () => {
    expect(duocDuyetBanGhi(TO_TRUONG, { userId: 'cn1', teamId: 'to1' })).toBe(true)
  })

  it('tổ trưởng không duyệt được người tổ khác', () => {
    expect(duocDuyetBanGhi(TO_TRUONG, { userId: 'cn9', teamId: 'to2' })).toBe(false)
  })

  it('quản lý xưởng duyệt được mọi tổ', () => {
    expect(duocDuyetBanGhi(QUAN_LY_XUONG, { userId: 'cn9', teamId: 'to2' })).toBe(true)
  })
})

describe('locBanGhiDuocDuyet — bộ lọc Prisma phải khớp với hàm kiểm', () => {
  /** Mô phỏng cách Prisma đối chiếu một bản ghi với bộ lọc. */
  function khop(
    loc: ReturnType<typeof locBanGhiDuocDuyet>,
    banGhi: { userId: string; teamId: string | null },
  ): boolean {
    if (banGhi.userId === loc.userId.not) return false
    if ('teamId' in loc && banGhi.teamId !== loc.teamId) return false
    return true
  }

  const moiNguoiGoi = [TO_TRUONG, TO_TRUONG_KHONG_TO, QUAN_LY_XUONG]
  const moiBanGhi = [
    { userId: 'tt1', teamId: 'to1' },
    { userId: 'cn1', teamId: 'to1' },
    { userId: 'cn9', teamId: 'to2' },
    { userId: 'qlx', teamId: null },
    { userId: 'cn5', teamId: null },
  ]

  it.each(moiNguoiGoi.flatMap((ng) => moiBanGhi.map((bg) => [ng, bg] as const)))(
    'cùng kết quả khi $0.id xét bản ghi của $1.userId',
    (nguoiGoi, banGhi) => {
      expect(khop(locBanGhiDuocDuyet(nguoiGoi), banGhi)).toBe(duocDuyetBanGhi(nguoiGoi, banGhi))
    },
  )

  it('tổ trưởng chưa thuộc tổ nào thì bộ lọc không khớp bản ghi nào', () => {
    const loc = locBanGhiDuocDuyet(TO_TRUONG_KHONG_TO)

    expect(khop(loc, { userId: 'cn1', teamId: 'to1' })).toBe(false)
    expect(khop(loc, { userId: 'cn1', teamId: null })).toBe(false)
  })
})

describe('lenhConNhanSanLuong', () => {
  it('lệnh đang chạy thì nhận', () => {
    expect(lenhConNhanSanLuong('RELEASED')).toBe(true)
    expect(lenhConNhanSanLuong('IN_PROGRESS')).toBe(true)
  })

  it.each(['DRAFT', 'COMPLETED', 'CLOSED', 'CANCELLED'] as const)(
    'lệnh %s thì không nhận thêm sản lượng',
    (trangThai) => {
      expect(lenhConNhanSanLuong(trangThai)).toBe(false)
    },
  )
})

describe('duocSuaNguoiDung — chặn leo thang quyền', () => {
  it('quản lý xưởng không tự nâng mình lên giám đốc', () => {
    const kq = duocSuaNguoiDung(
      QUAN_LY_XUONG,
      { id: 'qlx', role: 'SHOP_MANAGER' },
      { role: 'DIRECTOR', isActive: true },
    )

    expect(kq.ok).toBe(false)
  })

  it('quản lý xưởng không sửa được tài khoản giám đốc', () => {
    const kq = duocSuaNguoiDung(
      QUAN_LY_XUONG,
      { id: 'gd', role: 'DIRECTOR' },
      { role: 'WORKER', isActive: true },
    )

    expect(kq.ok).toBe(false)
  })

  it('không cấp được vai trò ngang mình cho người khác', () => {
    const kq = duocSuaNguoiDung(
      QUAN_LY_XUONG,
      { id: 'cn1', role: 'WORKER' },
      { role: 'SHOP_MANAGER', isActive: true },
    )

    expect(kq.ok).toBe(false)
  })

  it('không tự khoá tài khoản của chính mình', () => {
    const kq = duocSuaNguoiDung(
      QUAN_LY_XUONG,
      { id: 'qlx', role: 'SHOP_MANAGER' },
      { role: 'SHOP_MANAGER', isActive: false },
    )

    expect(kq.ok).toBe(false)
  })

  it('nâng công nhân lên tổ trưởng thì được', () => {
    const kq = duocSuaNguoiDung(
      QUAN_LY_XUONG,
      { id: 'cn1', role: 'WORKER' },
      { role: 'TEAM_LEADER', isActive: true },
    )

    expect(kq.ok).toBe(true)
  })

  it('giữ nguyên vai trò của chính mình thì được, ví dụ chỉ đổi tổ', () => {
    const kq = duocSuaNguoiDung(
      QUAN_LY_XUONG,
      { id: 'qlx', role: 'SHOP_MANAGER' },
      { role: 'SHOP_MANAGER', isActive: true },
    )

    expect(kq.ok).toBe(true)
  })

  it('giám đốc sửa được quản lý xưởng', () => {
    const kq = duocSuaNguoiDung(
      GIAM_DOC,
      { id: 'qlx', role: 'SHOP_MANAGER' },
      { role: 'WORKER', isActive: true },
    )

    expect(kq.ok).toBe(true)
  })

  it('mỗi lần từ chối đều kèm lý do đọc được', () => {
    const kq = duocSuaNguoiDung(
      QUAN_LY_XUONG,
      { id: 'gd', role: 'DIRECTOR' },
      { role: 'WORKER', isActive: true },
    )

    expect(kq.ok).toBe(false)
    if (!kq.ok) expect(kq.lyDo.length).toBeGreaterThan(10)
  })
})

describe('duocDatLaiMatKhau', () => {
  it('không đặt lại mật khẩu của cấp trên', () => {
    expect(duocDatLaiMatKhau(QUAN_LY_XUONG, { id: 'gd', role: 'DIRECTOR' })).toBe(false)
  })

  it('không đặt lại mật khẩu của người đồng cấp', () => {
    expect(duocDatLaiMatKhau(QUAN_LY_XUONG, { id: 'qlx2', role: 'SHOP_MANAGER' })).toBe(false)
  })

  it('đặt lại cho cấp dưới thì được', () => {
    expect(duocDatLaiMatKhau(QUAN_LY_XUONG, { id: 'cn1', role: 'WORKER' })).toBe(true)
  })

  it('đặt lại cho chính mình thì được', () => {
    expect(duocDatLaiMatKhau(QUAN_LY_XUONG, { id: 'qlx', role: 'SHOP_MANAGER' })).toBe(true)
  })
})

describe('phienConHieuLuc — thu hồi phiên', () => {
  const giay = (iso: string) => Math.floor(new Date(iso).getTime() / 1000)

  it('tài khoản bị khoá thì mất phiên ngay, không chờ hết hạn token', () => {
    expect(phienConHieuLuc(giay('2026-09-22T10:00:00Z'), null, false)).toBe(false)
  })

  it('chưa từng đổi mật khẩu thì phiên còn hiệu lực', () => {
    expect(phienConHieuLuc(giay('2026-09-22T10:00:00Z'), null, true)).toBe(true)
  })

  it('phiên cấp TRƯỚC lần đổi mật khẩu thì hết hiệu lực', () => {
    const doiLuc = new Date('2026-09-22T10:00:00Z')

    expect(phienConHieuLuc(giay('2026-09-22T09:00:00Z'), doiLuc, true)).toBe(false)
  })

  it('phiên cấp SAU lần đổi mật khẩu thì dùng được', () => {
    const doiLuc = new Date('2026-09-22T10:00:00Z')

    expect(phienConHieuLuc(giay('2026-09-22T10:00:30Z'), doiLuc, true)).toBe(true)
  })

  it('phiên vừa cấp lại ngay sau khi đổi mật khẩu KHÔNG bị loại oan', () => {
    // iat làm tròn xuống giây (10:00:00) còn passwordChangedAt là 10:00:00.800 —
    // không có khoảng đệm thì chính người vừa đổi mật khẩu bị đá ra ngay
    const doiLuc = new Date('2026-09-22T10:00:00.800Z')

    expect(phienConHieuLuc(giay('2026-09-22T10:00:00.000Z'), doiLuc, true)).toBe(true)
  })

  it('ranh giới của khoảng đệm', () => {
    const doiLuc = new Date('2026-09-22T10:00:00.000Z')

    expect(DEM_GIAY).toBe(5)
    expect(phienConHieuLuc(giay('2026-09-22T09:59:55Z'), doiLuc, true)).toBe(true)
    expect(phienConHieuLuc(giay('2026-09-22T09:59:54Z'), doiLuc, true)).toBe(false)
  })

  it('token không có iat thì không bị loại oan', () => {
    expect(phienConHieuLuc(0, new Date('2026-09-22T10:00:00Z'), true)).toBe(true)
  })
})
