# Hasta AP

[Ana rapora don](../../Hasta_Raporları_Detay.md)

## Hasta Ozeti

| Alan | Deger |
|---|---|
| Yas | 49 |
| Cinsiyet | MALE |
| BMI | 31.0 |
| Vital Status | LIVING |
| Risk Skoru (Son) | 61.0 |
| Risk Seviyesi | Kritik |
| Anomali Durumu | Yok |
| Son KMR | 1.5175 (9. Ay) |
| Son KRE | 3.94 (6. Ay) |
| Son GFR | 17.0 (6. Ay) |

## Grafikler

![Hasta AP KMR](../assets/AP_kmr.png)

![Hasta AP KRE GFR](../assets/AP_kre_gfr.png)

![Hasta AP Risk](../assets/AP_risk.png)

## IQR ve Median Ozeti

| Metrik | Hasta (Median / IQR) | Referans (Median / IQR) | Son Olcum Zamani |
|---|---|---|---|
| KMR | 0.764 / 1.232 | 0.085 / 0.100 | 9. Ay |
| KRE | 2.600 / 1.940 | 1.160 / 0.510 | 6. Ay |
| GFR | 27.000 / 21.000 | 68.500 / 36.400 | 6. Ay |

## AI Performans (Hasta Bazli)

| Metrik | Eval Nokta | MAE | RMSE | MAPE | Aralik Kapsama | Son Hata |
|---|---:|---:|---:|---:|---:|---:|
| KMR | 3 | 0.9760 | 1.2154 | %47.33 | %33.3 | -0.0012 |
| KRE | 4 | 0.547 | 0.588 | %13.66 | %50.0 | -0.630 |
| GFR | 4 | 43.02 | 44.58 | %256.46 | %0.0 | 23.10 |

## Zaman Serisi Detay Tablosu

| Zaman | KMR | AI KMR | Durum | KRE | AI KRE | Durum | GFR | AI GFR | Durum | Risk | Seviye | Anomali |
|---|---:|---:|---|---:|---:|---|---:|---:|---|---:|---|---|
| 1. Gun | - | 1.2467 | Ongoru | - | - | Uygulanmaz | - | - | Uygulanmaz | 0.0 | Normal | - |
| 2. Gun | - | 1.2467 | Ongoru | - | - | Uygulanmaz | - | - | Uygulanmaz | 0.0 | Normal | - |
| 3. Gun | 1.7201 | 1.7201 | Olcum Kopyasi | - | - | Uygulanmaz | - | - | Uygulanmaz | 13.6 | Normal | - |
| 4. Gun | - | 1.7201 | Ongoru | - | - | Uygulanmaz | - | - | Uygulanmaz | 0.0 | Normal | - |
| 5. Gun | 0.3378 | 0.3378 | Olcum Kopyasi | - | - | Uygulanmaz | - | - | Uygulanmaz | 12.7 | Normal | - |
| 6. Gun | 0.3301 | 0.3301 | Olcum Kopyasi | - | - | Uygulanmaz | - | - | Uygulanmaz | 15.7 | Normal | - |
| 7. Gun | 0.2887 | 0.2887 | Olcum Kopyasi | 2.00 | 2.00 | Olcum Kopyasi | 38.0 | 38.0 | Olcum Kopyasi | 24.4 | Normal | - |
| 2. Hafta | 0.3489 | 0.3489 | Olcum Kopyasi | 1.67 | 1.67 | Olcum Kopyasi | 47.0 | 47.0 | Olcum Kopyasi | 25.1 | Normal | - |
| 3. Hafta | - | 2.3697 | Ongoru | 1.95 | 1.95 | Olcum Kopyasi | 39.0 | 39.0 | Olcum Kopyasi | 33.3 | Dikkat | - |
| 1. Ay | - | 2.3697 | Ongoru | 2.60 | 2.60 | Olcum Kopyasi | 27.0 | 27.0 | Olcum Kopyasi | 37.2 | Dikkat | - |
| 2. Ay | - | 2.3697 | Ongoru | 2.07 | 2.07 | Olcum Kopyasi | 36.0 | 36.0 | Olcum Kopyasi | 29.5 | Normal | - |
| 3. Ay | - | 2.3697 | Ongoru | 3.36 | 3.59 | Model | 20.0 | 68.8 | Model | 44.3 | Dikkat | - |
| 4. Ay | 1.1785 | 2.3697 | Model | 4.05 | 3.54 | Model | 16.0 | 68.9 | Model | 42.2 | Dikkat | - |
| 5. Ay | 4.2522 | 2.5165 | Model | 4.27 | 3.45 | Model | 15.0 | 62.3 | Model | 61.0 | Kritik | - |
| 6. Ay | - | 1.5163 | Ongoru | 3.94 | 3.31 | Model | 17.0 | 40.1 | Model | 50.1 | Dikkat | - |
| 7. Ay | - | 1.5163 | Ongoru | - | - | Uygulanmaz | - | - | Uygulanmaz | 0.0 | Normal | - |
| 8. Ay | - | 1.5163 | Ongoru | - | - | Uygulanmaz | - | - | Uygulanmaz | 0.0 | Normal | - |
| 9. Ay | 1.5175 | 1.5163 | Model | - | - | Uygulanmaz | - | - | Uygulanmaz | 23.5 | Normal | - |
| 10. Ay | - | 1.3126 | Ongoru | - | - | Uygulanmaz | - | - | Uygulanmaz | 0.0 | Normal | - |
| 11. Ay | - | 1.3126 | Ongoru | - | - | Uygulanmaz | - | - | Uygulanmaz | 0.0 | Normal | - |
| 12. Ay | - | 1.3126 | Ongoru | - | 3.20 | Ongoru | - | 27.7 | Ongoru | 0.0 | Normal | - |

> Not: Bu dosya `python3 backend/run_all.py` ile otomatik uretilir.
