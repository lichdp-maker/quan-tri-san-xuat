'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { batBuocDangNhap } from '@/lib/session'
import { ngoaiPhamViTo } from '@/lib/quyen'
import { ngayHomNay, ngayLamViec, dinhDangNgay } from '@/lib/date'
import { kiemTraNgayXep } from '@/lib/ngay-xep'

const QUAN_LY = ['TEAM_LEADER', 'SHOP_MANAGER', 'DEPUTY_DIRECTOR', 'DIRECTOR'] as const

export type KetQua = { ok?: boolean; loi?: string; chu?: string }

// Tổ trưởng chỉ thao tác trên dây chuyền của tổ mình. Trang /day-chuyen liệt kê
// mọi chuyền cho tổ trưởng xem, nên nếu không kiểm ở đây thì họ gửi thẳng id ghế
// của chuyền tổ khác và sửa được phân công của tổ đó.

/**
 * Tạo dây chuyền mới kèm đủ ghế.
 *
 * Trả về lỗi thay vì im lặng bỏ qua: trùng mã hay số ghế sai mà không báo gì thì
 * người dùng bấm xong không thấy chuyền đâu, tưởng hệ thống hỏng.
 */
export async function taoDayChuyen(input: {
  code: string
  name: string
  soGhe: number
  teamId?: string
  loai?: 'CHUYEN' | 'BAN' | 'MAY'
  tang?: number
}): Promise<KetQua> {
  const u = await batBuocDangNhap('SHOP_MANAGER', 'DEPUTY_DIRECTOR', 'DIRECTOR')

  const code = input.code.trim().toUpperCase()
  const name = input.name.trim()
  const soGhe = Math.round(Number(input.soGhe))
  const loai = input.loai ?? 'CHUYEN'
  const tang = input.tang ?? 2

  if (!code) return { loi: 'Chưa nhập mã chuyền.' }
  if (!name) return { loi: 'Chưa nhập tên chuyền.' }
  if (!Number.isFinite(soGhe) || soGhe < 1 || soGhe > 60) {
    return { loi: 'Số ghế phải từ 1 đến 60.' }
  }

  const trungMa = await prisma.line.findUnique({ where: { code } })
  if (trungMa) {
    return {
      loi: trungMa.isActive
        ? `Mã ${code} đã dùng cho chuyền "${trungMa.name}". Đặt mã khác.`
        : `Mã ${code} thuộc chuyền "${trungMa.name}" đang ngừng dùng. Bật lại "Còn dùng" ở mục Sửa chuyền thay vì tạo mới.`,
    }
  }

  // Xếp chuyền mới xuống dưới những chuyền đã có trên cùng tầng, để không
  // chồng lên nhau ở góc trên trái của sơ đồ mặt bằng.
  const cungTang = await prisma.line.findMany({
    where: { tang, isActive: true },
    select: { viTriY: true, cao: true },
  })
  const duoiCung = cungTang.reduce((m, l) => Math.max(m, l.viTriY + l.cao), 0)
  const viTriY = Math.min(duoiCung + 3, 85)

  const moiMat = Math.ceil(soGhe / 2)

  const line = await prisma.$transaction(async (tx) => {
    const l = await tx.line.create({
      data: {
        code,
        name,
        soGhe,
        loai,
        tang,
        viTriY,
        viTriX: 4,
        rong: loai === 'MAY' ? 12 : 55,
        cao: 10,
        teamId: input.teamId || null,
      },
    })

    // Máy và dãy bàn xếp một hàng; băng chuyền chia đều hai mặt.
    const ghe: Array<{ lineId: string; seq: number; side: 'A' | 'B' }> = []
    if (loai === 'CHUYEN') {
      for (let i = 1; i <= moiMat; i++) ghe.push({ lineId: l.id, seq: i, side: 'A' })
      for (let i = 1; i <= soGhe - moiMat; i++) ghe.push({ lineId: l.id, seq: i, side: 'B' })
    } else {
      for (let i = 1; i <= soGhe; i++) ghe.push({ lineId: l.id, seq: i, side: 'A' })
    }
    await tx.seat.createMany({ data: ghe })

    await tx.auditLog.create({
      data: {
        userId: u.id,
        action: 'TAO_DAY_CHUYEN',
        entityType: 'Line',
        entityId: l.id,
        after: { code, name, soGhe, loai, tang },
      },
    })
    return l
  })

  revalidatePath('/day-chuyen')
  revalidatePath('/so-do-xuong')
  return { ok: true, chu: line.id }
}

