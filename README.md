# NISTH - Non-invasive Screening of Transplantation Health

NISTH, transplant sonrası hastaların KMR/KRE/GFR ölçümlerini tek bir teknik boru hattında işleyip klinik karar desteği için risk, anomali, tahmin ve kohort karşılaştırması üreten bir sistemdir.

Sistem batch çalışır, backend API sunmaz. Tüm çıktı dosyaları `frontend/public` altında statik JSON/CSV olarak üretilir ve Next.js arayüzü bu dosyaları doğrudan okur.

## İçindekiler

1. Sistem Özeti
2. Mimari ve Bileşenler
3. Veri Girişi ve Dönüşüm Kuralları
4. Zaman Eksenleri ve Birleşik Timeline
5. Tahmin Modelleri
6. Anomali Modelleri
7. Risk Skorlama Yapısı
8. Improved Cohort Mantığı
9. Çıktı Dosyaları ve Veri Sözleşmesi
10. Doktor Paneli Performans Raporu
11. Pipeline Çalıştırma (run_all)
12. Tam Doğrulama (full_system_check)
13. Frontend Entegrasyonu
14. Operasyonel Notlar ve Limitasyonlar
15. Hızlı Komut Referansı

## 1) Sistem Özeti

NISTH aşağıdaki sorulara cevap verir:

- Hastanın her zaman noktasındaki toplam klinik riski nedir?
- Bu risk KMR kaynaklı mı LAB kaynaklı mı?
- Ölçüm dışı zaman noktalarında risk nasıl ele alınmalı?
- Anomali var mı, hangi metrikte var?
- Hasta trendi iyileşmiş kohort davranışına ne kadar yakın?
- Modelin hasta bazlı tahmin performansı nedir?

Temel çıktı ürünleri:

- hasta detay timeline JSON dosyaları,
- dashboard özet dosyaları,
- referans bant/kohort analizi,
- doktor paneli hasta bazlı performans raporu.

## 2) Mimari ve Bileşenler

```mermaid
flowchart TD
    A["Excel Kaynağı\n/data/data.xlsx"] --> B["I/O Katmanı\nbackend/io_excel.py"]
    B --> C["KMR Tahmin\nbackend/kmr_model.py"]
    B --> D["LAB Tahmin\nbackend/lab_model.py"]
    B --> E["KMR Anomali\nbackend/anomaly_vae.py"]
    B --> F["LAB Anomali\nbackend/lab_anomaly_vae.py"]
    C --> G["Risk Hesaplama\nbackend/risk_scoring.py"]
    D --> G
    E --> G
    F --> G
    B --> H["Referans Band\nbackend/reference_band.py"]
    G --> I["Export\nbackend/export_json.py"]
    H --> I
    I --> J["frontend/public/*.json,*.csv"]
    J --> K["Next.js UI\nfrontend/src"]
```

### Backend Modülleri

- `backend/io_excel.py`
  - Excel okuma, kolon normalize etme, long format üretimi, improved cohort etiketleme
- `backend/time_mapping.py`
  - KMR/LAB/unified timeline sözleşmesi
- `backend/kmr_model.py`
  - KMR için hasta bazlı tahmin
- `backend/lab_model.py`
  - KRE/GFR tahmini (tekli ve çoklu çıktı)
- `backend/anomaly_vae.py`
  - KMR anomali skorları
- `backend/lab_anomaly_vae.py`
  - KRE/GFR anomali skorları
- `backend/risk_scoring.py`
  - Bileşen riskleri + birleşik risk + alarm seviyesi
- `backend/reference_band.py`
  - Improved cohort referans bantları ve trend çizgileri
- `backend/export_json.py`
  - Frontend’e sunulacak tüm JSON/CSV sözleşmeleri
- `backend/run_all.py`
  - Uçtan uca pipeline orkestrasyonu
- `backend/full_system_check.py`
  - Uçtan uca veri + şema + frontend build doğrulaması

## 3) Veri Girişi ve Dönüşüm Kuralları

### Birincil Kaynak

- `data/data.xlsx`

### Alan Grupları

- Hasta meta alanları:
  - `patient_code`, `age`, `BMI`, `vital_status`, `blood_group`, `gender`
- KMR alanları:
  - `Day_1..Day_7`, `Week_2..Week_4`, `Month_2..Month_12`
- LAB alanları:
  - `*_KRE`, `*_GFR` çiftleri (`Day_7`, `Week_2`, `Week_3`, `Month_1..Month_6`, `Month_12`)

