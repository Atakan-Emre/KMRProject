# Frontend Kurulum Rehberi

## Gereksinimler
- Node.js v22+ (kurulu: v22.13.1)
- npm (Node.js ile birlikte gelir)

## Kurulum Adımları

### 1. Bağımlılıkları Kur
```powershell
cd frontend
npm.cmd install
```

**Not:** PowerShell'de execution policy sorunu yaşıyorsanız `npm.cmd` kullanın (`.ps1` yerine `.cmd`).

### 2. Development Server'ı Başlat
```powershell
npm.cmd run dev
```

Veya PowerShell execution policy sorununu çözmek için:
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

Sonra normal npm komutlarını kullanabilirsiniz:
```powershell
npm run dev
npm run build
npm start
```

## Mevcut Durum
✅ **Bağımlılıklar kuruldu** (690 paket)
⚠️ 1 orta seviye güvenlik açığı var (opsiyonel: `npm audit fix`)

## Kullanılabilir Komutlar
- `npm run dev` - Development server başlat (Turbopack ile)
- `npm run build` - Production build oluştur
- `npm start` - Production server başlat
- `npm run lint` - ESLint ile kod kontrolü

## Sorun Giderme

### PowerShell Execution Policy Hatası
Eğer `npm` komutu çalışmıyorsa:
1. `npm.cmd` kullanın (örn: `npm.cmd install`)
2. Veya execution policy'yi değiştirin:
   ```powershell
   Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
   ```

### Port Zaten Kullanılıyor
Next.js varsayılan olarak port 3000 kullanır. Farklı bir port kullanmak için:
```powershell
npm run dev -- -p 3001
```
