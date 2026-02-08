# Hasta U

[Ana rapora don](../../Hasta_Raporları_Detay.md)

## Hasta Ozeti

| Alan | Deger |
|---|---|
| Yas | 43 |
| Cinsiyet | MALE |
| BMI | 28.0 |
| Vital Status | LIVING |
| Risk Skoru (Son) | 34.2 |
| Risk Seviyesi | Dikkat |
| Anomali Durumu | Var |
| Son KMR | 0.0217 (9. Ay) |
| Son KRE | 1.81 (12. Ay) |
| Son GFR | 44.0 (12. Ay) |

## Grafikler

![Hasta U KMR](../assets/U_kmr.png)

![Hasta U KRE GFR](../assets/U_kre_gfr.png)

![Hasta U Risk](../assets/U_risk.png)

## IQR ve Median Ozeti

| Metrik | Hasta (Median / IQR) | Referans (Median / IQR) | Son Olcum Zamani |
|---|---|---|---|
| KMR | 0.267 / 0.574 | 0.024 / 0.079 | 9. Ay |
| KRE | 1.735 / 0.202 | 1.020 / 0.560 | 12. Ay |
| GFR | 47.000 / 7.250 | 64.000 / 15.000 | 12. Ay |

## AI Performans (Hasta Bazli)

| Metrik | Eval Nokta | MAE | RMSE | MAPE | Aralik Kapsama | Son Hata |
|---|---:|---:|---:|---:|---:|---:|
| KMR | 4 | 0.0860 | 0.0968 | %146.51 | %0.0 | 0.1468 |
| KRE | 5 | 0.130 | 0.160 | %7.78 | %100.0 | 0.010 |
| GFR | 5 | 18.94 | 19.29 | %40.92 | %0.0 | 18.40 |

## Zaman Serisi Detay Tablosu

| Zaman | KMR | AI KMR | Durum | KRE | AI KRE | Durum | GFR | AI GFR | Durum | Risk | Seviye | Anomali |
|---|---:|---:|---|---:|---:|---|---:|---:|---|---:|---|---|
| 1. Gun | 0.8156 | 0.8156 | Olcum Kopyasi | - | - | Uygulanmaz | - | - | Uygulanmaz | 7.8 | Normal | - |
| 2. Gun | 1.3992 | 1.3992 | Olcum Kopyasi | - | - | Uygulanmaz | - | - | Uygulanmaz | 16.6 | Normal | - |
| 3. Gun | 0.6304 | 0.6304 | Olcum Kopyasi | - | - | Uygulanmaz | - | - | Uygulanmaz | 13.6 | Normal | - |
| 4. Gun | 0.2667 | 0.2667 | Olcum Kopyasi | - | - | Uygulanmaz | - | - | Uygulanmaz | 11.4 | Normal | - |
| 5. Gun | 0.4875 | 0.4875 | Olcum Kopyasi | - | - | Uygulanmaz | - | - | Uygulanmaz | 15.9 | Normal | - |
| 6. Gun | - | 0.0070 | Ongoru | - | - | Uygulanmaz | - | - | Uygulanmaz | 0.0 | Normal | - |
| 7. Gun | - | 0.0070 | Ongoru | 1.18 | 1.18 | Olcum Kopyasi | 75.1 | 75.1 | Olcum Kopyasi | 19.0 | Normal | GFR |
| 2. Hafta | - | 0.0070 | Ongoru | 1.52 | 1.52 | Olcum Kopyasi | 55.0 | 55.0 | Olcum Kopyasi | 26.8 | Normal | - |
| 3. Hafta | - | 0.0070 | Ongoru | 1.90 | 1.90 | Olcum Kopyasi | 42.0 | 42.0 | Olcum Kopyasi | 34.2 | Dikkat | - |
| 1. Ay | - | 0.0070 | Ongoru | 1.75 | 1.75 | Olcum Kopyasi | 47.0 | 47.0 | Olcum Kopyasi | 28.2 | Normal | - |
| 2. Ay | - | 0.0070 | Ongoru | 1.91 | 1.91 | Olcum Kopyasi | 41.0 | 41.0 | Olcum Kopyasi | 29.6 | Normal | - |
| 3. Ay | - | 0.0070 | Ongoru | 1.72 | 1.86 | Model | 47.0 | 62.3 | Model | 24.2 | Normal | - |
| 4. Ay | - | 0.0070 | Ongoru | 1.84 | 1.89 | Model | 43.0 | 68.6 | Model | 26.5 | Normal | - |
| 5. Ay | - | 0.0070 | Ongoru | 1.62 | 1.89 | Model | 51.0 | 70.3 | Model | 20.7 | Normal | - |
| 6. Ay | 0.0297 | 0.0070 | Model | 1.66 | 1.84 | Model | 49.0 | 65.1 | Model | 16.3 | Normal | - |
| 7. Ay | 0.0900 | 0.1856 | Model | - | - | Uygulanmaz | - | - | Uygulanmaz | 11.7 | Normal | - |
| 8. Ay | 0.0561 | 0.1351 | Model | - | - | Uygulanmaz | - | - | Uygulanmaz | 11.0 | Normal | - |
| 9. Ay | 0.0217 | 0.1685 | Model | - | - | Uygulanmaz | - | - | Uygulanmaz | 12.2 | Normal | - |
| 10. Ay | - | 0.1878 | Ongoru | - | - | Uygulanmaz | - | - | Uygulanmaz | 0.0 | Normal | - |
| 11. Ay | - | 0.1878 | Ongoru | - | - | Uygulanmaz | - | - | Uygulanmaz | 0.0 | Normal | - |
| 12. Ay | - | 0.1878 | Ongoru | 1.81 | 1.82 | Model | 44.0 | 62.4 | Model | 23.9 | Normal | - |

> Not: Bu dosya `python3 backend/run_all.py` ile otomatik uretilir.
