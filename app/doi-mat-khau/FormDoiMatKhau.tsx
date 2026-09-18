'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { doiMatKhau, type KetQua } from './actions'

function Nut() {
  const { pending } = useFormStatus()
  return (
    <button type="submit" className="nut-chinh" disabled={pending}>
      {pending ? 'Đang lưu...' : 'Đổi mật khẩu'}
    </button>
  )
}

export default function FormDoiMatKhau() {
  const [kq, action] = useActionState<KetQua, FormData>(doiMatKhau, {})

  return (
    <form action={action} className="the flex flex-col gap-4">
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium text-slate-600">Mật khẩu hiện tại</span>
        <input name="cu" type="password" required className="input-so" />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium text-slate-600">Mật khẩu mới</span>
        <input name="moi" type="password" required className="input-so" />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium text-slate-600">Nhập lại mật khẩu mới</span>
        <input name="lai" type="password" required className="input-so" />
      </label>

      {kq.loi && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {kq.loi}
        </p>
      )}
      {kq.ok && (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          Đã đổi mật khẩu.
        </p>
      )}

      <Nut />
    </form>
  )
}
