#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
aggregate.py — mengubah CSV mentah menjadi src/data/dashboard.json.

Masukan
-------
1. mart_hourly.csv : satu baris per (zona, jam). Hasil ekspor dari PostgreSQL.
2. dim_zone.csv    : metadata zona (nama, koordinat, kapasitas, batas kecepatan).

Keluaran
--------
src/data/dashboard.json — sesuai kontrak di src/types.ts.

Cara pakai
----------
    python scripts/aggregate.py
    python scripts/aggregate.py --hourly data/mart_hourly.csv --zones data/dim_zone.csv
    python scripts/aggregate.py --sep ";" --encoding utf-8-sig

Aturan agregasi
---------------
* Rata-rata (kecepatan, volume, PM2.5) MENGABAIKAN nilai kosong — banyak baris
  lalu lintas bernilai NULL, dan pandas .mean() memang melewatkan NaN.
* Penjumlahan (kecelakaan, korban) memperlakukan NULL sebagai 0.
* pm25_by_month dikelompokkan per YYYY-MM.
* Ketiga domain (lalu lintas, udara, kecelakaan) dihitung SENDIRI-SENDIRI.
  Skrip ini sengaja tidak pernah menggabungkan satu domain ke domain lain.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

try:
    import pandas as pd
except ImportError:  # pragma: no cover
    sys.exit(
        "pandas belum terpasang.\n"
        "Jalankan:  pip install pandas\n"
    )


# ---------------------------------------------------------------------------
# Konfigurasi
# ---------------------------------------------------------------------------

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_HOURLY = ROOT / "data_raw" / "mart_hourly.csv"
DEFAULT_ZONES = ROOT / "data_raw" / "dim_zone.csv"
DEFAULT_OUT = ROOT / "src" / "data" / "dashboard.json"

# Ambang kategori PM2.5 (µg/m³) — HARUS sama dengan PM25_THRESHOLDS
# di src/lib/colors.ts.
PM25_BAIK = 15
PM25_SEDANG = 55
PM25_TIDAK_SEHAT = 150

PM25_CATEGORIES = ["Baik", "Sedang", "Tidak Sehat", "Sangat Tidak Sehat"]
CONGESTION_LEVELS = ["LOW", "MEDIUM", "HIGH"]

# Ambang untuk MENURUNKAN tingkat kepadatan dari rasio volume/kapasitas,
# hanya dipakai bila kolom congestion_level tidak ada di CSV.
DERIVE_MEDIUM_RATIO = 0.50
DERIVE_HIGH_RATIO = 0.80

# Nama kolom yang diterima (huruf kecil, tanpa spasi). Kolom pertama yang
# ketemu dipakai. Tambahkan nama baru di sini bila skema CSV-mu berbeda.
HOURLY_ALIASES: dict[str, list[str]] = {
    "ts": ["ts", "hour_ts", "datetime", "date_time", "timestamp", "waktu", "jam_ts"],
    "zone": ["zone_id", "zone", "zone_code", "kode_zona", "id_zona"],
    "speed": ["speed_kmh", "avg_speed", "speed", "kecepatan", "kecepatan_kmj"],
    "vol": ["volume", "vol", "vehicle_count", "volume_kendaraan", "jumlah_kendaraan"],
    "congestion": ["congestion_level", "congestion", "level", "tingkat_kepadatan"],
    "pm25": ["pm25", "pm2_5", "pm25_ugm3", "pm2_5_ugm3", "pm25_value"],
    "acc": ["accidents", "acc", "accident_count", "jumlah_kecelakaan", "kecelakaan"],
    "cas": ["casualties", "cas", "casualty_count", "jumlah_korban", "korban"],
}

ZONE_ALIASES: dict[str, list[str]] = {
    "zone": ["zone_id", "zone", "zone_code", "kode_zona", "id_zona"],
    "name": ["zone_name", "name", "nama_zona", "nama"],
    "lat": ["lat", "latitude", "lintang"],
    "lng": ["lng", "lon", "long", "longitude", "bujur"],
    "cap": ["capacity", "cap", "kapasitas", "kapasitas_ruas"],
    "limit": ["speed_limit", "limit", "batas_kecepatan", "max_speed"],
}

# Kolom yang WAJIB ada.
REQUIRED_HOURLY = ["ts", "zone"]
REQUIRED_ZONE = ["zone"]

NAMA_BULAN_EN = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
]


# ---------------------------------------------------------------------------
# Utilitas
# ---------------------------------------------------------------------------

def log(message: str) -> None:
    print(f"  {message}")


