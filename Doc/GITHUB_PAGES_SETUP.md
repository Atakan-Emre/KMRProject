# GitHub Pages Setup

Bu proje backend tarafından üretilen statik JSON çıktıları ile Next.js static export kullanır.

## Akış

1. Backend pipeline çalışır: `python3 backend/run_all.py`
2. Çıktılar `frontend/public` altına yazılır.
3. Frontend static build alınır: `npm run build:next`
4. `frontend/out` GitHub Pages'e deploy edilir.

## Önemli Noktalar

- `backend/run_all.py` varsayılan olarak önce temizlik yapar, sonra sıfırdan eğitim ve export yapar.
- Deploy öncesi `python3 backend/full_system_check.py` önerilir.
- GitHub Pages için `NEXT_PUBLIC_BASE_PATH` doğru verilmelidir.

## Örnek Deploy Akışı

```bash
# repo kökü
python3 backend/run_all.py
python3 backend/full_system_check.py

cd frontend
npm run build:next
```

Deploy edilecek çıktı dizini: `frontend/out`

## Beklenen Public Dosyaları

- `patients/*.json`
- `patient_features.json`
- `data_summary.json`
- `reference_band.json`
- `cohort_trajectory.json`
- `cohort_trajectory_lab.json`
- `channel_overview.json`
- `doctor_performance_report.json`
- `doctor_performance_report.csv`

## Hata Kontrol Listesi

- Build sonrası `out/patients` dizini mevcut mu?
- `out/doctor_performance_report.json` var mı?
- `NEXT_PUBLIC_BASE_PATH` yanlışsa sayfa veri fetch edemez.
