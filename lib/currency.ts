// Exchange rates: 1 unit of currency = X DKK
const RATES_TO_DKK: Record<string, number> = {
  DKK: 1,
  USD: 6.85,
  EUR: 7.46,
  GBP: 8.68,
  SEK: 0.64,
  NOK: 0.65,
};

export const SUPPORTED_CURRENCIES = [
  "DKK",
  "USD",
  "EUR",
  "GBP",
  "SEK",
  "NOK",
] as const;

export type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number];

/**
 * Convert amount from one currency to another via DKK as intermediary.
 */
export function convertCurrency(
  amount: number,
  from: string,
  to: string
): number {
  if (from === to) return amount;
  const fromRate = RATES_TO_DKK[from];
  const toRate = RATES_TO_DKK[to];
  if (!fromRate || !toRate) return amount;
  return (amount * fromRate) / toRate;
}

/**
 * Round converted values to clean numbers based on magnitude.
 */
export function smartRound(amount: number): number {
  const abs = Math.abs(amount);
  let step: number;
  if (abs < 100) step = 1;
  else if (abs < 1000) step = 5;
  else if (abs < 10000) step = 50;
  else if (abs < 100000) step = 500;
  else step = 1000;
  return Math.round(amount / step) * step;
}

/**
 * Convert + smart-round in one call.
 */
export function convertAndRound(
  amount: number,
  from: string,
  to: string
): number {
  if (from === to) return amount;
  return smartRound(convertCurrency(amount, from, to));
}

import { formatCurrency, formatFixedBudget } from "@/lib/calculations";

/**
 * Convert amount from one currency to another, then format for display.
 */
export function convertAndFormat(
  amount: number,
  from: string,
  to: string
): string {
  return formatCurrency(convertCurrency(amount, from, to), to);
}

/**
 * Convert amount and format as a budget (0 decimals).
 */
export function convertAndFormatBudget(
  amount: number,
  from: string,
  to: string
): string {
  return formatFixedBudget(convertCurrency(amount, from, to), to);
}
