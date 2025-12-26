import rawData from './countryCurrency.json';

export type CountryCurrencyEntry = Readonly<{
  code: string;
  iso3: string;
  name: string;
  currency: string | null;
}>;

export const COUNTRY_CURRENCY = rawData as CountryCurrencyEntry[];

export const COUNTRY_CURRENCY_BY_CODE = COUNTRY_CURRENCY.reduce<Record<string, CountryCurrencyEntry>>(
  (acc, entry) => {
    acc[entry.code] = entry;
    return acc;
  },
  {}
);
