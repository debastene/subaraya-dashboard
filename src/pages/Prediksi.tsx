import * as React from "react"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import {
  AlertTriangle,
  BrainCircuit,
  CalendarDays,
  Clock,
  Flame,
  Gauge,
  Info,
  ShieldAlert,
  Sparkles,
  TriangleAlert,
} from "lucide-react"

import { ChartCard } from "@/components/ChartCard"
import { ChartTooltip } from "@/components/ChartTooltip"
import { KpiCard } from "@/components/KpiCard"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { useChartColors } from "@/hooks/use-chart-colors"
import { usePrefersReducedMotion } from "@/hooks/use-reduced-motion"
import { formatDecimal, formatPercent } from "@/lib/format"
import {
  forecastByZone,
  forecastDaily,
  forecastSlice,
  nextMidnightIndex,
  predictionData,
  resolveAnchor,
} from "@/lib/forecast"
import { useFilters } from "@/store/filters"
import type { PredictionMetric } from "@/types"
import { dashboardData } from "@/data"
import { cn } from "@/lib/utils"

/** Nama estimator -> penjelasan singkat untuk pembaca awam. */
const MODEL_LABEL: Record<string, string> = {
  PoissonRegressor: "regresi Poisson",
  RandomForestClassifier: "random forest",
  GaussianNB: "naive Bayes",
  LogisticRegression: "regresi logistik",
}

/** Urutan & judul blok evaluasi. */
const EVAL_ROWS: [PredictionMetric, string][] = [
  ["expected", "Perkiraan jumlah kecelakaan"],
  ["occurrence", "Peluang ada kecelakaan"],
  ["severe", "Risiko kecelakaan berat"],
]

function zoneName(code: string): string {
  return dashboardData.per_zone.find((z) => z.zone === code)?.name ?? code
}

