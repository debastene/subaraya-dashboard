import * as React from "react"
import { Download, Info, Table2 } from "lucide-react"

import { DataTable } from "@/components/DataTable"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { useDashboardView } from "@/hooks/use-dashboard"
import {
  PM25_THRESHOLDS,
  ZONE_STATUS_CLASS,
  type ZoneStatus,
} from "@/lib/colors"
import { formatInt } from "@/lib/format"
import { ACCIDENT_NOTE, SOURCE_NOTE } from "@/lib/notes"
import { useFilters } from "@/store/filters"

/** Penjelasan ambang tiap status agar pembaca tahu dasar penilaiannya. */
const STATUS_RULES: { status: ZoneStatus; rule: string }[] = [
  { status: "Aman", rule: `PM2.5 ≤ ${PM25_THRESHOLDS.sedang} µg/m³` },
  {
    status: "Waspada",
    rule: `${PM25_THRESHOLDS.sedang + 1}–${PM25_THRESHOLDS.tidakSehat} µg/m³`,
  },
  { status: "Bahaya", rule: `> ${PM25_THRESHOLDS.tidakSehat} µg/m³` },
]

export default function DataPage() {
  const view = useDashboardView()
  const { zone } = useFilters()

  /** Unduh isi tabel sebagai CSV (dipisah titik koma agar rapi di Excel Indonesia). */
  const downloadCsv = React.useCallback(() => {
    const header = [
      "zone",
      "nama_zona",
      "kecepatan_kmj",
      "volume_kend_per_jam",
      "pm25_ugm3",
      "kecelakaan_total",
      "korban_total",
    ]
    const lines = view.allZones.map((z) =>
      [z.zone, z.name, z.speed, z.vol, z.pm25, z.acc, z.cas].join(";"),
    )
    const csv = [header.join(";"), ...lines].join("\r\n")

    const blob = new Blob(["﻿" + csv], {
      type: "text/csv;charset=utf-8;",
    })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = "subaraya-ringkasan-zona.csv"
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }, [view.allZones])

  return (
    <div className="space-y-5">
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3 p-5 pb-0">
          <div className="flex min-w-0 items-start gap-3">
            <span
              aria-hidden
              className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground"
            >
              <Table2 className="size-4" />
            </span>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold leading-tight">
                Ringkasan indikator per zona
              </h3>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Seluruh periode data ({view.allZones.length} zona). Klik judul
                kolom untuk mengurutkan.
              </p>
            </div>
          </div>

          <Button variant="outline" size="sm" onClick={downloadCsv}>
            <Download className="size-4" aria-hidden />
            Unduh CSV
          </Button>
        </div>

        <div className="p-5">
          <DataTable
            rows={view.allZones}
            highlightZone={zone === "all" ? undefined : zone}
          />
        </div>
      </Card>

      {/* ================= Keterangan ================= */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <h3 className="text-sm font-semibold">Dasar penilaian status</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Status zona ditentukan dari konsentrasi PM2.5 rata-rata, memakai
            ambang kategori kualitas udara.
          </p>
          <ul className="mt-3 space-y-2">
            {STATUS_RULES.map((row) => (
              <li
                key={row.status}
                className="flex items-center justify-between gap-3 text-xs"
              >
                <Badge className={ZONE_STATUS_CLASS[row.status]}>
                  {row.status}
                </Badge>
                <span className="tabular text-muted-foreground">{row.rule}</span>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="p-5">
          <div className="flex items-start gap-2">
            <Info
              className="mt-0.5 size-4 shrink-0 text-muted-foreground"
              aria-hidden
            />
            <div className="space-y-2 text-xs leading-relaxed text-muted-foreground">
              <p>{SOURCE_NOTE}</p>
              <p>{ACCIDENT_NOTE}</p>
              <p>
                Kolom kecepatan dan volume adalah rata-rata per jam pengamatan
                ({formatInt(view.totalHours)} jam untuk cakupan yang sedang
                aktif); nilai kosong pada data sumber diabaikan saat menghitung
                rata-rata.
              </p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}
