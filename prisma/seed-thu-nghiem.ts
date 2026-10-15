/**
 * DỮ LIỆU CHẠY THỬ — đổ số liệu giả lên CHÍNH CÁC CHUYỀN ĐANG CÓ để xem hệ thống chạy.
 *
 * Làm gì:
 *  - Tạo lệnh thử LSX-TN-* (G6 và GS06), gắn vào các chuyền hiện có theo tên chuyền.
 *  - Gán nguyên công cho những chỗ ngồi chưa có nguyên công phù hợp.
 *  - Xếp công nhân vào chỗ cho N ngày gần nhất + hôm nay; vài người làm 2 việc;
 *    mỗi ngày vài người vắng; chừa vài người chưa có chỗ.
 *  - Sinh sản lượng theo từng mốc giờ: mỗi người có tay nghề riêng nên có người
 *    luôn đạt, có người hay hụt; thỉnh thoảng có dừng máy và hàng hỏng.
 *  - Hôm nay: các mốc đã qua có số, mốc mới nhất để "chờ duyệt".
 *  - Ngày mai: chỉ xếp sẵn cho chuyền lớn nhất — chuyền khác để trống để thử
 *    nút "Chép y như hôm nay".
 *
 * Trước khi đổ, script CHỤP LẠI cấu hình chuyền (lệnh, ca, nguyên công từng chỗ)
 * vào prisma/.thu-nghiem.json. Lệnh xoá dùng file đó để trả mọi thứ về như cũ.
 *
 * Chạy:      npm run db:thu            (6 ngày làm việc gần nhất + hôm nay)
 *            npm run db:thu -- 12      (12 ngày)
 * Xoá sạch:  npm run db:xoathu
 */
import { existsSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { PrismaClient, type DefectDisposition, type EntryStatus, type Prisma } from '@prisma/client'

const prisma = new PrismaClient()

const TIEN_TO = 'LSX-TN-'
const FILE_KHOI_PHUC = join(process.cwd(), 'prisma', '.thu-nghiem.json')
const TZ = 'Asia/Ho_Chi_Minh'
const CACH_XU_LY: DefectDisposition[] = ['PENDING', 'REWORK', 'SCRAP', 'USE_AS_IS']

/* ---------------- tiện ích ---------------- */

/** Số ngẫu nhiên có hạt giống — chạy lại ra đúng bộ số cũ. */
function taoRng(hat: number) {
  let a = hat >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const rng = taoRng(20261016)
const khoang = (a: number, b: number) => a + rng() * (b - a)
const nguyen = (a: number, b: number) => Math.floor(khoang(a, b + 1))
const chon = <T>(ds: T[]): T => ds[Math.floor(rng() * ds.length)]
function tron<T>(ds: T[]): T[] {
  const a = [...ds]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

const ymdVN = (d: Date) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d)
const gioVN = () =>
  new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date())
const ngayLamViec = (ymd: string) => new Date(`${ymd}T00:00:00.000Z`)
const moc = (ymd: string, hhmm: string) => new Date(`${ymd}T${hhmm}:00.000+07:00`)
function themNgay(ymd: string, n: number) {
  const d = new Date(`${ymd}T00:00:00.000Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}
const laChuNhat = (ymd: string) => new Date(`${ymd}T00:00:00.000Z`).getUTCDay() === 0

function soPhut(a: string, b: string, nghi = 0) {
  const [h1, m1] = a.split(':').map(Number)
  const [h2, m2] = b.split(':').map(Number)
  let p = h2 * 60 + m2 - (h1 * 60 + m1)
  if (p < 0) p += 1440
  return Math.max(0, p - nghi)
}

function khongDau(s: string) {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
}

type Op = {
  id: string
  name: string
  standardSeconds: number
  targetPercent: number
  sectionCode: string
  seq: number
  productId: string
}

/* ---------------- chương trình chính ---------------- */

async function main() {
  const soNgayTruoc = Math.min(Math.max(Number(process.argv[2] ?? '6') || 6, 1), 20)

  // ---- 0. Không đổ chồng lên lần trước --------------------------------
  const lenhCu = await prisma.productionOrder.count({ where: { code: { startsWith: TIEN_TO } } })
  if (existsSync(FILE_KHOI_PHUC) || lenhCu > 0) {
    throw new Error(
      'Đang có dữ liệu chạy thử từ lần trước. Chạy  npm run db:xoathu  để xoá và trả cấu hình chuyền về như cũ, rồi chạy lại.',
    )
  }

  const homNay = ymdVN(new Date())
  const gioBayGio = gioVN()
  const ngays: string[] = []
  for (let i = 1; ngays.length < soNgayTruoc && i < 60; i++) {
    const d = themNgay(homNay, -i)
    if (!laChuNhat(d)) ngays.unshift(d)
  }
  ngays.push(homNay)
  const ngayMai = themNgay(homNay, laChuNhat(themNgay(homNay, 1)) ? 2 : 1)

  // ---- 1. Dữ liệu nền --------------------------------------------------
  const cacCa = await prisma.shift.findMany({
    where: { isActive: true },
    include: { timeSlots: { where: { isActive: true }, orderBy: { seq: 'asc' } } },
    orderBy: { code: 'asc' },
  })
  const ca =
    cacCa.find((c) => c.code === 'CA1' && c.timeSlots.length > 0) ?? cacCa.find((c) => c.timeSlots.length > 0)
  if (!ca) throw new Error('Chưa có ca nào có mốc giờ. Vào Quản trị → Ca & mốc giờ để tạo trước.')

  const sanPhams = await prisma.product.findMany({
    where: { isActive: true, code: { in: ['G6', 'GS06V2'] } },
    include: {
      sections: {
        where: { isActive: true },
        orderBy: { seq: 'asc' },
        include: {
          operations: { where: { isActive: true, standardSeconds: { gt: 0 } }, orderBy: { seq: 'asc' } },
        },
      },
    },
  })
  const G6 = sanPhams.find((p) => p.code === 'G6')
  const GS = sanPhams.find((p) => p.code === 'GS06V2')
  if (!G6 && !GS) throw new Error('Chưa có sản phẩm G6 / GS06V2 và định mức. Chạy npm run db:seed trước.')

  const opsCua = (p: (typeof sanPhams)[number] | undefined, loc?: (sectionCode: string, ten: string) => boolean): Op[] =>
    !p
      ? []
      : p.sections.flatMap((s) =>
          s.operations
            .filter((o) => !loc || loc(s.code, khongDau(o.name)))
            .map((o) => ({
              id: o.id,
              name: o.name,
              standardSeconds: o.standardSeconds,
              targetPercent: o.targetPercent,
              sectionCode: s.code,
              seq: o.seq,
              productId: p.id,
            })),
        )
  const laKiem = (t: string) => /kiem|hieu chinh|do dong|fct/.test(t)

  /** Đoán phần việc của chuyền theo tên — cấu hình nguyên công của chuyền (nếu có) luôn được ưu tiên. */
  function doanNguyenCong(tenChuyen: string): Op[] {
    const t = khongDau(tenChuyen)
    let ds: Op[] = []
    if (/bao goi/.test(t)) ds = opsCua(GS, (s) => s === 'BG')
    else if (/khoi/.test(t)) ds = opsCua(GS, (s, o) => s === 'HD' && laKiem(o))
    else if (/nhiet/.test(t)) ds = opsCua(GS, (s, o) => s === 'HT' && laKiem(o))
    else if (/gs ?06/.test(t)) ds = opsCua(GS, (s) => s !== 'BG')
    else if (/cai tao|sua chua/.test(t)) ds = opsCua(G6).slice(0, 8)
    if (ds.length === 0) ds = opsCua(G6).length ? opsCua(G6) : opsCua(GS)
    return ds
  }

  const nguoiDuyet =
    (await prisma.user.findFirst({
      where: { role: { in: ['SHOP_MANAGER', 'DIRECTOR', 'DEPUTY_DIRECTOR'] }, isActive: true },
    })) ?? (await prisma.user.findFirstOrThrow({ where: { isActive: true } }))

  const congNhan = await prisma.user.findMany({
    where: {
      isActive: true,
      role: { in: ['WORKER', 'TEAM_LEADER'] },
      teamId: { not: null },
      tinhTrang: { in: ['DANG_LAM', 'TANG_CUONG', 'MUA_VU'] },
    },
    orderBy: { employeeCode: 'asc' },
  })
  if (congNhan.length < 6) throw new Error('Chưa đủ công nhân. Chạy npm run db:nhansu trước.')

  const lines = await prisma.line.findMany({
    where: { isActive: true },
    include: {
      seats: { orderBy: [{ side: 'asc' }, { seq: 'asc' }] },
      operations: { include: { operation: { include: { section: true } } } },
    },
  })
  const coGhe = lines.filter((l) => l.seats.length > 0).sort((a, b) => b.seats.length - a.seats.length)
  if (coGhe.length === 0) {
    throw new Error('Chưa có chuyền nào có chỗ ngồi. Vào Sơ đồ sắp xếp nhân sự → Thêm chuyền trước.')
  }

  const lyDoDung = await prisma.downtimeReason.findMany({ where: { isActive: true } })
  const loaiLoi = await prisma.defectType.findMany({ where: { isActive: true } })
  const nguyenNhan = await prisma.defectCause.findMany({ where: { isActive: true } })

  // ---- 2. Chụp lại cấu hình để khôi phục --------------------------------
  writeFileSync(
    FILE_KHOI_PHUC,
    JSON.stringify(
      {
        taoLuc: new Date().toISOString(),
        ghiChu: 'File tự sinh bởi npm run db:thu — npm run db:xoathu dùng để trả cấu hình chuyền về như cũ. Đừng sửa tay.',
        lines: lines.map((l) => ({ id: l.id, currentOrderId: l.currentOrderId, shiftId: l.shiftId })),
        seats: lines.flatMap((l) => l.seats.map((g) => ({ id: g.id, operationId: g.operationId }))),
      },
      null,
      2,
    ),
  )

  // ---- 3. Phần việc từng chuyền + lệnh thử -----------------------------
  const theoChuyen = coGhe.map((l) => {
    const cauHinh: Op[] = l.operations
      .filter((lo) => lo.operation.isActive && lo.operation.standardSeconds > 0)
      .map((lo) => ({
        id: lo.operation.id,
        name: lo.operation.name,
        standardSeconds: lo.operation.standardSeconds,
        targetPercent: lo.operation.targetPercent,
        sectionCode: lo.operation.section.code,
        seq: lo.operation.seq,
        productId: lo.operation.section.productId,
      }))
    const ops = cauHinh.length > 0 ? cauHinh : doanNguyenCong(l.name)
    // Sản phẩm của chuyền = sản phẩm chiếm nhiều nguyên công nhất
    const dem = new Map<string, number>()
    for (const o of ops) dem.set(o.productId, (dem.get(o.productId) ?? 0) + 1)
    const productId = [...dem.entries()].sort((a, b) => b[1] - a[1])[0][0]
    return { line: l, ops: ops.filter((o) => o.productId === productId), productId }
  })

  const thang = homNay.slice(2, 7).replace('-', '')
  const lenhTheoSP = new Map<string, { id: string; code: string }>()
  for (const p of sanPhams) {
    if (!theoChuyen.some((c) => c.productId === p.id)) continue
    const laG6 = p.code === 'G6'
    const lenh = await prisma.productionOrder.create({
      data: {
        code: `${TIEN_TO}${p.code}-${thang}`,
        productId: p.id,
        quantity: laG6 ? 3000 : 1200,
        priority: 10,
        status: 'IN_PROGRESS',
        note: 'Dữ liệu chạy thử — npm run db:xoathu để xoá',
        createdById: nguoiDuyet.id,
        releasedAt: moc(ngays[0], '07:30'),
        // GS06 hạn gấp để thấy cảnh báo "sắp hạn" trên lưới lệnh
        dueDate: moc(themNgay(homNay, laG6 ? 18 : 4), '00:00'),
      },
    })
    await prisma.orderOperation.createMany({
      data: opsCua(p).map((o) => ({
        orderId: lenh.id,
        operationId: o.id,
        sectionCode: o.sectionCode,
        seq: o.seq,
        targetQty: lenh.quantity,
        standardSeconds: o.standardSeconds,
      })),
    })
    lenhTheoSP.set(p.id, lenh)
  }

  // Một lệnh nhỏ đã quá hạn, không chạy trên chuyền nào — để thấy dòng đỏ trên lưới lệnh
  if (G6) {
    const tre = await prisma.productionOrder.create({
      data: {
        code: `${TIEN_TO}G6-GAP`,
        productId: G6.id,
        quantity: 400,
        status: 'IN_PROGRESS',
        note: 'Dữ liệu chạy thử — lệnh trễ hạn',
        createdById: nguoiDuyet.id,
        releasedAt: moc(themNgay(homNay, -20), '07:30'),
        dueDate: moc(themNgay(homNay, -3), '00:00'),
      },
    })
    await prisma.orderOperation.createMany({
      data: opsCua(G6).map((o, i) => ({
        orderId: tre.id,
        operationId: o.id,
        sectionCode: o.sectionCode,
        seq: o.seq,
        targetQty: 400,
        standardSeconds: o.standardSeconds,
        doneQtyOk: 260 + ((i * 7) % 40),
        doneQtyDefect: i % 5 === 0 ? 3 : 0,
      })),
    })
  }

  const ooTheoKhoa = new Map<string, { id: string; standardSeconds: number }>()
  for (const lenh of lenhTheoSP.values()) {
    const ds = await prisma.orderOperation.findMany({ where: { orderId: lenh.id } })
    for (const oo of ds) ooTheoKhoa.set(`${oo.orderId}:${oo.operationId}`, oo)
  }

  // ---- 4. Gắn lệnh + ca cho chuyền, nguyên công cho chỗ ngồi ------------
  type Cho = { seatId: string; lineId: string; oo: { id: string; standardSeconds: number }; target: number }
  const choTheoChuyen = new Map<string, Cho[]>()

  for (const c of theoChuyen) {
    const lenh = lenhTheoSP.get(c.productId)!
    await prisma.line.update({ where: { id: c.line.id }, data: { currentOrderId: lenh.id, shiftId: ca.id } })

    const hopLe = new Set(c.ops.map((o) => o.id))
    const ds: Cho[] = []
    for (const [k, g] of c.line.seats.entries()) {
      let opId = g.operationId
      // Giữ nguyên công anh đã gán nếu nó thuộc phần việc của chuyền; chỗ chưa có / lệch thì gán theo thứ tự
      if (!opId || !hopLe.has(opId)) {
        opId = c.ops[k % c.ops.length].id
        await prisma.seat.update({ where: { id: g.id }, data: { operationId: opId } })
      }
      const oo = ooTheoKhoa.get(`${lenh.id}:${opId}`)
      const op = c.ops.find((o) => o.id === opId)
      if (oo && op) ds.push({ seatId: g.id, lineId: c.line.id, oo, target: op.targetPercent })
    }
    choTheoChuyen.set(c.line.id, ds)
  }

  // ---- 5. Xếp người: ưu tiên người cùng tổ với chuyền ------------------
  const conLai = tron(congNhan)
  const chuaXep = conLai.splice(0, Math.min(3, Math.max(1, Math.floor(congNhan.length * 0.07))))
  type Xep = { cho: Cho; nguoi: (typeof congNhan)[number]; phut: number }
  const bangXep: Xep[] = []

  for (const c of theoChuyen) {
    const ds = choTheoChuyen.get(c.line.id) ?? []
    const canXep = Math.max(1, Math.round(ds.length * (ds.length > 4 ? 0.9 : 1)))
    for (const cho of ds.slice(0, canXep)) {
      if (conLai.length === 0) break
      let i = conLai.findIndex((n) => n.teamId === c.line.teamId)
      if (i < 0) i = 0
      const nguoi = conLai.splice(i, 1)[0]
      bangXep.push({ cho, nguoi, phut: 1 })
    }
  }

  // Vài người làm thêm việc thứ hai ở chỗ còn trống của chuyền nhỏ (kiểm khói, kiểm nhiệt…)
  const choTrong = [...theoChuyen]
    .reverse()
    .flatMap((c) => choTheoChuyen.get(c.line.id) ?? [])
    .filter((cho) => !bangXep.some((x) => x.cho.seatId === cho.seatId))
  const lamHaiViec = new Set<string>()
  for (const cho of choTrong.slice(0, 3)) {
    const ung = bangXep.find((x) => x.cho.lineId !== cho.lineId && x.phut === 1 && !lamHaiViec.has(x.nguoi.id))
    if (!ung) break
    lamHaiViec.add(ung.nguoi.id)
    ung.phut = 0.7 // 70% thời gian ở việc chính, 30% ở việc phụ
    bangXep.push({ cho, nguoi: ung.nguoi, phut: 0.3 })
  }

  console.log(
    `Xếp ${new Set(bangXep.map((x) => x.nguoi.id)).size} người vào ${bangXep.length} chỗ trên ${theoChuyen.length} chuyền.`,
  )
  console.log(`  ${lamHaiViec.size} người làm 2 việc; ${chuaXep.length + conLai.length} người chưa có chỗ.`)

  // Tay nghề riêng từng người: khoảng 1/5 hay hụt, còn lại đạt hoặc vượt
  const tayNghe = new Map(congNhan.map((n) => [n.id, rng() < 0.2 ? khoang(0.8, 0.96) : khoang(0.98, 1.28)]))

  // ---- 6. Phân công + sản lượng từng ngày ------------------------------
  let soBanGhi = 0
  let soPhieuLoi = 0
  const congDon = new Map<string, { ok: number; hong: number }>()

  async function taoPhanCong(ymd: string, ds: Xep[]) {
    const workDate = ngayLamViec(ymd)
    await prisma.assignment.createMany({
      data: ds.map((x) => ({
        orderOperationId: x.cho.oo.id,
        userId: x.nguoi.id,
        teamId: x.nguoi.teamId!,
        shiftId: ca!.id,
        workDate,
        seatId: x.cho.seatId,
        assignedById: nguoiDuyet.id,
      })),
      skipDuplicates: true,
    })
    const pc = await prisma.assignment.findMany({
      where: { workDate, shiftId: ca!.id, seatId: { in: ds.map((x) => x.cho.seatId) } },
      select: { id: true, seatId: true },
    })
    return new Map(pc.map((p) => [p.seatId!, p.id]))
  }

  for (const ymd of ngays) {
    const laHomNay = ymd === homNay
    // Mỗi ngày 1–3 người vắng (mọi việc của họ đều trống ngày đó)
    const vang = new Set(tron([...new Set(bangXep.map((x) => x.nguoi.id))]).slice(0, nguyen(1, 3)))
    const dsNgay = bangXep.filter((x) => !vang.has(x.nguoi.id))
    const pcTheoCho = await taoPhanCong(ymd, dsNgay)

    const mocDaQua = ca.timeSlots.filter((m) => !laHomNay || m.endTime <= gioBayGio)
    const mocMoiNhat = mocDaQua[mocDaQua.length - 1]?.id
    const banGhi: Prisma.ProductionEntryCreateManyInput[] = []

    for (const m of mocDaQua) {
      const phutMoc = soPhut(m.startTime, m.endTime, m.breakMinutes)
      for (const x of dsNgay) {
        const assignmentId = pcTheoCho.get(x.cho.seatId)
        if (!assignmentId) continue
        if (rng() < 0.03) continue // thỉnh thoảng quên nhập mốc đó

        const lam = Math.max(1, Math.floor(phutMoc * x.phut))
        const coDung = rng() < 0.15 && lam > 10
        const dung = coDung ? Math.min(lam - 5, nguyen(5, 20)) : 0
        const rong = Math.max(1, lam - dung)

        const nangSuat = (tayNghe.get(x.nguoi.id) ?? 1) * khoang(0.9, 1.1)
        const std = x.cho.oo.standardSeconds
        const qtyOk = Math.max(1, Math.round((nangSuat * rong * 60) / std))
        const qtyDefect = rng() < 0.1 ? nguyen(1, 3) : 0
        const earned = qtyOk * std
        const perf = Math.round((earned / 60 / rong) * 10000) / 100

        // Hôm nay: mốc mới nhất còn chờ tổ trưởng duyệt
        const status: EntryStatus = laHomNay && m.id === mocMoiNhat ? 'PENDING' : 'APPROVED'

        banGhi.push({
          assignmentId,
          timeSlotId: m.id,
          workDate: ngayLamViec(ymd),
          slotStartAt: moc(ymd, m.startTime),
          slotEndAt: moc(ymd, m.endTime),
          qtyOk,
          qtyDefect,
          workedMinutes: lam,
          downtimeMinutes: dung,
          downtimeReasonId: coDung && lyDoDung.length ? chon(lyDoDung).id : null,
          earnedSeconds: earned,
          netMinutes: rong,
          performance: perf,
          isAchieved: perf > x.cho.target,
          status,
          createdById: x.nguoi.id,
          approvedById: status === 'APPROVED' ? nguoiDuyet.id : null,
          approvedAt: status === 'APPROVED' ? moc(ymd, m.endTime) : null,
        })

        if (status === 'APPROVED') {
          const cu = congDon.get(x.cho.oo.id) ?? { ok: 0, hong: 0 }
          congDon.set(x.cho.oo.id, { ok: cu.ok + qtyOk, hong: cu.hong + qtyDefect })
        }
      }
    }

    if (banGhi.length > 0) {
      const daTao = await prisma.productionEntry.createManyAndReturn({
        data: banGhi,
        skipDuplicates: true,
        select: { id: true, qtyDefect: true },
      })
      soBanGhi += daTao.length
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
        soPhieuLoi += phieu.length
      }
    }
    console.log(`  ${ymd}: ${dsNgay.length} chỗ có người, ${vang.size} người vắng, ${banGhi.length} bản ghi`)
  }

  // Ngày mai: xếp sẵn cho chuyền lớn nhất, chuyền khác để trống để thử nút chép
  const chuyenLon = theoChuyen[0].line
  const xepMai = bangXep.filter((x) => x.cho.lineId === chuyenLon.id)
  await taoPhanCong(ngayMai, xepMai)
  console.log(`  ${ngayMai} (ngày mai): xếp sẵn ${xepMai.length} chỗ cho ${chuyenLon.name}, các chuyền khác để trống`)

  // ---- 7. Tiến độ lệnh --------------------------------------------------
  for (const lenh of lenhTheoSP.values()) {
    const ds = await prisma.orderOperation.findMany({ where: { orderId: lenh.id } })
    const coSo = ds.filter((oo) => congDon.has(oo.id))
    const tb = coSo.length ? coSo.reduce((a, oo) => a + congDon.get(oo.id)!.ok, 0) / coSo.length : 0
    for (const oo of ds) {
      const v = congDon.get(oo.id)
      // Nguyên công không ai làm trong dữ liệu thử: giả lập quanh mức trung bình (coi như chuyền khác làm)
      const ok = v ? v.ok : Math.round(tb * khoang(0.85, 1.05))
      await prisma.orderOperation.update({
        where: { id: oo.id },
        data: { doneQtyOk: Math.min(ok, oo.targetQty), doneQtyDefect: v?.hong ?? 0 },
      })
    }
  }

  console.log('')
  console.log('XONG.')
  console.log(
    `  Lệnh thử: ${[...lenhTheoSP.values()].map((l) => l.code).join(', ')}${G6 ? `, ${TIEN_TO}G6-GAP (trễ hạn)` : ''}`,
  )
  console.log(`  ${soBanGhi} bản ghi sản lượng, ${soPhieuLoi} phiếu lỗi`)
  console.log('  Cấu hình chuyền cũ đã lưu ở prisma/.thu-nghiem.json')
  console.log('  Xoá và trả về như cũ: npm run db:xoathu')
}

main()
  .catch((e) => {
    console.error('\nLỖI:', e instanceof Error ? e.message : e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