/**
 * Sửa một dây chuyền đã có: đổi tên, đổi tổ, tăng giảm số ghế, hoặc cho ngừng dùng.
 * Tăng ghế thì thêm vào cho đủ hai mặt; giảm ghế chỉ xóa được những ghế chưa ai ngồi.
 */
export async function doiDayChuyen(formData: FormData): Promise<void> {
  const u = await batBuocDangNhap('SHOP_MANAGER', 'DEPUTY_DIRECTOR', 'DIRECTOR')

  const lineId = String(formData.get('lineId') ?? '')
  const name = String(formData.get('name') ?? '').trim()
  const soGhe = Number(String(formData.get('soGhe') ?? '0'))
  const teamId = String(formData.get('teamId') ?? '')
  const conDung = String(formData.get('conDung') ?? '') === 'co'
  const loaiThu = String(formData.get('loai') ?? '')
  const loai = ['CHUYEN', 'BAN', 'MAY'].includes(loaiThu)
    ? (loaiThu as 'CHUYEN' | 'BAN' | 'MAY')
    : undefined
  if (!lineId || !name || !Number.isFinite(soGhe) || soGhe < 1 || soGhe > 60) return

  await prisma.$transaction(async (tx) => {
    await tx.line.update({
      where: { id: lineId },
      data: { name, soGhe, teamId: teamId || null, isActive: conDung, ...(loai ? { loai } : {}) },
    })

    const ghe = await tx.seat.findMany({ where: { lineId }, select: { id: true, side: true, seq: true } })
    const mucA = Math.ceil(soGhe / 2)

    for (const [side, muc] of [
      ['A', mucA],
      ['B', soGhe - mucA],
    ] as const) {
      const hienCo = ghe.filter((g) => g.side === side)
      const coSeq = new Set(hienCo.map((g) => g.seq))

      const them: Array<{ lineId: string; side: 'A' | 'B'; seq: number }> = []
      for (let i = 1; i <= muc; i++) if (!coSeq.has(i)) them.push({ lineId, side, seq: i })
      if (them.length) await tx.seat.createMany({ data: them })

      const du = hienCo.filter((g) => g.seq > muc).map((g) => g.id)
      if (du.length) {
        await tx.seat.deleteMany({ where: { id: { in: du }, assignments: { none: {} } } })
      }
    }

    await tx.auditLog.create({
      data: {
        userId: u.id,
        action: 'SUA_DAY_CHUYEN',
        entityType: 'Line',
        entityId: lineId,
        after: { name, soGhe, isActive: conDung, loai },
      },
    })
  })

  revalidatePath('/day-chuyen')
  revalidatePath('/so-do-xuong')
}

/** Chọn lệnh sản xuất đang chạy trên dây chuyền và ca làm việc. */
export async function datLenhChoDayChuyen(formData: FormData): Promise<void> {
  const u = await batBuocDangNhap(...QUAN_LY)

  const lineId = String(formData.get('lineId') ?? '')
  const orderId = String(formData.get('orderId') ?? '')
  const shiftId = String(formData.get('shiftId') ?? '')
  if (!lineId) return

  const line = await prisma.line.findUnique({ where: { id: lineId }, select: { teamId: true } })
  if (!line || ngoaiPhamViTo(u.role, u.teamId, line.teamId)) return

  await prisma.line.update({
    where: { id: lineId },
    data: { currentOrderId: orderId || null, shiftId: shiftId || null },
  })

  await prisma.auditLog.create({
    data: { userId: u.id, action: 'DAT_LENH_DAY_CHUYEN', entityType: 'Line', entityId: lineId, after: { orderId } },
  })

  revalidatePath('/day-chuyen')
}

