# GitHub Pages Kurulum Rehberi

Bu proje GitHub Actions ile GitHub Pages'e otomatik olarak yayınlanacak şekilde yapılandırılmıştır.

## 🚀 Hızlı Başlangıç

### 1. Repository'yi Public Yapın

1. GitHub'da repository ayarlarına gidin
2. **Settings** > **General** > **Danger Zone** bölümüne gidin
3. **Change repository visibility** butonuna tıklayın
4. Repository'yi **Public** olarak ayarlayın

### 2. GitHub Pages'i Aktifleştirin

1. **Settings** > **Pages** bölümüne gidin
2. **Source** altında **GitHub Actions** seçeneğini seçin
3. Bu ayar, `.github/workflows/deploy.yml` dosyasındaki workflow'u otomatik olarak çalıştıracaktır

### 3. İlk Deploy

1. Repository'yi GitHub'a push edin:
   ```bash
   git push -f origin main
   ```
   
   ⚠️ **Uyarı**: `-f` flag'i kullanılıyor çünkü git geçmişi temizlendi. Eğer remote'da başka commitler varsa, bunlar silinecektir.

2. GitHub Actions sekmesine gidin (`Actions` tab) ve workflow'un çalıştığını kontrol edin
3. Build tamamlandıktan sonra (yaklaşık 2-3 dakika), Pages ayarlarında site URL'inizi görebilirsiniz
4. İlk deploy genellikle 5-10 dakika sürebilir

### 4. Site URL'i

Site URL'i şu formatta olacaktır:
- Eğer repo adı `username.github.io` formatındaysa: `https://username.github.io`
- Aksi halde: `https://username.github.io/repo-name`

Örnek: `https://yourusername.github.io/KMRProject`

## 🔄 Otomatik Deploy Süreci

Her `main` branch'ine push yapıldığında:

1. **GitHub Actions** workflow otomatik olarak tetiklenir
2. **Build Job** çalışır:
   - Node.js 20 kurulur
   - Dependencies yüklenir (`npm ci`)
   - Next.js build edilir (`npm run build`)
   - Post-build script çalışır (`.nojekyll` ve `404.html` oluşturulur)
   - Build çıktısı doğrulanır
   - Artifact olarak yüklenir
3. **Deploy Job** çalışır:
   - Artifact GitHub Pages'e deploy edilir
   - Site yayınlanır

## 📋 Manuel Deploy

GitHub Actions sekmesinden **workflow_dispatch** butonuna tıklayarak manuel olarak deploy tetikleyebilirsiniz.

## 🛠️ Yapılandırma Detayları

### GitHub Actions Workflow (`.github/workflows/deploy.yml`)

- **Node.js Version**: 20
- **Build Directory**: `frontend/out`
- **Cache**: npm cache kullanılır (daha hızlı build)
- **Artifact**: `frontend/out` dizini yüklenir

### Next.js Yapılandırması (`frontend/next.config.ts`)

- **Output**: Static export (`output: "export"`)
- **BasePath**: Repository adına göre dinamik (`/repo-name`)
- **Asset Prefix**: BasePath ile eşleşir
- **Images**: Unoptimized (GitHub Pages uyumluluğu için)
- **Trailing Slash**: Enabled (routing için)

### Post-Build Script (`frontend/scripts/post-build.js`)

Build sonrası otomatik olarak:
- `.nojekyll` dosyası oluşturulur (Jekyll'i devre dışı bırakır)
- `404.html` dosyası oluşturulur (SPA routing için)

## 🐛 Sorun Giderme

### Build Hatası

**Problem**: Build başarısız oluyor

**Çözüm**:
- `frontend/package.json` dosyasının doğru olduğundan emin olun
- Node.js versiyonunun 20 olduğunu kontrol edin
- GitHub Actions loglarını kontrol edin (`Actions` > `Deploy to GitHub Pages` > `build` job)

### Sayfa Bulunamadı (404)

**Problem**: Sayfalar 404 hatası veriyor

**Çözüm**:
- `next.config.ts` dosyasındaki `basePath` ayarını kontrol edin
- GitHub Pages ayarlarında doğru source seçildiğinden emin olun (**GitHub Actions**)
- `404.html` dosyasının `out` dizininde olduğundan emin olun
- Browser console'da hata mesajlarını kontrol edin

### Asset Yüklenmiyor

**Problem**: CSS, JS veya görseller yüklenmiyor

**Çözüm**:
- `assetPrefix` ayarının `basePath` ile eşleştiğinden emin olun
- Browser console'da hata mesajlarını kontrol edin
- Network tab'ında 404 hatalarını kontrol edin
- BasePath'in doğru olduğundan emin olun (repo adına göre)

### Routing Sorunları

**Problem**: Sayfa yenilendiğinde 404 hatası alıyorum

**Çözüm**:
- `404.html` dosyasının `out` dizininde olduğundan emin olun
- `.nojekyll` dosyasının `out` dizininde olduğundan emin olun
- GitHub Pages ayarlarında **GitHub Actions** seçili olduğundan emin olun

### Build Çok Yavaş

**Çözüm**:
- npm cache kullanılıyor (otomatik)
- Dependencies değişmediyse cache kullanılır
- İlk build daha yavaş olabilir (2-3 dakika)
- Sonraki buildler daha hızlıdır (1-2 dakika)

## 📝 Notlar

- Bu proje **Next.js static export** kullanmaktadır
- Tüm görseller `unoptimized: true` olarak ayarlanmıştır (GitHub Pages uyumluluğu için)
- `trailingSlash: true` ayarı GitHub Pages routing için önemlidir
- `.nojekyll` dosyası Jekyll'i devre dışı bırakır (Next.js için gerekli)
- `404.html` dosyası SPA routing için gereklidir
- Build çıktısı `frontend/out` dizininde oluşturulur
- Her push'ta otomatik deploy yapılır

## 🔍 Build Loglarını Kontrol Etme

1. GitHub'da repository'nize gidin
2. **Actions** sekmesine tıklayın
3. En son workflow çalışmasını seçin
4. **build** job'ını genişletin
5. Her adımın loglarını kontrol edin

## ✅ Başarılı Deploy Kontrolü

Deploy başarılı olduğunda:
- ✅ GitHub Actions'da yeşil tik görünür
- ✅ Pages ayarlarında site URL'i görünür
- ✅ Site erişilebilir olur (5-10 dakika içinde)

## 📚 Ek Kaynaklar

- [GitHub Pages Dokümantasyonu](https://docs.github.com/en/pages)
- [Next.js Static Export](https://nextjs.org/docs/app/building-your-application/deploying/static-exports)
- [GitHub Actions](https://docs.github.com/en/actions)
