# Subaraya · Dashboard Kota

Dashboard analitik statis untuk kota simulasi **Subaraya** — 4 zona yang
dipantau dari tiga sisi: **kemacetan lalu lintas**, **kualitas udara**, dan
**keselamatan (kecelakaan)**.

Dibuat dengan Vite + React + TypeScript, Tailwind CSS v4, komponen bergaya
shadcn/ui, Recharts, dan react-leaflet. Tidak ada backend: seluruh angka dibaca
dari satu berkas JSON statis.

---

## Menjalankan

```bash
npm install
npm run dev
```

Buka <http://localhost:5173>.

Perintah lain:

| Perintah            | Kegunaan                                      |
| ------------------- | --------------------------------------------- |
| `npm run dev`       | Server pengembangan (hot reload)              |
| `npm run build`     | Build produksi ke `dist/`                     |
| `npm run preview`   | Pratinjau hasil build                         |
| `npm run typecheck` | Cek tipe TypeScript tanpa membangun           |

---

## Isi halaman

| Rute            | Halaman        | Isi utama                                                                      |
| --------------- | -------------- | ------------------------------------------------------------------------------ |
| `/`             | Overview       | 4 KPI + sparkline, donut kepadatan, tren PM2.5, radar antar zona, callout zona prioritas |
| `/kemacetan`    | Kemacetan      | KPI kecepatan & volume, donut kepadatan, kecepatan per jam, kecepatan vs volume per zona |
| `/udara`        | Kualitas Udara | KPI PM2.5, bar PM2.5 per zona (warna ikut kategori), donut kategori jam, tren bulanan |
| `/keselamatan`  | Keselamatan    | KPI kecelakaan & korban, kecelakaan per jam, kecelakaan & korban per zona      |
| `/peta`         | Peta Zona      | Peta OpenStreetMap, 4 penanda lingkaran, pemilih metrik, peringkat zona        |
| `/data`         | Data           | Tabel per zona: cari, urutkan, paginasi, badge status, unduh CSV               |

### Interaksi

- **Filter global** (di top bar): pilih zona (Semua / Z01–Z04) dan rentang waktu
  (6 / 12 / 24 bulan / seluruh periode). Pilihan disimpan di `localStorage`.
- **Mode gelap/terang**: tombol matahari–bulan di kanan atas membuka menu
  **Terang / Gelap / Ikuti sistem**. Pilihan tersimpan di `localStorage`, dan
  sebuah skrip kecil di `index.html` menerapkannya sebelum React jalan supaya
  tidak ada kedipan warna saat halaman dimuat.
- **Pencarian** (`/` untuk fokus): mencari halaman dan zona. Memilih zona akan
  menerapkannya sebagai filter global.
- **Peta**: pemilih metrik (PM2.5 / Kecepatan / Kecelakaan) mengubah warna dan
  ukuran penanda; memilih zona pada filter global akan menggeser peta ke zona itu.
- **Tabel**: klik judul kolom untuk mengurutkan, ada kotak pencarian dan paginasi.

Semuanya responsif sampai lebar ponsel (sidebar berubah menjadi drawer),
menghormati `prefers-reduced-motion`, dan bisa dinavigasi dengan keyboard.

---

## Mengganti data contoh dengan data asli

Berkas `src/data/dashboard.json` saat ini berisi **DATA CONTOH**. Aplikasi hanya
membaca berkas ini — tidak ada tempat lain yang perlu diubah.

### 1. Siapkan CSV

Letakkan hasil ekspor PostgreSQL di folder `data_raw/` (folder ini sudah
diabaikan oleh git):

```
data_raw/
  mart_hourly.csv
  dim_zone.csv
```

`mart_hourly.csv` — satu baris per (zona, jam):

| Kolom              | Wajib | Keterangan                                |
| ------------------ | ----- | ----------------------------------------- |
| `ts`               | ✔     | Waktu per jam (apa pun yang bisa diparse)  |
| `zone_id`          | ✔     | Kode zona, mis. `Z01`                      |
| `speed_kmh`        |       | Kecepatan rata-rata (km/jam), boleh kosong |
| `volume`           |       | Volume kendaraan per jam, boleh kosong     |
| `congestion_level` |       | `LOW` / `MEDIUM` / `HIGH`                  |
| `pm25`             |       | Konsentrasi PM2.5 (µg/m³)                  |
| `accidents`        |       | Jumlah kecelakaan pada jam itu             |
| `casualties`       |       | Jumlah korban pada jam itu                 |

`dim_zone.csv` — satu baris per zona:

| Kolom         | Wajib | Keterangan                    |
| ------------- | ----- | ----------------------------- |
| `zone_id`     | ✔     | Kode zona                      |
| `zone_name`   |       | Nama zona untuk ditampilkan    |
| `lat`, `lng`  |       | Koordinat penanda peta         |
| `capacity`    |       | Kapasitas ruas (kendaraan/jam) |
| `speed_limit` |       | Batas kecepatan (km/jam)       |

