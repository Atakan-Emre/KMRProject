# Frontend (Next.js)

Bu uygulama `frontend/public` altına backend tarafından üretilen statik JSON/CSV dosyalarını okuyarak çalışır.

## Teknoloji

- Next.js (App Router)
- TypeScript
- React Query
- Plotly
- Tailwind + shadcn/ui bileşenleri

## Çalıştırma

```bash
cd frontend
npm install
npm run dev
```

Önemli: Frontend’den önce backend pipeline çalıştırılmalıdır:

```bash
cd ..
python3 backend/run_all.py
```

## Sayfalar

- `/` : Dashboard (KPI, risk dağılımı, kohort görünümü)
- `/patients` : Hasta listesi (arama, filtre, sıralama)
- `/patients/[id]` : Hasta detay (KMR/KRE/GFR/risk timeline)
- `/reports` : Rapor indirme (CSV/PDF + doktor performans raporu)
- `/model-evaluation` : Model değerlendirme ekranı

## Veri Kaynakları

UI aşağıdaki dosyaları fetch eder:

- `/patient_features.json`
- `/data_summary.json`
- `/reference_band.json`
- `/cohort_trajectory.json`
- `/cohort_trajectory_lab.json`
- `/channel_overview.json`
- `/patients/{id}.json`
- `/doctor_performance_report.json` (rapor indirme)
- `/doctor_performance_report.csv` (rapor indirme)

## Tipler

Temel tip tanımları: `src/types/index.ts`

Özellikle timeline noktasında şu alanlar kritik:

- gerçek ölçümler: `kmr`, `kre`, `gfr`
- tahmin: `*_pred`, `*_pred_lo`, `*_pred_hi`
- tahmin durumu: `*_pred_status`
- anomali: `*_anomaly_score`, `*_anomaly_flag`
- risk: `risk_components`, `risk_score`, `risk_level`

## Tahmin Durumu Gösterimi

`*_pred_status` alanları sayesinde UI, boş tahmini neden bazında gösterir:

- `timepoint_not_applicable`
- `insufficient_data`
- `missing_prediction`
- `ok`

## Build ve Kontrol

```bash
npm run lint
npm run build:next
```

## Notlar

- Uygulama statik veriye dayanır; backend canlı API açmaz.
- JSON şeması değişirse frontend tipleri de güncellenmelidir.
