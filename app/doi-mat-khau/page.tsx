import { redirect } from 'next/navigation'
import Link from 'next/link'
import { nguoiDangDangNhap, trangChinh } from '@/lib/session'
import FormDoiMatKhau from './FormDoiMatKhau'

export default async function TrangDoiMatKhau() {
  const u = await nguoiDangDangNhap()
  if (!u) redirect('/dang-nhap')

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center gap-5 px-4 py-10">
      <div className="text-center">
        <h1 className="text-xl font-bold">Đổi mật khẩu</h1>
        <p className="mt-1 text-sm text-slate-500">
          {u.employeeCode} — {u.fullName}
        </p>
      </div>

      <FormDoiMatKhau />

      <Link href={trangChinh(u.role)} className="text-center text-sm text-brand-600 underline">
        Quay lại
      </Link>
    </main>
  )
}