/** Gán nguyên công cho một vị trí ngồi. */
export async function ganNguyenCongChoGhe(seatId: string, operationId: string): Promise<KetQua> {
  const u = await batBuocDangNhap(...QUAN_LY)
  if (!seatId) return { loi: 'Thiếu vị trí.' }

  const ghe = await prisma.seat.findUnique({
    where: { id: seatId },
    select: { line: { select: { teamId: true } } },
  })
  if (!ghe) return { loi: 'Không tìm thấy vị trí ngồi.' }
  if (ngoaiPhamViTo(u.role, u.teamId, ghe.line.teamId)) {
    return { loi: 'Dây chuyền này không thuộc tổ của bạn.' }
  }

  await prisma.seat.update({
    where: { id: seatId },
    data: { operationId: operationId || null },
  })

  await prisma.auditLog.create({
    data: { userId: u.id, action: 'GAN_NGUYEN_CONG_GHE', entityType: 'Seat', entityId: seatId, after: { operationId } },
  })

  revalidatePath('/day-chuyen')
  return { ok: true }
}

/**
 * Kéo một công nhân vào vị trí ngồi.
 * Tạo luôn phân công của hôm nay cho nguyên công gắn với vị trí đó.
 */
export async function ganNguoiVaoGhe(
  seatId: string,
  userId: string,
  ymd?: string,
): Promise<KetQua> {
  const u = await batBuocDangNhap(...QUAN_LY)

  const homNay = ngayHomNay()
  const ngay = ymd || homNay
  const loiNgay = kiemTraNgayXep(ngay, homNay)
  if (loiNgay) return { loi: loiNgay }

  const seat = await prisma.seat.findUnique({
    where: { id: seatId },
    include: { line: true, operation: true },
  })
  if (!seat) return { loi: 'Không tìm thấy vị trí ngồi.' }
  if (ngoaiPhamViTo(u.role, u.teamId, seat.line.teamId)) {
    return { loi: 'Dây chuyền này không thuộc tổ của bạn.' }
  }
  if (!seat.operationId) return { loi: `Vị trí ${seat.side}${seat.seq} chưa gán nguyên công.` }
  if (!seat.line.currentOrderId) return { loi: 'Dây chuyền chưa chọn lệnh sản xuất đang chạy.' }
  if (!seat.line.shiftId) return { loi: 'Dây chuyền chưa chọn ca làm việc.' }

  const cn = await prisma.user.findUnique({ where: { id: userId } })
  if (!cn || !cn.isActive || !cn.teamId) return { loi: 'Công nhân không hợp lệ hoặc chưa thuộc tổ nào.' }
  if (u.role === 'TEAM_LEADER' && cn.teamId !== u.teamId) return { loi: 'Người này không thuộc tổ của bạn.' }

  const oo = await prisma.orderOperation.findUnique({
    where: { orderId_operationId: { orderId: seat.line.currentOrderId, operationId: seat.operationId } },
  })
  if (!oo) return { loi: 'Nguyên công của vị trí này không thuộc lệnh đang chạy.' }

  const workDate = ngayLamViec(ngay)

  // Một vị trí chỉ một người trong ngày: gỡ người cũ ra trước
  await prisma.assignment.deleteMany({
    where: { seatId, workDate, entries: { none: {} } },
  })

  await prisma.assignment.upsert({
    where: {
      orderOperationId_userId_workDate_shiftId: {
        orderOperationId: oo.id,
        userId,
        workDate,
        shiftId: seat.line.shiftId,
      },
    },
    update: { seatId, teamId: cn.teamId },
    create: {
      orderOperationId: oo.id,
      userId,
      teamId: cn.teamId,
      shiftId: seat.line.shiftId,
      workDate,
      seatId,
      assignedById: u.id,
    },
  })

  await prisma.auditLog.create({
    data: {
      userId: u.id,
      action: 'GAN_NGUOI_VAO_GHE',
      entityType: 'Seat',
      entityId: seatId,
      after: { userId, operationId: seat.operationId },
    },
  })

  // Nhắc nếu người này còn đang ngồi ở chuyền khác trong cùng ngày
  const noiKhac = await prisma.assignment.findMany({
    where: { userId, workDate, seatId: { not: null }, seat: { lineId: { not: seat.lineId } } },
    select: { seat: { select: { side: true, seq: true, line: { select: { name: true } } } } },
  })

  revalidatePath('/day-chuyen')
  return {
    ok: true,
    chu:
      noiKhac.length > 0
        ? `Lưu ý: ${cn.fullName} còn đang ngồi ở ${noiKhac
            .map((n) => `${n.seat!.line.name} ${n.seat!.side}${n.seat!.seq}`)
            .join(', ')}.`
        : undefined,
  }
}

