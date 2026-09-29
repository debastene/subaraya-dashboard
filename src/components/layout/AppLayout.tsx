import * as React from "react"
import { Outlet, useLocation } from "react-router-dom"

import { Sidebar } from "@/components/layout/Sidebar"
import { TopBar } from "@/components/layout/TopBar"
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"
import { dashboardData } from "@/data"
import { cn } from "@/lib/utils"

const COLLAPSE_KEY = "subaraya-sidebar-collapsed"

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSE_KEY) === "1"
  } catch {
    return false
  }
}

/**
 * Kerangka aplikasi: sidebar (drawer di mobile) + top bar + area konten.
 */
export function AppLayout() {
  const [collapsed, setCollapsed] = React.useState(readCollapsed)
  const [mobileOpen, setMobileOpen] = React.useState(false)
  const { pathname } = useLocation()

  const toggleCollapse = React.useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev
      try {
        localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0")
      } catch {
        /* abaikan bila storage tidak tersedia */
      }
      return next
    })
  }, [])

  // Gulir ke atas setiap kali pindah halaman.
  React.useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" })
  }, [pathname])

  return (
    <div className="flex min-h-screen bg-background">
      {/* Lompat langsung ke konten — bantuan untuk pengguna keyboard */}
      <a
        href="#konten-utama"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground"
      >
        Lompat ke konten
      </a>

      {/* ---- Sidebar layar besar ---- */}
      <aside
        className={cn(
          "sticky top-0 hidden h-screen shrink-0 lg:block",
          collapsed ? "w-[72px]" : "w-64",
        )}
      >
        <Sidebar collapsed={collapsed} onToggleCollapse={toggleCollapse} />
      </aside>

      {/* ---- Sidebar layar kecil (drawer) ---- */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent
          className="w-72 p-0"
          hideClose
          aria-describedby={undefined}
        >
          <SheetTitle className="sr-only">Menu navigasi</SheetTitle>
          <Sidebar onNavigate={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>

      {/* ---- Kolom konten ---- */}
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar onOpenMenu={() => setMobileOpen(true)} />

        <main
          id="konten-utama"
          tabIndex={-1}
          className="flex-1 px-4 py-5 md:px-6 md:py-6"
        >
          <Outlet />
        </main>

        <footer className="border-t border-border px-4 py-4 text-xs text-muted-foreground md:px-6">
          <p>
            Subaraya · dashboard kota simulasi ·{" "}
            <span className="tabular">
              {dashboardData.per_zone.length} zona
            </span>{" "}
            · data lalu lintas, kualitas udara, dan keselamatan dianalisis
            sebagai tiga indikator mandiri.
          </p>
        </footer>
      </div>
    </div>
  )
}
