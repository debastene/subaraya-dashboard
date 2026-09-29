import {
  LayoutDashboard,
  Map,
  ShieldAlert,
  Table2,
  TrafficCone,
  Wind,
  type LucideIcon,
} from "lucide-react"

import type { PillarKey } from "@/lib/colors"

export interface NavItem {
  to: string
  label: string
  /** Deskripsi singkat — dipakai di hasil pencarian & judul halaman. */
  description: string
  icon: LucideIcon
  /** Aksen warna pilar (opsional). */
  pillar?: PillarKey
}

/** Satu sumber kebenaran untuk menu sidebar, judul top bar, dan pencarian. */
export const NAV_ITEMS: NavItem[] = [
  {
    to: "/",
    label: "Overview",
    description: "Ringkasan tiga indikator kota",
    icon: LayoutDashboard,
  },
  {
    to: "/kemacetan",
    label: "Kemacetan",
    description: "Kecepatan, volume, dan tingkat kepadatan",
    icon: TrafficCone,
    pillar: "macet",
  },
  {
    to: "/udara",
    label: "Kualitas Udara",
    description: "Konsentrasi PM2.5 per zona dan per bulan",
    icon: Wind,
    pillar: "udara",
  },
  {
    to: "/keselamatan",
    label: "Keselamatan",
    description: "Kecelakaan dan korban tercatat",
    icon: ShieldAlert,
    pillar: "aman",
  },
  {
    to: "/peta",
    label: "Peta Zona",
    description: "Sebaran indikator pada peta kota",
    icon: Map,
  },
  {
    to: "/data",
    label: "Data",
    description: "Tabel ringkasan per zona",
    icon: Table2,
  },
]

/** Cari item navigasi yang cocok dengan sebuah path. */
export function navItemForPath(pathname: string): NavItem {
  const exact = NAV_ITEMS.find((item) => item.to === pathname)
  if (exact) return exact
  const nested = NAV_ITEMS.find(
    (item) => item.to !== "/" && pathname.startsWith(item.to),
  )
  return nested ?? NAV_ITEMS[0]
}
