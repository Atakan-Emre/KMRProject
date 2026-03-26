# Hasta AO

[Ana rapora don](../../Hasta_Raporları_Detay.md)

## Hasta Ozeti

| Alan | Deger |
|---|---|
| Yas | 19 |
| Cinsiyet | FEMALE |
| BMI | 20.5 |
| Vital Status | LIVING |
| Risk Skoru (Son) | 16.5 |
| Risk Seviyesi | Normal |
| Anomali Durumu | Var |
| Son KMR | 0.1451 (9. Ay) |
| Son KRE | 0.80 (6. Ay) |
| Son GFR | 107.0 (6. Ay) |

## Grafikler

![Hasta AO KMR](../assets/AO_kmr.png)

![Hasta AO KRE GFR](../assets/AO_kre_gfr.png)

![Hasta AO Risk](../assets/AO_risk.png)

## IQR ve Median Ozeti

| Metrik | Hasta (Median / IQR) | Referans (Median / IQR) | Son Olcum Zamani |
|---|---|---|---|
| KMR | 0.156 / 0.144 | 0.085 / 0.100 | 9. Ay |
| KRE | 0.840 / 0.150 | 1.160 / 0.510 | 6. Ay |
| GFR | 101.000 / 20.000 | 68.500 / 36.400 | 6. Ay |

## AI Performans (Hasta Bazli)

| Metrik | Eval Nokta | MAE | RMSE | MAPE | Aralik Kapsama | Son Hata |
|---|---:|---:|---:|---:|---:|---:|
| KMR | 6 | 0.0263 | 0.0332 | %29.82 | %50.0 | 0.0040 |
| KRE | 4 | 0.140 | 0.144 | %18.31 | %50.0 | 0.100 |
| GFR | 4 | 5.25 | 5.40 | %4.72 | %100.0 | 4.00 |

## Zaman Serisi Detay Tablosu

| Zaman | KMR | AI KMR | Durum | KRE | AI KRE | Durum | GFR | AI GFR | Durum | Risk | Seviye | Anomali |
|---|---:|---:|---|---:|---:|---|---:|---:|---|---:|---|---|
| 1. Gun | 1.3765 | 1.3765 | Olcum Kopyasi | - | - | Uygulanmaz | - | - | Uygulanmaz | 15.3 | Normal | KMR |
| 2. Gun | 0.8183 | 0.8183 | Olcum Kopyasi | - | - | Uygulanmaz | - | - | Uygulanmaz | 11.4 | Normal | - |
| 3. Gun | 0.1574 | 0.1574 | Olcum Kopyasi | - | - | Uygulanmaz | - | - | Uygulanmaz | 11.1 | Normal | - |
| 4. Gun | - | 0.1574 | Ongoru | - | - | Uygulanmaz | - | - | Uygulanmaz | 0.0 | Normal | - |
| 5. Gun | - | 0.1574 | Ongoru | - | - | Uygulanmaz | - | - | Uygulanmaz | 0.0 | Normal | - |
| 6. Gun | - | 0.1574 | Ongoru | - | - | Uygulanmaz | - | - | Uygulanmaz | 0.0 | Normal | - |
| 7. Gun | - | 0.1574 | Ongoru | 0.84 | 0.84 | Olcum Kopyasi | 101.0 | 101.0 | Olcum Kopyasi | 6.7 | Normal | - |
| 2. Hafta | 0.1562 | 0.1562 | Olcum Kopyasi | 0.87 | 0.87 | Olcum Kopyasi | 96.0 | 96.0 | Olcum Kopyasi | 11.1 | Normal | - |
| 3. Hafta | 0.3571 | 0.3571 | Olcum Kopyasi | 1.00 | 1.00 | Olcum Kopyasi | 81.0 | 81.0 | Olcum Kopyasi | 16.4 | Normal | - |
| 1. Ay | 0.1144 | 0.0590 | Model | 0.95 | 0.95 | Olcum Kopyasi | 87.0 | 87.0 | Olcum Kopyasi | 12.5 | Normal | - |
| 2. Ay | 0.0255 | 0.0543 | Model | 1.18 | 1.18 | Olcum Kopyasi | 67.0 | 67.0 | Olcum Kopyasi | 14.4 | Normal | - |
| 3. Ay | 0.0889 | 0.0392 | Model | 0.82 | 0.93 | Model | 104.0 | 110.5 | Model | 13.1 | Normal | - |
| 4. Ay | - | 0.1147 | Ongoru | 0.75 | 0.92 | Model | 116.0 | 112.0 | Model | 12.1 | Normal | - |
| 5. Ay | 0.1284 | 0.1147 | Model | 0.73 | 0.91 | Model | 119.0 | 112.5 | Model | 16.5 | Normal | - |
| 6. Ay | 0.1728 | 0.1666 | Model | 0.80 | 0.90 | Model | 107.0 | 111.0 | Model | 14.5 | Normal | - |
| 7. Ay | - | 0.1491 | Ongoru | - | - | Uygulanmaz | - | - | Uygulanmaz | 0.0 | Normal | - |
| 8. Ay | - | 0.1491 | Ongoru | - | - | Uygulanmaz | - | - | Uygulanmaz | 0.0 | Normal | - |
| 9. Ay | 0.1451 | 0.1491 | Model | - | - | Uygulanmaz | - | - | Uygulanmaz | 13.2 | Normal | - |
| 10. Ay | - | 0.1678 | Ongoru | - | - | Uygulanmaz | - | - | Uygulanmaz | 0.0 | Normal | - |
| 11. Ay | - | 0.1678 | Ongoru | - | - | Uygulanmaz | - | - | Uygulanmaz | 0.0 | Normal | - |
| 12. Ay | - | 0.1678 | Ongoru | - | 0.88 | Ongoru | - | 109.2 | Ongoru | 0.0 | Normal | - |

> Not: Bu dosya `python3 backend/run_all.py` ile otomatik uretilir.
