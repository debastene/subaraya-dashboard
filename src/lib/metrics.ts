import type {
  CongestionCounts,
  DashboardData,
  MonthlySeries,
  Pm25CategoryCounts,
  RangeKey,
  ZoneBreakdown,
  ZoneFilterValue,
  ZoneGeo,
  ZoneStat,
} from "@/types"
import { rangeLabel, rangeMonths } from "@/store/filters"
import { formatMonth } from "@/lib/format"
import { mean, sum } from "@/lib/utils"

/**
 * Lapisan "seleksi data": mengubah isi dashboard.json + filter global
 * menjadi angka siap pakai untuk semua halaman.
 *
 * Prinsip yang dipegang di sini:
 *  - Tiga domain (lalu lintas, udara, kecelakaan) dihitung TERPISAH.
 *    Tidak ada perhitungan yang mencampur satu domain ke domain lain.
 *  - Kalau rincian per zona tidak tersedia di JSON, angka se-kota dipakai
 *    dan ditandai lewat `flags` supaya UI bisa memberi catatan jujur.
 */

export interface MonthPoint {
  /** Label mentah "YYYY-MM". */
  month: string
  /** Label siap tampil, mis. "Jan 2022". */
  label: string
  value: number
}

export interface KpiBlock {
  /** Nilai utama untuk filter yang sedang aktif. */
  value: number | null
  /** Perubahan (%) bulan terakhir dibanding bulan sebelumnya; null bila tak terhitung. */
  delta: number | null
  /** Deret untuk mini sparkline. */
  spark: number[]
}

export interface ViewFlags {
  zoneFiltered: boolean
  rangeFiltered: boolean
  /** Rincian per zona tersedia di JSON untuk zona yang dipilih. */
  zoneBreakdown: boolean
}

export interface DashboardView {
  zone: ZoneFilterValue
  range: RangeKey
  /** "Semua zona" atau "Pusat Kota". */
  zoneName: string
  rangeText: string
  /** Rentang bulan yang sedang ditampilkan, mis. "Okt 2024 – Sep 2025". */
  periodLabel: string
  months: string[]

  monthlyPm25: MonthPoint[]
  monthlySpeed: MonthPoint[]
  monthlyAcc: MonthPoint[]
  monthlyCas: MonthPoint[]
  monthlyHigh: MonthPoint[]

  kpi: {
    speed: KpiBlock
    pm25: KpiBlock
    pctHigh: KpiBlock
    acc: KpiBlock
    cas: KpiBlock
    vol: KpiBlock
  }

  congestion: CongestionCounts
  pm25Cat: Pm25CategoryCounts
  totalHours: number
  totalPm25Hours: number
  /**
   * Porsi jam HIGH yang dihitung LANGSUNG dari `congestion` di atas.
   * Berbeda dengan `kpi.pctHigh` yang ikut filter rentang waktu — nilai ini
   * dipakai untuk label di tengah donat agar cocok dengan potongannya.
   */
  congestionHighShare: number

  speedByHour: number[]
  volByHour: number[] | null
  accByHour: number[]

  /** Zona sesuai filter (1 zona bila difilter, 4 bila "Semua"). */
  perZone: ZoneStat[]
  /** Selalu seluruh zona — untuk chart perbandingan antar zona. */
  allZones: ZoneStat[]
  zonesGeo: ZoneGeo[]

  flags: ViewFlags
}

// ---------------------------------------------------------------------------
// Helper internal
// ---------------------------------------------------------------------------

/** Ambil n data terakhir dari sebuah deret bulanan. */
function sliceSeries(
  series: MonthlySeries | undefined,
  months: number | null,
): MonthPoint[] {
  if (!series || !Array.isArray(series.values) || series.values.length === 0) {
    return []
  }
  const len = Math.min(series.labels.length, series.values.length)
  const start = months == null ? 0 : Math.max(0, len - months)
  const out: MonthPoint[] = []
  for (let i = start; i < len; i++) {
    out.push({
      month: series.labels[i],
      label: formatMonth(series.labels[i]),
      value: series.values[i],
    })
  }
  return out
}

/** Perubahan persen dari titik kedua-terakhir ke titik terakhir. */
function deltaOf(points: MonthPoint[]): number | null {
  if (points.length < 2) return null
  const last = points[points.length - 1].value
  const prev = points[points.length - 2].value
  if (!Number.isFinite(last) || !Number.isFinite(prev) || prev === 0) return null
  return ((last - prev) / Math.abs(prev)) * 100
}

