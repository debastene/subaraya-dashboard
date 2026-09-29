import * as React from "react"
import { Info, type LucideIcon } from "lucide-react"

import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"

/** Aksen judul mengikuti pilar analitik halaman. */
export type ChartAccent = "teal" | "coral" | "indigo" | "neutral"

const ACCENT_CLASS: Record<ChartAccent, string> = {
  teal: "bg-teal/12 text-teal",
  coral: "bg-coral/12 text-coral",
  indigo: "bg-pilar-macet/12 text-pilar-macet",
  neutral: "bg-muted text-muted-foreground",
}

export interface ChartCardProps {
  title: string
  description?: string
  icon?: LucideIcon
  accent?: ChartAccent
  /** Kontrol kecil di kanan header (mis. tombol ganti metrik). */
  action?: React.ReactNode
  /** Catatan kecil di bawah chart — dipakai untuk konteks/keterbatasan data. */
  footnote?: React.ReactNode
  /** Tinggi area chart dalam piksel. */
  height?: number
  className?: string
  bodyClassName?: string
  children: React.ReactNode
}

/**
 * Pembungkus seragam untuk semua chart: header (ikon + judul + deskripsi),
 * area chart dengan tinggi tetap, dan catatan kaki opsional.
 */
export function ChartCard({
  title,
  description,
  icon: Icon,
  accent = "neutral",
  action,
  footnote,
  height = 280,
  className,
  bodyClassName,
  children,
}: ChartCardProps) {
  return (
    <Card className={cn("flex flex-col", className)}>
      <div className="flex flex-wrap items-start justify-between gap-3 p-5 pb-3">
        <div className="flex min-w-0 items-start gap-3">
          {Icon ? (
            <span
              aria-hidden
              className={cn(
                "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg",
                ACCENT_CLASS[accent],
              )}
            >
              <Icon className="size-4" strokeWidth={2} />
            </span>
          ) : null}
          <div className="min-w-0">
            <h3 className="text-sm font-semibold leading-tight">{title}</h3>
            {description ? (
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                {description}
              </p>
            ) : null}
          </div>
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>

      <div
        className={cn("min-w-0 px-2 pb-1", bodyClassName)}
        style={{ height }}
      >
        {children}
      </div>

      {footnote ? (
        <div className="flex items-start gap-2 border-t border-border px-5 py-3 text-[11px] leading-relaxed text-muted-foreground">
          <Info className="mt-px size-3.5 shrink-0" aria-hidden />
          <span>{footnote}</span>
        </div>
      ) : null}
    </Card>
  )
}
