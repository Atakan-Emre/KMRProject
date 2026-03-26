# Hasta AS

[Ana rapora don](../../Hasta_Raporları_Detay.md)

## Hasta Ozeti

| Alan | Deger |
|---|---|
| Yas | 18 |
| Cinsiyet | FEMALE |
| BMI | 26.0 |
| Vital Status | LIVING |
| Risk Skoru (Son) | 24.5 |
| Risk Seviyesi | Normal |
| Anomali Durumu | Var |
| Son KMR | 0.2331 (9. Ay) |
| Son KRE | 0.75 (6. Ay) |
| Son GFR | 117.0 (6. Ay) |

## Grafikler

![Hasta AS KMR](../assets/AS_kmr.png)

![Hasta AS KRE GFR](../assets/AS_kre_gfr.png)

![Hasta AS Risk](../assets/AS_risk.png)

## IQR ve Median Ozeti

| Metrik | Hasta (Median / IQR) | Referans (Median / IQR) | Son Olcum Zamani |
|---|---|---|---|
| KMR | 0.202 / 0.531 | 0.085 / 0.100 | 9. Ay |
| KRE | 0.760 / 0.320 | 1.160 / 0.510 | 6. Ay |
| GFR | 114.000 / 42.000 | 68.500 / 36.400 | 6. Ay |

## AI Performans (Hasta Bazli)

| Metrik | Eval Nokta | MAE | RMSE | MAPE | Aralik Kapsama | Son Hata |
|---|---:|---:|---:|---:|---:|---:|
| KMR | 7 | 0.3721 | 0.3873 | %243.83 | %0.0 | 0.4051 |
| KRE | 4 | 0.095 | 0.104 | %13.12 | %75.0 | 0.130 |
| GFR | 4 | 29.50 | 30.46 | %24.74 | %0.0 | 21.40 |

## Zaman Serisi Detay Tablosu

| Zaman | KMR | AI KMR | Durum | KRE | AI KRE | Durum | GFR | AI GFR | Durum | Risk | Seviye | Anomali |
|---|---:|---:|---|---:|---:|---|---:|---:|---|---:|---|---|
| 1. Gun | 4.0976 | 4.0976 | Olcum Kopyasi | - | - | Uygulanmaz | - | - | Uygulanmaz | 23.0 | Normal | KMR |
| 2. Gun | 1.3695 | 1.3695 | Olcum Kopyasi | - | - | Uygulanmaz | - | - | Uygulanmaz | 14.0 | Normal | - |
| 3. Gun | 0.1370 | 0.1370 | Olcum Kopyasi | - | - | Uygulanmaz | - | - | Uygulanmaz | 12.0 | Normal | - |
| 4. Gun | 0.6115 | 0.6115 | Olcum Kopyasi | - | - | Uygulanmaz | - | - | Uygulanmaz | 19.9 | Normal | - |
| 5. Gun | - | 0.6115 | Ongoru | - | - | Uygulanmaz | - | - | Uygulanmaz | 0.0 | Normal | - |
| 6. Gun | - | 0.6115 | Ongoru | - | - | Uygulanmaz | - | - | Uygulanmaz | 0.0 | Normal | - |
| 7. Gun | - | 0.6115 | Ongoru | 1.13 | 1.13 | Olcum Kopyasi | 71.0 | 71.0 | Olcum Kopyasi | 18.5 | Normal | - |
| 2. Hafta | - | 0.6115 | Ongoru | 1.09 | 1.09 | Olcum Kopyasi | 75.0 | 75.0 | Olcum Kopyasi | 16.2 | Normal | - |
| 3. Hafta | - | 0.6115 | Ongoru | 1.07 | 1.07 | Olcum Kopyasi | 75.0 | 75.0 | Olcum Kopyasi | 18.0 | Normal | - |
| 1. Ay | - | 0.6115 | Ongoru | 0.83 | 0.83 | Olcum Kopyasi | 103.0 | 103.0 | Olcum Kopyasi | 10.7 | Normal | - |
| 2. Ay | 0.1502 | 0.1502 | Olcum Kopyasi | 0.76 | 0.76 | Olcum Kopyasi | 114.0 | 114.0 | Olcum Kopyasi | 13.5 | Normal | - |
| 3. Ay | 0.1096 | 0.4941 | Model | 0.73 | 0.80 | Model | 121.0 | 153.1 | Model | 15.4 | Normal | GFR |
| 4. Ay | 0.1597 | 0.5604 | Model | 0.76 | 0.80 | Model | 115.0 | 155.7 | Model | 16.6 | Normal | - |
| 5. Ay | 0.3929 | 0.5821 | Model | 0.69 | 0.83 | Model | 127.0 | 150.8 | Model | 18.2 | Normal | GFR |
| 6. Ay | 0.0889 | 0.6131 | Model | 0.75 | 0.88 | Model | 117.0 | 138.4 | Model | 13.0 | Normal | - |
| 7. Ay | 0.1711 | 0.6251 | Model | - | - | Uygulanmaz | - | - | Uygulanmaz | 19.8 | Normal | - |
| 8. Ay | 0.8768 | 0.6301 | Model | - | - | Uygulanmaz | - | - | Uygulanmaz | 24.5 | Normal | - |
| 9. Ay | 0.2331 | 0.6382 | Model | - | - | Uygulanmaz | - | - | Uygulanmaz | 18.5 | Normal | - |
| 10. Ay | - | 0.6320 | Ongoru | - | - | Uygulanmaz | - | - | Uygulanmaz | 0.0 | Normal | - |
| 11. Ay | - | 0.6320 | Ongoru | - | - | Uygulanmaz | - | - | Uygulanmaz | 0.0 | Normal | - |
| 12. Ay | - | 0.6320 | Ongoru | - | 0.93 | Ongoru | - | 108.6 | Ongoru | 0.0 | Normal | - |

> Not: Bu dosya `python3 backend/run_all.py` ile otomatik uretilir.
