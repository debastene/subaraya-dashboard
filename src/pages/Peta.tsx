import * as React from "react"
import { Layers, MapPin } from "lucide-react"

import { ChartCard } from "@/components/ChartCard"
import { MAP_METRICS, ZoneMap } from "@/components/ZoneMap"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { useChartColors } from "@/hooks/use-chart-colors"
import { useDashboardView } from "@/hooks/use-dashboard"
import {
  PM25_CATEGORIES,
  PM25_THRESHOLDS,
  ZONE_STATUS_CLASS,
  pm25CategoryColor,
  zoneStatus,
} from "@/lib/colors"
import { formatDecimal, formatInt } from "@/lib/format"
import { useFilters } from "@/store/filters"
import type { MapMetric } from "@/types"
import { cn } from "@/lib/utils"

export default function Peta() {
  const view = useDashboardView()
  const c = useChartColors()
  const { zone, setZone } = useFilters()
  const [metric, setMetric] = React.useState<MapMetric>("pm25")

  const meta = MAP_METRICS.find((m) => m.value === metric) ?? MAP_METRICS[0]

  const valueOf = (z: (typeof view.zonesGeo)[number]) =>
    metric === "pm25" ? z.pm25 : metric === "speed" ? z.speed : z.acc

  const formatValue = (value: number) =>
    metric === "acc" ? formatInt(value) : formatDecimal(value)

  // Urutkan daftar zona: kondisi paling menonjol lebih dulu.
  const orderedZones = [...view.zonesGeo].sort((a, b) =>
    meta.higherIsWorse ? valueOf(b) - valueOf(a) : valueOf(a) - valueOf(b),
  )

  /** Tombol pemilih metrik (segmented control). */
  const metricSwitcher = (
    <div
      role="radiogroup"
      aria-label="Pilih metrik peta"
      className="flex items-center gap-1 rounded-lg border border-border p-1"
    >
      {MAP_METRICS.map((m) => (
        <Button
          key={m.value}
          role="radio"
          aria-checked={metric === m.value}
          variant={metric === m.value ? "secondary" : "ghost"}
          size="sm"
          onClick={() => setMetric(m.value)}
          className="h-7 px-2.5 text-xs"
        >
          {m.label}
        </Button>
      ))}
    </div>
  )

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* ================= Peta ================= */}
        <ChartCard
          className="lg:col-span-2"
          title="Sebaran indikator per zona"
          description={`Warna dan ukuran lingkaran mengikuti metrik ${meta.label}.`}
          icon={MapPin}
          accent="teal"
          action={metricSwitcher}
          height={520}
          bodyClassName="px-5 pb-5"
          footnote={
            <>
              Zoom dengan scroll dimatikan agar tidak mengganggu gulir halaman —
              gunakan tombol + / − atau klik dua kali. Memilih zona pada filter
              global akan menggeser peta ke zona tersebut. Peta hanya
              memposisikan empat zona simulasi; batas wilayah sebenarnya tidak
              digambarkan.
            </>
          }
        >
          <div className="h-full w-full overflow-hidden rounded-lg border border-border">
            <ZoneMap
              zones={view.zonesGeo}
              metric={metric}
              selectedZone={zone}
            />
          </div>
        </ChartCard>

        {/* ================= Panel samping ================= */}
        <div className="space-y-4">
          <Card>
            <div className="flex items-start gap-3 p-5 pb-3">
              <span
                aria-hidden
                className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-teal/12 text-teal"
              >
                <Layers className="size-4" />
              </span>
              <div>
                <h3 className="text-sm font-semibold leading-tight">
                  Peringkat zona
                </h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  Diurutkan menurut {meta.label.toLowerCase()} (
                  {meta.higherIsWorse
                    ? "paling tinggi lebih dulu"
                    : "paling rendah lebih dulu"}
                  ).
                </p>
              </div>
            </div>

            <ul className="space-y-1 px-3 pb-3">
              {orderedZones.map((z) => {
                const isActive = zone === z.zone
                return (
                  <li key={z.zone}>
                    <button
                      type="button"
                      onClick={() => setZone(isActive ? "all" : z.zone)}
                      aria-pressed={isActive}
                      className={cn(
                        "flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left transition-colors",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        isActive
                          ? "bg-accent text-accent-foreground"
                          : "hover:bg-accent/60",
                      )}
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium">
                          {z.name}
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          {z.zone}
                        </span>
                      </span>
                      <span className="shrink-0 text-right">
                        <span className="tabular block text-sm font-semibold">
                          {formatValue(valueOf(z))}
                        </span>
                        <span className="block text-[11px] text-muted-foreground">
                          {meta.unit}
                        </span>
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>

            <p className="border-t border-border px-5 py-3 text-[11px] text-muted-foreground">
              Klik satu zona untuk menerapkannya sebagai filter global; klik
              lagi untuk kembali ke semua zona.
            </p>
          </Card>

          {/* ---- Legenda warna ---- */}
          <Card>
            <div className="p-5 pb-3">
              <h3 className="text-sm font-semibold leading-tight">
                Arti warna
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">
                {metric === "pm25"
                  ? "Mengikuti ambang kategori PM2.5 resmi."
                  : `Relatif antar zona: hijau = kondisi terbaik, merah = ${
                      meta.higherIsWorse ? "nilai tertinggi" : "nilai terendah"
                    }.`}
              </p>
            </div>

            <ul className="space-y-2 px-5 pb-5 text-xs">
              {metric === "pm25"
                ? PM25_CATEGORIES.map((cat, i) => {
                    const bounds = [
                      `≤ ${PM25_THRESHOLDS.baik}`,
                      `${PM25_THRESHOLDS.baik + 1}–${PM25_THRESHOLDS.sedang}`,
                      `${PM25_THRESHOLDS.sedang + 1}–${PM25_THRESHOLDS.tidakSehat}`,
                      `> ${PM25_THRESHOLDS.tidakSehat}`,
                    ]
                    return (
                      <li key={cat} className="flex items-center gap-2">
                        <span
                          aria-hidden
                          className="size-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: pm25CategoryColor(cat, c) }}
                        />
                        <span className="flex-1">{cat}</span>
                        <span className="tabular text-muted-foreground">
                          {bounds[i]} µg/m³
                        </span>
                      </li>
                    )
                  })
                : (
                    [
                      { label: "Kondisi terbaik", color: c.good },
                      { label: "Menengah", color: c.warn },
                      { label: "Perlu perhatian", color: c.bad },
                    ] as const
                  ).map((row) => (
                    <li key={row.label} className="flex items-center gap-2">
                      <span
                        aria-hidden
                        className="size-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: row.color }}
                      />
                      <span>{row.label}</span>
                    </li>
                  ))}
            </ul>
          </Card>
        </div>
      </div>

      {/* ================= Ringkasan zona (kartu kecil) ================= */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {view.zonesGeo.map((z) => {
          const status = zoneStatus(z.pm25)
          return (
            <Card key={z.zone} className="p-5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{z.name}</p>
                  <p className="text-xs text-muted-foreground">{z.zone}</p>
                </div>
                <Badge className={ZONE_STATUS_CLASS[status]}>{status}</Badge>
              </div>
              <dl className="mt-4 space-y-1.5 text-xs">
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">PM2.5</dt>
                  <dd className="tabular font-medium">
                    {formatDecimal(z.pm25)} µg/m³
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Kecepatan</dt>
                  <dd className="tabular font-medium">
                    {formatDecimal(z.speed)} km/j
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Kecelakaan</dt>
                  <dd className="tabular font-medium">{formatInt(z.acc)}</dd>
                </div>
              </dl>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
