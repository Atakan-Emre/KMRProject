# NISTH - Grafik Açıklama Dokümantasyonu v3.0

## GENEL BAKIŞ

Bu dokümantasyon, NISTH (Non-invasive Screening of Transplantation Health) v3.0 sisteminde kullanılan tüm grafik yapılarının **detaylı açıklamalarını**, **veri kaynaklarını**, **hesaplama metodlarını** ve **klinik anlamlarını** içermektedir.

**Frontend Teknolojileri**:
- Next.js 15.4 (App Router)
- React 18 + TypeScript
- Plotly.js (react-plotly.js)
- TailwindCSS + shadcn/ui

---

## 1. KMR ZAMAN SERİSİ GRAFİĞİ

### Temel Yapı
- **Grafik Türü**: Interactive Time Series (Plotly Scatter)
- **X Ekseni**: Zaman Noktaları (time_order: 1-15)
- **Y Ekseni**: Kimerizm Yüzdesi (%)
- **Veri Kaynağı**: `patients/{patient_code}.json` → `timeline` array
- **Sayfa**: `/patients/[id]` - KMR Sekmesi

### **🔬 Veri İşlem Süreci**

```python
# 1. Ham Veri → Kanal Bazlı Gruplandırma
def process_patient_data(raw_csv):
    """
    Her chr* kolonu bir kanal olarak işlenir
    date_code: 0,1,2,3 → zaman fazları
    """
    timeline_by_channel = {}
    
    for channel in ['chr1', 'chr2', ..., 'chr22']:
        channel_points = []
        for phase in [0, 1, 2, 3]:  # 0-48s, günlük, haftalık, aylık
            value = patient_data[channel][phase]
            if value is not None:
                channel_points.append({
                    'date_code': phase,
                    'label': phase_labels[phase],
                    'value': value,
                    'flags': calculate_anomaly_flags(value, phase)
                })
```

### **📊 Grafik Bileşenleri**

#### **A) Kanal Çizgileri (Ana Veri)**
- **Renk Algoritması**: Deterministik hash fonksiyonu
- **Marker Boyutu**: 10px
- **Çizgi Kalınlığı**: 1.5px
- **Opacity**: Kanal sayısına göre dinamik (>5 kanal: 0.6, ≤5 kanal: 0.8)

```python
def getChannelColor(channel_name):
    """
    Her kanal adı için benzersiz renk üretir
    20 renk paleti döngüsel kullanım
    """
    colors = ['#e11d48', '#0ea5e9', '#10b981', ...]
    hash_value = hash(channel_name) % len(colors)
    return colors[hash_value]
```

#### **B) X Ekseni Pozisyonlama**
```python
# Aynı fazda birden fazla ölçüm varsa offset uygula
def calculateXPosition(point, channel_points):
    base_position = point.date_code  # 0, 1, 2, 3
    same_phase_points = filter(p => p.date_code === point.date_code)
    index_in_phase = same_phase_points.indexOf(point)
    
    if same_phase_points.length > 1:
        offset = (index_in_phase * 0.3) / (same_phase_points.length - 1) - 0.15
        return base_position + offset
    return base_position
```

#### **C) Anomali İşaretleme**
- **Kırmızı Marker**: Kritik anomali (personal_high_crit, clinical_high)
- **Turuncu Marker**: Uyarı anomali (personal_high_warn, ref_outlier)
- **Normal Renk**: Kanal rengi

---

## 📊 **2. REFERANS BANDI (P2.5-P97.5)**

### **🎯 Klinik Amaç**
Organ nakli hastalarının **popülasyon normunu** gösterir. Her hastanın değeri bu banda göre değerlendirilir.

### **📈 Hesaplama Metodolojisi**

```python
def calculate_reference_envelope():
    """
    322 hasta verisi (HX/GX hariç) 
    Her faz için percentile hesaplama
    """
    reference_cohort = exclude_patients(['HX', 'GX'])
    
    for phase in [0, 1, 2, 3]:
        phase_data = reference_cohort[date_code == phase]['chr']
        
        stats = {
            'median': np.median(phase_data),
            'p2_5': np.percentile(phase_data, 2.5),
            'p97_5': np.percentile(phase_data, 97.5),
            'sample_count': len(phase_data)
        }
```

