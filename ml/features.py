"""
features.py - penyiapan data & transformer untuk model kecelakaan Subaraya.

Kenapa berkas ini ada
---------------------
Di notebook, langkah rekayasa fitur (menurunkan hour/day_of_week/... dari
kolom waktu) dikerjakan di luar Pipeline, lalu versi berikutnya membungkusnya
jadi kelas `AccidentFeatureEngineer` DI DALAM notebook. Itulah sumber masalah:
pickle hanya menyimpan NAMA kelas beserta modulnya. Kelas yang didefinisikan
di notebook tercatat sebagai `__main__.AccidentFeatureEngineer`, sehingga
berkas .joblib-nya selalu gagal dimuat di tempat lain:

    AttributeError: module '__main__' has no attribute 'AccidentFeatureEngineer'

Begitu kelasnya pindah ke berkas .py biasa seperti ini, modulnya tercatat
sebagai `features.AccidentFeatureEngineer` dan berkas model bisa dimuat
di mana saja selama berkas ini ikut dibawa.

Aturan mainnya cuma satu: JANGAN definisikan ulang kelas ini di notebook.
Cukup `from features import AccidentFeatureEngineer`.
"""

from __future__ import annotations

import numpy as np
import pandas as pd
from sklearn.base import BaseEstimator, TransformerMixin
from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import OneHotEncoder, StandardScaler

# Kolom mentah yang tidak dipakai sebagai fitur.
DROP_COLS = [
    "event_id",
    "ingested_at",
    "source_event_time",
    "zone_name",
    "latitude",
    "longitude",
]

# Kolom hitungan yang kosongnya berarti "tidak ada kejadian" -> diisi 0.
COUNT_COLS = [
    "accident_count",
    "fatal_count",
    "serious_count",
    "slight_count",
    "casualty_count",
    "vehicle_count",
]

CATEGORICAL = ["zone_id"]
BASE_NUMERIC = ["hour", "day_of_week", "day_of_month", "month", "is_weekend"]
CYCLIC_NUMERIC = [
    "hour_sin",
    "hour_cos",
    "month_sin",
    "month_cos",
    "day_of_week",
    "day_of_month",
    "is_weekend",
]


# ---------------------------------------------------------------------------
# Transformer
# ---------------------------------------------------------------------------

class AccidentFeatureEngineer(BaseEstimator, TransformerMixin):
    """
    Menurunkan fitur kalender dari kolom waktu.

    Masukan  : DataFrame berisi `zone_id` + kolom waktu (`event_hour`).
               Boleh juga sudah berisi kolom kalender jadi — kalau sudah ada,
               nilainya dipakai apa adanya.
    Keluaran : DataFrame berisi kolom fitur siap pakai untuk preprocessor.

    Parameter
    ---------
    cyclic_hour : bool
        False (bawaan) -> `hour` dan `month` dikirim sebagai angka biasa.
                          Ini meniru perilaku model yang sekarang.
        True           -> `hour` dan `month` di-encode siklik (sin/cos).

        Kenapa ini penting: `hour` sebagai satu angka linear membuat model
        linear (Poisson/Logistic) hanya sanggup menghasilkan kurva MONOTON
        sepanjang hari. Pukul 00 dan 23 bersebelahan di dunia nyata, tapi
        berjarak paling jauh menurut model. Encoding siklik menghapus
        masalah itu tanpa menambah banyak kolom.
    """

    def __init__(self, time_col: str = "event_hour", cyclic_hour: bool = False):
        self.time_col = time_col
        self.cyclic_hour = cyclic_hour

    # sklearn butuh get/set params otomatis -> sudah ditangani BaseEstimator
    def fit(self, X: pd.DataFrame, y=None):
        return self

    def transform(self, X: pd.DataFrame) -> pd.DataFrame:
        df = X.copy()

        # Dibaca lewat getattr dengan nilai bawaan, BUKAN self.x langsung.
        # Alasannya: berkas .joblib versi lama menyimpan objek ini dengan
        # __dict__ kosong, sehingga atribut dari __init__ tidak ada sama
        # sekali saat dimuat. Tanpa ini, model lama gagal dengan
        # "AttributeError: object has no attribute 'time_col'".
        time_col = getattr(self, "time_col", "event_hour")
        cyclic_hour = getattr(self, "cyclic_hour", False)

        if time_col in df.columns:
            ts = pd.to_datetime(df[time_col])
            df["hour"] = ts.dt.hour
            df["day_of_week"] = ts.dt.dayofweek
            df["day_of_month"] = ts.dt.day
            df["month"] = ts.dt.month

        missing = [c for c in ("hour", "day_of_week", "day_of_month", "month")
                   if c not in df.columns]
        if missing:
            raise ValueError(
                f"Kolom {missing} tidak ada, dan kolom waktu "
                f"'{time_col}' juga tidak ditemukan."
            )

        df["is_weekend"] = (df["day_of_week"] >= 5).astype(int)

        if cyclic_hour:
            df["hour_sin"] = np.sin(2 * np.pi * df["hour"] / 24)
            df["hour_cos"] = np.cos(2 * np.pi * df["hour"] / 24)
            df["month_sin"] = np.sin(2 * np.pi * (df["month"] - 1) / 12)
            df["month_cos"] = np.cos(2 * np.pi * (df["month"] - 1) / 12)
            return df[CATEGORICAL + CYCLIC_NUMERIC]

        return df[CATEGORICAL + BASE_NUMERIC]


