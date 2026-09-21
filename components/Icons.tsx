/** Bộ biểu tượng nét mảnh, dùng chung toàn hệ thống. */
type P = { className?: string }
const chung = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.75,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  viewBox: '0 0 24 24',
}

export function IconDauTich({ className = 'h-6 w-6' }: P) {
  return (
    <svg {...chung} className={className}>
      <path d="M12 3 4.5 6v6c0 4.2 3 8.1 7.5 9 4.5-.9 7.5-4.8 7.5-9V6L12 3Z" />
      <path d="m9 12 2.2 2.2L15.5 10" />
    </svg>
  )
}

export function IconBieuDo({ className = 'h-6 w-6' }: P) {
  return (
    <svg {...chung} className={className}>
      <path d="M4 20h16" />
      <path d="M7 20v-6M12 20V7M17 20v-9" />
    </svg>
  )
}

export function IconPhieu({ className = 'h-6 w-6' }: P) {
  return (
    <svg {...chung} className={className}>
      <path d="M8 3h8a2 2 0 0 1 2 2v16l-3-2-3 2-3-2-3 2V5a2 2 0 0 1 2-2Z" />
      <path d="M9.5 8h5M9.5 12h5" />
    </svg>
  )
}

export function IconNguoi({ className = 'h-6 w-6' }: P) {
  return (
    <svg {...chung} className={className}>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3.5 19.5c0-3 2.5-5 5.5-5s5.5 2 5.5 5" />
      <path d="M16.5 9.5h4M18.5 7.5v4" />
    </svg>
  )
}

export function IconDongHo({ className = 'h-6 w-6' }: P) {
  return (
    <svg {...chung} className={className}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 1.8" />
    </svg>
  )
}

export function IconBanhRang({ className = 'h-6 w-6' }: P) {
  return (
    <svg {...chung} className={className}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3v2.2M12 18.8V21M21 12h-2.2M5.2 12H3M18.4 5.6l-1.6 1.6M7.2 16.8l-1.6 1.6M18.4 18.4l-1.6-1.6M7.2 7.2 5.6 5.6" />
    </svg>
  )
}

export function IconKhoa({ className = 'h-6 w-6' }: P) {
  return (
    <svg {...chung} className={className}>
      <rect x="4.5" y="10" width="15" height="10.5" rx="2.5" />
      <path d="M8 10V7.5a4 4 0 0 1 8 0V10" />
    </svg>
  )
}

export function IconTaiXuong({ className = 'h-6 w-6' }: P) {
  return (
    <svg {...chung} className={className}>
      <path d="M12 3v11" />
      <path d="m7.5 10 4.5 4.5L16.5 10" />
      <path d="M4.5 20h15" />
    </svg>
  )
}

export function IconChiaKhoa({ className = 'h-6 w-6' }: P) {
  return (
    <svg {...chung} className={className}>
      <circle cx="8" cy="12" r="4" />
      <path d="M12 12h9M18 12v3.5M15.5 12v2.5" />
    </svg>
  )
}

export function IconSoDo({ className = 'h-6 w-6' }: P) {
  return (
    <svg {...chung} className={className}>
      <rect x="3" y="4" width="5.5" height="4.5" rx="1.2" />
      <rect x="15.5" y="4" width="5.5" height="4.5" rx="1.2" />
      <rect x="3" y="15.5" width="5.5" height="4.5" rx="1.2" />
      <rect x="15.5" y="15.5" width="5.5" height="4.5" rx="1.2" />
      <path d="M3 12h18" />
    </svg>
  )
}

export function IconMuiTenPhai({ className = 'h-5 w-5' }: P) {
  return (
    <svg {...chung} className={className}>
      <path d="m9 5 7 7-7 7" />
    </svg>
  )
}

export function IconThoat({ className = 'h-4 w-4' }: P) {
  return (
    <svg {...chung} className={className}>
      <path d="M14 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2v-2" />
      <path d="M10 12h10M17 9l3 3-3 3" />
    </svg>
  )
}
