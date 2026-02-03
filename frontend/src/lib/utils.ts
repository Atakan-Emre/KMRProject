import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

/**
 * Class name birleştirme fonksiyonu
 * clsx ve tailwind-merge kullanarak class name'leri birleştirir
 * Tailwind CSS çakışmalarını otomatik olarak çözer
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