### **🎨 Görsel Özellikler**
- **Gölge Alanı**: `rgba(59, 130, 246, 0.12)` - Açık mavi
- **Median Çizgisi**: Noktalı mavi çizgi, 2px kalınlık
- **Smoothing**: Spline interpolation (0.5 smoothing)
- **Dinamik Aralık**: Mevcut hasta verilerine göre genişletilir

### **📊 Faz Bazlı Değerler**
```json
{
  "0-48s": {
    "median": 2.45,
    "p2_5": 0.054,
    "p97_5": 15.206,
    "sample_size": 91
  },
  "günlük": {
    "median": 1.89,
    "p2_5": 0.041,
    "p97_5": 12.34,
    "sample_size": 88
  }
}
```

---

## 🎯 **3. KİŞİSEL EŞİKLER (+2MAD, +3MAD)**

### **📊 Hesaplama Mantığı**

```python
def calculate_personal_thresholds(patient_data):
    """
    48s sonrası verilerden kişisel baseline hesapla
    MAD (Median Absolute Deviation) kullanarak robust eşikler
    """
    post48_values = patient_data[date_code > 0]['chr']
    
    if len(post48_values) >= 3:  # En az 3 ölçüm gerekli
        median = np.median(post48_values)
        mad = np.median(np.abs(post48_values - median))
        
        thresholds = {
            'warn_threshold': median + 2 * mad,    # Uyarı eşiği
            'crit_threshold': median + 3 * mad     # Kritik eşik
        }
    else:
        # Fallback: Genel popülasyon median'ı kullan
        thresholds = use_population_median()
```

### **🎨 Görsel Özellikler**
- **Uyarı Eşiği (+2MAD)**: Turuncu kesikli çizgi `#f59e0b`
- **Kritik Eşik (+3MAD)**: Kırmızı kesikli çizgi `#ef4444`
- **Kalınlık**: 2px
- **Kapsam**: Tüm x ekseni boyunca sürekli çizgi

### **🔬 MAD vs Standard Deviation**
- **MAD Avantajı**: Outlier'lara karşı daha robust
- **Klinik Anlam**: Her hasta kendi "normal" aralığına sahip
- **Dinamik Özellik**: Hasta verisi arttıkça eşikler güncellenir

---

## 📈 **4. KANAL TRENDLERİ (Linear Regression)**

### **🔬 Hesaplama Algoritması**

```python
def calculate_channel_trend(channel_points):
    """
    Her kanal için ayrı linear regression
    En az 2 ölçüm gerekli
    """
    if len(channel_points) < 2:
        return None
        
    # Basit linear regression
    x_values = [p.date_code for p in channel_points]
    y_values = [p.value for p in channel_points]
    
    # y = slope * x + intercept
    slope, intercept = calculate_linear_regression(x_values, y_values)
    
    # Trend çizgisi için 4 nokta oluştur
    trend_line = []
    for x in [0, 1, 2, 3]:
        y = slope * x + intercept
        trend_line.append({'x': x, 'y': y})
```

### **🎨 Görsel Özellikler**
- **Renk**: Kanalın ana rengi ile aynı
- **Stil**: Dash-dot (kesik-nokta)
- **Kalınlık**: 3px
- **Opacity**: 0.7
- **Legend**: Gizli (gösterilmez)

### **📊 Klinik Yorumlama**
- **Pozitif Eğim**: Kimerizm artışı → Risk işareti
- **Negatif Eğim**: Kimerizm azalışı → İyileşme işareti
- **Düz Çizgi**: Stabil durum

---

## 🌍 **5. TÜM KANAL ORTALAMASI VE TRENDİ**

### **📊 Hesaplama Mantığı**

```python
def calculate_general_trend(patient_timeline):
    """
    TÜM hasta verilerini kullan (kanal seçiminden bağımsız)
    Her faz için ortalama hesapla
    """
    phase_averages = {}
    
    # Tüm timeline verilerini grupla
    for point in patient_timeline:
        if point.date_code not in phase_averages:
            phase_averages[point.date_code] = []
        phase_averages[point.date_code].append(point.value)
    
    # Her faz için ortalama
    avg_points = []
    for phase in sorted(phase_averages.keys()):
        avg_value = np.mean(phase_averages[phase])
        avg_points.append({'x': phase, 'y': avg_value})
```

