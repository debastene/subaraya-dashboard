import type { DashboardView } from "@/lib/metrics"

/**
 * Teks catatan kaki yang menjelaskan cakupan data sebuah chart.
 *
 * Tujuannya menjaga kejujuran tampilan: kalau sebuah chart TIDAK ikut
 * terpengaruh filter (karena rincian datanya memang tidak tersedia),
 * pembaca harus tahu.
 */

/**
 * Catatan untuk chart yang hanya punya agregat seluruh periode
 * (profil per jam & distribusi kategori): filter rentang waktu tidak berlaku.
 */
export function periodAggregateNote(view: DashboardView): string {
  const scope = view.flags.zoneFiltered
    ? view.flags.zoneBreakdown
      ? `Zona ${view.zoneName}.`
      : `Rincian per zona tidak tersedia pada data ini, angka yang tampil adalah agregat seluruh kota.`
    : "Agregat seluruh zona."

  return `${scope} Dihitung dari seluruh periode data — pilihan rentang waktu tidak mengubah chart ini.`
}

/** Catatan untuk chart bulanan yang memang mengikuti kedua filter. */
export function monthlyScopeNote(view: DashboardView): string {
  const scope = view.flags.zoneFiltered
    ? view.flags.zoneBreakdown
      ? `Zona ${view.zoneName}`
      : `Agregat seluruh kota (rincian bulanan per zona tidak tersedia)`
    : "Agregat seluruh zona"
  return `${scope} · ${view.periodLabel}.`
}

/** Catatan wajib untuk angka kecelakaan. */
export const ACCIDENT_NOTE =
  "Angka kecelakaan adalah total kumulatif yang tercatat pada periode terpilih, bukan kejadian per bulan."

/** Catatan wajib tentang asal data. */
export const SOURCE_NOTE =
  "Lalu lintas, kualitas udara, dan kecelakaan berasal dari sumber data yang berbeda dan disajikan sebagai indikator mandiri."
