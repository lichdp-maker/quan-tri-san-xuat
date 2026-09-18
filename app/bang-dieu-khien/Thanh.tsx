/**
 * Thanh năng suất. Vạch mảnh ở mốc 100% là ngưỡng đạt.
 * Màu chỉ là kênh phụ: giá trị và chữ "đạt / chưa đạt" luôn hiện thành chữ,
 * để người không phân biệt được màu vẫn đọc đúng.
 */
export function Thanh({
  giaTri,
  toiDa,
  nhan,
  dat,
}: {
  giaTri: number
  toiDa: number
  nhan: string
  dat: boolean
}) {
  const rong = toiDa > 0 ? Math.max(1.5, Math.min(100, (giaTri / toiDa) * 100)) : 0
  const mocDat = toiDa > 0 ? Math.min(100, (100 / toiDa) * 100) : 0

  return (
    <div className="flex items-center gap-2">
      <div className="relative h-3 flex-1 rounded bg-slate-200">
        <div
          className="h-full rounded"
          style={{ width: `${rong}%`, backgroundColor: dat ? '#0ca30c' : '#fab219' }}
        />
        <span
          aria-hidden
          title="Mốc đạt 100%"
          className="absolute -top-0.5 h-4 w-px bg-slate-500"
          style={{ left: `${mocDat}%` }}
        />
      </div>
      <span className="w-28 shrink-0 text-right text-sm tabular-nums text-slate-700">
        {nhan}
        <span className="ml-1 text-xs text-slate-500">{dat ? 'đạt' : 'chưa đạt'}</span>
      </span>
    </div>
  )
}
