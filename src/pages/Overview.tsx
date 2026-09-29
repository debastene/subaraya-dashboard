import * as React from "react"
import { Link } from "react-router-dom"
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import {
  AlertTriangle,
  ArrowRight,
  Gauge,
  Info,
  PieChart as PieChartIcon,
  Radar as RadarIcon,
  ShieldAlert,
  TrafficCone,
  TrendingUp,
  Wind,
} from "lucide-react"

import { ChartCard } from "@/components/ChartCard"
import { ChartTooltip } from "@/components/ChartTooltip"
import { KpiCard } from "@/components/KpiCard"
import { DonutChart, type DonutDatum } from "@/components/charts/DonutChart"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useChartColors } from "@/hooks/use-chart-colors"
import { useDashboardView } from "@/hooks/use-dashboard"
import { usePrefersReducedMotion } from "@/hooks/use-reduced-motion"
import {
  CONGESTION_LABEL,
  CONGESTION_LEVELS,
  congestionColor,
  pm25Category,
  pm25Color,
  PM25_THRESHOLDS,
  zoneColor,
} from "@/lib/colors"
import {
  formatCompact,
  formatDecimal,
  formatInt,
  formatMonth,
  formatMonthShort,
  formatPercent,
} from "@/lib/format"
import { buildRadarData, zoneNeedingAttention } from "@/lib/metrics"
import {
  ACCIDENT_NOTE,
  monthlyScopeNote,
  periodAggregateNote,
  SOURCE_NOTE,
} from "@/lib/notes"