### Dönüşüm Kuralları

- `io_excel.load_excel` kolon adlarında boşluk/format sorunlarını normalize eder.
- KMR `wide -> long` dönüşümü:
  - çıktı kolonları: `patient_code`, `time_key`, `time_order`, `pseudo_time_days`, `kmr`
- LAB `wide -> long` dönüşümü:
  - çıktı kolonları: `patient_code`, `time_key`, `time_order`, `pseudo_time_days`, `kre`, `gfr`
- Sadece mevcut (non-null) ölçüm satırları long yapıya eklenir.

## 4) Zaman Eksenleri ve Birleşik Timeline

Kaynak: `backend/time_mapping.py`

Sistem üç farklı harita kullanır:

- `KMR_TIME_MAP` (21 nokta)
- `LAB_TIME_MAP` (10 nokta)
- `UNIFIED_TIME_MAP` (22 nokta)

`UNIFIED_TIME_MAP` alanları:

- `order`: grafik ve model sırası
- `pseudo_days`: gün bazlı analitik zaman
- `has_kmr`: bu noktada KMR beklenir mi
- `has_lab`: bu noktada KRE/GFR beklenir mi

```mermaid
flowchart LR
    A["Day_1..Day_7"] --> U
    B["Week_2..Week_4"] --> U
    C["Month_1..Month_12"] --> U
    U["UNIFIED_TIME_MAP"] --> T["Tek Timeline\n22 nokta"]
```

Bu yaklaşım sayesinde:

- tüm paneller aynı zaman düzenini kullanır,
- LAB ve KMR ölçüm boşlukları açıkça ayrıştırılır,
- tahmin durumu (`*_pred_status`) anlaşılır hale gelir.

## 5) Tahmin Modelleri

## 5.1 KMR Tahmini (`backend/kmr_model.py`)

Model davranışı:

- TensorFlow varsa LSTM/GRU tabanlı hasta modelleri,
- veri azsa fallback tahmini,
- unified grid üzerinde geçmiş + ileri tahmin üretimi.

Feature engineering (özet):

- baseline farkı (`delta_from_baseline`)
- baseline oranı (`ratio_from_baseline`)
- EWMA
- rolling CV
- kısa dönem eğim

Stabilite kuralları:

- fizyolojik sınır clamp (`0..100`)
- interval düzeni (`pred_lo <= pred <= pred_hi`)

Üretilen alanlar:

- `kmr_pred`, `kmr_pred_lo`, `kmr_pred_hi`, `residual`

## 5.2 LAB Tahmini (`backend/lab_model.py`)

Model davranışı:

- KRE ve GFR için tekli veya çoklu-output model,
- unified LAB timeline üzerinde tahmin,
- GFR için hasta-içi bias kalibrasyonu.

Stabilite kuralları:

- KRE clamp: `0..15`
- GFR clamp: `0..180`
- interval düzeni garanti

Üretilen alanlar:

- `kre_pred`, `kre_pred_lo`, `kre_pred_hi`
- `gfr_pred`, `gfr_pred_lo`, `gfr_pred_hi`

## 6) Anomali Modelleri

## 6.1 KMR Anomali (`backend/anomaly_vae.py`)

- VAE/autoencoder yaklaşımıyla reconstruction error tabanlı skor.
- Eğitim başarısızsa basit eşik/z-score fallback.

Üretilen alanlar:

- `kmr_anomaly_score`
- `kmr_anomaly_flag`

## 6.2 LAB Anomali (`backend/lab_anomaly_vae.py`)

- KRE ve GFR için ayrı model/fallback.
- Uygun olduğunda multi-output öğrenme.

Üretilen alanlar:

- `kre_anomaly_score`, `kre_anomaly_flag`
- `gfr_anomaly_score`, `gfr_anomaly_flag`

## 7) Risk Skorlama Yapısı

Kaynaklar:

- `backend/risk_scoring.py`
- `backend/config.py`

```mermaid
flowchart TD
    A["KMR Level"] --> K
    B["KMR Trend"] --> K
    C["KMR Volatility"] --> K
    D["KMR AE"] --> K
    E["KMR Residual"] --> K
    K["KMR Risk"] --> O["Overall Risk"]

    F["KRE Level"] --> L
    G["GFR Level"] --> L
    H["LAB Trend"] --> L
    I["LAB Anomaly"] --> L
    L["LAB Risk"] --> O

    O --> R["Alarm Level"]
```

