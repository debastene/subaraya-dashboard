import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import {
  Car,
  Clock,
  Gauge,
  PieChart as PieChartIcon,
  TrafficCone,
} from "lucide-react"

import { ChartCard } from "@/components/ChartCard"
import { ChartTooltip } from "@/components/ChartTooltip"
import { KpiCard } from "@/components/KpiCard"
import { DonutChart, type DonutDatum } from "@/components/charts/DonutChart"
import { useChartColors } from "@/hooks/use-chart-colors"
import { useDashboardView } from "@/hooks/use-dashboard"
import { usePrefersReducedMotion } from "@/hooks/use-reduced-motion"
import {
  CONGESTION_LABEL,
  CONGESTION_LEVELS,
  congestionColor,
} from "@/lib/colors"
import {
  formatDecimal,
  formatHour,
  formatInt,
  formatPercent,
} from "@/lib/format"
import { periodAggregateNote } from "@/lib/notes"

export default function Kemacetan() {
  const view = useDashboardView()
  const c = useChartColors()
  const reducedMotion = usePrefersReducedMotion()

  // --- Donut tingkat kepadatan ---
  const congestionData: DonutDatum[] = CONGESTION_LEVELS.map((level) => ({
    key: level,
    label: CONGESTION_LABEL[level],
    value: view.congestion[level],
    color: congestionColor(level, c),
  }))

  // --- Profil per jam: gabungkan kecepatan & volume dalam satu deret ---
  const hourly = view.speedByHour.map((speed, hour) => ({
    hour,
    speed,
    vol: view.volByHour ? view.volByHour[hour] : null,
  }))

  // Jam paling lambat — berguna sebagai konteks, ditampilkan apa adanya
  // tanpa menyimpulkan penyebabnya.
  const slowest = hourly.reduce((min, h) => (h.speed < min.speed ? h : min))
  const avgSpeed = view.kpi.speed.value ?? 0

  return (
    <div className="space-y-5">
      {/* ================= KPI ================= */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Kecepatan rata-rata"
          value={formatDecimal(view.kpi.speed.value)}
          unit="km/j"
          icon={Gauge}
          tone="indigo"
          delta={view.kpi.speed.delta}
          spark={view.kpi.speed.spark}
          hint={`${view.zoneName} · ${view.rangeText.toLowerCase()}`}
        />
        <KpiCard
          label="Volume rata-rata"
          value={formatInt(view.kpi.vol.value)}
          unit="kend./jam"
          icon={Car}
          tone="teal"
          spark={view.kpi.vol.spark}
          hint="rata-rata seluruh periode (profil harian pada grafik)"
        />
        <KpiCard
          label="Waktu macet (HIGH)"
          value={formatDecimal(view.kpi.pctHigh.value)}
          unit="%"
          icon={TrafficCone}
          tone="warn"
          delta={view.kpi.pctHigh.delta}
          deltaInverted
          spark={view.kpi.pctHigh.spark}
          hint={
            view.flags.rangeFiltered
              ? "rata-rata bulanan pada rentang terpilih"
              : `${formatInt(view.congestion.HIGH)} dari ${formatInt(view.totalHours)} jam`
          }
        />
        <KpiCard
          label="Jam paling lambat"
          value={formatHour(slowest.hour)}
          icon={Clock}
          tone="bad"
          hint={`rata-rata ${formatDecimal(slowest.speed)} km/j pada jam tersebut`}
        />
      </div>

      {/* ================= Donut + line per jam ================= */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <ChartCard
          title="Tingkat kepadatan"
          description="Proporsi jam pengamatan pada tiap tingkat kepadatan."
          icon={PieChartIcon}
          accent="indigo"
          height={260}
          footnote={periodAggregateNote(view)}
        >
          <DonutChart
            data={congestionData}
            centerValue={formatPercent(view.congestionHighShare)}
            centerLabel="jam berstatus macet"
            unit="jam"
          />
        </ChartCard>

        <ChartCard
          className="lg:col-span-2"
          title="Kecepatan menurut jam"
          description="Rata-rata kecepatan pada tiap jam (00.00–23.00)."
          icon={Clock}
          accent="indigo"
          height={260}
          footnote={
            <>
              {periodAggregateNote(view)} Pola per jam ditampilkan apa adanya;
              dashboard ini tidak menyimpulkan penyebab naik-turunnya kecepatan.
            </>
          }
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={hourly}
              margin={{ top: 8, right: 12, bottom: 0, left: 0 }}
            >
              <CartesianGrid
                vertical={false}
                stroke={c.grid}
                strokeDasharray="3 3"
              />
              <XAxis
                dataKey="hour"
                tick={{ fill: c.axis, fontSize: 11 }}
                tickLine={false}
                axisLine={{ stroke: c.grid }}
                tickFormatter={(h: number) => String(h).padStart(2, "0")}
                interval={1}
              />
              <YAxis
                width={44}
                tick={{ fill: c.axis, fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                domain={["dataMin - 3", "dataMax + 3"]}
                tickFormatter={(v: number) => formatDecimal(v, 0)}
              />
              <ReferenceLine
                y={avgSpeed}
                stroke={c.axis}
                strokeDasharray="4 4"
                strokeOpacity={0.5}
              />
              <Tooltip
                cursor={{ stroke: c.grid }}
                content={
                  <ChartTooltip
                    labelFormatter={(l) => `Pukul ${formatHour(Number(l))}`}
                    valueFormatter={(v) => `${formatDecimal(v)} km/j`}
                  />
                }
              />
              <Line
                type="monotone"
                dataKey="speed"
                name="Kecepatan"
                stroke={c.indigo}
                strokeWidth={2.25}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 0 }}
                isAnimationActive={!reducedMotion}
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* ================= Bar per zona ================= */}
      <ChartCard
        title="Kecepatan dan volume per zona"
        description="Kecepatan (km/jam, sumbu kiri) dibandingkan volume kendaraan (kend./jam, sumbu kanan)."
        icon={Car}
        accent="indigo"
        height={320}
        footnote="Keduanya berasal dari sumber data lalu lintas yang sama dan merupakan rata-rata seluruh periode."
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={view.allZones}
            margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
          >
            <CartesianGrid
              vertical={false}
              stroke={c.grid}
              strokeDasharray="3 3"
            />
            <XAxis
              dataKey="name"
              tick={{ fill: c.axis, fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: c.grid }}
              interval={0}
            />
            <YAxis
              yAxisId="speed"
              width={44}
              tick={{ fill: c.axis, fontSize: 11 }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              yAxisId="vol"
              orientation="right"
              width={52}
              tick={{ fill: c.axis, fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v: number) => formatInt(v)}
            />
            <Tooltip
              cursor={{ fill: c.grid, fillOpacity: 0.25 }}
              content={
                <ChartTooltip
                  valueFormatter={(v, entry) =>
                    entry.dataKey === "speed"
                      ? `${formatDecimal(v)} km/j`
                      : `${formatInt(v)} kend./jam`
                  }
                />
              }
            />
            <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
            <Bar
              yAxisId="speed"
              dataKey="speed"
              name="Kecepatan"
              radius={[5, 5, 0, 0]}
              maxBarSize={40}
              isAnimationActive={!reducedMotion}
            >
              {view.allZones.map((z) => (
                <Cell
                  key={z.zone}
                  fill={c.teal}
                  fillOpacity={
                    view.flags.zoneFiltered && view.zone !== z.zone ? 0.3 : 1
                  }
                />
              ))}
            </Bar>
            <Bar
              yAxisId="vol"
              dataKey="vol"
              name="Volume"
              radius={[5, 5, 0, 0]}
              maxBarSize={40}
              isAnimationActive={!reducedMotion}
            >
              {view.allZones.map((z) => (
                <Cell
                  key={z.zone}
                  fill={c.coral}
                  fillOpacity={
                    view.flags.zoneFiltered && view.zone !== z.zone ? 0.3 : 1
                  }
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  )
}