def warn(message: str) -> None:
    print(f"  ! {message}", file=sys.stderr)


def normalize(name: str) -> str:
    return str(name).strip().lower().replace(" ", "_").replace("-", "_")


def resolve_columns(
    df: pd.DataFrame,
    aliases: dict[str, list[str]],
    required: list[str],
    label: str,
) -> dict[str, str]:
    """Petakan nama kolom asli ke nama kanonik yang dipakai skrip ini."""
    lookup = {normalize(c): c for c in df.columns}
    mapping: dict[str, str] = {}

    for canonical, candidates in aliases.items():
        for candidate in candidates:
            if candidate in lookup:
                mapping[canonical] = lookup[candidate]
                break

    missing = [c for c in required if c not in mapping]
    if missing:
        sys.exit(
            f"\nKolom wajib tidak ditemukan di {label}: {', '.join(missing)}\n"
            f"Kolom yang tersedia: {', '.join(map(str, df.columns))}\n"
            f"Tambahkan nama kolommu ke {label.upper()}_ALIASES di scripts/aggregate.py."
        )

    absent = sorted(set(aliases) - set(mapping))
    if absent:
        warn(f"{label}: kolom tidak ada, dilewati -> {', '.join(absent)}")

    return mapping


def r1(value) -> float:
    """Bulatkan ke 1 desimal, aman untuk NaN."""
    if value is None or pd.isna(value):
        return 0.0
    return round(float(value), 1)


def as_int(value) -> int:
    if value is None or pd.isna(value):
        return 0
    return int(round(float(value)))


def pm25_category(value: float) -> str:
    if value <= PM25_BAIK:
        return "Baik"
    if value <= PM25_SEDANG:
        return "Sedang"
    if value <= PM25_TIDAK_SEHAT:
        return "Tidak Sehat"
    return "Sangat Tidak Sehat"


def month_label(period) -> str:
    """Timestamp/Period -> 'YYYY-MM'."""
    return f"{period.year:04d}-{period.month:02d}"


def period_text(ts: pd.Timestamp) -> str:
    """Timestamp -> 'Dec 2021' (format label yang dipakai di kpi.date_*)."""
    return f"{NAMA_BULAN_EN[ts.month - 1]} {ts.year}"


# ---------------------------------------------------------------------------
# Pemuatan data
# ---------------------------------------------------------------------------

def load_csv(path: Path, sep: str | None, encoding: str, label: str) -> pd.DataFrame:
    if not path.exists():
        sys.exit(
            f"\nBerkas {label} tidak ditemukan: {path}\n"
            f"Tentukan lokasinya dengan --{label} <path>."
        )
    # sep=None + engine="python" membuat pandas menebak pemisah (koma / titik koma).
    df = pd.read_csv(
        path,
        sep=sep if sep else None,
        engine="python" if not sep else "c",
        encoding=encoding,
    )
    log(f"{label}: {len(df):,} baris, {len(df.columns)} kolom dari {path.name}")
    return df


def prepare_hourly(df: pd.DataFrame, derive_congestion: bool) -> tuple[pd.DataFrame, list[str]]:
    """Ubah nama kolom, parse waktu, dan siapkan kolom bantu."""
    notes: list[str] = []
    cols = resolve_columns(df, HOURLY_ALIASES, REQUIRED_HOURLY, "hourly")

    out = pd.DataFrame()
    out["zone"] = df[cols["zone"]].astype(str).str.strip()
    out["ts"] = pd.to_datetime(df[cols["ts"]], errors="coerce")

    bad_ts = int(out["ts"].isna().sum())
    if bad_ts:
        warn(f"{bad_ts:,} baris dibuang karena kolom waktu tidak bisa dibaca.")
        out = out[out["ts"].notna()]
        df = df.loc[out.index]

    # Kolom numerik — nilai kosong dibiarkan NaN supaya diabaikan saat rata-rata.
    for key in ("speed", "vol", "pm25", "acc", "cas"):
        if key in cols:
            out[key] = pd.to_numeric(df[cols[key]], errors="coerce")
        else:
            out[key] = pd.NA

    # Tingkat kepadatan.
    if "congestion" in cols:
        level = df[cols["congestion"]].astype(str).str.strip().str.upper()
        out["congestion"] = level.where(level.isin(CONGESTION_LEVELS))
    elif derive_congestion:
        out["congestion"] = pd.NA
        notes.append("congestion_level diturunkan dari rasio volume/kapasitas")
    else:
        out["congestion"] = pd.NA
        warn("Kolom congestion_level tidak ada — distribusi kepadatan akan kosong.")

    out["hour"] = out["ts"].dt.hour
    out["month"] = out["ts"].dt.to_period("M")
    return out.reset_index(drop=True), notes


