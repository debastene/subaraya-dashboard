/**
 * Helper format angka & tanggal — semuanya memakai locale Indonesia
 * (pemisah ribuan titik, desimal koma).
 */

const LOCALE = "id-ID"

/** Bilangan bulat dengan pemisah ribuan: 378531 -> "378.531". */
export function formatInt(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "–"
  return Math.round(value).toLocaleString(LOCALE)
}

/** Bilangan desimal: formatDecimal(27.04, 1) -> "27,0". */
export function formatDecimal(
  value: number | null | undefined,
  digits = 1,
): string {
  if (value == null || !Number.isFinite(value)) return "–"
  return value.toLocaleString(LOCALE, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
}

/** Persentase: formatPercent(25.7) -> "25,7%". */
export function formatPercent(
  value: number | null | undefined,
  digits = 1,
): string {
  if (value == null || !Number.isFinite(value)) return "–"
  return `${formatDecimal(value, digits)}%`
}

/** Bentuk ringkas untuk angka besar: 378531 -> "378,5 rb", 1250000 -> "1,3 jt". */
export function formatCompact(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "–"
  const abs = Math.abs(value)
  if (abs >= 1_000_000_000) return `${formatDecimal(value / 1_000_000_000, 1)} M`
  if (abs >= 1_000_000) return `${formatDecimal(value / 1_000_000, 1)} jt`
  if (abs >= 10_000) return `${formatDecimal(value / 1_000, 1)} rb`
  return formatInt(value)
}

/** Delta bertanda: +12.3 -> "+12,3%". */
export function formatDelta(
  value: number | null | undefined,
  digits = 1,
): string {
  if (value == null || !Number.isFinite(value)) return "–"
  const sign = value > 0 ? "+" : value < 0 ? "−" : ""
  return `${sign}${formatDecimal(Math.abs(value), digits)}%`
}

const NAMA_BULAN = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "Mei",
  "Jun",
  "Jul",
  "Agu",
  "Sep",
  "Okt",
  "Nov",
  "Des",
]

/** "2022-01" -> "Jan 2022". Aman untuk label yang tidak sesuai format. */
export function formatMonth(label: string): string {
  const match = /^(\d{4})-(\d{2})$/.exec(label)
  if (!match) return label
  const [, year, month] = match
  const idx = Number(month) - 1
  if (idx < 0 || idx > 11) return label
  return `${NAMA_BULAN[idx]} ${year}`
}

/** "2022-01" -> "Jan" (untuk sumbu X yang sempit). */
export function formatMonthShort(label: string): string {
  const match = /^(\d{4})-(\d{2})$/.exec(label)
  if (!match) return label
  const idx = Number(match[2]) - 1
  if (idx < 0 || idx > 11) return label
  // Tampilkan tahun hanya pada bulan Januari agar sumbu tidak penuh.
  return idx === 0 ? `${NAMA_BULAN[idx]} '${match[1].slice(2)}` : NAMA_BULAN[idx]
}

/** 7 -> "07.00" (format jam Indonesia). */
export function formatHour(hour: number): string {
  return `${String(hour).padStart(2, "0")}.00`
}

/** Ubah label periode versi Inggris ("Dec 2021") menjadi Indonesia ("Des 2021"). */
export function localizePeriodLabel(label: string): string {
  const map: Record<string, string> = {
    Jan: "Jan",
    Feb: "Feb",
    Mar: "Mar",
    Apr: "Apr",
    May: "Mei",
    Jun: "Jun",
    Jul: "Jul",
    Aug: "Agu",
    Sep: "Sep",
    Oct: "Okt",
    Nov: "Nov",
    Dec: "Des",
  }
  return label.replace(
    /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b/g,
    (m) => map[m] ?? m,
  )
}
