/**
 * Seed dữ liệu nền: sản phẩm, bộ phận, nguyên công (định mức thật), ca & mốc giờ,
 * lý do dừng máy, loại lỗi, nguyên nhân lỗi, và vài tài khoản mẫu.
 *
 * Chạy:  npx prisma db seed
 */
import { PrismaClient, Role } from '@prisma/client'
import { hash } from '@node-rs/argon2'
import dinhMuc from './dinh-muc.json'

const prisma = new PrismaClient()

type OpJson = { tt: number; name: string; detail: string | null; seconds: number; note: string | null }
type SectionJson = { code: string; name: string; seq: number; dependsOnAll?: boolean; ops: OpJson[] }
type ProductJson = { code: string; name: string; unit: string; isKit: boolean; sections: SectionJson[] }

async function seedProducts() {
  for (const p of dinhMuc.products as ProductJson[]) {
    const product = await prisma.product.upsert({
      where: { code: p.code },
      update: { name: p.name, unit: p.unit, isKit: p.isKit },
      create: { code: p.code, name: p.name, unit: p.unit, isKit: p.isKit },
    })

    for (const s of p.sections) {
      const section = await prisma.productSection.upsert({
        where: { productId_code: { productId: product.id, code: s.code } },
        update: { name: s.name, seq: s.seq, dependsOnAllSections: !!s.dependsOnAll },
        create: {
          productId: product.id,
          code: s.code,
          name: s.name,
          seq: s.seq,
          dependsOnAllSections: !!s.dependsOnAll,
        },
      })

      let seq = 0
      for (const op of s.ops) {
        seq += 10
        const code = `${s.code}-${String(op.tt).padStart(2, '0')}`
        await prisma.operation.upsert({
          where: { sectionId_seq: { sectionId: section.id, seq } },
          update: {
            code,
            name: op.name,
            detail: op.detail,
            standardSeconds: op.seconds,
            isQC: /QC/i.test(op.note ?? ''),
            isActive: op.seconds > 0,
            note: op.note,
          },
          create: {
            sectionId: section.id,
            seq,
            code,
            name: op.name,
            detail: op.detail,
            standardSeconds: op.seconds,
            targetPercent: 100,
            isQC: /QC/i.test(op.note ?? ''),
            isActive: op.seconds > 0,
            note: op.note,
          },
        })
      }
      const total = s.ops.reduce((a, o) => a + o.seconds, 0)
      console.log(`  ${p.code}/${s.code}: ${s.ops.length} nguyên công, ${total}s`)
    }
  }
}

/** Ca và 5 mốc chốt số: 9h30 - 11h40 - 14h30 - 16h20 - 19h40 */
async function seedShift() {
  const shift = await prisma.shift.upsert({
    where: { code: 'CA1' },
    update: {},
    create: { code: 'CA1', name: 'Ca chính', startTime: '08:00', endTime: '21:00' },
  })

  // breakMinutes: trừ nghỉ giữa khoảng. Nghỉ trưa 60 phút nằm trong khoảng 11h40-14h30.
  const slots = [
    { seq: 1, label: '9h30', startTime: '08:00', endTime: '09:30', breakMinutes: 0 },
    { seq: 2, label: '11h40', startTime: '09:30', endTime: '11:40', breakMinutes: 0 },
    { seq: 3, label: '14h30', startTime: '11:40', endTime: '14:30', breakMinutes: 60 },
    { seq: 4, label: '16h20', startTime: '14:30', endTime: '16:20', breakMinutes: 0 },
    { seq: 5, label: '19h40', startTime: '16:20', endTime: '19:40', breakMinutes: 30 },
  ]
  for (const s of slots) {
    await prisma.timeSlot.upsert({
      where: { shiftId_seq: { shiftId: shift.id, seq: s.seq } },
      update: s,
      create: { ...s, shiftId: shift.id, graceMinutes: 30 },
    })
  }
  console.log(`  Ca ${shift.code}: ${slots.length} mốc giờ`)
}

