import { Lang } from './i18n';

const AR_DIGITS = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];

export function formatPrice(amount: number, lang: Lang): string {
  const fixed = amount.toFixed(2);
  if (lang === 'ar') {
    const ar = fixed.replace(/\d/g, (d) => AR_DIGITS[parseInt(d, 10)]);
    return `${ar} ر.س`;
  }
  return `SAR ${fixed}`;
}

export function formatNumber(n: number, lang: Lang): string {
  const s = String(n);
  if (lang === 'ar') return s.replace(/\d/g, (d) => AR_DIGITS[parseInt(d, 10)]);
  return s;
}
