# NISTH - Non-invasive Screening of Transplantation Health

**Organ nakli sonrası hasta takibi için hibrit AI tabanlı zaman serisi analiz ve risk değerlendirme sistemi.**

[![Version](https://img.shields.io/badge/version-3.0-blue.svg)](https://github.com)
[![Python](https://img.shields.io/badge/python-3.9+-green.svg)](https://python.org)
[![Next.js](https://img.shields.io/badge/Next.js-15.4-black.svg)](https://nextjs.org)
[![TensorFlow](https://img.shields.io/badge/TensorFlow-2.10+-orange.svg)](https://tensorflow.org)

---

## Genel Bakış

NISTH, organ nakli sonrası hastaların takibini kolaylaştıran, yapay zeka destekli bir karar destek sistemidir. Sistem üç temel biyomarkırı entegre ederek kapsamlı risk değerlendirmesi sunar:

- **KMR (Kimerizm)**: Donör hücre oranı takibi
- **KRE (Kreatinin)**: Böbrek fonksiyon göstergesi
- **GFR (Glomerüler Filtrasyon Hızı)**: Böbrek filtrasyon kapasitesi

### Temel Özellikler

| Özellik | Açıklama |
|---------|----------|
| **LSTM Tahmin** | Dinamik karmaşıklıklı zaman serisi tahmini |
| **VAE Anomali Tespiti** | Autoencoder tabanlı anormal pattern algılama |
| **Ensemble Risk Skoru** | 5 bileşenli ağırlıklı risk değerlendirmesi |
| **İnteraktif Dashboard** | Next.js + Plotly tabanlı görselleştirme |
| **Kohort Karşılaştırma** | İyileşmiş hasta referans bandı |

---

## Sistem Mimarisi

```bash
┌─────────────────────────────────────────────────────────────────┐
│                        NISTH v3.0                               │
├─────────────────────────────────────────────────────────────────┤
│  Excel Veri Kaynağı                                             │
│         │                                                       │
│         ▼                                                       │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐       │
│  │   io_excel  │────▶│ time_mapping│────▶│  Unified    │       │
│  │    .py      │     │    .py      │     │  Timeline   │       │
│  └─────────────┘     └─────────────┘     └──────┬──────┘       │
│                                                  │               │
│         ┌────────────────────┬──────────────────┼───────────┐   │
│         ▼                    ▼                  ▼           │   │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐   │   │
│  │ KMRPredictor│     │KMRAnomaly   │     │ Reference   │   │   │
│  │   (LSTM)    │     │ Detector    │     │   Band      │   │   │
│  └──────┬──────┘     └──────┬──────┘     └──────┬──────┘   │   │
│         │                   │                   │           │   │
│         └───────────────────┴───────────────────┘           │   │
│                             │                               │   │
│                             ▼                               │   │
│                    ┌─────────────┐                          │   │
│                    │ RiskScorer  │◀─────────────────────────┘   │
│                    └──────┬──────┘                              │
│                           │                                     │
│                           ▼                                     │
│                    ┌─────────────┐                              │
│                    │ export_json │                              │
│                    └──────┬──────┘                              │
│                           │                                     │
├───────────────────────────┼─────────────────────────────────────┤
│                           ▼                                     │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                   Next.js Frontend                        │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐ │  │
│  │  │ Dashboard│  │ Patients │  │  Model   │  │ Reports  │ │  │
│  │  │   Page   │  │  Detail  │  │Evaluation│  │   Page   │ │  │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘ │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Kurulum

### Gereksinimler

```bash
# Backend
Python 3.9+
TensorFlow 2.10+
pandas, numpy, openpyxl, scikit-learn

# Frontend
Node.js 18+
npm veya yarn
```

### Adım Adım Kurulum

```bash
# 1. Repository'yi klonlayın
git clone https://github.com/your-repo/KMRProject.git
cd KMRProject

# 2. Python sanal ortam oluşturun (önerilir)
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# 3. Backend bağımlılıklarını yükleyin
pip install -r requirements.txt

# 4. Frontend bağımlılıklarını yükleyin
cd frontend
npm install
```

---

## Kullanım

### 1. Backend Pipeline Çalıştırma

```bash
# Excel verilerini işle ve JSON çıktıları oluştur
python -m backend.run_all
```

Bu komut sırasıyla:
1. Excel dosyasından veri okur
2. LSTM tahmin modellerini eğitir
3. VAE anomali dedektörünü eğitir
4. Risk skorlarını hesaplar
5. Referans bantlarını oluşturur
6. JSON dosyalarını frontend/public/ dizinine yazar

### 2. Frontend Geliştirme Sunucusu

```bash
cd frontend
npm run dev
```

Uygulama `http://localhost:3000` adresinde çalışır.

### 3. Üretim Build

```bash
cd frontend
npm run build
npm start
```

---

## AI Model Detayları

### LSTM Tahmin Modeli

**Dinamik Karmaşıklık**: Veri miktarına göre otomatik model seçimi

| Veri Noktası | Model Tipi | Katmanlar |
|--------------|------------|-----------|
| < 10 | Simple GRU | GRU(16) |
| 10-20 | Medium LSTM | LSTM(32) → LSTM(16) |
| > 20 | Complex LSTM | LSTM(64) → LSTM(32) → LSTM(16) |

**Özellik Mühendisliği**:
- `delta_from_baseline`: İlk haftadan sapma
- `ratio_from_baseline`: Baseline oranı
- `ewma`: Üstel hareketli ortalama (span=3)
- `rolling_cv`: Kayan varyasyon katsayısı
- `slope_short`: Son 3 nokta eğimi

### VAE Anomali Dedektörü

**Mimari**:
```bash
Encoder: Input(5) → Dense(16) → Dense(8) → Latent(4)
Decoder: Latent(4) → Dense(8) → Dense(16) → Output(5)
```

**Anomali Skoru**:
```python
score = reconstruction_error / (Q3 + 1.5 * IQR)
anomaly = score > 1.0
```

---

## Risk Skorlama

### 5 Bileşenli Ensemble

| Bileşen | Ağırlık | Açıklama |
|---------|---------|----------|
| KMR Skoru | 30% | Trend ve seviye analizi |
| LAB Skoru | 25% | Kreatinin + GFR değerlendirmesi |
| LSTM Residual | 20% | Tahmin hatası bazlı anomali |
| VAE Anomali | 15% | Rekonstrüksiyon hatası |
| Volatilite | 10% | Değişkenlik analizi |

### Risk Kategorileri

| Skor Aralığı | Kategori | Renk |
|--------------|----------|------|
| 0-20 | Çok Düşük | 🟢 Yeşil |
| 20-40 | Düşük | 🟡 Açık Yeşil |
| 40-60 | Orta | 🟠 Sarı |
| 60-80 | Yüksek | 🟠 Turuncu |
| 80-100 | Çok Yüksek | 🔴 Kırmızı |

---

## Frontend Sayfaları

### Ana Sayfa (Dashboard)
- Toplam hasta sayısı ve risk dağılımı
- KPI kartları (anomali, yüksek risk, iyileşmiş hasta)
- Risk kategorisi pasta grafiği
- Hasta listesi tablosu

### Hasta Detay Sayfası
- **KMR Sekmesi**: Zaman serisi grafiği, AI tahmini, kohort karşılaştırma
- **KRE Sekmesi**: Kreatinin grafiği, referans bantları, klinik eşikler
- **GFR Sekmesi**: GFR grafiği, böbrek fonksiyon evreleri
- **Risk Sekmesi**: Risk skoru zaman serisi, bileşen analizi

### Model Değerlendirme
- LSTM performans metrikleri (MAE, R²)
- VAE anomali tespiti istatistikleri
- Ensemble model karşılaştırması

### Raporlar
- Excel/CSV dışa aktarma
- PDF rapor oluşturma

---

## Çıktı Dosyaları

```bash
frontend/public/
├── patients/
│   └── {patient_code}.json     # Hasta detay verileri
├── summary.json                # Genel özet
├── reference_band.json         # KMR/KRE/GFR referans bantları
├── patient_features.json       # Hasta özellik listesi
├── channel_overview.json       # Kanal istatistikleri
└── cohort_trajectory.json      # İyileşmiş kohort analizi
```

---

## Klinik Uyarılar

⚠️ **Bu sistem karar destek amaçlıdır.**

- Klinik kararlar uzman hekim değerlendirmesi ile alınmalıdır
- Model skorları tek başına tanı koymak için kullanılmamalıdır
- Yüksek risk skorları ek tetkik ve yakın takip gerektirebilir
- Düşük model uyumu, ek dikkat ve doğrulama gerektirir

---

## Dokümantasyon

| Dosya | İçerik |
|-------|--------|
| `Doc/SISTEM_MIMARISI.md` | Detaylı sistem mimarisi |
| `Doc/GRAFIK_ACIKLAMA_DOKÜMANTASYON.md` | Grafik açıklamaları |
| `Doc/GELISMIS_KIMERIZM_SISTEMI_v2.md` | Gelişmiş sistem özellikleri |

---

## Lisans ve İletişim

**Proje Adı**: NISTH (Non-invasive Screening of Transplantation Health)  
**Versiyon**: 3.0  
**Son Güncelleme**: 2026-01-18

---

**© 2026 NISTH v3.0** - Organ nakli sonrası hasta takip sistemi