### **🎨 Görsel Özellikler**

#### **A) Ortalama Noktaları**
- **Renk**: Mor `#8b5cf6`
- **Marker**: Elmas şekli, 12px
- **Çizgi**: Kalın düz çizgi, 4px
- **Ad**: "📊 Tüm Kanal Ortalaması"

#### **B) Genel Trend Çizgisi**
- **Renk**: Mor `#8b5cf6`
- **Stil**: Uzun kesikli çizgi
- **Kalınlık**: 5px
- **Opacity**: 0.8
- **Ad**: "📈 Tüm Kanal Trend"

### **🔬 Önemli Özellik**
**Kanal seçiminden bağımsız**: Hangi kanallar görünür olursa olsun, bu çizgiler hastanın tüm verilerine dayanır.

---

## ⚙️ **6. Y EKSENİ ÖLÇEK YÖNETİMİ**

### **📊 Dinamik Aralık Hesaplama**

```python
def calculateGlobalYAxisRange(patient_data):
    """
    Tüm hasta verilerini kapsayacak şekilde sabit Y ekseni
    Kanal seçimi değiştiğinde ölçek kaymaz
    """
    all_values = []
    
    # 1. Tüm timeline değerleri
    for point in patient_timeline:
        all_values.append(point.value)
    
    # 2. Kişisel eşikler
    if patient.personal.warn_threshold:
        all_values.append(patient.personal.warn_threshold)
    if patient.personal.crit_threshold:
        all_values.append(patient.personal.crit_threshold)
    
    # 3. Referans bandı değerleri
    for ref_point in patient.reference_band:
        all_values.extend([ref_point.p2_5, ref_point.p97_5, ref_point.median])
    
    # 4. %15 padding ekle
    min_val = Math.min(...all_values)
    max_val = Math.max(...all_values)
    padding = (max_val - min_val) * 0.15
    
    return [
        Math.max(0.001, min_val - padding),  // Minimum 0.001
        max_val + padding
    ]
```

### **🎯 Avantajları**
- **Karşılaştırma**: Farklı kanal kombinasyonları aynı ölçekte
- **Zoom Bugı Önleme**: Kanal açıp kapattığınızda grafik zoomlamaz
- **Tutarlılık**: Tüm referans çizgileri sabit kalır

---

## 🎨 **7. İNTERAKTİF ÖZELLİKLER**

### **📊 Kanal Seçimi Sistemi**
```typescript
// Checkbox tabanlı çoklu seçim
const [visibleChannels, setVisibleChannels] = useState<Set<string>>(new Set())

// Hızlı seçim butonları
const selectHighValueChannels = () => {
    const highChannels = channels.filter(ch => 
        averageValue(ch) > 1.0  // %1 üstü ortalama
    )
    setVisibleChannels(new Set(highChannels.slice(0, 5)))
}
```

### **🔧 Çizgi Kontrolleri**
- **Referans Bandı**: Toggle on/off
- **Kişisel Eşikler**: Toggle on/off  
- **Kanal Trendleri**: Toggle on/off
- **Genel Trend**: Toggle on/off

### **📱 Tam Ekran Modu**
- **Layout**: Sol grafik + Sağ kontrol paneli
- **Responsive**: Dinamik boyutlandırma
- **Kontroller**: Sağ panel 320px sabit genişlik

---

## 🎯 **8. HOVER BİLGİLERİ (TOOLTIPS)**

### **📊 Kanal Noktaları**
```typescript
hovertemplate: 
`${channel}<br>
Değer: ${value.toFixed(3)}%<br>
Faz: ${phase_label}
${anomaly_flags ? '⚠️ ' + anomaly_descriptions : ''}<extra></extra>`
```

### **📈 Trend Çizgileri**
```typescript
// Kanal trendi
hovertemplate: `${channel} Trend: ${value:.3f}%<extra></extra>`

// Genel trend
hovertemplate: `Tüm Kanal Trend: ${value:.3f}%<br>Eğim: ${slope > 0 ? '+' : ''}${slope.toFixed(4)}<extra></extra>`
```

### **🎯 Referans Çizgileri**
```typescript
// Referans median
hovertemplate: `Referans Median: ${value:.3f}%<extra></extra>`

// Kişisel eşikler  
hovertemplate: `Kişisel Uyarı: ${value:.3f}%<extra></extra>`
```

