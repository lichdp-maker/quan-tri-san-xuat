/** Khung xám nhấp nháy, hiện trong lúc trang đang tải dữ liệu. */
export function Khung({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-slate-200/70 ${className}`} />
}

export function KhungTrang({ so = 4, rong = 'max-w-3xl' }: { so?: number; rong?: string }) {
  return (
    <main className={`mx-auto w-full ${rong} px-4 py-5`}>
      <div className="mb-5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Khung className="h-12 w-12" />
          <div>
            <Khung className="mb-2 h-4 w-40" />
            <Khung className="h-3 w-28" />
          </div>
        </div>
        <Khung className="h-9 w-24" />
      </div>

      <div className="flex flex-col gap-3">
        {Array.from({ length: so }).map((_, i) => (
          <div key={i} className="the">
            <Khung className="mb-3 h-4 w-1/3" />
            <Khung className="h-3 w-2/3" />
          </div>
        ))}
      </div>
    </main>
  )
}
