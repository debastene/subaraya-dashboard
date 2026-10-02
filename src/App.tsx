import * as React from "react"
import { Link, Route, Routes } from "react-router-dom"
import { Loader2 } from "lucide-react"

import { AppLayout } from "@/components/layout/AppLayout"
import { Button } from "@/components/ui/button"
import Overview from "@/pages/Overview"

/**
 * Halaman selain Overview dimuat saat dibutuhkan (code splitting).
 * Ini menahan Leaflet & tabel agar tidak ikut di bundel awal.
 */
const Kemacetan = React.lazy(() => import("@/pages/Kemacetan"))
const Udara = React.lazy(() => import("@/pages/Udara"))
const Keselamatan = React.lazy(() => import("@/pages/Keselamatan"))
const Peta = React.lazy(() => import("@/pages/Peta"))
const Prediksi = React.lazy(() => import("@/pages/Prediksi"))
const DataPage = React.lazy(() => import("@/pages/DataPage"))

/** Tampilan sementara selagi berkas halaman diunduh. */
function PageLoading() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex min-h-[60vh] items-center justify-center gap-2 text-sm text-muted-foreground"
    >
      <Loader2 className="size-4 animate-spin" aria-hidden />
      Memuat halaman…
    </div>
  )
}

/** Halaman 404 sederhana. */
function NotFound() {
  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <p className="text-5xl font-bold tracking-tight">404</p>
      <h2 className="mt-3 text-lg font-semibold">Halaman tidak ditemukan</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Alamat yang kamu buka tidak tersedia di dashboard ini.
      </p>
      <Button asChild className="mt-6">
        <Link to="/">Kembali ke Overview</Link>
      </Button>
    </div>
  )
}

export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<Overview />} />
        <Route
          path="/kemacetan"
          element={
            <React.Suspense fallback={<PageLoading />}>
              <Kemacetan />
            </React.Suspense>
          }
        />
        <Route
          path="/udara"
          element={
            <React.Suspense fallback={<PageLoading />}>
              <Udara />
            </React.Suspense>
          }
        />
        <Route
          path="/keselamatan"
          element={
            <React.Suspense fallback={<PageLoading />}>
              <Keselamatan />
            </React.Suspense>
          }
        />
        <Route
          path="/prediksi"
          element={
            <React.Suspense fallback={<PageLoading />}>
              <Prediksi />
            </React.Suspense>
          }
        />
        <Route
          path="/peta"
          element={
            <React.Suspense fallback={<PageLoading />}>
              <Peta />
            </React.Suspense>
          }
        />
        <Route
          path="/data"
          element={
            <React.Suspense fallback={<PageLoading />}>
              <DataPage />
            </React.Suspense>
          }
        />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}