---

## ⚠️ **9. ANOMALİ TANIMLARI**

### **🚨 Flag Tipleri**
```python
anomaly_flags = {
    'ref_outlier': value > reference_p97_5,
    'personal_high_warn': value > personal_median + 2*MAD,
    'personal_high_crit': value > personal_median + 3*MAD,
    'clinical_high': value > clinical_threshold,  # Değişken eşik
    'trend_up': consecutive_increases >= 2
}
```

### **🎨 Görsel Kodlama**
- **Kırmızı Marker**: `personal_high_crit` veya `clinical_high`
- **Turuncu Marker**: `personal_high_warn` veya `ref_outlier`
- **Normal Marker**: Kanal rengi

### **📝 Açıklama Metinleri**
- **"Ref P97.5 üstü"**: Popülasyon %97.5 eşiği aşıldı
- **"Kişisel +3MAD üstü"**: Kritik kişisel eşik aşıldı
- **"Kişisel +2MAD üstü"**: Uyarı kişisel eşiği aşıldı
- **"Klinik eşik üstü"**: Geleneksel klinik threshold aşıldı

---

## 📊 **10. PERFORMANS OPTİMİZASYONU**

### **🚀 Rendering Optimizasyonu**
```typescript
// Plotly konfigürasyonu
config = {
    responsive: true,
    displayModeBar: true,
    modeBarButtonsToRemove: ['pan2d', 'lasso2d', 'select2d'],
    toImageButtonOptions: {
        format: 'png',
        scale: 2,
        width: 1200,
        height: chartHeight
    }
}
```

### **⚡ State Management**
```typescript
// Memoization ile gereksiz hesaplama önleme
const plotlyData = useMemo(() => {
    return generateTraces(visibleChannels, patient)
}, [visibleChannels, patient, showReferenceBand, showPersonalThresholds])

// Y ekseni sabit tutma
const globalYAxisRange = useMemo(() => {
    return calculateRange(patient)  // Sadece patient değiştiğinde
}, [patient])  // visibleChannels'a bağlı değil!
```

---

## 🔍 **11. DEBUGGING VE GELİŞTİRME**

### **📊 Console Log Yapısı**
```typescript
console.log('Grafik Verileri:', {
    visibleChannels: Array.from(visibleChannels),
    totalTraces: plotlyData.length,
    yAxisRange: globalYAxisRange,
    patientCode: patient.meta.patient_code
})
```

### **🧪 Test Senaryoları**
1. **Tek Kanal Seçimi**: Trend çizgileri doğru çalışıyor mu?
2. **Tüm Kanallar**: Performans kabul edilebilir mi?
3. **Kanal Değiştirme**: Y ekseni sabit kalıyor mu?
4. **Tam Ekran**: Kontroller erişilebilir mi?

---

## 📚 **12. KAYNAK VE REFERANSLAR**

### **📖 Kullanılan Kütüphaneler**
- **Plotly.js**: 2.x - İnteraktif grafik motor
- **React**: 18.x - UI framework
- **TypeScript**: 5.x - Tip güvenliği
- **Next.js**: 14.x - SSR ve optimizasyon

### **📊 Veri İşleme**
- **NumPy**: Percentile hesaplamaları
- **Pandas**: CSV işleme ve veri manipülasyonu
- **JSON**: Frontend-backend veri transferi

### **🎨 Tasarım Referansları**
- **Color Palette**: 20 renk deterministik hash sistemi
- **Typography**: Inter font family
- **Icons**: Lucide React (open source)

---

## 🎯 **SONUÇ**

Bu grafik sistemi, **klinik doğruluk**, **kullanıcı deneyimi** ve **teknik performans** dengesini gözeterek tasarlanmıştır. Her bileşen belirli bir tıbbi amaca hizmet eder ve birlikte hastanın kimerizm durumu hakkında **kapsamlı bir görsel analiz** sunar.

**Ana Güçlü Yönler:**
- ✅ **Çok Boyutlu Analiz**: Popülasyon + kişisel + trend analizi
- ✅ **İnteraktif Kontrol**: Kullanıcı ihtiyacına göre özelleştirme
- ✅ **Performans**: Büyük veri setlerinde akıcı çalışma
- ✅ **Klinik Uygunluk**: Tıbbi karar vermeyi destekler

