import rawPredictions from "@/data/predictions.json"
import type {
  PredictionData,
  PredictionMetric,
  ZoneCode,
  ZoneFilterValue,
} from "@/types"

/**
 * Lapisan baca untuk hasil prediksi model.
 *
 * `predictions.json` dihasilkan oleh `scripts/predict.py`: model dijalankan
 * sekali di komputer, seluruh jawabannya disimpan sebagai tabel. Dashboard
 * hanya membaca tabel itu — tidak ada model yang berjalan di browser.
 */
export const predictionData = rawPredictions as unknown as PredictionData

/** Waktu untuk indeks ke-0 pada setiap deret. */
const START = new Date(predictionData.meta.start)
const HOURS = predictionData.meta.hours
const HOUR_MS = 3_600_000

export interface ForecastPoint {
  /** Indeks pada deret aslinya. */
  i: number
  ts: Date
  /** "14.00" */
  hourLabel: string
  /** "Sen 14.00" */
  shortLabel: string
  expected: number | null
  occurrence: number | null
  severe: number | null
}

const NAMA_HARI = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"]

function pad(n: number) {
  return String(n).padStart(2, "0")
}

/** Indeks jam untuk sebuah waktu; null bila di luar rentang yang dihitung. */
export function indexForDate(date: Date): number | null {
  const diff = Math.floor((date.getTime() - START.getTime()) / HOUR_MS)
  return diff < 0 || diff >= HOURS ? null : diff
}

/** Timestamp untuk sebuah indeks. */
export function dateForIndex(i: number): Date {
  return new Date(START.getTime() + i * HOUR_MS)
}

/**
 * Ambil satu nilai metrik untuk sebuah zona.
 * Untuk "all": jumlah kalau metriknya berupa hitungan, rata-rata kalau peluang.
 *
 * Penjumlahan peluang antar zona TIDAK dilakukan — menjumlahkan probabilitas
 * tidak punya arti. Yang dipakai rata-rata antar zona, dan labelnya di UI
 * menyebutkan itu.
 */
function valueAt(
  zone: ZoneFilterValue,
  metric: PredictionMetric,
  i: number,
): number | null {
  const zones =
    zone === "all" ? predictionData.meta.zones : ([zone] as ZoneCode[])

  let total = 0
  let found = 0
  for (const z of zones) {
    const series = predictionData.series[z]?.[metric]
    const v = series?.[i]
    if (typeof v === "number" && Number.isFinite(v)) {
      total += v
      found++
    }
  }
  if (found === 0) return null
  // "expected" adalah jumlah kejadian, jadi antar zona dijumlahkan.
  return metric === "expected" ? total : total / found
}

/** Deret prediksi sepanjang `count` jam mulai dari indeks `from`. */
export function forecastSlice(
  zone: ZoneFilterValue,
  from: number,
  count: number,
): ForecastPoint[] {
  const out: ForecastPoint[] = []
  const end = Math.min(from + count, HOURS)
  for (let i = Math.max(0, from); i < end; i++) {
    const ts = dateForIndex(i)
    out.push({
      i,
      ts,
      hourLabel: `${pad(ts.getHours())}.00`,
      shortLabel: `${NAMA_HARI[ts.getDay()]} ${pad(ts.getHours())}.00`,
      expected: valueAt(zone, "expected", i),
      occurrence: valueAt(zone, "occurrence", i),
      severe: valueAt(zone, "severe", i),
    })
  }
  return out
}

/**
 * Indeks tengah malam pertama pada atau sesudah `from`.
 * Dipakai agar ringkasan harian benar-benar sejajar dengan tanggal kalender,
 * bukan jendela 24 jam berjalan yang labelnya bisa menyesatkan.
 */
export function nextMidnightIndex(from: number): number {
  for (let i = Math.max(0, from); i < Math.min(from + 24, HOURS); i++) {
    if (dateForIndex(i).getHours() === 0) return i
  }
  return Math.max(0, from)
}

export interface DailyPoint {
  /** Tanggal awal hari. */
  date: Date
  label: string
  /** Total perkiraan kecelakaan sepanjang hari itu. */
  expectedTotal: number
  /** Rata-rata peluang sepanjang hari itu. */
  occurrenceAvg: number | null
  severeAvg: number | null
  isWeekend: boolean
}

/** Ringkasan harian untuk `days` hari ke depan sejak indeks `from`. */
export function forecastDaily(
  zone: ZoneFilterValue,
  from: number,
  days: number,
): DailyPoint[] {
  const out: DailyPoint[] = []
  for (let d = 0; d < days; d++) {
    const slice = forecastSlice(zone, from + d * 24, 24)
    if (slice.length === 0) break

    const expected = slice
      .map((p) => p.expected)
      .filter((v): v is number => v != null)
    const occurrence = slice
      .map((p) => p.occurrence)
      .filter((v): v is number => v != null)
    const severe = slice
      .map((p) => p.severe)
      .filter((v): v is number => v != null)

    const date = slice[0].ts
    const dow = date.getDay()
    out.push({
      date,
      label: `${NAMA_HARI[dow]} ${date.getDate()}/${date.getMonth() + 1}`,
      expectedTotal: expected.reduce((a, b) => a + b, 0),
      occurrenceAvg: occurrence.length
        ? occurrence.reduce((a, b) => a + b, 0) / occurrence.length
        : null,
      severeAvg: severe.length
        ? severe.reduce((a, b) => a + b, 0) / severe.length
        : null,
      isWeekend: dow === 0 || dow === 6,
    })
  }
  return out
}

export interface ZoneForecast {
  zone: ZoneCode
  expected: number | null
  occurrence: number | null
  severe: number | null
}

/** Nilai per zona pada satu jam tertentu — untuk chart perbandingan zona. */
export function forecastByZone(i: number): ZoneForecast[] {
  return predictionData.meta.zones.map((zone) => ({
    zone,
    expected: valueAt(zone, "expected", i),
    occurrence: valueAt(zone, "occurrence", i),
    severe: valueAt(zone, "severe", i),
  }))
}

export interface ForecastAnchor {
  /** Indeks jam yang dipakai sebagai "sekarang". */
  index: number
  /** Waktu yang diwakili indeks itu. */
  ts: Date
  /**
   * true bila waktu nyata ada di luar rentang yang dihitung, sehingga
   * halaman memakai awal rentang sebagai gantinya. UI wajib memberi tahu.
   */
  outOfRange: boolean
  /** Awal & akhir rentang yang tersedia. */
  coverageStart: Date
  coverageEnd: Date
}

/**
 * Tentukan titik acuan "sekarang".
 * Kalau waktu sekarang berada di luar rentang yang dihitung (karena
 * predictions.json belum diperbarui), kembali ke awal rentang dan tandai.
 */
export function resolveAnchor(now: Date = new Date()): ForecastAnchor {
  const idx = indexForDate(now)
  return {
    index: idx ?? 0,
    ts: idx == null ? START : dateForIndex(idx),
    outOfRange: idx == null,
    coverageStart: START,
    coverageEnd: dateForIndex(HOURS - 1),
  }
}
