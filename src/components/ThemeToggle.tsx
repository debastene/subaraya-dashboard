import { Monitor, Moon, Sun } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useTheme, type ThemePreference } from "@/store/theme"

const OPTIONS: {
  value: ThemePreference
  label: string
  icon: typeof Sun
}[] = [
  { value: "light", label: "Terang", icon: Sun },
  { value: "dark", label: "Gelap", icon: Moon },
  { value: "system", label: "Ikuti sistem", icon: Monitor },
]

/**
 * Tombol tema. Ikonnya menunjukkan tema yang sedang aktif; menunya
 * memungkinkan kembali ke pengaturan perangkat.
 * Pilihan disimpan di localStorage oleh ThemeProvider.
 */
export function ThemeToggle() {
  const { theme, preference, setPreference } = useTheme()
  const isDark = theme === "dark"

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          aria-label={`Tema: ${
            OPTIONS.find((o) => o.value === preference)?.label ?? "Terang"
          }. Buka pilihan tema`}
          title="Ganti tema"
        >
          {isDark ? (
            <Sun className="size-4" aria-hidden />
          ) : (
            <Moon className="size-4" aria-hidden />
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="min-w-[11rem]">
        <DropdownMenuLabel>Tampilan</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={preference}
          onValueChange={(value) => setPreference(value as ThemePreference)}
        >
          {OPTIONS.map((option) => (
            <DropdownMenuRadioItem key={option.value} value={option.value}>
              <option.icon className="size-4" aria-hidden />
              {option.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
