/**
 * DỮ LIỆU CHẠY THỬ — dựng cả một xưởng ảo để xem và chỉnh giao diện.
 *
 * Tạo: 4 dây chuyền (Sửa chữa, G4/G6, GS06, Bao gói) + ghế + nguyên công cho từng ghế,
 * 2 lệnh sản xuất, phân công công nhân vào ghế, và sản lượng của nhiều ngày gần đây
 * theo đủ 5 mốc giờ, kèm sai hỏng và thời gian dừng.
 *
 * Chạy:        npm run db:thu           (mặc định 5 ngày gần nhất)
 *              npm run db:thu -- 10      (10 ngày)
 * Xoá sạch:    npm run db:xoathu
 *
 * Mọi thứ script này tạo ra đều mang mã bắt đầu bằng LSX-TN- nên xoá lại được hết.
 */
import { PrismaClient, type DefectDisposition, type EntryStatus } from '@prisma/client'

const prisma = new PrismaClient()

const CACH_XU_LY: DefectDisposition[] = ['PENDING', 'REWORK', 'SCRAP', 'USE_AS_IS']

const TZ = 'Asia/Ho_Chi_Minh'
const TIEN_TO = 'LSX-TN-'

/** Bộ sinh số ngẫu nhiên có hạt giống — chạy lại cho ra đúng bộ dữ liệu cũ. */
function taoRng(hat: number) {
  let a = hat >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const rng = taoRng(20260921)
const trongKhoang = (a: number, b: number) => a + rng() * (b - a)
const nguyenTrongKhoang = (a: number, b: number) => Math.floor(trongKhoang(a, b + 1))
const chon = <T>(ds: T[]): T => ds[Math.floor(rng() * ds.length)]

function ymdCuaNgay(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d)
}
const ngayLamViec = (ymd: string) => new Date(`${ymd}T00:00:00.000Z`)
const mocThoiGian = (ymd: string, hhmm: string) => new Date(`${ymd}T${hhmm}:00.000+07:00`)
const gioVN = (d = new Date()) =>
  new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false }).format(d)

function soPhut(batDau: string, ketThuc: string, nghi = 0): number {
  const [h1, m1] = batDau.split(':').map(Number)
  const [h2, m2] = ketThuc.split(':').map(Number)
  let p = h2 * 60 + m2 - (h1 * 60 + m1)
  if (p < 0) p += 1440
  return Math.max(0, p - nghi)
}

/** Danh sách ngày làm việc gần nhất, bỏ Chủ nhật, ngày hôm nay đứng cuối. */
function cacNgay(soNgay: number): string[] {
  const ds: string[] = []
  const now = new Date()
  for (let i = 0; ds.length < soNgay && i < soNgay * 2; i++) {
    const d = new Date(now.getTime() - i * 86400000)
    const thu = new Intl.DateTimeFormat('en-US', { timeZone: TZ, weekday: 'short' }).format(d)
    if (thu !== 'Sun') ds.push(ymdCuaNgay(d))
  }
  return ds.reverse()
}

const CHUYEN = [
  { code: 'SC', name: 'Chuyền sửa chữa', soGhe: 8, nguon: 'G6' as const, lay: 'cuoi' as const },
  { code: 'G46', name: 'Chuyền G4/G6', soGhe: 20, nguon: 'G6' as const, lay: 'dau' as const },
  { code: 'GS06', name: 'Chuyền GS06', soGhe: 20, nguon: 'GS06-LINH' as const, lay: 'dau' as const },
  { code: 'BG', name: 'Chuyền Bao gói', soGhe: 10, nguon: 'GS06-BG' as const, lay: 'dau' as const },
]