## 7.1 KMR Seviye Kuralı

Klinik eşikler:

- `<=0.5`: iyi
- `0.5-2`: dikkat
- `2-5`: kritik
- `>5`: çok kritik

Erken faz ağırlığı:

- `pseudo_days <= 2`: `*0.55`
- `3..6`: `*0.80`
- `>=7`: `*1.00`

## 7.2 KMR Risk Formülü

```text
kmr_risk =
  0.35*kmr_level +
  0.25*kmr_trend +
  0.10*kmr_volatility +
  0.15*kmr_ae +
  0.15*kmr_residual
```

## 7.3 LAB Risk Kuralları

- KRE düşükse iyi, GFR yüksekse iyi.
- Trend:
  - KRE düşüşü olumlu,
  - GFR artışı olumlu.
- LAB anomaly katkısı eklenir.

Ağırlıklar:

- `lab_level_weight = 0.6`
- `lab_trend_weight = 0.4`
- iç anomaly katkısı: `0.3`
- son çıktı ölçeği: `*0.9`

## 7.4 Genel Risk ve Alarm

```text
overall_risk = 0.65*kmr_risk + 0.35*min(lab_risk, kmr_risk+20)
```

Alarm eşikleri:

- `0-29.9` => `Normal`
- `30-59.9` => `Dikkat`
- `60-79.9` => `Kritik`
- `80-100` => `Çok Kritik`

## 7.5 Ölçüm Boşluğu Politikası

Aynı zaman noktasında `kmr`, `kre`, `gfr` hepsi boş ise:

- `overall_risk = 0`
- trend carry-forward uygulanmaz

Bu karar, ölçüm olmayan noktalarda yanlış alarm birikimini engeller.

## 7.6 Tahmin Durum Kodları

Timeline, her metrik için aşağıdaki status alanlarını taşır:

- `kmr_pred_status`
- `kre_pred_status`
- `gfr_pred_status`

Olası değerler:

- `ok`
- `timepoint_not_applicable`
- `insufficient_data`
- `missing_prediction`

Bu sayede UI, boş tahmini “neden boş” olarak açıklayabilir.

## 8) Improved Cohort Mantığı

Kaynak: `backend/io_excel.py::calculate_improved_proxy`

Kural seti:

1. Aday hasta: `Month_9..Month_12` içinde en az bir KMR değeri
2. Klinik iyileşme:
   - KMR: `last < 0.5` veya ilk değere göre güçlü düşüş
   - KRE: `last < 1.2` veya kötüleşmeme
   - GFR: `last >= 90` veya kötüleşmeme
3. Katı kohort çok küçükse fallback: aday kohort

Bu kohort aşağıdaki üretimlerde kullanılır:

- referans bant
- kohort trajectory
- klinik benchmark görselleri

## 9) Çıktı Dosyaları ve Veri Sözleşmesi

Pipeline çıktıları (`frontend/public`):

- `patients/{patient_code}.json`
- `patient_features.json`
- `data_summary.json`
- `reference_band.json`
- `cohort_trajectory.json`
- `cohort_trajectory_lab.json`
- `channel_overview.json`
- `doctor_performance_report.json`
- `doctor_performance_report.csv`

## 9.1 Hasta Timeline JSON (özet sözleşme)

```json
{
  "meta": {
    "patient_code": "AB",
    "improved_proxy": true
  },
  "timeline": [
    {
      "time_key": "Day_7",
      "kmr": 0.81,
      "kre": 1.42,
      "gfr": 74.0,
      "kmr_pred": 0.88,
      "kmr_pred_status": "ok",
      "kre_pred_status": "ok",
      "gfr_pred_status": "ok",
      "kmr_anomaly_flag": false,
      "risk_score": 31.4,
      "risk_level": "Dikkat"
    }
  ],
  "last_status": {
    "kmr_last": 0.49,
    "risk_last": 24.3,
    "risk_level_last": "Normal"
  }
}
```

## 9.2 Patient Features JSON (özet)

- liste ekranı için optimize hafif hasta kaydı
- son gerçek ölçüm değerleri + son ölçüm zamanları
- anomali rozetleri + risk seviyeleri

## 9.3 Data Summary JSON (özet)

- toplam hasta sayısı
- improved cohort sayısı
- anomalili hasta sayısı
- risk dağılımı
- ortalama skorlar

