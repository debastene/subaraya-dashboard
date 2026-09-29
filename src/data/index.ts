import type { DashboardData } from "@/types"
import raw from "./dashboard.json"

/**
 * Satu-satunya tempat data dashboard dimuat.
 *
 * Ganti isi `dashboard.json` dengan hasil `python scripts/aggregate.py`
 * untuk memakai data asli — tidak ada kode lain yang perlu diubah.
 */
export const dashboardData = raw as unknown as DashboardData

/** Daftar zona untuk komponen filter (diambil dari data, bukan di-hardcode). */
export const zoneOptions = dashboardData.per_zone.map((z) => ({
  value: z.zone,
  label: `${z.zone} · ${z.name}`,
  name: z.name,
}))

/** Label periode data, mis. "Dec 2021 – Sep 2025". */
export const dataPeriod = {
  start: dashboardData.kpi.date_start,
  end: dashboardData.kpi.date_end,
}
