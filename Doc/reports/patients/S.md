# Hasta S

[Ana rapora don](../../Hasta_Raporları_Detay.md)

## Hasta Ozeti

| Alan | Deger |
|---|---|
| Yas | 39 |
| Cinsiyet | FEMALE |
| BMI | 18.5 |
| Vital Status | LIVING |
| Risk Skoru (Son) | 33.9 |
| Risk Seviyesi | Dikkat |
| Anomali Durumu | Var |
| Son KMR | 2.6796 (5. Ay) |
| Son KRE | 1.22 (12. Ay) |
| Son GFR | 56.0 (12. Ay) |

## Grafikler

![Hasta S KMR](../assets/S_kmr.png)

![Hasta S KRE GFR](../assets/S_kre_gfr.png)

![Hasta S Risk](../assets/S_risk.png)

## IQR ve Median Ozeti

| Metrik | Hasta (Median / IQR) | Referans (Median / IQR) | Son Olcum Zamani |
|---|---|---|---|
| KMR | 9.046 / 10.330 | 0.206 / 0.422 | 5. Ay |
| KRE | 1.225 / 0.113 | 1.050 / 0.610 | 12. Ay |
| GFR | 55.500 / 6.000 | 64.000 / 13.500 | 12. Ay |

## AI Performans (Hasta Bazli)

| Metrik | Eval Nokta | MAE | RMSE | MAPE | Aralik Kapsama | Son Hata |
|---|---:|---:|---:|---:|---:|---:|
| KMR | 2 | 0.3400 | 0.4562 | %11.11 | %50.0 | -0.0357 |
| KRE | 5 | 0.168 | 0.178 | %12.67 | %60.0 | 0.160 |
| GFR | 5 | 8.42 | 10.38 | %18.98 | %40.0 | -9.80 |

## Zaman Serisi Detay Tablosu

| Zaman | KMR | AI KMR | Durum | KRE | AI KRE | Durum | GFR | AI GFR | Durum | Risk | Seviye | Anomali |
|---|---:|---:|---|---:|---:|---|---:|---:|---|---:|---|---|
| 1. Gun | 12.7713 | 12.7713 | Olcum Kopyasi | - | - | Uygulanmaz | - | - | Uygulanmaz | 21.8 | Normal | KMR |
| 2. Gun | 14.7491 | 14.7491 | Olcum Kopyasi | - | - | Uygulanmaz | - | - | Uygulanmaz | 23.6 | Normal | KMR |
| 3. Gun | 13.6520 | 13.6520 | Olcum Kopyasi | - | - | Uygulanmaz | - | - | Uygulanmaz | 33.9 | Dikkat | KMR |
| 4. Gun | 9.0457 | 9.0457 | Olcum Kopyasi | - | - | Uygulanmaz | - | - | Uygulanmaz | 30.2 | Dikkat | KMR |
| 5. Gun | 0.5496 | 0.5496 | Olcum Kopyasi | - | - | Uygulanmaz | - | - | Uygulanmaz | 15.1 | Normal | - |
| 6. Gun | 3.0841 | 3.7283 | Model | - | - | Uygulanmaz | - | - | Uygulanmaz | 29.7 | Normal | - |
| 7. Gun | - | 2.6439 | Ongoru | 1.19 | 1.19 | Olcum Kopyasi | 57.0 | 57.0 | Olcum Kopyasi | 22.3 | Normal | - |
| 2. Hafta | - | 2.6439 | Ongoru | 1.11 | 1.11 | Olcum Kopyasi | 62.6 | 62.6 | Olcum Kopyasi | 20.9 | Normal | - |
| 3. Hafta | - | 2.6439 | Ongoru | 1.23 | 1.23 | Olcum Kopyasi | 55.0 | 55.0 | Olcum Kopyasi | 16.4 | Normal | - |
| 1. Ay | - | 2.6439 | Ongoru | 1.08 | 1.08 | Olcum Kopyasi | 65.0 | 65.0 | Olcum Kopyasi | 21.0 | Normal | - |
| 2. Ay | - | 2.6439 | Ongoru | 1.18 | 1.18 | Olcum Kopyasi | 58.0 | 58.0 | Olcum Kopyasi | 22.4 | Normal | - |
| 3. Ay | - | 2.6439 | Ongoru | 1.31 | 1.55 | Model | 51.0 | 56.0 | Model | 18.5 | Normal | - |
| 4. Ay | - | 2.6439 | Ongoru | 1.67 | 1.55 | Model | 38.0 | 56.5 | Model | 28.1 | Normal | - |
| 5. Ay | 2.6796 | 2.6439 | Model | 1.42 | 1.51 | Model | 46.5 | 55.2 | Model | 28.0 | Normal | - |
| 6. Ay | - | 3.1420 | Ongoru | 1.25 | 1.48 | Model | 54.0 | 53.9 | Model | 17.0 | Normal | - |
| 7. Ay | - | 3.1420 | Ongoru | - | - | Uygulanmaz | - | - | Uygulanmaz | 0.0 | Normal | - |
| 8. Ay | - | 3.1420 | Ongoru | - | - | Uygulanmaz | - | - | Uygulanmaz | 0.0 | Normal | - |
| 9. Ay | - | 3.1420 | Ongoru | - | - | Uygulanmaz | - | - | Uygulanmaz | 0.0 | Normal | - |
| 10. Ay | - | 3.1420 | Ongoru | - | - | Uygulanmaz | - | - | Uygulanmaz | 0.0 | Normal | - |
| 11. Ay | - | 3.1420 | Ongoru | - | - | Uygulanmaz | - | - | Uygulanmaz | 0.0 | Normal | - |
| 12. Ay | - | 3.1420 | Ongoru | 1.22 | 1.38 | Model | 56.0 | 46.2 | Model | 16.3 | Normal | - |

> Not: Bu dosya `python3 backend/run_all.py` ile otomatik uretilir.
