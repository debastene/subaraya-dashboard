import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { Clock, HeartPulse, ShieldAlert, Users } from "lucide-react"

import { ChartCard } from "@/components/ChartCard"
import { ChartTooltip } from "@/components/ChartTooltip"
import { KpiCard } from "@/components/KpiCard"
import { useChartColors } from "@/hooks/use-chart-colors"
import { useDashboardView } from "@/hooks/use-dashboard"
import { usePrefersReducedMotion } from "@/hooks/use-reduced-motion"
import {
  formatCompact,
  formatDecimal,
  formatHour,
  formatInt,
} from "@/lib/format"
import { ACCIDENT_NOTE, periodAggregateNote } from "@/lib/notes"

export default function Keselamatan() {
  const view = useDashboardView()
  const c = useChartColors()
  const reducedMotion = usePrefersReducedMotion()

  const totalAcc = view.kpi.acc.value ?? 0
  const totalCas = view.kpi.cas.value ?? 0
  const casPerAcc = totalAcc > 0 ? totalCas / totalAcc : null

  // --- Distribusi per jam ---
  const hourly = view.accByHour.map((acc, hour) => ({ hour, acc }))
  const maxHour = hourly.reduce((max, h) => (h.acc > max.acc ? h : max))
  const avgPerHour =
    hourly.reduce((a, h) => a + h.acc, 0) / (hourly.length || 1)

  return (
    <div className="space-y-5">
      {/* ================= KPI ================= */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Total kecelakaan"
          value={formatCompact(view.kpi.acc.value)}
          icon={ShieldAlert}
          tone="coral"
          delta={view.kpi.acc.delta}
          deltaInverted
          spark={view.kpi.acc.spark}
          hint={`total tercatat · ${view.zoneName}`}
        />
        <KpiCard
          label="Total korban"
          value={formatCompact(view.kpi.cas.value)}
          icon={Users}
          tone="bad"
          delta={view.kpi.cas.delta}
          deltaInverted
          spark={view.kpi.cas.spark}
          hint="total tercatat pada periode terpilih"
        />
        <KpiCard
          label="Korban per kecelakaan"
          value={formatDecimal(casPerAcc, 2)}
          unit="orang"
          icon={HeartPulse}
          tone="warn"
          hint="rasio total korban terhadap total kecelakaan"
        />
        <KpiCard
          label="Jam paling rawan"
          value={formatHour(maxHour.hour)}
          icon={Clock}
          tone="critical"
          hint={`${formatInt(maxHour.acc)} kecelakaan tercatat pada jam tersebut`}
        />
      </div>

      {/* ================= Per jam ================= */}
      <ChartCard
        title="Kecelakaan menurut jam"
        description="Jumlah kecelakaan tercatat pada tiap jam, digabung dari seluruh periode data."
        icon={Clock}
        accent="coral"
        height={300}
        footnote={
          <>
            {periodAggregateNote(view)} Pola per jam disajikan apa adanya —
            angka yang tinggi pada suatu jam tidak dengan sendirinya berarti jam
            tersebut menyebabkan kecelakaan.
          </>
        }
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
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
              interval={0}
            />
            <YAxis
              width={52}
              tick={{ fill: c.axis, fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v: number) => formatCompact(v)}
            />
            <ReferenceLine
              y={avgPerHour}
              stroke={c.axis}
              strokeDasharray="4 4"
              strokeOpacity={0.5}
            />
            <Tooltip
              cursor={{ fill: c.grid, fillOpacity: 0.25 }}
              content={
                <ChartTooltip
                  labelFormatter={(l) => `Pukul ${formatHour(Number(l))}`}
                  valueFormatter={(v) => `${formatInt(v)} kecelakaan`}
                />
              }
            />
            <Bar
              dataKey="acc"
              name="Kecelakaan"
              radius={[4, 4, 0, 0]}
              isAnimationActive={!reducedMotion}
            >
              {hourly.map((h) => (
                <Cell
                  key={h.hour}
                  // Batang di atas rata-rata diberi warna lebih pekat.
                  fill={h.acc >= avgPerHour ? c.coral : c.indigo}
                  fillOpacity={h.acc >= avgPerHour ? 1 : 0.55}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* ================= Per zona ================= */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartCard
          title="Kecelakaan per zona"
          description="Total kecelakaan tercatat sepanjang periode data."
          icon={ShieldAlert}
          accent="coral"
          height={280}
          footnote={ACCIDENT_NOTE}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={view.allZones}
              layout="vertical"
              margin={{ top: 4, right: 16, bottom: 0, left: 0 }}
            >
              <CartesianGrid
                horizontal={false}
                stroke={c.grid}
                strokeDasharray="3 3"
              />
              <XAxis
                type="number"
                tick={{ fill: c.axis, fontSize: 11 }}
                tickLine={false}
                axisLine={{ stroke: c.grid }}
                tickFormatter={(v: number) => formatCompact(v)}
              />
              <YAxis
                type="category"
                dataKey="name"
                width={116}
                tick={{ fill: c.axis, fontSize: 11 }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                cursor={{ fill: c.grid, fillOpacity: 0.25 }}
                content={
                  <ChartTooltip
                    valueFormatter={(v) => `${formatInt(v)} kecelakaan`}
                  />
                }
              />
              <Bar
                dataKey="acc"
                name="Kecelakaan"
                radius={[0, 5, 5, 0]}
                maxBarSize={28}
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

        <ChartCard
          title="Korban per zona"
          description="Total korban tercatat sepanjang periode data."
          icon={Users}
          accent="teal"
          height={280}
          footnote="Satu kecelakaan dapat melibatkan lebih dari satu korban, sehingga angkanya lebih besar daripada jumlah kecelakaan."
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={view.allZones}
              layout="vertical"
              margin={{ top: 4, right: 16, bottom: 0, left: 0 }}
            >
              <CartesianGrid
                horizontal={false}
                stroke={c.grid}
                strokeDasharray="3 3"
              />
              <XAxis
                type="number"
                tick={{ fill: c.axis, fontSize: 11 }}
                tickLine={false}
                axisLine={{ stroke: c.grid }}
                tickFormatter={(v: number) => formatCompact(v)}
              />
              <YAxis
                type="category"
                dataKey="name"
                width={116}
                tick={{ fill: c.axis, fontSize: 11 }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                cursor={{ fill: c.grid, fillOpacity: 0.25 }}
                content={
                  <ChartTooltip
                    valueFormatter={(v) => `${formatInt(v)} korban`}
                  />
                }
              />
              <Bar
                dataKey="cas"
                name="Korban"
                radius={[0, 5, 5, 0]}
                maxBarSize={28}
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
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  )
}
