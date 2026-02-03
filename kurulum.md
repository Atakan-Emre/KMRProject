# 🧬 Kimerizm Takip Sistemi - Kurulum Rehberi

Bu rehber, **Kimerizm Takip Sistemi**'ni bilgisayarınıza kurmak için gereken tüm adımları baştan sona açıklar.

---

## 📋 İçindekiler

1. [Sistem Gereksinimleri](#-sistem-gereksinimleri)
2. [Gerekli Yazılımların Kurulumu](#-gerekli-yazılımların-kurulumu)
3. [Proje Dosyalarının İndirilmesi](#-proje-dosyalarının-indirilmesi)
4. [Projenin Kurulumu](#-projenin-kurulumu)
5. [Uygulamanın Çalıştırılması](#-uygulamanın-çalıştırılması)
6. [Sorun Giderme](#-sorun-giderme)
7. [Sık Sorulan Sorular](#-sık-sorulan-sorular)

---

## 🖥️ Sistem Gereksinimleri

### Minimum Gereksinimler
- **İşletim Sistemi**: Windows 10/11 veya macOS 12+
- **RAM**: 4 GB (8 GB önerilir)
- **Disk Alanı**: 2 GB boş alan
- **İnternet**: Kurulum için gerekli

### Desteklenen Tarayıcılar
- Google Chrome (önerilen)
- Mozilla Firefox
- Microsoft Edge
- Safari (macOS)

---

## 📦 Gerekli Yazılımların Kurulumu

### Adım 1: Node.js Kurulumu

Node.js, uygulamayı çalıştırmak için gerekli olan JavaScript çalışma ortamıdır.

#### Windows için Node.js Kurulumu:

1. **Node.js İndirme**
   - Tarayıcınızda https://nodejs.org adresine gidin
   - Yeşil renkli **"LTS"** butonuna tıklayın (Recommended for most users)
   - İndirilen dosyayı açın (örn: `node-v20.11.0-x64.msi`)

2. **Kurulum Sihirbazı**
   - "Next" butonuna tıklayın
   - Lisans sözleşmesini kabul edin ✓
   - Kurulum klasörünü değiştirmeyin (varsayılan)
   - **ÖNEMLİ**: "Automatically install necessary tools" seçeneğini işaretleyin ✓
   - "Install" butonuna tıklayın
   - Kurulum tamamlandığında "Finish" tıklayın

3. **Kurulumu Doğrulama**
   - Windows tuşu + R tuşlarına basın
   - `cmd` yazıp Enter'a basın
   - Açılan siyah pencerede şu komutu yazın ve Enter'a basın:
   ```
   node --version
   ```
   - `v20.11.0` gibi bir versiyon numarası görmelisiniz

#### macOS için Node.js Kurulumu:

1. **Node.js İndirme**
   - Safari'de https://nodejs.org adresine gidin
   - Yeşil renkli **"LTS"** butonuna tıklayın
   - İndirilen `.pkg` dosyasını açın

2. **Kurulum**
   - Kurulum penceresinde "Continue" tıklayın
   - Lisansı kabul edin
   - "Install" butonuna tıklayın
   - Mac şifrenizi girin
   - Kurulum bitince "Close" tıklayın

3. **Kurulumu Doğrulama**
   - Spotlight'ı açın (⌘ + Space)
   - "Terminal" yazın ve Enter'a basın
   - Şu komutu yazıp Enter'a basın:
   ```
   node --version
   ```

### Adım 2: Git Kurulumu (Opsiyonel ama Önerilen)

Git, proje dosyalarını kolayca indirmek için kullanılır.

#### Windows için Git:
1. https://git-scm.com/download/win adresine gidin
2. "64-bit Git for Windows Setup" linkine tıklayın
3. İndirilen dosyayı çalıştırın
4. Tüm varsayılan ayarlarla kurulumu tamamlayın

#### macOS için Git:
- Terminal'de şu komutu çalıştırın:
```bash
xcode-select --install
```

---

## 📥 Proje Dosyalarının İndirilmesi

### Yöntem 1: Git ile İndirme (Önerilen)

1. **Terminal/Komut Satırını Açın**
   - Windows: Windows tuşu + R → `cmd` → Enter
   - macOS: Spotlight (⌘ + Space) → "Terminal" → Enter

2. **Masaüstüne Geçin**
   ```bash
   cd Desktop
   ```

3. **Projeyi İndirin**
   ```bash
   git clone https://github.com/[KULLANICI_ADI]/KMRProject.git
   ```
   *(Not: [KULLANICI_ADI] yerine gerçek GitHub kullanıcı adı gelmelidir)*

4. **Proje Klasörüne Girin**
   ```bash
   cd KMRProject
   ```

### Yöntem 2: ZIP Dosyası ile İndirme

1. Proje sayfasında yeşil **"Code"** butonuna tıklayın
2. **"Download ZIP"** seçeneğine tıklayın
3. İndirilen ZIP dosyasını masaüstüne çıkarın
4. Klasör adını `KMRProject` olarak değiştirin

---

## 🔧 Projenin Kurulumu

### Otomatik Kurulum (ÇOK KOLAY! 🎯)

Proje klasöründe hazır bir kurulum scripti bulunmaktadır. Bu script tüm işlemleri otomatik yapar.

#### Windows'ta Otomatik Kurulum:

1. **Dosya Gezgini'nde** `KMRProject` klasörünü açın

2. **Adres çubuğuna** tıklayın (klasör yolunun göründüğü yer)

3. Adres çubuğuna `cmd` yazın ve Enter'a basın
   - Bu, o klasörde komut satırı açacaktır

4. Şu komutu yazın ve Enter'a basın:
   ```
   python calistir.py
   ```
   
   Eğer hata alırsanız, bunları deneyin:
   ```
   py calistir.py
   ```
   veya
   ```
   python3 calistir.py
   ```

5. **Script otomatik olarak:**
   - ✅ Node.js kontrolü yapacak
   - ✅ Gerekli paketleri yükleyecek (ilk seferde 2-3 dakika)
   - ✅ Uygulamayı başlatacak
   - ✅ Size web adresi verecek

#### macOS'ta Otomatik Kurulum:

1. **Terminal'i açın** (Spotlight → "Terminal")

2. Proje klasörüne gidin:
   ```bash
   cd ~/Desktop/KMRProject
   ```

3. Scripti çalıştırın:
   ```bash
   python3 calistir.py
   ```

### Manuel Kurulum (Alternatif)

Eğer otomatik kurulum çalışmazsa:

1. **Terminal/Komut Satırında** proje klasörüne gidin:
   ```bash
   cd KMRProject
   ```

2. **Frontend klasörüne geçin:**
   ```bash
   cd frontend
   ```

3. **Paketleri yükleyin:**
   ```bash
   npm install
   ```
   *(Bu işlem ilk seferde 2-5 dakika sürebilir)*

4. **Uygulamayı başlatın:**
   ```bash
   npm run dev
   ```

---

## 🚀 Uygulamanın Çalıştırılması

### Başarılı Başlatma Sonrası

Script veya manuel kurulum sonrası şunları göreceksiniz:

```
✅ Frontend sunucusu başarıyla başlatıldı!
🌐 Tarayıcınızda açın: http://localhost:3000
```

### Uygulamaya Erişim

1. **Tarayıcınızı açın** (Chrome önerilir)
2. **Adres çubuğuna** şunu yazın: `http://localhost:3000`
3. Enter'a basın
4. **Kimerizm Takip Sistemi** açılacaktır! 🎉

### Uygulamayı Kapatma

Terminal/Komut satırı penceresinde:
- **Ctrl + C** tuşlarına basın (Windows ve macOS)
- "Sunucu kapatılıyor..." mesajını bekleyin
- Pencereyi kapatabilirsiniz

---

## 🔧 Sorun Giderme

### Node.js Kurulum Testi

Sorun yaşıyorsanız önce test scriptini çalıştırın:

**Windows:**
```cmd
python test_nodejs.py
```

**macOS:**
```bash
python3 test_nodejs.py
```

Bu script size:
- ✅ Node.js ve npm'in kurulu olup olmadığını
- 📁 Kurulum dizinlerini
- 🔍 PATH ayarlarını
- 💡 Çözüm önerilerini gösterecektir

### Sorun 1: "npm bulunamadı" Hatası

**Çözüm:**
1. Önce `python test_nodejs.py` ile kurulumu test edin
2. Node.js'in doğru kurulduğundan emin olun
3. Terminal/Komut satırını **tamamen kapatıp yeniden açın**
4. Hala çalışmıyorsa bilgisayarı yeniden başlatın

### Sorun 2: "Python bulunamadı" Hatası

**Çözüm:**

Windows için Python kurulumu:
1. https://www.python.org/downloads/ adresine gidin
2. "Download Python 3.12" butonuna tıklayın
3. **ÖNEMLİ**: "Add Python to PATH" kutucuğunu işaretleyin ✓
4. "Install Now" tıklayın

### Sorun 3: Port 3000 Kullanımda

**Belirti:** "Port 3000 is already in use" hatası

**Çözüm:**

Windows'ta:
```cmd
netstat -ano | findstr :3000
taskkill /PID [PID_NUMARASI] /F
```

macOS'ta:
```bash
lsof -i :3000
kill -9 [PID_NUMARASI]
```

Veya farklı port kullanın:
```bash
PORT=3001 npm run dev
```

### Sorun 4: Bağımlılıklar Yüklenmiyor

**Çözüm:**
1. İnternet bağlantınızı kontrol edin
2. `frontend` klasöründe:
   ```bash
   rm -rf node_modules package-lock.json
   npm install
   ```

### Sorun 5: Sayfa Açılmıyor

**Kontrol Listesi:**
- ✓ Terminal'de hata mesajı var mı?
- ✓ http://localhost:3000 adresini doğru yazdınız mı?
- ✓ Farklı bir tarayıcı deneyin
- ✓ Antivirüs/Firewall engelliyor olabilir

---

## ❓ Sık Sorulan Sorular

### S: Her seferinde kurulum mu yapmam gerekiyor?
**C:** Hayır! İlk kurulumdan sonra sadece `python calistir.py` (Windows) veya `python3 calistir.py` (macOS) komutunu çalıştırmanız yeterli.

### S: İnternetsiz çalışır mı?
**C:** İlk kurulum için internet gerekli. Sonrasında offline çalışabilir.

### S: Birden fazla kişi aynı anda kullanabilir mi?
**C:** Evet, aynı ağdaki diğer bilgisayarlar sizin IP adresiniz üzerinden erişebilir.

### S: Veritabanı kurulumu gerekli mi?
**C:** Hayır, sistem JSON dosyaları kullanıyor. Ek veritabanı kurulumu gerekmez.

### S: Windows 7'de çalışır mı?
**C:** Önerilmez. Windows 10 veya üzeri kullanın.

---

## 📞 Yardım ve Destek

Sorun yaşıyorsanız:

1. **Önce bu rehberdeki "Sorun Giderme" bölümünü kontrol edin**
2. **Hata mesajının ekran görüntüsünü alın**
3. **Kullandığınız işletim sistemi ve versiyonunu not edin**

---

## 🎯 Hızlı Başlangıç Özeti

1. **Node.js kur** → https://nodejs.org (LTS versiyonu)
2. **Projeyi indir** → GitHub'dan veya ZIP olarak
3. **Terminali aç** → Proje klasöründe
4. **Çalıştır** → `python calistir.py` (Windows) veya `python3 calistir.py` (macOS)
5. **Tarayıcıda aç** → http://localhost:3000

---

## 🎉 Tebrikler!

Kimerizm Takip Sistemi'ni başarıyla kurdunuz! Artık sistemi kullanmaya başlayabilirsiniz.

**İyi çalışmalar!** 🧬

---

*Son güncelleme: 2024*  
*Versiyon: 1.0*