export default function Overview() {
  const view = useDashboardView()
  const c = useChartColors()
  const reducedMotion = usePrefersReducedMotion()

  // --- Data donut kepadatan lalu lintas ---
  const congestionData: DonutDatum[] = CONGESTION_LEVELS.map((level) => ({
    key: level,
    label: CONGESTION_LABEL[level],
    value: view.congestion[level],
    color: congestionColor(level, c),
  }))

  // --- Radar perbandingan antar zona (selalu memakai seluruh zona) ---
  const radarData = React.useMemo(
    () => buildRadarData(view.allZones),
    [view.allZones],
  )
  const attention = React.useMemo(
    () => zoneNeedingAttention(view.allZones),
    [view.allZones],
  )
  const attentionZone = view.allZones.find((z) => z.zone === attention?.zone)

  return (
    <div className="space-y-5">
      {/* ================= Disclaimer ================= */}
      <Card className="border-teal/30 bg-teal/5">
        <div className="flex items-start gap-3 p-4">
          <Info className="mt-0.5 size-4 shrink-0 text-teal" aria-hidden />
          <div className="space-y-1 text-sm">
            <p className="font-medium">Tentang data yang ditampilkan</p>
            <p className="text-muted-foreground">
              Lokasi dan waktu pada dashboard ini adalah{" "}
              <strong className="font-medium text-foreground">simulasi</strong> —
              data publik yang dinormalisasi ke dalam 4 zona kota Subaraya.
              Lalu lintas, kualitas udara, dan kecelakaan berasal dari{" "}
              <strong className="font-medium text-foreground">
                sumber yang berbeda
              </strong>{" "}
              sehingga disajikan sebagai tiga indikator mandiri, tanpa klaim
              hubungan sebab-akibat di antaranya.
            </p>
          </div>
        </div>
      </Card>

      <Tabs defaultValue="ringkasan">
        <TabsList>
          <TabsTrigger value="ringkasan">Ringkasan</TabsTrigger>
          <TabsTrigger value="detail">Detail per zona</TabsTrigger>
        </TabsList>

        {/* ======================================================= */}
        {/* TAB 1 — RINGKASAN                                        */}
        {/* ======================================================= */}
        <TabsContent value="ringkasan" className="space-y-5">
          {/* ---- 4 KPI utama ---- */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              label="Kecepatan rata-rata"
              value={formatDecimal(view.kpi.speed.value)}
              unit="km/j"
              icon={Gauge}
              tone="teal"
              delta={view.kpi.speed.delta}
              spark={view.kpi.speed.spark}
              hint={`${view.zoneName} · ${view.rangeText.toLowerCase()}`}
            />
            <KpiCard
              label="PM2.5 rata-rata"
              value={formatDecimal(view.kpi.pm25.value)}
              unit="µg/m³"
              icon={Wind}
              tone="coral"
              delta={view.kpi.pm25.delta}
              deltaInverted
              spark={view.kpi.pm25.spark}
              hint={`Kategori ${pm25Category(view.kpi.pm25.value ?? 0)}`}
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
                  : `dari ${formatInt(view.totalHours)} jam pengamatan`
              }
            />
            <KpiCard
              label="Total kecelakaan"
              value={formatCompact(view.kpi.acc.value)}
              icon={ShieldAlert}
              tone="bad"
              delta={view.kpi.acc.delta}
              deltaInverted
              spark={view.kpi.acc.spark}
              hint="total tercatat pada periode terpilih"
            />
          </div>

          {/* ---- Donut kepadatan + tren PM2.5 ---- */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <ChartCard
              title="Distribusi tingkat kepadatan"
              description="Proporsi jam pengamatan pada tiap tingkat kepadatan lalu lintas."
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
              title="Tren PM2.5 bulanan"
              description="Rata-rata konsentrasi PM2.5 per bulan (µg/m³)."
              icon={TrendingUp}
              accent="teal"
              height={260}
              footnote={
                <>
                  {monthlyScopeNote(view)} Garis putus-putus = ambang{" "}
                  {PM25_THRESHOLDS.sedang} µg/m³, batas antara kategori Sedang
                  dan Tidak Sehat.
                </>
              }
            >
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={view.monthlyPm25}
                  margin={{ top: 8, right: 12, bottom: 0, left: 0 }}
                >
                  <defs>
                    <linearGradient id="grad-pm25" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={c.teal} stopOpacity={0.35} />
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
                    strokeWidth={1.25}
                  />
                  <Tooltip
                    cursor={{ stroke: c.grid }}
                    content={
                      <ChartTooltip
                        labelFormatter={(l) => formatMonth(String(l))}
                        valueFormatter={(v) => `${formatDecimal(v)} µg/m³`}
                      />
                    }
                  />
                  <Area
                    type="monotone"
                    dataKey="value"
                    name="PM2.5"
                    stroke={c.teal}
                    strokeWidth={2}
                    fill="url(#grad-pm25)"
                    isAnimationActive={!reducedMotion}
                    animationDuration={700}
                    dot={false}
                    activeDot={{ r: 3.5, strokeWidth: 0 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>

          {/* ---- Radar + callout ---- */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <ChartCard
              className="lg:col-span-2"
              title="Perbandingan kondisi antar zona"
              description="Skor relatif 0–100 untuk tiga indikator mandiri; 100 = kondisi terbaik di antara keempat zona."
              icon={RadarIcon}
              accent="neutral"
              height={320}
              footnote={
                <>
                  Normalisasi dilakukan per indikator: kelancaran memakai rasio
                  terhadap kecepatan tertinggi, sedangkan udara bersih dan
                  keselamatan memakai rasio terhadap nilai terendah (makin
                  rendah PM2.5/kecelakaan, makin tinggi skor). {SOURCE_NOTE}
                </>
              }
            >
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData} outerRadius="72%">
                  <PolarGrid stroke={c.grid} />
                  <PolarAngleAxis
                    dataKey="indikator"
                    tick={{ fill: c.axis, fontSize: 12 }}
                  />
                  <PolarRadiusAxis
                    domain={[0, 100]}
                    tick={false}
                    axisLine={false}
                  />
                  {view.allZones.map((z) => (
                    <Radar
                      key={z.zone}
                      name={`${z.zone} · ${z.name}`}
                      dataKey={z.zone}
                      stroke={zoneColor(z.zone, c)}
                      fill={zoneColor(z.zone, c)}
                      fillOpacity={0.1}
                      strokeWidth={2}
                      isAnimationActive={!reducedMotion}
                    />
                  ))}
                  <Legend
                    wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
                    iconType="plainline"
                    iconSize={14}
                  />
                  <Tooltip
                    content={
                      <ChartTooltip
                        valueFormatter={(v) => `${formatDecimal(v)} / 100`}
                      />
                    }
                  />
                </RadarChart>
              </ResponsiveContainer>
            </ChartCard>

            {/* ---- Callout: zona paling perlu perhatian ---- */}
            <Card className="flex flex-col">
              <div className="flex items-start gap-3 p-5 pb-3">
                <span
                  aria-hidden
                  className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-cond-warn/12 text-cond-warn"
                >
                  <AlertTriangle className="size-4" />
                </span>
                <div>
                  <h3 className="text-sm font-semibold leading-tight">
                    Zona paling perlu perhatian
                  </h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Skor gabungan terendah dari tiga indikator mandiri.
                  </p>
                </div>
              </div>

              {attention && attentionZone ? (
                <div className="flex flex-1 flex-col px-5 pb-5">
                  <div className="flex items-baseline gap-2">
                    <span className="text-xl font-bold tracking-tight">
                      {attentionZone.name}
                    </span>
                    <Badge variant="muted">{attentionZone.zone}</Badge>
                  </div>

                  <dl className="mt-4 space-y-2.5 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <dt className="text-muted-foreground">Kecepatan</dt>
                      <dd className="tabular font-medium">
                        {formatDecimal(attentionZone.speed)} km/j
                      </dd>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <dt className="text-muted-foreground">PM2.5</dt>
                      <dd className="tabular flex items-center gap-1.5 font-medium">
                        <span
                          aria-hidden
                          className="size-2 rounded-full"
                          style={{
                            backgroundColor: pm25Color(attentionZone.pm25, c),
                          }}
                        />
                        {formatDecimal(attentionZone.pm25)} µg/m³
                      </dd>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <dt className="text-muted-foreground">
                        Kecelakaan tercatat
                      </dt>
                      <dd className="tabular font-medium">
                        {formatInt(attentionZone.acc)}
                      </dd>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <dt className="text-muted-foreground">Skor gabungan</dt>
                      <dd className="tabular font-medium">
                        {formatDecimal(attention.overall)} / 100
                      </dd>
                    </div>
                  </dl>

                  <div className="mt-auto pt-4">
                    <Button asChild variant="outline" size="sm" className="w-full">
                      <Link to="/data">
                        Lihat tabel lengkap
                        <ArrowRight className="size-4" aria-hidden />
                      </Link>
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="px-5 pb-5 text-sm text-muted-foreground">
                  Data zona belum tersedia.
                </p>
              )}
            </Card>
          </div>
        </TabsContent>

        {/* ======================================================= */}
        {/* TAB 2 — DETAIL PER ZONA                                  */}
        {/* ======================================================= */}
        <TabsContent value="detail" className="space-y-5">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {/* Kecepatan & PM2.5 per zona — dua indikator, dua warna */}
            <ChartCard
              title="Kecepatan rata-rata per zona"
              description="Semakin tinggi semakin lancar (km/jam)."
              icon={Gauge}
              accent="indigo"
              height={260}
              footnote="Rata-rata seluruh periode data, dihitung dari sumber data lalu lintas."
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={view.allZones}
                  margin={{ top: 8, right: 12, bottom: 0, left: 0 }}
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
                    width={40}
                    tick={{ fill: c.axis, fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    cursor={{ fill: c.grid, fillOpacity: 0.25 }}
                    content={
                      <ChartTooltip
                        valueFormatter={(v) => `${formatDecimal(v)} km/j`}
                      />
                    }
                  />
                  <Bar
                    dataKey="speed"
                    name="Kecepatan"
                    radius={[6, 6, 0, 0]}
                    maxBarSize={56}
                    isAnimationActive={!reducedMotion}
                  >
                    {view.allZones.map((z) => (
                      <Cell
                        key={z.zone}
                        fill={
                          view.flags.zoneFiltered && view.zone !== z.zone
                            ? c.indigo
                            : c.teal
                        }
                        fillOpacity={
                          view.flags.zoneFiltered && view.zone !== z.zone
                            ? 0.25
                            : 1
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard
              title="PM2.5 rata-rata per zona"
              description="Warna batang mengikuti kategori kualitas udara."
              icon={Wind}
              accent="teal"
              height={260}
              footnote="Rata-rata seluruh periode data, dihitung dari sumber data kualitas udara."
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={view.allZones}
                  margin={{ top: 8, right: 12, bottom: 0, left: 0 }}
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
                    width={40}
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
                        valueFormatter={(v) => `${formatDecimal(v)} µg/m³`}
                      />
                    }
                  />
                  <Bar
                    dataKey="pm25"
                    name="PM2.5"
                    radius={[6, 6, 0, 0]}
                    maxBarSize={56}
                    isAnimationActive={!reducedMotion}
                  >
                    {view.allZones.map((z) => (
                      <Cell
                        key={z.zone}
                        fill={pm25Color(z.pm25, c)}
                        fillOpacity={
                          view.flags.zoneFiltered && view.zone !== z.zone
                            ? 0.3
                            : 1
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>

          {/* Kecelakaan & korban per zona — pasangan teal/coral */}
          <ChartCard
            title="Kecelakaan dan korban per zona"
            description="Total kumulatif seluruh periode data."
            icon={ShieldAlert}
            accent="coral"
            height={300}
            footnote={ACCIDENT_NOTE}
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={view.allZones}
                margin={{ top: 8, right: 12, bottom: 0, left: 0 }}
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
                  width={52}
                  tick={{ fill: c.axis, fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v: number) => formatCompact(v)}
                />
                <Tooltip
                  cursor={{ fill: c.grid, fillOpacity: 0.25 }}
                  content={
                    <ChartTooltip valueFormatter={(v) => formatInt(v)} />
                  }
                />
                <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                <Bar
                  dataKey="acc"
                  name="Kecelakaan"
                  fill={c.teal}
                  radius={[5, 5, 0, 0]}
                  maxBarSize={42}
                  isAnimationActive={!reducedMotion}
                />
                <Bar
                  dataKey="cas"
                  name="Korban"
                  fill={c.coral}
                  radius={[5, 5, 0, 0]}
                  maxBarSize={42}
                  isAnimationActive={!reducedMotion}
                />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </TabsContent>
      </Tabs>
    </div>
  )
}