function values(points: MonthPoint[]): number[] {
  return points.map((p) => p.value)
}

/** Ambil deret bulanan dari rincian zona bila ada, kalau tidak dari level kota. */
function pickSeries(
  breakdown: ZoneBreakdown | undefined,
  key: keyof ZoneBreakdown,
  cityFallback: MonthlySeries | undefined,
): MonthlySeries | undefined {
  const fromZone = breakdown?.[key] as MonthlySeries | undefined
  if (fromZone && Array.isArray(fromZone.values) && fromZone.values.length) {
    return fromZone
  }
  return cityFallback
}

// ---------------------------------------------------------------------------
// Fungsi utama
// ---------------------------------------------------------------------------

export function buildView(
  data: DashboardData,
  zone: ZoneFilterValue,
  range: RangeKey,
): DashboardView {
  const months = rangeMonths(range)
  const zoneFiltered = zone !== "all"
  const breakdown = zoneFiltered ? data.by_zone?.[zone] : undefined
  const zoneStat = zoneFiltered
    ? data.per_zone.find((z) => z.zone === zone)
    : undefined

  // --- Deret bulanan (mengikuti zona bila rinciannya tersedia) -------------
  const monthlyPm25 = sliceSeries(
    pickSeries(breakdown, "pm25_by_month", data.pm25_by_month),
    months,
  )
  const monthlySpeed = sliceSeries(
    pickSeries(breakdown, "speed_by_month", data.speed_by_month),
    months,
  )
  const monthlyAcc = sliceSeries(
    pickSeries(breakdown, "acc_by_month", data.acc_by_month),
    months,
  )
  const monthlyCas = sliceSeries(
    pickSeries(breakdown, "cas_by_month", data.cas_by_month),
    months,
  )
  const monthlyHigh = sliceSeries(
    pickSeries(breakdown, "high_share_by_month", data.high_share_by_month),
    months,
  )

  const rangeFiltered = range !== "all"

  // --- Nilai "pasti" untuk seluruh periode ---------------------------------
  const exactSpeed = zoneStat ? zoneStat.speed : data.kpi.avg_speed
  const exactPm25 = zoneStat ? zoneStat.pm25 : data.kpi.avg_pm25
  const exactAcc = zoneStat ? zoneStat.acc : data.kpi.total_accidents
  const exactCas = zoneStat ? zoneStat.cas : data.kpi.total_casualties
  const exactVol = zoneStat
    ? zoneStat.vol
    : (mean(data.per_zone.map((z) => z.vol)) ?? 0)

  const congestion: CongestionCounts = breakdown?.congestion ?? data.congestion
  const totalHours = congestion.LOW + congestion.MEDIUM + congestion.HIGH
  const exactPctHigh =
    totalHours > 0 ? (congestion.HIGH / totalHours) * 100 : data.kpi.pct_high

  /**
   * Saat rentang waktu dipersempit, angka dihitung ulang dari deret bulanan.
   * Catatan: rata-rata di sini adalah rata-rata dari rata-rata bulanan
   * (tiap bulan berbobot sama). Untuk data dengan cakupan jam yang mirip
   * tiap bulan, selisihnya dapat diabaikan.
   */
  const kpi = {
    speed: {
      value:
        rangeFiltered && monthlySpeed.length
          ? mean(values(monthlySpeed))
          : exactSpeed,
      delta: deltaOf(monthlySpeed),
      spark: values(monthlySpeed),
    },
    pm25: {
      value:
        rangeFiltered && monthlyPm25.length
          ? mean(values(monthlyPm25))
          : exactPm25,
      delta: deltaOf(monthlyPm25),
      spark: values(monthlyPm25),
    },
    pctHigh: {
      value:
        rangeFiltered && monthlyHigh.length
          ? mean(values(monthlyHigh))
          : exactPctHigh,
      delta: deltaOf(monthlyHigh),
      spark: values(monthlyHigh),
    },
    acc: {
      value:
        rangeFiltered && monthlyAcc.length ? sum(values(monthlyAcc)) : exactAcc,
      delta: deltaOf(monthlyAcc),
      spark: values(monthlyAcc),
    },
    cas: {
      value:
        rangeFiltered && monthlyCas.length ? sum(values(monthlyCas)) : exactCas,
      delta: deltaOf(monthlyCas),
      spark: values(monthlyCas),
    },
    vol: {
      // Volume tidak punya deret bulanan pada skema ini — sparkline memakai
      // profil per jam dan diberi label khusus di kartunya.
      value: exactVol,
      delta: null,
      spark: breakdown?.vol_by_hour ?? data.vol_by_hour ?? [],
    },
  } satisfies Record<string, KpiBlock>

  const pm25Cat: Pm25CategoryCounts = breakdown?.pm25_cat ?? data.pm25_cat
  const totalPm25Hours = Object.values(pm25Cat).reduce((a, b) => a + b, 0)

  const perZone = zoneFiltered
    ? data.per_zone.filter((z) => z.zone === zone)
    : data.per_zone

  const periodLabel =
    monthlyPm25.length > 0
      ? `${monthlyPm25[0].label} – ${monthlyPm25[monthlyPm25.length - 1].label}`
      : `${data.kpi.date_start} – ${data.kpi.date_end}`

  return {
    zone,
    range,
    zoneName: zoneStat ? zoneStat.name : "Semua zona",
    rangeText: rangeLabel(range),
    periodLabel,
    months: monthlyPm25.map((p) => p.month),

    monthlyPm25,
    monthlySpeed,
    monthlyAcc,
    monthlyCas,
    monthlyHigh,

    kpi,

    congestion,
    pm25Cat,
    totalHours,
    totalPm25Hours,
    congestionHighShare: exactPctHigh,

    speedByHour: breakdown?.speed_by_hour ?? data.speed_by_hour,
    volByHour: breakdown?.vol_by_hour ?? data.vol_by_hour ?? null,
    accByHour: breakdown?.acc_by_hour ?? data.acc_by_hour,

    perZone,
    allZones: data.per_zone,
    zonesGeo: data.zones,

    flags: {
      zoneFiltered,
      rangeFiltered,
      zoneBreakdown: Boolean(breakdown),
    },
  }
}

