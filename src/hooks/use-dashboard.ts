import * as React from "react"

import { dashboardData } from "@/data"
import { buildView, type DashboardView } from "@/lib/metrics"
import { useFilters } from "@/store/filters"

/**
 * Data dashboard yang sudah disaring sesuai filter global.
 * Dihitung ulang hanya ketika filter berubah.
 */
export function useDashboardView(): DashboardView {
  const { zone, range } = useFilters()
  return React.useMemo(
    () => buildView(dashboardData, zone, range),
    [zone, range],
  )
}