Nama kolom tidak harus persis: skrip mengenali beberapa alias (mis. `avg_speed`,
`kecepatan`, `pm2_5`, `kode_zona`). Kalau nama kolommu belum dikenali, tambahkan
ke `HOURLY_ALIASES` / `ZONE_ALIASES` di bagian atas `scripts/aggregate.py`.

### 2. Jalankan skrip agregasi

```bash
pip install pandas
python scripts/aggregate.py
```

Atau tunjuk lokasinya sendiri:

```bash
python scripts/aggregate.py --hourly data_raw/mart_hourly.csv --zones data_raw/dim_zone.csv --sep ";"
```

Skrip menulis ulang `src/data/dashboard.json` lalu mencetak ringkasannya. Setelah
itu cukup muat ulang halaman `npm run dev` — tidak ada langkah lain.

**Aturan agregasi yang dipakai**

- Rata-rata (kecepatan, volume, PM2.5) **mengabaikan nilai kosong** — banyak baris
  lalu lintas memang `NULL`.
- Kecelakaan dan korban **dijumlahkan**; `NULL` dihitung sebagai 0.
- `pm25_by_month` dikelompokkan per `YYYY-MM`.
- `acc_by_hour` memakai penjumlahan, `speed_by_hour` memakai rata-rata.
- Bila `congestion_level` tidak ada di CSV, skrip menurunkannya dari rasio
  volume/kapasitas (<0,50 `LOW`, <0,80 `MEDIUM`, sisanya `HIGH`) dan memberi
  peringatan di terminal serta catatan pada `meta.note`. Matikan dengan
  `--no-derive-congestion`.

### 3. (Opsional) buat ulang data contoh

```bash
node scripts/generate-mock.mjs src/data/dashboard.json
```

---

## Kontrak data

Bentuk lengkap `dashboard.json` didefinisikan di [`src/types.ts`](src/types.ts).

```jsonc
{
  "kpi":        { "avg_speed": 27.0, "avg_pm25": 77.6, "total_accidents": 378531,
                  "total_casualties": 481904, "pct_high": 25.7,
                  "date_start": "Dec 2021", "date_end": "Sep 2025" },
  "congestion": { "LOW": 37730, "MEDIUM": 23468, "HIGH": 21126 },
  "per_zone":   [ { "zone": "Z01", "name": "Pusat Kota", "speed": 29.7, "vol": 3276,
                    "pm25": 81.4, "acc": 94955, "cas": 120862 } ],
  "speed_by_hour": [ /* 24 angka, jam 0..23 */ ],
  "acc_by_hour":   [ /* 24 angka, jam 0..23 */ ],
  "pm25_by_month": { "labels": ["2021-12", "..."], "values": [5.7, "..."] },
  "pm25_cat":   { "Baik": 22232, "Sedang": 41718,
                  "Tidak Sehat": 46570, "Sangat Tidak Sehat": 17883 },
  "zones":      [ { "zone": "Z01", "name": "Pusat Kota", "lat": -7.2575, "lng": 112.7521,
                    "cap": 6000, "limit": 50, "pm25": 81.4, "speed": 29.7, "acc": 94955 } ]
}
```

### Bagian opsional

Delapan kunci berikut **tidak wajib**. Kalau ada, filter global jadi jauh lebih
berguna; kalau tidak ada, dashboard tetap jalan dan otomatis menampilkan angka
se-kota beserta catatan kecil bahwa chart tersebut adalah agregat.

| Kunci                 | Gunanya                                                     |
| --------------------- | ----------------------------------------------------------- |
| `vol_by_hour`         | Profil volume harian (sparkline KPI volume)                 |
| `speed_by_month`      | Sparkline & delta KPI kecepatan                             |
| `acc_by_month`        | Sparkline & delta KPI kecelakaan                            |
| `cas_by_month`        | Sparkline & delta KPI korban                                |
| `high_share_by_month` | Sparkline & delta KPI “% waktu macet”                       |
| `by_zone`             | Semua seri di atas, dipecah per kode zona — membuat filter zona memengaruhi chart per jam, donut, dan tren bulanan |
| `meta`                | Jejak proses agregasi (waktu, sumber, jumlah baris)         |

`scripts/aggregate.py` selalu mengisi semuanya.

### Kategori PM2.5 (µg/m³)

| Kategori           | Rentang   |
| ------------------ | --------- |
| Baik               | ≤ 15      |
| Sedang             | 16 – 55   |
| Tidak Sehat        | 56 – 150  |
| Sangat Tidak Sehat | > 150     |

Badge status pada tabel memakai ambang yang sama: **Aman** ≤ 55,
**Waspada** ≤ 150, **Bahaya** > 150. Ambangnya ada di satu tempat —
`PM25_THRESHOLDS` di [`src/lib/colors.ts`](src/lib/colors.ts) — dan disalin ke
`scripts/aggregate.py` (konstanta `PM25_*`). Ubah keduanya bila perlu.

---

