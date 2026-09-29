import { useLocation } from "react-router-dom"
import { Menu } from "lucide-react"

import { Button } from "@/components/ui/button"
import { GlobalSearch } from "@/components/GlobalSearch"
import { ThemeToggle } from "@/components/ThemeToggle"
import { ZoneFilter } from "@/components/ZoneFilter"
import { useDashboardView } from "@/hooks/use-dashboard"
import { useMediaQuery } from "@/hooks/use-media-query"
import { navItemForPath } from "@/lib/nav"
import { useFilters } from "@/store/filters"

interface TopBarProps {
  /** Membuka sidebar versi drawer di layar kecil. */
  onOpenMenu: () => void
}

export function TopBar({ onOpenMenu }: TopBarProps) {
  const { pathname } = useLocation()
  const item = navItemForPath(pathname)
  const { isFiltered } = useFilters()
  const view = useDashboardView()

  // Pencarian & filter dipindah ke baris kedua pada layar sempit.
  // Dirender kondisional (bukan sekadar disembunyikan) supaya tidak ada
  // komponen ganda di DOM.
  const searchInline = useMediaQuery("(min-width: 1280px)")
  const filterInline = useMediaQuery("(min-width: 768px)")
  const needsSecondRow = !searchInline || !filterInline

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="flex items-center gap-3 px-4 py-3 md:px-6">
        {/* ---- Kiri: tombol menu (mobile) + judul halaman ---- */}
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <Button
            variant="outline"
            size="icon"
            className="lg:hidden"
            onClick={onOpenMenu}
            aria-label="Buka menu navigasi"
          >
            <Menu className="size-4" aria-hidden />
          </Button>

          <div className="min-w-0">
            <h1 className="truncate text-base font-semibold leading-tight md:text-lg">
              {item.label}
            </h1>
            <p className="truncate text-xs text-muted-foreground">
              {isFiltered
                ? `${view.zoneName} · ${view.periodLabel}`
                : item.description}
            </p>
          </div>
        </div>

        {/* ---- Kanan: pencarian, filter, tema ---- */}
        <div className="flex shrink-0 items-center gap-2">
          {searchInline ? <GlobalSearch className="w-56" /> : null}
          {filterInline ? <ZoneFilter /> : null}
          <ThemeToggle />
        </div>
      </div>

      {/* ---- Baris kedua untuk layar sempit ---- */}
      {needsSecondRow ? (
        <div className="flex flex-col gap-2 px-4 pb-3 md:px-6">
          {!searchInline ? <GlobalSearch className="md:max-w-sm" /> : null}
          {!filterInline ? <ZoneFilter /> : null}
        </div>
      ) : null}
    </header>
  )
}
