#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
predict.py - menjalankan model machine learning dari data scientist, lalu
menyimpan seluruh hasilnya sebagai src/data/predictions.json.

Kenapa dihitung di muka, bukan dipanggil saat halaman dibuka?
--------------------------------------------------------------
Ketiga model hanya memakai fitur kalender + kode zona:

    zone_id, hour, day_of_week, day_of_month, month, is_weekend

Tidak ada input sensor langsung. Artinya keluaran model sepenuhnya
deterministik dan ruang masukannya terbatas, jadi semua jawabannya bisa
dihitung sekali lalu disimpan sebagai tabel. Hasilnya: dashboard tetap
situs statis (tanpa server Python), ukuran ~1 MB alih-alih 473 MB, dan
tidak ada perbedaan angka sama sekali dibanding memanggil model langsung.

Cara pakai
----------
    python scripts/predict.py --models "C:/path/ke/folder/model"
    python scripts/predict.py --models ./models --days 400
    python scripts/predict.py --models ./models --start 2026-01-01

Berkas model yang dicari di dalam --models:
    expected_accident_pipeline.joblib      -> perkiraan JUMLAH kecelakaan
    accident_occurrence_pipeline.joblib    -> PELUANG ada kecelakaan
    severe_accident_risk_pipeline.joblib   -> PELUANG kecelakaan berat
