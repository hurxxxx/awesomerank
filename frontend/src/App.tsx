import { useRef, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { HelmetProvider } from 'react-helmet-async';
import { Layout } from './components/Layout';
import { AppSelector } from './components/AppSelector';
import { Landing } from './components/Landing';
import { Demographics } from './components/Demographics';
import type { DemographicsData } from './components/Demographics';
import { Quiz } from './components/Quiz';
import { Result } from './components/Result';
import { IncomeRank } from './components/IncomeRank';
import { CountrySizeCompare } from './components/CountrySizeCompare';
import { GlobalStats } from './components/GlobalStats/GlobalStats';
import { AdminDashboard } from './components/AdminDashboard';
import { PrivacyPolicy } from './components/PrivacyPolicy';
import { ConsentBanner } from './components/ConsentBanner';
import { ConsentProvider } from './contexts/ConsentContext';
import { useConsent } from './contexts/useConsent';
import { AnimatePresence } from 'framer-motion';
import { calculateScore, SCORE_ALGO_VERSION } from './utils/scoreCalculator';
import { QUESTION_IDS, QUESTION_SET_ID } from './data/questions';
import { trackPageView, MatomoEvents, PageTitles } from './utils/matomo';
import {
  SUPPORTED_LANGUAGE_CODES,
  buildLocalizedPath,
  isSupportedLanguageCode,
  splitLocalizedPath,
} from './utils/localePath';

const APP_ID = 'world-rank';
const QUIZ_VERSION = 'v1';
const SITE_URL = String(import.meta.env.VITE_SITE_URL || 'https://awesomerank.com').replace(/\/+$/, '');
const OG_LOCALE_BY_LANGUAGE: Record<string, string> = {
  en: 'en_US',
  ko: 'ko_KR',
  es: 'es_ES',
  pt: 'pt_BR',
};

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

// Collect client-side data
function getClientData() {
  return {
    // Browser info
    browserLanguage: navigator.language,
    languages: navigator.languages?.join(',') || navigator.language,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,

    // Device info
    deviceType: /Mobile|Android|iPhone|iPad/i.test(navigator.userAgent) ? 'mobile' : 'desktop',
    screenWidth: window.screen.width,
    screenHeight: window.screen.height,
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
    pixelRatio: window.devicePixelRatio,

    // Platform
    platform: navigator.platform,

    // Connection (if available)
    connectionType: (navigator as Navigator & { connection?: { effectiveType?: string } }).connection?.effectiveType || 'unknown',
  };
}

// Submit data to server
async function submitQuizData(data: Record<string, unknown>) {
  try {
    const apiUrl = import.meta.env.PROD ? '/api/submit' : 'http://localhost:3000/api/submit';
    await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  } catch (error) {
    console.error('Failed to submit data:', error);
  }
}

type View =
  | 'home'
  | 'landing'
  | 'demographics'
  | 'quiz'
  | 'result'
  | 'income'
  | 'admin'
  | 'country-compare'
  | 'global-stats'
  | 'privacy';

// Get initial view and shared data from URL parameters
function getUrlState() {
  const params = new URLSearchParams(window.location.search);
  const app = params.get('app');
  const score = params.get('score');
  const income = params.get('income');
  const basis = params.get('basis');

  let view: View = 'home';

  const { path } = splitLocalizedPath(window.location.pathname);
  if (path === '/admin') {
    view = 'admin';
  } else if (path === '/privacy') {
    view = 'privacy';
  } else if (path === '/income-rank') {
    view = 'income';
  } else if (path === '/country-compare') {
    view = 'country-compare';
  } else if (path === '/global-stats') {
    view = 'global-stats';
  } else if (path === '/world-rank') {
    view = score ? 'result' : 'landing';
  } else if (app === 'income-rank') {
    view = 'income';
  } else if (app === 'country-compare') {
    view = 'country-compare';
  } else if (app === 'global-stats') {
    view = 'global-stats';
  } else if (app === 'world-rank') {
    view = score ? 'result' : 'landing';
  }

  return {
    view,
    sharedScore: score ? parseFloat(score) : undefined,
    sharedIncome: income ? parseFloat(income) : undefined,
    sharedBasis: (basis === 'PPP' || basis === 'MER') ? basis : undefined,
  };
}

function AppContent() {
  const { i18n } = useTranslation();
  const { canCollectData } = useConsent();
  const urlState = getUrlState();
  const [view, setView] = useState<View>(urlState.view);
  const [answers, setAnswers] = useState<boolean[]>([]);
  const [demographics, setDemographics] = useState<DemographicsData | null>(null);
  const [sharedScore, setSharedScore] = useState<number | undefined>(urlState.sharedScore);
  const startTimeRef = useRef<number>(0);
  const attributionRef = useRef(getAttributionData());

  const getActiveLanguage = () => {
    const candidate = (i18n.resolvedLanguage || i18n.language || 'en').split('-')[0].toLowerCase();
    return isSupportedLanguageCode(candidate) ? candidate : 'en';
  };

  const withLang = (path: string) => {
    return buildLocalizedPath(path, getActiveLanguage());
  };

  // Track session start
  useEffect(() => {
    startTimeRef.current = Date.now();
  }, []);

  useEffect(() => {
    const { lang, path } = splitLocalizedPath(window.location.pathname);
    const targetLang = lang || getActiveLanguage();
    const localizedPath = buildLocalizedPath(path, targetLang);
    const nextUrl = `${localizedPath}${window.location.search}${window.location.hash}`;
    const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (nextUrl !== currentUrl) {
      window.history.replaceState({}, '', nextUrl);
    }
    if (lang !== targetLang && i18n.language !== targetLang) {
      void i18n.changeLanguage(targetLang);
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = i18n.language || 'en';
  }, [i18n.language]);

  useEffect(() => {
    const upsertLink = (selector: string, attrs: Record<string, string>) => {
      let el = document.head.querySelector(selector) as HTMLLinkElement | null;
      if (!el) {
        el = document.createElement('link');
        document.head.appendChild(el);
      }
      for (const [key, value] of Object.entries(attrs)) {
        el.setAttribute(key, value);
      }
    };

    const upsertMeta = (selector: string, attrs: Record<string, string>) => {
      let el = document.head.querySelector(selector) as HTMLMetaElement | null;
      if (!el) {
        el = document.createElement('meta');
        document.head.appendChild(el);
      }
      for (const [key, value] of Object.entries(attrs)) {
        el.setAttribute(key, value);
      }
    };

    const { lang: pathLang, path: routePath } = splitLocalizedPath(window.location.pathname);
    const effectiveLang = pathLang || getActiveLanguage();
    const ogLang = routePath === '/admin' ? 'en' : effectiveLang;
    const ogLocale = OG_LOCALE_BY_LANGUAGE[ogLang] || OG_LOCALE_BY_LANGUAGE.en;
    const canonicalPath = routePath === '/admin'
      ? '/admin'
      : buildLocalizedPath(routePath, effectiveLang);
    const canonicalUrl = `${SITE_URL}${canonicalPath}`;

    upsertLink('link[rel="canonical"]', {
      rel: 'canonical',
      href: canonicalUrl,
    });
    upsertMeta('meta[property="og:url"]', {
      property: 'og:url',
      content: canonicalUrl,
    });
    upsertMeta('meta[name="twitter:url"]', {
      name: 'twitter:url',
      content: canonicalUrl,
    });
    upsertMeta('meta[property="og:locale"]', {
      property: 'og:locale',
      content: ogLocale,
    });

    const existingOgAlternates = document.head.querySelectorAll('meta[property="og:locale:alternate"]');
    existingOgAlternates.forEach((node) => node.remove());
    for (const code of SUPPORTED_LANGUAGE_CODES) {
      if (code === ogLang) continue;
      const alternate = OG_LOCALE_BY_LANGUAGE[code];
      if (!alternate) continue;
      const tag = document.createElement('meta');
      tag.setAttribute('property', 'og:locale:alternate');
      tag.setAttribute('content', alternate);
      document.head.appendChild(tag);
    }

    const existingAlternates = document.head.querySelectorAll('link[rel="alternate"][hreflang]');
    if (routePath === '/admin') {
      existingAlternates.forEach((node) => node.remove());
      return;
    }

    for (const code of SUPPORTED_LANGUAGE_CODES) {
      const href = `${SITE_URL}${buildLocalizedPath(routePath, code)}`;
      upsertLink(`link[rel="alternate"][hreflang="${code}"]`, {
        rel: 'alternate',
        hreflang: code,
        href,
      });
    }
    upsertLink('link[rel="alternate"][hreflang="x-default"]', {
      rel: 'alternate',
      hreflang: 'x-default',
      href: `${SITE_URL}${buildLocalizedPath(routePath, 'en')}`,
    });
  }, [i18n.language, i18n.resolvedLanguage, view]);

  const navigate = (nextView: View, path?: string) => {
    if (path) {
      window.history.pushState({}, '', path);
    }
    setView(nextView);
    if (nextView !== 'result') {
      setSharedScore(undefined);
    }
    // Track page view
    trackPageView(path || `/${nextView}`, PageTitles[nextView]);
  };

  const handleSelectApp = (appId: string) => {
    MatomoEvents.appSelected(appId);
    if (appId === 'world-rank') {
      navigate('landing', withLang('/world-rank'));
    } else if (appId === 'income-rank') {
      navigate('income', withLang('/income-rank'));
    } else if (appId === 'country-compare') {
      navigate('country-compare', withLang('/country-compare'));
    } else if (appId === 'global-stats') {
      navigate('global-stats', withLang('/global-stats'));
    }
  };

  const goHome = () => navigate('home', withLang('/'));
  const goBack = () => {
    if (view === 'landing') navigate('home', withLang('/'));
    else if (view === 'income') navigate('home', withLang('/'));
    else if (view === 'country-compare') navigate('home', withLang('/'));
    else if (view === 'global-stats') navigate('home', withLang('/'));
    else if (view === 'privacy') navigate('home', withLang('/'));
    else if (view === 'demographics') navigate('landing', withLang('/world-rank'));
    else if (view === 'quiz') navigate('demographics');
    else if (view === 'result') navigate('home', withLang('/'));
  };

  const startQuiz = () => {
    MatomoEvents.quizStarted();
    navigate('demographics');
  };

  const handleDemographics = (data: DemographicsData) => {
    setDemographics(data);
    setView('quiz');
    MatomoEvents.demographicsCompleted();
    trackPageView('/quiz', PageTitles.quiz);
  };

  const finishQuiz = (finalAnswers: boolean[], times: number[]) => {
    setAnswers(finalAnswers);
    setView('result');

    // Calculate score
    const scoreResult = calculateScore(finalAnswers);

    // Track quiz completion
    MatomoEvents.quizCompleted(scoreResult.score);
    trackPageView('/result', PageTitles.result);

    // Submit all collected data
    const sessionDuration = Date.now() - startTimeRef.current;
    const questionIds = QUESTION_IDS;
    const answersByQuestionId = Object.fromEntries(
      questionIds.map((questionId, idx) => [questionId, finalAnswers[idx]])
    );
    const timesByQuestionId = Object.fromEntries(
      questionIds.map((questionId, idx) => [questionId, times[idx]])
    );

    // Only submit data if user has consented
    if (canCollectData()) {
      submitQuizData({
        // App/metadata
        appId: APP_ID,
        quizVersion: QUIZ_VERSION,
        questionSetId: QUESTION_SET_ID,
        scoreAlgoVersion: SCORE_ALGO_VERSION,

        // Demographics
        ...demographics,

        // Quiz results
        questionIds,
        answers: finalAnswers,
        questionTimes: times,
        answersByQuestionId,
        timesByQuestionId,
        totalQuizTime: times.reduce((a, b) => a + b, 0),

        // Score results
        score: scoreResult.score,
        tier: scoreResult.tier,
        yesCount: scoreResult.yesCount,

        // Session info
        sessionDuration,
        selectedLanguage: i18n.language,
        clientId: getOrCreateClientId(),
        sessionId: randomId(),
        sessionStartedAt: startTimeRef.current ? new Date(startTimeRef.current).toISOString() : null,
        sessionFinishedAt: new Date().toISOString(),
        completed: true,

        // Attribution
        ...attributionRef.current,

        // Client data
        ...getClientData(),
      });
    }
  };

  const restart = () => {
    setAnswers([]);
    setDemographics(null);
    startTimeRef.current = Date.now();
    navigate('landing', withLang('/world-rank'));
  };

  const showBack = view !== 'home' && view !== 'admin';
  const showHome = view !== 'home' && view !== 'landing' && view !== 'income' && view !== 'global-stats' && view !== 'admin';

  useEffect(() => {
    const handlePopState = () => {
      const state = getUrlState();
      setView(state.view);
      setSharedScore(state.sharedScore);
      const { lang, path } = splitLocalizedPath(window.location.pathname);
      if (path !== '/admin') {
        const targetLang = lang || 'en';
        if (i18n.language !== targetLang) {
          void i18n.changeLanguage(targetLang);
        }
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [i18n]);

  // Map view to app id
  const currentApp = view === 'landing' || view === 'demographics' || view === 'quiz' || view === 'result'
    ? 'world-rank'
    : view === 'income'
      ? 'income-rank'
      : view === 'country-compare'
        ? 'country-compare'
        : view === 'global-stats'
          ? 'global-stats'
          : undefined;

  // Admin page has its own layout
  if (view === 'admin') {
    return <AdminDashboard />;
  }

  return (
    <Layout
      showBack={showBack}
      showHome={showHome}
      onBack={goBack}
      onHome={goHome}
      currentApp={currentApp}
      onSelectApp={handleSelectApp}
    >
      <AnimatePresence mode="wait">
        {view === 'home' && <AppSelector onSelectApp={handleSelectApp} key="home" />}
        {view === 'landing' && <Landing onStart={startQuiz} key="landing" />}
        {view === 'income' && <IncomeRank key="income" />}
        {view === 'country-compare' && <CountrySizeCompare key="country-compare" />}
        {view === 'global-stats' && <GlobalStats key="global-stats" />}
        {view === 'demographics' && <Demographics onComplete={handleDemographics} key="demographics" />}
        {view === 'quiz' && <Quiz onFinish={finishQuiz} key="quiz" />}
        {view === 'result' && <Result answers={answers} sharedScore={sharedScore} onRestart={restart} key="result" />}
        {view === 'privacy' && <PrivacyPolicy onClose={goHome} />}
      </AnimatePresence>
      <ConsentBanner />
    </Layout>
  );
}

function App() {
  return (
    <HelmetProvider>
      <ConsentProvider>
        <AppContent />
      </ConsentProvider>
    </HelmetProvider>
  );
}

export default App;
