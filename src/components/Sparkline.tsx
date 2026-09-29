import * as React from "react"
import { Area, AreaChart, ResponsiveContainer } from "recharts"

import { usePrefersReducedMotion } from "@/hooks/use-reduced-motion"

interface SparklineProps {
  /** Deret angka; titik terakhir = paling baru. */
  data: number[]
  color: string
  height?: number
  /** Id unik untuk gradien SVG (wajib beda tiap kartu). */
  gradientId: string
}

/**
 * Mini chart tanpa sumbu & tanpa grid untuk dipasang di dalam KPI card.
 * Sengaja tidak interaktif (aria-hidden) karena angkanya sudah ada di kartu.
 */
export function Sparkline({
  data,
  color,
  height = 40,
  gradientId,
}: SparklineProps) {
  const reducedMotion = usePrefersReducedMotion()

  const chartData = React.useMemo(
    () => data.map((value, i) => ({ i, value })),
    [data],
  )

  if (chartData.length < 2) {
    // Tidak cukup titik untuk digambar — biarkan ruangnya kosong.
    return <div style={{ height }} aria-hidden />
  }

  return (
    <div style={{ height }} aria-hidden className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={chartData}
          margin={{ top: 2, right: 0, bottom: 0, left: 0 }}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.35} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={1.75}
            fill={`url(#${gradientId})`}
            isAnimationActive={!reducedMotion}
            animationDuration={600}
            dot={false}
            activeDot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
