'use client'

import { useActionState, useEffect, useRef, useState, useTransition } from 'react'
import { useFormStatus } from 'react-dom'
import { dangNhap, timTen, type KetQuaDangNhap } from './actions'

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
  const [ma, setMa] = useState('')
  const [ten, setTen] = useState<string | null>(null)
  const [dangTim, setDangTim] = useState(false)
  const [hienMk, setHienMk] = useState(false)
  const [, batDau] = useTransition()
  const hen = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Tra tên ngay khi gõ, chờ 350ms sau phím cuối để không gọi liên tục
  useEffect(() => {
    if (hen.current) clearTimeout(hen.current)
    const code = ma.trim()
    if (code.length < 3) {
      setTen(null)
      setDangTim(false)
      return
    }
    setDangTim(true)
    hen.current = setTimeout(() => {
      batDau(async () => {
        setTen(await timTen(code))
        setDangTim(false)
      })
    }, 350)
    return () => {
      if (hen.current) clearTimeout(hen.current)
    }
  }, [ma])

  return (
    <form action={action} className="the p-5">
      <h2 className="mb-4 text-xl font-bold">Đăng nhập</h2>

      <label className="mb-4 block">
        <span className="mb-1.5 block text-sm font-medium text-slate-600">Mã nhân viên</span>
        <input
          name="employeeCode"
          autoComplete="username"
          autoCapitalize="characters"
          required
          className="o-nhap font-semibold uppercase tracking-wide"
          placeholder="EMIC1053"
          value={ma}
          onChange={(e) => setMa(e.target.value)}
        />

        <span className="mt-1.5 flex min-h-[1.25rem] items-center gap-1.5 text-sm font-medium">
          {ten ? (
            <span className="flex items-center gap-1.5 text-emerald-600">
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.86-9.64a.75.75 0 0 0-1.22-.87l-3.24 4.53-1.62-1.62a.75.75 0 0 0-1.06 1.06l2.24 2.24a.75.75 0 0 0 1.14-.1l3.76-5.24Z"
                  clipRule="evenodd"
                />
              </svg>
              {ten}
            </span>
          ) : dangTim ? (
            <span className="text-slate-400">Đang tìm…</span>
          ) : ma.trim().length >= 3 ? (
            <span className="text-amber-600">Không tìm thấy mã này</span>
          ) : null}
        </span>
      </label>

      <label className="mb-5 block">
        <span className="mb-1.5 block text-sm font-medium text-slate-600">Mật khẩu / PIN</span>
        <span className="relative block">
          <input
            name="password"
            type={hienMk ? 'text' : 'password'}
            inputMode={hienMk ? 'text' : 'numeric'}
            autoComplete="current-password"
            required
            className="o-nhap pr-12 tracking-widest"
            placeholder="••••••"
          />
          <button
            type="button"
            onClick={() => setHienMk((v) => !v)}
            aria-label={hienMk ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
            className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-slate-400 hover:text-slate-600"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              className="h-5 w-5"
            >
              <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
              <circle cx="12" cy="12" r="3" />
              {!hienMk && <path d="m4 20 16-16" />}
            </svg>
          </button>
        </span>
      </label>

      {kq.loi && (
        <p className="mb-4 rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-700" role="alert">
          {kq.loi}
        </p>
      )}

      <NutGui />
    </form>
  )
}
