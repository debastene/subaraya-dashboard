import * as React from "react"

import type { RangeKey, ZoneFilterValue } from "@/types"

/**
 * State filter global (zona + rentang waktu).
 * Dipakai bersama oleh top bar dan semua halaman.
 */

interface FiltersContextValue {
  zone: ZoneFilterValue
  range: RangeKey
  setZone: (zone: ZoneFilterValue) => void
  setRange: (range: RangeKey) => void
  resetFilters: () => void
  /** true bila ada filter yang tidak default. */
  isFiltered: boolean
}

const FiltersContext = React.createContext<FiltersContextValue | null>(null)

const STORAGE_KEY = "subaraya-filters"

const DEFAULT_ZONE: ZoneFilterValue = "all"
const DEFAULT_RANGE: RangeKey = "all"

/** Pilihan rentang waktu yang tampil di top bar. */
export const RANGE_OPTIONS: { value: RangeKey; label: string; months: number | null }[] =
  [
    { value: "6m", label: "6 bulan terakhir", months: 6 },
    { value: "12m", label: "12 bulan terakhir", months: 12 },
    { value: "24m", label: "24 bulan terakhir", months: 24 },
    { value: "all", label: "Seluruh periode", months: null },
  ]

/** Jumlah bulan untuk sebuah rentang (null = semua bulan yang tersedia). */
export function rangeMonths(range: RangeKey): number | null {
  return RANGE_OPTIONS.find((r) => r.value === range)?.months ?? null
}

export function rangeLabel(range: RangeKey): string {
  return RANGE_OPTIONS.find((r) => r.value === range)?.label ?? "Seluruh periode"
}

function readStored(): { zone: ZoneFilterValue; range: RangeKey } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { zone: DEFAULT_ZONE, range: DEFAULT_RANGE }
    const parsed = JSON.parse(raw) as Partial<{
      zone: ZoneFilterValue
      range: RangeKey
    }>
    return {
      zone: parsed.zone ?? DEFAULT_ZONE,
      range: parsed.range ?? DEFAULT_RANGE,
    }
  } catch {
    return { zone: DEFAULT_ZONE, range: DEFAULT_RANGE }
  }
}

export function FiltersProvider({ children }: { children: React.ReactNode }) {
  const initial = React.useRef(readStored())
  const [zone, setZoneState] = React.useState<ZoneFilterValue>(initial.current.zone)
  const [range, setRangeState] = React.useState<RangeKey>(initial.current.range)

  // Simpan pilihan supaya tidak hilang saat halaman di-refresh.
  React.useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ zone, range }))
    } catch {
      /* abaikan bila storage tidak tersedia */
    }
  }, [zone, range])

  const value = React.useMemo<FiltersContextValue>(
    () => ({
      zone,
      range,
      setZone: setZoneState,
      setRange: setRangeState,
      resetFilters: () => {
        setZoneState(DEFAULT_ZONE)
        setRangeState(DEFAULT_RANGE)
      },
      isFiltered: zone !== DEFAULT_ZONE || range !== DEFAULT_RANGE,
    }),
    [zone, range],
  )

  return (
    <FiltersContext.Provider value={value}>{children}</FiltersContext.Provider>
  )
}

export function useFilters() {
  const ctx = React.useContext(FiltersContext)
  if (!ctx) throw new Error("useFilters harus dipakai di dalam <FiltersProvider>")
  return ctx
}
