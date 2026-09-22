import { redirect } from 'next/navigation'
import Link from 'next/link'
import { nguoiDangDangNhap, TEN_VAI_TRO } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { ngayHomNay, ngayLamViec, dinhDangNgay } from '@/lib/date'
import { Header } from '@/components/Header'
import { datLenhChoDayChuyen, doiDayChuyen } from './actions'
import SoDoDayChuyen from './SoDoDayChuyen'
import ThemDayChuyen from './ThemDayChuyen'
import NguyenCongCuaChuyen from './NguyenCongCuaChuyen'

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
  const laQuanLy = u.role !== 'TEAM_LEADER'

  const [lines, tos, cas, lenhs] = await Promise.all([
    prisma.line.findMany({
      where: { isActive: true },
      include: {
        team: true,
        currentOrder: { include: { product: true } },
        shift: true,
        _count: { select: { seats: true } },
      },
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

  // Nguyên công chuyền này đảm nhận. Rỗng = chuyền chưa giới hạn, làm mọi nguyên công của lệnh.
  const ncCuaChuyen = line
    ? await prisma.lineOperation.findMany({
        where: { lineId: line.id },
        select: { operationId: true },
      })
    : []
  const boLoc = new Set(ncCuaChuyen.map((x) => x.operationId))

  // Toàn bộ nguyên công còn dùng, để chọn danh sách cho chuyền
  const moiNguyenCong = laQuanLy
    ? await prisma.operation.findMany({
        where: { isActive: true },
        include: { section: { include: { product: true } } },
        orderBy: [{ section: { seq: 'asc' } }, { seq: 'asc' }],
      })
    : []

  // Tổ trưởng chỉ thấy người trong tổ mình; quản lý thấy toàn bộ công nhân đang làm việc
  const congNhan = await prisma.user.findMany({
    where: { isActive: true, role: { in: ['WORKER', 'TEAM_LEADER'] }, ...locTo },
    include: { team: true },
    orderBy: [{ team: { code: 'asc' } }, { employeeCode: 'asc' }],
  })

  // Ai đang ngồi ở chuyền nào trong hôm nay — tính trên toàn bộ 4 chuyền, không riêng chuyền đang xem
  const xepHomNay = await prisma.assignment.findMany({
    where: { workDate, seatId: { not: null } },
    select: { userId: true, seat: { select: { lineId: true } } },
  })

  const tenChuyen = new Map(lines.map((l) => [l.id, l.name]))
  const dangNgoi = new Map<string, string[]>()
  for (const x of xepHomNay) {
    const ten = tenChuyen.get(x.seat!.lineId)
    if (!ten) continue
    const cu = dangNgoi.get(x.userId) ?? []
    if (!cu.includes(ten)) dangNgoi.set(x.userId, [...cu, ten])
  }

  const demTheoChuyen = new Map<string, number>()
  for (const x of xepHomNay) {
    demTheoChuyen.set(x.seat!.lineId, (demTheoChuyen.get(x.seat!.lineId) ?? 0) + 1)
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-5">
      <Header
        tieuDe="Sơ đồ dây chuyền"
        phu={`${u.fullName} · ${TEN_VAI_TRO[u.role]} · ${dinhDangNgay(ymd)}`}
        nguoiDung={u}
        them={
          <>
            <Link href="/so-do-xuong" className="nut-phu">
              Mặt bằng xưởng
            </Link>
            <Link href="/to-truong" className="nut-phu">
              Chốt số
            </Link>
          </>
        }
      />

      {lines.length === 0 ? (
        <div className="flex flex-col gap-3">
          <p className="the font-medium">
            Chưa có dây chuyền nào. Bấm <strong>Thêm chuyền</strong> rồi dùng nút điền nhanh để tạo
            lần lượt bốn chuyền của xưởng.
          </p>
          {laQuanLy && <ThemDayChuyen tos={tos} daCo={[]} />}
        </div>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            {lines.map((l) => {
              const daXep = demTheoChuyen.get(l.id) ?? 0
              const dangXem = l.id === line?.id
              return (
                <Link
                  key={l.id}
                  href={`/day-chuyen?dc=${l.id}`}
                  className={dangXem ? 'chip-bat' : 'chip-tat'}
                  title={l.currentOrder ? `Đang chạy ${l.currentOrder.product.name}` : 'Chưa chọn lệnh'}
                >
                  {l.name}
                  <span className={dangXem ? 'ml-1.5 opacity-80' : 'ml-1.5 text-slate-400'}>
                    {daXep}/{l._count.seats}
                  </span>
                </Link>
              )
            })}
            {laQuanLy && (
              <ThemDayChuyen tos={tos} daCo={lines.flatMap((l) => [l.code, l.name])} />
            )}
          </div>

          {line && (
            <form
              key={`lenh-${line.id}`}
              action={datLenhChoDayChuyen}
              className="the mb-5 flex flex-wrap items-end gap-3"
            >
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
            <NguyenCongCuaChuyen
              lineId={line.id}
              tenChuyen={line.name}
              duocSua={laQuanLy}
              dangChon={[...boLoc]}
              tatCa={moiNguyenCong.map((o) => ({
                id: o.id,
                ma: o.code,
                ten: o.name,
                giay: o.standardSeconds,
                sanPham: o.section.product.name,
                maSanPham: o.section.product.code,
                boPhan: o.section.name,
              }))}
            />
          )}

          {line && laQuanLy && (
            <details className="the mb-5">
              <summary className="cursor-pointer text-sm font-medium text-slate-700">
                Sửa chuyền {line.name} — đổi tên, số ghế, tổ phụ trách
              </summary>
              <form
                key={`sua-${line.id}`}
                action={doiDayChuyen}
                className="mt-3 flex flex-wrap items-end gap-3"
              >
                <input type="hidden" name="lineId" value={line.id} />
                <label className="flex min-w-48 flex-1 flex-col gap-1">
                  <span className="text-xs text-slate-600">Tên dây chuyền</span>
                  <input name="name" required defaultValue={line.name} className="o-nhap py-2" />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-xs text-slate-600">Số ghế</span>
                  <input
                    name="soGhe"
                    defaultValue={String(line._count.seats)}
                    inputMode="numeric"
                    className="o-nhap w-20 py-2 text-center"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-xs text-slate-600">Tổ phụ trách</span>
                  <select name="teamId" defaultValue={line.teamId ?? ''} className="o-chon w-44">
                    <option value="">— chung —</option>
                    {tos.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-xs text-slate-600">Kiểu vị trí</span>
                  <select name="loai" defaultValue={line.loai} className="o-chon w-36">
                    <option value="CHUYEN">Băng chuyền</option>
                    <option value="BAN">Dãy bàn</option>
                    <option value="MAY">Máy</option>
                  </select>
                </label>
                <label className="flex items-center gap-2 pb-2 text-sm text-slate-600">
                  <input type="checkbox" name="conDung" value="co" defaultChecked />
                  Còn dùng
                </label>
                <button className="nut-nho">Lưu chuyền</button>
              </form>
              <p className="mt-2 text-xs text-slate-500">
                Bỏ tích “Còn dùng” thì chuyền bị ẩn khỏi danh sách, số liệu cũ vẫn giữ nguyên. Giảm
                số ghế chỉ bỏ được những ghế chưa có ai ngồi.
              </p>
            </details>
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
                dangO: dangNgoi.get(c.id) ?? [],
              }))}
              tenChuyenNay={line.name}
              nguyenCongs={nguyenCongs
                .filter((oo) => boLoc.size === 0 || boLoc.has(oo.operationId))
                .map((oo) => ({
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