"""

from __future__ import annotations

import argparse
import json
import sys
import warnings
from datetime import datetime, timezone
from pathlib import Path

warnings.filterwarnings("ignore")

try:
    import numpy as np
    import pandas as pd
    import joblib
    from sklearn.base import BaseEstimator, TransformerMixin
except ImportError as exc:  # pragma: no cover
    sys.exit(
        f"Library belum lengkap ({exc.name}).\n"
        "Jalankan:  pip install scikit-learn pandas joblib\n"
    )


ROOT = Path(__file__).resolve().parent.parent
DEFAULT_MODELS = ROOT / "models"
DEFAULT_OUT = ROOT / "src" / "data" / "predictions.json"

ZONES = ["Z01", "Z02", "Z03", "Z04"]

MODEL_FILES = {
    "expected": "expected_accident_pipeline.joblib",
    "occurrence": "accident_occurrence_pipeline.joblib",
    "severe": "severe_accident_risk_pipeline.joblib",
}


# ---------------------------------------------------------------------------
# Kelas yang HILANG dari berkas .joblib
# ---------------------------------------------------------------------------

class AccidentFeatureEngineer(BaseEstimator, TransformerMixin):
    """
    Rekonstruksi dari langkah `feature_engineering` milik pipeline DS.

    Berkas .joblib menyimpan NAMA kelas ini (`__main__.AccidentFeatureEngineer`)
    tetapi tidak menyimpan kodenya, sehingga pipeline tidak bisa dimuat tanpa
    definisi ini. Isi kelas disimpulkan dari dua bukti di dalam model sendiri:

    1. `ColumnTransformer.feature_names_in_` berisi tepat enam kolom:
       zone_id, hour, day_of_week, day_of_month, month, is_weekend
       -> itulah KELUARAN langkah ini. Tidak ada fitur lag/rolling.

    2. `StandardScaler` menyimpan mean & std data latih. Kesepuluh angka itu
       (5 mean + 5 std) cocok dengan kalender per jam biasa pada rentang
       1 Jan 2023 - 28 Jul 2025, dengan selisih terbesar 0,005.
       -> langkah ini murni menurunkan komponen tanggal dari sebuah timestamp.

    Kalau DS mengirimkan kelas aslinya, ganti isi file ini dengan versi mereka
    dan jalankan ulang skrip untuk memastikan angkanya sama.
    """

    def fit(self, X, y=None):
        return self

    def transform(self, X):
        df = X.copy()

        # Bila yang masuk masih berupa timestamp, turunkan dulu komponennya.
        ts_col = next(
            (c for c in ("ts", "timestamp", "datetime", "hour_ts") if c in df.columns),
            None,
        )
        if ts_col is not None:
            ts = pd.to_datetime(df[ts_col])
            df["hour"] = ts.dt.hour
            df["day_of_week"] = ts.dt.dayofweek
            df["day_of_month"] = ts.dt.day
            df["month"] = ts.dt.month
            df["is_weekend"] = (ts.dt.dayofweek >= 5).astype(int)

        return df[
            ["zone_id", "hour", "day_of_week", "day_of_month", "month", "is_weekend"]
        ]


# joblib mencari kelas ini di modul `__main__`. Didaftarkan secara eksplisit
# supaya skrip tetap jalan walau diimpor dari tempat lain.
sys.modules["__main__"].AccidentFeatureEngineer = AccidentFeatureEngineer  # type: ignore[attr-defined]


# ---------------------------------------------------------------------------
# Utilitas
# ---------------------------------------------------------------------------

def log(message: str) -> None:
    print(f"  {message}")


def warn(message: str) -> None:
    print(f"  ! {message}", file=sys.stderr)


def build_frame(index: pd.DatetimeIndex, zones: list[str]) -> pd.DataFrame:
    """Satu baris per (jam, zona), berisi keenam kolom yang diminta model."""
    n = len(index)
    hour = np.tile(index.hour.to_numpy(), len(zones))
    dow = np.tile(index.dayofweek.to_numpy(), len(zones))
    dom = np.tile(index.day.to_numpy(), len(zones))
    month = np.tile(index.month.to_numpy(), len(zones))
    return pd.DataFrame(
        {
            "zone_id": np.repeat(np.array(zones, dtype=object), n),
            "hour": hour,
            "day_of_week": dow,
            "day_of_month": dom,
            "month": month,
            "is_weekend": (dow >= 5).astype(int),
        }
    )


def load_models(folder: Path) -> dict:
    """Muat ketiga pipeline. Model yang tidak ada dilewati, bukan menggagalkan."""
    models: dict = {}
    for key, filename in MODEL_FILES.items():
        path = folder / filename
        if not path.exists():
            warn(f"{filename} tidak ditemukan - metrik '{key}' dilewati.")
            continue
        size_mb = path.stat().st_size / 1024 / 1024
        try:
            models[key] = joblib.load(path)
        except AttributeError as exc:
            sys.exit(
                f"\nGagal memuat {filename}: {exc}\n"
                "Pipeline memakai kelas custom yang belum dikenali. Tambahkan "
                "definisinya di scripts/predict.py (lihat AccidentFeatureEngineer)."
            )
        log(f"{key:11s} <- {filename}  ({size_mb:,.0f} MB)")
    if not models:
        sys.exit("\nTidak ada satu pun model yang bisa dimuat.")
    return models


# ---------------------------------------------------------------------------
# Diagnostik model
# ---------------------------------------------------------------------------

def run_diagnostics(models: dict) -> dict:
    """
    Memeriksa beberapa keterbatasan yang perlu diketahui pembaca dashboard.
    Hasilnya ikut disimpan ke JSON supaya halaman Prediksi bisa menampilkan
    catatan yang JUJUR - dan catatan itu hilang sendiri ketika modelnya
    diperbaiki. Tidak ada peringatan yang di-hardcode di sisi React.
    """
    diag: dict = {}
    probe = pd.DataFrame(
        [
            {
                "zone_id": z, "hour": h, "day_of_week": 2, "day_of_month": 15,
                "month": 6, "is_weekend": 0,
            }
            for z in ZONES
            for h in range(24)
        ]
    )

    if "expected" in models:
        lam = models["expected"].predict(probe)
        by_hour = lam[:24]  # zona pertama, 24 jam berurutan
        diff = np.diff(by_hour)
        # Kurva monoton = model tidak bisa menggambarkan dua puncak jam sibuk.
        diag["hour_monotonic"] = bool(np.all(diff <= 0) or np.all(diff >= 0))
        diag["hour_peak"] = int(np.argmax(by_hour))
        diag["hour_low"] = int(np.argmin(by_hour))

        # Seberapa besar pengaruh zona pada jam yang sama?
        same_hour = models["expected"].predict(
            pd.DataFrame(
                [
                    {"zone_id": z, "hour": 8, "day_of_week": 2, "day_of_month": 15,
                     "month": 6, "is_weekend": 0}
                    for z in ZONES
                ]
            )
        )
        spread = float((same_hour.max() - same_hour.min()) / same_hour.mean() * 100)
        diag["zone_spread_pct"] = round(spread, 2)

        # Kalau jumlah = lambda, peluang ada kejadian seharusnya 1 - exp(-lambda).
        if "occurrence" in models:
            p_occ = models["occurrence"].predict_proba(probe)[:, 1]
            p_implied = 1 - np.exp(-lam)
            corr = float(np.corrcoef(p_occ, p_implied)[0, 1])
            diag["consistency_corr"] = round(corr, 3)
            diag["consistency_mae"] = round(float(np.abs(p_occ - p_implied).mean()), 3)

    if "occurrence" in models:
        p = models["occurrence"].predict_proba(probe)[:, 1]
        diag["occurrence_saturated"] = bool((p > 0.99).mean() > 0.2)

    return diag


# ---------------------------------------------------------------------------
# main
# ---------------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser(
        description="Hitung prediksi model lalu simpan ke src/data/predictions.json",
    )
    parser.add_argument("--models", type=Path, default=DEFAULT_MODELS,
                        help=f"Folder berisi berkas .joblib (default: {DEFAULT_MODELS})")
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT,
                        help=f"Berkas keluaran (default: {DEFAULT_OUT})")
    parser.add_argument("--start", default=None,
                        help="Tanggal mulai YYYY-MM-DD (default: hari ini)")
    parser.add_argument("--days", type=int, default=240,
                        help="Berapa hari ke depan dihitung (default: 240)")
    parser.add_argument("--indent", type=int, default=0,
                        help="Indentasi JSON; 0 = sekecil mungkin (default)")
    args = parser.parse_args()

    print("\nSubaraya - prediksi kecelakaan")
    print("=" * 46)

    if not args.models.exists():
        sys.exit(
            f"\nFolder model tidak ditemukan: {args.models}\n"
            "Letakkan berkas .joblib di sana, atau tunjuk lokasinya dengan --models."
        )

    models = load_models(args.models)

    start = (
        pd.Timestamp(args.start).normalize()
        if args.start
        else pd.Timestamp.now().normalize()
    )
    index = pd.date_range(start, periods=args.days * 24, freq="h")
    log(f"rentang    : {index[0]:%Y-%m-%d %H:%M} s/d {index[-1]:%Y-%m-%d %H:%M}")
    log(f"jumlah     : {len(index):,} jam x {len(ZONES)} zona = {len(index)*len(ZONES):,} baris")

    frame = build_frame(index, ZONES)

    series: dict[str, dict[str, list]] = {z: {} for z in ZONES}
    n = len(index)

    for key, pipe in models.items():
        if key == "expected":
            # Pembulatan sengaja dibuat pas dengan kebutuhan tampilan
            # (1 desimal untuk jumlah, 1 desimal untuk persen) supaya
            # berkasnya tetap ringan tanpa mengubah angka yang terlihat.
            values = np.asarray(pipe.predict(frame), dtype=float)
            values = np.round(values, 2)
        else:
            values = np.asarray(pipe.predict_proba(frame)[:, 1], dtype=float)
            values = np.round(values, 3)
        # frame disusun zona-per-zona, jadi potongannya berurutan.
        for i, zone in enumerate(ZONES):
            series[zone][key] = values[i * n : (i + 1) * n].tolist()
        log(f"{key:11s} -> selesai (rentang {values.min():.3f} - {values.max():.3f})")

    diagnostics = run_diagnostics(models)

    payload = {
        "meta": {
            "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "start": index[0].isoformat(),
            "hours": n,
            "zones": ZONES,
            "models": {
                key: type(models[key].named_steps["model"]).__name__
                for key in models
            },
            "feature_engineer": "rekonstruksi (lihat scripts/predict.py)",
            "diagnostics": diagnostics,
        },
        "series": series,
    }

    args.out.parent.mkdir(parents=True, exist_ok=True)
    with args.out.open("w", encoding="utf-8") as fh:
        json.dump(payload, fh, ensure_ascii=False,
                  indent=args.indent or None, separators=(",", ":") if not args.indent else None)
        fh.write("\n")

    print("-" * 46)
    if diagnostics:
        log("diagnostik model:")
        for k, v in diagnostics.items():
            log(f"    {k:22s} {v}")
    size_kb = args.out.stat().st_size / 1024
    print("-" * 46)
    print(f"  Tersimpan: {args.out}  ({size_kb:,.0f} KB)\n")


if __name__ == "__main__":
    main()
