import type { PriceRange } from '../types';

const eur = new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
const eurPrecise = new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 });

export function formatEUR(value: number, precise = false): string {
  if (value === 0) return 'Free';
  return (precise ? eurPrecise : eur).format(value);
}

export function formatDuration(mins: number): string {
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

export const PRICE_ORDER: Record<PriceRange, number> = { free: 0, budget: 1, mid: 2, high: 3 };

export function pluralize(n: number, word: string, plural = `${word}s`) {
  return `${n} ${n === 1 ? word : plural}`;
}
