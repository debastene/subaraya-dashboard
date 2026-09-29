/**
 * Kontrak data dashboard Subaraya.
 *
 * File `src/data/dashboard.json` HARUS mengikuti bentuk `DashboardData` di bawah.
 * Skrip `scripts/aggregate.py` menghasilkan file itu dari CSV asli
 * (mart_hourly.csv + dim_zone.csv).
 *
 * Catatan penting: ketiga domain (lalu lintas, polusi udara, kecelakaan)
 * berasal dari sumber data yang BERBEDA. Semua tipe di sini sengaja dipisah
 * per domain — jangan membuat struktur yang menyiratkan hubungan sebab-akibat
 * antar domain.
 */

/** Kode zona, mis. "Z01". Dibiarkan string agar mudah menambah zona baru. */
export type ZoneCode = string

/** Tingkat kepadatan lalu lintas per jam. */
export type CongestionLevel = "LOW" | "MEDIUM" | "HIGH"

/** Kategori kualitas udara berdasarkan PM2.5 (µg/m³). */
export type Pm25Category =
  | "Baik"
  | "Sedang"
  | "Tidak Sehat"
  | "Sangat Tidak Sehat"

/** Ringkasan angka utama untuk seluruh kota & seluruh periode. */
export interface Kpi {
  /** Kecepatan rata-rata kendaraan (km/jam). */
  avg_speed: number
  /** Konsentrasi PM2.5 rata-rata (µg/m³). */
  avg_pm25: number
  /** Total kecelakaan tercatat (kumulatif seluruh periode). */
  total_accidents: number
  /** Total korban tercatat (kumulatif seluruh periode). */
  total_casualties: number
  /** Persentase jam dengan kepadatan HIGH. */
  pct_high: number
  /** Label awal periode data, mis. "Dec 2021". */
  date_start: string
  /** Label akhir periode data, mis. "Sep 2025". */
  date_end: string
}

/** Jumlah jam pengamatan per tingkat kepadatan. */
export interface CongestionCounts {
  LOW: number
  MEDIUM: number
  HIGH: number
}

/** Jumlah jam pengamatan per kategori PM2.5. */
export type Pm25CategoryCounts = Record<Pm25Category, number>

/** Ringkasan indikator per zona (seluruh periode). */
export interface ZoneStat {
  zone: ZoneCode
  name: string
  /** Kecepatan rata-rata (km/jam). */
  speed: number
  /** Volume kendaraan rata-rata per jam. */
  vol: number
  /** PM2.5 rata-rata (µg/m³). */
  pm25: number
  /** Total kecelakaan (kumulatif). */
  acc: number
  /** Total korban (kumulatif). */
  cas: number
}

/** Deret waktu bulanan. `labels` & `values` selalu sama panjang. */
export interface MonthlySeries {
  /** Label bulan format "YYYY-MM". */
  labels: string[]
  values: number[]
}

/** Metadata geografis zona (dari dim_zone) + indikator ringkas untuk peta. */
export interface ZoneGeo {
  zone: ZoneCode
  name: string
  lat: number
  lng: number
  /** Kapasitas ruas jalan (kendaraan/jam). */
  cap: number
  /** Batas kecepatan (km/jam). */
  limit: number
  pm25: number
  speed: number
  acc: number
}

/**
 * Rincian per zona (OPSIONAL).
 *
 * Bagian ini bukan bagian dari skema inti, tapi kalau tersedia, filter zona
 * pada dashboard bisa memengaruhi chart per-jam, donut, dan tren bulanan.
 * Bila tidak ada, dashboard otomatis menampilkan angka se-kota dan memberi
 * catatan kecil bahwa chart tersebut adalah agregat seluruh kota.
 */
export interface ZoneBreakdown {
  congestion?: CongestionCounts
  pm25_cat?: Pm25CategoryCounts
  speed_by_hour?: number[]
  vol_by_hour?: number[]
  acc_by_hour?: number[]
  pm25_by_month?: MonthlySeries
  speed_by_month?: MonthlySeries
  acc_by_month?: MonthlySeries
  cas_by_month?: MonthlySeries
  high_share_by_month?: MonthlySeries
}

/** Informasi tambahan tentang proses agregasi (opsional, hanya untuk jejak). */
export interface DashboardMeta {
  generated_at?: string
  source?: string
  rows?: number
  note?: string
}

/** Bentuk lengkap `src/data/dashboard.json`. */
export interface DashboardData {
  // ---- Wajib (skema inti) -------------------------------------------------
  kpi: Kpi
  congestion: CongestionCounts
  per_zone: ZoneStat[]
  /** 24 angka, indeks 0..23 = jam 00..23. */
  speed_by_hour: number[]
  /** 24 angka, indeks 0..23 = jam 00..23. */
  acc_by_hour: number[]
  pm25_by_month: MonthlySeries
  pm25_cat: Pm25CategoryCounts
  zones: ZoneGeo[]

  // ---- Opsional (dipakai kalau ada, untuk filter & sparkline) --------------
  /** Volume kendaraan rata-rata per jam, 24 angka. */
  vol_by_hour?: number[]
  /** Tren bulanan tambahan — label-nya mengikuti `pm25_by_month.labels`. */
  speed_by_month?: MonthlySeries
  acc_by_month?: MonthlySeries
  cas_by_month?: MonthlySeries
  /** Persentase jam HIGH per bulan. */
  high_share_by_month?: MonthlySeries
  /** Rincian per zona, dikunci dengan kode zona ("Z01", "Z02", ...). */
  by_zone?: Record<ZoneCode, ZoneBreakdown>
  meta?: DashboardMeta
}

// ---------------------------------------------------------------------------
// Tipe untuk state filter global
// ---------------------------------------------------------------------------

/** Nilai filter zona: "all" = semua zona. */
export type ZoneFilterValue = "all" | ZoneCode

/** Pilihan rentang waktu. */
export type RangeKey = "6m" | "12m" | "24m" | "all"

/** Metrik yang bisa dipilih pada peta. */
export type MapMetric = "pm25" | "speed" | "acc"
