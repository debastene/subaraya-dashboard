import * as React from "react"
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Search,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  PM25_CATEGORY_CLASS,
  ZONE_STATUS_CLASS,
  pm25Category,
  zoneStatus,
} from "@/lib/colors"
import { formatDecimal, formatInt } from "@/lib/format"
import { cn } from "@/lib/utils"
import type { ZoneStat } from "@/types"

type SortKey = "zone" | "name" | "speed" | "vol" | "pm25" | "acc" | "cas"
type SortDir = "asc" | "desc"

interface Column {
  key: SortKey
  label: string
  /** Rata kanan untuk kolom angka. */
  numeric?: boolean
  /** Satuan yang ditulis pada header. */
  unit?: string
}

const COLUMNS: Column[] = [
  { key: "zone", label: "Kode" },
  { key: "name", label: "Zona" },
  { key: "speed", label: "Kecepatan", numeric: true, unit: "km/j" },
  { key: "vol", label: "Volume", numeric: true, unit: "kend./jam" },
  { key: "pm25", label: "PM2.5", numeric: true, unit: "µg/m³" },
  { key: "acc", label: "Kecelakaan", numeric: true },
  { key: "cas", label: "Korban", numeric: true },
]

const PAGE_SIZES = [5, 10, 25]

interface DataTableProps {
  rows: ZoneStat[]
  /** Zona yang sedang aktif pada filter global — barisnya disorot. */
  highlightZone?: string
  className?: string
}

/**
 * Tabel ringkasan per zona: bisa dicari, diurutkan, dan dipaginasi.
 * Status diambil dari ambang PM2.5 (lihat `zoneStatus` di src/lib/colors.ts).
 */
export function DataTable({ rows, highlightZone, className }: DataTableProps) {
  const [query, setQuery] = React.useState("")
  const [sortKey, setSortKey] = React.useState<SortKey>("pm25")
  const [sortDir, setSortDir] = React.useState<SortDir>("desc")
  const [pageSize, setPageSize] = React.useState(PAGE_SIZES[0])
  const [page, setPage] = React.useState(0)

  // --- Saring berdasarkan kata kunci ---
  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return rows
    return rows.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.zone.toLowerCase().includes(q) ||
        zoneStatus(r.pm25).toLowerCase().includes(q) ||
        pm25Category(r.pm25).toLowerCase().includes(q),
    )
  }, [rows, query])

  // --- Urutkan ---
  const sorted = React.useMemo(() => {
    const copy = [...filtered]
    copy.sort((a, b) => {
      const av = a[sortKey]
      const bv = b[sortKey]
      const cmp =
        typeof av === "number" && typeof bv === "number"
          ? av - bv
          : String(av).localeCompare(String(bv), "id-ID")
      return sortDir === "asc" ? cmp : -cmp
    })
    return copy
  }, [filtered, sortKey, sortDir])

  // --- Paginasi ---
  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize))
  const currentPage = Math.min(page, pageCount - 1)
  const start = currentPage * pageSize
  const pageRows = sorted.slice(start, start + pageSize)

  // Kembali ke halaman pertama saat filter/urutan berubah.
  React.useEffect(() => {
    setPage(0)
  }, [query, sortKey, sortDir, pageSize])

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    } else {
      setSortKey(key)
      // Kolom angka lebih enak dibaca dari besar ke kecil.
      setSortDir(COLUMNS.find((col) => col.key === key)?.numeric ? "desc" : "asc")
    }
  }

  return (
    <div className={cn("space-y-4", className)}>
      {/* ---- Baris kontrol ---- */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-full max-w-xs">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari zona atau status…"
            aria-label="Cari di dalam tabel"
            className="pl-8"
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Baris per halaman</span>
          <Select
            value={String(pageSize)}
            onValueChange={(v) => setPageSize(Number(v))}
          >
            <SelectTrigger className="h-8 w-[72px]" aria-label="Baris per halaman">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAGE_SIZES.map((size) => (
                <SelectItem key={size} value={String(size)}>
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* ---- Tabel ---- */}
      <div className="rounded-xl border border-border">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              {COLUMNS.map((col) => {
                const isSorted = sortKey === col.key
                const SortIcon = !isSorted
                  ? ArrowUpDown
                  : sortDir === "asc"
                    ? ArrowUp
                    : ArrowDown
                return (
                  <TableHead
                    key={col.key}
                    aria-sort={
                      isSorted
                        ? sortDir === "asc"
                          ? "ascending"
                          : "descending"
                        : "none"
                    }
                    className={col.numeric ? "text-right" : undefined}
                  >
                    <button
                      type="button"
                      onClick={() => toggleSort(col.key)}
                      className={cn(
                        "inline-flex items-center gap-1 rounded transition-colors hover:text-foreground",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        isSorted && "text-foreground",
                        col.numeric && "flex-row-reverse",
                      )}
                    >
                      <SortIcon className="size-3.5 shrink-0" aria-hidden />
                      <span>
                        {col.label}
                        {col.unit ? (
                          <span className="ml-1 font-normal opacity-70">
                            ({col.unit})
                          </span>
                        ) : null}
                      </span>
                    </button>
                  </TableHead>
                )
              })}
              <TableHead className="text-right">Status</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {pageRows.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell
                  colSpan={COLUMNS.length + 1}
                  className="py-10 text-center text-sm text-muted-foreground"
                >
                  Tidak ada zona yang cocok dengan pencarian.
                </TableCell>
              </TableRow>
            ) : (
              pageRows.map((row) => {
                const status = zoneStatus(row.pm25)
                const kategori = pm25Category(row.pm25)
                return (
                  <TableRow
                    key={row.zone}
                    data-state={
                      highlightZone === row.zone ? "selected" : undefined
                    }
                  >
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {row.zone}
                    </TableCell>
                    <TableCell className="font-medium">{row.name}</TableCell>
                    <TableCell className="tabular text-right">
                      {formatDecimal(row.speed)}
                    </TableCell>
                    <TableCell className="tabular text-right">
                      {formatInt(row.vol)}
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="tabular">{formatDecimal(row.pm25)}</span>
                      <Badge
                        className={cn("ml-2", PM25_CATEGORY_CLASS[kategori])}
                      >
                        {kategori}
                      </Badge>
                    </TableCell>
                    <TableCell className="tabular text-right">
                      {formatInt(row.acc)}
                    </TableCell>
                    <TableCell className="tabular text-right">
                      {formatInt(row.cas)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge className={ZONE_STATUS_CLASS[status]}>
                        {status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* ---- Paginasi ---- */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          Menampilkan{" "}
          <span className="tabular font-medium text-foreground">
            {sorted.length === 0 ? 0 : start + 1}–
            {Math.min(start + pageSize, sorted.length)}
          </span>{" "}
          dari <span className="tabular font-medium text-foreground">{sorted.length}</span>{" "}
          zona
        </p>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={currentPage === 0}
          >
            <ChevronLeft className="size-4" aria-hidden />
            Sebelumnya
          </Button>
          <span className="text-xs text-muted-foreground tabular">
            {currentPage + 1} / {pageCount}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
            disabled={currentPage >= pageCount - 1}
          >
            Berikutnya
            <ChevronRight className="size-4" aria-hidden />
          </Button>
        </div>
      </div>
    </div>
  )
}
