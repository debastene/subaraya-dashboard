import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

/** Gabungkan class Tailwind dengan aman (menghapus class yang bentrok). */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Batasi angka ke rentang [min, max]. */
export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

/** Rata-rata yang mengabaikan nilai kosong / NaN. Mengembalikan null bila tidak ada data. */
export function mean(values: Array<number | null | undefined>): number | null {
  const valid = values.filter(
    (v): v is number => typeof v === "number" && Number.isFinite(v),
  )
  if (valid.length === 0) return null
  return valid.reduce((a, b) => a + b, 0) / valid.length
}

/** Penjumlahan yang mengabaikan nilai kosong / NaN. */
export function sum(values: Array<number | null | undefined>): number {
  return values.reduce<number>(
    (acc, v) => (typeof v === "number" && Number.isFinite(v) ? acc + v : acc),
    0,
  )
}