def prepare_zones(df: pd.DataFrame) -> pd.DataFrame:
    cols = resolve_columns(df, ZONE_ALIASES, REQUIRED_ZONE, "zone")

    out = pd.DataFrame()
    out["zone"] = df[cols["zone"]].astype(str).str.strip()
    out["name"] = (
        df[cols["name"]].astype(str).str.strip() if "name" in cols else out["zone"]
    )
    for key, default in (("lat", 0.0), ("lng", 0.0), ("cap", 0), ("limit", 0)):
        out[key] = (
            pd.to_numeric(df[cols[key]], errors="coerce").fillna(default)
            if key in cols
            else default
        )
    return out.drop_duplicates(subset="zone").reset_index(drop=True)


def derive_congestion_levels(hourly: pd.DataFrame, zones: pd.DataFrame) -> pd.DataFrame:
    """
    Turunkan LOW/MEDIUM/HIGH dari rasio volume terhadap kapasitas ruas.
    Hanya dipakai bila CSV tidak punya kolom congestion_level.
    """
    cap = zones.set_index("zone")["cap"]
    capacity = hourly["zone"].map(cap)
    ratio = pd.to_numeric(hourly["vol"], errors="coerce") / capacity.replace(0, pd.NA)

    level = pd.Series(pd.NA, index=hourly.index, dtype="object")
    level[ratio.notna() & (ratio < DERIVE_MEDIUM_RATIO)] = "LOW"
    level[ratio.notna() & (ratio >= DERIVE_MEDIUM_RATIO) & (ratio < DERIVE_HIGH_RATIO)] = "MEDIUM"
    level[ratio.notna() & (ratio >= DERIVE_HIGH_RATIO)] = "HIGH"

    hourly = hourly.copy()
    hourly["congestion"] = level
    return hourly


# ---------------------------------------------------------------------------
# Agregasi
# ---------------------------------------------------------------------------

def series_by_hour_mean(df: pd.DataFrame, column: str) -> list[float]:
    """Rata-rata per jam 0..23 (nilai kosong diabaikan)."""
    grouped = df.groupby("hour")[column].mean()
    grouped = grouped.reindex(range(24))
    if grouped.isna().any():
        fallback = df[column].mean()
        missing = [int(h) for h in grouped.index[grouped.isna()]]
        warn(
            f"Jam tanpa data untuk '{column}': {missing} — diisi dengan "
            f"rata-rata keseluruhan."
        )
        grouped = grouped.fillna(fallback)
    return [r1(v) for v in grouped]


def series_by_hour_sum(df: pd.DataFrame, column: str) -> list[int]:
    """Jumlah per jam 0..23 (kosong dianggap 0)."""
    grouped = df.groupby("hour")[column].sum(min_count=0)
    grouped = grouped.reindex(range(24)).fillna(0)
    return [as_int(v) for v in grouped]


def monthly_mean(df: pd.DataFrame, column: str, months: pd.PeriodIndex) -> dict:
    grouped = df.groupby("month")[column].mean().reindex(months)
    if grouped.isna().any():
        fallback = df[column].mean()
        grouped = grouped.fillna(fallback)
    return {
        "labels": [month_label(m) for m in months],
        "values": [r1(v) for v in grouped],
    }


def monthly_sum(df: pd.DataFrame, column: str, months: pd.PeriodIndex) -> dict:
    grouped = df.groupby("month")[column].sum(min_count=0).reindex(months).fillna(0)
    return {
        "labels": [month_label(m) for m in months],
        "values": [as_int(v) for v in grouped],
    }


def monthly_high_share(df: pd.DataFrame, months: pd.PeriodIndex) -> dict:
    """Persentase jam berstatus HIGH untuk tiap bulan."""
    known = df[df["congestion"].notna()]
    if known.empty:
        return {
            "labels": [month_label(m) for m in months],
            "values": [0.0 for _ in months],
        }
    total = known.groupby("month")["congestion"].size()
    high = known[known["congestion"] == "HIGH"].groupby("month")["congestion"].size()
    share = (high.reindex(total.index).fillna(0) / total * 100).reindex(months)
    return {
        "labels": [month_label(m) for m in months],
        "values": [r1(v) for v in share.fillna(0)],
    }


def congestion_counts(df: pd.DataFrame) -> dict[str, int]:
    counts = df["congestion"].value_counts()
    return {level: as_int(counts.get(level, 0)) for level in CONGESTION_LEVELS}