// ---------------------------------------------------------------------------
// Perbandingan antar zona (radar & callout "perlu perhatian")
// ---------------------------------------------------------------------------

export interface RadarPoint {
  indikator: string
  /** Satu kunci per zona, nilainya skor 0–100. */
  [zone: string]: string | number
}

/**
 * Skor relatif antar zona, 100 = kondisi terbaik di antara zona yang ada.
 *
 *   Kecepatan   : makin tinggi makin baik  -> skor = 100 × nilai / nilai_maks
 *   PM2.5       : makin rendah makin baik  -> skor = 100 × nilai_min / nilai
 *   Kecelakaan  : makin rendah makin baik  -> skor = 100 × nilai_min / nilai
 *
 * Ketiganya dihitung SENDIRI-SENDIRI dari sumber datanya masing-masing;
 * skor gabungan hanya meringkas tiga indikator mandiri, bukan menyatakan
 * bahwa satu indikator menyebabkan indikator lain.
 */
export function zoneScores(zones: ZoneStat[]) {
  const maxSpeed = Math.max(...zones.map((z) => z.speed), 1)
  const minPm25 = Math.min(...zones.map((z) => z.pm25))
  const minAcc = Math.min(...zones.map((z) => z.acc))

  return zones.map((z) => {
    const speedScore = (z.speed / maxSpeed) * 100
    const pm25Score = z.pm25 > 0 ? (minPm25 / z.pm25) * 100 : 100
    const accScore = z.acc > 0 ? (minAcc / z.acc) * 100 : 100
    return {
      zone: z.zone,
      name: z.name,
      speedScore,
      pm25Score,
      accScore,
      /** Rata-rata tiga skor; makin rendah = makin perlu perhatian. */
      overall: (speedScore + pm25Score + accScore) / 3,
    }
  })
}

/** Susun data radar: satu baris per indikator, satu kolom per zona. */
export function buildRadarData(zones: ZoneStat[]): RadarPoint[] {
  const scores = zoneScores(zones)
  const rows: { key: "speedScore" | "pm25Score" | "accScore"; label: string }[] =
    [
      { key: "speedScore", label: "Kelancaran" },
      { key: "pm25Score", label: "Udara bersih" },
      { key: "accScore", label: "Keselamatan" },
    ]

  return rows.map((row) => {
    const point: RadarPoint = { indikator: row.label }
    for (const s of scores) {
      point[s.zone] = Math.round(s[row.key] * 10) / 10
    }
    return point
  })
}

/** Zona dengan skor gabungan terendah = paling perlu perhatian. */
export function zoneNeedingAttention(zones: ZoneStat[]) {
  const scores = zoneScores(zones)
  if (scores.length === 0) return null
  return scores.reduce((worst, s) => (s.overall < worst.overall ? s : worst))
}
