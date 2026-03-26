# Hasta R

[Ana rapora don](../../Hasta_Raporları_Detay.md)

## Hasta Ozeti

| Alan | Deger |
|---|---|
| Yas | 25 |
| Cinsiyet | MALE |
| BMI | 21.7 |
| Vital Status | LIVING |
| Risk Skoru (Son) | 27.8 |
| Risk Seviyesi | Normal |
| Anomali Durumu | Var |
| Son KMR | 0.5170 (12. Ay) |
| Son KRE | 1.29 (12. Ay) |
| Son GFR | 76.0 (12. Ay) |

## Grafikler

![Hasta R KMR](../assets/R_kmr.png)

![Hasta R KRE GFR](../assets/R_kre_gfr.png)

![Hasta R Risk](../assets/R_risk.png)

## IQR ve Median Ozeti

| Metrik | Hasta (Median / IQR) | Referans (Median / IQR) | Son Olcum Zamani |
|---|---|---|---|
| KMR | 0.073 / 0.548 | 0.138 / 0.217 | 12. Ay |
| KRE | 1.315 / 0.363 | 1.050 / 0.610 | 12. Ay |
| GFR | 74.500 / 20.500 | 64.000 / 13.500 | 12. Ay |

## AI Performans (Hasta Bazli)

| Metrik | Eval Nokta | MAE | RMSE | MAPE | Aralik Kapsama | Son Hata |
|---|---:|---:|---:|---:|---:|---:|
| KMR | 7 | 0.2653 | 0.2692 | %309.06 | %0.0 | -0.2371 |
| KRE | 5 | 0.262 | 0.308 | %19.11 | %60.0 | 0.370 |
| GFR | 5 | 21.82 | 26.01 | %38.94 | %40.0 | -3.20 |

## Zaman Serisi Detay Tablosu

| Zaman | KMR | AI KMR | Durum | KRE | AI KRE | Durum | GFR | AI GFR | Durum | Risk | Seviye | Anomali |
|---|---:|---:|---|---:|---:|---|---:|---:|---|---:|---|---|
| 1. Gun | 2.2974 | 2.2974 | Olcum Kopyasi | - | - | Uygulanmaz | - | - | Uygulanmaz | 18.4 | Normal | KMR |
| 2. Gun | 1.2402 | 1.2402 | Olcum Kopyasi | - | - | Uygulanmaz | - | - | Uygulanmaz | 13.2 | Normal | - |
| 3. Gun | 0.2100 | 0.2100 | Olcum Kopyasi | - | - | Uygulanmaz | - | - | Uygulanmaz | 11.5 | Normal | - |
| 4. Gun | 0.0592 | 0.0592 | Olcum Kopyasi | - | - | Uygulanmaz | - | - | Uygulanmaz | 13.4 | Normal | - |
| 5. Gun | 0.0447 | 0.0447 | Olcum Kopyasi | - | - | Uygulanmaz | - | - | Uygulanmaz | 14.1 | Normal | - |
| 6. Gun | 0.8673 | 0.4983 | Model | - | - | Uygulanmaz | - | - | Uygulanmaz | 27.8 | Normal | - |
| 7. Gun | - | 0.3550 | Ongoru | 1.18 | 1.18 | Olcum Kopyasi | 85.0 | 85.0 | Olcum Kopyasi | 12.3 | Normal | - |
| 2. Hafta | 0.0763 | 0.3550 | Model | 1.72 | 1.72 | Olcum Kopyasi | 54.0 | 54.0 | Olcum Kopyasi | 21.2 | Normal | - |
| 3. Hafta | - | 0.2742 | Ongoru | 1.31 | 1.31 | Olcum Kopyasi | 75.0 | 75.0 | Olcum Kopyasi | 13.6 | Normal | - |
| 1. Ay | - | 0.2742 | Ongoru | 1.27 | 1.27 | Olcum Kopyasi | 78.0 | 78.0 | Olcum Kopyasi | 17.5 | Normal | - |
| 2. Ay | - | 0.2742 | Ongoru | 1.32 | 1.32 | Olcum Kopyasi | 74.0 | 74.0 | Olcum Kopyasi | 12.1 | Normal | - |
| 3. Ay | - | 0.2742 | Ongoru | 1.81 | 1.88 | Model | 51.0 | 89.1 | Model | 24.1 | Normal | - |
| 4. Ay | - | 0.2742 | Ongoru | 1.64 | 1.81 | Model | 57.0 | 87.6 | Model | 21.0 | Normal | - |
| 5. Ay | 0.0469 | 0.2742 | Model | 1.63 | 1.81 | Model | 57.0 | 87.7 | Model | 17.2 | Normal | - |
| 6. Ay | 0.0177 | 0.2834 | Model | 1.25 | 1.77 | Model | 79.0 | 85.5 | Model | 15.5 | Normal | - |
| 7. Ay | - | 0.3020 | Ongoru | - | - | Uygulanmaz | - | - | Uygulanmaz | 0.0 | Normal | - |
| 8. Ay | - | 0.3020 | Ongoru | - | - | Uygulanmaz | - | - | Uygulanmaz | 0.0 | Normal | - |
| 9. Ay | 0.0705 | 0.3020 | Model | - | - | Uygulanmaz | - | - | Uygulanmaz | 14.1 | Normal | - |
| 10. Ay | 0.0626 | 0.3101 | Model | - | - | Uygulanmaz | - | - | Uygulanmaz | 7.3 | Normal | - |
| 11. Ay | - | 0.2799 | Ongoru | - | - | Uygulanmaz | - | - | Uygulanmaz | 0.0 | Normal | - |
| 12. Ay | 0.5170 | 0.2799 | Model | 1.29 | 1.66 | Model | 76.0 | 72.8 | Model | 19.5 | Normal | - |

> Not: Bu dosya `python3 backend/run_all.py` ile otomatik uretilir.