---

*Bu dokümantasyon Kimerizm Takip Sistemi v2.0 için hazırlanmış olup, sistem güncellemeleri ile birlikte revize edilecektir.*

---

## 🧭 FRONTEND ↔ MODEL EŞLEŞME HARİTASI

- Zaman serisi noktaları: `patient.timeline.value` ← Klasik analiz ön işleme sonrası ham kimerizm değerleri (faz etiketli). Anomali bayrakları klasik kurallardan türetilir (ref_outlier, +2MAD, +3MAD, trend_up, klinik eşik).
- Referans bandı/median: `patient.reference_band` ← Referans kohort istatistikleri (median, P2.5, P97.5) faz bazında.
- Kişisel eşikler: `patient.personal.warn_threshold`, `crit_threshold` ← Post-48s median ve MAD’den türetilir.
- Radar ve dağılım grafiklerindeki alt model skorları: `birlesik_risk_skorlari.csv` kaynaklı klasik/LSTM/AE skor alanları.
- Model Uyumu: Birleşik dosyadaki `model_uyum_skoru` (varyans normalizasyonu, 0–100) frontend’de güven göstergesi olarak kullanılır.

Not: LSTM/AE skorları frontend hasta detayında opsiyoneldir. Uygun veri yoksa gösterilmez veya NaN/0’a yakın değer alır; bu, “bilgi eksikliği” olup “risk artışı” değildir.

---

## 🧪 MODEL DEĞERLENDİRİLMEDİĞİNDE GRAFİKLERİN YORUMU

- Referans bandı ve kişisel eşikler tek başına klinik yorum taşır. P97.5 üstü değerler veya +2MAD/+3MAD aşımı uyarı/kriz sinyalidir.
- Kanal trendi pozitifse (özellikle 48s sonrası fazlarda) artış yönü risk göstergesidir, LSTM olmadan da anlamlıdır.
- Radar grafiğinde eksik dilimler (LSTM/AE) “model üretilemedi/veri yetersiz” anlamına gelir; bu durum birleşik skorda düşük “model uyumu” olarak da yansır.

---

## 🩺 VAKA ÖRNEKLERİ VE KLİNİK YORUM KILAVUZU

- Vaka A — Yüksek Risk + Düşük Uyum: Birleşik risk 75+, model uyumu <50. Yorum: Modeller tutarsız veya eksik. Aksiyon: Ham zaman serisine odaklan, referans bandı ve kişisel eşik kesişimlerine bak; ölçüm/doğrulama tekrarı değerlendir.
- Vaka B — Orta Risk + Yüksek Uyum: Birleşik risk 45–55, uyum 80+. Yorum: Modeller hemfikir; yakından takip önerilir, trend çizgisi kritik.
- Vaka C — Düşük Risk + Yüksek Uyum: Birleşik risk <20, uyum 80+. Yorum: Normal seyir; rutin takip.
- Vaka D — Lokal Kanal Anomalileri: Birkaç kanalda +2MAD aşımı ama genel ortalama stabil. Yorum: Kanal-spesifik biyolojik varyasyon olasılığı; klinik bağlama göre hedeflenmiş takip.

---

## 🔗 İLGİLİ DOKÜMANLAR
- Sistem mimarisi: `SISTEM_MIMARISI.md`
- Genel proje açıklaması: `README.md`
- Birleşik skor üretimi: `birlesik_risk_skorlama.py`
- Dashboard: `interaktif_dashboard.py`

---

## 🧭 FRONTEND ↔ MODEL EŞLEŞME HARİTASI

### Veri Kaynakları

| Frontend Bileşeni | JSON Kaynağı | Açıklama |
|-------------------|--------------|----------|
| KMR Zaman Serisi | `timeline[].kmr` | Hasta KMR değerleri |
| AI Tahmini | `timeline[].kmr_pred` | LSTM tahmin değeri |
| Kohort Beklentisi | `timeline[].cohort_median` | İyileşmiş hasta ortalaması |
| KRE Grafiği | `timeline[].kre` | Kreatinin değerleri |
| GFR Grafiği | `timeline[].gfr` | GFR değerleri |
| Referans Bandı | `reference_band.json` | KMR/KRE/GFR IQR bantları |
| Risk Skoru | `timeline[].risk_score` | Birleşik risk skoru |
| Anomali Bayrağı | `timeline[].kmr_anomaly_flag` | VAE anomali tespiti |