def pm25_category_counts(df: pd.DataFrame) -> dict[str, int]:
    values = pd.to_numeric(df["pm25"], errors="coerce").dropna()
    if values.empty:
        return {cat: 0 for cat in PM25_CATEGORIES}
    cats = values.map(pm25_category)
    counts = cats.value_counts()
    return {cat: as_int(counts.get(cat, 0)) for cat in PM25_CATEGORIES}


def build_breakdown(df: pd.DataFrame, months: pd.PeriodIndex) -> dict:
    """Semua seri untuk SATU zona (dipakai untuk filter zona di dashboard)."""
    return {
        "congestion": congestion_counts(df),
        "pm25_cat": pm25_category_counts(df),
        "speed_by_hour": series_by_hour_mean(df, "speed"),
        "vol_by_hour": [as_int(v) for v in series_by_hour_mean(df, "vol")],
        "acc_by_hour": series_by_hour_sum(df, "acc"),
        "pm25_by_month": monthly_mean(df, "pm25", months),
        "speed_by_month": monthly_mean(df, "speed", months),
        "acc_by_month": monthly_sum(df, "acc", months),
        "cas_by_month": monthly_sum(df, "cas", months),
        "high_share_by_month": monthly_high_share(df, months),
    }


def build_dashboard(
    hourly: pd.DataFrame,
    zones: pd.DataFrame,
    notes: list[str],
) -> dict:
    months = pd.period_range(hourly["month"].min(), hourly["month"].max(), freq="M")
    log(f"Periode: {month_label(months[0])} s/d {month_label(months[-1])} ({len(months)} bulan)")

    # --- Ringkasan per zona (tiga domain dihitung terpisah) ----------------
    grouped = hourly.groupby("zone")
    per_zone_raw = grouped.agg(
        speed=("speed", "mean"),
        vol=("vol", "mean"),
        pm25=("pm25", "mean"),
        acc=("acc", "sum"),
        cas=("cas", "sum"),
    )

    zone_names = zones.set_index("zone")["name"].to_dict()
    per_zone = []
    for code, row in per_zone_raw.iterrows():
        per_zone.append(
            {
                "zone": code,
                "name": zone_names.get(code, code),
                "speed": r1(row["speed"]),
                "vol": as_int(row["vol"]),
                "pm25": r1(row["pm25"]),
                "acc": as_int(row["acc"]),
                "cas": as_int(row["cas"]),
            }
        )
    per_zone.sort(key=lambda z: z["zone"])

    missing_meta = [z["zone"] for z in per_zone if z["zone"] not in zone_names]
    if missing_meta:
        warn(f"Zona tanpa metadata di dim_zone: {', '.join(missing_meta)}")

    # --- KPI se-kota -------------------------------------------------------
    congestion = congestion_counts(hourly)
    total_congestion = sum(congestion.values())
    pct_high = (congestion["HIGH"] / total_congestion * 100) if total_congestion else 0.0

    kpi = {
        "avg_speed": r1(hourly["speed"].mean()),
        "avg_pm25": r1(hourly["pm25"].mean()),
        "total_accidents": as_int(hourly["acc"].sum()),
        "total_casualties": as_int(hourly["cas"].sum()),
        "pct_high": r1(pct_high),
        "date_start": period_text(hourly["ts"].min()),
        "date_end": period_text(hourly["ts"].max()),
    }

    # --- Metadata zona untuk peta -----------------------------------------
    per_zone_index = {z["zone"]: z for z in per_zone}
    zones_geo = []
    for _, row in zones.iterrows():
        stat = per_zone_index.get(row["zone"])
        if stat is None:
            warn(f"Zona {row['zone']} ada di dim_zone tapi tidak ada di data jam — dilewati.")
            continue
        zones_geo.append(
            {
                "zone": row["zone"],
                "name": row["name"],
                "lat": round(float(row["lat"]), 6),
                "lng": round(float(row["lng"]), 6),
                "cap": as_int(row["cap"]),
                "limit": as_int(row["limit"]),
                "pm25": stat["pm25"],
                "speed": stat["speed"],
                "acc": stat["acc"],
            }
        )
    zones_geo.sort(key=lambda z: z["zone"])

    # --- Rincian per zona (opsional, membuat filter zona lebih berguna) ----
    by_zone = {
        code: build_breakdown(part, months)
        for code, part in hourly.groupby("zone")
    }

    data = {
        "kpi": kpi,
        "congestion": congestion,
        "per_zone": per_zone,
        "speed_by_hour": series_by_hour_mean(hourly, "speed"),
        "acc_by_hour": series_by_hour_sum(hourly, "acc"),
        "pm25_by_month": monthly_mean(hourly, "pm25", months),
        "pm25_cat": pm25_category_counts(hourly),
        "zones": zones_geo,
        # --- bagian opsional ---
        "vol_by_hour": [as_int(v) for v in series_by_hour_mean(hourly, "vol")],
        "speed_by_month": monthly_mean(hourly, "speed", months),
        "acc_by_month": monthly_sum(hourly, "acc", months),
        "cas_by_month": monthly_sum(hourly, "cas", months),
        "high_share_by_month": monthly_high_share(hourly, months),
        "by_zone": dict(sorted(by_zone.items())),
        "meta": {
            "generated_at": pd.Timestamp.now("UTC").isoformat(),
            "source": "scripts/aggregate.py",
            "rows": int(len(hourly)),
            "note": "; ".join(notes)
            if notes
            else "Rata-rata mengabaikan nilai kosong; kecelakaan & korban dijumlahkan.",
        },
    }
    return data


