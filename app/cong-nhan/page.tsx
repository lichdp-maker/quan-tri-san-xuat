import { redirect } from 'next/navigation'
import { nguoiDangDangNhap } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { ngayHomNay, ngayLamViec, gioHienTai, soPhut, dinhDangNgay } from '@/lib/date'
import { Header } from '@/components/Header'
import ManHinhNhap from './ManHinhNhap'

export const dynamic = 'force-dynamic'

export default async function TrangCongNhan() {
  const u = await nguoiDangDangNhap()
  if (!u) redirect('/dang-nhap')

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
    },
    orderBy: { createdAt: 'asc' },
  })

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

      {dsPhanCong.length === 0 ? (
        <div className="the text-center text-slate-500">
          <p className="font-medium text-slate-700">Hôm nay bạn chưa được giao việc</p>
          <p className="mt-1 text-sm">Báo tổ trưởng phân công nguyên công cho bạn.</p>
        </div>
      ) : (
        <ManHinhNhap slots={slots} phanCong={dsPhanCong} loaiLoi={loaiLoi} lyDoDung={lyDoDung} />
      )}
    </main>
  )
}
