import { useMemo, useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import type { IncomeBasis } from '../data/worldIncomeThresholds';
import { WORLD_INCOME_THRESHOLDS_USD, WORLD_INCOME_WID } from '../data/worldIncomeThresholds';
import { formatTopPercent, percentileFromIncome, topPercentFromIncome } from '../utils/incomeRank';
import { getIncomeClass, getPovertyStatus, POVERTY_LINES, CONSUMER_CLASS } from '../data/incomeInsights';
import { COUNTRY_CURRENCY, COUNTRY_CURRENCY_BY_CODE } from '../data/countryCurrency';
import { useConsent } from '../contexts/useConsent';
import { IncomeChart } from './IncomeChart';
import { InfoTooltip } from './InfoTooltip';
import './IncomeRank.css';

// World population constant (2024 estimate)
const WORLD_POPULATION = 8_000_000_000;
const COUNTRY_FALLBACK = 'US';

const COUNTRY_LIST = COUNTRY_CURRENCY;

const getCountryCurrency = (code: string) => {
  const entry = COUNTRY_CURRENCY_BY_CODE[code];
  return entry?.currency ?? null;
};

const getCurrencySymbol = (currencyCode: string, locale: string = 'en'): string | null => {
  if (!currencyCode) return null;
  try {
    const formatter = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currencyCode.toUpperCase(),
      currencyDisplay: 'narrowSymbol',
    });
    const parts = formatter.formatToParts(0);
    const symbolPart = parts.find((p) => p.type === 'currency');
    return symbolPart?.value ?? null;
  } catch {
    return null;
  }
};

const formatCurrencyWithSymbol = (currencyCode: string, locale: string = 'en'): string => {
  const code = currencyCode.toUpperCase();
  const symbol = getCurrencySymbol(code, locale);
  if (symbol && symbol !== code) {
    return `${code} (${symbol})`;
  }
  return code;
};

const detectCountryCode = () => {
  const fallback = COUNTRY_CURRENCY_BY_CODE[COUNTRY_FALLBACK] ? COUNTRY_FALLBACK : COUNTRY_LIST[0]?.code ?? '';
  if (typeof navigator === 'undefined') return fallback;
  const candidate = navigator.languages?.[0] || navigator.language;
  if (!candidate) return fallback;
  try {
    // Intl.Locale provides region parsing for locales like en-US
    const locale = new Intl.Locale(candidate);
    const region = locale.region;
    if (region && COUNTRY_CURRENCY_BY_CODE[region]) return region;
  } catch {
    const match = candidate.match(/-([A-Z]{2})/i);
    if (match) {
      const region = match[1].toUpperCase();
      if (COUNTRY_CURRENCY_BY_CODE[region]) return region;
    }
  }
  return fallback;
};

// Parse URL parameters for shared results
const getUrlParams = (): {
  income: number | null;
  basis: IncomeBasis | null;
  country: string | null;
  currency: string | null;
  adults: number | null;
  children: number | null;
  year: string | null;
} => {
  const params = new URLSearchParams(window.location.search);
  const income = params.get('householdIncome') ?? params.get('income');
  const basis = params.get('basis');
  const country = params.get('country');
  const currency = params.get('currency');
  const adults = params.get('adults');
  const children = params.get('children');
  const year = params.get('year');
  return {
    income: income ? parseFloat(income) : null,
    basis: (basis === 'PPP' || basis === 'MER') ? basis as IncomeBasis : null,
    country: country || null,
    currency: currency || null,
    adults: adults ? Number.parseInt(adults, 10) : null,
    children: children ? Number.parseInt(children, 10) : null,
    year: year || null,
  };
};

const parseIncomeInput = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const normalized = trimmed
    .replace(/[^\d.,-]/g, '')
    .replace(/,/g, '');

  const n = Number.parseFloat(normalized);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
};

const parseCountInput = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const n = Number.parseInt(trimmed, 10);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function randomId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function getOrCreateClientId() {
  const key = 'world_rank_client_id';
  try {
    const existing = localStorage.getItem(key);
    if (existing) return existing;
    const created = randomId();
    localStorage.setItem(key, created);
    return created;
  } catch {
    return null;
  }
}

function getAttributionData() {
  const url = new URL(window.location.href);
  const paramOrNull = (key: string) => url.searchParams.get(key) || null;

  return {
    landingUrl: url.toString(),
    landingPath: `${url.pathname}${url.search}`,
    documentReferrer: document.referrer || null,
    utmSource: paramOrNull('utm_source'),
    utmMedium: paramOrNull('utm_medium'),
    utmCampaign: paramOrNull('utm_campaign'),
    utmContent: paramOrNull('utm_content'),
    utmTerm: paramOrNull('utm_term'),
  };
}

function getClientData() {
  return {
    browserLanguage: navigator.language,
    languages: navigator.languages?.join(',') || navigator.language,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    deviceType: /Mobile|Android|iPhone|iPad/i.test(navigator.userAgent) ? 'mobile' : 'desktop',
    screenWidth: window.screen.width,
    screenHeight: window.screen.height,
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
    pixelRatio: window.devicePixelRatio,
    connectionType: (navigator as Navigator & { connection?: { effectiveType?: string } }).connection?.effectiveType || 'unknown',
  };
}

async function submitAppData(data: Record<string, unknown>) {
  try {
    const apiUrl = import.meta.env.PROD ? '/api/submit' : 'http://localhost:3000/api/submit';
    const res = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.ok;
  } catch (error) {
    console.error('Failed to submit data:', error);
    return false;
  }
}

