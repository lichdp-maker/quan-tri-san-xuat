import { NextResponse, type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { nguoiDangDangNhap } from '@/lib/session'
import { ngayHomNay, ngayLamViec } from '@/lib/date'

const DUOC_XUAT = ['PLANNER', 'SHOP_MANAGER', 'DEPUTY_DIRECTOR', 'DIRECTOR', 'ENGINEER']

function o(v: unknown): string {
  const s = v === null || v === undefined ? '' : String(v)
  return `"${s.replace(/"/g, '""')}"`
}

/**
 * Xuất số liệu sản lượng và năng suất ra CSV mở được bằng Excel.
 * /bao-cao/xuat?tu=2026-09-01&den=2026-09-18
 */
export async function GET(req: NextRequest) {
  const u = await nguoiDangDangNhap()
  if (!u) return NextResponse.json({ loi: 'Chưa đăng nhập' }, { status: 401 })
  if (!DUOC_XUAT.includes(u.role)) return NextResponse.json({ loi: 'Không có quyền' }, { status: 403 })

  const sp = req.nextUrl.searchParams
  const homNay = ngayHomNay()
  const tu = /^\d{4}-\d{2}-\d{2}$/.test(sp.get('tu') ?? '') ? sp.get('tu')! : homNay
  const den = /^\d{4}-\d{2}-\d{2}$/.test(sp.get('den') ?? '') ? sp.get('den')! : homNay

  const banGhi = await prisma.productionEntry.findMany({
    where: { workDate: { gte: ngayLamViec(tu), lte: ngayLamViec(den) } },
    orderBy: [{ workDate: 'asc' }, { createdAt: 'asc' }],
    include: {
      timeSlot: true,
      downtimeReason: true,
      defects: { include: { defectType: true, cause: true } },
      assignment: {
        include: {
          user: true,
          team: true,
          orderOperation: {
            include: {
              order: { include: { product: true } },
              operation: { include: { section: true } },
            },
          },
        },
      },
    },
  })

  const cot = [
    'Ngày',
    'Mốc giờ',
    'Mã NV',
    'Họ tên',
    'Tổ',
    'Lệnh',
    'Sản phẩm',
    'Bộ phận',
    'Nguyên công',
    'Định mức (giây)',
    'Đạt',
    'Hỏng',
    'Phút làm',
    'Phút dừng',
    'Lý do dừng',
    'Giờ chuẩn (phút)',
    'Năng suất (%)',
    'Xếp loại',
    'Trạng thái',
    'Loại lỗi',
    'Nguyên nhân lỗi',
  ]

  const dong = banGhi.map((e) => {
    const a = e.assignment
    const oo = a.orderOperation
    return [
      e.workDate.toISOString().slice(0, 10),
      e.timeSlot.label,
      a.user.employeeCode,
      a.user.fullName,
      a.team.name,
      oo.order.code,
      oo.order.product.name,
      oo.operation.section.name,
      oo.operation.name,
      oo.standardSeconds,
      e.qtyOk,
      e.qtyDefect,
      e.workedMinutes,
      e.downtimeMinutes,
      e.downtimeReason?.name ?? '',
      e.earnedSeconds === null ? '' : Math.round((e.earnedSeconds / 60) * 100) / 100,
      e.performance === null ? '' : Number(e.performance),
      e.isAchieved === null ? 'chưa xếp loại' : e.isAchieved ? 'đạt' : 'chưa đạt',
      e.status === 'APPROVED' ? 'đã duyệt' : e.status === 'PENDING' ? 'chờ duyệt' : 'bị trả lại',
      e.defects.map((d) => `${d.defectType.name} (${d.qty})`).join(' | '),
      e.defects.map((d) => d.cause?.name ?? '').filter(Boolean).join(' | '),
    ]
  })

  // ﻿ để Excel nhận đúng tiếng Việt UTF-8
  const csv =
    '﻿' + [cot, ...dong].map((r) => r.map(o).join(',')).join('\r\n') + '\r\n'

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="san-luong-${tu}_${den}.csv"`,
      'Cache-Control': 'no-store',
    },
  })
}
