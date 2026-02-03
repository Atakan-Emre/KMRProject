#!/usr/bin/env node

/**
 * GitHub Pages için post-build script
 * Build sonrası gerekli dosyaları oluşturur
 */

const fs = require('fs');
const path = require('path');

const outDir = path.join(__dirname, '../out');

// .nojekyll dosyası oluştur (Jekyll'i devre dışı bırakır)
const nojekyllPath = path.join(outDir, '.nojekyll');
if (!fs.existsSync(nojekyllPath)) {
  fs.writeFileSync(nojekyllPath, '');
  console.log('✓ .nojekyll dosyası oluşturuldu');
}

// 404.html dosyası oluştur (GitHub Pages routing için)
const notFoundHtml = `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>404 - Sayfa Bulunamadı</title>
  <script>
    // GitHub Pages için SPA routing desteği
    // Eğer sayfa bulunamazsa ana sayfaya yönlendir
    const path = window.location.pathname;
    const basePath = path.split('/').slice(0, -1).join('/') || '';
    const redirectPath = basePath + '/index.html';
    
    // Önce index.html'i yükle
    fetch(redirectPath)
      .then(() => {
        window.location.href = redirectPath;
      })
      .catch(() => {
        // Ana sayfaya yönlendir
        window.location.href = basePath + '/';
      });
  </script>
</head>
<body>
  <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; font-family: system-ui, -apple-system, sans-serif;">
    <h1 style="font-size: 4rem; margin: 0;">404</h1>
    <p style="font-size: 1.25rem; color: #666;">Sayfa Bulunamadı</p>
    <p style="color: #999;">Yönlendiriliyorsunuz...</p>
  </div>
</body>
</html>`;

const notFoundPath = path.join(outDir, '404.html');
fs.writeFileSync(notFoundPath, notFoundHtml);
console.log('✓ 404.html dosyası oluşturuldu');

// Build çıktısını kontrol et
if (!fs.existsSync(outDir)) {
  console.error('❌ Build çıktı dizini bulunamadı:', outDir);
  process.exit(1);
}

const indexPath = path.join(outDir, 'index.html');
if (!fs.existsSync(indexPath)) {
  console.error('❌ index.html bulunamadı');
  process.exit(1);
}

console.log('✓ Post-build işlemleri tamamlandı');
