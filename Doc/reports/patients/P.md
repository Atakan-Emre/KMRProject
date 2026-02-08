# Hasta P

[Ana rapora don](../../Hasta_Raporları_Detay.md)

## Hasta Ozeti

| Alan | Deger |
|---|---|
| Yas | 25 |
| Cinsiyet | FEMALE |
| BMI | 18.8 |
| Vital Status | LIVING |
| Risk Skoru (Son) | 42.0 |
| Risk Seviyesi | Dikkat |
| Anomali Durumu | Var |
| Son KMR | 0.0000 (10. Ay) |
| Son KRE | 1.21 (12. Ay) |
| Son GFR | 61.0 (12. Ay) |

## Grafikler

![Hasta P KMR](../assets/P_kmr.png)

![Hasta P KRE GFR](../assets/P_kre_gfr.png)

![Hasta P Risk](../assets/P_risk.png)

## IQR ve Median Ozeti

| Metrik | Hasta (Median / IQR) | Referans (Median / IQR) | Son Olcum Zamani |
|---|---|---|---|
| KMR | 0.468 / 1.349 | 0.173 / 0.175 | 10. Ay |
| KRE | 1.115 / 0.290 | 1.020 / 0.560 | 12. Ay |
| GFR | 68.750 / 19.725 | 64.000 / 15.000 | 12. Ay |

## AI Performans (Hasta Bazli)

| Metrik | Eval Nokta | MAE | RMSE | MAPE | Aralik Kapsama | Son Hata |
|---|---:|---:|---:|---:|---:|---:|
| KMR | 5 | 0.2360 | 0.3654 | %371.72 | %20.0 | 0.7807 |
| KRE | 5 | 0.232 | 0.263 | %23.86 | %40.0 | -0.050 |
| GFR | 5 | 46.08 | 52.76 | %60.98 | %20.0 | 1.00 |

## Zaman Serisi Detay Tablosu

| Zaman | KMR | AI KMR | Durum | KRE | AI KRE | Durum | GFR | AI GFR | Durum | Risk | Seviye | Anomali |
|---|---:|---:|---|---:|---:|---|---:|---:|---|---:|---|---|
| 1. Gun | 7.5083 | 7.5083 | Olcum Kopyasi | - | - | Uygulanmaz | - | - | Uygulanmaz | 23.1 | Normal | KMR |
| 2. Gun | 7.7907 | 7.7907 | Olcum Kopyasi | - | - | Uygulanmaz | - | - | Uygulanmaz | 23.8 | Normal | KMR |
| 3. Gun | 1.6022 | 1.6022 | Olcum Kopyasi | - | - | Uygulanmaz | - | - | Uygulanmaz | 17.2 | Normal | - |
| 4. Gun | 0.3428 | 0.3428 | Olcum Kopyasi | - | - | Uygulanmaz | - | - | Uygulanmaz | 13.3 | Normal | - |
| 5. Gun | 1.0835 | 1.0835 | Olcum Kopyasi | - | - | Uygulanmaz | - | - | Uygulanmaz | 21.2 | Normal | - |
| 6. Gun | 0.5929 | 0.5588 | Model | - | - | Uygulanmaz | - | - | Uygulanmaz | 18.5 | Normal | - |
| 7. Gun | - | 0.4432 | Ongoru | 0.64 | 0.64 | Olcum Kopyasi | 124.0 | 124.0 | Olcum Kopyasi | 8.8 | Normal | GFR |
| 2. Hafta | - | 0.4432 | Ongoru | 1.40 | 1.40 | Olcum Kopyasi | 52.0 | 52.0 | Olcum Kopyasi | 27.4 | Normal | - |
| 3. Hafta | - | 0.4432 | Ongoru | 1.60 | 1.60 | Olcum Kopyasi | 44.0 | 44.0 | Olcum Kopyasi | 42.0 | Dikkat | - |
| 1. Ay | - | 0.4432 | Ongoru | 1.36 | 1.36 | Olcum Kopyasi | 54.0 | 54.0 | Olcum Kopyasi | 25.6 | Normal | - |
| 2. Ay | - | 0.4432 | Ongoru | 1.12 | 1.12 | Olcum Kopyasi | 68.5 | 68.5 | Olcum Kopyasi | 13.3 | Normal | - |
| 3. Ay | - | 0.4432 | Ongoru | 1.11 | 1.28 | Model | 69.0 | 132.6 | Model | 18.4 | Normal | - |
| 4. Ay | - | 0.4432 | Ongoru | 1.04 | 1.29 | Model | 74.8 | 141.4 | Model | 16.3 | Normal | - |
| 5. Ay | 0.2315 | 0.4432 | Model | 1.03 | 1.29 | Model | 75.7 | 141.4 | Model | 15.1 | Normal | - |
| 6. Ay | - | 0.0000 | Ongoru | 0.85 | 1.28 | Model | 95.0 | 128.5 | Model | 12.4 | Normal | - |
| 7. Ay | 0.0878 | 0.0000 | Model | - | - | Uygulanmaz | - | - | Uygulanmaz | 15.9 | Normal | - |
| 8. Ay | 0.0659 | 0.0000 | Model | - | - | Uygulanmaz | - | - | Uygulanmaz | 16.9 | Normal | - |
| 9. Ay | - | 0.7807 | Ongoru | - | - | Uygulanmaz | - | - | Uygulanmaz | 0.0 | Normal | - |
| 10. Ay | 0.0000 | 0.7807 | Model | - | - | Uygulanmaz | - | - | Uygulanmaz | 18.7 | Normal | - |
| 11. Ay | - | 0.5389 | Ongoru | - | - | Uygulanmaz | - | - | Uygulanmaz | 0.0 | Normal | - |
| 12. Ay | - | 0.5389 | Ongoru | 1.21 | 1.16 | Model | 61.0 | 62.0 | Model | 21.1 | Normal | - |

> Not: Bu dosya `python3 backend/run_all.py` ile otomatik uretilir.
