/**
 * Xoá sạch dữ liệu chạy thử do npm run db:thu tạo ra.
 *
 * Xoá: các lệnh mã LSX-TN-* cùng toàn bộ nguyên công, phân công, sản lượng, phiếu lỗi theo lệnh đó.
 * Giữ nguyên: nhân sự, tổ, sản phẩm, định mức, ca, mốc giờ, danh mục lỗi.
 * Dây chuyền được giữ lại nhưng gỡ lệnh đang chạy và xoá nguyên công đã gán cho ghế,
 * trừ khi chạy kèm tham số  --xoa-chuyen  thì xoá luôn 4 chuyền thử.
 *
 * Chạy: npm run db:xoathu
 *       npm run db:xoathu -- --xoa-chuyen
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const TIEN_TO = 'LSX-TN-'
const MA_CHUYEN = ['SC', 'G46', 'GS06', 'BG']

async function main() {
  const xoaChuyen = process.argv.includes('--xoa-chuyen')

  const lenhs = await prisma.productionOrder.findMany({
    where: { code: { startsWith: TIEN_TO } },
    select: { id: true, code: true },
  })
  if (lenhs.length === 0) {
    console.log('Không có lệnh chạy thử nào để xoá.')
  } else {
    const ids = lenhs.map((l) => l.id)

    const oo = await prisma.orderOperation.findMany({ where: { orderId: { in: ids } }, select: { id: true } })
    const ooIds = oo.map((x) => x.id)

    const pc = await prisma.assignment.findMany({
      where: { orderOperationId: { in: ooIds } },
      select: { id: true },
    })
    const pcIds = pc.map((x) => x.id)

    const { count: soLoi } = await prisma.defectRecord.deleteMany({
      where: { entry: { assignmentId: { in: pcIds } } },
    })
    const { count: soBanGhi } = await prisma.productionEntry.deleteMany({
      where: { assignmentId: { in: pcIds } },
    })
    const { count: soPhanCong } = await prisma.assignment.deleteMany({ where: { id: { in: pcIds } } })

    // Gỡ lệnh khỏi dây chuyền trước khi xoá lệnh
    await prisma.line.updateMany({ where: { currentOrderId: { in: ids } }, data: { currentOrderId: null } })

    await prisma.orderOperation.deleteMany({ where: { orderId: { in: ids } } })
    const { count: soLenh } = await prisma.productionOrder.deleteMany({ where: { id: { in: ids } } })

    console.log(
      `Đã xoá ${soLenh} lệnh (${lenhs.map((l) => l.code).join(', ')}), ` +
        `${soPhanCong} phân công, ${soBanGhi} bản ghi sản lượng, ${soLoi} phiếu lỗi.`,
    )
  }

  if (xoaChuyen) {
    const { count } = await prisma.line.deleteMany({ where: { code: { in: MA_CHUYEN } } })
    console.log(`Đã xoá ${count} dây chuyền thử (ghế xoá theo).`)
  } else {
    const { count } = await prisma.seat.updateMany({
      where: { line: { code: { in: MA_CHUYEN } } },
      data: { operationId: null },
    })
    console.log(`Giữ lại 4 dây chuyền, đã gỡ nguyên công khỏi ${count} ghế.`)
    console.log('Muốn xoá luôn chuyền thì chạy: npm run db:xoathu -- --xoa-chuyen')
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