/** Gỡ người khỏi vị trí. Chỉ gỡ được khi người đó chưa nhập số liệu nào. */
export async function goNguoiKhoiGhe(seatId: string, ymd?: string): Promise<KetQua> {
  const u = await batBuocDangNhap(...QUAN_LY)

  const homNay = ngayHomNay()
  const ngay = ymd || homNay
  const loiNgay = kiemTraNgayXep(ngay, homNay)
  if (loiNgay) return { loi: loiNgay }

  const workDate = ngayLamViec(ngay)

  const ghe = await prisma.seat.findUnique({
    where: { id: seatId },
    select: { line: { select: { teamId: true } } },
  })
  if (!ghe) return { loi: 'Không tìm thấy vị trí ngồi.' }
  if (ngoaiPhamViTo(u.role, u.teamId, ghe.line.teamId)) {
    return { loi: 'Dây chuyền này không thuộc tổ của bạn.' }
  }

  const pc = await prisma.assignment.findFirst({
    where: { seatId, workDate },
    include: { _count: { select: { entries: true } } },
  })
  if (!pc) return { ok: true }
  if (pc._count.entries > 0) return { loi: 'Người này đã nhập số liệu, không gỡ được. Hãy sửa bản ghi thay vì gỡ.' }

  await prisma.assignment.delete({ where: { id: pc.id } })
  await prisma.auditLog.create({
    data: { userId: u.id, action: 'GO_NGUOI_KHOI_GHE', entityType: 'Seat', entityId: seatId },
  })

  revalidatePath('/day-chuyen')
  return { ok: true }
}

/**
 * Chọn những nguyên công mà chuyền này đảm nhận.
 *
 * Mỗi chuyền chỉ làm một phần công đoạn: chuyền lắp ráp làm phần lắp, bàn đầu
 * kiểm làm phần kiểm, chuyền bao gói làm phần bao gói. Danh sách này lọc lại ô
 * chọn nguyên công của từng ghế, để tổ trưởng không phải lội qua 83 nguyên công
 * mới tìm ra 6 cái thuộc chuyền mình.
 *
 * Để trống danh sách = chuyền làm mọi nguyên công của lệnh đang chạy.
 */
