import { cn } from "@/lib/utils"

/** Satu baris di dalam tooltip (dikirim otomatis oleh Recharts). */
interface TooltipEntry {
  name?: string | number
  value?: number | string
  color?: string
  dataKey?: string | number
  payload?: Record<string, unknown>
}

export interface ChartTooltipProps {
  active?: boolean
  payload?: TooltipEntry[]
  label?: string | number
  /** Ubah nilai menjadi teks (mis. tambah satuan). */
  valueFormatter?: (value: number, entry: TooltipEntry) => string
  /** Ubah judul tooltip. */
  labelFormatter?: (label: string | number) => string
  /** Sembunyikan judul (berguna untuk donut). */
  hideLabel?: boolean
  className?: string
}

/**
 * Tooltip seragam untuk semua chart.
 * Dibuat sendiri (bukan bawaan Recharts) supaya warnanya ikut tema.
 */
export function ChartTooltip({
  active,
  payload,
  label,
  valueFormatter,
  labelFormatter,
  hideLabel,
  className,
}: ChartTooltipProps) {
  if (!active || !payload || payload.length === 0) return null

  const title =
    label != null ? (labelFormatter ? labelFormatter(label) : String(label)) : ""

  return (
    <div
      className={cn(
        "min-w-[9rem] rounded-lg border border-border bg-popover/95 px-3 py-2 text-xs text-popover-foreground backdrop-blur",
        className,
      )}
    >
      {!hideLabel && title ? (
        <div className="mb-1.5 font-medium text-foreground">{title}</div>
      ) : null}
      <div className="space-y-1">
        {payload.map((entry, i) => {
          const numeric =
            typeof entry.value === "number" ? entry.value : Number(entry.value)
          const text =
            valueFormatter && Number.isFinite(numeric)
              ? valueFormatter(numeric, entry)
              : String(entry.value ?? "–")
          return (
            <div
              key={`${entry.dataKey ?? entry.name ?? i}`}
              className="flex items-center justify-between gap-4"
            >
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <span
                  aria-hidden
                  className="h-2 w-2 shrink-0 rounded-[3px]"
                  style={{ backgroundColor: entry.color }}
                />
                {entry.name}
              </span>
              <span className="tabular font-medium text-foreground">{text}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
