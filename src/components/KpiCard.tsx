import * as React from "react"
import { ArrowDownRight, ArrowUpRight, Minus, type LucideIcon } from "lucide-react"

import { Card } from "@/components/ui/card"
import { Sparkline } from "@/components/Sparkline"
import { useChartColors } from "@/hooks/use-chart-colors"
import type { Palette } from "@/lib/colors"
import { formatDelta } from "@/lib/format"
import { cn } from "@/lib/utils"

/** Warna aksen kartu — dipakai untuk ikon & sparkline. */
export type KpiTone =
  | "teal"
  | "coral"
  | "indigo"
  | "good"
  | "warn"
  | "bad"
  | "critical"

/** Kelas tint untuk kotak ikon di pojok kanan atas. */
const TONE_CLASS: Record<KpiTone, string> = {
  teal: "bg-teal/12 text-teal",
  coral: "bg-coral/12 text-coral",
  indigo: "bg-pilar-macet/12 text-pilar-macet",
  good: "bg-cond-good/12 text-cond-good",
  warn: "bg-cond-warn/12 text-cond-warn",
  bad: "bg-cond-bad/12 text-cond-bad",
  critical: "bg-cond-critical/12 text-cond-critical",
}

function toneHex(tone: KpiTone, p: Palette): string {
  switch (tone) {
    case "teal":
      return p.teal
    case "coral":
      return p.coral
    case "indigo":
      return p.indigo
    case "good":
      return p.good
    case "warn":
      return p.warn
    case "bad":
      return p.bad
    case "critical":
      return p.critical
  }
}

export interface KpiCardProps {
  /** Judul kecil di kiri atas. */
  label: string
  /** Angka utama yang SUDAH diformat (mis. "27,0"). */
  value: string
  /** Satuan kecil di sebelah angka (mis. "km/j"). */
  unit?: string
  icon: LucideIcon
  tone?: KpiTone
  /** Perubahan dalam persen. null / undefined => baris delta disembunyikan. */
  delta?: number | null
  /**
   * true bila KENAIKAN adalah kabar buruk (PM2.5, kecelakaan, % macet).
   * Memengaruhi warna panah saja, bukan arahnya.
   */
  deltaInverted?: boolean
  /** Teks pembanding, default "vs bulan sebelumnya". */
  deltaLabel?: string
  /** Deret untuk sparkline. */
  spark?: number[]
  /** Keterangan singkat di bawah angka (mis. "total tercatat"). */
  hint?: string
  /** Perkecil teks nilai — berguna bila isinya nama, bukan angka. */
  valueClassName?: string
  className?: string
}

export function KpiCard({
  label,
  value,
  unit,
  icon: Icon,
  tone = "teal",
  delta,
  deltaInverted = false,
  deltaLabel = "vs bulan sebelumnya",
  spark,
  hint,
  valueClassName,
  className,
}: KpiCardProps) {
  const palette = useChartColors()
  // Id gradien harus unik per kartu agar SVG tidak saling menimpa.
  const gradientId = React.useId().replace(/:/g, "")

  const hasDelta = typeof delta === "number" && Number.isFinite(delta)
  const rising = hasDelta && delta > 0.05
  const falling = hasDelta && delta < -0.05
  // "Baik" = naik pada metrik positif, atau turun pada metrik negatif.
  const isGoodNews = deltaInverted ? falling : rising
  const isBadNews = deltaInverted ? rising : falling

  const DeltaIcon = rising ? ArrowUpRight : falling ? ArrowDownRight : Minus

  return (
    <Card className={cn("overflow-hidden", className)}>
      <div className="flex items-start justify-between gap-3 p-5 pb-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-muted-foreground">
            {label}
          </p>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span
              className={cn(
                "tabular text-3xl font-bold leading-none tracking-tight",
                valueClassName,
              )}
            >
              {value}
            </span>
            {unit ? (
              <span className="text-sm font-medium text-muted-foreground">
                {unit}
              </span>
            ) : null}
          </div>
        </div>

        <span
          aria-hidden
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-lg",
            TONE_CLASS[tone],
          )}
        >
          <Icon className="size-4.5" strokeWidth={2} />
        </span>
      </div>

      <div className="px-5 pb-1">
        {hasDelta ? (
          <p className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs">
            <span
              className={cn(
                "inline-flex items-center gap-0.5 font-medium tabular",
                isGoodNews && "text-cond-good",
                isBadNews && "text-cond-bad",
                !isGoodNews && !isBadNews && "text-muted-foreground",
              )}
            >
              <DeltaIcon className="size-3.5" aria-hidden />
              {formatDelta(delta)}
            </span>
            <span className="text-muted-foreground">{deltaLabel}</span>
          </p>
        ) : hint ? (
          <p className="text-xs text-muted-foreground">{hint}</p>
        ) : (
          <p className="text-xs text-muted-foreground">&nbsp;</p>
        )}
        {hasDelta && hint ? (
          <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
        ) : null}
      </div>

      {spark && spark.length > 1 ? (
        <div className="mt-2">
          <Sparkline
            data={spark}
            color={toneHex(tone, palette)}
            gradientId={`spark-${gradientId}`}
            height={44}
          />
        </div>
      ) : (
        <div className="h-4" />
      )}
    </Card>
  )
}
