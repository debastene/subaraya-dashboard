"""
train.py - melatih & menyimpan ketiga model kecelakaan Subaraya.

Versi rapi dari Accident.ipynb. Yang berubah hanya strukturnya; pilihan
model, cara membagi data, dan metrik tetap sama seperti di notebook.

    python ml/train.py --data ../data
    python ml/train.py --data ../data --cyclic-hour
    python ml/train.py --data ../data --occurrence-model rf

Keluaran (di folder --out, bawaan: models/):
    expected_accident_pipeline.joblib
    accident_occurrence_pipeline.joblib
    severe_accident_risk_pipeline.joblib
    metrics.json

Tiga hal yang diperbaiki dibanding notebook
-------------------------------------------
1. SATU pipeline utuh per target. Masukannya baris mentah (`event_hour` +
   `zone_id`); rekayasa fitur ikut di dalam pipeline, jadi tidak perlu lagi
   menyiapkan kolom secara manual sebelum predict.
2. `AccidentFeatureEngineer` tinggal di ml/features.py, bukan di notebook.
   Ini yang membuat berkas .joblib bisa dimuat di komputer lain.
3. Tiap pipeline dapat preprocessor sendiri (lihat build_preprocessor),
   tidak lagi berbagi satu objek bertiga.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.dummy import DummyClassifier, DummyRegressor
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression, PoissonRegressor
from sklearn.metrics import (
    accuracy_score,
    average_precision_score,
    brier_score_loss,
    log_loss,
    mean_absolute_error,
    roc_auc_score,
    root_mean_squared_error,
)
from sklearn.pipeline import Pipeline

# features.py berada di folder yang sama dengan berkas ini.
sys.path.insert(0, str(Path(__file__).resolve().parent))
from features import (  # noqa: E402
    AccidentFeatureEngineer,
    build_preprocessor,
    load_accident_data,
    time_split,
)

# Kolom mentah yang masuk ke pipeline. Sisanya diurus AccidentFeatureEngineer.
RAW_INPUT_COLS = ["event_hour", "zone_id"]


def make_pipeline(estimator, cyclic_hour: bool) -> Pipeline:
    """Satu pipeline utuh: mentah -> fitur -> praproses -> model."""
    return Pipeline(
        [
            ("feature_engineering", AccidentFeatureEngineer(cyclic_hour=cyclic_hour)),
            ("preprocessor", build_preprocessor(cyclic_hour=cyclic_hour)),
            ("model", estimator),
        ]
    )


def regression_scores(y_true, y_pred) -> dict:
    return {
        "mae": round(float(mean_absolute_error(y_true, y_pred)), 4),
        "rmse": round(float(root_mean_squared_error(y_true, y_pred)), 4),
    }


def classification_scores(y_true, y_prob, threshold: float = 0.5) -> dict:
    y_hat = (y_prob >= threshold).astype(int)
    scores = {
        "accuracy": round(float(accuracy_score(y_true, y_hat)), 4),
        "pr_auc": round(float(average_precision_score(y_true, y_prob)), 4),
        "log_loss": round(float(log_loss(y_true, y_prob)), 4),
        "brier": round(float(brier_score_loss(y_true, y_prob)), 4),
        "base_rate": round(float(np.mean(y_true)), 4),
    }
    # ROC-AUC tidak terdefinisi kalau hanya ada satu kelas di data uji.
    try:
        scores["roc_auc"] = round(float(roc_auc_score(y_true, y_prob)), 4)
    except ValueError:
        scores["roc_auc"] = None
    return scores


def main() -> None:
    ap = argparse.ArgumentParser(description="Latih model kecelakaan Subaraya.")
    ap.add_argument("--data", type=Path, default=Path("../data"),
                    help="Folder berisi fact_accident_hourly.csv & dim_zone.csv")
    ap.add_argument("--out", type=Path, default=Path("models"),
                    help="Folder keluaran berkas .joblib (bawaan: models/)")
    ap.add_argument("--cyclic-hour", action="store_true",
                    help="Encode jam & bulan secara siklik (sin/cos). "
                         "Memperbaiki kurva 24 jam yang monoton.")
    ap.add_argument("--occurrence-model", choices=["logreg", "rf"], default="logreg",
                    help="Model untuk peluang kejadian (bawaan: logreg)")
    ap.add_argument("--severe-model", choices=["logreg", "rf"], default="logreg",
                    help="Model untuk risiko kecelakaan berat (bawaan: logreg)")
    args = ap.parse_args()

    fact = args.data / "fact_accident_hourly.csv"
    zones = args.data / "dim_zone.csv"
    for p in (fact, zones):
        if not p.exists():
            sys.exit(f"\nBerkas tidak ditemukan: {p}\nTunjuk foldernya dengan --data.")

    print("\nSubaraya - pelatihan model kecelakaan")
    print("=" * 56)
    if args.cyclic_hour:
        print("  mode: encoding siklik untuk jam & bulan AKTIF")

    df = load_accident_data(str(fact), str(zones))
    train, val, test = time_split(df)

    print(f"  baris total : {len(df):,}")
    print(f"  train       : {len(train):,}  "
          f"({train['event_hour'].min():%Y-%m-%d} -> {train['event_hour'].max():%Y-%m-%d})")
    print(f"  val         : {len(val):,}  "
          f"({val['event_hour'].min():%Y-%m-%d} -> {val['event_hour'].max():%Y-%m-%d})")
    print(f"  test        : {len(test):,}  "
          f"({test['event_hour'].min():%Y-%m-%d} -> {test['event_hour'].max():%Y-%m-%d})")

    X_train = train[RAW_INPUT_COLS]
    X_val = val[RAW_INPUT_COLS]
    X_test = test[RAW_INPUT_COLS]

    def rf_classifier() -> RandomForestClassifier:
        # Kedalaman DIBATASI. Tanpa batas, hutan menghafal data latih dan
        # berkasnya membengkak sampai ratusan MB untuk ruang masukan yang
        # sebenarnya hanya puluhan ribu kombinasi.
        return RandomForestClassifier(
            n_estimators=200, max_depth=10, min_samples_leaf=50,
            class_weight="balanced", random_state=42, n_jobs=-1,
        )

    def classifier(kind: str):
        return rf_classifier() if kind == "rf" else LogisticRegression(max_iter=2000)

    jobs = [
        ("expected_accident", "target_expected_accident", "regresi",
         PoissonRegressor(alpha=1e-4, max_iter=2000)),
        ("accident_occurrence", "target_accident_occurrence", "klasifikasi",
         classifier(args.occurrence_model)),
        ("severe_accident_risk", "target_severe_risk", "klasifikasi",
         classifier(args.severe_model)),
    ]

    args.out.mkdir(parents=True, exist_ok=True)
    metrics: dict = {
        "generated_at": pd.Timestamp.now(tz="UTC").isoformat(timespec="seconds"),
        "cyclic_hour": bool(args.cyclic_hour),
        "split": {
            part: {
                "rows": int(len(frame)),
                "start": str(frame["event_hour"].min()),
                "end": str(frame["event_hour"].max()),
            }
            for part, frame in (("train", train), ("val", val), ("test", test))
        },
        "models": {},
    }

    for name, target, kind, estimator in jobs:
        print(f"\n  {name}  [{type(estimator).__name__}]")
        pipe = make_pipeline(estimator, args.cyclic_hour)
        pipe.fit(X_train, train[target])

        if kind == "regresi":
            scores = {
                "val": regression_scores(val[target], pipe.predict(X_val)),
                "test": regression_scores(test[target], pipe.predict(X_test)),
            }
            dummy = DummyRegressor(strategy="mean").fit(X_train, train[target])
            scores["dummy_test"] = regression_scores(
                test[target], dummy.predict(X_test)
            )
            print(f"    test MAE  {scores['test']['mae']:.4f}"
                  f"   (dummy {scores['dummy_test']['mae']:.4f})")
            print(f"    test RMSE {scores['test']['rmse']:.4f}"
                  f"   (dummy {scores['dummy_test']['rmse']:.4f})")
        else:
            scores = {
                "val": classification_scores(
                    val[target], pipe.predict_proba(X_val)[:, 1]
                ),
                "test": classification_scores(
                    test[target], pipe.predict_proba(X_test)[:, 1]
                ),
            }
            dummy = DummyClassifier(strategy="prior").fit(X_train, train[target])
            scores["dummy_test"] = classification_scores(
                test[target], dummy.predict_proba(X_test)[:, 1]
            )
            print(f"    test ROC-AUC {scores['test']['roc_auc']}"
                  f"   PR-AUC {scores['test']['pr_auc']}"
                  f"   (base rate {scores['test']['base_rate']})")

        metrics["models"][name] = {
            "estimator": type(estimator).__name__,
            "target": target,
            "scores": scores,
        }

        # compress=3 memperkecil berkas tanpa memperlambat pemuatan secara berarti.
        path = args.out / f"{name}_pipeline.joblib"
        joblib.dump(pipe, path, compress=3)
        print(f"    tersimpan: {path}  ({path.stat().st_size/1024:,.0f} KB)")

    (args.out / "metrics.json").write_text(
        json.dumps(metrics, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )
    print(f"\n  metrik: {args.out / 'metrics.json'}")
    print("=" * 56)
    print("  Selesai.\n")


if __name__ == "__main__":
    main()
