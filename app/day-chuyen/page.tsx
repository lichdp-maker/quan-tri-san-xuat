import { redirect } from 'next/navigation'
import { nguoiDangDangNhap, TEN_VAI_TRO } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { ngayHomNay, ngayLamViec, dinhDangNgay } from '@/lib/date'
import { Header } from '@/components/Header'
import { laNgayHopLe, cachNgay, themNgay } from '@/lib/ngay-xep'
import { coQuyen } from '@/lib/chuc-nang'
import BanXepCho from './BanXepCho'
import ThemDayChuyen from './ThemDayChuyen'
import TongQuanChuyen from './TongQuanChuyen'

export const dynamic = 'force-dynamic'

export default async function TrangDayChuyen({
  searchParams,
}: {
  searchParams: Promise<{ dc?: string; ngay?: string }>
}) {
  const u = await nguoiDangDangNhap()
  if (!u) redirect('/dang-nhap')
  if (u.phaiDoiMatKhau) redirect('/doi-mat-khau')
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
  const laToTruong = u.role === 'TEAM_LEADER'
  const laQuanLy = coQuyen(u.quyen, 'SAP_XEP_MAT_BANG')

  const [lines, tos, cas, lenhs, xepTrongNgay] = await Promise.all([
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
    // Ai đang ngồi ở đâu trong ngày — trên MỌI chuyền, để biết người nào đã có việc nơi khác
    prisma.assignment.findMany({
      where: { workDate, seatId: { not: null } },
      select: { userId: true, seatId: true, seat: { select: { lineId: true, side: true, seq: true } } },
    }),
  ])

  // Có ?dc= thì mở bàn xếp của chuyền đó (lớp 2); không có thì xem tổng quan mọi chuyền (lớp 1)
  const line = dc ? (lines.find((l) => l.id === dc) ?? null) : null

  if (lines.length === 0) {
    return (
      <main className="mx-auto w-full max-w-7xl px-4 py-5">
        <Header tieuDe="Sơ đồ sắp xếp nhân sự" phu={`${u.fullName} · ${TEN_VAI_TRO[u.role]}`} nguoiDung={u} />
        <div className="the flex flex-col gap-3">
          <p className="font-medium">
            Chưa có chuyền nào. Bấm <strong>+ Thêm chuyền</strong> rồi dùng nút điền nhanh để tạo các chuyền của
            xưởng.
          </p>
          {laQuanLy && <ThemDayChuyen tos={tos} daCo={[]} />}
        </div>
      </main>
    )
  }

  const homTruocYmd = themNgay(ymd, -1)

  // ===================== LỚP 1: TỔNG QUAN MỌI CHUYỀN =====================
  if (!line) {
    const [moiGhe, xepHomTruoc, nguoiTrongPhamVi] = await Promise.all([
      prisma.seat.findMany({
        where: { line: { isActive: true } },
        select: { id: true, lineId: true, side: true, operationId: true },
        orderBy: [{ side: 'asc' }, { seq: 'asc' }],
      }),
      prisma.assignment.findMany({
        where: { workDate: ngayLamViec(homTruocYmd), seatId: { not: null } },
        select: { seat: { select: { lineId: true } } },
      }),
      prisma.user.findMany({
        where: {
          isActive: true,
          role: { in: ['WORKER', 'TEAM_LEADER'] },
          tinhTrang: { in: ['DANG_LAM', 'TANG_CUONG', 'MUA_VU'] },
          ...(laToTruong ? { teamId: u.teamId ?? '' } : {}),
        },
        select: { id: true },
      }),
    ])

    const choCoNguoi = new Set(xepTrongNgay.map((x) => x.seatId))
    const nguoiCoCho = new Set(xepTrongNgay.map((x) => x.userId))
    const demHomTruoc = new Map<string, number>()
    for (const x of xepHomTruoc) {
      demHomTruoc.set(x.seat!.lineId, (demHomTruoc.get(x.seat!.lineId) ?? 0) + 1)
    }

    const theChuyen = lines.map((l) => {
      const ghe = moiGhe.filter((g) => g.lineId === l.id)
      const coNguoi = ghe.filter((g) => choCoNguoi.has(g.id)).length
      return {
        id: l.id,
        ten: l.name,
        loai: l.loai,
        tang: l.tang,
        to: l.team?.name ?? null,
        laCuaToi: laToTruong && !!u.teamId && l.teamId === u.teamId,
        tongCho: ghe.length,
        coNguoi,
        choTrong: ghe.filter((g) => g.operationId && !choCoNguoi.has(g.id)).length,
        chuaNC: ghe.filter((g) => !g.operationId).length,
        coLenh: !!l.currentOrderId && !!l.shiftId,
        lenh: l.currentOrder ? `${l.currentOrder.code} · ${l.currentOrder.product.name}` : null,
        ca: l.shift?.name ?? null,
        ghe: ghe.map((g) => ({ mat: g.side as 'A' | 'B', coNguoi: choCoNguoi.has(g.id), coNC: !!g.operationId })),
        homTruoc: demHomTruoc.get(l.id) ?? 0,
      }
    })

    return (
      <main className="mx-auto w-full max-w-7xl px-4 py-5">
        <Header
          tieuDe="Sơ đồ sắp xếp nhân sự"
          phu={`${u.fullName} · ${TEN_VAI_TRO[u.role]} · chọn một chuyền để xếp`}
          nguoiDung={u}
        />
        <TongQuanChuyen
          ymd={ymd}
          homNay={homNay}
          chiXem={chiXem}
          chuyens={theChuyen}
          tongCongNhan={nguoiTrongPhamVi.length}
          tongChuaCoCho={nguoiTrongPhamVi.filter((n) => !nguoiCoCho.has(n.id)).length}
          oThemChuyen={
            laQuanLy ? <ThemDayChuyen tos={tos} daCo={lines.flatMap((l) => [l.code, l.name])} /> : null
          }
        />
      </main>
    )
  }

  // ===================== LỚP 2: BÀN XẾP CỦA MỘT CHUYỀN =====================

  const [ghe, nguyenCongs, ncCuaChuyen, moiNguyenCong, congNhan, soHomTruoc] = await Promise.all([
    prisma.seat.findMany({
      where: { lineId: line.id },
      orderBy: [{ side: 'asc' }, { seq: 'asc' }],
      include: {
        operation: true,
        assignments: {
          where: { workDate },
          take: 1,
          include: { user: true, _count: { select: { entries: true } } },
        },
      },
    }),
    line.currentOrderId
      ? prisma.orderOperation.findMany({
          where: { orderId: line.currentOrderId },
          include: { operation: { include: { section: true } } },
          orderBy: [{ sectionCode: 'asc' }, { seq: 'asc' }],
        })
      : Promise.resolve([]),
    prisma.lineOperation.findMany({ where: { lineId: line.id }, select: { operationId: true } }),
    laQuanLy
      ? prisma.operation.findMany({
          where: { isActive: true },
          include: { section: { include: { product: true } } },
          orderBy: [{ section: { seq: 'asc' } }, { seq: 'asc' }],
        })
      : Promise.resolve([]),
    // Tổ trưởng chỉ thấy người trong tổ mình; quản lý thấy toàn bộ người đang làm việc
    prisma.user.findMany({
      where: {
        isActive: true,
        role: { in: ['WORKER', 'TEAM_LEADER'] },
        tinhTrang: { in: ['DANG_LAM', 'TANG_CUONG', 'MUA_VU'] },
        ...(laToTruong ? { teamId: u.teamId ?? '' } : {}),
      },
      include: { team: true },
      orderBy: [{ team: { code: 'asc' } }, { employeeCode: 'asc' }],
    }),
    prisma.assignment.count({
      where: { workDate: ngayLamViec(homTruocYmd), seat: { lineId: line.id } },
    }),
  ])

  // Nguyên công chuyền này đảm nhận. Rỗng = chưa giới hạn, làm mọi nguyên công của lệnh.
  const boLoc = new Set(ncCuaChuyen.map((x) => x.operationId))

  // Chỗ mỗi người đang giữ ở CHUYỀN KHÁC trong ngày
  const tenChuyen = new Map(lines.map((l) => [l.id, l.name]))
  const noiKhac = new Map<string, string[]>()
  for (const x of xepTrongNgay) {
    const s = x.seat!
    if (s.lineId === line.id) continue
    const nhan = `${tenChuyen.get(s.lineId) ?? '?'} ${s.side}${s.seq}`
    noiKhac.set(x.userId, [...(noiKhac.get(x.userId) ?? []), nhan])
  }

  const o = line.currentOrder
  const xong = nguyenCongs.length > 0 ? Math.min(...nguyenCongs.map((oo) => oo.doneQtyOk)) : 0
  const coLenh = !!line.currentOrderId && !!line.shiftId

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-5">
      <Header
        tieuDe="Sơ đồ sắp xếp nhân sự"
        phu={`${u.fullName} · ${TEN_VAI_TRO[u.role]} · ${dinhDangNgay(homNay)}`}
        nguoiDung={u}
      />

      <BanXepCho
        // Đổi chuyền hoặc đổi ngày thì dựng lại toàn bộ trạng thái bàn xếp
        key={`${line.id}-${ymd}`}
        ymd={ymd}
        homNay={homNay}
        chiXem={chiXem}
        lineId={line.id}
        tenChuyen={line.name}
        loai={line.loai}
        coLenh={coLenh}
        dongLenh={
          o && line.shift
            ? {
                sanPham: o.product.name,
                chiTiet: `Lệnh ${o.code} · ${line.shift.name} · ${xong.toLocaleString('vi-VN')}/${o.quantity.toLocaleString('vi-VN')} ${o.product.unit}`,
                pct: o.quantity > 0 ? Math.min(100, Math.round((xong / o.quantity) * 100)) : 0,
              }
            : null
        }
        ghe={ghe.map((g) => {
          const a = g.assignments[0]
          return {
            id: g.id,
            mat: g.side as 'A' | 'B',
            so: g.seq,
            ncId: g.operationId,
            ncTen: g.operation?.name ?? null,
            ncGiay: g.operation?.standardSeconds ?? null,
            nguoi: a
              ? { id: a.userId, ma: a.user.employeeCode, ten: a.user.fullName, daNhap: a._count.entries > 0 }
              : null,
          }
        })}
        congNhan={congNhan.map((c) => ({
          id: c.id,
          ma: c.employeeCode,
          ten: c.fullName,
          to: c.team?.name ?? 'Chưa thuộc tổ',
          noiKhac: noiKhac.get(c.id) ?? [],
        }))}
        nguyenCongs={nguyenCongs
          .filter((oo) => boLoc.size === 0 || boLoc.has(oo.operationId))
          .map((oo) => ({
            id: oo.operationId,
            ten: oo.operation.name,
            boPhan: oo.operation.section.name,
            giay: oo.standardSeconds,
          }))}
        toMacDinh={line.team?.name ?? null}
        homTruoc={{ ymd: homTruocYmd, soNguoi: soHomTruoc }}
        caiDat={{
          line: {
            id: line.id,
            ten: line.name,
            ma: line.code,
            soGhe: line._count.seats,
            teamId: line.teamId,
            loai: line.loai,
            orderId: line.currentOrderId,
            shiftId: line.shiftId,
          },
          lenhs: lenhs.map((l2) => ({
            id: l2.id,
            nhan: `${l2.code} · ${l2.product.name} · ${l2.quantity} ${l2.product.unit}`,
          })),
          cas: cas.map((c) => ({ id: c.id, ten: c.name })),
          tos: tos.map((t) => ({ id: t.id, ten: t.name })),
          ncTatCa: moiNguyenCong.map((op) => ({
            id: op.id,
            ma: op.code,
            ten: op.name,
            giay: op.standardSeconds,
            sanPham: op.section.product.name,
            maSanPham: op.section.product.code,
            boPhan: op.section.name,
          })),
          ncDangChon: [...boLoc],
          duocSuaChuyen: laQuanLy,
        }}
      />
    </main>
  )
}