export default function Prediksi() {
  const { zone } = useFilters()
  const c = useChartColors()
  const reducedMotion = usePrefersReducedMotion()

  const { meta } = predictionData
  const diag = meta.diagnostics ?? {}
  const evaluation = meta.evaluation ?? { available: false }

  // Metrik yang diukur pada estimator berbeda dari yang dipakai memprediksi.
  // Disebut sekali di catatan kaki, bukan sebagai peringatan di tiap kartu.
  const mismatchLabel = (evaluation.estimator_mismatch ?? [])
    .map((k) => EVAL_ROWS.find(([key]) => key === k)?.[1].toLowerCase())
    .filter(Boolean)
    .join(" dan ")

  // Titik acuan "sekarang". Dihitung sekali per render halaman.
  const anchor = React.useMemo(() => resolveAnchor(), [])

  const next24 = React.useMemo(
    () => forecastSlice(zone, anchor.index, 24),
    [zone, anchor.index],
  )
  // Mulai dari tengah malam berikutnya supaya tiap batang = satu hari penuh.
  const dailyStart = React.useMemo(
    () => nextMidnightIndex(anchor.index),
    [anchor.index],
  )
  const daily = React.useMemo(
    () => forecastDaily(zone, dailyStart, 7),
    [zone, dailyStart],
  )
  const byZone = React.useMemo(
    () => forecastByZone(anchor.index),
    [anchor.index],
  )

  const nextHour = next24[0]
  const peak = next24.reduce(
    (best, p) => ((p.expected ?? -1) > (best.expected ?? -1) ? p : best),
    next24[0],
  )

  // Data chart 24 jam: peluang diubah ke persen agar satu sumbu enak dibaca.
  const hourlyChart = next24.map((p) => ({
    label: p.hourLabel,
    full: p.shortLabel,
    expected: p.expected,
    occurrencePct: p.occurrence == null ? null : p.occurrence * 100,
    severePct: p.severe == null ? null : p.severe * 100,
  }))

  const zoneChart = byZone.map((z) => ({
    ...z,
    name: zoneName(z.zone),
  }))

  const scopeText = zone === "all" ? "seluruh zona" : zoneName(zone)
  const waktuAcuan = anchor.ts.toLocaleString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })

  // --- Daftar catatan keterbatasan, disusun dari diagnostik model ---
  const warnings: string[] = []
  if (diag.hour_monotonic) {
    warnings.push(
      `Model memperlakukan jam sebagai angka linear, sehingga kurva 24 jam hanya bisa menurun atau menaik — puncak jam sibuk pagi dan sore tidak dapat digambarkan. Pada model ini nilai tertinggi jatuh di pukul ${String(diag.hour_peak ?? 0).padStart(2, "0")}.00 dan terendah di pukul ${String(diag.hour_low ?? 23).padStart(2, "0")}.00, lalu melompat kembali saat pergantian hari.`,
    )
  }
  if (typeof diag.zone_spread_pct === "number" && diag.zone_spread_pct < 5) {
    warnings.push(
      `Perbedaan antar zona pada jam yang sama hanya ${formatPercent(diag.zone_spread_pct, 2)} dari rata-rata, jadi pemecahan per zona pada halaman ini nyaris tidak membawa informasi.`,
    )
  }
  if (typeof diag.consistency_corr === "number" && diag.consistency_corr < 0.9) {
    warnings.push(
      `Model jumlah dan model peluang belum sejalan: korelasi antara peluang yang diprediksi dan nilai yang seharusnya (1 − e^−λ) hanya ${formatDecimal(diag.consistency_corr, 2)}. Kedua angka pada halaman ini bisa saling bertentangan.`,
    )
  }
  if (diag.occurrence_saturated) {
    warnings.push(
      "Sebagian besar peluang kejadian menempel di angka 100%, ciri khas model yang terlalu menghafal data latih. Angka peluang sebaiknya dibaca sebagai indikasi kasar.",
    )
  }

  return (
    <div className="space-y-5">
      {/* ================= Disclaimer utama ================= */}
      <Card className="border-coral/30 bg-coral/5">
        <div className="flex items-start gap-3 p-4">
          <Sparkles className="mt-0.5 size-4 shrink-0 text-coral" aria-hidden />
          <div className="space-y-1 text-sm">
            <p className="font-medium">Halaman ini berisi prediksi, bukan catatan kejadian</p>
            <p className="text-muted-foreground">
              Semua angka di bawah adalah keluaran model statistik, bukan
              kecelakaan yang benar-benar tercatat. Model hanya memakai{" "}
              <strong className="font-medium text-foreground">
                waktu dan kode zona
              </strong>{" "}
              sebagai masukan — tidak memakai data lalu lintas maupun kualitas
              udara, sehingga tetap berdiri sebagai indikator mandiri. Filter
              rentang waktu di atas tidak berlaku di halaman ini karena yang
              ditampilkan adalah waktu ke depan.
            </p>
          </div>
        </div>
      </Card>

      {/* ================= Peringatan dari diagnostik model ================= */}
      {warnings.length > 0 ? (
        <Card className="border-cond-warn/30 bg-cond-warn/5">
          <div className="flex items-start gap-3 p-4">
            <TriangleAlert
              className="mt-0.5 size-4 shrink-0 text-cond-warn"
              aria-hidden
            />
            <div className="space-y-2 text-sm">
              <p className="font-medium">
                Keterbatasan model yang perlu diketahui
              </p>
              <ul className="list-disc space-y-1.5 pl-4 text-muted-foreground">
                {warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
              <p className="text-xs text-muted-foreground">
                Catatan ini dihasilkan otomatis dari pemeriksaan model oleh{" "}
                <code className="rounded bg-muted px-1 py-0.5 text-[11px]">
                  scripts/predict.py
                </code>{" "}
                dan akan hilang sendiri begitu modelnya diperbaiki.
              </p>
            </div>
          </div>
        </Card>
      ) : null}

      {/* ================= Di luar rentang ================= */}
      {anchor.outOfRange ? (
        <Card className="border-cond-bad/30 bg-cond-bad/5">
          <div className="flex items-start gap-3 p-4">
            <AlertTriangle
              className="mt-0.5 size-4 shrink-0 text-cond-bad"
              aria-hidden
            />
            <div className="space-y-1 text-sm">
              <p className="font-medium">Prediksi sudah kedaluwarsa</p>
              <p className="text-muted-foreground">
                Berkas prediksi hanya mencakup{" "}
                {anchor.coverageStart.toLocaleDateString("id-ID")} –{" "}
                {anchor.coverageEnd.toLocaleDateString("id-ID")}, sedangkan hari
                ini berada di luar rentang itu. Halaman memakai awal rentang
                sebagai acuan. Jalankan{" "}
                <code className="rounded bg-muted px-1 py-0.5 text-[11px]">
                  python scripts/predict.py
                </code>{" "}
                untuk memperbaruinya.
              </p>
            </div>
          </div>
        </Card>
      ) : null}

      {/* ================= KPI ================= */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Perkiraan kecelakaan"
          value={formatDecimal(nextHour?.expected)}
          unit="kejadian"
          icon={ShieldAlert}
          tone="coral"
          spark={next24.map((p) => p.expected ?? 0)}
          hint={`satu jam ke depan · ${scopeText}`}
        />
        <KpiCard
          label="Peluang kecelakaan"
          value={formatDecimal(
            nextHour?.occurrence == null ? null : nextHour.occurrence * 100,
          )}
          unit="%"
          icon={Flame}
          tone="warn"
          spark={next24.map((p) => (p.occurrence ?? 0) * 100)}
          hint={
            zone === "all"
              ? "rata-rata antar zona, satu jam ke depan"
              : "satu jam ke depan"
          }
        />
        <KpiCard
          label="Risiko kecelakaan berat"
          value={formatDecimal(
            nextHour?.severe == null ? null : nextHour.severe * 100,
          )}
          unit="%"
          icon={TriangleAlert}
          tone="bad"
          spark={next24.map((p) => (p.severe ?? 0) * 100)}
          hint={
            zone === "all"
              ? "rata-rata antar zona, satu jam ke depan"
              : "satu jam ke depan"
          }
        />
        <KpiCard
          label="Jam tertinggi (24 jam)"
          value={peak?.hourLabel ?? "–"}
          icon={Clock}
          tone="critical"
          hint={`perkiraan ${formatDecimal(peak?.expected)} kejadian pada jam itu`}
        />
      </div>

      {/* ================= 24 jam ke depan ================= */}
      <ChartCard
        title="24 jam ke depan"
        description="Batang = perkiraan jumlah kecelakaan. Garis = peluang kejadian dan risiko kecelakaan berat."
        icon={Clock}
        accent="coral"
        height={320}
        footnote={
          <>
            Dihitung mulai {waktuAcuan} untuk {scopeText}.
            {zone === "all"
              ? " Perkiraan jumlah dijumlahkan antar zona, sedangkan peluang dirata-ratakan antar zona."
              : ""}
          </>
        }
      >
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={hourlyChart}
            margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
          >
            <CartesianGrid
              vertical={false}
              stroke={c.grid}
              strokeDasharray="3 3"
            />
            <XAxis
              dataKey="label"
              tick={{ fill: c.axis, fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: c.grid }}
              interval={1}
            />
            <YAxis
              yAxisId="count"
              width={44}
              tick={{ fill: c.axis, fontSize: 11 }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              yAxisId="pct"
              orientation="right"
              width={44}
              domain={[0, 100]}
              tick={{ fill: c.axis, fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v: number) => `${v}%`}
            />
            <Tooltip
              cursor={{ fill: c.grid, fillOpacity: 0.25 }}
              content={
                <ChartTooltip
                  labelFormatter={(l) => `Pukul ${l}`}
                  valueFormatter={(v, entry) =>
                    entry.dataKey === "expected"
                      ? `${formatDecimal(v)} kejadian`
                      : formatPercent(v)
                  }
                />
              }
            />
            <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
            <Bar
              yAxisId="count"
              dataKey="expected"
              name="Perkiraan kecelakaan"
              fill={c.coral}
              radius={[4, 4, 0, 0]}
              maxBarSize={26}
              isAnimationActive={!reducedMotion}
            />
            <Line
              yAxisId="pct"
              type="monotone"
              dataKey="occurrencePct"
              name="Peluang kejadian"
              stroke={c.teal}
              strokeWidth={2}
              dot={false}
              isAnimationActive={!reducedMotion}
            />
            <Line
              yAxisId="pct"
              type="monotone"
              dataKey="severePct"
              name="Risiko berat"
              stroke={c.indigo}
              strokeWidth={2}
              strokeDasharray="4 3"
              dot={false}
              isAnimationActive={!reducedMotion}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* ================= 7 hari + perbandingan zona ================= */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <ChartCard
          className="lg:col-span-2"
          title="Tujuh hari ke depan"
          description="Total perkiraan kecelakaan per hari. Akhir pekan diberi warna berbeda."
          icon={CalendarDays}
          accent="coral"
          height={260}
          footnote={
            <>
              Tiap batang adalah satu hari kalender penuh (00.00–23.00),
              dihitung mulai {daily[0]?.label ?? "-"}. Akhir pekan memang
              diprediksi lebih rendah — model memakai penanda akhir pekan
              sebagai salah satu masukannya.
            </>
          }
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={daily}
              margin={{ top: 8, right: 12, bottom: 0, left: 0 }}
            >
              <CartesianGrid
                vertical={false}
                stroke={c.grid}
                strokeDasharray="3 3"
              />
              <XAxis
                dataKey="label"
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
              <Tooltip
                cursor={{ fill: c.grid, fillOpacity: 0.25 }}
                content={
                  <ChartTooltip
                    valueFormatter={(v) => `${formatDecimal(v)} kejadian`}
                  />
                }
              />
              <Bar
                dataKey="expectedTotal"
                name="Perkiraan sehari"
                radius={[5, 5, 0, 0]}
                maxBarSize={48}
                isAnimationActive={!reducedMotion}
              >
                {daily.map((d) => (
                  <Cell
                    key={d.label}
                    fill={d.isWeekend ? c.indigo : c.coral}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Perbandingan zona"
          description="Perkiraan kecelakaan pada jam yang sama untuk keempat zona."
          icon={ShieldAlert}
          accent="neutral"
          height={260}
          footnote={
            typeof diag.zone_spread_pct === "number" ? (
              <>
                Selisih antar zona hanya{" "}
                <strong className="font-medium text-foreground">
                  {formatPercent(diag.zone_spread_pct, 2)}
                </strong>{" "}
                dari rata-rata — keempat batang hampir sama panjang karena
                model memang nyaris tidak membedakan zona.
              </>
            ) : null
          }
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={zoneChart}
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
              />
              <YAxis
                type="category"
                dataKey="name"
                width={112}
                tick={{ fill: c.axis, fontSize: 11 }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                cursor={{ fill: c.grid, fillOpacity: 0.25 }}
                content={
                  <ChartTooltip
                    valueFormatter={(v) => `${formatDecimal(v, 3)} kejadian`}
                  />
                }
              />
              <Bar
                dataKey="expected"
                name="Perkiraan"
                radius={[0, 5, 5, 0]}
                maxBarSize={26}
                isAnimationActive={!reducedMotion}
              >
                {zoneChart.map((z) => (
                  <Cell
                    key={z.zone}
                    fill={c.coral}
                    fillOpacity={zone !== "all" && zone !== z.zone ? 0.3 : 1}
                  />
                ))}
              </Bar>
              <ReferenceLine x={0} stroke={c.grid} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* ================= Info model ================= */}
      <Card>
        <div className="flex items-start gap-3 p-5 pb-3">
          <span
            aria-hidden
            className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground"
          >
            <BrainCircuit className="size-4" />
          </span>
          <div>
            <h3 className="text-sm font-semibold leading-tight">
              Model yang dipakai
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Dijalankan di luar browser; dashboard hanya membaca tabel hasilnya.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 px-5 pb-5 sm:grid-cols-3">
          {(
            [
              ["expected", "Perkiraan jumlah", "kejadian per jam per zona"],
              ["occurrence", "Peluang kejadian", "ada ≥1 kecelakaan pada jam itu"],
              ["severe", "Risiko berat", "kecelakaan tergolong berat"],
            ] as const
          ).map(([key, title, desc]) => {
            const estimator = meta.models[key]
            return (
              <div
                key={key}
                className="rounded-lg border border-border p-3.5"
              >
                <p className="text-sm font-medium">{title}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{desc}</p>
                <Badge variant="muted" className="mt-2">
                  {estimator
                    ? (MODEL_LABEL[estimator] ?? estimator)
                    : "tidak tersedia"}
                </Badge>
              </div>
            )
          })}
        </div>

        <div className="flex items-start gap-2 border-t border-border px-5 py-3 text-[11px] leading-relaxed text-muted-foreground">
          <Info className="mt-px size-3.5 shrink-0" aria-hidden />
          <span>
            Masukan model:{" "}
            <code className="rounded bg-muted px-1 py-0.5">zone_id</code>,{" "}
            <code className="rounded bg-muted px-1 py-0.5">hour</code>,{" "}
            <code className="rounded bg-muted px-1 py-0.5">day_of_week</code>,{" "}
            <code className="rounded bg-muted px-1 py-0.5">day_of_month</code>,{" "}
            <code className="rounded bg-muted px-1 py-0.5">month</code>,{" "}
            <code className="rounded bg-muted px-1 py-0.5">is_weekend</code>.
            Prediksi dihitung untuk{" "}
            <span className={cn("tabular")}>{meta.hours.toLocaleString("id-ID")}</span>{" "}
            jam ke depan dan disimpan sebagai tabel statis, terakhir diperbarui{" "}
            {new Date(meta.generated_at).toLocaleDateString("id-ID", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
            .
          </span>
        </div>
      </Card>

      {/* ================= Evaluasi model ================= */}
      <Card>
        <div className="flex items-start gap-3 p-5 pb-3">
          <span
            aria-hidden
            className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground"
          >
            <Gauge className="size-4" />
          </span>
          <div>
            <h3 className="text-sm font-semibold leading-tight">
              Seberapa bagus modelnya?
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Diukur pada data uji yang terpisah dari data latih, dibandingkan
              dengan tebakan naif.
            </p>
          </div>
        </div>

        {!evaluation.available ? (
          <p className="px-5 pb-5 text-xs leading-relaxed text-muted-foreground">
            Model ini belum disertai angka evaluasi
            {evaluation.reason ? ` (${evaluation.reason})` : ""}. Jalankan{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-[11px]">
              python ml/train.py
            </code>{" "}
            untuk menghasilkannya, lalu{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-[11px]">
              python scripts/predict.py
            </code>
            .
          </p>
        ) : (
          <div className="space-y-3 px-5 pb-5">
            {EVAL_ROWS.map(([key, title]) => {
              const row = evaluation.models?.[key]
              if (!row) return null
              const t = row.test ?? {}
              const d = row.dummy_test ?? {}

              return (
                <div key={key} className="rounded-lg border border-border p-3.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-medium">{title}</p>
                    <Badge variant="muted">{row.used_estimator}</Badge>
                  </div>

                  <dl className="mt-2.5 flex flex-wrap gap-x-6 gap-y-1.5 text-xs">
                    {t.mae != null ? (
                      <Metric
                        label="MAE"
                        value={formatDecimal(t.mae, 4)}
                        baseline={d.mae != null ? formatDecimal(d.mae, 4) : null}
                      />
                    ) : null}
                    {t.rmse != null ? (
                      <Metric
                        label="RMSE"
                        value={formatDecimal(t.rmse, 4)}
                        baseline={d.rmse != null ? formatDecimal(d.rmse, 4) : null}
                      />
                    ) : null}
                    {t.roc_auc != null ? (
                      <Metric label="ROC-AUC" value={formatDecimal(t.roc_auc, 4)} />
                    ) : null}
                    {t.pr_auc != null ? (
                      <Metric
                        label="PR-AUC"
                        value={formatDecimal(t.pr_auc, 4)}
                        baseline={
                          d.pr_auc != null ? formatDecimal(d.pr_auc, 4) : null
                        }
                      />
                    ) : null}
                    {t.base_rate != null ? (
                      <Metric
                        label="Base rate"
                        value={formatPercent(t.base_rate * 100)}
                      />
                    ) : null}
                  </dl>
                </div>
              )
            })}
          </div>
        )}

        {evaluation.available ? (
          <div className="flex items-start gap-2 border-t border-border px-5 py-3 text-[11px] leading-relaxed text-muted-foreground">
            <Info className="mt-px size-3.5 shrink-0" aria-hidden />
            <span>
              Sumber angka: {evaluation.source ?? "models/metrics.json"}.
              {evaluation.split?.test
                ? ` Data uji ${evaluation.split.test.rows.toLocaleString("id-ID")} baris, ${evaluation.split.test.start.slice(0, 10)} sampai ${evaluation.split.test.end.slice(0, 10)}.`
                : ""}{" "}
              Angka dalam kurung adalah tebakan naif sebagai pembanding —
              model baru berguna kalau lebih baik dari itu.
              {mismatchLabel ? ` Metrik ${mismatchLabel} diukur pada LogisticRegression.` : ""}
            </span>
          </div>
        ) : null}
      </Card>
    </div>
  )
}

/** Satu metrik beserta pembanding naifnya. */
function Metric({
  label,
  value,
  baseline,
}: {
  label: string
  value: string
  baseline?: string | null
}) {
  return (
    <div className="flex items-baseline gap-1.5">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="tabular font-medium">
        {value}
        {baseline ? (
          <span className="ml-1 font-normal text-muted-foreground">
            (naif {baseline})
          </span>
        ) : null}
      </dd>
    </div>
  )
}
