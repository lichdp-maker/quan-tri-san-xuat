/**
 * Test tích hợp cho các thao tác quản trị — chỗ dễ leo thang quyền nhất.
 * Chạy trên CSDL test, không mock Prisma.
 */
import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest'
import { db, donSach, taoNguoi, form } from './du-lieu'

const nguoiGoi = vi.fn()
vi.mock('@/lib/session', () => ({
  batBuocDangNhap: (...vaiTro: string[]) => nguoiGoi(...vaiTro),
}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

const { suaNguoiDung, datLaiMatKhau, themNguoiDung } = await import('@/app/quan-tri/actions')

beforeEach(async () => {
  await donSach()
  nguoiGoi.mockReset()
})

afterAll(async () => {
  await donSach()
  await db.$disconnect()
})

describe('suaNguoiDung — chặn leo thang quyền', () => {
  it('quản lý xưởng KHÔNG tự nâng mình lên giám đốc', async () => {
    const qlx = await taoNguoi({ role: 'SHOP_MANAGER' })
    nguoiGoi.mockResolvedValue({ id: qlx.id, role: 'SHOP_MANAGER', teamId: null })

    await suaNguoiDung(form({ id: qlx.id, role: 'DIRECTOR', teamId: '', isActive: 'on' }))

    const sau = await db.user.findUniqueOrThrow({ where: { id: qlx.id } })
    expect(sau.role).toBe('SHOP_MANAGER')
  })

  it('quản lý xưởng KHÔNG hạ quyền được giám đốc', async () => {
    const qlx = await taoNguoi({ role: 'SHOP_MANAGER' })
    const gd = await taoNguoi({ role: 'DIRECTOR' })
    nguoiGoi.mockResolvedValue({ id: qlx.id, role: 'SHOP_MANAGER', teamId: null })

    await suaNguoiDung(form({ id: gd.id, role: 'WORKER', teamId: '', isActive: 'on' }))

    const sau = await db.user.findUniqueOrThrow({ where: { id: gd.id } })
    expect(sau.role).toBe('DIRECTOR')
    expect(sau.isActive).toBe(true)
  })

  it('KHÔNG cấp được vai trò ngang mình cho người khác', async () => {
    const qlx = await taoNguoi({ role: 'SHOP_MANAGER' })
    const cn = await taoNguoi({ role: 'WORKER' })
    nguoiGoi.mockResolvedValue({ id: qlx.id, role: 'SHOP_MANAGER', teamId: null })

    await suaNguoiDung(form({ id: cn.id, role: 'SHOP_MANAGER', teamId: '', isActive: 'on' }))

    const sau = await db.user.findUniqueOrThrow({ where: { id: cn.id } })
    expect(sau.role).toBe('WORKER')
  })

  it('KHÔNG tự khoá tài khoản của chính mình', async () => {
    const qlx = await taoNguoi({ role: 'SHOP_MANAGER' })
    nguoiGoi.mockResolvedValue({ id: qlx.id, role: 'SHOP_MANAGER', teamId: null })

    await suaNguoiDung(form({ id: qlx.id, role: 'SHOP_MANAGER', teamId: '' })) // không có isActive

    const sau = await db.user.findUniqueOrThrow({ where: { id: qlx.id } })
    expect(sau.isActive).toBe(true)
  })

  it('nâng công nhân lên tổ trưởng thì được', async () => {
    const qlx = await taoNguoi({ role: 'SHOP_MANAGER' })
    const cn = await taoNguoi({ role: 'WORKER' })
    nguoiGoi.mockResolvedValue({ id: qlx.id, role: 'SHOP_MANAGER', teamId: null })

    await suaNguoiDung(form({ id: cn.id, role: 'TEAM_LEADER', teamId: '', isActive: 'on' }))

    const sau = await db.user.findUniqueOrThrow({ where: { id: cn.id } })
    expect(sau.role).toBe('TEAM_LEADER')
  })
})

describe('datLaiMatKhau', () => {
  it('quản lý xưởng KHÔNG đặt lại được mật khẩu giám đốc', async () => {
    const qlx = await taoNguoi({ role: 'SHOP_MANAGER' })
    const gd = await taoNguoi({ role: 'DIRECTOR' })
    const bamCu = gd.passwordHash
    nguoiGoi.mockResolvedValue({ id: qlx.id, role: 'SHOP_MANAGER', teamId: null })

    await datLaiMatKhau(form({ id: gd.id, password: '482913' }))

    const sau = await db.user.findUniqueOrThrow({ where: { id: gd.id } })
    expect(sau.passwordHash).toBe(bamCu)
  })

  it('đặt lại cho cấp dưới thì được, và bắt người đó đổi ngay', async () => {
    const qlx = await taoNguoi({ role: 'SHOP_MANAGER' })
    const cn = await taoNguoi({ role: 'WORKER' })
    const bamCu = cn.passwordHash
    nguoiGoi.mockResolvedValue({ id: qlx.id, role: 'SHOP_MANAGER', teamId: null })

    await datLaiMatKhau(form({ id: cn.id, password: '482913' }))

    const sau = await db.user.findUniqueOrThrow({ where: { id: cn.id } })
    expect(sau.passwordHash).not.toBe(bamCu)
    expect(sau.mustChangePassword).toBe(true)
    expect(sau.passwordChangedAt).not.toBeNull() // phiên cũ của họ hết hiệu lực
  })

  it('từ chối mật khẩu dễ đoán', async () => {
    const qlx = await taoNguoi({ role: 'SHOP_MANAGER' })
    const cn = await taoNguoi({ role: 'WORKER' })
    const bamCu = cn.passwordHash
    nguoiGoi.mockResolvedValue({ id: qlx.id, role: 'SHOP_MANAGER', teamId: null })

    await datLaiMatKhau(form({ id: cn.id, password: '123456' }))

    const sau = await db.user.findUniqueOrThrow({ where: { id: cn.id } })
    expect(sau.passwordHash).toBe(bamCu)
  })
})

describe('themNguoiDung', () => {
  it('KHÔNG tạo được tài khoản ngang hoặc cao cấp hơn mình', async () => {
    const qlx = await taoNguoi({ role: 'SHOP_MANAGER' })
    nguoiGoi.mockResolvedValue({ id: qlx.id, role: 'SHOP_MANAGER', teamId: null })

    await themNguoiDung(
      form({
        employeeCode: 'GDGIA1',
        fullName: 'Giám đốc giả',
        role: 'DIRECTOR',
        teamId: '',
        password: '482913',
      }),
    )

    expect(await db.user.findUnique({ where: { employeeCode: 'GDGIA1' } })).toBeNull()
  })

  it('tài khoản tạo mới luôn bị bắt đổi mật khẩu lần đầu', async () => {
    const qlx = await taoNguoi({ role: 'SHOP_MANAGER' })
    nguoiGoi.mockResolvedValue({ id: qlx.id, role: 'SHOP_MANAGER', teamId: null })

    await themNguoiDung(
      form({
        employeeCode: 'CNMOI1',
        fullName: 'Công nhân mới',
        role: 'WORKER',
        teamId: '',
        password: '482913',
      }),
    )

    const moi = await db.user.findUnique({ where: { employeeCode: 'CNMOI1' } })
    expect(moi?.mustChangePassword).toBe(true)
  })
})
