# Kurulum (Backend + Frontend)

Bu doküman tüm sistemi yerelde ayağa kaldırmak, sıfırdan eğitmek ve doğrulamak içindir.

## Gereksinimler

- Python 3.10+
- Node.js 18+
- npm
- `data/data.xlsx` dosyası (zorunlu)

## 1) Projeyi Hazırla

```bash
cd <project-root>
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## 2) Frontend Bağımlılıkları

```bash
cd frontend
npm install
cd ..
```

## 3) Tam Sıfırdan Eğitim ve Export

`run_all.py` varsayılan olarak önce temizler, sonra eğitir:

```bash
python3 backend/run_all.py
```

Bu komut:

1. `frontend/public` altındaki eski üretilmiş JSON/CSV dosyalarını temizler.
2. `data.xlsx` dosyasını okuyup long formata çevirir.
3. KMR/LAB tahmin modellerini eğitir.
4. Anomali modellerini eğitir veya fallback uygular.
5. Hasta timeline risk skorlarını hesaplar.
6. Referans bant, kohort eğrisi ve doktor performans raporu üretir.
7. Çıktıları atomik olarak `frontend/public` altına yayınlar.

## 4) Sistem Doğrulaması

```bash
python3 backend/full_system_check.py
```

Kontrol edilen başlıklar:

- Excel -> JSON değer eşleşmeleri
- Şema doğrulama
- Hasta sayısı ve anomali/risk tutarlılığı
- `doctor_performance_report.json` ve `.csv` varlık + şema
- Frontend lint/build

## 5) Frontend Çalıştırma

```bash
cd frontend
npm run dev
```

- Dashboard: `http://localhost:3000/`
- Hasta listesi: `http://localhost:3000/patients`
- Raporlar: `http://localhost:3000/reports`

## Sık Kullanılan Komutlar

```bash
# Temizliği atla (önerilmez)
python3 backend/run_all.py --skip-clean

# Sadece frontend kontrol
cd frontend && npm run lint && npm run build:next

# Sadece backend syntax kontrol
python3 -m compileall backend
```

## Sorun Giderme

- `data/data.xlsx` bulunamadı:
  - Dosyanın adı ve yolu doğru olmalı.
- TensorFlow yok uyarısı:
  - Sistem fallback ile çalışır, ancak tahmin kalitesi düşebilir.
- Frontend veri yok:
  - Önce `python3 backend/run_all.py` çalıştır.

## İlgili Dokümanlar

- Ana rehber: `README.md`
- Sistem raporu: `Doc/SISTEM_RAPORU.md`
- Frontend kurulum: `frontend/kurulum.md`
