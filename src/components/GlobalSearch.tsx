import * as React from "react"
import { useNavigate } from "react-router-dom"
import { MapPinned, Search } from "lucide-react"

import { Input } from "@/components/ui/input"
import { zoneOptions } from "@/data"
import { NAV_ITEMS } from "@/lib/nav"
import { useFilters } from "@/store/filters"
import { cn } from "@/lib/utils"

type Result =
  | { kind: "page"; id: string; label: string; hint: string; to: string }
  | { kind: "zone"; id: string; label: string; hint: string; zone: string }

/**
 * Pencarian cepat di top bar.
 * Mencari dua hal: halaman dashboard dan zona.
 * Memilih zona akan mengubah filter zona global (bukan pindah halaman).
 */
export function GlobalSearch({ className }: { className?: string }) {
  const navigate = useNavigate()
  const { setZone } = useFilters()
  const inputRef = React.useRef<HTMLInputElement>(null)
  const wrapRef = React.useRef<HTMLDivElement>(null)

  const [query, setQuery] = React.useState("")
  const [open, setOpen] = React.useState(false)
  const [activeIndex, setActiveIndex] = React.useState(0)

  const results = React.useMemo<Result[]>(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []

    const pages: Result[] = NAV_ITEMS.filter(
      (item) =>
        item.label.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q),
    ).map((item) => ({
      kind: "page",
      id: `page-${item.to}`,
      label: item.label,
      hint: item.description,
      to: item.to,
    }))

    const zones: Result[] = zoneOptions
      .filter(
        (z) =>
          z.name.toLowerCase().includes(q) || z.value.toLowerCase().includes(q),
      )
      .map((z) => ({
        kind: "zone",
        id: `zone-${z.value}`,
        label: z.name,
        hint: `Terapkan filter zona ${z.value}`,
        zone: z.value,
      }))

    return [...pages, ...zones].slice(0, 7)
  }, [query])

  React.useEffect(() => {
    setActiveIndex(0)
  }, [query])

  // Tutup daftar hasil saat klik di luar.
  React.useEffect(() => {
    if (!open) return
    const onPointerDown = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("pointerdown", onPointerDown)
    return () => document.removeEventListener("pointerdown", onPointerDown)
  }, [open])

  // Pintasan "/" untuk langsung fokus ke kolom pencarian.
  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "/" || e.ctrlKey || e.metaKey || e.altKey) return
      const target = e.target as HTMLElement | null
      const tag = target?.tagName
      if (tag === "INPUT" || tag === "TEXTAREA" || target?.isContentEditable) {
        return
      }
      e.preventDefault()
      inputRef.current?.focus()
    }
    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [])

  function choose(result: Result) {
    if (result.kind === "page") {
      navigate(result.to)
    } else {
      setZone(result.zone)
    }
    setQuery("")
    setOpen(false)
    inputRef.current?.blur()
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      setOpen(false)
      inputRef.current?.blur()
      return
    }
    if (results.length === 0) return
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setOpen(true)
      setActiveIndex((i) => (i + 1) % results.length)
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setOpen(true)
      setActiveIndex((i) => (i - 1 + results.length) % results.length)
    } else if (e.key === "Enter") {
      e.preventDefault()
      const chosen = results[activeIndex]
      if (chosen) choose(chosen)
    }
  }

  const listboxId = "global-search-results"
  const showList = open && query.trim().length > 0

  return (
    <div ref={wrapRef} className={cn("relative", className)}>
      <Search
        className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
      <Input
        ref={inputRef}
        type="search"
        role="combobox"
        aria-expanded={showList}
        aria-controls={showList ? listboxId : undefined}
        aria-autocomplete="list"
        aria-label="Cari halaman atau zona"
        placeholder="Cari halaman atau zona…"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        className="pl-8 pr-8"
      />
      {!query && (
        <kbd
          aria-hidden
          className="pointer-events-none absolute right-2 top-1/2 hidden -translate-y-1/2 rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground sm:block"
        >
          /
        </kbd>
      )}

      {showList ? (
        <ul
          id={listboxId}
          role="listbox"
          aria-label="Hasil pencarian"
          className="absolute left-0 right-0 top-full z-50 mt-1.5 max-h-80 overflow-y-auto scrollbar-slim rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-md"
        >
          {results.length === 0 ? (
            <li className="px-3 py-2 text-sm text-muted-foreground">
              Tidak ada hasil untuk “{query}”.
            </li>
          ) : (
            results.map((result, i) => {
              const Icon =
                result.kind === "page"
                  ? (NAV_ITEMS.find((n) => n.to === result.to)?.icon ?? Search)
                  : MapPinned
              return (
                <li key={result.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={i === activeIndex}
                    onMouseEnter={() => setActiveIndex(i)}
                    onClick={() => choose(result)}
                    className={cn(
                      "flex w-full items-start gap-2.5 rounded-md px-2.5 py-2 text-left text-sm transition-colors",
                      i === activeIndex
                        ? "bg-accent text-accent-foreground"
                        : "text-foreground",
                    )}
                  >
                    <Icon
                      className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                      aria-hidden
                    />
                    <span className="min-w-0">
                      <span className="block truncate font-medium">
                        {result.label}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {result.hint}
                      </span>
                    </span>
                  </button>
                </li>
              )
            })
          )}
        </ul>
      ) : null}
    </div>
  )
}