def build_preprocessor(cyclic_hour: bool = False) -> ColumnTransformer:
    """
    Buat preprocessor BARU setiap kali dipanggil.

    Di notebook, satu objek `preprocessor` dipakai bersama oleh ketiga
    Pipeline. Pipeline sklearn tidak menyalin langkahnya saat fit, jadi
    ketiganya sebenarnya berbagi satu objek yang sama dan saling menimpa
    hasil fit. Kebetulan tidak berakibat karena ketiganya dilatih pada
    X_train yang sama — tapi itu jebakan yang menunggu. Pakai fungsi ini
    supaya tiap pipeline punya preprocessor sendiri.
    """
    numeric = CYCLIC_NUMERIC if cyclic_hour else BASE_NUMERIC
    return ColumnTransformer(
        transformers=[
            ("num", StandardScaler(), numeric),
            (
                "cat",
                OneHotEncoder(handle_unknown="ignore", sparse_output=False),
                CATEGORICAL,
            ),
        ]
    )


# ---------------------------------------------------------------------------
# Penyiapan dataset
# ---------------------------------------------------------------------------

def load_accident_data(
    fact_path: str,
    zone_path: str,
    time_col: str = "event_hour",
) -> pd.DataFrame:
    """
    Baca CSV mentah, lengkapi jam yang bolong, lalu bentuk kolom target.

    Logikanya sama persis dengan notebook, hanya dirapikan:
    - pembuatan grid jam dibuat tanpa perulangan manual
    - target dibentuk di satu tempat

    Target yang dihasilkan (semuanya untuk SATU JAM KE DEPAN):
      target_expected_accident   : jumlah kecelakaan     (regresi)
      target_accident_occurrence : ada kecelakaan? 0/1   (klasifikasi)
      target_severe_risk         : ada fatal/serious? 0/1 (klasifikasi)
    """
    dim_zone = pd.read_csv(zone_path)
    raw = pd.read_csv(fact_path)

    raw[time_col] = pd.to_datetime(raw[time_col])
    raw = raw.sort_values(["zone_id", time_col]).reset_index(drop=True)

    # --- Lengkapi jam yang tidak ada barisnya, per zona ---
    span = raw.groupby("zone_id")[time_col].agg(["min", "max"])
    grid = pd.concat(
        [
            pd.DataFrame(
                {time_col: pd.date_range(row["min"], row["max"], freq="h"),
                 "zone_id": zone}
            )
            for zone, row in span.iterrows()
        ],
        ignore_index=True,
    )

    df = grid.merge(raw, on=["zone_id", time_col], how="left",
                    suffixes=("", "_original"))
    present = [c for c in COUNT_COLS if c in df.columns]
    df[present] = df[present].fillna(0)

    # --- Gabung metadata zona, buang kolom yang tidak dipakai ---
    df = df.merge(dim_zone, on="zone_id")
    df = df.drop(columns=[c for c in DROP_COLS if c in df.columns])
    df = df.sort_values(["zone_id", time_col]).reset_index(drop=True)

    # --- Target: selalu satu jam SETELAH baris ini ---
    g = df.groupby("zone_id")
    df["target_expected_accident"] = g["accident_count"].shift(-1)
    df["target_accident_occurrence"] = (
        df["target_expected_accident"] > 0
    ).astype(int)

    df["severe_count"] = df["fatal_count"] + df["serious_count"]
    df["target_severe_count"] = df.groupby("zone_id")["severe_count"].shift(-1)
    df["target_severe_risk"] = (df["target_severe_count"] > 0).astype(int)

    # Jam yang diprediksi, dipakai untuk membagi data berdasarkan waktu.
    df["target_hour"] = df[time_col] + pd.Timedelta(hours=1)

    # Baris terakhir tiap zona tidak punya "jam berikutnya" -> dibuang.
    return df.dropna(subset=["target_expected_accident"]).reset_index(drop=True)


def time_split(
    df: pd.DataFrame,
    train_frac: float = 0.70,
    val_frac: float = 0.85,
) -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    """
    Bagi data menurut WAKTU, bukan acak.

    Ini wajib untuk peramalan: kalau dibagi acak, jam-jam masa depan ikut
    masuk data latih dan metriknya jadi terlalu bagus. Pembagian memakai
    `target_hour` supaya tidak ada jam target yang muncul di dua bagian.
    """
    hours = np.sort(df["target_hour"].unique())
    n = len(hours)
    train_cutoff = hours[int(n * train_frac)]
    val_cutoff = hours[int(n * val_frac)]

    train = df[df["target_hour"] <= train_cutoff].copy()
    val = df[(df["target_hour"] > train_cutoff) &
             (df["target_hour"] <= val_cutoff)].copy()
    test = df[df["target_hour"] > val_cutoff].copy()
    return train, val, test
