import type { CongestionLevel, Pm25Category } from "@/types"

/**
 * Palet warna untuk chart (Recharts) & peta (Leaflet).
 *
 * Nilai di sini HARUS sama dengan CSS variable di `src/index.css`.
 * Alasan diduplikasi: SVG di dalam Recharts/Leaflet lebih aman menerima nilai
 * hex langsung daripada `var(--x)` (terutama saat nilai dipakai untuk
 * menghitung gradien atau opacity).
 */
export interface Palette {
  teal: string
  coral: string
  indigo: string
  good: string
  warn: string
  bad: string
  critical: string
  /** Garis grid & sumbu chart. */
  grid: string
  axis: string
  surface: string
}

export const PALETTE: { light: Palette; dark: Palette } = {
  light: {
    teal: "#10b981",
    coral: "#f97316",
    indigo: "#3b5bdb",
    good: "#2f9e44",
    warn: "#f08c00",
    bad: "#e03131",
    critical: "#9c36b5",
    /** Garis grid & sumbu chart. */
    grid: "#e4e4e7",
    axis: "#52525b",
    surface: "#ffffff",
  },
  dark: {
    teal: "#34d399",
    coral: "#fb923c",
    indigo: "#7c93f5",
    good: "#51cf66",
    warn: "#ffc078",
    bad: "#ff6b6b",
    critical: "#da77f2",
    grid: "#2a2a30",
    axis: "#a1a1aa",
    surface: "#1c1c20",
  },
}

/** Warna aksen per pilar analitik (dipakai untuk judul section & ikon). */
export const PILLAR = {
  macet: { key: "indigo", cssVar: "var(--pilar-macet)" },
  udara: { key: "teal", cssVar: "var(--pilar-udara)" },
  aman: { key: "coral", cssVar: "var(--pilar-aman)" },
} as const

export type PillarKey = keyof typeof PILLAR

// ---------------------------------------------------------------------------
// PM2.5
// ---------------------------------------------------------------------------

/**
 * Ambang kategori PM2.5 (µg/m³):
 *   Baik ≤ 15 · Sedang ≤ 55 · Tidak Sehat ≤ 150 · di atasnya Sangat Tidak Sehat
 */
export const PM25_THRESHOLDS = {
  baik: 15,
  sedang: 55,
  tidakSehat: 150,
} as const

export const PM25_CATEGORIES: Pm25Category[] = [
  "Baik",
  "Sedang",
  "Tidak Sehat",
  "Sangat Tidak Sehat",
]

/** Tentukan kategori dari nilai PM2.5. */
export function pm25Category(value: number): Pm25Category {
  if (value <= PM25_THRESHOLDS.baik) return "Baik"
  if (value <= PM25_THRESHOLDS.sedang) return "Sedang"
  if (value <= PM25_THRESHOLDS.tidakSehat) return "Tidak Sehat"
  return "Sangat Tidak Sehat"
}

/** Warna berdasarkan kategori PM2.5. */
export function pm25CategoryColor(cat: Pm25Category, p: Palette): string {
  switch (cat) {
    case "Baik":
      return p.good
    case "Sedang":
      return p.warn
    case "Tidak Sehat":
      return p.bad
    case "Sangat Tidak Sehat":
      return p.critical
  }
}

/** Warna langsung dari nilai PM2.5. */
export function pm25Color(value: number, p: Palette): string {
  return pm25CategoryColor(pm25Category(value), p)
}

// ---------------------------------------------------------------------------
// Kepadatan lalu lintas
// ---------------------------------------------------------------------------

export const CONGESTION_LEVELS: CongestionLevel[] = ["LOW", "MEDIUM", "HIGH"]

/** Label bahasa Indonesia untuk tingkat kepadatan. */
export const CONGESTION_LABEL: Record<CongestionLevel, string> = {
  LOW: "Lancar",
  MEDIUM: "Padat",
  HIGH: "Macet",
}

export function congestionColor(level: CongestionLevel, p: Palette): string {
  switch (level) {
    case "LOW":
      return p.good
    case "MEDIUM":
      return p.warn
    case "HIGH":
      return p.bad
  }
}

// ---------------------------------------------------------------------------
// Status zona (badge pada tabel Data)
// ---------------------------------------------------------------------------

export type ZoneStatus = "Aman" | "Waspada" | "Bahaya"

/**
 * Status zona ditentukan dari PM2.5 rata-rata, memakai ambang resmi kategori:
 *   Aman    : ≤ 55   (kategori Baik / Sedang)
 *   Waspada : ≤ 150  (kategori Tidak Sehat)
 *   Bahaya  : > 150  (kategori Sangat Tidak Sehat)
 *
 * Ubah angka di `PM25_THRESHOLDS` bila ingin memakai ambang lain.
 */
export function zoneStatus(pm25: number): ZoneStatus {
  if (pm25 <= PM25_THRESHOLDS.sedang) return "Aman"
  if (pm25 <= PM25_THRESHOLDS.tidakSehat) return "Waspada"
  return "Bahaya"
}

/** Kelas Tailwind untuk badge status (kontras cukup di light & dark). */
export const ZONE_STATUS_CLASS: Record<ZoneStatus, string> = {
  Aman: "border-transparent bg-cond-good/15 text-cond-good",
  Waspada: "border-transparent bg-cond-warn/15 text-cond-warn",
  Bahaya: "border-transparent bg-cond-bad/15 text-cond-bad",
}

/** Kelas Tailwind untuk badge kategori PM2.5. */
export const PM25_CATEGORY_CLASS: Record<Pm25Category, string> = {
  Baik: "border-transparent bg-cond-good/15 text-cond-good",
  Sedang: "border-transparent bg-cond-warn/15 text-cond-warn",
  "Tidak Sehat": "border-transparent bg-cond-bad/15 text-cond-bad",
  "Sangat Tidak Sehat":
    "border-transparent bg-cond-critical/15 text-cond-critical",
}

// ---------------------------------------------------------------------------
// Utilitas kecil
// ---------------------------------------------------------------------------

/** Deret warna standar untuk chart multi-seri. */
export function chartSeries(p: Palette): string[] {
  return [p.teal, p.coral, p.indigo, p.warn, p.critical]
}

/** Warna tetap per zona, supaya satu zona selalu punya warna sama di semua chart. */
export function zoneColor(zone: string, p: Palette): string {
  const order = ["Z01", "Z02", "Z03", "Z04"]
  const idx = order.indexOf(zone)
  const series = chartSeries(p)
  return series[(idx < 0 ? 0 : idx) % series.length]
}
