import { PALETTE, type Palette } from "@/lib/colors"
import { useTheme } from "@/store/theme"

/**
 * Palet warna chart yang mengikuti tema aktif.
 * Recharts & Leaflet menerima nilai hex, jadi warnanya diambil dari sini
 * (bukan dari CSS variable) supaya bisa dipakai juga untuk gradien.
 */
export function useChartColors(): Palette {
  const { theme } = useTheme()
  return theme === "dark" ? PALETTE.dark : PALETTE.light
}
