import { redirect } from 'next/navigation'
import { nguoiDangDangNhap } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { ngayHomNay, ngayLamViec, gioHienTai, soPhut, dinhDangNgay } from '@/lib/date'
import { themNgay } from '@/lib/ngay-xep'
import { coQuyen } from '@/lib/chuc-nang'
import { Header } from '@/components/Header'
import ManHinhNhap from './ManHinhNhap'
import YKienCuaToi from './YKienCuaToi'

export const dynamic = 'force-dynamic'

export default async function TrangCongNhan() {
  const u = await nguoiDangDangNhap()
  if (!u) redirect('/dang-nhap')
  if (u.phaiDoiMatKhau) redirect('/doi-mat-khau')
  if (!coQuyen(u.quyen, 'NHAP_SAN_LUONG')) redirect('/')

  const ymd = ngayHomNay()
  const workDate = ngayLamViec(ymd)
  const ngayMai = themNgay(ymd, 1)

  const [assignments, maiPhanCong, loaiLoi, lyDoDung, yKien] = await Promise.all([
    prisma.assignment.findMany({
      where: { userId: u.id, workDate },
      include: {
        shift: { include: { timeSlots: { where: { isActive: true }, orderBy: { seq: 'asc' } } } },
        orderOperation: {
          include: {
            operation: { include: { section: { include: { product: true } } } },
            order: true,
          },
        },
        entries: {
          select: {
            timeSlotId: true,
            qtyOk: true,
            qtyDefect: true,
            workedMinutes: true,
            downtimeMinutes: true,
            downtimeReasonId: true,
            performance: true,
            isAchieved: true,
            status: true,
            defects: { select: { defectTypeId: true, qty: true } },
          },
        },
        seat: { select: { side: true, seq: true, line: { select: { name: true } } } },
      },
      orderBy: { createdAt: 'asc' },
    }),
    // Chỗ dự kiến ngày mai — tổ trưởng xếp trước từ hôm trước
    prisma.assignment.findMany({
      where: { userId: u.id, workDate: ngayLamViec(ngayMai) },
      select: {
        seat: { select: { side: true, seq: true, line: { select: { name: true } } } },
        orderOperation: { select: { operation: { select: { name: true } } } },
      },
    }),
    prisma.defectType.findMany({ where: { isActive: true }, orderBy: [{ group: 'asc' }, { code: 'asc' }] }),
    prisma.downtimeReason.findMany({ where: { isActive: true }, orderBy: { code: 'asc' } }),
    prisma.yKien.findMany({
      where: { userId: u.id },
      orderBy: { createdAt: 'desc' },
      take: 8,
      select: { id: true, loai: true, noiDung: true, trangThai: true, phanHoi: true, createdAt: true },
    }),
  ])

  const gio = gioHienTai()
  const shift = assignments[0]?.shift ?? null
  const slots = (shift?.timeSlots ?? []).map((s) => ({
    id: s.id,
    label: s.label,
    startTime: s.startTime,
    endTime: s.endTime,
    soPhut: soPhut(s.startTime, s.endTime, s.breakMinutes),
    daBatDau: s.startTime <= gio,
  }))

  const dsPhanCong = assignments.map((a) => ({
    id: a.id,
    tenChuyen: a.seat?.line.name ?? null,
    viTri: a.seat ? `${a.seat.side}${a.seat.seq}` : null,
    tenNguyenCong: a.orderOperation.operation.name,
    maNguyenCong: a.orderOperation.operation.code,
    sanPham: a.orderOperation.operation.section.product.name,
    maLenh: a.orderOperation.order.code,
    dinhMucGiay: a.orderOperation.standardSeconds,
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
      loi: e.defects.map((d) => ({ defectTypeId: d.defectTypeId, qty: d.qty })),
    })),
  }))

  const choNgayMai = maiPhanCong
    .filter((a) => a.seat)
    .map((a) => ({
      viTri: `${a.seat!.line.name} · ${a.seat!.side}${a.seat!.seq}`,
      viec: a.orderOperation.operation.name,
    }))

  return (
    <main className="mx-auto w-full max-w-md px-4 pb-32 pt-4">
      <Header tieuDe={u.fullName} phu={`${u.employeeCode} · ${dinhDangNgay(ymd)}`} nguoiDung={u} />

      {dsPhanCong.length === 0 ? (
        <div className="the mb-4 text-center">
          <p className="text-lg font-semibold text-slate-800">Hôm nay bạn chưa được giao việc</p>
          <p className="mt-1 text-slate-500">
            {choNgayMai.length > 0
              ? 'Ngày mai đã có chỗ — xem ở khung bên dưới.'
              : 'Báo tổ trưởng xếp chỗ cho bạn.'}
          </p>
        </div>
      ) : (
        <ManHinhNhap
          slots={slots}
          phanCong={dsPhanCong}
          loaiLoi={loaiLoi.map((l) => ({ id: l.id, ma: l.code, ten: l.name, nhom: l.group }))}
          lyDoDung={lyDoDung.map((l) => ({ id: l.id, ten: l.name }))}
        />
      )}

      <YKienCuaToi
        viec={dsPhanCong.map((p) => ({
          assignmentId: p.id,
          nhan: [p.tenChuyen, p.viTri, p.tenNguyenCong].filter(Boolean).join(' · '),
        }))}
        daGui={yKien.map((y) => ({
          id: y.id,
          loai: y.loai,
          noiDung: y.noiDung,
          trangThai: y.trangThai,
          phanHoi: y.phanHoi,
          luc: y.createdAt.toISOString(),
        }))}
      />

      {choNgayMai.length > 0 && (
        <section className="mt-4 rounded-2xl border border-slate-200 bg-white px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Dự kiến ngày mai · {dinhDangNgay(ngayMai)}
          </p>
          {choNgayMai.map((c) => (
            <p key={c.viTri + c.viec} className="mt-1">
              <span className="block font-semibold leading-tight">{c.viTri}</span>
              <span className="block text-slate-600">{c.viec}</span>
            </p>
          ))}
        </section>
      )}
    </main>
  )
}
