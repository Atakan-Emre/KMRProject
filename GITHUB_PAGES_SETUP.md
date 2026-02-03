# GitHub Pages Kurulum Rehberi

Bu proje GitHub Pages ile otomatik olarak yayınlanacak şekilde yapılandırılmıştır.

## Kurulum Adımları

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

2. GitHub Actions sekmesine gidin ve workflow'un çalıştığını kontrol edin
3. Build tamamlandıktan sonra, Pages ayarlarında site URL'inizi görebilirsiniz

### 4. Site URL'i

Site URL'i şu formatta olacaktır:
- Eğer repo adı `username.github.io` formatındaysa: `https://username.github.io`
- Aksi halde: `https://username.github.io/repo-name`

## Otomatik Deploy

Her `main` branch'ine push yapıldığında:
1. GitHub Actions workflow otomatik olarak çalışır
2. Frontend build edilir
3. Statik dosyalar GitHub Pages'e deploy edilir

## Manuel Deploy

GitHub Actions sekmesinden **workflow_dispatch** ile manuel olarak deploy tetikleyebilirsiniz.

## Sorun Giderme

### Build Hatası
- `frontend/package.json` dosyasının doğru olduğundan emin olun
- Node.js versiyonunun 20 olduğunu kontrol edin

### Sayfa Bulunamadı (404)
- `next.config.ts` dosyasındaki `basePath` ayarını kontrol edin
- GitHub Pages ayarlarında doğru source seçildiğinden emin olun

### Asset Yüklenmiyor
- `assetPrefix` ayarının `basePath` ile eşleştiğinden emin olun
- Browser console'da hata mesajlarını kontrol edin

## Notlar

- Bu proje Next.js static export kullanmaktadır
- Tüm görseller `unoptimized: true` olarak ayarlanmıştır (GitHub Pages uyumluluğu için)
- `trailingSlash: true` ayarı GitHub Pages routing için önemlidir