export async function datNguyenCongChoChuyen(
  lineId: string,
  operationIds: string[],
): Promise<KetQua> {
  const u = await batBuocDangNhap('ENGINEER', 'SHOP_MANAGER', 'DEPUTY_DIRECTOR', 'DIRECTOR')
  if (!lineId) return { loi: 'Thiếu dây chuyền.' }

  const line = await prisma.line.findUnique({ where: { id: lineId }, select: { id: true } })
  if (!line) return { loi: 'Không tìm thấy dây chuyền.' }

  // Chỉ nhận id nguyên công có thật và còn dùng
  const hopLe = await prisma.operation.findMany({
    where: { id: { in: operationIds }, isActive: true },
    select: { id: true },
  })

  await prisma.$transaction(async (tx) => {
    await tx.lineOperation.deleteMany({ where: { lineId } })
    if (hopLe.length > 0) {
      await tx.lineOperation.createMany({
        data: hopLe.map((o, i) => ({ lineId, operationId: o.id, seq: i + 1 })),
      })
    }
    await tx.auditLog.create({
      data: {
        userId: u.id,
        action: 'DAT_NGUYEN_CONG_CHUYEN',
        entityType: 'Line',
        entityId: lineId,
        after: { soNguyenCong: hopLe.length },
      },
    })
  })

  revalidatePath('/day-chuyen')
  revalidatePath('/so-do-xuong')
  return { ok: true }
}

/** Đổi vị trí và kích thước của một chuyền trên sơ đồ mặt bằng xưởng. */
export async function doiViTriChuyen(input: {
  lineId: string
  tang?: number
  viTriX?: number
  viTriY?: number
  rong?: number
  cao?: number
  loai?: 'CHUYEN' | 'BAN' | 'MAY'
}): Promise<KetQua> {
  const u = await batBuocDangNhap('SHOP_MANAGER', 'DEPUTY_DIRECTOR', 'DIRECTOR')
  if (!input.lineId) return { loi: 'Thiếu dây chuyền.' }

  const trongKhoang = (v: number | undefined, min: number, max: number) =>
    v === undefined ? undefined : Math.min(max, Math.max(min, Math.round(v)))

  const data = {
    tang: trongKhoang(input.tang, 1, 9),
    viTriX: trongKhoang(input.viTriX, 0, 95),
    viTriY: trongKhoang(input.viTriY, 0, 92),
    rong: trongKhoang(input.rong, 5, 100),
    cao: trongKhoang(input.cao, 4, 60),
    loai: input.loai,
  }

  await prisma.line.update({ where: { id: input.lineId }, data })
  await prisma.auditLog.create({
    data: {
      userId: u.id,
      action: 'DOI_VI_TRI_CHUYEN',
      entityType: 'Line',
      entityId: input.lineId,
      after: data as object,
    },
  })

  revalidatePath('/so-do-xuong')
  return { ok: true }
}

/**
 * Nhân bản sắp xếp nhân sự của một ngày sang ngày khác.
 *
 * Hôm sau thường ngồi y như hôm trước, nên chép lại rồi chỉnh vài chỗ nhanh hơn
 * nhiều so với xếp lại từ đầu. Chép theo VỊ TRÍ: ai ngồi ghế nào hôm nguồn thì
 * ngồi đúng ghế đó ngày đích. Nguyên công và lệnh lấy theo cấu hình HIỆN TẠI của
 * chuyền, không lấy theo ngày nguồn — vì lệnh có thể đã đổi.
 */
