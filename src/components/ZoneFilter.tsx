import { CalendarRange, MapPinned, RotateCcw } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { zoneOptions } from "@/data"
import { RANGE_OPTIONS, rangeLabel, useFilters } from "@/store/filters"
import type { RangeKey, ZoneFilterValue } from "@/types"
import { cn } from "@/lib/utils"

/**
 * Filter global: zona + rentang waktu.
 * Nilainya disimpan di FiltersProvider dan dipakai oleh seluruh halaman.
 */
export function ZoneFilter({ className }: { className?: string }) {
  const { zone, range, setZone, setRange, resetFilters, isFiltered } =
    useFilters()

  // Di dalam tombol hanya nama zona yang ditampilkan supaya tidak terpotong;
  // kode zona tetap terlihat pada daftar pilihan.
  const zoneText =
    zone === "all"
      ? "Semua zona"
      : (zoneOptions.find((z) => z.value === zone)?.name ?? zone)

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {/* --- Pilih zona --- */}
      <Select
        value={zone}
        onValueChange={(value) => setZone(value as ZoneFilterValue)}
      >
        <SelectTrigger
          className="h-9 min-w-0 flex-1 gap-2 sm:w-[184px] sm:flex-none"
          aria-label="Filter zona"
        >
          <MapPinned
            className="size-4 shrink-0 text-muted-foreground"
            aria-hidden
          />
          <SelectValue placeholder="Semua zona">{zoneText}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Semua zona</SelectItem>
          {zoneOptions.map((z) => (
            <SelectItem key={z.value} value={z.value}>
              {z.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* --- Pilih rentang waktu --- */}
      <Select value={range} onValueChange={(value) => setRange(value as RangeKey)}>
        <SelectTrigger
          className="h-9 min-w-0 flex-1 gap-2 sm:w-[190px] sm:flex-none"
          aria-label="Filter rentang waktu"
        >
          <CalendarRange
            className="size-4 shrink-0 text-muted-foreground"
            aria-hidden
          />
          <SelectValue placeholder="Seluruh periode">
            {rangeLabel(range)}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {RANGE_OPTIONS.map((r) => (
            <SelectItem key={r.value} value={r.value}>
              {r.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Tombol reset hanya muncul saat ada filter aktif */}
      {isFiltered ? (
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0"
          onClick={resetFilters}
          aria-label="Atur ulang filter"
          title="Atur ulang filter"
        >
          <RotateCcw className="size-4" aria-hidden />
        </Button>
      ) : null}
    </div>
  )
}
