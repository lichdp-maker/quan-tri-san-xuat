import { redirect } from 'next/navigation'
import Link from 'next/link'
import { nguoiDangDangNhap, TEN_VAI_TRO } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { ngayHomNay, ngayLamViec, dinhDangNgay } from '@/lib/date'
import { Header } from '@/components/Header'
import { taoDayChuyen, datLenhChoDayChuyen } from './actions'
import SoDoDayChuyen from './SoDoDayChuyen'

export const dynamic = 'force-dynamic'

const DUOC_VAO = ['TEAM_LEADER', 'SHOP_MANAGER', 'DEPUTY_DIRECTOR', 'DIRECTOR']

export default async function TrangDayChuyen({
  searchParams,
}: {
  searchParams: Promise<{ dc?: string }>
}) {
  const u = await nguoiDangDangNhap()
  if (!u) redirect('/dang-nhap')
  if (!DUOC_VAO.includes(u.role)) redirect('/')

  const { dc } = await searchParams
  const ymd = ngayHomNay()
  const workDate = ngayLamViec(ymd)
  const locTo = u.role === 'TEAM_LEADER' ? { teamId: u.teamId ?? '' } : {}

  const [lines, tos, cas, lenhs] = await Promise.all([
    prisma.line.findMany({
      where: { isActive: true },
      include: { team: true, currentOrder: { include: { product: true } }, shift: true },
      orderBy: { code: 'asc' },
    }),
    prisma.team.findMany({ where: { isActive: true }, orderBy: { code: 'asc' } }),
    prisma.shift.findMany({ where: { isActive: true }, orderBy: { code: 'asc' } }),
    prisma.productionOrder.findMany({
      where: { status: { in: ['RELEASED', 'IN_PROGRESS'] } },
      include: { product: true },
      orderBy: { priority: 'desc' },
    }),
  ])

  const line = lines.find((l) => l.id === dc) ?? lines[0] ?? null

  const ghe = line
    ? await prisma.seat.findMany({
        where: { lineId: line.id },
        orderBy: [{ side: 'asc' }, { seq: 'asc' }],
        include: {
          operation: { include: { section: true } },
          assignments: {
            where: { workDate },
            include: { user: true, _count: { select: { entries: true } } },
          },
        },
      })
    : []

  const nguyenCongs = line?.currentOrder
    ? await prisma.orderOperation.findMany({
        where: { orderId: line.currentOrder.id },
        include: { operation: { include: { section: true } } },
        orderBy: [{ sectionCode: 'asc' }, { seq: 'asc' }],
      })
    : []

  // Tổ trưởng chỉ thấy người trong tổ mình; quản lý thấy toàn bộ công nhân đang làm việc
  const congNhan = await prisma.user.findMany({
    where: { isActive: true, role: { in: ['WORKER', 'TEAM_LEADER'] }, ...locTo },
    include: { team: true },
    orderBy: [{ team: { code: 'asc' } }, { employeeCode: 'asc' }],
  })

  const dangNgoi = new Set(ghe.flatMap((g) => g.assignments.map((a) => a.userId)))

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-5">
      <Header
        tieuDe="Sơ đồ dây chuyền"
        phu={`${u.fullName} · ${TEN_VAI_TRO[u.role]} · ${dinhDangNgay(ymd)}`}
        nguoiDung={u}
        them={
          <Link href="/to-truong" className="nut-phu">
            Chốt số
          </Link>
        }
      />

      {lines.length === 0 ? (
        <form action={taoDayChuyen} className="the flex flex-wrap items-end gap-3">
          <p className="w-full font-medium">Chưa có dây chuyền nào — tạo dây chuyền đầu tiên</p>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-slate-600">Mã</span>
            <input name="code" required defaultValue="DC1" className="o-nhap w-24 py-2 uppercase" />
          </label>
          <label className="flex flex-1 flex-col gap-1">
            <span className="text-xs text-slate-600">Tên dây chuyền</span>
            <input name="name" required defaultValue="Dây chuyền 1" className="o-nhap py-2" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-slate-600">Số ghế</span>
            <input name="soGhe" defaultValue="20" inputMode="numeric" className="o-nhap w-20 py-2 text-center" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-slate-600">Tổ</span>
            <select name="teamId" className="o-chon w-40">
              <option value="">— chung —</option>
              {tos.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </label>
          <button className="nut-nho">Tạo dây chuyền</button>
        </form>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap gap-2">
            {lines.map((l) => (
              <Link
                key={l.id}
                href={`/day-chuyen?dc=${l.id}`}
                className={l.id === line?.id ? 'chip-bat' : 'chip-tat'}
              >
                {l.code} · {l.name}
              </Link>
            ))}
          </div>

          {line && (
            <form action={datLenhChoDayChuyen} className="the mb-5 flex flex-wrap items-end gap-3">
              <input type="hidden" name="lineId" value={line.id} />
              <label className="flex flex-1 flex-col gap-1">
                <span className="text-xs text-slate-600">Lệnh đang chạy trên dây chuyền</span>
                <select name="orderId" defaultValue={line.currentOrderId ?? ''} className="o-chon">
                  <option value="">— chưa chọn —</option>
                  {lenhs.map((l2) => (
                    <option key={l2.id} value={l2.id}>
                      {l2.code} · {l2.product.name} · {l2.quantity} {l2.product.unit}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs text-slate-600">Ca</span>
                <select name="shiftId" defaultValue={line.shiftId ?? ''} className="o-chon w-44">
                  <option value="">— chưa chọn —</option>
                  {cas.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </label>
              <button className="nut-nho">Lưu</button>
            </form>
          )}

          {line && (
            <SoDoDayChuyen
              ngay={dinhDangNgay(ymd)}
              coLenh={!!line.currentOrderId && !!line.shiftId}
              lenh={
                line.currentOrder
                  ? {
                      ma: line.currentOrder.code,
                      sanPham: line.currentOrder.product.name,
                      maSanPham: line.currentOrder.product.code,
                      soLuong: line.currentOrder.quantity,
                      donVi: line.currentOrder.product.unit,
                      // Đã xong = số lượng đã qua hết mọi nguyên công của lệnh
                      xong:
                        nguyenCongs.length > 0
                          ? Math.min(...nguyenCongs.map((oo) => oo.doneQtyOk))
                          : 0,
                      ca: line.shift?.name ?? null,
                      soNguyenCong: nguyenCongs.length,
                    }
                  : null
              }
              ghe={ghe.map((g) => {
                const a = g.assignments[0]
                return {
                  id: g.id,
                  side: g.side as 'A' | 'B',
                  seq: g.seq,
                  operationId: g.operationId,
                  tenNguyenCong: g.operation ? g.operation.name : null,
                  boPhan: g.operation ? g.operation.section.name : null,
                  dinhMucGiay: g.operation ? g.operation.standardSeconds : null,
                  nguoi: a
                    ? {
                        id: a.userId,
                        ma: a.user.employeeCode,
                        ten: a.user.fullName,
                        daNhap: a._count.entries > 0,
                      }
                    : null,
                }
              })}
              congNhan={congNhan.map((c) => ({
                id: c.id,
                ma: c.employeeCode,
                ten: c.fullName,
                to: c.team?.name ?? 'Chưa thuộc tổ',
                daNgoi: dangNgoi.has(c.id),
              }))}
              nguyenCongs={nguyenCongs.map((oo) => ({
                id: oo.operationId,
                ten: oo.operation.name,
                boPhan: oo.operation.section.name,
                giay: oo.standardSeconds,
                conLai: oo.targetQty - oo.doneQtyOk,
              }))}
            />
          )}
        </>
      )}
    </main>
  )
}
