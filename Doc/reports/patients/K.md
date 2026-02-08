# Hasta K

[Ana rapora don](../../Hasta_Raporları_Detay.md)

## Hasta Ozeti

| Alan | Deger |
|---|---|
| Yas | 50 |
| Cinsiyet | MALE |
| BMI | 23.7 |
| Vital Status | LIVING |
| Risk Skoru (Son) | 58.7 |
| Risk Seviyesi | Dikkat |
| Anomali Durumu | Var |
| Son KMR | 0.1382 (12. Ay) |
| Son KRE | 1.28 (12. Ay) |
| Son GFR | 64.0 (12. Ay) |

## Grafikler

![Hasta K KMR](../assets/K_kmr.png)

![Hasta K KRE GFR](../assets/K_kre_gfr.png)

![Hasta K Risk](../assets/K_risk.png)

## IQR ve Median Ozeti

| Metrik | Hasta (Median / IQR) | Referans (Median / IQR) | Son Olcum Zamani |
|---|---|---|---|
| KMR | 0.211 / 2.654 | 0.227 / 0.318 | 12. Ay |
| KRE | 1.875 / 1.555 | 1.020 / 0.560 | 12. Ay |
| GFR | 41.100 / 27.625 | 64.000 / 15.000 | 12. Ay |

## AI Performans (Hasta Bazli)

| Metrik | Eval Nokta | MAE | RMSE | MAPE | Aralik Kapsama | Son Hata |
|---|---:|---:|---:|---:|---:|---:|
| KMR | 10 | 1.5272 | 1.6339 | %1332.17 | %10.0 | 1.9545 |
| KRE | 5 | 1.556 | 1.562 | %97.14 | %0.0 | 1.590 |
| GFR | 5 | 29.38 | 32.71 | %66.25 | %20.0 | 4.50 |

## Zaman Serisi Detay Tablosu

| Zaman | KMR | AI KMR | Durum | KRE | AI KRE | Durum | GFR | AI GFR | Durum | Risk | Seviye | Anomali |
|---|---:|---:|---|---:|---:|---|---:|---:|---|---:|---|---|
| 1. Gun | 7.2699 | 7.2699 | Olcum Kopyasi | - | - | Uygulanmaz | - | - | Uygulanmaz | 21.1 | Normal | KMR |
| 2. Gun | 14.4584 | 14.4584 | Olcum Kopyasi | - | - | Uygulanmaz | - | - | Uygulanmaz | 32.2 | Dikkat | KMR |
| 3. Gun | 0.5917 | 0.5917 | Olcum Kopyasi | - | - | Uygulanmaz | - | - | Uygulanmaz | 15.0 | Normal | - |
| 4. Gun | 2.8571 | 2.8571 | Olcum Kopyasi | - | - | Uygulanmaz | - | - | Uygulanmaz | 27.8 | Normal | - |
| 5. Gun | 0.0494 | 0.0494 | Olcum Kopyasi | - | - | Uygulanmaz | - | - | Uygulanmaz | 12.3 | Normal | - |
| 6. Gun | 2.7260 | 1.9950 | Model | - | - | Uygulanmaz | - | - | Uygulanmaz | 30.1 | Dikkat | - |
| 7. Gun | 0.1691 | 1.6524 | Model | 3.07 | 3.07 | Olcum Kopyasi | 23.0 | 23.0 | Olcum Kopyasi | 25.9 | Normal | - |
| 2. Hafta | 0.1825 | 1.6379 | Model | 5.28 | 5.28 | Olcum Kopyasi | 12.0 | 12.0 | Olcum Kopyasi | 28.7 | Normal | KRE,GFR |
| 3. Hafta | - | 1.7965 | Ongoru | 4.50 | 4.50 | Olcum Kopyasi | 14.0 | 14.0 | Olcum Kopyasi | 58.7 | Dikkat | GFR |
| 1. Ay | - | 1.7965 | Ongoru | 3.17 | 3.17 | Olcum Kopyasi | 22.0 | 22.0 | Olcum Kopyasi | 44.6 | Dikkat | - |
| 2. Ay | - | 1.7965 | Ongoru | 1.44 | 1.44 | Olcum Kopyasi | 56.0 | 56.0 | Olcum Kopyasi | 21.4 | Normal | - |
| 3. Ay | - | 1.7965 | Ongoru | 1.59 | 3.39 | Model | 50.0 | 77.2 | Model | 24.1 | Normal | - |
| 4. Ay | 1.5701 | 1.7965 | Model | 1.96 | 3.42 | Model | 39.0 | 85.3 | Model | 31.8 | Dikkat | - |
| 5. Ay | - | 2.0675 | Ongoru | 1.79 | 3.28 | Model | 43.2 | 83.7 | Model | 28.6 | Normal | - |
| 6. Ay | 3.5503 | 2.0675 | Model | 1.59 | 3.03 | Model | 49.5 | 77.9 | Model | 38.3 | Dikkat | - |
| 7. Ay | 0.0550 | 2.0927 | Model | - | - | Uygulanmaz | - | - | Uygulanmaz | 19.4 | Normal | - |
| 8. Ay | 0.0292 | 2.0927 | Model | - | - | Uygulanmaz | - | - | Uygulanmaz | 19.2 | Normal | - |
| 9. Ay | 0.1370 | 2.0927 | Model | - | - | Uygulanmaz | - | - | Uygulanmaz | 21.4 | Normal | - |
| 10. Ay | - | 2.0927 | Ongoru | - | - | Uygulanmaz | - | - | Uygulanmaz | 0.0 | Normal | - |
| 11. Ay | 0.2113 | 2.0927 | Model | - | - | Uygulanmaz | - | - | Uygulanmaz | 24.0 | Normal | - |
| 12. Ay | 0.1382 | 2.0927 | Model | 1.28 | 2.87 | Model | 64.0 | 68.5 | Model | 17.6 | Normal | - |

> Not: Bu dosya `python3 backend/run_all.py` ile otomatik uretilir.
