import { redirect } from 'next/navigation'
import { nguoiDangDangNhap } from '@/lib/session'
import { IconDauTich } from '@/components/Icons'
import FormDangNhap from './FormDangNhap'

export default async function TrangDangNhap() {
  const u = await nguoiDangDangNhap()
  if (u) redirect('/')

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center px-4 py-10">
      <div className="mb-7 text-center">
        <span className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-[0_12px_28px_-10px_rgba(37,99,235,0.85)]">
          <IconDauTich className="h-8 w-8" />
        </span>
        <h1 className="text-2xl font-bold uppercase leading-tight tracking-tight">
          Nhà máy thông minh EMIC
        </h1>
        <p className="mt-1 text-sm text-slate-500">Hệ thống theo dõi sản xuất</p>
      </div>

      <FormDangNhap />

      <p className="mt-7 text-center text-xs text-slate-400">
        Chỉ dành cho cán bộ nhân viên · Nhà máy thông minh EMIC
      </p>
    </main>
  )
}
