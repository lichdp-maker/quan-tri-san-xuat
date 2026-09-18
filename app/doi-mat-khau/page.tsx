import { redirect } from 'next/navigation'
import Link from 'next/link'
import { nguoiDangDangNhap } from '@/lib/session'
import { IconChiaKhoa } from '@/components/Icons'
import FormDoiMatKhau from './FormDoiMatKhau'

export default async function TrangDoiMatKhau() {
  const u = await nguoiDangDangNhap()
  if (!u) redirect('/dang-nhap')

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center gap-5 px-4 py-10">
      <div className="text-center">
        <span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-rose-500 to-pink-600 text-white shadow-[0_12px_28px_-10px_rgba(225,29,72,0.7)]">
          <IconChiaKhoa className="h-7 w-7" />
        </span>
        <h1 className="text-xl font-bold">Đổi mật khẩu</h1>
        <p className="mt-1 text-sm text-slate-500">
          {u.employeeCode} — {u.fullName}
        </p>
      </div>

      <FormDoiMatKhau />

      <Link href="/" className="nut-phu text-center">
        Quay lại trang chủ
      </Link>
    </main>
  )
}
