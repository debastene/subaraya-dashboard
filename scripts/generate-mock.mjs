// Generator MOCK dashboard.json — deterministik, konsisten antar-seri.
//
// Dipakai hanya untuk DATA CONTOH saat mengembangkan tampilan.
// Untuk data asli, pakai scripts/aggregate.py.
//
//   node scripts/generate-mock.mjs src/data/dashboard.json
//
// Angka jangkar (kecepatan/PM2.5/kecelakaan per zona) didefinisikan di
// konstanta ZONES; seluruh deret per jam & per bulan diturunkan dari sana
// supaya total dan rata-ratanya selalu cocok.
import { writeFileSync } from "node:fs"

const OUT = process.argv[2] ?? "src/data/dashboard.json"

// --- PRNG deterministik ----------------------------------------------------
function mulberry32(a) {
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const rand = mulberry32(20260925)
const jitter = (amp) => 1 + (rand() * 2 - 1) * amp

const r1 = (x) => Math.round(x * 10) / 10

/** Bagi `total` (integer) menurut bobot, hasil integer dan jumlahnya persis `total`. */
function splitExact(total, weights) {
  const wsum = weights.reduce((a, b) => a + b, 0)
  const raw = weights.map((w) => (w / wsum) * total)
  const floor = raw.map(Math.floor)
  let rest = total - floor.reduce((a, b) => a + b, 0)
  const order = raw
    .map((v, i) => ({ i, frac: v - Math.floor(v) }))
    .sort((a, b) => b.frac - a.frac)
  for (let k = 0; k < order.length && rest > 0; k++, rest--) floor[order[k].i]++
  return floor
}

/** Normalkan array sehingga rata-ratanya persis 1. */
function normalizeMean1(arr) {
  const m = arr.reduce((a, b) => a + b, 0) / arr.length
  return arr.map((v) => v / m)
}

// --- Periode ---------------------------------------------------------------
const MONTHS = []
for (let y = 2021, m = 12; MONTHS.length < 46; ) {
  MONTHS.push(`${y}-${String(m).padStart(2, "0")}`)
  m++
  if (m > 12) {
    m = 1
    y++
  }
}
const N = MONTHS.length // 46 (Des 2021 – Sep 2025)

// --- Definisi zona (angka target = jangkar KPI) ----------------------------
const ZONES = [
  {
    zone: "Z01",
    name: "Pusat Kota",
    lat: -7.2575,
    lng: 112.7521,
    cap: 6000,
    limit: 50,
    speed: 29.7,
    vol: 3276,
    pm25: 81.4,
    acc: 94955,
    cas: 120862,
    congestion: { LOW: 9100, MEDIUM: 6100, HIGH: 5400 },
    pm25_cat: { Baik: 3600, Sedang: 10800, "Tidak Sehat": 13900, "Sangat Tidak Sehat": 3800 },
    // profil jam: pusat kota -> dua puncak (pagi & sore) tajam
    accShape: [3, 2, 1.4, 1.2, 1.6, 3.2, 6.4, 9.2, 8.1, 6.2, 5.6, 5.8, 6.1, 5.9, 6.0, 7.0, 8.8, 9.6, 8.4, 6.3, 5.1, 4.4, 4.0, 3.4],
    speedDip: 1.0,
  },
  {
    zone: "Z02",
    name: "Kawasan Industri",
    lat: -7.218,
    lng: 112.728,
    cap: 7500,
    limit: 60,
    speed: 24.1,
    vol: 4120,
    pm25: 96.3,
    acc: 108430,
    cas: 138900,
    congestion: { LOW: 8000, MEDIUM: 6200, HIGH: 6400 },
    pm25_cat: { Baik: 1500, Sedang: 7200, "Tidak Sehat": 15400, "Sangat Tidak Sehat": 8000 },
    // kawasan industri -> puncak mengikuti pergantian shift (06, 14, 22)
    accShape: [4.2, 3.4, 2.6, 2.2, 2.8, 5.4, 8.6, 7.4, 5.8, 5.2, 5.0, 5.1, 5.4, 6.2, 7.8, 6.6, 6.0, 6.8, 7.2, 5.6, 4.8, 5.4, 6.4, 5.2],
    speedDip: 1.15,
  },
  {
    zone: "Z03",
    name: "Perumahan Timur",
    lat: -7.276,
    lng: 112.789,
    cap: 4200,
    limit: 40,
    speed: 31.8,
    vol: 2180,
    pm25: 49.7,
    acc: 76240,
    cas: 96110,
    congestion: { LOW: 12400, MEDIUM: 5100, HIGH: 3100 },
    pm25_cat: { Baik: 14832, Sedang: 13018, "Tidak Sehat": 3350, "Sangat Tidak Sehat": 900 },
    // perumahan -> puncak pagi (antar sekolah) & sore
    accShape: [2.2, 1.5, 1.0, 0.9, 1.4, 3.6, 7.2, 8.8, 6.4, 4.8, 4.2, 4.4, 5.0, 5.2, 5.4, 6.4, 8.2, 8.6, 7.0, 5.2, 4.4, 3.8, 3.2, 2.6],
    speedDip: 0.75,
  },
  {
    zone: "Z04",
    name: "Koridor Barat",
    lat: -7.234,
    lng: 112.695,
    cap: 6800,
    limit: 60,
    speed: 22.4,
    vol: 3560,
    pm25: 83.1,
    acc: 98906,
    cas: 126032,
    congestion: { LOW: 8230, MEDIUM: 6068, HIGH: 6226 },
    pm25_cat: { Baik: 2300, Sedang: 10700, "Tidak Sehat": 13920, "Sangat Tidak Sehat": 5183 },
    // koridor arteri -> ramai panjang dari pagi sampai malam
    accShape: [3.6, 2.8, 2.0, 1.8, 2.4, 4.6, 7.8, 8.6, 7.2, 6.0, 5.6, 5.8, 6.0, 6.2, 6.6, 7.4, 8.8, 9.0, 7.8, 6.2, 5.2, 4.6, 4.2, 3.6],
    speedDip: 1.25,
  },
]

// --- Profil kecepatan per jam (bentuk dasar kota) --------------------------
// Malam lancar, turun tajam pada jam sibuk pagi (07–08) & sore (16–18).
const SPEED_BASE = [
  34.5, 35.2, 35.8, 35.9, 34.8, 32.0, 27.4, 21.6, 20.8, 24.2, 26.4, 26.9, 26.2,
  26.6, 26.1, 24.0, 20.4, 19.6, 20.9, 24.6, 28.2, 30.8, 32.6, 33.8,
]
// Volume kendaraan per jam (bentuk dasar, dinormalkan nanti).
const VOL_BASE = [
  0.28, 0.2, 0.15, 0.14, 0.22, 0.48, 0.92, 1.42, 1.5, 1.24, 1.12, 1.1, 1.16,
  1.14, 1.18, 1.3, 1.52, 1.58, 1.4, 1.1, 0.9, 0.72, 0.56, 0.4,
]

// --- Musiman PM2.5 (kemarau Jun–Sep lebih tinggi) --------------------------
const PM_SEASON = [0.86, 0.84, 0.86, 0.9, 0.96, 1.08, 1.18, 1.24, 1.2, 1.04, 0.92, 0.88]

const byZone = {}
const perZone = []
const zonesGeo = []

for (const z of ZONES) {
  // ---- Seri bulanan PM2.5: musiman + tren perbaikan pelan + noise --------
  const pmRaw = MONTHS.map((label, i) => {
    const month = Number(label.slice(5)) - 1
    const trend = 1 + 0.06 * (1 - i / (N - 1)) // sedikit menurun dari waktu ke waktu
    return PM_SEASON[month] * trend * jitter(0.08)
  })
  const pmFactors = normalizeMean1(pmRaw)
  const pm25_by_month = pmFactors.map((f) => r1(z.pm25 * f))

  // ---- Seri bulanan kecepatan -------------------------------------------
  const spRaw = MONTHS.map((_, i) => (1 - 0.05 * (i / (N - 1))) * jitter(0.05))
  const speed_by_month = normalizeMean1(spRaw).map((f) => r1(z.speed * f))

  // ---- Seri bulanan kecelakaan & korban (jumlah persis = total zona) ----
  const accW = MONTHS.map((label) => {
    const month = Number(label.slice(5)) - 1
    // Desember & masa liburan sedikit lebih tinggi
    const seasonal = month === 11 || month === 0 || month === 6 ? 1.12 : 1
    return seasonal * jitter(0.13)
  })
  const acc_by_month = splitExact(z.acc, accW)
  const cas_by_month = acc_by_month.map((a, i) =>
    Math.round(a * (z.cas / z.acc) * jitter(0.03)),
  )
  // koreksi agar jumlah korban persis
  const casDiff = z.cas - cas_by_month.reduce((a, b) => a + b, 0)
  cas_by_month[cas_by_month.length - 1] += casDiff

  // ---- Persentase jam macet (HIGH) per bulan ----------------------------
  const zoneHighPct =
    (z.congestion.HIGH /
      (z.congestion.LOW + z.congestion.MEDIUM + z.congestion.HIGH)) *
    100
  const hsRaw = MONTHS.map((_, i) => (1 + 0.1 * (i / (N - 1))) * jitter(0.12))
  const high_share_by_month = normalizeMean1(hsRaw).map((f) => r1(zoneHighPct * f))

  // ---- Profil per jam ----------------------------------------------------
  const speedShapeRaw = SPEED_BASE.map((v, h) => {
    // `speedDip` memperdalam/menghaluskan lembah jam sibuk per zona
    const cityMean = SPEED_BASE.reduce((a, b) => a + b, 0) / 24
    return cityMean + (v - cityMean) * z.speedDip
  })
  const speed_by_hour = normalizeMean1(speedShapeRaw).map((f) => r1(z.speed * f))

  const vol_by_hour = normalizeMean1(VOL_BASE.map((v) => v * jitter(0.03))).map(
    (f) => Math.round(z.vol * f),
  )

  const acc_by_hour = splitExact(z.acc, z.accShape)

  byZone[z.zone] = {
    congestion: z.congestion,
    pm25_cat: z.pm25_cat,
    speed_by_hour,
    vol_by_hour,
    acc_by_hour,
    pm25_by_month: { labels: MONTHS, values: pm25_by_month },
    speed_by_month: { labels: MONTHS, values: speed_by_month },
    acc_by_month: { labels: MONTHS, values: acc_by_month },
    cas_by_month: { labels: MONTHS, values: cas_by_month },
    high_share_by_month: { labels: MONTHS, values: high_share_by_month },
  }

  perZone.push({
    zone: z.zone,
    name: z.name,
    speed: z.speed,
    vol: z.vol,
    pm25: z.pm25,
    acc: z.acc,
    cas: z.cas,
  })

  zonesGeo.push({
    zone: z.zone,
    name: z.name,
    lat: z.lat,
    lng: z.lng,
    cap: z.cap,
    limit: z.limit,
    pm25: z.pm25,
    speed: z.speed,
    acc: z.acc,
  })
}

// --- Agregat se-kota -------------------------------------------------------
const codes = ZONES.map((z) => z.zone)
const cityMeanSeries = (key, len) =>
  Array.from({ length: len }, (_, i) =>
    r1(codes.reduce((a, c) => a + byZone[c][key].values[i], 0) / codes.length),
  )
const citySumSeries = (key, len) =>
  Array.from({ length: len }, (_, i) =>
    codes.reduce((a, c) => a + byZone[c][key].values[i], 0),
  )
const cityMeanHour = (key) =>
  Array.from({ length: 24 }, (_, h) =>
    r1(codes.reduce((a, c) => a + byZone[c][key][h], 0) / codes.length),
  )
const citySumHour = (key) =>
  Array.from({ length: 24 }, (_, h) =>
    codes.reduce((a, c) => a + byZone[c][key][h], 0),
  )

const congestion = { LOW: 0, MEDIUM: 0, HIGH: 0 }
const pm25_cat = { Baik: 0, Sedang: 0, "Tidak Sehat": 0, "Sangat Tidak Sehat": 0 }
for (const c of codes) {
  for (const k of Object.keys(congestion)) congestion[k] += byZone[c].congestion[k]
  for (const k of Object.keys(pm25_cat)) pm25_cat[k] += byZone[c].pm25_cat[k]
}

const totalHours = congestion.LOW + congestion.MEDIUM + congestion.HIGH

const data = {
  kpi: {
    avg_speed: r1(perZone.reduce((a, z) => a + z.speed, 0) / perZone.length),
    avg_pm25: r1(perZone.reduce((a, z) => a + z.pm25, 0) / perZone.length),
    total_accidents: perZone.reduce((a, z) => a + z.acc, 0),
    total_casualties: perZone.reduce((a, z) => a + z.cas, 0),
    pct_high: r1((congestion.HIGH / totalHours) * 100),
    date_start: "Dec 2021",
    date_end: "Sep 2025",
  },
  congestion,
  per_zone: perZone,
  speed_by_hour: cityMeanHour("speed_by_hour"),
  acc_by_hour: citySumHour("acc_by_hour"),
  pm25_by_month: { labels: MONTHS, values: cityMeanSeries("pm25_by_month", N) },
  pm25_cat,
  zones: zonesGeo,

  // --- Bagian opsional (dipakai untuk filter & sparkline) ---
  vol_by_hour: cityMeanHour("vol_by_hour").map((v) => Math.round(v)),
  speed_by_month: { labels: MONTHS, values: cityMeanSeries("speed_by_month", N) },
  acc_by_month: { labels: MONTHS, values: citySumSeries("acc_by_month", N) },
  cas_by_month: { labels: MONTHS, values: citySumSeries("cas_by_month", N) },
  high_share_by_month: {
    labels: MONTHS,
    values: cityMeanSeries("high_share_by_month", N),
  },
  by_zone: byZone,
  meta: {
    generated_at: new Date("2026-09-25T00:00:00Z").toISOString(),
    source: "MOCK — dihasilkan oleh scripts/gen-mock (data contoh, bukan data asli)",
    rows: totalHours,
    note:
      "Data contoh untuk pengembangan. Ganti dengan hasil scripts/aggregate.py " +
      "saat data asli sudah siap.",
  },
}

writeFileSync(OUT, JSON.stringify(data, null, 2) + "\n", "utf8")

// --- Verifikasi cepat ------------------------------------------------------
const chk = {
  avg_speed: data.kpi.avg_speed,
  avg_pm25: data.kpi.avg_pm25,
  total_accidents: data.kpi.total_accidents,
  total_casualties: data.kpi.total_casualties,
  pct_high: data.kpi.pct_high,
  months: N,
  acc_by_hour_sum: data.acc_by_hour.reduce((a, b) => a + b, 0),
  acc_by_month_sum: data.acc_by_month.values.reduce((a, b) => a + b, 0),
  cas_by_month_sum: data.cas_by_month.values.reduce((a, b) => a + b, 0),
  mean_speed_by_hour: r1(data.speed_by_hour.reduce((a, b) => a + b, 0) / 24),
  mean_pm25_by_month: r1(
    data.pm25_by_month.values.reduce((a, b) => a + b, 0) / N,
  ),
  mean_high_share: r1(
    data.high_share_by_month.values.reduce((a, b) => a + b, 0) / N,
  ),
  congestion,
  pm25_cat,
}
console.log(JSON.stringify(chk, null, 2))