## Catatan kebenaran data

Hal-hal berikut sengaja dijaga di dalam kode maupun tampilan:

1. **Tiga domain, tiga sumber.** Lalu lintas, kualitas udara, dan kecelakaan
   berasal dari sumber data yang berbeda. Dashboard tidak pernah menyandingkan
   keduanya sebagai hubungan sebab-akibat, dan tidak ada chart korelasi antar
   domain. Halaman Overview menampilkan disclaimer ini.
2. **Lokasi & waktu adalah simulasi** — data publik yang dinormalisasi ke dalam
   4 zona.
3. **Angka kecelakaan adalah total kumulatif** sepanjang periode, bukan kejadian
   per bulan. Labelnya selalu menulis “total tercatat”.
4. **Pola per jam ditampilkan apa adanya.** Tidak ada klaim bahwa jam tertentu
   menyebabkan kemacetan atau kecelakaan.
5. **Chart yang tidak ikut terfilter memberi tahu pembaca.** Profil per jam dan
   distribusi kategori dihitung dari seluruh periode; catatan kaki setiap chart
   menyebutkan hal itu, begitu juga bila rincian per zona tidak tersedia
   sehingga yang tampil adalah agregat se-kota.
6. **Skor radar bersifat relatif.** Nilainya 0–100 dibanding zona lain
   (kelancaran = rasio terhadap kecepatan tertinggi; udara bersih dan
   keselamatan = rasio terhadap nilai terendah), bukan skor mutlak. Skor
   gabungan hanya meringkas tiga indikator mandiri.
7. **Rata-rata pada rentang waktu yang dipersempit** dihitung sebagai rata-rata
   dari rata-rata bulanan (tiap bulan berbobot sama). Untuk cakupan jam yang
   mirip tiap bulan, selisihnya dapat diabaikan. Pada “Seluruh periode”, yang
   dipakai adalah angka agregat yang persis.

---

## Struktur folder

```
scripts/
  aggregate.py            # CSV asli  -> src/data/dashboard.json  (pandas)
  generate-mock.mjs       # Pembuat data contoh (Node, tanpa dependensi)
src/
  components/
    ui/                   # Primitif bergaya shadcn (button, card, select, ...)
    layout/               # AppLayout, Sidebar, TopBar
    ChartCard.tsx         # Pembungkus seragam untuk semua chart
    KpiCard.tsx           # Kartu KPI: angka besar + delta + sparkline
    Sparkline.tsx         # Mini chart tanpa sumbu
    ChartTooltip.tsx      # Tooltip seragam, ikut tema
    DataTable.tsx         # Tabel: cari + urutkan + paginasi
    ZoneMap.tsx           # Peta Leaflet + penanda lingkaran
    ZoneFilter.tsx        # Select zona & rentang waktu
    ThemeToggle.tsx       # Tombol gelap/terang
    GlobalSearch.tsx      # Pencarian halaman & zona
    charts/DonutChart.tsx # Donut + legenda bernilai
  pages/                  # Satu berkas per rute
  store/
    theme.tsx             # Konteks tema (localStorage)
    filters.tsx           # Konteks filter global (localStorage)
  hooks/                  # use-dashboard, use-chart-colors, use-media-query, ...
  lib/
    metrics.ts            # Data + filter  ->  angka siap pakai
    colors.ts             # Palet, ambang PM2.5, status zona
    format.ts             # Format angka & tanggal locale id-ID
    notes.ts              # Teks catatan kaki tentang cakupan data
    nav.ts                # Daftar menu (dipakai sidebar & pencarian)
    utils.ts              # cn(), mean(), sum(), clamp()
  data/
    dashboard.json        # <- SATU-SATUNYA sumber angka
    index.ts
  types.ts                # Kontrak data
  index.css               # Design token (CSS variable) + tema Leaflet
```

---

## Warna

Semua warna berasal dari CSS variable di `src/index.css` sehingga mode gelap dan
terang sama-sama punya kontras yang cukup.

| Peran                | Terang    | Gelap     |
| -------------------- | --------- | --------- |
| Aksen utama (teal)   | `#10b981` | `#34d399` |
| Aksen kedua (coral)  | `#f97316` | `#fb923c` |
| Pilar Kemacetan      | `#3b5bdb` | `#7c93f5` |
| Kondisi baik         | `#2f9e44` | `#51cf66` |
| Kondisi waspada      | `#f08c00` | `#ffc078` |
| Kondisi bahaya       | `#e03131` | `#ff6b6b` |

Recharts dan Leaflet butuh nilai hex (bukan `var(--x)`) untuk menghitung gradien
dan opacity, jadi nilai yang sama juga ada di `PALETTE` pada
`src/lib/colors.ts`. **Kalau mengganti warna, ubah di kedua berkas itu.**

---

## Menambah komponen shadcn/ui

Proyek ini sudah punya `components.json`, jadi komponen baru bisa ditambahkan
seperti biasa:

```bash
npx shadcn@latest add tooltip
```
