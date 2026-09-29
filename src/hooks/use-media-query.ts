import * as React from "react"

/**
 * Pantau media query dari JavaScript.
 *
 * Dipakai di top bar supaya kolom pencarian & filter hanya dirender SEKALI
 * (kalau hanya disembunyikan dengan class CSS, komponennya tetap ada di DOM
 * dan pintasan keyboard bisa mengarah ke elemen yang tersembunyi).
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = React.useState(() => {
    if (typeof window === "undefined" || !window.matchMedia) return false
    return window.matchMedia(query).matches
  })

  React.useEffect(() => {
    if (!window.matchMedia) return
    const mq = window.matchMedia(query)
    setMatches(mq.matches)
    const onChange = (e: MediaQueryListEvent) => setMatches(e.matches)
    mq.addEventListener("change", onChange)
    return () => mq.removeEventListener("change", onChange)
  }, [query])

  return matches
}
