import * as React from "react"
import { CircleMarker, MapContainer, Popup, TileLayer, useMap } from "react-leaflet"

import { Badge } from "@/components/ui/badge"
import { useChartColors } from "@/hooks/use-chart-colors"
import {
  PM25_CATEGORY_CLASS,
  ZONE_STATUS_CLASS,
  pm25Category,
  pm25Color,
  zoneStatus,
  type Palette,
} from "@/lib/colors"
import { formatDecimal, formatInt } from "@/lib/format"
import { clamp } from "@/lib/utils"
import type { MapMetric, ZoneFilterValue, ZoneGeo } from "@/types"

/** Titik tengah peta: Surabaya. */
export const MAP_CENTER: [number, number] = [-7.245, 112.745]
export const MAP_ZOOM = 13

/** Keterangan tiap metrik yang bisa dipilih. */
export const MAP_METRICS: {
  value: MapMetric
  label: string
  unit: string
  /** true bila nilai besar = kondisi buruk. */
  higherIsWorse: boolean
}[] = [
  { value: "pm25", label: "PM2.5", unit: "µg/m³", higherIsWorse: true },
  { value: "speed", label: "Kecepatan", unit: "km/j", higherIsWorse: false },
  { value: "acc", label: "Kecelakaan", unit: "kejadian", higherIsWorse: true },
]

function metricValue(zone: ZoneGeo, metric: MapMetric): number {
  return metric === "pm25" ? zone.pm25 : metric === "speed" ? zone.speed : zone.acc
}

/**
 * Warna marker.
 * PM2.5 memakai ambang kategori resmi; dua metrik lain diwarnai relatif
 * terhadap zona lain (tersier: baik / sedang / buruk).
 */
function metricColor(
  zone: ZoneGeo,
  metric: MapMetric,
  zones: ZoneGeo[],
  p: Palette,
): string {
  if (metric === "pm25") return pm25Color(zone.pm25, p)

  const values = zones.map((z) => metricValue(z, metric))
  const min = Math.min(...values)
  const max = Math.max(...values)
  const value = metricValue(zone, metric)
  const ratio = max === min ? 0.5 : (value - min) / (max - min)
  // Untuk kecepatan, nilai tinggi = baik, jadi skalanya dibalik.
  const badness = metric === "speed" ? 1 - ratio : ratio

  if (badness < 0.34) return p.good
  if (badness < 0.67) return p.warn
  return p.bad
}

/** Ukuran lingkaran mengikuti besar nilai metrik (relatif antar zona). */
function metricRadius(
  zone: ZoneGeo,
  metric: MapMetric,
  zones: ZoneGeo[],
): number {
  const values = zones.map((z) => metricValue(z, metric))
  const min = Math.min(...values)
  const max = Math.max(...values)
  const value = metricValue(zone, metric)
  const ratio = max === min ? 0.5 : (value - min) / (max - min)
  return clamp(14 + ratio * 18, 14, 32)
}

/** Menggeser peta ke zona yang sedang dipilih pada filter global. */
function FocusZone({
  zones,
  selected,
}: {
  zones: ZoneGeo[]
  selected: ZoneFilterValue
}) {
  const map = useMap()

  React.useEffect(() => {
    if (selected === "all") {
      map.setView(MAP_CENTER, MAP_ZOOM, { animate: true })
      return
    }
    const zone = zones.find((z) => z.zone === selected)
    if (zone) {
      map.setView([zone.lat, zone.lng], MAP_ZOOM + 1, { animate: true })
    }
  }, [map, selected, zones])

  return null
}

interface ZoneMapProps {
  zones: ZoneGeo[]
  metric: MapMetric
  /** Zona yang sedang aktif pada filter global. */
  selectedZone: ZoneFilterValue
  className?: string
}

export function ZoneMap({
  zones,
  metric,
  selectedZone,
  className,
}: ZoneMapProps) {
  const c = useChartColors()
  const meta = MAP_METRICS.find((m) => m.value === metric) ?? MAP_METRICS[0]

  return (
    <MapContainer
      center={MAP_CENTER}
      zoom={MAP_ZOOM}
      // Zoom dengan scroll dimatikan supaya tidak mengganggu scroll halaman —
      // gunakan tombol +/- atau klik dua kali.
      scrollWheelZoom={false}
      className={className}
      style={{ height: "100%", width: "100%" }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        maxZoom={19}
      />

      <FocusZone zones={zones} selected={selectedZone} />

      {zones.map((zone) => {
        const color = metricColor(zone, metric, zones, c)
        const isDimmed = selectedZone !== "all" && selectedZone !== zone.zone
        const status = zoneStatus(zone.pm25)
        const kategori = pm25Category(zone.pm25)

        return (
          <CircleMarker
            key={zone.zone}
            center={[zone.lat, zone.lng]}
            radius={metricRadius(zone, metric, zones)}
            pathOptions={{
              color,
              weight: 2,
              opacity: isDimmed ? 0.35 : 1,
              fillColor: color,
              fillOpacity: isDimmed ? 0.1 : 0.32,
            }}
          >
            <Popup>
              <div className="min-w-[13rem] space-y-2">
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    {zone.name}
                  </p>
                  <p className="text-xs text-muted-foreground">{zone.zone}</p>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  <Badge className={ZONE_STATUS_CLASS[status]}>{status}</Badge>
                  <Badge className={PM25_CATEGORY_CLASS[kategori]}>
                    {kategori}
                  </Badge>
                </div>

                <dl className="space-y-1 text-xs">
                  <div className="flex items-center justify-between gap-4">
                    <dt className="text-muted-foreground">PM2.5</dt>
                    <dd className="tabular font-medium">
                      {formatDecimal(zone.pm25)} µg/m³
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <dt className="text-muted-foreground">Kecepatan</dt>
                    <dd className="tabular font-medium">
                      {formatDecimal(zone.speed)} km/j
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <dt className="text-muted-foreground">Kecelakaan</dt>
                    <dd className="tabular font-medium">
                      {formatInt(zone.acc)}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <dt className="text-muted-foreground">Kapasitas ruas</dt>
                    <dd className="tabular font-medium">
                      {formatInt(zone.cap)} kend./jam
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <dt className="text-muted-foreground">Batas kecepatan</dt>
                    <dd className="tabular font-medium">
                      {formatInt(zone.limit)} km/j
                    </dd>
                  </div>
                </dl>

                <p className="border-t border-border pt-1.5 text-[11px] text-muted-foreground">
                  Ukuran lingkaran mengikuti metrik{" "}
                  <span className="font-medium text-foreground">
                    {meta.label}
                  </span>
                  .
                </p>
              </div>
            </Popup>
          </CircleMarker>
        )
      })}
    </MapContainer>
  )
}
