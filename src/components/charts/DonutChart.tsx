import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts"

import { ChartTooltip } from "@/components/ChartTooltip"
import { usePrefersReducedMotion } from "@/hooks/use-reduced-motion"
import { formatInt, formatPercent } from "@/lib/format"
import { cn } from "@/lib/utils"

export interface DonutDatum {
  key: string
  label: string
  value: number
  color: string
}

interface DonutChartProps {
  data: DonutDatum[]
  /** Teks kecil di tengah donat. */
  centerLabel?: string
  /** Angka besar di tengah donat. */
  centerValue?: string
  /** Satuan untuk tooltip & legenda, mis. "jam". */
  unit?: string
  className?: string
}

/**
 * Donut + legenda bernilai. Dipakai untuk distribusi kepadatan lalu lintas
 * dan distribusi kategori kualitas udara.
 */
export function DonutChart({
  data,
  centerLabel,
  centerValue,
  unit = "jam",
  className,
}: DonutChartProps) {
  const reducedMotion = usePrefersReducedMotion()
  const total = data.reduce((acc, d) => acc + d.value, 0)

  const share = (value: number) => (total > 0 ? (value / total) * 100 : 0)

  return (
    <div className={cn("flex h-full min-h-0 flex-col", className)}>
      <div className="relative min-h-0 flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="label"
              innerRadius="62%"
              outerRadius="92%"
              paddingAngle={data.length > 1 ? 2 : 0}
              strokeWidth={0}
              isAnimationActive={!reducedMotion}
              animationDuration={650}
            >
              {data.map((d) => (
                <Cell key={d.key} fill={d.color} />
              ))}
            </Pie>
            <Tooltip
              cursor={false}
              content={
                <ChartTooltip
                  hideLabel
                  valueFormatter={(value) =>
                    `${formatInt(value)} ${unit} · ${formatPercent(share(value))}`
                  }
                />
              }
            />
          </PieChart>
        </ResponsiveContainer>

        {/* Label di tengah donat */}
        {centerValue || centerLabel ? (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
            {centerValue ? (
              <span className="tabular text-2xl font-bold leading-none">
                {centerValue}
              </span>
            ) : null}
            {centerLabel ? (
              <span className="mt-1 max-w-[9rem] text-[11px] leading-tight text-muted-foreground">
                {centerLabel}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>

      {/* Legenda dengan angka & persentase */}
      <ul className="mt-2 grid shrink-0 grid-cols-1 gap-x-4 gap-y-1 px-3 pb-1 text-xs sm:grid-cols-2">
        {data.map((d) => (
          <li key={d.key} className="flex items-center justify-between gap-2">
            <span className="flex min-w-0 items-center gap-1.5 text-muted-foreground">
              <span
                aria-hidden
                className="size-2 shrink-0 rounded-[3px]"
                style={{ backgroundColor: d.color }}
              />
              <span className="truncate">{d.label}</span>
            </span>
            <span className="tabular shrink-0 font-medium">
              {formatPercent(share(d.value), 1)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
