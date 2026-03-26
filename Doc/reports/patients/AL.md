# Hasta AL

[Ana rapora don](../../Hasta_Raporları_Detay.md)

## Hasta Ozeti

| Alan | Deger |
|---|---|
| Yas | 30 |
| Cinsiyet | MALE |
| BMI | 18.0 |
| Vital Status | LIVING |
| Risk Skoru (Son) | 28.8 |
| Risk Seviyesi | Normal |
| Anomali Durumu | Var |
| Son KMR | 0.1325 (9. Ay) |
| Son KRE | 1.34 (6. Ay) |
| Son GFR | 70.0 (6. Ay) |

## Grafikler

![Hasta AL KMR](../assets/AL_kmr.png)

![Hasta AL KRE GFR](../assets/AL_kre_gfr.png)

![Hasta AL Risk](../assets/AL_risk.png)

## IQR ve Median Ozeti

| Metrik | Hasta (Median / IQR) | Referans (Median / IQR) | Son Olcum Zamani |
|---|---|---|---|
| KMR | 0.225 / 0.404 | 0.085 / 0.100 | 9. Ay |
| KRE | 1.340 / 0.240 | 1.160 / 0.510 | 6. Ay |
| GFR | 70.000 / 13.000 | 68.500 / 36.400 | 6. Ay |

## AI Performans (Hasta Bazli)

| Metrik | Eval Nokta | MAE | RMSE | MAPE | Aralik Kapsama | Son Hata |
|---|---:|---:|---:|---:|---:|---:|
| KMR | 4 | 0.3920 | 0.4156 | %517.10 | %0.0 | 0.3853 |
| KRE | 4 | 0.210 | 0.261 | %15.33 | %50.0 | 0.360 |
| GFR | 4 | 60.22 | 61.03 | %99.54 | %0.0 | 55.00 |

## Zaman Serisi Detay Tablosu

| Zaman | KMR | AI KMR | Durum | KRE | AI KRE | Durum | GFR | AI GFR | Durum | Risk | Seviye | Anomali |
|---|---:|---:|---|---:|---:|---|---:|---:|---|---:|---|---|
| 1. Gun | - | 0.7346 | Ongoru | - | - | Uygulanmaz | - | - | Uygulanmaz | 0.0 | Normal | - |
| 2. Gun | 4.5791 | 4.5791 | Olcum Kopyasi | - | - | Uygulanmaz | - | - | Uygulanmaz | 23.0 | Normal | KMR |
| 3. Gun | - | 4.5791 | Ongoru | - | - | Uygulanmaz | - | - | Uygulanmaz | 0.0 | Normal | - |
| 4. Gun | - | 4.5791 | Ongoru | - | - | Uygulanmaz | - | - | Uygulanmaz | 0.0 | Normal | - |
| 5. Gun | 0.4731 | 0.4731 | Olcum Kopyasi | - | - | Uygulanmaz | - | - | Uygulanmaz | 14.0 | Normal | - |
| 6. Gun | - | 0.4731 | Ongoru | - | - | Uygulanmaz | - | - | Uygulanmaz | 0.0 | Normal | - |
| 7. Gun | 0.6799 | 0.6799 | Olcum Kopyasi | 1.89 | 1.89 | Olcum Kopyasi | 46.0 | 46.0 | Olcum Kopyasi | 26.1 | Normal | - |
| 2. Hafta | - | 0.6799 | Ongoru | 1.57 | 1.57 | Olcum Kopyasi | 58.0 | 58.0 | Olcum Kopyasi | 25.6 | Normal | - |
| 3. Hafta | - | 0.6799 | Ongoru | 1.33 | 1.33 | Olcum Kopyasi | 71.0 | 71.0 | Olcum Kopyasi | 17.5 | Normal | - |
| 1. Ay | - | 0.6799 | Ongoru | 1.13 | 1.13 | Olcum Kopyasi | 86.0 | 86.0 | Olcum Kopyasi | 13.7 | Normal | - |
| 2. Ay | 0.2250 | 0.2250 | Olcum Kopyasi | 1.31 | 1.31 | Olcum Kopyasi | 73.0 | 73.0 | Olcum Kopyasi | 16.1 | Normal | - |
| 3. Ay | 0.0296 | 0.0296 | Olcum Kopyasi | 1.57 | 1.62 | Model | 58.0 | 107.8 | Model | 17.2 | Normal | - |
| 4. Ay | - | 0.6004 | Ongoru | 1.73 | 1.67 | Model | 51.0 | 127.1 | Model | 28.8 | Normal | - |
| 5. Ay | 0.0687 | 0.6004 | Model | 1.33 | 1.70 | Model | 71.0 | 131.0 | Model | 19.5 | Normal | - |
| 6. Ay | - | 0.5623 | Ongoru | 1.34 | 1.70 | Model | 70.0 | 125.0 | Model | 19.8 | Normal | - |
| 7. Ay | 0.3914 | 0.5623 | Model | - | - | Uygulanmaz | - | - | Uygulanmaz | 23.3 | Normal | - |
| 8. Ay | 0.0318 | 0.5118 | Model | - | - | Uygulanmaz | - | - | Uygulanmaz | 18.4 | Normal | - |
| 9. Ay | 0.1325 | 0.5178 | Model | - | - | Uygulanmaz | - | - | Uygulanmaz | 20.8 | Normal | - |
| 10. Ay | - | 0.5585 | Ongoru | - | - | Uygulanmaz | - | - | Uygulanmaz | 0.0 | Normal | - |
| 11. Ay | - | 0.5585 | Ongoru | - | - | Uygulanmaz | - | - | Uygulanmaz | 0.0 | Normal | - |
| 12. Ay | - | 0.5585 | Ongoru | - | 1.60 | Ongoru | - | 81.5 | Ongoru | 0.0 | Normal | - |

> Not: Bu dosya `python3 backend/run_all.py` ile otomatik uretilir.
