import type { IncomeThresholdPoint } from '../data/worldIncomeThresholds';

export function percentileFromIncome(
  income: number,
  thresholds: ReadonlyArray<IncomeThresholdPoint>
): number | null {
  if (!Number.isFinite(income) || income <= 0) return null;
  if (thresholds.length === 0) return null;

  // Defensive: thresholds should be sorted ascending by income.
  let lo = 0;
  let hi = thresholds.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const t = thresholds[mid].income;
    if (t <= income) lo = mid + 1;
    else hi = mid - 1;
  }

  const idx = Math.max(0, Math.min(thresholds.length - 1, hi));
  const left = thresholds[idx];
  if (idx >= thresholds.length - 1) return left.p;

  const right = thresholds[idx + 1];
  const p0 = left.p;
  const p1 = right.p;
  const x0 = left.income;
  const x1 = right.income;
  if (!Number.isFinite(x0) || !Number.isFinite(x1) || x1 <= x0) return p0;

  const fracLinear = (income - x0) / (x1 - x0);
  const fracLog = x0 > 0 && x1 > 0
    ? (Math.log(income) - Math.log(x0)) / (Math.log(x1) - Math.log(x0))
    : fracLinear;
  const frac = Number.isFinite(fracLog) ? fracLog : fracLinear;
  const clamped = Math.min(1, Math.max(0, frac));

  return p0 + clamped * (p1 - p0);
}

export function topPercentFromIncome(
  income: number,
  thresholds: ReadonlyArray<IncomeThresholdPoint>
): number | null {
  const percentile = percentileFromIncome(income, thresholds);
  if (percentile === null) return null;
  return Math.min(100, Math.max(0, 100 - percentile));
}

export function formatTopPercent(topPercent: number, locale?: string): string {
  if (!Number.isFinite(topPercent)) return '';

  // Clamp and format for human readability.
  const v = Math.min(100, Math.max(0, topPercent));
  const tiny = 0.001;
  if (v > 0 && v < tiny) return `< ${tiny}%`;

  // Use fewer decimals for larger numbers; more precision for the extreme top tail.
  let maxFractionDigits = 0;
  if (v < 0.01) maxFractionDigits = 3;
  else if (v < 0.1) maxFractionDigits = 2;
  else if (v < 10) maxFractionDigits = 1;

  return `${v.toLocaleString(locale, { maximumFractionDigits: maxFractionDigits })}%`;
}

