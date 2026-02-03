/**
 * Merkezi Format/Mapping Utility
 * Cinsiyet, yaşam durumu ve diğer alanlar için Türkçe çeviriler
 * Case-insensitive, null/unknown handling ile
 */

// Cinsiyet mapping
const GENDER_MAP: Record<string, string> = {
  'male': 'Erkek',
  'm': 'Erkek',
  'erkek': 'Erkek',
  'female': 'Kadın',
  'f': 'Kadın',
  'kadın': 'Kadın',
  'kadin': 'Kadın',
};

// Yaşam durumu mapping
const VITAL_STATUS_MAP: Record<string, string> = {
  'living': 'Yaşıyor',
  'alive': 'Yaşıyor',
  'yaşıyor': 'Yaşıyor',
  'yasiyor': 'Yaşıyor',
  'dead': 'Vefat',
  'deceased': 'Vefat',
  'vefat': 'Vefat',
};

/**
 * Cinsiyet değerini Türkçe'ye çevirir
 * @param value - Ham cinsiyet değeri (male, female, M, F, vb.)
 * @param fallback - Bilinmeyen değerler için varsayılan metin
 */
export function formatGender(value: string | null | undefined, fallback: string = 'Bilinmiyor'): string {
  if (!value || value.trim() === '') return fallback;
  const normalized = value.toLowerCase().trim();
  return GENDER_MAP[normalized] ?? fallback;
}

/**
 * Yaşam durumunu Türkçe'ye çevirir
 * @param value - Ham yaşam durumu değeri (living, dead, vb.)
 * @param fallback - Bilinmeyen değerler için varsayılan metin
 */
export function formatVitalStatus(value: string | null | undefined, fallback: string = 'Bilinmiyor'): string {
  if (!value || value.trim() === '') return fallback;
  const normalized = value.toLowerCase().trim();
  return VITAL_STATUS_MAP[normalized] ?? fallback;
}

/**
 * Cinsiyeti normalize eder (grafik veri hazırlığı için)
 * Tüm varyasyonları standart forma çeker
 */
export function normalizeGender(value: string | null | undefined): 'Erkek' | 'Kadın' | 'Bilinmiyor' {
  if (!value || value.trim() === '') return 'Bilinmiyor';
  const normalized = value.toLowerCase().trim();
  if (['male', 'm', 'erkek'].includes(normalized)) return 'Erkek';
  if (['female', 'f', 'kadın', 'kadin'].includes(normalized)) return 'Kadın';
  return 'Bilinmiyor';
}

/**
 * Sayısal değeri güvenli formatta gösterir
 * @param value - Sayısal değer
 * @param decimals - Ondalık basamak sayısı
 * @param fallback - Null/undefined için varsayılan
 */
export function formatNumber(value: number | null | undefined, decimals: number = 2, fallback: string = '-'): string {
  if (value === null || value === undefined || isNaN(value)) return fallback;
  return value.toFixed(decimals);
}

/**
 * Tarih değerini formatlar
 * @param value - ISO tarih string veya null
 * @param fallback - Bilinmeyen değerler için varsayılan
 */
export function formatDate(value: string | null | undefined, fallback: string = '-'): string {
  if (!value) return fallback;
  try {
    const date = new Date(value);
    if (isNaN(date.getTime())) return fallback;
    return date.toLocaleDateString('tr-TR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
  } catch {
    return fallback;
  }
}

/**
 * KMR değerini formatlar
 */
export function formatKMR(value: number | null | undefined): string {
  return formatNumber(value, 4, '-') + (value !== null && value !== undefined ? '%' : '');
}

/**
 * KRE değerini formatlar
 */
export function formatKRE(value: number | null | undefined): string {
  return formatNumber(value, 2, '-');
}

/**
 * GFR değerini formatlar
 */
export function formatGFR(value: number | null | undefined): string {
  return formatNumber(value, 0, '-');
}

/**
 * Trend yönünü Türkçe olarak döndürür
 */
export function formatTrend(slope: number | null | undefined): { text: string; direction: 'up' | 'down' | 'stable' } {
  if (slope === null || slope === undefined || isNaN(slope)) {
    return { text: 'Veri Yok', direction: 'stable' };
  }
  if (Math.abs(slope) < 0.001) {
    return { text: 'Stabil', direction: 'stable' };
  }
  if (slope > 0) {
    return { text: 'Yükseliş', direction: 'up' };
  }
  return { text: 'Düşüş', direction: 'down' };
}

/**
 * Boolean iyileşme durumunu Türkçe'ye çevirir
 */
export function formatImprovedStatus(improved: boolean | null | undefined): string {
  if (improved === null || improved === undefined) return 'Bilinmiyor';
  return improved ? 'İyileşmiş' : 'Takipte';
}

/**
 * Anomali durumunu Türkçe'ye çevirir
 */
export function formatAnomalyStatus(hasAnomaly: boolean | null | undefined): string {
  if (hasAnomaly === null || hasAnomaly === undefined) return '-';
  return hasAnomaly ? 'Var' : 'Yok';
}
