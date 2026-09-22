/**
 * Test tích hợp — chạy trên CSDL thật (CSDL test), không mock Prisma.
 *
 * Đây là phần đắt nhất nhưng cũng là phần duy nhất chứng minh được rằng bộ lọc
 * Prisma thật sự chặn đúng người, và bộ đếm tiến độ không cộng hai lần.
 */
import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest'
import { db, donSach, taoTo, taoNguoi, taoCa, taoLenh, taoPhanCongThu, taoBanGhi, form } from './du-lieu'

// Server action gọi batBuocDangNhap (đọc cookie) và revalidatePath (cần ngữ cảnh
// của Next). Cả hai không có ở đây nên thay bằng bản giả — phần còn lại chạy thật.
const nguoiGoi = vi.fn()
vi.mock('@/lib/session', () => ({
  batBuocDangNhap: (...vaiTro: string[]) => nguoiGoi(...vaiTro),
}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

const { duyetBanGhi, tuChoiBanGhi, taoPhanCong } = await import('@/app/to-truong/actions')

const NGAY = new Date('2026-09-22T00:00:00.000Z')

beforeEach(async () => {
  await donSach()
  nguoiGoi.mockReset()
})

afterAll(async () => {
  await donSach()
  await db.$disconnect()
})

describe('duyetBanGhi', () => {
  it('KHÔNG cho tổ trưởng duyệt sản lượng của chính mình', async () => {
    const to = await taoTo()
    const tt = await taoNguoi({ role: 'TEAM_LEADER', teamId: to.id })
    const { oo } = await taoLenh({ nguoiTaoId: tt.id })
    const ca = await taoCa()
    const pc = await taoPhanCongThu({
      orderOperationId: oo.id,
      userId: tt.id, // chính tổ trưởng ngồi nguyên công này
      teamId: to.id,
      shiftId: ca.id,
      workDate: NGAY,
      nguoiGanId: tt.id,
    })
    const bg = await taoBanGhi({
      assignmentId: pc.id,
      timeSlotId: ca.timeSlots[0].id,
      workDate: NGAY,
      qtyOk: 120,
      createdById: tt.id,
    })

    nguoiGoi.mockResolvedValue({ id: tt.id, role: 'TEAM_LEADER', teamId: to.id })
    await duyetBanGhi(form({ id: bg.id }))

    const sau = await db.productionEntry.findUniqueOrThrow({ where: { id: bg.id } })
    const tienDo = await db.orderOperation.findUniqueOrThrow({ where: { id: oo.id } })

    expect(sau.status).toBe('PENDING') // vẫn chờ, không tự duyệt được
    expect(tienDo.doneQtyOk).toBe(0) // và không có gì cộng vào tiến độ
  })

  it('cho tổ trưởng duyệt sản lượng của người trong tổ, và cộng đúng tiến độ', async () => {
    const to = await taoTo()
    const tt = await taoNguoi({ role: 'TEAM_LEADER', teamId: to.id })
    const cn = await taoNguoi({ role: 'WORKER', teamId: to.id })
    const { oo } = await taoLenh({ nguoiTaoId: tt.id })
    const ca = await taoCa()
    const pc = await taoPhanCongThu({
      orderOperationId: oo.id,
      userId: cn.id,
      teamId: to.id,
      shiftId: ca.id,
      workDate: NGAY,
      nguoiGanId: tt.id,
    })
    const bg = await taoBanGhi({
      assignmentId: pc.id,
      timeSlotId: ca.timeSlots[0].id,
      workDate: NGAY,
      qtyOk: 120,
      createdById: cn.id,
    })

    nguoiGoi.mockResolvedValue({ id: tt.id, role: 'TEAM_LEADER', teamId: to.id })
    await duyetBanGhi(form({ id: bg.id }))

    const sau = await db.productionEntry.findUniqueOrThrow({ where: { id: bg.id } })
    const tienDo = await db.orderOperation.findUniqueOrThrow({ where: { id: oo.id } })

    expect(sau.status).toBe('APPROVED')
    expect(sau.approvedById).toBe(tt.id)
    expect(tienDo.doneQtyOk).toBe(120)
  })

  it('KHÔNG cho tổ trưởng duyệt sản lượng của tổ khác', async () => {
    const toA = await taoTo('Tổ A')
    const toB = await taoTo('Tổ B')
    const ttA = await taoNguoi({ role: 'TEAM_LEADER', teamId: toA.id })
    const cnB = await taoNguoi({ role: 'WORKER', teamId: toB.id })
    const { oo } = await taoLenh({ nguoiTaoId: ttA.id })
    const ca = await taoCa()
    const pc = await taoPhanCongThu({
      orderOperationId: oo.id,
      userId: cnB.id,
      teamId: toB.id,
      shiftId: ca.id,
      workDate: NGAY,
      nguoiGanId: ttA.id,
    })
    const bg = await taoBanGhi({
      assignmentId: pc.id,
      timeSlotId: ca.timeSlots[0].id,
      workDate: NGAY,
      qtyOk: 99,
      createdById: cnB.id,
    })

    nguoiGoi.mockResolvedValue({ id: ttA.id, role: 'TEAM_LEADER', teamId: toA.id })
    await duyetBanGhi(form({ id: bg.id }))

    const sau = await db.productionEntry.findUniqueOrThrow({ where: { id: bg.id } })
    expect(sau.status).toBe('PENDING')
  })

  it('bấm duyệt hai lần thì tiến độ chỉ cộng MỘT lần', async () => {
    const to = await taoTo()
    const tt = await taoNguoi({ role: 'TEAM_LEADER', teamId: to.id })
    const cn = await taoNguoi({ role: 'WORKER', teamId: to.id })
    const { oo } = await taoLenh({ nguoiTaoId: tt.id })
    const ca = await taoCa()
    const pc = await taoPhanCongThu({
      orderOperationId: oo.id,
      userId: cn.id,
      teamId: to.id,
      shiftId: ca.id,
      workDate: NGAY,
      nguoiGanId: tt.id,
    })
    const bg = await taoBanGhi({
      assignmentId: pc.id,
      timeSlotId: ca.timeSlots[0].id,
      workDate: NGAY,
      qtyOk: 120,
      createdById: cn.id,
    })

    nguoiGoi.mockResolvedValue({ id: tt.id, role: 'TEAM_LEADER', teamId: to.id })
    await duyetBanGhi(form({ id: bg.id }))
    await duyetBanGhi(form({ id: bg.id })) // bấm lại lần nữa

    const tienDo = await db.orderOperation.findUniqueOrThrow({ where: { id: oo.id } })
    expect(tienDo.doneQtyOk).toBe(120) // không phải 240
  })

  it('quản lý xưởng duyệt được mọi tổ', async () => {
    const to = await taoTo()
    const qlx = await taoNguoi({ role: 'SHOP_MANAGER' })
    const cn = await taoNguoi({ role: 'WORKER', teamId: to.id })
    const { oo } = await taoLenh({ nguoiTaoId: qlx.id })
    const ca = await taoCa()
    const pc = await taoPhanCongThu({
      orderOperationId: oo.id,
      userId: cn.id,
      teamId: to.id,
      shiftId: ca.id,
      workDate: NGAY,
      nguoiGanId: qlx.id,
    })
    const bg = await taoBanGhi({
      assignmentId: pc.id,
      timeSlotId: ca.timeSlots[0].id,
      workDate: NGAY,
      qtyOk: 50,
      createdById: cn.id,
    })

    nguoiGoi.mockResolvedValue({ id: qlx.id, role: 'SHOP_MANAGER', teamId: null })
    await duyetBanGhi(form({ id: bg.id }))

    const sau = await db.productionEntry.findUniqueOrThrow({ where: { id: bg.id } })
    expect(sau.status).toBe('APPROVED')
  })
})

describe('tuChoiBanGhi', () => {
  it('cũng không cho từ chối bản ghi của chính mình', async () => {
    const to = await taoTo()
    const tt = await taoNguoi({ role: 'TEAM_LEADER', teamId: to.id })
    const { oo } = await taoLenh({ nguoiTaoId: tt.id })
    const ca = await taoCa()
    const pc = await taoPhanCongThu({
      orderOperationId: oo.id,
      userId: tt.id,
      teamId: to.id,
      shiftId: ca.id,
      workDate: NGAY,
      nguoiGanId: tt.id,
    })
    const bg = await taoBanGhi({
      assignmentId: pc.id,
      timeSlotId: ca.timeSlots[0].id,
      workDate: NGAY,
      qtyOk: 10,
      createdById: tt.id,
    })

    nguoiGoi.mockResolvedValue({ id: tt.id, role: 'TEAM_LEADER', teamId: to.id })
    await tuChoiBanGhi(form({ id: bg.id }))

    const sau = await db.productionEntry.findUniqueOrThrow({ where: { id: bg.id } })
    expect(sau.status).toBe('PENDING')
  })
})

describe('taoPhanCong', () => {
  it('KHÔNG phân công được vào lệnh đã đóng', async () => {
    const to = await taoTo()
    const tt = await taoNguoi({ role: 'TEAM_LEADER', teamId: to.id })
    const cn = await taoNguoi({ role: 'WORKER', teamId: to.id })
    const { oo } = await taoLenh({ nguoiTaoId: tt.id, trangThai: 'CLOSED' })
    const ca = await taoCa()

    nguoiGoi.mockResolvedValue({ id: tt.id, role: 'TEAM_LEADER', teamId: to.id })
    await taoPhanCong(
      form({ userId: cn.id, orderOperationId: oo.id, shiftId: ca.id }),
    )

    expect(await db.assignment.count()).toBe(0)
  })

  it('KHÔNG phân công được người của tổ khác', async () => {
    const toA = await taoTo('Tổ A')
    const toB = await taoTo('Tổ B')
    const ttA = await taoNguoi({ role: 'TEAM_LEADER', teamId: toA.id })
    const cnB = await taoNguoi({ role: 'WORKER', teamId: toB.id })
    const { oo } = await taoLenh({ nguoiTaoId: ttA.id })
    const ca = await taoCa()

    nguoiGoi.mockResolvedValue({ id: ttA.id, role: 'TEAM_LEADER', teamId: toA.id })
    await taoPhanCong(form({ userId: cnB.id, orderOperationId: oo.id, shiftId: ca.id }))

    expect(await db.assignment.count()).toBe(0)
  })

  it('phân công người trong tổ vào lệnh đang chạy thì được', async () => {
    const to = await taoTo()
    const tt = await taoNguoi({ role: 'TEAM_LEADER', teamId: to.id })
    const cn = await taoNguoi({ role: 'WORKER', teamId: to.id })
    const { oo } = await taoLenh({ nguoiTaoId: tt.id, trangThai: 'IN_PROGRESS' })
    const ca = await taoCa()

    nguoiGoi.mockResolvedValue({ id: tt.id, role: 'TEAM_LEADER', teamId: to.id })
    await taoPhanCong(form({ userId: cn.id, orderOperationId: oo.id, shiftId: ca.id }))

    const pc = await db.assignment.findFirst()
    expect(pc?.userId).toBe(cn.id)
  })
})
