/**
 * Xoá sạch dữ liệu chạy thử do  npm run db:thu  tạo ra, và TRẢ CẤU HÌNH CHUYỀN VỀ NHƯ CŨ.
 *
 * Xoá:      các lệnh mã LSX-TN-* cùng toàn bộ nguyên công lệnh, phân công, sản lượng, phiếu lỗi.
 * Khôi phục: lệnh đang chạy, ca, nguyên công từng chỗ ngồi — theo file prisma/.thu-nghiem.json
 *           mà db:thu đã chụp lại trước khi đổ dữ liệu.
 * Giữ nguyên: nhân sự, tổ, sản phẩm, định mức, ca, mốc giờ, danh mục lỗi, các chuyền.
 *
 * Chạy: npm run db:xoathu
 *       npm run db:xoathu -- --xoa-chuyen   (chỉ cho dữ liệu thử kiểu CŨ: xoá 4 chuyền SC, G46, GS06, BG)
 */
import { existsSync, readFileSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const TIEN_TO = 'LSX-TN-'
const FILE_KHOI_PHUC = join(process.cwd(), 'prisma', '.thu-nghiem.json')
const MA_CHUYEN_CU = ['SC', 'G46', 'GS06', 'BG']

type BanChup = {
  lines: Array<{ id: string; currentOrderId: string | null; shiftId: string | null }>
  seats: Array<{ id: string; operationId: string | null }>
}

async function main() {
  const xoaChuyen = process.argv.includes('--xoa-chuyen')

  // ---- 1. Trả cấu hình chuyền về như trước khi chạy thử ----------------
  if (existsSync(FILE_KHOI_PHUC)) {
    const chup = JSON.parse(readFileSync(FILE_KHOI_PHUC, 'utf8')) as BanChup

    const lenhCon = new Set(
      (await prisma.productionOrder.findMany({ select: { id: true } })).map((x) => x.id),
    )
    const caCon = new Set((await prisma.shift.findMany({ select: { id: true } })).map((x) => x.id))
    const lineCon = new Set((await prisma.line.findMany({ select: { id: true } })).map((x) => x.id))
    const gheCon = new Set((await prisma.seat.findMany({ select: { id: true } })).map((x) => x.id))

    let soChuyen = 0
    for (const l of chup.lines) {
      if (!lineCon.has(l.id)) continue
      await prisma.line.update({
        where: { id: l.id },
        data: {
          currentOrderId: l.currentOrderId && lenhCon.has(l.currentOrderId) ? l.currentOrderId : null,
          shiftId: l.shiftId && caCon.has(l.shiftId) ? l.shiftId : null,
        },
      })
      soChuyen++
    }

    let soGhe = 0
    for (const g of chup.seats) {
      if (!gheCon.has(g.id)) continue
      await prisma.seat.update({ where: { id: g.id }, data: { operationId: g.operationId } })
      soGhe++
    }
    console.log(`Đã trả về như cũ: lệnh và ca của ${soChuyen} chuyền, nguyên công của ${soGhe} chỗ ngồi.`)
  }

  // ---- 2. Xoá lệnh thử và mọi thứ sinh ra theo lệnh -------------------
  const lenhs = await prisma.productionOrder.findMany({
    where: { code: { startsWith: TIEN_TO } },
    select: { id: true, code: true },
  })
  if (lenhs.length === 0) {
    console.log('Không có lệnh chạy thử nào để xoá.')
  } else {
    const ids = lenhs.map((l) => l.id)
    const ooIds = (
      await prisma.orderOperation.findMany({ where: { orderId: { in: ids } }, select: { id: true } })
    ).map((x) => x.id)
    const pcIds = (
      await prisma.assignment.findMany({ where: { orderOperationId: { in: ooIds } }, select: { id: true } })
    ).map((x) => x.id)

    const { count: soLoi } = await prisma.defectRecord.deleteMany({
      where: { entry: { assignmentId: { in: pcIds } } },
    })
    const { count: soBanGhi } = await prisma.productionEntry.deleteMany({
      where: { assignmentId: { in: pcIds } },
    })
    const { count: soPhanCong } = await prisma.assignment.deleteMany({ where: { id: { in: pcIds } } })

    // Chuyền nào còn trỏ vào lệnh thử (không có trong bản chụp) thì gỡ ra
    await prisma.line.updateMany({ where: { currentOrderId: { in: ids } }, data: { currentOrderId: null } })

    await prisma.orderOperation.deleteMany({ where: { orderId: { in: ids } } })
    const { count: soLenh } = await prisma.productionOrder.deleteMany({ where: { id: { in: ids } } })

    console.log(
      `Đã xoá ${soLenh} lệnh thử (${lenhs.map((l) => l.code).join(', ')}), ` +
        `${soPhanCong} phân công, ${soBanGhi} bản ghi sản lượng, ${soLoi} phiếu lỗi.`,
    )
  }

  if (existsSync(FILE_KHOI_PHUC)) {
    unlinkSync(FILE_KHOI_PHUC)
    console.log('Đã xoá file bản chụp prisma/.thu-nghiem.json.')
  }

  // ---- 3. Dữ liệu thử kiểu cũ (4 chuyền SC, G46, GS06, BG) -------------
  if (xoaChuyen) {
    const { count } = await prisma.line.deleteMany({ where: { code: { in: MA_CHUYEN_CU } } })
    console.log(`Đã xoá ${count} chuyền thử kiểu cũ (ghế xoá theo).`)
  }
}

main()
  .catch((e) => {
    console.error('\nLỖI:', e instanceof Error ? e.message : e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
