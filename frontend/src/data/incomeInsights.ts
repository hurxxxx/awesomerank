/**
 * Income insights data for enhanced Income Rank results
 * Sources: World Bank, WID.world, Poverty & Inequality Platform
 */

import type { TFunction } from 'i18next';

export interface IncomeClass {
  id: string;
  labelKey: string;  // i18n key
  minPercentile: number;
  maxPercentile: number;
  color: string;
  description: string;  // i18n key
}

/**
 * Global income classes based on percentile distribution
 * Inspired by World Bank income classifications and WID.world quintiles
 */
export const INCOME_CLASSES: IncomeClass[] = [
  {
    id: 'extreme-poverty',
    labelKey: 'Extreme Poverty',
    minPercentile: 0,
    maxPercentile: 10,
    color: '#dc2626',  // red
    description: 'Below $2.15/day poverty line',
  },
  {
    id: 'poverty',
    labelKey: 'Low Income',
    minPercentile: 10,
    maxPercentile: 30,
    color: '#ea580c',  // orange
    description: '$2.15 - $6.85/day',
  },
  {
    id: 'lower-middle',
    labelKey: 'Lower Middle Class',
    minPercentile: 30,
    maxPercentile: 50,
    color: '#ca8a04',  // yellow
    description: 'Below global median',
  },
  {
    id: 'middle',
    labelKey: 'Global Middle Class',
    minPercentile: 50,
    maxPercentile: 70,
    color: '#16a34a',  // green
    description: 'Around global median',
  },
  {
    id: 'upper-middle',
    labelKey: 'Upper Middle Class',
    minPercentile: 70,
    maxPercentile: 90,
    color: '#0891b2',  // cyan
    description: 'Above most of the world',
  },
  {
    id: 'affluent',
    labelKey: 'Affluent',
    minPercentile: 90,
    maxPercentile: 99,
    color: '#7c3aed',  // purple
    description: 'Top 10% globally',
  },
  {
    id: 'elite',
    labelKey: 'Global Elite',
    minPercentile: 99,
    maxPercentile: 100,
    color: '#db2777',  // pink
    description: 'Top 1% globally',
  },
];

/**
 * World Bank poverty lines (2017 PPP, daily amounts)
 * Source: https://pip.worldbank.org/
 */
export const POVERTY_LINES = {
  extreme: {
    dailyUsd: 2.15,
    annualUsd: 2.15 * 365,  // ~$785
    labelKey: 'Extreme Poverty Line',
    description: 'International extreme poverty threshold',
  },
  lower: {
    dailyUsd: 3.65,
    annualUsd: 3.65 * 365,  // ~$1,332
    labelKey: 'Lower-Middle Income Poverty Line',
    description: 'Poverty line for lower-middle-income countries',
  },
  upper: {
    dailyUsd: 6.85,
    annualUsd: 6.85 * 365,  // ~$2,500
    labelKey: 'Upper-Middle Income Poverty Line',
    description: 'Poverty line for upper-middle-income countries',
  },
} as const;

/**
 * Global consumer class threshold
 * Source: World Data Lab - spending $12+/day (2017 PPP)
 * Represents people with purchasing power beyond basic necessities
 */
export const CONSUMER_CLASS = {
  dailyUsd: 12,
  annualUsd: 12 * 365,  // ~$4,380
  labelKey: 'Global Consumer Class',
  description: 'Spending capacity beyond basic necessities',
} as const;

/**
 * Key income milestones for context
 * All values in annual USD (PPP)
 */
export const INCOME_MILESTONES = {
  // Percentile-based milestones
  bottomQuintile: { percentile: 20, labelKey: 'Bottom 20%' },
  median: { percentile: 50, labelKey: 'Global Median' },
  top50: { percentile: 50, labelKey: 'Top Half' },
  top20: { percentile: 80, labelKey: 'Top 20%' },
  top10: { percentile: 90, labelKey: 'Top 10%' },
  top5: { percentile: 95, labelKey: 'Top 5%' },
  top1: { percentile: 99, labelKey: 'Top 1%' },
  top01: { percentile: 99.9, labelKey: 'Top 0.1%' },
} as const;

// i18next-parser helper to include dynamic keys from this file.
export const getIncomeInsightKeys = (t: TFunction): string[] => [
  t('Extreme Poverty'),
  t('Low Income'),
  t('Lower Middle Class'),
  t('Global Middle Class'),
  t('Upper Middle Class'),
  t('Affluent'),
  t('Global Elite'),
  t('Below $2.15/day poverty line'),
  t('$2.15 - $6.85/day'),
  t('Below global median'),
  t('Around global median'),
  t('Above most of the world'),
  t('Top 10% globally'),
  t('Top 1% globally'),
  t('Extreme Poverty Line'),
  t('Lower-Middle Income Poverty Line'),
  t('Upper-Middle Income Poverty Line'),
  t('International extreme poverty threshold'),
  t('Poverty line for lower-middle-income countries'),
  t('Poverty line for upper-middle-income countries'),
  t('Global Consumer Class'),
  t('Spending capacity beyond basic necessities'),
  t('Bottom 20%'),
  t('Global Median'),
  t('Top Half'),
  t('Top 20%'),
  t('Top 10%'),
  t('Top 5%'),
  t('Top 1%'),
  t('Top 0.1%'),
];

/**
 * Get income class based on percentile
 */
export function getIncomeClass(percentile: number): IncomeClass {
  for (const cls of INCOME_CLASSES) {
    if (percentile >= cls.minPercentile && percentile < cls.maxPercentile) {
      return cls;
    }
  }
  // Default to elite for 100th percentile edge case
  return INCOME_CLASSES[INCOME_CLASSES.length - 1];
}

/**
 * Check if income is above poverty lines
 */
export function getPovertyStatus(annualIncomeUsd: number) {
  return {
    aboveExtremePoverty: annualIncomeUsd > POVERTY_LINES.extreme.annualUsd,
    aboveLowerPoverty: annualIncomeUsd > POVERTY_LINES.lower.annualUsd,
    aboveUpperPoverty: annualIncomeUsd > POVERTY_LINES.upper.annualUsd,
    isConsumerClass: annualIncomeUsd > CONSUMER_CLASS.annualUsd,
  };
}

/**
 * Key statistics for comparison context
 * Source: Various 2024-2025 data
 */
export const CONTEXT_STATS = {
  worldPopulation: 8_000_000_000,

  // Percentage of world population
  percentAboveExtremePoverty: 91,  // ~91% live above $2.15/day
  percentConsumerClass: 50,  // ~50% are in "consumer class" ($12+/day)
  percentWithElectricity: 91.6,
  percentWithInternet: 74,

  // Reference incomes (annual, PPP-adjusted USD)
  usMedianIncome: 59_540,  // US median household income / 1.5 (rough per-adult)
  chinaMedianIncome: 12_000,  // China urban median (rough estimate)
  indiaMedianIncome: 2_500,  // India median (rough estimate)
} as const;
