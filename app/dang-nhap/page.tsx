import { redirect } from 'next/navigation'
import { nguoiDangDangNhap, trangChinh } from '@/lib/session'
import FormDangNhap from './FormDangNhap'

export default async function TrangDangNhap() {
  const u = await nguoiDangDangNhap()
  if (u) redirect(trangChinh(u.role))

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center gap-6 px-4 py-10">
      <div className="text-center">
        <h1 className="text-2xl font-bold">Theo dõi sản xuất</h1>
        <p className="mt-1 text-sm text-slate-500">Đăng nhập bằng mã nhân viên</p>
      </div>
      <FormDangNhap />
    </main>
  )
}
