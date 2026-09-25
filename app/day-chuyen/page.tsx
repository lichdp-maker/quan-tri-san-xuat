import { redirect } from 'next/navigation'
import Link from 'next/link'
import { nguoiDangDangNhap, TEN_VAI_TRO } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { ngayHomNay, ngayLamViec, dinhDangNgay } from '@/lib/date'
import { Header } from '@/components/Header'
import { laNgayHopLe, cachNgay } from '@/lib/ngay-xep'
import { coQuyen } from '@/lib/chuc-nang'
import SoDoDayChuyen from './SoDoDayChuyen'
import ThanhNgay from './ThanhNgay'
import ThemDayChuyen from './ThemDayChuyen'
import ThietLapChuyen from './ThietLapChuyen'

export const dynamic = 'force-dynamic'


export default async function TrangDayChuyen({
  searchParams,
}: {
  searchParams: Promise<{ dc?: string; ngay?: string }>
}) {
  const u = await nguoiDangDangNhap()
  if (!u) redirect('/dang-nhap')
  if (!coQuyen(u.quyen, 'XEP_NHAN_SU')) redirect('/')

  const { dc, ngay } = await searchParams
  const homNay = ngayHomNay()
  // Xem lại tối đa 30 ngày trước, xếp trước tối đa 14 ngày sau
  const ymd =
    ngay && laNgayHopLe(ngay) && cachNgay(homNay, ngay) >= -30 && cachNgay(homNay, ngay) <= 14
      ? ngay
      : homNay
  const chiXem = cachNgay(homNay, ymd) < 0
  const workDate = ngayLamViec(ymd)
  const locTo = u.role === 'TEAM_LEADER' ? { teamId: u.teamId ?? '' } : {}
  const laQuanLy = coQuyen(u.quyen, 'SAP_XEP_MAT_BANG')

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
    where: {
      isActive: true,
      role: { in: ['WORKER', 'TEAM_LEADER'] },
      // Nghỉ việc và nghỉ phép dài hạn không hiện ra để xếp
      tinhTrang: { in: ['DANG_LAM', 'TANG_CUONG', 'MUA_VU'] },
      ...locTo,
    },
    include: { team: true },
    orderBy: [{ team: { code: 'asc' } }, { employeeCode: 'asc' }],
  })

  // Ai đang ngồi ở chuyền nào trong hôm nay — tính trên toàn bộ 4 chuyền, không riêng chuyền đang xem
  const xepHomNay = await prisma.assignment.findMany({
    where: { workDate, seatId: { not: null } },
    select: {
      userId: true,
      seat: { select: { lineId: true, side: true, seq: true } },
      orderOperation: { select: { operation: { select: { name: true } } } },
    },
  })

  // Một người có thể làm nhiều việc trong cùng một ca: ghi rõ từng chỗ đang giữ,
  // kèm tên nguyên công, để tổ trưởng biết đang xếp thêm việc thứ mấy cho họ.
  const tenChuyen = new Map(lines.map((l) => [l.id, l.name]))
  const dangNgoi = new Map<string, string[]>()
  for (const x of xepHomNay) {
    const ten = tenChuyen.get(x.seat!.lineId)
    if (!ten) continue
    const nhan = `${ten} ${x.seat!.side}${x.seat!.seq} · ${x.orderOperation.operation.name}`
    const cu = dangNgoi.get(x.userId) ?? []
    if (!cu.includes(nhan)) dangNgoi.set(x.userId, [...cu, nhan])
  }

  // Đã xong = số lượng đã qua hết mọi nguyên công của lệnh
  const daXongLenh =
    nguyenCongs.length > 0 ? Math.min(...nguyenCongs.map((oo) => oo.doneQtyOk)) : 0

  const demTheoChuyen = new Map<string, number>()
  for (const x of xepHomNay) {
    demTheoChuyen.set(x.seat!.lineId, (demTheoChuyen.get(x.seat!.lineId) ?? 0) + 1)
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-5">
      <Header
        tieuDe="Sơ đồ sắp xếp nhân sự"
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
          <ThanhNgay
            ngay={ymd}
            homNay={homNay}
            lineId={line?.id ?? null}
            tenChuyen={line?.name ?? null}
            duocChep={true}
          />

          {/* Chọn chuyền — một hàng duy nhất, cuộn ngang khi nhiều chuyền */}
          <div className="mb-4 flex items-center gap-2">
            <div className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto pb-1">
              {lines.map((l) => {
                const daXep = demTheoChuyen.get(l.id) ?? 0
                const dangXem = l.id === line?.id
                return (
                  <Link
                    key={l.id}
                    href={`/day-chuyen?dc=${l.id}&ngay=${ymd}`}
                    className={`${dangXem ? 'chip-bat' : 'chip-tat'} shrink-0`}
                    title={
                      l.currentOrder ? `Đang chạy ${l.currentOrder.product.name}` : 'Chưa chọn lệnh'
                    }
                  >
                    <span
                      aria-hidden
                      className={[
                        'mr-1.5 inline-block h-1.5 w-1.5 rounded-full align-middle',
                        l.currentOrder
                          ? dangXem
                            ? 'bg-white'
                            : 'bg-emerald-500'
                          : dangXem
                            ? 'bg-white/50'
                            : 'bg-amber-400',
                      ].join(' ')}
                    />
                    {l.name}
                    <span className={dangXem ? 'ml-1.5 opacity-80' : 'ml-1.5 text-slate-400'}>
                      {daXep}/{l._count.seats}
                    </span>
                  </Link>
                )
              })}
            </div>
            {laQuanLy && (
              <div className="shrink-0 border-l border-slate-200 pl-2">
                <ThemDayChuyen tos={tos} daCo={lines.flatMap((l) => [l.code, l.name])} />
              </div>
            )}
          </div>

          {line && (
            <ThietLapChuyen
              line={{
                id: line.id,
                ten: line.name,
                ma: line.code,
                soGhe: line._count.seats,
                teamId: line.teamId,
                loai: line.loai,
                orderId: line.currentOrderId,
                shiftId: line.shiftId,
              }}
              lenhs={lenhs.map((l2) => ({
                id: l2.id,
                nhan: `${l2.code} · ${l2.product.name} · ${l2.quantity} ${l2.product.unit}`,
              }))}
              cas={cas.map((c) => ({ id: c.id, ten: c.name }))}
              tos={tos.map((t) => ({ id: t.id, ten: t.name }))}
              tenCa={line.shift?.name ?? null}
              dangChay={
                line.currentOrder
                  ? {
                      ma: line.currentOrder.code,
                      sanPham: line.currentOrder.product.name,
                      maSanPham: line.currentOrder.product.code,
                      soLuong: line.currentOrder.quantity,
                      donVi: line.currentOrder.product.unit,
                      xong: daXongLenh,
                      soNguyenCongLenh: nguyenCongs.length,
                    }
                  : null
              }
              ncDangChon={[...boLoc]}
              ncTatCa={moiNguyenCong.map((o) => ({
                id: o.id,
                ma: o.code,
                ten: o.name,
                giay: o.standardSeconds,
                sanPham: o.section.product.name,
                maSanPham: o.section.product.code,
                boPhan: o.section.name,
              }))}
              daXep={demTheoChuyen.get(line.id) ?? 0}
              tongGhe={line._count.seats}
              duocSuaChuyen={laQuanLy}
            />
          )}

          {line && (
            <SoDoDayChuyen
              ngay={dinhDangNgay(ymd)}
              ymd={ymd}
              chiXem={chiXem}
              coLenh={!!line.currentOrderId && !!line.shiftId}
              tenSanPham={line.currentOrder?.product.name ?? null}
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
