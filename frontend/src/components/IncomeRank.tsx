import { useMemo, useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import type { IncomeBasis } from '../data/worldIncomeThresholds';
import { WORLD_INCOME_THRESHOLDS_USD, WORLD_INCOME_WID } from '../data/worldIncomeThresholds';
import { formatTopPercent, percentileFromIncome, topPercentFromIncome } from '../utils/incomeRank';
import { getIncomeClass, getPovertyStatus, POVERTY_LINES, CONSUMER_CLASS } from '../data/incomeInsights';
import { useConsent } from '../contexts/useConsent';
import './IncomeRank.css';

// World population constant (2024 estimate)
const WORLD_POPULATION = 8_000_000_000;

// Parse URL parameters for shared results
const getUrlParams = (): { income: number | null; basis: IncomeBasis | null } => {
  const params = new URLSearchParams(window.location.search);
  const income = params.get('income');
  const basis = params.get('basis');
  return {
    income: income ? parseFloat(income) : null,
    basis: (basis === 'PPP' || basis === 'MER') ? basis as IncomeBasis : null,
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
  const [basis, setBasis] = useState<IncomeBasis>(urlParams.basis ?? 'PPP');
  const [incomeText, setIncomeText] = useState(urlParams.income ? urlParams.income.toString() : '');
  const [submittedIncome, setSubmittedIncome] = useState<number | null>(urlParams.income);
  const [isCalculating, setIsCalculating] = useState(false);
  const [showCopied, setShowCopied] = useState(false);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'skipped' | 'error'>('idle');
  const resultRef = useRef<HTMLDivElement>(null);
  const initialLoadRef = useRef(true);
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

  const thresholds = WORLD_INCOME_THRESHOLDS_USD[basis];

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

  const handleCheck = () => {
    const val = parseIncomeInput(incomeText);
    if (val === null) return;

    setIsCalculating(true);
    setSaveState('idle');
    setSubmittedIncome(null);

    // Simulate calculation delay for effect
    setTimeout(() => {
      setSubmittedIncome(val);
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

    const computedPercentile = percentileFromIncome(val, thresholds);
    const computedTopPercent = topPercentFromIncome(val, thresholds);
    const computedMedianMultiple = highlight.median ? val / highlight.median : null;

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
        incomeAnnualUsd: val,
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
    if (submittedIncome !== null) params.set('income', String(submittedIncome));
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
  const worldCode = WORLD_INCOME_WID.countryCodeByBasis[basis];
  const source = WORLD_INCOME_WID.sourceFileByBasis[basis];

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
            {t('Enter your annual income to estimate where you stand globally')}
          </p>
        </motion.div>

        <motion.div
          className="income-rank-form"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.18 }}
        >
          <div className="income-row">
            <label className="income-label" htmlFor="income-input">
              {t('Annual income')} <span className="income-hint">{t('USD')}</span>
            </label>
            <div className="income-input-group">
              <div className="income-input-wrap">
                <span className="income-prefix">$</span>
                <input
                  id="income-input"
                  className="income-input"
                  inputMode="decimal"
                  autoComplete="off"
                  placeholder={t('Example: 50,000')}
                  value={incomeText}
                  onChange={(e) => setIncomeText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  aria-label={t('Annual income')}
                />
              </div>
              <button
                className="income-check-btn"
                onClick={handleCheck}
                disabled={!incomeText || isCalculating}
              >
                {isCalculating ? t('Calculating...') : t('Check Rank')}
              </button>
            </div>
          </div>

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
                      {saveState !== 'idle' && (
                        <>
                          <span className="result-meta-dot">•</span>
                          <span className={`result-meta result-save ${saveState}`}>
                            {saveState === 'saving' ? t('Saving…') :
                              saveState === 'saved' ? t('Saved') :
                                saveState === 'skipped' ? t('Not saved') :
                                  t('Save failed')}
                          </span>
                        </>
                      )}
                    </p>
                    {oneInPeople !== null && peopleInGroup !== null && (
                      <p className="result-meaning">
                        {t('That means you are 1 in')}{' '}
                        <span className="mono">{oneInPeople.toLocaleString(i18n.language)}</span>{' '}
                        {t('people.')}{' '}
                        {t('Out of 8 billion people, only')} <span className="mono">{peopleInGroup.toLocaleString(i18n.language)}</span> {t('are in this group.')}
                      </p>
                    )}
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

                <div className="result-details">
                  <div className="detail-card">
                    <div className="detail-label">{t('Your income')}</div>
                    <div className="detail-value mono">
                      {submittedIncome ? usd.format(submittedIncome) : '—'}
                    </div>
                    <div className="detail-sub">{t('per year')}</div>
                  </div>

                  <div className="detail-card">
                    <div className="detail-label">{t('Top earners (out of 8 billion)')}</div>
                    <div className="detail-value">
                      {topPeople ? topPeople.toLocaleString(i18n.language) : '—'}
                    </div>
                    <div className="detail-sub">{t('people')}</div>
                  </div>

                  <div className="detail-card">
                    <div className="detail-label">{t('Median (50th)')}</div>
                    <div className="detail-value mono">
                      {highlight.median ? usd.format(highlight.median) : '—'}
                    </div>
                    <div className="detail-sub">{t('Global')}</div>
                  </div>

                  <div className="detail-card">
                    <div className="detail-label">{t('Your income vs median')}</div>
                    <div className="detail-value">
                      {medianMultiple ? `${medianMultiple.toLocaleString(i18n.language, { maximumFractionDigits: medianMultiple < 10 ? 2 : 1 })}×` : '—'}
                    </div>
                    <div className="detail-sub">{t('times the median')}</div>
                  </div>

                  <div className="detail-card">
                    <div className="detail-label">{t('Next milestone')}</div>
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
                    <div className="detail-label">{t('Top 10% starts at')}</div>
                    <div className="detail-value mono">
                      {highlight.top10 ? usd.format(highlight.top10) : '—'}
                    </div>
                    <div className="detail-sub">{t('per year')}</div>
                  </div>

                  <div className="detail-card">
                    <div className="detail-label">{t('Top 1% starts at')}</div>
                    <div className="detail-value mono">
                      {highlight.top1 ? usd.format(highlight.top1) : '—'}
                    </div>
                    <div className="detail-sub">{t('per year')}</div>
                  </div>

                  <div className="detail-card">
                    <div className="detail-label">{t('Top 0.1% starts at')}</div>
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
