import { NavLink } from "react-router-dom"
import { ChevronsLeft, ChevronsRight, Gauge } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { dashboardData, dataPeriod } from "@/data"
import { NAV_ITEMS } from "@/lib/nav"
import { pm25Category } from "@/lib/colors"
import { formatDecimal, localizePeriodLabel } from "@/lib/format"
import { cn } from "@/lib/utils"

interface SidebarProps {
  /** Mode ringkas (hanya ikon) — hanya dipakai pada layar besar. */
  collapsed?: boolean
  onToggleCollapse?: () => void
  /** Dipanggil setelah menu diklik (untuk menutup drawer di mobile). */
  onNavigate?: () => void
  className?: string
}

export function Sidebar({
  collapsed = false,
  onToggleCollapse,
  onNavigate,
  className,
}: SidebarProps) {
  const avgPm25 = dashboardData.kpi.avg_pm25
  const kategori = pm25Category(avgPm25)

  return (
    <div
      className={cn(
        "flex h-full flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground",
        className,
      )}
    >
      {/* ---- Logo ---- */}
      <div
        className={cn(
          "flex h-16 shrink-0 items-center gap-2.5 border-b border-sidebar-border px-4",
          collapsed && "justify-center px-0",
        )}
      >
        <span
          aria-hidden
          className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-teal/12 text-teal"
        >
          <Gauge className="size-5" strokeWidth={2.1} />
        </span>
        {!collapsed && (
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold leading-tight">
              Subaraya
            </p>
            <p className="truncate text-xs text-muted-foreground">
              Dashboard Kota
            </p>
          </div>
        )}
      </div>

      {/* ---- Menu ---- */}
      <nav
        aria-label="Navigasi utama"
        className="flex-1 space-y-1 overflow-y-auto scrollbar-slim p-3"
      >
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/"}
            onClick={onNavigate}
            title={collapsed ? item.label : undefined}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                collapsed && "justify-center px-0",
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
              )
            }
          >
            {({ isActive }) => (
              <>
                <item.icon
                  className={cn(
                    "size-4.5 shrink-0",
                    isActive && item.pillar === "macet" && "text-pilar-macet",
                    isActive && item.pillar === "udara" && "text-pilar-udara",
                    isActive && item.pillar === "aman" && "text-pilar-aman",
                  )}
                  aria-hidden
                />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <Separator className="bg-sidebar-border" />

      {/* ---- Ringkasan singkat di bawah ---- */}
      <div className="p-3">
        {collapsed ? (
          <div
            className="flex justify-center py-2"
            title={`PM2.5 rata-rata ${formatDecimal(avgPm25)} µg/m³ (${kategori})`}
          >
            <span
              aria-hidden
              className={cn(
                "size-2.5 rounded-full",
                kategori === "Baik" && "bg-cond-good",
                kategori === "Sedang" && "bg-cond-warn",
                kategori === "Tidak Sehat" && "bg-cond-bad",
                kategori === "Sangat Tidak Sehat" && "bg-cond-critical",
              )}
            />
          </div>
        ) : (
          <div className="rounded-lg border border-sidebar-border bg-background/40 p-3">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Ringkasan data
            </p>
            <dl className="mt-2 space-y-1.5 text-xs">
              <div className="flex items-center justify-between gap-2">
                <dt className="text-muted-foreground">Periode</dt>
                <dd className="truncate font-medium">
                  {localizePeriodLabel(dataPeriod.start)} –{" "}
                  {localizePeriodLabel(dataPeriod.end)}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="text-muted-foreground">Zona terpantau</dt>
                <dd className="font-medium tabular">
                  {dashboardData.per_zone.length}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="text-muted-foreground">PM2.5 rata-rata</dt>
                <dd className="flex items-center gap-1.5 font-medium tabular">
                  <span
                    aria-hidden
                    className={cn(
                      "size-2 rounded-full",
                      kategori === "Baik" && "bg-cond-good",
                      kategori === "Sedang" && "bg-cond-warn",
                      kategori === "Tidak Sehat" && "bg-cond-bad",
                      kategori === "Sangat Tidak Sehat" && "bg-cond-critical",
                    )}
                  />
                  {formatDecimal(avgPm25)}
                </dd>
              </div>
            </dl>
          </div>
        )}

        {/* Tombol collapse hanya relevan di layar besar */}
        {onToggleCollapse ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggleCollapse}
            className={cn(
              "mt-2 w-full justify-start gap-2 text-muted-foreground",
              collapsed && "justify-center px-0",
            )}
            aria-label={collapsed ? "Perluas sidebar" : "Ringkas sidebar"}
          >
            {collapsed ? (
              <ChevronsRight className="size-4" aria-hidden />
            ) : (
              <>
                <ChevronsLeft className="size-4" aria-hidden />
                <span>Ringkas</span>
              </>
            )}
          </Button>
        ) : null}
      </div>
    </div>
  )
}
