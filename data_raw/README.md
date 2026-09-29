# data_raw

Letakkan CSV asli di sini:

- `mart_hourly.csv` — hasil ekspor `mart_hourly` dari PostgreSQL
- `dim_zone.csv` — metadata zona

Lalu jalankan:

```bash
python scripts/aggregate.py
```

Folder ini diabaikan oleh git (kecuali berkas README ini), jadi data mentah
tidak ikut ter-commit.
