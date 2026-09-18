/**
 * Dữ liệu chạy thử: 1 lệnh sản xuất G6 và phân công cho CN001, CN002 trong hôm nay.
 * Dùng để bấm thử màn hình nhập liệu. Xoá được bất cứ lúc nào.
 *
 * Chạy: npm run db:demo
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

function ngayHomNayVN(): Date {
  const ymd = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
  return new Date(`${ymd}T00:00:00.000Z`)
}

async function main() {
  const workDate = ngayHomNayVN()

  const product = await prisma.product.findUniqueOrThrow({
    where: { code: 'G6' },
    include: { sections: { include: { operations: { where: { isActive: true }, orderBy: { seq: 'asc' } } } } },
  })
  const shift = await prisma.shift.findUniqueOrThrow({ where: { code: 'CA1' } })
  const leader = await prisma.user.findUniqueOrThrow({ where: { employeeCode: 'TT01' } })
  const cn1 = await prisma.user.findUniqueOrThrow({ where: { employeeCode: 'CN001' } })
  const cn2 = await prisma.user.findUniqueOrThrow({ where: { employeeCode: 'CN002' } })
  const team = await prisma.team.findUniqueOrThrow({ where: { code: 'TO1' } })

  const code = 'LSX-DEMO-001'
  const order = await prisma.productionOrder.upsert({
    where: { code },
    update: {},
    create: {
      code,
      productId: product.id,
      quantity: 200,
      status: 'IN_PROGRESS',
      note: 'Lệnh chạy thử, xoá được',
      createdById: leader.id,
      releasedAt: new Date(),
    },
  })

  const ops = product.sections.flatMap((s) => s.operations.map((o) => ({ o, s })))
  for (const { o, s } of ops) {
    await prisma.orderOperation.upsert({
      where: { orderId_operationId: { orderId: order.id, operationId: o.id } },
      update: {},
      create: {
        orderId: order.id,
        operationId: o.id,
        sectionCode: s.code,
        seq: o.seq,
        targetQty: order.quantity,
        standardSeconds: o.standardSeconds,
      },
    })
  }

  const orderOps = await prisma.orderOperation.findMany({
    where: { orderId: order.id },
    orderBy: { seq: 'asc' },
  })

  // CN001 làm 2 nguyên công đầu, CN002 làm nguyên công thứ 3 — để thử tình huống
  // một người nhiều nguyên công trong cùng một mốc giờ.
  const phanCong: Array<[string, (typeof orderOps)[number]]> = [
    [cn1.id, orderOps[0]],
    [cn1.id, orderOps[1]],
    [cn2.id, orderOps[2]],
  ]

  for (const [userId, oo] of phanCong) {
    if (!oo) continue
    await prisma.assignment.upsert({
      where: {
        orderOperationId_userId_workDate_shiftId: {
          orderOperationId: oo.id,
          userId,
          workDate,
          shiftId: shift.id,
        },
      },
      update: {},
      create: {
        orderOperationId: oo.id,
        userId,
        teamId: team.id,
        shiftId: shift.id,
        workDate,
        assignedById: leader.id,
      },
    })
  }

  console.log(`Đã tạo lệnh ${code} (${order.quantity} sp) và ${phanCong.length} phân công cho hôm nay.`)
  console.log('Đăng nhập CN001 / 123456 để thử màn hình nhập liệu.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
