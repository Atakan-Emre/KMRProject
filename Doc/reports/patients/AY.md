# Hasta AY

[Ana rapora don](../../Hasta_Raporları_Detay.md)

## Hasta Ozeti

| Alan | Deger |
|---|---|
| Yas | 23 |
| Cinsiyet | MALE |
| BMI | - |
| Vital Status | LIVING |
| Risk Skoru (Son) | 51.7 |
| Risk Seviyesi | Dikkat |
| Anomali Durumu | Yok |
| Son KMR | 0.2296 (1. Ay) |
| Son KRE | 1.39 (4. Ay) |
| Son GFR | 70.0 (4. Ay) |

## Grafikler

![Hasta AY KMR](../assets/AY_kmr.png)

![Hasta AY KRE GFR](../assets/AY_kre_gfr.png)

![Hasta AY Risk](../assets/AY_risk.png)

## IQR ve Median Ozeti

| Metrik | Hasta (Median / IQR) | Referans (Median / IQR) | Son Olcum Zamani |
|---|---|---|---|
| KMR | 0.889 / 0.669 | 0.117 / 0.186 | 1. Ay |
| KRE | 1.610 / 0.535 | 1.140 / 0.810 | 4. Ay |
| GFR | 49.000 / 18.500 | 60.600 / 37.800 | 4. Ay |

## AI Performans (Hasta Bazli)

| Metrik | Eval Nokta | MAE | RMSE | MAPE | Aralik Kapsama | Son Hata |
|---|---:|---:|---:|---:|---:|---:|
| KMR | 4 | 0.0547 | 0.0680 | %14.81 | %50.0 | 0.0379 |
| KRE | 2 | 0.460 | 0.463 | %31.83 | %0.0 | 0.510 |
| GFR | 2 | 7.55 | 7.55 | %10.18 | %0.0 | -7.70 |

## Zaman Serisi Detay Tablosu

| Zaman | KMR | AI KMR | Durum | KRE | AI KRE | Durum | GFR | AI GFR | Durum | Risk | Seviye | Anomali |
|---|---:|---:|---|---:|---:|---|---:|---:|---|---:|---|---|
| 1. Gun | 4.7837 | 4.7837 | Olcum Kopyasi | - | - | Uygulanmaz | - | - | Uygulanmaz | 21.4 | Normal | - |
| 2. Gun | 3.8039 | 3.8039 | Olcum Kopyasi | - | - | Uygulanmaz | - | - | Uygulanmaz | 18.8 | Normal | - |
| 3. Gun | 0.9662 | 0.9662 | Olcum Kopyasi | - | - | Uygulanmaz | - | - | Uygulanmaz | 14.3 | Normal | - |
| 4. Gun | 0.9679 | 0.9679 | Olcum Kopyasi | - | - | Uygulanmaz | - | - | Uygulanmaz | 18.4 | Normal | - |
| 5. Gun | 0.5644 | 0.5644 | Olcum Kopyasi | - | - | Uygulanmaz | - | - | Uygulanmaz | 16.4 | Normal | - |
| 6. Gun | 0.8895 | 0.7707 | Model | - | - | Uygulanmaz | - | - | Uygulanmaz | 21.8 | Normal | - |
| 7. Gun | - | 0.2901 | Ongoru | 2.83 | 2.83 | Olcum Kopyasi | 30.0 | 30.0 | Olcum Kopyasi | 51.7 | Dikkat | - |
| 2. Hafta | 0.2985 | 0.2901 | Model | 2.02 | 2.02 | Olcum Kopyasi | 45.0 | 45.0 | Olcum Kopyasi | 19.3 | Normal | - |
| 3. Hafta | 0.2026 | 0.1488 | Model | 1.96 | 1.96 | Olcum Kopyasi | 47.0 | 47.0 | Olcum Kopyasi | 18.2 | Normal | - |
| 1. Ay | 0.2296 | 0.2675 | Model | 1.61 | 1.61 | Olcum Kopyasi | 59.0 | 59.0 | Olcum Kopyasi | 18.5 | Normal | - |
| 2. Ay | - | 0.0000 | Ongoru | 1.18 | 1.18 | Olcum Kopyasi | 49.0 | 49.0 | Olcum Kopyasi | 23.4 | Normal | - |
| 3. Ay | - | 0.0000 | Ongoru | 1.52 | 1.93 | Model | 79.0 | 71.6 | Model | 17.5 | Normal | - |
| 4. Ay | - | 0.0000 | Ongoru | 1.39 | 1.90 | Model | 70.0 | 62.3 | Model | 19.5 | Normal | - |
| 5. Ay | - | 0.0000 | Ongoru | - | 1.84 | Ongoru | - | 55.9 | Ongoru | 0.0 | Normal | - |
| 6. Ay | - | 0.0000 | Ongoru | - | 1.84 | Ongoru | - | 55.9 | Ongoru | 0.0 | Normal | - |
| 7. Ay | - | 0.0000 | Ongoru | - | - | Uygulanmaz | - | - | Uygulanmaz | 0.0 | Normal | - |
| 8. Ay | - | 0.0000 | Ongoru | - | - | Uygulanmaz | - | - | Uygulanmaz | 0.0 | Normal | - |
| 9. Ay | - | 0.0000 | Ongoru | - | - | Uygulanmaz | - | - | Uygulanmaz | 0.0 | Normal | - |
| 10. Ay | - | 0.0000 | Ongoru | - | - | Uygulanmaz | - | - | Uygulanmaz | 0.0 | Normal | - |
| 11. Ay | - | 0.0000 | Ongoru | - | - | Uygulanmaz | - | - | Uygulanmaz | 0.0 | Normal | - |
| 12. Ay | - | 0.0000 | Ongoru | - | 1.84 | Ongoru | - | 55.9 | Ongoru | 0.0 | Normal | - |

> Not: Bu dosya `python3 backend/run_all.py` ile otomatik uretilir.