# ---------------------------------------------------------------------------
# main
# ---------------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser(
        description="Hasilkan src/data/dashboard.json dari CSV mentah.",
    )
    parser.add_argument("--hourly", type=Path, default=DEFAULT_HOURLY,
                        help=f"Lokasi mart_hourly.csv (default: {DEFAULT_HOURLY})")
    parser.add_argument("--zones", type=Path, default=DEFAULT_ZONES,
                        help=f"Lokasi dim_zone.csv (default: {DEFAULT_ZONES})")
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT,
                        help=f"Berkas keluaran (default: {DEFAULT_OUT})")
    parser.add_argument("--sep", default=None,
                        help="Pemisah kolom CSV. Kosongkan agar dideteksi otomatis.")
    parser.add_argument("--encoding", default="utf-8-sig",
                        help="Encoding CSV (default: utf-8-sig).")
    parser.add_argument("--no-derive-congestion", action="store_true",
                        help="Jangan menurunkan tingkat kepadatan dari volume/kapasitas.")
    parser.add_argument("--indent", type=int, default=2,
                        help="Indentasi JSON; pakai 0 untuk berkas paling kecil.")
    args = parser.parse_args()

    print("\nSubaraya - agregasi data")
    print("=" * 46)

    zones_raw = load_csv(args.zones, args.sep, args.encoding, "zones")
    hourly_raw = load_csv(args.hourly, args.sep, args.encoding, "hourly")

    zones = prepare_zones(zones_raw)
    hourly, notes = prepare_hourly(hourly_raw, not args.no_derive_congestion)

    if hourly.empty:
        sys.exit("\nTidak ada baris yang bisa diolah dari mart_hourly.csv.")

    # Turunkan tingkat kepadatan bila memang belum ada.
    if hourly["congestion"].isna().all() and not args.no_derive_congestion:
        hourly = derive_congestion_levels(hourly, zones)
        if hourly["congestion"].notna().any():
            warn(
                "Tingkat kepadatan DITURUNKAN dari rasio volume/kapasitas "
                f"(<{DERIVE_MEDIUM_RATIO} LOW, <{DERIVE_HIGH_RATIO} MEDIUM, "
                "sisanya HIGH) karena kolom aslinya tidak ada."
            )

    unknown = sorted(set(hourly["zone"]) - set(zones["zone"]))
    if unknown:
        warn(f"Zona di data jam tanpa metadata: {', '.join(unknown)}")

    data = build_dashboard(hourly, zones, notes)

    args.out.parent.mkdir(parents=True, exist_ok=True)
    with args.out.open("w", encoding="utf-8") as fh:
        json.dump(data, fh, ensure_ascii=False, indent=args.indent or None)
        fh.write("\n")

    # --- Ringkasan di terminal --------------------------------------------
    kpi = data["kpi"]
    print("-" * 46)
    log(f"Kecepatan rata-rata : {kpi['avg_speed']} km/j")
    log(f"PM2.5 rata-rata     : {kpi['avg_pm25']} ug/m3")
    log(f"Total kecelakaan    : {kpi['total_accidents']:,}")
    log(f"Total korban        : {kpi['total_casualties']:,}")
    log(f"Waktu macet (HIGH)  : {kpi['pct_high']}%")
    log(f"Zona                : {len(data['per_zone'])}")
    print("-" * 46)
    size_kb = args.out.stat().st_size / 1024
    print(f"  Tersimpan: {args.out}  ({size_kb:,.0f} KB)\n")


if __name__ == "__main__":
    main()
