export const CURRENCY_CODE = 'SAR';
export const CURRENCY_LOCALE = 'en-SA';

const formatters = new Map<number, Intl.NumberFormat>();

function formatter(fractionDigits: number): Intl.NumberFormat {
  const digits = Math.min(Math.max(Math.trunc(fractionDigits), 0), 4);
  let value = formatters.get(digits);
  if (!value) {
    value = new Intl.NumberFormat(CURRENCY_LOCALE, {
      style: 'currency',
      currency: CURRENCY_CODE,
      currencyDisplay: 'code',
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    });
    formatters.set(digits, value);
  }
  return value;
}

export function formatCurrency(value: unknown, fractionDigits = 2): string {
  const numeric = Number(value);
  return formatter(fractionDigits).format(Number.isFinite(numeric) ? numeric : 0);
}

export function parseCurrencyInput(value: unknown): number {
  const normalized = String(value ?? '')
    .replace(/SAR|ر\.?\s?س\.?|﷼/gi, '')
    .replace(/[$,\s]/g, '');
  const numeric = Number(normalized);
  return Number.isFinite(numeric) ? numeric : 0;
}