async function seedCatalogs() {
  const downtimes = [
    ['CHO_VT', 'Chờ vật tư'],
    ['HONG_MAY', 'Hỏng máy / hỏng đồ gá'],
    ['MAT_DIEN', 'Mất điện'],
    ['CHO_KIEM', 'Chờ kiểm tra / chờ QC'],
    ['DOI_VIEC', 'Chuyển đổi công việc, set-up'],
    ['HOP', 'Họp, đào tạo'],
    ['KHAC', 'Lý do khác'],
  ]
  for (const [code, name] of downtimes) {
    await prisma.downtimeReason.upsert({ where: { code }, update: { name }, create: { code, name } })
  }

  const defectTypes = [
    ['KT_SAI', 'Sai kích thước', 'Kích thước'],
    ['BM_XUOC', 'Xước, móp bề mặt', 'Bề mặt'],
    ['HAN_LOI', 'Lỗi hàn, bồi thiếc', 'Hàn / lắp ráp'],
    ['LAP_SAI', 'Lắp sai, thiếu chi tiết', 'Hàn / lắp ráp'],
    ['NAP_LOI', 'Lỗi nạp chương trình', 'Điện tử'],
    ['FCT_FAIL', 'Không đạt kiểm tra FCT', 'Điện tử'],
    ['PIN_LOI', 'Lỗi pin / nguồn', 'Điện tử'],
    ['TEM_SAI', 'Sai tem, sai QR', 'Bao gói'],
    ['BG_LOI', 'Lỗi bao gói', 'Bao gói'],
    ['VT_LOI', 'Vật tư đầu vào lỗi', 'Vật tư'],
  ]
  for (const [code, name, group] of defectTypes) {
    await prisma.defectType.upsert({ where: { code }, update: { name, group }, create: { code, name, group } })
  }

  const causes = [
    ['THAO_TAC', 'Thao tác sai', 'CON NGƯỜI'],
    ['TAY_NGHE', 'Tay nghề chưa đạt', 'CON NGƯỜI'],
    ['MAY_LOI', 'Máy / đồ gá sai lệch', 'MÁY'],
    ['DAO_MON', 'Dao, mũi hàn mòn', 'MÁY'],
    ['PHOI_LOI', 'Phôi, linh kiện lỗi', 'VẬT TƯ'],
    ['CT_SAI', 'Chương trình, thông số sai', 'PHƯƠNG PHÁP'],
    ['HD_THIEU', 'Hướng dẫn công việc chưa rõ', 'PHƯƠNG PHÁP'],
    ['DO_SAI', 'Dụng cụ đo sai lệch', 'ĐO LƯỜNG'],
    ['MOI_TRUONG', 'Nhiệt độ, độ ẩm, ánh sáng', 'MÔI TRƯỜNG'],
  ]
  for (const [code, name, category] of causes) {
    await prisma.defectCause.upsert({
      where: { code },
      update: { name, category },
      create: { code, name, category },
    })
  }
  console.log(`  Danh mục: ${downtimes.length} lý do dừng, ${defectTypes.length} loại lỗi, ${causes.length} nguyên nhân`)
}

/** Tài khoản mẫu — ĐỔI MẬT KHẨU trước khi dùng thật */
async function seedUsers() {
  const team = await prisma.team.upsert({
    where: { code: 'TO1' },
    update: {},
    create: { code: 'TO1', name: 'Tổ 1' },
  })

  const people: Array<[string, string, Role, string]> = [
    ['GD01', 'Giám đốc', Role.DIRECTOR, 'doi-mat-khau'],
    ['PGD01', 'Phó giám đốc', Role.DEPUTY_DIRECTOR, 'doi-mat-khau'],
    ['QLX01', 'Quản lý xưởng', Role.SHOP_MANAGER, 'doi-mat-khau'],
    ['KT01', 'Nhân viên kỹ thuật', Role.ENGINEER, 'doi-mat-khau'],
    ['KTE01', 'Nhân viên kinh tế', Role.PLANNER, 'doi-mat-khau'],
    ['KHO01', 'Nhân viên kho', Role.WAREHOUSE, 'doi-mat-khau'],
    ['TT01', 'Tổ trưởng Tổ 1', Role.TEAM_LEADER, 'doi-mat-khau'],
    ['CN001', 'Công nhân mẫu 1', Role.WORKER, '123456'],
    ['CN002', 'Công nhân mẫu 2', Role.WORKER, '123456'],
  ]

  for (const [employeeCode, fullName, role, pwd] of people) {
    const passwordHash = await hash(pwd)
    await prisma.user.upsert({
      where: { employeeCode },
      update: {},
      create: {
        employeeCode,
        fullName,
        role,
        passwordHash,
        mustChangePassword: true,
        teamId: role === Role.WORKER || role === Role.TEAM_LEADER ? team.id : null,
      },
    })
  }

  const leader = await prisma.user.findUnique({ where: { employeeCode: 'TT01' } })
  if (leader) await prisma.team.update({ where: { id: team.id }, data: { leaderId: leader.id } })
  console.log(`  Người dùng: ${people.length} tài khoản mẫu (PIN công nhân: 123456 — phải đổi)`)
}

async function main() {
  console.log('Seed dữ liệu nền...')
  await seedProducts()
  await seedShift()
  await seedCatalogs()
  await seedUsers()
  console.log('Xong.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