### Timeline Yapısı

```typescript
interface TimelinePoint {
  time_key: string;      // "Day_7", "Week_2", "Month_1", vb.
  time_order: number;    // Sıralama için (1-15)
  pseudo_time_days: number;
  
  // KMR Verileri
  kmr: number | null;
  kmr_pred: number | null;
  kmr_pred_lo: number | null;
  kmr_pred_hi: number | null;
  kmr_anomaly_score: number;
  kmr_anomaly_flag: boolean;
  cohort_median: number | null;
  
  // LAB Verileri
  kre: number | null;
  gfr: number | null;
  
  // Risk Verileri
  risk_score: number | null;
  risk_category: string | null;
  risk_components: RiskComponents | null;
}
```

---

## NEXT.JS SAYFA YAPISI

```typescript
/                         → Ana Sayfa (Dashboard)
├── KPI Kartları
├── Risk Dağılım Grafiği
├── Hasta Listesi
└── Kohort Analizi

/patients                 → Hasta Listesi
├── Tablo görünümü
├── Risk ve trend göstergeleri
└── Filtreleme/sıralama

/patients/[id]           → Hasta Detay
├── KMR Sekmesi
│   ├── KMR Zaman Serisi
│   ├── AI Tahmini overlay
│   ├── Kohort karşılaştırma
│   └── Referans IQR bandı
├── KRE Sekmesi
│   ├── Kreatinin grafiği
│   ├── Referans bandı
│   └── Klinik eşikler (1.2, 4.5)
├── GFR Sekmesi
│   ├── GFR grafiği
│   ├── Referans bandı
│   └── Evre çizgileri (15, 30, 60, 90)
└── Risk Sekmesi
    ├── Risk skoru zaman serisi
    ├── Risk bileşenleri
    └── Trend analizi

/model-evaluation        → Model Değerlendirme
├── LSTM Performans
├── VAE Anomali Tespiti
└── Ensemble Karşılaştırma

/reports                 → Raporlar
├── Excel/CSV dışa aktarma
└── PDF rapor oluşturma
```

---

## KLİNİK YORUM KILAVUZU

### Risk Kategorileri ve Öneriler

| Kategori | Skor | Renk | Klinik Öneri |
|----------|------|------|--------------|
| Çok Düşük | 0-20 | 🟢 | Rutin takip |
| Düşük | 20-40 | 🟡 | Normal takip |
| Orta | 40-60 | 🟠 | Yakın takip |
| Yüksek | 60-80 | 🟠 | Ek tetkik değerlendir |
| Çok Yüksek | 80-100 | 🔴 | Acil değerlendirme |

### Vaka Örnekleri

**Vaka A — Yüksek KMR + Normal LAB**:
- KMR trendi yukarı, KRE/GFR normal aralıkta
- Yorum: Erken uyarı, böbrek henüz etkilenmemiş olabilir
- Aksiyon: KMR takibini sıklaştır

**Vaka B — Normal KMR + Yüksek KRE**:
- KMR stabil, KRE yükselişte
- Yorum: Kimerizm dışı böbrek stresi olabilir
- Aksiyon: Nefroloji konsültasyonu

**Vaka C — Her İkisi de Yüksek**:
- KMR ve KRE birlikte yükseliyor
- Yorum: Organ rejeksiyonu riski yüksek
- Aksiyon: Acil klinik değerlendirme

---

## İLGİLİ DOKÜMANLAR

| Dosya | İçerik |
|-------|--------|
| `Doc/SISTEM_MIMARISI.md` | Sistem mimarisi detayları |
| `Doc/README.md` | Genel proje açıklaması |
| `backend/risk_scoring.py` | Risk skorlama algoritması |
| `backend/kmr_model.py` | LSTM tahmin modeli |
| `backend/anomaly_vae.py` | VAE anomali dedektörü |

---

**Son güncelleme**: 2026-01-18  
**Versiyon**: v3.0  
**Sistem**: NISTH (Non-invasive Screening of Transplantation Health)
