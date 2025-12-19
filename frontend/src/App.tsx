import { useRef, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Layout } from './components/Layout';
import { AppSelector } from './components/AppSelector';
import { Landing } from './components/Landing';
import { Demographics } from './components/Demographics';
import type { DemographicsData } from './components/Demographics';
import { Quiz } from './components/Quiz';
import { Result } from './components/Result';
import { IncomeRank } from './components/IncomeRank';
import { ConsentBanner } from './components/ConsentBanner';
import { ConsentProvider } from './contexts/ConsentContext';
import { useConsent } from './contexts/useConsent';
import { AnimatePresence } from 'framer-motion';
import { calculateScore, SCORE_ALGO_VERSION } from './utils/scoreCalculator';
import { QUESTION_IDS, QUESTION_SET_ID } from './data/questions';

const APP_ID = 'world-rank';
const QUIZ_VERSION = 'v1';

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

// Get initial view and shared data from URL parameters
function getUrlState() {
  const params = new URLSearchParams(window.location.search);
  const app = params.get('app');
  const score = params.get('score');
  const income = params.get('income');
  const basis = params.get('basis');

  let view: 'home' | 'landing' | 'demographics' | 'quiz' | 'result' | 'income' = 'home';

  if (app === 'income-rank') {
    view = 'income';
  } else if (app === 'world-rank') {
    // If score is present, show result directly
    if (score) {
      view = 'result';
    } else {
      view = 'landing';
    }
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
  const [view, setView] = useState<'home' | 'landing' | 'demographics' | 'quiz' | 'result' | 'income'>(urlState.view);
  const [answers, setAnswers] = useState<boolean[]>([]);
  const [demographics, setDemographics] = useState<DemographicsData | null>(null);
  const [sharedScore] = useState<number | undefined>(urlState.sharedScore);
  const startTimeRef = useRef<number>(0);
  const attributionRef = useRef(getAttributionData());

  // Track session start
  useEffect(() => {
    startTimeRef.current = Date.now();
  }, []);

  const handleSelectApp = (appId: string) => {
    if (appId === 'world-rank') {
      setView('landing');
    } else if (appId === 'income-rank') {
      setView('income');
    }
  };

  const goHome = () => setView('home');
  const goBack = () => {
    if (view === 'landing') setView('home');
    else if (view === 'income') setView('home');
    else if (view === 'demographics') setView('landing');
    else if (view === 'quiz') setView('demographics');
    else if (view === 'result') setView('home');
  };

  const startQuiz = () => setView('demographics');

  const handleDemographics = (data: DemographicsData) => {
    setDemographics(data);
    setView('quiz');
  };

  const finishQuiz = (finalAnswers: boolean[], times: number[]) => {
    setAnswers(finalAnswers);
    setView('result');

    // Calculate score
    const scoreResult = calculateScore(finalAnswers);

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
    setView('home');
  };

  const showBack = view !== 'home';
  const showHome = view !== 'home' && view !== 'landing' && view !== 'income';

  return (
    <Layout
      showBack={showBack}
      showHome={showHome}
      onBack={goBack}
      onHome={goHome}
    >
      <AnimatePresence mode="wait">
        {view === 'home' && <AppSelector onSelectApp={handleSelectApp} key="home" />}
        {view === 'landing' && <Landing onStart={startQuiz} key="landing" />}
        {view === 'income' && <IncomeRank key="income" />}
        {view === 'demographics' && <Demographics onComplete={handleDemographics} key="demographics" />}
        {view === 'quiz' && <Quiz onFinish={finishQuiz} key="quiz" />}
        {view === 'result' && <Result answers={answers} sharedScore={sharedScore} onRestart={restart} key="result" />}
      </AnimatePresence>
      <ConsentBanner />
    </Layout>
  );
}

function App() {
  return (
    <ConsentProvider>
      <AppContent />
    </ConsentProvider>
  );
}

export default App;
