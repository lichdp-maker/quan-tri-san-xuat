/**
 * Dựng sơ đồ mặt bằng xưởng theo bản vẽ tay: tầng 2 có chuyền cải tạo, hai chuyền
 * lắp ráp, máy HC khói, và hàng kiểm ở dưới; tầng 1 có dây chuyền bao gói.
 *
 * Chạy lại được nhiều lần: chuyền đã có thì chỉ cập nhật vị trí, không tạo trùng,
 * không đụng tới ghế hay phân công.
 *
 * Chạy: npm run db:matbang
 */
import { PrismaClient, type LoaiViTri } from '@prisma/client'

const prisma = new PrismaClient()

type ViTri = {
  code: string
  name: string
  loai: LoaiViTri
  soGhe: number
  tang: number
  x: number
  y: number
  rong: number
  cao: number
}

// Toạ độ tính theo phần trăm khung của tầng, đọc từ bản vẽ tay.
const MAT_BANG: ViTri[] = [
  // ----- TẦNG 2 -----
  { code: 'CT', name: 'Chuyền cải tạo', loai: 'CHUYEN', soGhe: 12, tang: 2, x: 4, y: 6, rong: 46, cao: 11 },
  { code: 'LR1', name: 'Chuyền lắp ráp số 1', loai: 'CHUYEN', soGhe: 20, tang: 2, x: 4, y: 24, rong: 62, cao: 11 },
  { code: 'LR2', name: 'Chuyền lắp ráp số 2', loai: 'CHUYEN', soGhe: 20, tang: 2, x: 4, y: 42, rong: 62, cao: 11 },
  { code: 'MHC', name: 'Máy HC khói', loai: 'MAY', soGhe: 2, tang: 2, x: 68, y: 42, rong: 11, cao: 11 },
  { code: 'KKHOI', name: 'Kiểm khói', loai: 'BAN', soGhe: 4, tang: 2, x: 4, y: 66, rong: 13, cao: 10 },
  { code: 'KNHIET', name: 'Kiểm nhiệt', loai: 'BAN', soGhe: 4, tang: 2, x: 18, y: 66, rong: 13, cao: 10 },
  { code: 'BDK', name: 'Bàn đầu kiểm 1–8', loai: 'BAN', soGhe: 8, tang: 2, x: 32, y: 66, rong: 50, cao: 10 },

  // ----- TẦNG 1 -----
  { code: 'BG', name: 'Dây chuyền bao gói', loai: 'CHUYEN', soGhe: 10, tang: 1, x: 22, y: 42, rong: 52, cao: 13 },
]

async function main() {
  let moi = 0
  let capNhat = 0

  for (const v of MAT_BANG) {
    const dangCo = await prisma.line.findUnique({
      where: { code: v.code },
      include: { _count: { select: { seats: true } } },
    })

    if (dangCo) {
      // Chỉ đặt lại vị trí và kiểu. Số ghế giữ nguyên vì có thể đã xếp người.
      await prisma.line.update({
        where: { id: dangCo.id },
        data: {
          name: v.name,
          loai: v.loai,
          tang: v.tang,
          viTriX: v.x,
          viTriY: v.y,
          rong: v.rong,
          cao: v.cao,
          isActive: true,
        },
      })
      capNhat++
      continue
    }

    const line = await prisma.line.create({
      data: {
        code: v.code,
        name: v.name,
        loai: v.loai,
        soGhe: v.soGhe,
        tang: v.tang,
        viTriX: v.x,
        viTriY: v.y,
        rong: v.rong,
        cao: v.cao,
      },
    })

    // Máy không có chỗ ngồi cố định; bàn xếp một hàng; chuyền chia đều hai mặt.
    const ghe: Array<{ lineId: string; side: 'A' | 'B'; seq: number }> = []
    if (v.loai === 'CHUYEN') {
      const mucA = Math.ceil(v.soGhe / 2)
      for (let i = 1; i <= mucA; i++) ghe.push({ lineId: line.id, side: 'A', seq: i })
      for (let i = 1; i <= v.soGhe - mucA; i++) ghe.push({ lineId: line.id, side: 'B', seq: i })
    } else {
      for (let i = 1; i <= v.soGhe; i++) ghe.push({ lineId: line.id, side: 'A', seq: i })
    }
    if (ghe.length) await prisma.seat.createMany({ data: ghe, skipDuplicates: true })

    moi++
  }

  console.log(`Mặt bằng xưởng: ${moi} vị trí tạo mới, ${capNhat} vị trí cập nhật lại toạ độ.`)
  console.log('Xem tại /so-do-xuong. Bấm "Sắp xếp mặt bằng" để kéo lại cho khớp thực tế.')

  const thua = await prisma.line.findMany({
    where: { isActive: true, code: { notIn: MAT_BANG.map((v) => v.code) } },
    select: { code: true, name: true },
  })
  if (thua.length) {
    console.log('')
    console.log('Còn những chuyền không nằm trong bản vẽ, đang xếp ở góc trên trái:')
    for (const t of thua) console.log(`  ${t.code} · ${t.name}`)
    console.log('Kéo lại vị trí, hoặc bỏ tích "Còn dùng" ở mục Sửa chuyền nếu không dùng nữa.')
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