export async function chepPhanCong(input: {
  tuNgay: string
  denNgay: string
  lineId?: string
  ghiDe?: boolean
}): Promise<KetQua> {
  const u = await batBuocDangNhap(...QUAN_LY)

  const homNay = ngayHomNay()
  const loiNgay = kiemTraNgayXep(input.denNgay, homNay)
  if (loiNgay) return { loi: loiNgay }
  if (input.tuNgay === input.denNgay) return { loi: 'Ngày nguồn và ngày đích trùng nhau.' }

  const tu = ngayLamViec(input.tuNgay)
  const den = ngayLamViec(input.denNgay)

  const chuyens = await prisma.line.findMany({
    where: { isActive: true, ...(input.lineId ? { id: input.lineId } : {}) },
    select: {
      id: true,
      name: true,
      teamId: true,
      currentOrderId: true,
      shiftId: true,
      seats: { select: { id: true, side: true, seq: true, operationId: true } },
    },
  })
  if (chuyens.length === 0) return { loi: 'Không tìm thấy chuyền nào để chép.' }

  let daChep = 0
  let boQuaCoNguoi = 0
  let boQuaChuaCauHinh = 0
  const canhBao: string[] = []

  for (const c of chuyens) {
    if (ngoaiPhamViTo(u.role, u.teamId, c.teamId)) continue

    if (!c.currentOrderId || !c.shiftId) {
      canhBao.push(`${c.name}: chưa chọn lệnh hoặc ca`)
      continue
    }

    const gheTheoId = new Map(c.seats.map((g) => [g.id, g]))
    const idGhe = c.seats.map((g) => g.id)
    if (idGhe.length === 0) continue

    const nguon = await prisma.assignment.findMany({
      where: { workDate: tu, seatId: { in: idGhe } },
      select: { seatId: true, userId: true, user: { select: { isActive: true, teamId: true } } },
    })
    if (nguon.length === 0) continue

    const dich = await prisma.assignment.findMany({
      where: { workDate: den, seatId: { in: idGhe } },
      select: { id: true, seatId: true, _count: { select: { entries: true } } },
    })
    const dangCo = new Map(dich.map((d) => [d.seatId!, d]))

    for (const n of nguon) {
      const ghe = gheTheoId.get(n.seatId!)
      if (!ghe || !ghe.operationId) {
        boQuaChuaCauHinh++
        continue
      }
      if (!n.user.isActive || !n.user.teamId) continue
      if (u.role === 'TEAM_LEADER' && n.user.teamId !== u.teamId) continue

      const cu = dangCo.get(n.seatId!)
      if (cu) {
        if (!input.ghiDe || cu._count.entries > 0) {
          boQuaCoNguoi++
          continue
        }
        await prisma.assignment.delete({ where: { id: cu.id } })
      }

      const oo = await prisma.orderOperation.findUnique({
        where: {
          orderId_operationId: { orderId: c.currentOrderId, operationId: ghe.operationId },
        },
        select: { id: true },
      })
      if (!oo) {
        boQuaChuaCauHinh++
        continue
      }

      await prisma.assignment.upsert({
        where: {
          orderOperationId_userId_workDate_shiftId: {
            orderOperationId: oo.id,
            userId: n.userId,
            workDate: den,
            shiftId: c.shiftId,
          },
        },
        update: { seatId: n.seatId, teamId: n.user.teamId },
        create: {
          orderOperationId: oo.id,
          userId: n.userId,
          teamId: n.user.teamId,
          shiftId: c.shiftId,
          workDate: den,
          seatId: n.seatId,
          assignedById: u.id,
        },
      })
      daChep++
    }
  }

  await prisma.auditLog.create({
    data: {
      userId: u.id,
      action: 'CHEP_PHAN_CONG',
      entityType: 'Assignment',
      entityId: input.lineId ?? 'TAT_CA',
      after: { tuNgay: input.tuNgay, denNgay: input.denNgay, daChep },
    },
  })

  revalidatePath('/day-chuyen')
  revalidatePath('/so-do-xuong')

  if (daChep === 0 && boQuaCoNguoi === 0 && boQuaChuaCauHinh === 0) {
    return { loi: `Ngày ${dinhDangNgay(input.tuNgay)} chưa có ai được xếp chỗ để chép.` }
  }

  const phu: string[] = []
  if (boQuaCoNguoi > 0) phu.push(`${boQuaCoNguoi} chỗ ngày đích đã có người nên giữ nguyên`)
  if (boQuaChuaCauHinh > 0) phu.push(`${boQuaChuaCauHinh} chỗ chưa gán nguyên công theo lệnh mới`)
  if (canhBao.length > 0) phu.push(canhBao.join('; '))

  return {
    ok: true,
    chu: `Đã chép ${daChep} người sang ngày ${dinhDangNgay(input.denNgay)}${
      phu.length > 0 ? ` · ${phu.join(' · ')}` : ''
    }.`,
  }
}
