import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import {
  Factory,
  Leaf,
  PieChart as PieChartIcon,
  TrendingUp,
  Wind,
} from "lucide-react"

import { ChartCard } from "@/components/ChartCard"
import { ChartTooltip } from "@/components/ChartTooltip"
import { KpiCard } from "@/components/KpiCard"
import { DonutChart, type DonutDatum } from "@/components/charts/DonutChart"
import { Badge } from "@/components/ui/badge"
import { useChartColors } from "@/hooks/use-chart-colors"
import { useDashboardView } from "@/hooks/use-dashboard"
import { usePrefersReducedMotion } from "@/hooks/use-reduced-motion"
import {
  PM25_CATEGORIES,
  PM25_CATEGORY_CLASS,
  PM25_THRESHOLDS,
  pm25Category,
  pm25CategoryColor,
  pm25Color,
} from "@/lib/colors"
import {
  formatDecimal,
  formatInt,
  formatMonth,
  formatMonthShort,
  formatPercent,
} from "@/lib/format"
import { monthlyScopeNote, periodAggregateNote } from "@/lib/notes"

export default function Udara() {
  const view = useDashboardView()
  const c = useChartColors()
  const reducedMotion = usePrefersReducedMotion()

  // --- Donut kategori jam ---
  const catData: DonutDatum[] = PM25_CATEGORIES.map((cat) => ({
    key: cat,
    label: cat,
    value: view.pm25Cat[cat] ?? 0,
    color: pm25CategoryColor(cat, c),
  }))

  // Porsi jam yang masuk kategori "Tidak Sehat" ke atas.
  const unhealthyHours =
    (view.pm25Cat["Tidak Sehat"] ?? 0) +
    (view.pm25Cat["Sangat Tidak Sehat"] ?? 0)
  const unhealthyShare =
    view.totalPm25Hours > 0 ? (unhealthyHours / view.totalPm25Hours) * 100 : 0

  // Zona dengan PM2.5 tertinggi & terendah (perbandingan antar zona).
  const sortedZones = [...view.allZones].sort((a, b) => b.pm25 - a.pm25)
  const worst = sortedZones[0]
  const best = sortedZones[sortedZones.length - 1]

  const avgPm25 = view.kpi.pm25.value ?? 0

  return (
    <div className="space-y-5">
      {/* ================= KPI ================= */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="PM2.5 rata-rata"
          value={formatDecimal(view.kpi.pm25.value)}
          unit="µg/m³"
          icon={Wind}
          tone="teal"
          delta={view.kpi.pm25.delta}
          deltaInverted
          spark={view.kpi.pm25.spark}
          hint={`Kategori ${pm25Category(avgPm25)} · ${view.zoneName}`}
        />
        <KpiCard
          label="Jam tidak sehat"
          value={formatDecimal(unhealthyShare)}
          unit="%"
          icon={Factory}
          tone="bad"
          hint={`${formatInt(unhealthyHours)} dari ${formatInt(view.totalPm25Hours)} jam pengamatan`}
        />
        <KpiCard
          label="PM2.5 tertinggi"
          value={worst ? worst.name : "–"}
          valueClassName="text-xl leading-tight"
          icon={Factory}
          tone="warn"
          hint={worst ? `${formatDecimal(worst.pm25)} µg/m³` : undefined}
        />
        <KpiCard
          label="PM2.5 terendah"
          value={best ? best.name : "–"}
          valueClassName="text-xl leading-tight"
          icon={Leaf}
          tone="good"
          hint={best ? `${formatDecimal(best.pm25)} µg/m³` : undefined}
        />
      </div>

      {/* ================= Bar per zona + donut kategori ================= */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <ChartCard
          className="lg:col-span-2"
          title="PM2.5 rata-rata per zona"
          description="Warna batang mengikuti kategori kualitas udara pada nilai tersebut."
          icon={Wind}
          accent="teal"
          height={280}
          footnote={
            <>
              Garis putus-putus = ambang {PM25_THRESHOLDS.sedang} µg/m³ (batas
              kategori Sedang ke Tidak Sehat). Rata-rata dihitung dari seluruh
              periode data kualitas udara.
            </>
          }
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={view.allZones}
              margin={{ top: 20, right: 12, bottom: 0, left: 0 }}
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
                width={44}
                tick={{ fill: c.axis, fontSize: 11 }}
                tickLine={false}
                axisLine={false}
              />
              <ReferenceLine
                y={PM25_THRESHOLDS.sedang}
                stroke={c.warn}
                strokeDasharray="4 4"
              />
              <Tooltip
                cursor={{ fill: c.grid, fillOpacity: 0.25 }}
                content={
                  <ChartTooltip
                    valueFormatter={(v) =>
                      `${formatDecimal(v)} µg/m³ · ${pm25Category(v)}`
                    }
                  />
                }
              />
              <Bar
                dataKey="pm25"
                name="PM2.5"
                radius={[6, 6, 0, 0]}
                maxBarSize={64}
                isAnimationActive={!reducedMotion}
              >
                <LabelList
                  dataKey="pm25"
                  position="top"
                  fill={c.axis}
                  fontSize={11}
                  formatter={(value) => formatDecimal(Number(value))}
                />
                {view.allZones.map((z) => (
                  <Cell
                    key={z.zone}
                    fill={pm25Color(z.pm25, c)}
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
          title="Kategori jam pengamatan"
          description="Berapa banyak jam berada di tiap kategori kualitas udara."
          icon={PieChartIcon}
          accent="teal"
          height={280}
          footnote={periodAggregateNote(view)}
        >
          <DonutChart
            data={catData}
            centerValue={formatPercent(unhealthyShare)}
            centerLabel="jam kategori Tidak Sehat ke atas"
            unit="jam"
          />
        </ChartCard>
      </div>

      {/* ================= Tren bulanan ================= */}
      <ChartCard
        title="Tren PM2.5 bulanan"
        description="Rata-rata konsentrasi PM2.5 per bulan (µg/m³)."
        icon={TrendingUp}
        accent="teal"
        height={300}
        footnote={monthlyScopeNote(view)}
      >
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={view.monthlyPm25}
            margin={{ top: 8, right: 12, bottom: 0, left: 0 }}
          >
            <defs>
              <linearGradient id="grad-udara" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={c.teal} stopOpacity={0.4} />
                <stop offset="100%" stopColor={c.teal} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid
              vertical={false}
              stroke={c.grid}
              strokeDasharray="3 3"
            />
            <XAxis
              dataKey="month"
              tickFormatter={formatMonthShort}
              tick={{ fill: c.axis, fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: c.grid }}
              minTickGap={20}
            />
            <YAxis
              width={44}
              tick={{ fill: c.axis, fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v: number) => formatDecimal(v, 0)}
            />
            <ReferenceLine
              y={PM25_THRESHOLDS.sedang}
              stroke={c.warn}
              strokeDasharray="4 4"
            />
            <ReferenceLine
              y={PM25_THRESHOLDS.tidakSehat}
              stroke={c.bad}
              strokeDasharray="4 4"
            />
            <Tooltip
              cursor={{ stroke: c.grid }}
              content={
                <ChartTooltip
                  labelFormatter={(l) => formatMonth(String(l))}
                  valueFormatter={(v) =>
                    `${formatDecimal(v)} µg/m³ · ${pm25Category(v)}`
                  }
                />
              }
            />
            <Area
              type="monotone"
              dataKey="value"
              name="PM2.5"
              stroke={c.teal}
              strokeWidth={2}
              fill="url(#grad-udara)"
              dot={false}
              activeDot={{ r: 3.5, strokeWidth: 0 }}
              isAnimationActive={!reducedMotion}
            />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* ================= Keterangan ambang ================= */}
      <div className="rounded-xl border border-border bg-card p-4">
        <p className="text-xs font-medium text-muted-foreground">
          Ambang kategori PM2.5 (µg/m³)
        </p>
        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          {PM25_CATEGORIES.map((cat, i) => {
            const bounds = [
              `≤ ${PM25_THRESHOLDS.baik}`,
              `${PM25_THRESHOLDS.baik + 1}–${PM25_THRESHOLDS.sedang}`,
              `${PM25_THRESHOLDS.sedang + 1}–${PM25_THRESHOLDS.tidakSehat}`,
              `> ${PM25_THRESHOLDS.tidakSehat}`,
            ]
            return (
              <Badge key={cat} className={PM25_CATEGORY_CLASS[cat]}>
                {cat}
                <span className="font-normal opacity-80">· {bounds[i]}</span>
              </Badge>
            )
          })}
        </div>
      </div>
    </div>
  )
}