async function main() {
  const soNgay = Math.min(Math.max(Number(process.argv[2] ?? '5') || 5, 1), 20)
  const ngays = cacNgay(soNgay)
  console.log(`Dựng dữ liệu thử cho ${ngays.length} ngày: ${ngays[0]} → ${ngays[ngays.length - 1]}`)

  // ---- 1. Dữ liệu nền phải có sẵn --------------------------------------
  const shift = await prisma.shift.findUniqueOrThrow({
    where: { code: 'CA1' },
    include: { timeSlots: { where: { isActive: true }, orderBy: { seq: 'asc' } } },
  })
  if (shift.timeSlots.length === 0) throw new Error('Ca CA1 chưa có mốc giờ nào. Chạy npm run db:seed trước.')

  const g6 = await prisma.product.findUniqueOrThrow({
    where: { code: 'G6' },
    include: { sections: { include: { operations: { where: { isActive: true }, orderBy: { seq: 'asc' } } } } },
  })
  const gs06 = await prisma.product.findUniqueOrThrow({
    where: { code: 'GS06V2' },
    include: {
      sections: {
        orderBy: { seq: 'asc' },
        include: { operations: { where: { isActive: true }, orderBy: { seq: 'asc' } } },
      },
    },
  })

  const nguoiTao =
    (await prisma.user.findFirst({ where: { role: { in: ['SHOP_MANAGER', 'DIRECTOR', 'DEPUTY_DIRECTOR'] } } })) ??
    (await prisma.user.findFirstOrThrow({ where: { role: 'TEAM_LEADER' } }))

  const congNhan = await prisma.user.findMany({
    where: { isActive: true, role: { in: ['WORKER', 'TEAM_LEADER'] }, teamId: { not: null } },
    orderBy: { employeeCode: 'asc' },
  })
  if (congNhan.length < 8) throw new Error('Chưa đủ công nhân. Chạy npm run db:nhansu trước.')

  const lyDoDung = await prisma.downtimeReason.findMany({ where: { isActive: true } })
  const loaiLoi = await prisma.defectType.findMany({ where: { isActive: true } })
  const nguyenNhan = await prisma.defectCause.findMany({ where: { isActive: true } })

  // ---- 2. Hai lệnh sản xuất -------------------------------------------
  const thang = ngays[ngays.length - 1].slice(2, 7).replace('-', '')
  const lenhG6 = await taoLenh(`${TIEN_TO}G6-${thang}`, g6.id, 1500, nguoiTao.id)
  const lenhGS = await taoLenh(`${TIEN_TO}GS06-${thang}`, gs06.id, 800, nguoiTao.id)

  const opG6 = g6.sections.flatMap((s) => s.operations.map((o) => ({ o, sectionCode: s.code })))
  const opGSLinh = gs06.sections
    .filter((s) => !s.dependsOnAllSections)
    .flatMap((s) => s.operations.map((o) => ({ o, sectionCode: s.code })))
  const opGSBaoGoi = gs06.sections
    .filter((s) => s.dependsOnAllSections)
    .flatMap((s) => s.operations.map((o) => ({ o, sectionCode: s.code })))

  await taoNguyenCongChoLenh(lenhG6.id, opG6, lenhG6.quantity)
  await taoNguyenCongChoLenh(lenhGS.id, [...opGSLinh, ...opGSBaoGoi], lenhGS.quantity)

  const ooG6 = await prisma.orderOperation.findMany({ where: { orderId: lenhG6.id } })
  const ooGS = await prisma.orderOperation.findMany({ where: { orderId: lenhGS.id } })
  const traOO = new Map([...ooG6, ...ooGS].map((x) => [`${x.orderId}:${x.operationId}`, x]))
  const traOOId = new Map([...ooG6, ...ooGS].map((x) => [x.id, x]))

  // ---- 3. Bốn dây chuyền + ghế + nguyên công cho ghế -------------------
  const tos = await prisma.team.findMany({ where: { isActive: true }, orderBy: { code: 'asc' } })
  const ghePhu: Array<{ seatId: string; oo: (typeof ooG6)[number]; std: number; chuyen: string }> = []

  for (const [i, c] of CHUYEN.entries()) {
    const lenh = c.nguon === 'G6' ? lenhG6 : lenhGS
    const line = await prisma.line.upsert({
      where: { code: c.code },
      update: { name: c.name, soGhe: c.soGhe, isActive: true, currentOrderId: lenh.id, shiftId: shift.id },
      create: {
        code: c.code,
        name: c.name,
        soGhe: c.soGhe,
        isActive: true,
        teamId: tos[i % tos.length]?.id ?? null,
        currentOrderId: lenh.id,
        shiftId: shift.id,
      },
    })

    const mucA = Math.ceil(c.soGhe / 2)
    const canCo: Array<{ side: 'A' | 'B'; seq: number }> = []
    for (let s = 1; s <= mucA; s++) canCo.push({ side: 'A', seq: s })
    for (let s = 1; s <= c.soGhe - mucA; s++) canCo.push({ side: 'B', seq: s })

    await prisma.seat.createMany({
      data: canCo.map((g) => ({ lineId: line.id, side: g.side, seq: g.seq })),
      skipDuplicates: true,
    })
    const ghe = await prisma.seat.findMany({
      where: { lineId: line.id },
      orderBy: [{ side: 'asc' }, { seq: 'asc' }],
    })

    // Nguồn nguyên công cho chuyền này
    const nguon =
      c.nguon === 'G6' ? opG6 : c.nguon === 'GS06-LINH' ? opGSLinh : opGSBaoGoi
    const dsOp = c.lay === 'cuoi' ? nguon.slice(-ghe.length) : nguon

    for (const [k, g] of ghe.entries()) {
      const nc = dsOp[k % dsOp.length]
      if (!nc) continue
      await prisma.seat.update({ where: { id: g.id }, data: { operationId: nc.o.id } })
      const oo = traOO.get(`${lenh.id}:${nc.o.id}`)
      if (oo) ghePhu.push({ seatId: g.id, oo, std: oo.standardSeconds, chuyen: c.name })
    }
  }

  // ---- 4. Xếp người vào ghế (chừa vài người chưa xếp) ------------------
  const thuTu = [...congNhan].sort(() => rng() - 0.5)
  const soChua = Math.min(6, Math.max(2, Math.floor(thuTu.length * 0.12)))
  const coTheXep = Math.min(ghePhu.length, thuTu.length - soChua)
  const capDoi = ghePhu.slice(0, coTheXep).map((g, i) => ({ ...g, nguoi: thuTu[i] }))
  console.log(`  Xếp ${capDoi.length} người vào ghế, chừa ${thuTu.length - capDoi.length} người chưa xếp.`)

  // ---- 5. Phân công + sản lượng từng ngày ------------------------------
  const gioBayGio = gioVN()
  const homNay = ngays[ngays.length - 1]
  let soBanGhi = 0
  let soLoi = 0
  const congDon = new Map<string, { ok: number; hong: number }>()

  for (const ymd of ngays) {
    const workDate = ngayLamViec(ymd)
    const laHomNay = ymd === homNay

    await prisma.assignment.createMany({
      data: capDoi.map((c) => ({
        orderOperationId: c.oo.id,
        userId: c.nguoi.id,
        teamId: c.nguoi.teamId!,
        shiftId: shift.id,
        workDate,
        seatId: c.seatId,
        assignedById: nguoiTao.id,
      })),
      skipDuplicates: true,
    })

    const pc = await prisma.assignment.findMany({
      where: { workDate, shiftId: shift.id, seatId: { not: null } },
      select: { id: true, userId: true, orderOperationId: true },
    })
    const traPC = new Map(pc.map((p) => [`${p.orderOperationId}:${p.userId}`, p.id]))

    const banGhi: any[] = []

    for (const moc of shift.timeSlots) {
      // Hôm nay chỉ nhập những mốc đã qua
      if (laHomNay && moc.endTime > gioBayGio) continue

      const phutMoc = soPhut(moc.startTime, moc.endTime, moc.breakMinutes)
      const batDau = mocThoiGian(ymd, moc.startTime)
      const ketThuc = mocThoiGian(ymd, moc.endTime)

      for (const c of capDoi) {
        const assignmentId = traPC.get(`${c.oo.id}:${c.nguoi.id}`)
        if (!assignmentId) continue
        if (rng() < 0.04) continue // thỉnh thoảng có người nghỉ mốc đó

        const coDung = rng() < 0.18
        const dung = coDung ? nguyenTrongKhoang(5, 25) : 0
        const lam = phutMoc
        const rong = Math.max(1, lam - dung)

        // Phân bố năng suất: ~22% không đạt, còn lại đạt
        const dich = rng() < 0.22 ? trongKhoang(74, 99) : trongKhoang(101, 132)
        const qtyOk = Math.max(1, Math.round(((dich / 100) * rong * 60) / c.std))
        const qtyDefect = rng() < 0.12 ? nguyenTrongKhoang(1, 3) : 0

        const earned = qtyOk * c.std
        const perf = Math.round(((earned / 60 / rong) * 100 + Number.EPSILON) * 100) / 100
        const status: EntryStatus = laHomNay && moc.seq === shift.timeSlots.length ? 'PENDING' : 'APPROVED'

        banGhi.push({
          assignmentId,
          timeSlotId: moc.id,
          workDate,
          slotStartAt: batDau,
          slotEndAt: ketThuc,
          qtyOk,
          qtyDefect,
          workedMinutes: lam,
          downtimeMinutes: dung,
          downtimeReasonId: coDung && lyDoDung.length ? chon(lyDoDung).id : null,
          earnedSeconds: earned,
          netMinutes: rong,
          performance: perf,
          isAchieved: perf > 100,
          status,
          createdById: c.nguoi.id,
          approvedById: status === 'APPROVED' ? nguoiTao.id : null,
          approvedAt: status === 'APPROVED' ? ketThuc : null,
        })

        if (status === 'APPROVED') {
          const cu = congDon.get(c.oo.id) ?? { ok: 0, hong: 0 }
          congDon.set(c.oo.id, { ok: cu.ok + qtyOk, hong: cu.hong + qtyDefect })
        }
      }
    }

    if (banGhi.length === 0) continue

    const daTao = await prisma.productionEntry.createManyAndReturn({
      data: banGhi,
      skipDuplicates: true,
      select: { id: true, qtyDefect: true },
    })
    soBanGhi += daTao.length

    // Phiếu lỗi cho những bản ghi có hàng hỏng
    const phieu = daTao
      .filter((e) => e.qtyDefect > 0 && loaiLoi.length > 0)
      .map((e) => ({
        entryId: e.id,
        defectTypeId: chon(loaiLoi).id,
        qty: e.qtyDefect,
        causeId: nguyenNhan.length && rng() < 0.7 ? chon(nguyenNhan).id : null,
        disposition: chon(CACH_XU_LY),
      }))
    if (phieu.length) {
      await prisma.defectRecord.createMany({ data: phieu })
      soLoi += phieu.length
    }

    console.log(`  ${ymd}: ${banGhi.length} bản ghi sản lượng`)
  }

  // ---- 6. Cập nhật tiến độ lệnh ---------------------------------------
  for (const [ooId, v] of congDon) {
    const oo = traOOId.get(ooId)
    if (!oo) continue
    await prisma.orderOperation.update({
      where: { id: ooId },
      data: {
        doneQtyOk: Math.min(v.ok, oo.targetQty),
        doneQtyDefect: v.hong,
      },
    })
  }

  await prisma.productionOrder.updateMany({
    where: { code: { startsWith: TIEN_TO } },
    data: { status: 'IN_PROGRESS' },
  })

  console.log('')
  console.log('XONG.')
  console.log(`  4 dây chuyền, ${ghePhu.length} ghế đã gán nguyên công`)
  console.log(`  2 lệnh: ${lenhG6.code} (1500 sp) · ${lenhGS.code} (800 bộ)`)
  console.log(`  ${soBanGhi} bản ghi sản lượng, ${soLoi} phiếu lỗi`)
  console.log('  Xoá lại bằng: npm run db:xoathu')
}

async function taoLenh(code: string, productId: string, quantity: number, createdById: string) {
  return prisma.productionOrder.upsert({
    where: { code },
    update: { quantity, status: 'IN_PROGRESS' },
    create: {
      code,
      productId,
      quantity,
      priority: 10,
      status: 'IN_PROGRESS',
      note: 'Dữ liệu chạy thử — xoá được',
      createdById,
      releasedAt: new Date(),
      dueDate: new Date(Date.now() + 20 * 86400000),
    },
  })
}

async function taoNguyenCongChoLenh(
  orderId: string,
  ops: Array<{ o: { id: string; seq: number; standardSeconds: number }; sectionCode: string }>,
  targetQty: number,
) {
  await prisma.orderOperation.createMany({
    data: ops.map(({ o, sectionCode }) => ({
      orderId,
      operationId: o.id,
      sectionCode,
      seq: o.seq,
      targetQty,
      standardSeconds: o.standardSeconds,
    })),
    skipDuplicates: true,
  })
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
