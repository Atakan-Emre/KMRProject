# Frontend Kurulum

## Gereksinimler

- Node.js 18+
- npm
- Backend tarafından üretilmiş `frontend/public/*.json` dosyaları

## Kurulum

```bash
cd frontend
npm install
```

## Geliştirme

```bash
npm run dev
```

## Üretim Build

```bash
npm run build:next
```

## Lint

```bash
npm run lint
```

## Veri Bağımlılığı

Frontend aşağıdaki akışla çalışır:

1. `python3 backend/run_all.py` ile veriler üretilir.
2. JSON dosyaları `frontend/public` altına yazılır.
3. UI bu dosyaları fetch ederek ekranları oluşturur.

Pipeline çalıştırmadan frontend açılırsa bazı ekranlar boş görünebilir.

## Raporlar Sayfası

`/reports` sayfasında üç ana çıktı indirilebilir:

- Hasta özet CSV
- PDF rapor
- Doktor paneli performans raporu (`doctor_performance_report.csv`/`.json`)
