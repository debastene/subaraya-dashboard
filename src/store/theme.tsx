import * as React from "react"

/** Tema yang benar-benar dipakai untuk menggambar halaman. */
export type Theme = "light" | "dark"

/** Pilihan pengguna — "system" berarti ikut pengaturan perangkat. */
export type ThemePreference = Theme | "system"

const STORAGE_KEY = "subaraya-theme"

interface ThemeContextValue {
  /** Tema yang sedang aktif (sudah diselesaikan dari preferensi). */
  theme: Theme
  /** Pilihan pengguna: terang / gelap / ikut sistem. */
  preference: ThemePreference
  setPreference: (preference: ThemePreference) => void
  /** Bergantian terang <-> gelap (mengunci pilihan, tidak lagi "system"). */
  toggleTheme: () => void
}

const ThemeContext = React.createContext<ThemeContextValue | null>(null)

/** Baca preferensi tersimpan. Dibungkus try/catch karena localStorage bisa diblokir. */
function readStoredPreference(): ThemePreference {
  try {
    const value = localStorage.getItem(STORAGE_KEY)
    if (value === "light" || value === "dark" || value === "system") return value
  } catch {
    /* mode privat / storage diblokir — pakai default di bawah */
  }
  return "system"
}

function systemTheme(): Theme {
  if (typeof window === "undefined" || !window.matchMedia) return "dark"
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light"
}

function savePreference(preference: ThemePreference) {
  try {
    localStorage.setItem(STORAGE_KEY, preference)
  } catch {
    /* abaikan — tema tetap berlaku untuk sesi ini */
  }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [preference, setPreferenceState] =
    React.useState<ThemePreference>(readStoredPreference)
  const [system, setSystem] = React.useState<Theme>(systemTheme)

  // Ikuti perubahan tema perangkat (dipakai saat preferensi = "system").
  React.useEffect(() => {
    if (!window.matchMedia) return
    const mq = window.matchMedia("(prefers-color-scheme: dark)")
    const onChange = (e: MediaQueryListEvent) =>
      setSystem(e.matches ? "dark" : "light")
    mq.addEventListener("change", onChange)
    return () => mq.removeEventListener("change", onChange)
  }, [])

  const theme: Theme = preference === "system" ? system : preference

  // Terapkan class `.dark` pada <html> setiap kali tema aktif berubah.
  React.useEffect(() => {
    const root = document.documentElement
    root.classList.toggle("dark", theme === "dark")
    root.style.colorScheme = theme
  }, [theme])

  const setPreference = React.useCallback((next: ThemePreference) => {
    setPreferenceState(next)
    savePreference(next)
  }, [])

  const toggleTheme = React.useCallback(() => {
    const next: Theme = theme === "dark" ? "light" : "dark"
    setPreferenceState(next)
    savePreference(next)
  }, [theme])

  const value = React.useMemo(
    () => ({ theme, preference, setPreference, toggleTheme }),
    [theme, preference, setPreference, toggleTheme],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const ctx = React.useContext(ThemeContext)
  if (!ctx) throw new Error("useTheme harus dipakai di dalam <ThemeProvider>")
  return ctx
}
