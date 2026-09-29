import React from "react"
import ReactDOM from "react-dom/client"
import { BrowserRouter } from "react-router-dom"

// CSS Leaflet dimuat lebih dulu supaya penyesuaian tema di index.css menang.
import "leaflet/dist/leaflet.css"
import "./index.css"

import App from "./App"
import { FiltersProvider } from "./store/filters"
import { ThemeProvider } from "./store/theme"

const rootElement = document.getElementById("root")
if (!rootElement) {
  throw new Error("Elemen #root tidak ditemukan di index.html")
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <ThemeProvider>
      <FiltersProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </FiltersProvider>
    </ThemeProvider>
  </React.StrictMode>,
)