export function IncomeRank() {
  const { t, i18n } = useTranslation();
  const { canCollectData } = useConsent();
  const urlParams = getUrlParams();
  const initialCountryCode = useMemo(() => {
    if (urlParams.country && COUNTRY_CURRENCY_BY_CODE[urlParams.country]) return urlParams.country;
    return detectCountryCode();
  }, [urlParams.country]);
  const [basis, setBasis] = useState<IncomeBasis>(urlParams.basis ?? 'PPP');
  const [countryCode, setCountryCode] = useState<string>(initialCountryCode);
  const [currencyLocked, setCurrencyLocked] = useState(!urlParams.currency);
  const [localIncomeText, setLocalIncomeText] = useState(urlParams.income ? urlParams.income.toString() : '');
  const [householdAdults, setHouseholdAdults] = useState(
    urlParams.adults !== null ? String(urlParams.adults) : urlParams.income ? '1' : ''
  );
  const [householdChildren, setHouseholdChildren] = useState(
    urlParams.children !== null ? String(urlParams.children) : urlParams.income ? '0' : ''
  );
  const [currencyCode, setCurrencyCode] = useState(() => urlParams.currency ?? getCountryCurrency(initialCountryCode) ?? '');
  const [conversionText, setConversionText] = useState('');
  const [conversionLocked, setConversionLocked] = useState(true);
  const [conversionStatus, setConversionStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [conversionMeta, setConversionMeta] = useState<{ date: string | null; source: 'PPP' | 'MER' | null }>({
    date: null,
    source: null,
  });
  const [incomeYear, setIncomeYear] = useState(urlParams.year ?? String(WORLD_INCOME_WID.year));
  const [submittedIncome, setSubmittedIncome] = useState<number | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [showCopied, setShowCopied] = useState(false);
  const [, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'skipped' | 'error'>('idle');
  const resultRef = useRef<HTMLDivElement>(null);
  const initialLoadRef = useRef(true);
  const autoSubmitRef = useRef(Boolean(urlParams.income));
  const startedAtRef = useRef<number>(Date.now());
  const sessionIdRef = useRef<string>(randomId());
  const attributionRef = useRef(getAttributionData());

  // Scroll to result after initial load from shared link
  useEffect(() => {
    if (initialLoadRef.current && urlParams.income) {
      initialLoadRef.current = false;
      setTimeout(() => {
        resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 500);
    }
  }, [urlParams.income]);

  useEffect(() => {
    if (!countryCode) return;
    if (countryCode === 'OTHER') {
      setCurrencyLocked(false);
      setConversionLocked(false);
      if (!currencyCode) setCurrencyCode('');
      return;
    }
    const currency = getCountryCurrency(countryCode);
    if (currency) {
      setCurrencyCode(currency);
      setCurrencyLocked(true);
    } else {
      setCurrencyLocked(false);
    }
  }, [countryCode, currencyCode]);

  const regionNames = useMemo(() => {
    if (typeof Intl !== 'undefined' && 'DisplayNames' in Intl) {
      try {
        return new Intl.DisplayNames([i18n.language], { type: 'region' });
      } catch {
        return null;
      }
    }
    return null;
  }, [i18n.language]);

  const countryOptions = useMemo(() => {
    return [...COUNTRY_LIST]
      .map((entry) => ({
        code: entry.code,
        name: regionNames?.of(entry.code) ?? entry.name,
      }))
      .sort((a, b) => a.name.localeCompare(b.name, i18n.language));
  }, [regionNames, i18n.language]);

  const thresholds = WORLD_INCOME_THRESHOLDS_USD[basis];
  const normalizedCurrency = currencyCode.trim().toUpperCase();
  const parsedLocalIncome = useMemo(() => parseIncomeInput(localIncomeText), [localIncomeText]);
  const parsedAdults = useMemo(() => parseCountInput(householdAdults), [householdAdults]);
  const parsedChildren = useMemo(() => parseCountInput(householdChildren), [householdChildren]);
  const equivalenceScale = useMemo(() => {
    if (parsedAdults === null || parsedChildren === null) return null;
    if (parsedAdults < 1) return null;
    const additionalAdults = Math.max(0, parsedAdults - 1);
    return 1 + additionalAdults * 0.5 + parsedChildren * 0.3;
  }, [parsedAdults, parsedChildren]);
  const perPersonLocalIncome = useMemo(() => {
    if (parsedLocalIncome === null || equivalenceScale === null) return null;
    return parsedLocalIncome / equivalenceScale;
  }, [parsedLocalIncome, equivalenceScale]);
  const parsedConversion = useMemo(() => parseIncomeInput(conversionText), [conversionText]);
  const effectiveConversion = useMemo(() => {
    if (conversionLocked && conversionStatus === 'error') return null;
    return parsedConversion;
  }, [parsedConversion, conversionLocked, conversionStatus]);
  const convertedIncomeUsd = useMemo(() => {
    if (perPersonLocalIncome === null || effectiveConversion === null) return null;
    return perPersonLocalIncome / effectiveConversion;
  }, [perPersonLocalIncome, effectiveConversion]);

  useEffect(() => {
    if (!autoSubmitRef.current) return;
    if (convertedIncomeUsd === null || conversionStatus !== 'success') return;
    autoSubmitRef.current = false;
    setSubmittedIncome(convertedIncomeUsd);
  }, [convertedIncomeUsd, conversionStatus]);
  const parsedIncomeYear = useMemo(() => {
    const year = Number.parseInt(incomeYear.trim(), 10);
    return Number.isFinite(year) ? year : null;
  }, [incomeYear]);

  const percentile = useMemo(
    () => (submittedIncome === null ? null : percentileFromIncome(submittedIncome, thresholds)),
    [submittedIncome, thresholds]
  );
  const topPercent = useMemo(
    () => (submittedIncome === null ? null : topPercentFromIncome(submittedIncome, thresholds)),
    [submittedIncome, thresholds]
  );

  const topPeople = useMemo(() => {
    if (topPercent === null) return null;
    const worldPopulation = 8_000_000_000;
    const count = Math.round((topPercent / 100) * worldPopulation);
    return Math.max(1, count);
  }, [topPercent]);

  const topLabel = useMemo(() => {
    if (topPercent === null) return null;
    return formatTopPercent(topPercent, i18n.language);
  }, [topPercent, i18n.language]);

  const richerThanLabel = useMemo(() => {
    if (percentile === null) return null;
    const p = clamp(percentile, 0, 100);
    const digits = p < 0.01 ? 3 : p < 0.1 ? 2 : p < 10 ? 1 : 0;
    return `${p.toLocaleString(i18n.language, { maximumFractionDigits: digits })}%`;
  }, [percentile, i18n.language]);

  

  const usd = useMemo(() => {
    try {
      return new Intl.NumberFormat(i18n.language, {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 0,
      });
    } catch {
      return new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 0,
      });
    }
  }, [i18n.language]);

  const usdDaily = useMemo(() => {
    try {
      return new Intl.NumberFormat(i18n.language, {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    } catch {
      return new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    }
  }, [i18n.language]);

  const usdDailyDelta = useMemo(() => {
    try {
      return new Intl.NumberFormat(i18n.language, {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
        signDisplay: 'always',
      });
    } catch {
      return new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    }
  }, [i18n.language]);

  const highlight = useMemo(() => {
    const find = (p: number) => thresholds.find((x) => x.p === p)?.income ?? null;
    return {
      median: find(50),
      top10: find(90),
      top1: find(99),
      top01: find(99.9),
    };
  }, [thresholds]);

  const medianMultiple = useMemo(() => {
    if (submittedIncome === null) return null;
    if (!highlight.median || highlight.median <= 0) return null;
    return submittedIncome / highlight.median;
  }, [submittedIncome, highlight.median]);

  // Income class (quintile/label) based on percentile
  const incomeClass = useMemo(() => {
    if (percentile === null) return null;
    return getIncomeClass(percentile);
  }, [percentile]);

  // Poverty status indicators
  const povertyStatus = useMemo(() => {
    if (submittedIncome === null) return null;
    return getPovertyStatus(submittedIncome);
  }, [submittedIncome]);

  // Daily income calculation
  const dailyIncome = useMemo(() => {
    if (submittedIncome === null) return null;
    return submittedIncome / 365;
  }, [submittedIncome]);

  const monthlyIncome = useMemo(() => {
    if (submittedIncome === null) return null;
    return submittedIncome / 12;
  }, [submittedIncome]);

  const dailyPpp = useMemo(() => {
    if (convertedIncomeUsd === null) return null;
    return convertedIncomeUsd / 365;
  }, [convertedIncomeUsd]);

  const oneInPeople = useMemo(() => {
    if (topPercent === null) return null;
    if (!Number.isFinite(topPercent) || topPercent <= 0) return null;
    return Math.max(1, Math.round(100 / topPercent));
  }, [topPercent]);

  // Calculate absolute number of people in this top percentile group
  const peopleInGroup = useMemo(() => {
    if (topPercent === null) return null;
    if (!Number.isFinite(topPercent) || topPercent <= 0) return null;
    return Math.round(WORLD_POPULATION * (topPercent / 100));
  }, [topPercent]);

  const nextMilestone = useMemo(() => {
    if (submittedIncome === null) return null;
    const candidates: Array<{ label: string; threshold: number | null }> = [
      { label: t('Top 10%'), threshold: highlight.top10 },
      { label: t('Top 1%'), threshold: highlight.top1 },
      { label: t('Top 0.1%'), threshold: highlight.top01 },
    ];

    const next = candidates.find((c) => c.threshold !== null && submittedIncome < (c.threshold as number));
    if (!next || next.threshold === null) return { label: t('Top 0.1%'), threshold: highlight.top01, delta: 0, reached: true };
    const delta = Math.max(0, next.threshold - submittedIncome);
    return { label: next.label, threshold: next.threshold, delta, reached: delta <= 0 };
  }, [submittedIncome, highlight.top1, highlight.top01, highlight.top10, t]);

  const povertyBenchmarks = useMemo(() => {
    if (!dailyIncome || !povertyStatus) return null;
    return [
      {
        id: 'extreme',
        labelKey: POVERTY_LINES.extreme.labelKey,
        dailyUsd: POVERTY_LINES.extreme.dailyUsd,
        isAbove: povertyStatus.aboveExtremePoverty,
        highlight: false,
      },
      {
        id: 'upper',
        labelKey: POVERTY_LINES.upper.labelKey,
        dailyUsd: POVERTY_LINES.upper.dailyUsd,
        isAbove: povertyStatus.aboveUpperPoverty,
        highlight: false,
      },
      {
        id: 'consumer',
        labelKey: CONSUMER_CLASS.labelKey,
        dailyUsd: CONSUMER_CLASS.dailyUsd,
        isAbove: povertyStatus.isConsumerClass,
        highlight: true,
      },
    ].map((b) => ({
      ...b,
      gapDailyUsd: dailyIncome - b.dailyUsd,
    }));
  }, [dailyIncome, povertyStatus]);

  const fetchPPPConversion = async (iso2: string, year: string) => {
    const baseUrl = 'https://api.worldbank.org/v2/country';
    const primaryUrl = `${baseUrl}/${iso2}/indicator/PA.NUS.PPP?date=${year}&format=json`;
    const fallbackUrl = `${baseUrl}/${iso2}/indicator/PA.NUS.PPP?format=json&per_page=1`;

    const parseWorldBank = (payload: unknown) => {
      if (!Array.isArray(payload) || payload.length < 2) return null;
      const data = payload[1];
      if (!Array.isArray(data)) return null;
      const entry = data.find((item): item is { value: number; date?: string } => {
        if (!item || typeof item !== 'object') return false;
        const maybeValue = (item as { value?: unknown }).value;
        return typeof maybeValue === 'number';
      }) ?? null;
      if (!entry) return null;
      return { value: entry.value, date: String(entry.date ?? '') };
    };

    const primary = await fetch(primaryUrl).then((res) => res.json());
    const parsedPrimary = parseWorldBank(primary);
    if (parsedPrimary) return parsedPrimary;

    const fallback = await fetch(fallbackUrl).then((res) => res.json());
    return parseWorldBank(fallback);
  };

  const fetchMerRate = async (currency: string, year: string) => {
    const date = `${year}-07-01`;
    const baseUrl = 'https://api.frankfurter.dev/v1';
    const primaryUrl = `${baseUrl}/${date}?base=USD&symbols=${currency}`;
    const fallbackUrl = `${baseUrl}/latest?base=USD&symbols=${currency}`;

    const parseFrankfurter = (payload: unknown) => {
      if (!payload || typeof payload !== 'object') return null;
      const data = payload as { rates?: Record<string, number>; date?: string };
      const rate = data.rates?.[currency];
      if (!rate || !Number.isFinite(rate)) return null;
      return { value: rate, date: data.date ? String(data.date) : null };
    };

    const primary = await fetch(primaryUrl).then((res) => res.json());
    const parsedPrimary = parseFrankfurter(primary);
    if (parsedPrimary) return parsedPrimary;

    const fallback = await fetch(fallbackUrl).then((res) => res.json());
    return parseFrankfurter(fallback);
  };

  useEffect(() => {
    if (!conversionLocked) return;
    if (!normalizedCurrency || countryCode === 'OTHER') {
      setConversionText('');
      setConversionStatus('error');
      setConversionMeta({ date: null, source: null });
      return;
    }
    if (!incomeYear.trim()) {
      setConversionText('');
      setConversionStatus('error');
      setConversionMeta({ date: null, source: null });
      return;
    }

    if (normalizedCurrency === 'USD') {
      setConversionText('1');
      setConversionStatus('success');
      setConversionMeta({ date: null, source: basis });
      return;
    }

    let isActive = true;
    setConversionStatus('loading');

    const run = async () => {
      try {
        if (basis === 'PPP') {
          const result = await fetchPPPConversion(countryCode.toLowerCase(), incomeYear);
          if (!result) throw new Error('PPP unavailable');
          if (!isActive) return;
          setConversionText(String(result.value));
          setConversionMeta({ date: result.date || null, source: 'PPP' });
          setConversionStatus('success');
          return;
        }

        const result = await fetchMerRate(normalizedCurrency, incomeYear);
        if (!result) throw new Error('MER unavailable');
        if (!isActive) return;
        setConversionText(String(result.value));
        setConversionMeta({ date: result.date || null, source: 'MER' });
        setConversionStatus('success');
      } catch (error) {
        if (!isActive) return;
        setConversionText('');
        setConversionStatus('error');
        setConversionMeta({ date: null, source: null });
      }
    };

    void run();
    return () => {
      isActive = false;
    };
  }, [basis, countryCode, incomeYear, normalizedCurrency, conversionLocked]);

  const handleCurrencyToggle = () => {
    if (currencyLocked) {
      setCurrencyLocked(false);
      return;
    }
    if (countryCode && countryCode !== 'OTHER') {
      const currency = getCountryCurrency(countryCode);
      if (currency) {
        setCurrencyCode(currency);
        setCurrencyLocked(true);
        return;
      }
    }
    setCurrencyLocked(false);
  };

  const handleConversionToggle = () => {
    if (conversionLocked) {
      setConversionLocked(false);
      setConversionStatus('idle');
      setConversionMeta({ date: null, source: null });
      return;
    }
    setConversionLocked(true);
  };

  const handleCheck = () => {
    if (convertedIncomeUsd === null) return;

    setIsCalculating(true);
    setSaveState('idle');
    setSubmittedIncome(null);

    // Simulate calculation delay for effect
    setTimeout(() => {
      setSubmittedIncome(convertedIncomeUsd);
      setIsCalculating(false);
      // Wait for re-render then scroll
      setTimeout(() => {
        resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 100);
    }, 800);

    if (!canCollectData()) {
      setSaveState('skipped');
      return;
    }

    const computedPercentile = percentileFromIncome(convertedIncomeUsd, thresholds);
    const computedTopPercent = topPercentFromIncome(convertedIncomeUsd, thresholds);
    const computedMedianMultiple = highlight.median ? convertedIncomeUsd / highlight.median : null;

    setSaveState('saving');
    submitAppData({
      // App identity
      appId: 'income-rank',

      // Session info
      sessionDuration: Date.now() - startedAtRef.current,
      selectedLanguage: i18n.language,
      clientId: getOrCreateClientId(),
      sessionId: sessionIdRef.current,
      sessionStartedAt: new Date(startedAtRef.current).toISOString(),
      sessionFinishedAt: new Date().toISOString(),
      completed: true,

      // Attribution + client data
      ...attributionRef.current,
      ...getClientData(),

      // App-specific payload
      payload: {
        incomeAnnualUsd: convertedIncomeUsd,
        incomeAnnualLocal: parsedLocalIncome,
        perPersonIncomeAnnualLocal: perPersonLocalIncome,
        householdAdults: parsedAdults,
        householdChildren: parsedChildren,
        equivalenceScale,
        currencyCode: normalizedCurrency || null,
        countryCode: countryCode === 'OTHER' ? null : countryCode,
        incomeYear: parsedIncomeYear,
        conversionFactor: effectiveConversion,
        conversionSource: conversionMeta.source,
        conversionDate: conversionMeta.date,
        basis,
        percentile: computedPercentile,
        topPercent: computedTopPercent,
        medianMultiple: computedMedianMultiple,
        wid: {
          year: WORLD_INCOME_WID.year,
          variable: WORLD_INCOME_WID.variable,
          countryCode: WORLD_INCOME_WID.countryCodeByBasis[basis],
          sourceFile: WORLD_INCOME_WID.sourceFileByBasis[basis],
        },
      },
    })
      .then((ok) => setSaveState(ok ? 'saved' : 'error'));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleCheck();
    }
  };

  const handleShare = async () => {
    // Build share URL with parameters
    const baseUrl = window.location.origin + window.location.pathname;
    const params = new URLSearchParams();
    params.set('app', 'income-rank');
    if (parsedLocalIncome !== null) params.set('householdIncome', String(parsedLocalIncome));
    if (parsedAdults !== null) params.set('adults', String(parsedAdults));
    if (parsedChildren !== null) params.set('children', String(parsedChildren));
    if (countryCode) params.set('country', countryCode);
    if (normalizedCurrency) params.set('currency', normalizedCurrency);
    if (incomeYear) params.set('year', incomeYear);
    params.set('basis', basis);
    const shareUrl = `${baseUrl}?${params.toString()}`;

    const shareData = {
      title: t('Awesome Rank'),
      text: t('My income is in the Top {{score}} worldwide. Check yours:', { score: topLabel }),
      url: shareUrl,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          console.error('Error sharing:', err);
        }
      }
    } else {
      try {
        await navigator.clipboard.writeText(`${shareData.text} ${shareData.url}`);
        setShowCopied(true);
        setTimeout(() => setShowCopied(false), 2000);
      } catch (err) {
        console.error('Failed to copy', err);
      }
    }
  };

  const basisLabel = basis === 'PPP' ? t('PPP (cost of living adjusted)') : t('Market exchange rate (MER)');
  const conversionLabel = basis === 'PPP'
    ? t('PPP conversion factor (local currency per international $)')
    : t('Exchange rate (local currency per USD)');
  const canCalculate = convertedIncomeUsd !== null;
  const isConversionLoading = conversionLocked && conversionStatus === 'loading';
  const basisHelp = basis === 'PPP'
    ? t('PPP adjusts for cost of living and is best for comparing living standards across countries.')
    : t('MER uses market exchange rates. Useful for nominal comparisons but can swing with currency markets.');
  // These are available for future use if needed
  void WORLD_INCOME_WID.countryCodeByBasis[basis];
  void WORLD_INCOME_WID.sourceFileByBasis[basis];

  return (
    <motion.div
      className="income-rank"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.5 }}
    >
      <motion.div
        className="income-rank-card"
        initial={{ y: 24, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.05, type: 'spring', damping: 24, stiffness: 260 }}
      >
        <motion.div
          className="income-rank-header"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12 }}
        >
          <div className="income-rank-kicker">{t('New')}</div>
          <h1 className="income-rank-title">{t('Income Rank')}</h1>
          <p className="income-rank-subtitle">
            {t('Enter your household take-home income to estimate where you stand globally.')}
          </p>
        </motion.div>

        <motion.div
          className="income-rank-form"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.18 }}
        >
          <div className="income-row">
            <label className="income-label" htmlFor="country-select">
              {t('Country or region')}
            </label>
            <div className="income-select-wrap">
              <select
                id="country-select"
                className="income-select"
                value={countryCode}
                onChange={(e) => setCountryCode(e.target.value)}
              >
                {countryOptions.map((country) => (
                  <option key={country.code} value={country.code}>
                    {country.name}
                  </option>
                ))}
                <option value="OTHER">{t('Other / Not listed')}</option>
              </select>
            </div>
            <div className="income-helper-row">
              <span className="income-helper">
                {countryCode === 'OTHER'
                  ? t('If your country is not listed, enter the currency manually.')
                  : currencyLocked
                    ? t('Currency auto-set to {{currency}} based on your country.', { currency: formatCurrencyWithSymbol(normalizedCurrency, i18n.language) || t('Unknown') })
                    : t('Custom currency enabled.')}
              </span>
              {countryCode !== 'OTHER' && (
                <button
                  type="button"
                  className="income-link-btn"
                  onClick={handleCurrencyToggle}
                >
                  {currencyLocked ? t('Edit currency') : t('Use country currency')}
                </button>
              )}
            </div>
          </div>

          <div className="income-row">
            <label className="income-label" htmlFor="income-input">
              {t('Household annual income (after tax)')} <span className="income-hint">{normalizedCurrency ? formatCurrencyWithSymbol(normalizedCurrency, i18n.language) : t('Local currency')}</span>
            </label>
            <div className="income-input-group">
              <div className="income-input-wrap">
                {currencyLocked ? (
                  <span className="income-currency-pill" aria-label={t('Currency code (ISO 4217)')}>
                    {normalizedCurrency ? formatCurrencyWithSymbol(normalizedCurrency, i18n.language) : t('Unknown')}
                  </span>
                ) : (
                  <input
                    className="income-currency"
                    inputMode="text"
                    autoComplete="off"
                    maxLength={3}
                    placeholder={t('USD')}
                    value={currencyCode}
                    onChange={(e) => setCurrencyCode(e.target.value.replace(/[^a-zA-Z]/g, '').toUpperCase().slice(0, 3))}
                    aria-label={t('Currency code (ISO 4217)')}
                  />
                )}
                <span className="income-divider" aria-hidden="true"></span>
                <input
                  id="income-input"
                  className="income-input"
                  inputMode="decimal"
                  autoComplete="off"
                  placeholder={t('Example: 50,000')}
                  value={localIncomeText}
                  onChange={(e) => setLocalIncomeText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  aria-label={t('Household annual income (after tax)')}
                />
              </div>
              <button
                className="income-check-btn"
                onClick={handleCheck}
                disabled={!canCalculate || isCalculating || isConversionLoading}
              >
                {isConversionLoading ? t('Fetching conversion rate...') : isCalculating ? t('Calculating...') : t('Check Rank')}
              </button>
            </div>
            <div className="income-helper">
              {t('Enter your total household take-home income in your local currency, including wages and other income.')}
            </div>
          </div>

          <div className="income-row">
            <div className="income-label">{t('Household members')}</div>
            <div className="income-row-grid">
              <div className="income-field">
                <label className="income-label" htmlFor="household-adults">
                  {t('Adults')}
                </label>
                <div className="income-input-wrap">
                  <input
                    id="household-adults"
                    className="income-input income-input-compact"
                    inputMode="numeric"
                    autoComplete="off"
                    placeholder="1"
                    value={householdAdults}
                    onChange={(e) => setHouseholdAdults(e.target.value.replace(/[^\d]/g, ''))}
                    onKeyDown={handleKeyDown}
                    aria-label={t('Number of adults in household')}
                  />
                </div>
              </div>
              <div className="income-field">
                <label className="income-label" htmlFor="household-children">
                  {t('Children')}
                </label>
                <div className="income-input-wrap">
                  <input
                    id="household-children"
                    className="income-input income-input-compact"
                    inputMode="numeric"
                    autoComplete="off"
                    placeholder="0"
                    value={householdChildren}
                    onChange={(e) => setHouseholdChildren(e.target.value.replace(/[^\d]/g, ''))}
                    onKeyDown={handleKeyDown}
                    aria-label={t('Number of children in household')}
                  />
                </div>
              </div>
            </div>
            <div className="income-helper">
              {t('We adjust household income using the OECD-modified equivalence scale.')}
              <span> {t('Scale = 1 + 0.5 x (additional adults) + 0.3 x (children).')}</span>
              {equivalenceScale !== null && (
                <span> {t('Equivalence scale: {{scale}}', { scale: equivalenceScale.toFixed(2) })}</span>
              )}
            </div>
          </div>

          <div className="income-row income-row-grid">
            <div className="income-field">
              <label className="income-label" htmlFor="income-year-input">
                {t('Income year')}
              </label>
              <div className="income-input-wrap">
                <input
                  id="income-year-input"
                  className="income-input income-input-compact"
                  inputMode="numeric"
                  autoComplete="off"
                  maxLength={4}
                  placeholder={String(WORLD_INCOME_WID.year)}
                  value={incomeYear}
                  onChange={(e) => setIncomeYear(e.target.value.replace(/[^\d]/g, '').slice(0, 4))}
                  onKeyDown={handleKeyDown}
                  aria-label={t('Income year')}
                />
              </div>
              <div className="income-helper">{t('Use the year your income is based on.')}</div>
            </div>
            <div className="income-field">
              <label className="income-label" htmlFor="conversion-input">
                {conversionLabel}
              </label>
              <div className="income-input-wrap">
                <input
                  id="conversion-input"
                  className="income-input income-input-compact"
                  inputMode="decimal"
                  autoComplete="off"
                  placeholder={t('Example: 1,320.5')}
                  value={conversionText}
                  onChange={(e) => setConversionText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={conversionLocked}
                  aria-label={conversionLabel}
                />
              </div>
              <div className="income-helper-row">
                <span className="income-helper">
                  {conversionLocked
                    ? conversionStatus === 'loading'
                      ? t('Fetching conversion rate...')
                      : conversionStatus === 'success'
                        ? t('Auto conversion from {{source}}', {
                            source: conversionMeta.source === 'PPP' ? t('PPP') : t('Market exchange rate (MER)'),
                          })
                        : t('Auto conversion failed. Enter manually.')
                    : t('Manual conversion enabled.')}
                  {conversionLocked && conversionStatus === 'success' && conversionMeta.date
                    ? ` ${t('Updated {{date}}', { date: conversionMeta.date })}`
                    : ''}
                </span>
                <button
                  type="button"
                  className="income-link-btn"
                  onClick={handleConversionToggle}
                >
                  {conversionLocked ? t('Edit conversion') : t('Use auto conversion')}
                </button>
              </div>
              <div className="income-helper">{t('If your income is already in USD, use 1.')}</div>
            </div>
          </div>

          {convertedIncomeUsd !== null && (
            <div className="income-row">
              <div className="income-helper">
                {t('Per-person income (USD)')}:{' '}
                <span className="mono">{usd.format(convertedIncomeUsd)}</span>
              </div>
            </div>
          )}

          <div className="income-row">
            <div className="income-label">{t('Income basis')}</div>
            <div className="basis-toggle" role="tablist" aria-label={t('Income basis')}>
              <button
                type="button"
                className={`basis-chip ${basis === 'PPP' ? 'active' : ''}`}
                onClick={() => setBasis('PPP')}
              >
                <span className="basis-chip-title">{t('PPP')}</span>
                <span className="basis-chip-sub">{t('Cost of living')}</span>
              </button>
              <button
                type="button"
                className={`basis-chip ${basis === 'MER' ? 'active' : ''}`}
                onClick={() => setBasis('MER')}
              >
                <span className="basis-chip-title">{t('Market')}</span>
                <span className="basis-chip-sub">{t('Exchange rate')}</span>
              </button>
            </div>
            <div className="basis-help">{basisHelp}</div>
          </div>
        </motion.div>

        <motion.div
          className="income-rank-result"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.24 }}
          ref={resultRef}
        >
          <AnimatePresence mode="wait">
            {isCalculating ? (
              <motion.div
                key="loading"
                className="result-loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <div className="loading-spinner"></div>
                <div className="loading-text">{t('Analyzing global data...')}</div>
              </motion.div>
            ) : topLabel ? (
              <motion.div
                key="result"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
              >
                {/* Income Class Badge */}
                {incomeClass && (
                  <motion.div
                    className="income-class"
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.1, type: 'spring' }}
                  >
                    <div
                      className="income-class-badge"
                      style={{
                        borderColor: incomeClass.color,
                        color: incomeClass.color,
                        boxShadow: `0 0 20px ${incomeClass.color}30`,
                      }}
                    >
                      {t(incomeClass.labelKey)}
                    </div>
                    <div className="income-class-sub">
                      {t('Richer than')} {incomeClass.minPercentile}–{incomeClass.maxPercentile}%
                    </div>
                  </motion.div>
                )}

                <div className="result-topline">
                  <div className="result-copy">
                    <h2 className="result-title">{t('You are in the top')}</h2>
                    <p className="result-caption">
                      <span className="result-meta">
                        {t('Richer than')} {richerThanLabel}
                      </span>
                      <span className="result-meta-dot">•</span>
                      <span className="result-meta">{basisLabel}</span>
                    </p>
                    {oneInPeople !== null && peopleInGroup !== null && (
                      <p className="result-meaning">
                        {t('That means you are 1 in')}{' '}
                        <span className="mono">{oneInPeople.toLocaleString(i18n.language)}</span>{' '}
                        {t('people.')}{' '}
                        {t('Out of 8 billion people, only')} <span className="mono">{peopleInGroup.toLocaleString(i18n.language)}</span> {t('are in this group.')}
                      </p>
                    )}
                    <p className="result-note">
                      {t('Global ranking uses adult pre-tax income (WID).')}{' '}
                      {t('Your input is after-tax household income per person, so this is an estimate.')}{' '}
                      {basis === 'MER'
                        ? t('MER results can change with exchange rates.')
                        : t('PPP reflects cost of living differences.')}
                    </p>
                  </div>
                  <div className="result-stamp" aria-label={t('Income rank result')}>
                    <div className="stamp-inner">
                      <div className="stamp-top">{t('TOP')}</div>
                      <div className="stamp-value">{topLabel}</div>
                    </div>
                  </div>
                </div>

                {/* Poverty & Consumer Class Status */}
                {povertyStatus && dailyIncome && (
                  <motion.div
                    className="poverty-status"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                  >
                    <div className="poverty-head">
                      <div className="poverty-title">{t('Poverty Status')}</div>
                      {basis !== 'PPP' && (
                        <div className="poverty-note">
                          <span className="poverty-note-text">{t('Poverty lines are PPP-based.')}</span>
                          <button
                            type="button"
                            className="poverty-note-btn"
                            onClick={() => setBasis('PPP')}
                          >
                            {t('Switch to PPP')}
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="income-breakdown">
                      <div className="income-chip">
                        <div className="income-chip-label">{t('per year')}</div>
                        <div className="income-chip-value mono">{submittedIncome !== null ? usd.format(submittedIncome) : '—'}</div>
                      </div>
                      <div className="income-chip">
                        <div className="income-chip-label">{t('per month')}</div>
                        <div className="income-chip-value mono">{monthlyIncome ? usd.format(monthlyIncome) : '—'}</div>
                      </div>
                      <div className="income-chip">
                        <div className="income-chip-label">{t('per day')}</div>
                        <div className="income-chip-value mono">{usdDaily.format(dailyIncome)}</div>
                      </div>
                    </div>

                    <div className="status-indicators">
                      {povertyBenchmarks?.map((b) => (
                        <div
                          key={b.id}
                          className={`status-item ${b.isAbove ? 'above' : 'below'} ${b.highlight ? 'highlight' : ''}`}
                        >
                          <div className="status-left">
                            <span className="status-icon" aria-hidden="true">{b.isAbove ? '✓' : '✗'}</span>
                            <span className="status-text">
                              {t(b.labelKey)}{' '}
                              <span className="status-threshold">
                                ({usdDaily.format(b.dailyUsd)} {t('per day')}{b.id === 'consumer' ? '+' : ''})
                              </span>
                            </span>
                          </div>
                          <div className="status-right">
                            <div className="status-gap mono">{usdDailyDelta.format(b.gapDailyUsd)}</div>
                            <div className="status-gap-sub">{t('per day')}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}

                {/* Income Distribution Chart */}
                {dailyIncome && highlight.median && highlight.top10 && highlight.top1 && (
                  <IncomeChart
                    percentile={topPercent ?? 50}
                    dailyIncome={dailyIncome}
                    medianIncome={highlight.median}
                    top10Threshold={highlight.top10}
                    top1Threshold={highlight.top1}
                  />
                )}

                <div className="result-details">
                  <div className="detail-card">
                    <div className="detail-label">
                      {t('Your income')}
                      <InfoTooltip
                        title={t('Your income')}
                        description={t('info_your_income_desc')}
                        example={t('info_your_income_example')}
                      />
                    </div>
                    <div className="detail-value mono">
                      {submittedIncome ? usd.format(submittedIncome) : '—'}
                    </div>
                    <div className="detail-sub">{t('per year')}</div>
                  </div>

                  <div className="detail-card">
                    <div className="detail-label">
                      {t('Top earners (out of 8 billion)')}
                      <InfoTooltip
                        title={t('Top earners (out of 8 billion)')}
                        description={t('info_top_earners_desc')}
                        example={t('info_top_earners_example')}
                      />
                    </div>
                    <div className="detail-value">
                      {topPeople ? topPeople.toLocaleString(i18n.language) : '—'}
                    </div>
                    <div className="detail-sub">{t('people')}</div>
                  </div>

                  <div className="detail-card">
                    <div className="detail-label">
                      {t('Median (50th)')}
                      <InfoTooltip
                        title={t('Global Median')}
                        description={t('info_median_desc')}
                        example={t('info_median_example')}
                      />
                    </div>
                    <div className="detail-value mono">
                      {highlight.median ? usd.format(highlight.median) : '—'}
                    </div>
                    <div className="detail-sub">{t('Global')}</div>
                  </div>

                  <div className="detail-card">
                    <div className="detail-label">
                      {t('Your income vs median')}
                      <InfoTooltip
                        title={t('Your income vs median')}
                        description={t('info_vs_median_desc')}
                        example={t('info_vs_median_example')}
                      />
                    </div>
                    <div className="detail-value">
                      {medianMultiple ? `${medianMultiple.toLocaleString(i18n.language, { maximumFractionDigits: medianMultiple < 10 ? 2 : 1 })}×` : '—'}
                    </div>
                    <div className="detail-sub">{t('times the median')}</div>
                  </div>

                  <div className="detail-card">
                    <div className="detail-label">
                      {t('Next milestone')}
                      <InfoTooltip
                        title={t('Next milestone')}
                        description={t('info_milestone_desc')}
                      />
                    </div>
                    <div className="detail-value mono">
                      {nextMilestone
                        ? nextMilestone.delta > 0 ? `+${usd.format(nextMilestone.delta)}` : '✓'
                        : '—'}
                    </div>
                    <div className="detail-sub">
                      {nextMilestone
                        ? nextMilestone.delta > 0
                          ? t('to reach {{milestone}}', { milestone: nextMilestone.label })
                          : t('Already {{milestone}}', { milestone: nextMilestone.label })
                        : t('per year')}
                    </div>
                  </div>

                  <div className="detail-card">
                    <div className="detail-label">
                      {t('Top 10% starts at')}
                      <InfoTooltip
                        title={t('Top 10%')}
                        description={t('info_top10_desc')}
                        example={t('info_top10_example')}
                      />
                    </div>
                    <div className="detail-value mono">
                      {highlight.top10 ? usd.format(highlight.top10) : '—'}
                    </div>
                    <div className="detail-sub">{t('per year')}</div>
                  </div>

                  <div className="detail-card">
                    <div className="detail-label">
                      {t('Top 1% starts at')}
                      <InfoTooltip
                        title={t('Top 1%')}
                        description={t('info_top1_desc')}
                        example={t('info_top1_example')}
                      />
                    </div>
                    <div className="detail-value mono">
                      {highlight.top1 ? usd.format(highlight.top1) : '—'}
                    </div>
                    <div className="detail-sub">{t('per year')}</div>
                  </div>

                  <div className="detail-card">
                    <div className="detail-label">
                      {t('Top 0.1% starts at')}
                      <InfoTooltip
                        title={t('Top 0.1%')}
                        description={t('info_top01_desc')}
                        example={t('info_top01_example')}
                      />
                    </div>
                    <div className="detail-value mono">
                      {highlight.top01 ? usd.format(highlight.top01) : '—'}
                    </div>
                    <div className="detail-sub">{t('per year')}</div>
                  </div>
                </div>

                <div className="share-section">
                  <button className="share-btn" onClick={handleShare}>
                    {showCopied ? t('Copied!') : t('Share Rank')}
                  </button>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="empty"
                className="result-empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <div className="empty-led">
                  <span className="empty-dot" />
                  <span className="empty-text">{t('Type an amount to see your rank')}</span>
                </div>
                <p className="empty-note">
                  {t('Results are calculated instantly. If you allow data collection, we save anonymized results to improve global stats.')}
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        <motion.div
          className="income-rank-foot"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.32 }}
        >
          <div className="foot-line">
            <span className="foot-label">{t('Data source')}</span>
            <span className="foot-value">
              <a href="https://wid.world/" target="_blank" rel="noopener noreferrer">
                {t('World Inequality Database (WID.world)')}
              </a>
            </span>
          </div>
          <div className="foot-line">
            <span className="foot-label">{t('Dataset')}</span>
            <span className="foot-value mono">
              {t('Pre-tax national income thresholds')} ({WORLD_INCOME_WID.year})
            </span>
          </div>
          <div className="foot-line">
            <span className="foot-label">{t('Methodology')}</span>
            <span className="foot-value">
              <a href="https://wid.world/methodology/" target="_blank" rel="noopener noreferrer">
                {t('Distributional National Accounts (DINA)')}
              </a>
            </span>
          </div>
        </motion.div>
      </motion.div>
    </motion.div>
  );
}
