/**
 * Nạp nhân sự thật của Trung tâm Thiết bị Công nghệ cao.
 * Nguồn: "DS CNC TTCNC 6-7-2026.xlsx", chỉ lấy mã nhân sự, họ tên, chức danh và tổ.
 * KHÔNG nạp số CCCD, số điện thoại, ngày sinh hay email — hệ thống không cần và không lưu.
 *
 * Chạy:  npm run db:nhansu
 *
 * Chạy lại nhiều lần được: người đã có thì chỉ cập nhật vai trò và tổ, KHÔNG đổi mật khẩu.
 */
import { PrismaClient, type Role } from '@prisma/client'
import { hash } from '@node-rs/argon2'
import duLieu from './nhan-su.json'

const prisma = new PrismaClient()

const PIN_MAC_DINH = '123456'

type Nguoi = { ma: string; ten: string; vaiTro: string; to: string | null; chucDanh: string }
type To = { code: string; name: string; leader: string | null }

async function main() {
  const { tos, nguoi } = duLieu as { tos: To[]; nguoi: Nguoi[] }

  // 1. Tổ sản xuất
  for (const t of tos) {
    await prisma.team.upsert({
      where: { code: t.code },
      update: { name: t.name },
      create: { code: t.code, name: t.name },
    })
  }
  console.log(`Tổ: ${tos.length}`)

  const bangTo = new Map((await prisma.team.findMany()).map((t) => [t.code, t.id]))

  // 2. Người dùng
  let moi = 0
  let capNhat = 0
  for (const p of nguoi) {
    const teamId = p.to ? (bangTo.get(p.to) ?? null) : null
    const daCo = await prisma.user.findUnique({ where: { employeeCode: p.ma } })

    if (daCo) {
      await prisma.user.update({
        where: { employeeCode: p.ma },
        data: { fullName: p.ten, role: p.vaiTro as Role, teamId, isActive: true },
      })
      capNhat++
    } else {
      await prisma.user.create({
        data: {
          employeeCode: p.ma,
          fullName: p.ten,
          role: p.vaiTro as Role,
          teamId,
          passwordHash: await hash(PIN_MAC_DINH),
          // Bắt đổi ngay lần đăng nhập đầu — PIN cấp sẵn chỉ dùng được một lần
          mustChangePassword: true,
        },
      })
      moi++
    }
  }
  console.log(`Người dùng: ${moi} tạo mới, ${capNhat} cập nhật`)

  // 3. Gán tổ trưởng
  let ganTT = 0
  for (const t of tos) {
    if (!t.leader) continue
    const u = await prisma.user.findUnique({ where: { employeeCode: t.leader } })
    const id = bangTo.get(t.code)
    if (u && id) {
      await prisma.team.update({ where: { id }, data: { leaderId: u.id } })
      ganTT++
    }
  }
  console.log(`Gán tổ trưởng: ${ganTT}/${tos.length} tổ`)

  const chuaCo = tos.filter((t) => !t.leader).map((t) => t.name)
  if (chuaCo.length) console.log(`CHƯA CÓ TỔ TRƯỞNG: ${chuaCo.join(', ')}`)

  const maTam = nguoi.filter((p) => p.ma.startsWith('TTCNC9'))
  if (maTam.length) {
    console.log('MÃ TẠM (không tìm thấy trong bảng nhân sự, cần sửa lại mã thật):')
    for (const p of maTam) console.log(`  ${p.ma}  ${p.ten}`)
  }

  console.log(`\nMật khẩu mặc định mọi người: ${PIN_MAC_DINH} — bắt buộc đổi khi dùng thật.`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
