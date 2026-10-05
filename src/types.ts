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

// ---------------------------------------------------------------------------
// Prediksi model machine learning (src/data/predictions.json)
// ---------------------------------------------------------------------------

/** Ketiga keluaran model dari data scientist. */
export type PredictionMetric = "expected" | "occurrence" | "severe"

/**
 * Hasil pemeriksaan otomatis terhadap model, dihitung oleh scripts/predict.py.
 *
 * Dipakai halaman Prediksi untuk menampilkan catatan keterbatasan secara
 * jujur. Karena nilainya berasal dari model, catatan itu hilang dengan
 * sendirinya begitu modelnya diperbaiki — tidak ada peringatan yang
 * ditulis permanen di dalam kode React.
 */
export interface PredictionDiagnostics {
  /** true bila kurva 24 jam hanya naik atau hanya turun (tidak ada puncak jam sibuk). */
  hour_monotonic?: boolean
  /** Jam dengan prediksi tertinggi / terendah. */
  hour_peak?: number
  hour_low?: number
  /** Selisih antar zona pada jam yang sama, dalam persen dari rata-rata. */
  zone_spread_pct?: number
  /** Korelasi antara model peluang dan 1 − e^(−λ) dari model jumlah. */
  consistency_corr?: number
  consistency_mae?: number
  /** true bila banyak probabilitas menempel di 1,00 (ciri model kelewat hafal). */
  occurrence_saturated?: boolean
}

/** Nilai metrik untuk satu model pada satu bagian data. */
export interface PredictionScores {
  mae?: number
  rmse?: number
  accuracy?: number
  roc_auc?: number | null
  pr_auc?: number
  log_loss?: number
  brier?: number
  base_rate?: number | null
}

export interface PredictionModelEvaluation {
  /** Estimator yang metriknya diukur. */
  evaluated_estimator?: string
  /** Estimator yang benar-benar menghasilkan angka di halaman ini. */
  used_estimator?: string
  test?: PredictionScores
  dummy_test?: PredictionScores
}

/**
 * Angka evaluasi model, dibaca dari `models/metrics.json` oleh
 * scripts/predict.py.
 *
 * `estimator_mismatch` berisi metrik yang diukur pada estimator BERBEDA
 * dari yang dipakai untuk membuat prediksi — misalnya ketika berkas .joblib
 * berasal dari percobaan lain. Dalam kasus itu angkanya tidak boleh dibaca
 * sebagai mutu model yang sedang tampil.
 */
export interface PredictionEvaluation {
  available: boolean
  reason?: string
  source?: string
  generated_at?: string | null
  cyclic_hour?: boolean
  split?: Partial<
    Record<"train" | "val" | "test", { rows: number; start: string; end: string }>
  >
  models?: Partial<Record<PredictionMetric, PredictionModelEvaluation>>
  estimator_mismatch?: PredictionMetric[]
}

export interface PredictionMeta {
  /** Kapan berkas ini dihasilkan (ISO, UTC). */
  generated_at: string
  /** Timestamp untuk indeks ke-0 pada setiap deret. */
  start: string
  /** Panjang setiap deret; satu langkah = satu jam. */
  hours: number
  zones: ZoneCode[]
  /** Nama estimator per metrik, mis. { expected: "PoissonRegressor" }. */
  models: Partial<Record<PredictionMetric, string>>
  feature_engineer?: string
  diagnostics?: PredictionDiagnostics
  evaluation?: PredictionEvaluation
}

/** Bentuk lengkap `src/data/predictions.json`. */
export interface PredictionData {
  meta: PredictionMeta
  /** series[zona][metrik][i] = prediksi untuk jam ke-i sejak `meta.start`. */
  series: Record<ZoneCode, Partial<Record<PredictionMetric, number[]>>>
}
