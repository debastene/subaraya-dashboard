# ml/ — pelatihan model kecelakaan

Versi rapi dari `Accident.ipynb`. Pilihan model, pembagian data, dan metrik
tetap sama seperti notebook; yang berubah hanya strukturnya.

```
ml/
  features.py   # AccidentFeatureEngineer + penyiapan data + pembagian waktu
  train.py      # melatih 3 model, mencetak metrik, menyimpan .joblib
```

## Menjalankan

```bash
pip install scikit-learn pandas joblib
python ml/train.py --data ../data
```

`--data` menunjuk folder berisi `fact_accident_hourly.csv` dan `dim_zone.csv`.
Hasilnya masuk ke `models/` beserta `metrics.json`.

Pilihan lain:

```bash
python ml/train.py --data ../data --cyclic-hour
python ml/train.py --data ../data --occurrence-model rf
```

---

## Tiga masalah yang diperbaiki

### 1. `AttributeError` saat model dimuat di komputer lain

Ini akar masalahnya, dan penyebabnya halus.

Pickle **tidak menyimpan kode** sebuah kelas — hanya nama kelas beserta
modulnya. Kelas yang didefinisikan di dalam notebook tercatat modulnya sebagai
`__main__`, sehingga berkas `.joblib`-nya hanya bisa dimuat di notebook yang
sama persis. Di tempat lain:

```
AttributeError: module '__main__' has no attribute 'AccidentFeatureEngineer'
```

Begitu kelasnya dipindah ke `features.py`, modulnya tercatat sebagai
`features.AccidentFeatureEngineer` dan berkas model bisa dimuat di mana saja
selama `features.py` ikut dibawa. Kalau belum ada, pesannya pun jadi jelas
(`ModuleNotFoundError: No module named 'features'`) bukan lagi membingungkan.

**Aturannya satu:** jangan definisikan ulang kelas itu di notebook. Cukup

```python
from features import AccidentFeatureEngineer
```

> Catatan tambahan: berkas `.joblib` versi lama menyimpan objek transformer
> dengan `__dict__` kosong, jadi atribut dari `__init__` tidak ikut tersimpan.
> `transform()` di sini membacanya lewat `getattr(..., default)` supaya model
> lama tetap bisa dimuat.

### 2. Bisakah jadi satu pipeline? Bisa.

Di notebook, rekayasa fitur dikerjakan di luar pipeline (sel pembuatan kolom
`hour`, `day_of_week`, dan seterusnya), lalu pipeline hanya berisi
`preprocessor` + `model`. Akibatnya, setiap kali ingin memprediksi, kolom-kolom
itu harus disiapkan ulang secara manual — dan kalau caranya berbeda sedikit
saja dengan waktu latih, hasilnya diam-diam salah.

Sekarang ketiganya menjadi satu rantai:

```python
Pipeline([
    ("feature_engineering", AccidentFeatureEngineer()),  # event_hour -> fitur kalender
    ("preprocessor",        build_preprocessor()),        # scaling + one-hot
    ("model",               PoissonRegressor(...)),
])
```

Sehingga memprediksi cukup begini — tidak ada penyiapan kolom sama sekali:

```python
X = pd.DataFrame({
    "event_hour": pd.to_datetime(["2026-10-05 08:00"]),
    "zone_id": ["Z01"],
})
pipe.predict(X)
```

### 3. Satu `preprocessor` dipakai bertiga

Di notebook, objek `preprocessor` yang sama dimasukkan ke ketiga `Pipeline`.
`Pipeline` sklearn tidak menyalin langkahnya saat `fit`, jadi ketiga model
sebenarnya berbagi satu objek dan saling menimpa hasil fit satu sama lain.

Kebetulan tidak berakibat apa-apa karena ketiganya dilatih pada `X_train` yang
sama. Tapi begitu salah satunya dilatih pada data berbeda, dua model lain ikut
berubah tanpa ada yang sadar. `build_preprocessor()` mengembalikan objek baru
setiap kali dipanggil, jadi tiap pipeline punya miliknya sendiri.

---

## Soal `hour` sebagai angka linear

Fitur `hour` dikirim ke model sebagai satu angka yang di-standardisasi. Untuk
model linear (Poisson, Logistic), ini berarti pengaruh jam hanya bisa berupa
**garis lurus** — tidak mungkin ada puncak pagi dan sore.

Masalahnya juga terlihat di ujung hari: pukul 23 dan pukul 00 bersebelahan di
dunia nyata, tapi menurut model jaraknya paling jauh.

Flag `--cyclic-hour` mengganti `hour` dengan pasangan sin/cos (begitu juga
`month`). Diuji pada data sintetis yang sengaja dibuat berpuncak siang:

```
             tanpa siklik      dengan --cyclic-hour
  puncak        23:00                13:00
  monoton?      ya                   tidak
  lompat 23->00 0,98                 0,08
  test MAE      1,5379               1,2564
```

Model menemukan kembali puncak yang memang ada di data, dan MAE turun 18%.
Flag ini **mati secara bawaan** supaya hasilnya sama persis dengan notebook —
keputusan menyalakannya ada di tangan kamu.

---

## Soal `RandomForest` yang 473 MB

Berkas `accident_occurrence_pipeline.joblib` yang dikirim sebelumnya berisi
`RandomForestClassifier` dengan `max_depth=None` dan `min_samples_leaf=1`
(bawaan sklearn). Hasilnya 200 pohon dengan total **6,2 juta node** — padahal
kombinasi masukan yang mungkin hanya 4 zona × 24 jam × 31 tanggal × 12 bulan =
**35.712**. Perbandingannya 174 kali lipat, yang artinya hutan itu menghafal,
bukan belajar.

Kalau tetap ingin memakai random forest, `--occurrence-model rf` di sini sudah
memakai batas yang wajar:

```python
RandomForestClassifier(
    n_estimators=200, max_depth=10, min_samples_leaf=50,
    class_weight="balanced", random_state=42, n_jobs=-1,
)
```

Tapi perlu dicatat: `LogisticRegression` di notebook punya ROC-AUC **0,8040**
dan sudah dievaluasi lengkap, sementara random forest yang dikirim belum ada
angka evaluasinya sama sekali. Jadi bawaan di skrip ini adalah `logreg`.

Semua model disimpan dengan `compress=3`.

---

## Dipakai oleh dashboard

`scripts/predict.py` di root repo memuat berkas `.joblib` dari `models/`, lalu
menyimpan seluruh hasil prediksinya sebagai tabel di
`src/data/predictions.json`. Skrip itu otomatis memakai kelas dari
`ml/features.py` bila ada.

Jadi setelah melatih ulang:

```bash
python ml/train.py --data ../data
python scripts/predict.py
```

lalu commit `src/data/predictions.json`.
