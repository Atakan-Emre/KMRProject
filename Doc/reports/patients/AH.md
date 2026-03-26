# Hasta AH

[Ana rapora don](../../Hasta_Raporları_Detay.md)

## Hasta Ozeti

| Alan | Deger |
|---|---|
| Yas | 12 |
| Cinsiyet | MALE |
| BMI | 25.5 |
| Vital Status | LIVING |
| Risk Skoru (Son) | 34.5 |
| Risk Seviyesi | Dikkat |
| Anomali Durumu | Var |
| Son KMR | 0.1602 (11. Ay) |
| Son KRE | 0.70 (6. Ay) |
| Son GFR | - (-) |

## Grafikler

![Hasta AH KMR](../assets/AH_kmr.png)

![Hasta AH KRE GFR](../assets/AH_kre_gfr.png)

![Hasta AH Risk](../assets/AH_risk.png)

## IQR ve Median Ozeti

| Metrik | Hasta (Median / IQR) | Referans (Median / IQR) | Son Olcum Zamani |
|---|---|---|---|
| KMR | 0.488 / 2.244 | 0.110 / 0.139 | 11. Ay |
| KRE | 0.700 / 0.090 | 1.160 / 0.510 | 6. Ay |
| GFR | - / - | - / - | - |

## AI Performans (Hasta Bazli)

| Metrik | Eval Nokta | MAE | RMSE | MAPE | Aralik Kapsama | Son Hata |
|---|---:|---:|---:|---:|---:|---:|
| KMR | 6 | 0.2658 | 0.3400 | %144.03 | %0.0 | 0.6808 |
| KRE | 4 | 0.077 | 0.086 | %10.25 | %50.0 | -0.040 |
| GFR | 0 | - | - | - | %0.0 | - |

## Zaman Serisi Detay Tablosu

| Zaman | KMR | AI KMR | Durum | KRE | AI KRE | Durum | GFR | AI GFR | Durum | Risk | Seviye | Anomali |
|---|---:|---:|---|---:|---:|---|---:|---:|---|---:|---|---|
| 1. Gun | 7.1234 | 7.1234 | Olcum Kopyasi | - | - | Uygulanmaz | - | - | Uygulanmaz | 24.2 | Normal | KMR |
| 2. Gun | 3.5853 | 3.5853 | Olcum Kopyasi | - | - | Uygulanmaz | - | - | Uygulanmaz | 18.4 | Normal | - |
| 3. Gun | 1.5725 | 1.5725 | Olcum Kopyasi | - | - | Uygulanmaz | - | - | Uygulanmaz | 17.5 | Normal | - |
| 4. Gun | 4.8553 | 4.8553 | Olcum Kopyasi | - | - | Uygulanmaz | - | - | Uygulanmaz | 34.5 | Dikkat | - |
| 5. Gun | 0.5231 | 0.5231 | Olcum Kopyasi | - | - | Uygulanmaz | - | - | Uygulanmaz | 15.4 | Normal | - |
| 6. Gun | - | 0.6186 | Ongoru | - | - | Uygulanmaz | - | - | Uygulanmaz | 0.0 | Normal | - |
| 7. Gun | - | 0.6186 | Ongoru | 0.69 | 0.69 | Olcum Kopyasi | - | - | Yetersiz Veri | 5.2 | Normal | - |
| 2. Hafta | - | 0.6186 | Ongoru | 0.88 | 0.88 | Olcum Kopyasi | - | - | Yetersiz Veri | 9.4 | Normal | - |
| 3. Hafta | - | 0.6186 | Ongoru | 0.67 | 0.67 | Olcum Kopyasi | - | - | Yetersiz Veri | 11.0 | Normal | - |
| 1. Ay | 0.4021 | 0.6186 | Model | 0.56 | 0.56 | Olcum Kopyasi | - | - | Yetersiz Veri | 15.6 | Normal | - |
| 2. Ay | - | 0.3258 | Ongoru | 0.74 | 0.74 | Olcum Kopyasi | - | - | Yetersiz Veri | 10.6 | Normal | - |
| 3. Ay | 0.4693 | 0.3258 | Model | 0.69 | 0.65 | Model | - | - | Yetersiz Veri | 18.4 | Normal | - |
| 4. Ay | - | 0.1921 | Ongoru | 0.78 | 0.66 | Model | - | - | Yetersiz Veri | 4.6 | Normal | - |
| 5. Ay | - | 0.1921 | Ongoru | 0.78 | 0.67 | Model | - | - | Yetersiz Veri | 4.7 | Normal | - |
| 6. Ay | 0.2668 | 0.1921 | Model | 0.70 | 0.66 | Model | - | - | Yetersiz Veri | 12.6 | Normal | - |
| 7. Ay | 0.4879 | 0.3937 | Model | - | - | Uygulanmaz | - | - | Uygulanmaz | 10.5 | Normal | - |
| 8. Ay | - | 0.5102 | Ongoru | - | - | Uygulanmaz | - | - | Uygulanmaz | 0.0 | Normal | - |
| 9. Ay | - | 0.5102 | Ongoru | - | - | Uygulanmaz | - | - | Uygulanmaz | 0.0 | Normal | - |
| 10. Ay | 0.1252 | 0.5102 | Model | - | - | Uygulanmaz | - | - | Uygulanmaz | 7.7 | Normal | - |
| 11. Ay | 0.1602 | 0.8410 | Model | - | - | Uygulanmaz | - | - | Uygulanmaz | 11.3 | Normal | - |
| 12. Ay | - | 1.3667 | Ongoru | - | 0.65 | Model | - | - | Yetersiz Veri | 0.0 | Normal | - |

> Not: Bu dosya `python3 backend/run_all.py` ile otomatik uretilir.
