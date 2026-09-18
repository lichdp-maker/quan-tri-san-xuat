'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { dangNhap, type KetQuaDangNhap } from './actions'

function NutGui() {
  const { pending } = useFormStatus()
  return (
    <button type="submit" className="nut-chinh" disabled={pending}>
      {pending ? 'Đang kiểm tra...' : 'Đăng nhập'}
    </button>
  )
}

export default function FormDangNhap() {
  const [kq, action] = useActionState<KetQuaDangNhap, FormData>(dangNhap, {})

  return (
    <form action={action} className="the flex flex-col gap-4">
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium text-slate-600">Mã nhân viên</span>
        <input
          name="employeeCode"
          autoComplete="username"
          autoCapitalize="characters"
          required
          className="input-so uppercase"
          placeholder="CN001"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium text-slate-600">Mật khẩu / PIN</span>
        <input
          name="password"
          type="password"
          inputMode="numeric"
          autoComplete="current-password"
          required
          className="input-so"
          placeholder="••••••"
        />
      </label>

      {kq.loi && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {kq.loi}
        </p>
      )}

      <NutGui />
    </form>
  )
}
