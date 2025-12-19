import { useMemo, useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import type { IncomeBasis } from '../data/worldIncomeThresholds';
import { WORLD_INCOME_THRESHOLDS_USD, WORLD_INCOME_WID } from '../data/worldIncomeThresholds';
import { formatTopPercent, percentileFromIncome, topPercentFromIncome } from '../utils/incomeRank';
import './IncomeRank.css';

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

export function IncomeRank() {
  const { t, i18n } = useTranslation();
  const urlParams = getUrlParams();
  const [basis, setBasis] = useState<IncomeBasis>(urlParams.basis ?? 'PPP');
  const [incomeText, setIncomeText] = useState(urlParams.income ? urlParams.income.toString() : '');
  const [submittedIncome, setSubmittedIncome] = useState<number | null>(urlParams.income);
  const [isCalculating, setIsCalculating] = useState(false);
  const [showCopied, setShowCopied] = useState(false);
  const resultRef = useRef<HTMLDivElement>(null);
  const initialLoadRef = useRef(true);

  // Clear URL params after initial load to keep URL clean for manual use
  useEffect(() => {
    if (initialLoadRef.current && urlParams.income) {
      initialLoadRef.current = false;
      // Scroll to result after initial load from shared link
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

  const highlight = useMemo(() => {
    const find = (p: number) => thresholds.find((x) => x.p === p)?.income ?? null;
    return {
      median: find(50),
      top10: find(90),
      top1: find(99),
      top01: find(99.9),
    };
  }, [thresholds]);

  const handleCheck = () => {
    const val = parseIncomeInput(incomeText);
    if (val === null) return;

    setIsCalculating(true);
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
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleCheck();
    }
  };

  const handleShare = async () => {
    // Build share URL with parameters
    const baseUrl = window.location.origin + window.location.pathname;
    const shareUrl = `${baseUrl}?app=income-rank&income=${submittedIncome}&basis=${basis}`;

    const shareData = {
      title: 'Awesome Rank',
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
                  </div>
                  <div className="result-stamp" aria-label={t('Income rank result')}>
                    <div className="stamp-inner">
                      <div className="stamp-top">{t('TOP')}</div>
                      <div className="stamp-value">{topLabel}</div>
                    </div>
                  </div>
                </div>

                <div className="result-details">
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
                  {t('This calculator runs on-device — your income is not uploaded')}
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
            <span className="foot-label">{t('Data')}</span>
            <span className="foot-value">
              {t('WID thresholds (wid.world)')} • {WORLD_INCOME_WID.variable} • {worldCode} • {WORLD_INCOME_WID.year}
            </span>
          </div>
          <div className="foot-line">
            <span className="foot-label">{t('Source')}</span>
            <span className="foot-value mono">{source}</span>
          </div>
        </motion.div>
      </motion.div>
    </motion.div>
  );
}
