import { redirect } from 'next/navigation'
import { nguoiDangDangNhap } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { ngayHomNay, ngayLamViec, gioHienTai, soPhut, dinhDangNgay } from '@/lib/date'
import { themNgay } from '@/lib/ngay-xep'
import { Header } from '@/components/Header'
import ManHinhNhap from './ManHinhNhap'

export const dynamic = 'force-dynamic'

const DUOC_VAO = ['WORKER', 'TEAM_LEADER']

export default async function TrangCongNhan() {
  const u = await nguoiDangDangNhap()
  if (!u) redirect('/dang-nhap')
  if (u.phaiDoiMatKhau) redirect('/doi-mat-khau')
  if (!DUOC_VAO.includes(u.role)) redirect('/')

  const ymd = ngayHomNay()
  const workDate = ngayLamViec(ymd)

  const assignments = await prisma.assignment.findMany({
    where: { userId: u.id, workDate },
    include: {
      shift: { include: { timeSlots: { where: { isActive: true }, orderBy: { seq: 'asc' } } } },
      orderOperation: {
        include: {
          operation: { include: { section: { include: { product: true } } } },
          order: true,
        },
      },
      entries: { select: { id: true, timeSlotId: true, qtyOk: true, qtyDefect: true, workedMinutes: true, downtimeMinutes: true, downtimeReasonId: true, performance: true, isAchieved: true, status: true } },
      seat: { select: { side: true, seq: true, line: { select: { name: true } } } },
    },
    orderBy: { createdAt: 'asc' },
  })

  // Chỗ ngồi hôm nay và chỗ dự kiến ngày mai — tổ trưởng xếp trước từ hôm trước,
  // công nhân mở app buổi sáng là biết ngay mình ngồi đâu.
  const ngayMai = themNgay(ymd, 1)
  const maiPhanCong = await prisma.assignment.findMany({
    where: { userId: u.id, workDate: ngayLamViec(ngayMai) },
    select: {
      seat: { select: { side: true, seq: true, line: { select: { name: true } } } },
      orderOperation: { select: { operation: { select: { name: true } } } },
    },
  })

  const choHomNay = assignments
    .filter((a) => a.seat)
    .map((a) => ({
      viTri: `${a.seat!.line.name} · ${a.seat!.side}${a.seat!.seq}`,
      viec: a.orderOperation.operation.name,
    }))
  const choNgayMai = maiPhanCong
    .filter((a) => a.seat)
    .map((a) => ({
      viTri: `${a.seat!.line.name} · ${a.seat!.side}${a.seat!.seq}`,
      viec: a.orderOperation.operation.name,
    }))

  const [loaiLoi, lyDoDung] = await Promise.all([
    prisma.defectType.findMany({ where: { isActive: true }, orderBy: { group: 'asc' } }),
    prisma.downtimeReason.findMany({ where: { isActive: true }, orderBy: { code: 'asc' } }),
  ])

  const shift = assignments[0]?.shift ?? null
  const slots = (shift?.timeSlots ?? []).map((s) => ({
    id: s.id,
    label: s.label,
    startTime: s.startTime,
    endTime: s.endTime,
    soPhut: soPhut(s.startTime, s.endTime, s.breakMinutes),
    daBatDau: s.startTime <= gioHienTai(),
  }))

  const dsPhanCong = assignments.map((a) => ({
    id: a.id,
    tenNguyenCong: a.orderOperation.operation.name,
    maNguyenCong: a.orderOperation.operation.code,
    boPhan: a.orderOperation.operation.section.name,
    sanPham: a.orderOperation.operation.section.product.name,
    maLenh: a.orderOperation.order.code,
    dinhMucGiay: a.orderOperation.standardSeconds,
    conLai: a.orderOperation.targetQty - a.orderOperation.doneQtyOk,
    chiTieuCa: a.targetQty,
    // Decimal của Prisma không truyền thẳng sang client được -> đổi sang số
    banGhi: a.entries.map((e) => ({
      timeSlotId: e.timeSlotId,
      qtyOk: e.qtyOk,
      qtyDefect: e.qtyDefect,
      workedMinutes: e.workedMinutes,
      downtimeMinutes: e.downtimeMinutes,
      downtimeReasonId: e.downtimeReasonId,
      performance: e.performance === null ? null : Number(e.performance),
      isAchieved: e.isAchieved,
      status: e.status as string,
    })),
  }))

  return (
    <main className="mx-auto w-full max-w-md px-4 pb-24 pt-4">
      <Header
        tieuDe={u.fullName}
        phu={`${u.employeeCode} · ${dinhDangNgay(ymd)}`}
        nguoiDung={u}
      />

      {choHomNay.length > 0 && (
        <section className="mb-3 rounded-2xl bg-gradient-to-r from-brand-700 to-brand-500 px-4 py-3 text-white shadow-[0_14px_30px_-18px_rgba(37,99,235,0.95)]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/70">
            Chỗ của bạn hôm nay
          </p>
          {choHomNay.map((c) => (
            <p key={c.viTri + c.viec} className="mt-0.5">
              <span className="text-lg font-bold leading-tight">{c.viTri}</span>
              <span className="block text-sm text-white/85">{c.viec}</span>
            </p>
          ))}
        </section>
      )}

      {choNgayMai.length > 0 && (
        <section className="mb-3 rounded-2xl border border-slate-200 bg-white px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
            Dự kiến ngày mai · {dinhDangNgay(ngayMai)}
          </p>
          {choNgayMai.map((c) => (
            <p key={c.viTri + c.viec} className="mt-0.5">
              <span className="font-semibold leading-tight">{c.viTri}</span>
              <span className="block text-sm text-slate-500">{c.viec}</span>
            </p>
          ))}
        </section>
      )}

      {dsPhanCong.length === 0 ? (
        <div className="the text-center text-slate-500">
          <p className="font-medium text-slate-700">
            {choNgayMai.length > 0 ? 'Hôm nay bạn chưa được giao việc' : 'Bạn chưa được giao việc'}
          </p>
          <p className="mt-1 text-sm">
            {choNgayMai.length > 0
              ? 'Ngày mai đã có chỗ rồi — xem ở khung phía trên.'
              : 'Báo tổ trưởng phân công nguyên công cho bạn.'}
          </p>
        </div>
      ) : (
        <ManHinhNhap slots={slots} phanCong={dsPhanCong} loaiLoi={loaiLoi} lyDoDung={lyDoDung} />
      )}
    </main>
  )
}