## 10) Doktor Paneli Performans Raporu

Dosyalar:

- `frontend/public/doctor_performance_report.json`
- `frontend/public/doctor_performance_report.csv`

Amaç:

- modelin hasta bazlı tahmin kalitesini ölçmek,
- hangi metrikte sapma olduğunu hızlı görmek,
- klinik review toplantılarında doğrudan kullanılabilir performans dökümü sağlamak.

Alanlar (hasta bazlı):

- `n_actual_points`, `n_pred_points`, `n_eval_points`
- `mae`, `rmse`, `mape_percent`, `bias`
- `n_interval_points`, `interval_coverage`
- `last_actual`, `last_pred`, `last_error`

```mermaid
flowchart LR
    A["patients/{id}.json timeline"] --> B["Metric Evaluation\nactual vs pred"]
    B --> C["Per-Patient Metrics\nMAE RMSE MAPE Coverage"]
    C --> D["doctor_performance_report.json"]
    C --> E["doctor_performance_report.csv"]
```

## 11) Pipeline Çalıştırma (`run_all.py`)

`backend/run_all.py` artık varsayılan olarak:

- önce eski üretilmiş çıktıları temizler,
- sonra tüm eğitimi sıfırdan yapar,
- en son atomik publish yapar.

```bash
python3 backend/run_all.py
```

Temizliği atlamak için:

```bash
python3 backend/run_all.py --skip-clean
```

### Pipeline Adımları

```mermaid
sequenceDiagram
    participant U as User
    participant R as run_all.py
    participant IO as io_excel.py
    participant M as Models
    participant S as risk_scoring.py
    participant E as export_json.py
    participant P as frontend/public

    U->>R: python3 backend/run_all.py
    R->>R: Step 0 temizle (varsayılan)
    R->>IO: Excel yükle + long format
    R->>M: KMR/LAB tahmin eğitimi
    R->>M: KMR/LAB anomali eğitimi
    R->>S: Unified timeline risk hesapla
    R->>E: JSON/CSV export staging
    E->>P: Atomik publish
    R-->>U: Pipeline complete
```

## 12) Tam Doğrulama (`full_system_check.py`)

```bash
python3 backend/full_system_check.py
```

Kontrol kapsamı:

- Excel -> JSON KMR/KRE/GFR birebir değer kontrolü
- JSON şema ve tutarlılık
- risk/aralık/flag doğrulaması
- doktor raporu dosya + şema + hasta sayısı kontrolü
- frontend lint + production build

Bu komut release öncesi kalite kapısıdır.

## 13) Frontend Entegrasyonu

Ana data hook:

- `frontend/src/hooks/useKimerizmData.ts`

Ana sayfalar:

- `/` dashboard
- `/patients` liste
- `/patients/[id]` detay
- `/reports` rapor indirimi
- `/model-evaluation` model ekranı

Rapor sayfası:

- klasik hasta CSV/PDF
- doktor performans CSV/JSON indirme

## 14) Operasyonel Notlar ve Limitasyonlar

- Sistem batch tabanlıdır, gerçek zamanlı API sunmaz.
- TensorFlow yoksa fallback devreye girer; kalite etkilenebilir.
- Klinik kararlar için tek başına kullanılmamalıdır.
- Girdi kalitesi (`data.xlsx`) doğrudan çıktı kalitesini etkiler.

## 15) Hızlı Komut Referansı

```bash
# bağımlılıklar
pip install -r requirements.txt
cd frontend && npm install && cd ..

# tam pipeline (clean + train + export)
python3 backend/run_all.py

# tam doğrulama
python3 backend/full_system_check.py

# frontend geliştirme
cd frontend && npm run dev

# frontend kalite kontrol
cd frontend && npm run lint && npm run build:next
```

## Ek Dokümanlar

- Sistem raporu: `Doc/SISTEM_RAPORU.md`
- Mimari: `Doc/SISTEM_MIMARISI.md`
- Grafik açıklamaları: `Doc/GRAFIK_ACIKLAMA_DOKÜMANTASYON.md`
- Gelişmiş sistem notları: `Doc/GELISMIS_KIMERIZM_SISTEMI_v2.md`
- Kurulum: `kurulum.md`, `frontend/kurulum.md`

## Klinik Uyarı

Bu sistem karar destek amaçlıdır. Nihai klinik kararlar uzman hekim değerlendirmesi ile alınmalıdır.
