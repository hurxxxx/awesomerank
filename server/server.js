import express from 'express';
import cors from 'cors';
import pg from 'pg';
import { config as loadEnv } from 'dotenv';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync, readFileSync, readdirSync } from 'fs';

const { Pool } = pg;

const __dirname = dirname(fileURLToPath(import.meta.url));
loadEnv({ path: join(__dirname, '.env') });
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files (frontend build)
const FRONTEND_DIST = join(__dirname, '..', 'frontend', 'dist');
const MIGRATIONS_DIR = join(__dirname, 'db', 'migrations');

app.use(express.static(FRONTEND_DIST, { index: false }));

const SITE_URL = process.env.SITE_URL || 'https://awesomerank.com';
const SUPPORTED_LANGUAGES = [
  { code: 'en', label: 'English', ogLocale: 'en_US' },
  { code: 'ko', label: 'Korean', ogLocale: 'ko_KR' },
  { code: 'es', label: 'Spanish', ogLocale: 'es_ES' },
  { code: 'pt', label: 'Portuguese', ogLocale: 'pt_BR' },
];
const DEFAULT_LANGUAGE = 'en';
const SUPPORTED_LANGUAGE_CODES = new Set(SUPPORTED_LANGUAGES.map((lang) => lang.code));
const TRACKING_QUERY_PARAMS = new Set([
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_content',
  'utm_term',
  'gclid',
  'fbclid',
  'msclkid',
  'ttclid',
  'mc_cid',
  'mc_eid',
]);

function buildCanonicalParams(query) {
  const params = new URLSearchParams();
  let removedTracking = false;

  for (const [key, value] of Object.entries(query || {})) {
    if (key === 'app' || key === 'lang') continue;
    if (TRACKING_QUERY_PARAMS.has(key.toLowerCase())) {
      removedTracking = true;
      continue;
    }
    if (typeof value === 'string') params.set(key, value);
  }

  return { params, removedTracking };
}

function normalizePath(pathname) {
  if (pathname.length > 1 && pathname.endsWith('/')) {
    return pathname.slice(0, -1);
  }
  return pathname;
}

function mapAppToPath(appId) {
  if (appId === 'world-rank') return '/world-rank';
  if (appId === 'income-rank') return '/income-rank';
  if (appId === 'country-compare') return '/country-compare';
  if (appId === 'global-stats') return '/global-stats';
  return null;
}

function isSupportedLanguageCode(value) {
  return typeof value === 'string' && SUPPORTED_LANGUAGE_CODES.has(value.toLowerCase());
}

function splitLocalizedPath(pathname) {
  const normalized = normalizePath(pathname.toLowerCase());
  const segments = normalized.split('/').filter(Boolean);
  if (segments.length === 0) {
    return { lang: null, routePath: '/' };
  }
  const [first, ...rest] = segments;
  if (!isSupportedLanguageCode(first)) {
    return { lang: null, routePath: normalized || '/' };
  }
  const routePath = rest.length === 0 ? '/' : `/${rest.join('/')}`;
  return { lang: first, routePath: normalizePath(routePath) };
}

function buildLocalizedPath(routePath, lang) {
  if (routePath === '/admin') return '/admin';
  const normalized = normalizePath(routePath);
  const safeLang = isSupportedLanguageCode(lang) ? lang.toLowerCase() : DEFAULT_LANGUAGE;
  return normalized === '/' ? `/${safeLang}` : `/${safeLang}${normalized}`;
}

function isBypassPath(pathname) {
  if (pathname === '/api' || pathname.startsWith('/api/')) return true;
  if (pathname.startsWith('/assets/')) return true;
  if (pathname === '/favicon.ico' || pathname === '/robots.txt' || pathname === '/sitemap.xml') return true;
  return /\.[a-z0-9]+$/i.test(pathname);
}

function routeFeatureFallback(routeKey) {
  if (routeKey === '/world-rank') {
    return [
      '15-question lifestyle quiz',
      'Instant global percentile estimate',
      'Private on-device scoring',
    ];
  }
  if (routeKey === '/income-rank') {
    return [
      'Global income percentile calculator',
      'PPP and market exchange rate modes',
      'Household-size adjusted comparisons',
    ];
  }
  if (routeKey === '/country-compare') {
    return [
      'Equal-area true size map',
      'Drag-to-compare country overlays',
      'Area rankings and visual comparisons',
    ];
  }
  if (routeKey === '/global-stats') {
    return [
      'Height percentile by country',
      'Age percentile among 8 billion people',
      'Birthday rarity insights',
    ];
  }
  return [
    'True Size Map for country area comparison',
    'Global income percentile calculator',
    'World Rank lifestyle quiz',
    'Global profile insights',
  ];
}

const ROUTE_META = {
  '/': {
    title: 'Awesome Rank — True Size Map, Global Income Rank & World Quiz',
    description: 'Compare true country sizes on an equal-area map, calculate your global income percentile, and discover where you rank among 8 billion people.',
    heading: 'Awesome Rank — Where Do You Stand Among 8 Billion People?',
    subheading: 'Interactive data tools that reveal your place in the world through geography, income, lifestyle, and demographics.',
    keywords: 'awesome rank, true size map, true size of countries, how rich am I, income percentile calculator, global ranking, world rank quiz, country size comparison, global income percentile, living standard calculator',
    highlights: [
      'True Size Map — drag countries on an equal-area projection to compare real sizes',
      'Global Income Calculator — find your percentile using PPP or market exchange rates',
      'World Rank Quiz — 15 lifestyle questions that estimate your global standing',
      'Global Profile — compare your height, age, and birthday worldwide',
    ],
    bodyParagraphs: [
      'Awesome Rank is a suite of free, privacy-first data tools that let you explore how you compare to the rest of the world. Every calculation runs entirely in your browser — no personal data is ever sent to a server.',
      'Explore the True Size Map to see how Mercator projection distorts country sizes, use the income calculator powered by the World Inequality Database 2024, take the lifestyle quiz to discover your global percentile, or check how your height and age stack up worldwide.',
    ],
    faqs: [
      { q: 'What is Awesome Rank?', a: 'Awesome Rank is a collection of free interactive tools that show where you stand among 8 billion people — through income ranking, lifestyle quizzes, true-size country maps, and global demographic comparisons.' },
      { q: 'Is my personal data safe?', a: 'Yes. All calculations happen entirely in your browser. Your income, quiz answers, and personal stats are never transmitted to any server. The app ships with all data embedded.' },
      { q: 'What data sources does Awesome Rank use?', a: 'Income data comes from the World Inequality Database (WID.world) 2024 edition. Country boundaries and areas use Natural Earth and CIA World Factbook data. Height and demographic statistics are sourced from the UN Population Division and NCD-RisC.' },
    ],
    schemaType: 'WebApplication',
  },
  '/world-rank': {
    title: 'World Rank Quiz — Where Do You Stand Among 8 Billion? | Awesome Rank',
    description: 'Answer 15 lifestyle questions to estimate your global percentile. Compare your living standard across infrastructure, connectivity, and assets worldwide.',
    heading: 'World Rank Quiz — Estimate Your Global Lifestyle Percentile',
    subheading: 'A 15-question quiz that measures your everyday living standards against the rest of the world.',
    keywords: 'world rank quiz, global lifestyle ranking, living standard test, where do I rank, global percentile quiz, lifestyle comparison, world percentile, standard of living quiz, global ranking test',
    highlights: [
      '15 questions across infrastructure, connectivity, and assets',
      'Bayesian probability scoring with real-world data',
      'Instant global percentile and tier badge',
      'Shareable results via URL',
      'Private — calculated entirely on your device',
    ],
    bodyParagraphs: [
      'The World Rank Quiz asks 15 carefully weighted questions about your everyday life — from electricity and clean water access to smartphone ownership and housing type. Each answer is scored using Bayesian probability based on real global statistics.',
      'Your final result places you on a global percentile scale and assigns a tier badge from "Baseline" to "Visionary Elite." The entire calculation happens in your browser — your answers never leave your device.',
    ],
    faqs: [
      { q: 'How is my world rank calculated?', a: 'Each of the 15 questions is weighted by its real-world global probability. For example, 89% of humans have electricity access, but only 40% own a washing machine. Your answers are combined using Bayesian scoring to estimate a global percentile.' },
      { q: 'What does the quiz measure?', a: 'The quiz measures three dimensions of everyday living standards: Infrastructure (electricity, sanitation, clean water), Connectivity (internet, smartphone, broadband), and Assets (refrigerator, washing machine, housing type).' },
      { q: 'Is the result accurate?', a: 'The result is a modeled estimate based on global statistics, not an exact measurement. It provides a meaningful approximation of where your lifestyle falls on the global spectrum.' },
    ],
    schemaType: 'WebApplication',
  },
  '/income-rank': {
    title: 'How Rich Am I? — Global Income Percentile Calculator | Awesome Rank',
    description: 'Enter your income and see where you stand among 8 billion people. Based on World Inequality Database 2024 with PPP and market exchange rate comparisons.',
    heading: 'How Rich Am I? — Global Income Percentile Calculator',
    subheading: 'Find out where your income falls in the worldwide distribution using the latest World Inequality Database.',
    keywords: 'how rich am I, global income percentile, income percentile calculator, income comparison worldwide, salary rank global, world income distribution, PPP calculator, living standard rank, global wealth comparison, income percentile by country',
    highlights: [
      'Based on World Inequality Database (WID.world) 2024',
      'Two modes: PPP-adjusted and market exchange rates',
      'Household size correction for adults and children',
      'Global percentile, top-X%, and income class',
      'Every currency supported with automatic conversion',
    ],
    bodyParagraphs: [
      'Enter your annual household income to discover exactly where you fall in the global income distribution. The calculator uses the World Inequality Database 2024 edition — the gold standard for international income comparisons.',
      'Choose between PPP (Purchasing Power Parity), which adjusts for local cost of living, or MER (Market Exchange Rates) for raw dollar comparisons. Adjust for household size to get a more accurate per-capita figure. Results show your global percentile, how many people earn more or less, and which income class you belong to.',
    ],
    faqs: [
      { q: 'How rich am I compared to the rest of the world?', a: 'Enter your annual income in any currency, and the calculator converts it to international dollars using the latest exchange rates. It then compares your income against the global distribution from the World Inequality Database to show your exact percentile.' },
      { q: 'What is the difference between PPP and market exchange rates?', a: 'PPP (Purchasing Power Parity) adjusts for the cost of living in each country — $1 buys more in India than in Switzerland. Market Exchange Rates (MER) use raw currency conversion without adjustment. PPP is better for comparing living standards; MER is better for comparing absolute purchasing power internationally.' },
      { q: 'What is the global median income?', a: 'According to WID.world 2024 data, the global median income is approximately $3,920 per year in PPP terms. This means half the world earns less than about $10.70 per day.' },
      { q: 'Is my income data sent to a server?', a: 'No. The entire calculation runs in your browser using pre-loaded distribution data. Your income figure is never transmitted anywhere.' },
    ],
    schemaType: 'WebApplication',
  },
  '/country-compare': {
    title: 'True Size Map — Compare Real Country Sizes | Awesome Rank',
    description: 'Drag countries on an equal-area map to compare their real sizes. The Mercator projection distorts — see how big Africa, Russia, and Greenland truly are.',
    heading: 'True Size Map — See How Big Countries Really Are',
    subheading: 'An interactive equal-area map that reveals true country sizes without Mercator distortion.',
    keywords: 'true size map, true size of countries, real size of countries, country size comparison, mercator projection distortion, how big is africa, compare country sizes, equal area map, true size atlas, country area comparison, drag countries on map',
    highlights: [
      'Equal Earth projection — no size distortion anywhere on the map',
      'Compare up to 10 countries, continents, or states simultaneously',
      'Drag entities across the map to overlay and compare directly',
      'Switch between 110m overview and 10m high-detail coastlines',
      'Area ranking table with CIA World Factbook data',
      'Proportional area blocks for instant visual comparison',
    ],
    bodyParagraphs: [
      'Most world maps use the Mercator projection, created in 1569 for maritime navigation. While great for plotting ship courses, Mercator dramatically inflates areas near the poles: Greenland appears the size of Africa, even though Africa is 14 times larger. Russia looks bigger than the entire continent of Africa, when in reality Africa is larger.',
      'True Size Map uses the Equal Earth projection, which preserves area accuracy across the entire map. Select any combination of countries, continents, subregions, or individual states and provinces — up to 10 at once — and drag them across the map to compare directly. Each entity is drawn at its true proportional area, so what you see is what you get.',
      'Search in any language, zoom from 0.6x to 40x, switch between quick 110m and detailed 10m resolution, and view a live area ranking table with official statistics from the CIA World Factbook.',
    ],
    faqs: [
      { q: 'Why do countries look different sizes on a regular map?', a: 'Most world maps use the Mercator projection, which preserves angles for navigation but dramatically distorts sizes. Areas near the poles are stretched to appear much larger than they really are. For example, Greenland looks as big as Africa on Mercator maps, but Africa is actually 14 times larger (30.4 million km² vs 2.2 million km²).' },
      { q: 'How big is Africa really?', a: 'Africa is 30.37 million km² — larger than the United States, China, India, and most of Europe combined. On a Mercator map, Africa appears roughly the same size as Greenland, but in reality Africa is about 14 times larger.' },
      { q: 'Can I compare states and provinces, not just countries?', a: 'Yes. Use the tag filters in the search bar to switch between countries, continents, subregions, and states/provinces. You can compare Texas to France, or California to Japan — any combination of up to 10 entities at once.' },
      { q: 'What is the Equal Earth projection?', a: 'Equal Earth is a map projection created in 2018 that shows all areas at their correct relative sizes while still looking visually pleasing. Unlike Mercator, every square kilometer on the map represents the same amount of real-world area, making it ideal for comparing country sizes.' },
    ],
    schemaType: 'WebApplication',
  },
  '/global-stats': {
    title: 'Global Profile — Compare Your Height, Age & Birthday Worldwide | Awesome Rank',
    description: 'See how your height, age, and birthday compare with 8 billion people. Get your global percentile for each stat.',
    heading: 'Global Profile — Your Height, Age & Birthday vs. the World',
    subheading: 'Enter your stats and discover your percentile among 8 billion people.',
    keywords: 'height percentile by country, age percentile world, birthday rarity, global demographics, how tall am I compared to the world, average height by country, global age distribution, birthday popularity, height comparison global',
    highlights: [
      'Height percentile by gender and country',
      'Age percentile among 8 billion people',
      'Birthday rarity — how common or rare your birth date is',
      'Statistical distribution data from UN and NCD-RisC',
    ],
    bodyParagraphs: [
      'Global Profile lets you compare your physical and demographic stats against the entire world population. Enter your height to see your percentile by gender and country, check how your age compares to the global distribution, and discover how rare or common your birthday is.',
      'All data is sourced from the UN Population Division and NCD-RisC research databases. Calculations are instant and run entirely in your browser.',
    ],
    faqs: [
      { q: 'How is my height percentile calculated?', a: 'Your height is compared against statistical distribution data for your gender and country, sourced from NCD-RisC. The calculator uses a normal distribution model with country-specific mean heights and standard deviations to determine your exact percentile.' },
      { q: 'What data sources are used for global statistics?', a: 'Height data comes from NCD-RisC (Non-Communicable Diseases Risk Factor Collaboration). Age and population data comes from the UN Population Division. Birthday frequency data is compiled from multiple national statistical agencies.' },
    ],
    schemaType: 'WebApplication',
  },
  '/privacy': {
    title: 'Privacy Policy — Awesome Rank',
    description: 'Learn how Awesome Rank collects, uses, and protects your data. All calculations run in your browser.',
    heading: 'Privacy Policy',
    subheading: 'Our commitment to transparency, privacy, and data protection.',
    keywords: 'privacy policy, data protection, awesome rank, data usage, consent, browser-only calculation',
    highlights: [
      'All calculations run in your browser',
      'No personal data transmitted to servers',
      'Optional analytics with explicit consent only',
    ],
    schemaType: 'WebPage',
  },
  '/admin': {
    title: 'Admin Dashboard — Awesome Rank',
    description: 'Internal dashboard for Awesome Rank.',
    heading: 'Admin Dashboard',
    subheading: 'Authorized access only.',
    keywords: 'admin dashboard, awesome rank, internal analytics',
    highlights: [
      'Restricted access',
      'Internal analytics',
      'Operational dashboard',
    ],
    schemaType: 'WebPage',
    robots: 'noindex, nofollow',
  },
};

const LOCALIZED_META_OVERRIDES = {
  ko: {
    '/': {
      title: 'Awesome Rank — 트루 사이즈 맵, 글로벌 소득 순위, 월드 퀴즈',
      description: '국가의 실제 면적을 비교하고, 글로벌 소득 백분위를 계산하고, 80억 인구 중 나의 위치를 확인해보세요.',
      heading: 'Awesome Rank — 80억 인구 중 당신의 위치는?',
      subheading: '지리, 소득, 생활수준, 인구통계 데이터를 통해 세계 속 나의 위치를 보여주는 인터랙티브 도구.',
      keywords: 'awesome rank, 트루 사이즈 맵, 국가 실제 크기, 세계 소득 백분위, 월드 랭크 퀴즈, 글로벌 순위, 생활수준 비교, 세계 통계',
      highlights: [
        '트루 사이즈 맵으로 국가의 실제 면적 비교',
        'PPP/MER 기반 글로벌 소득 백분위 계산',
        '15문항 월드 랭크 퀴즈',
        '키·나이·생일 글로벌 프로필 분석',
      ],
      bodyParagraphs: [
        'Awesome Rank는 전 세계와 나를 비교할 수 있는 무료 데이터 도구 모음입니다. 계산은 모두 브라우저에서 수행되며 개인정보를 서버로 전송하지 않습니다.',
        '메르카토르 왜곡 없이 국가 면적을 비교하고, 세계 소득 분포에서 자신의 위치를 확인하며, 생활수준 퀴즈와 글로벌 통계 프로필을 통해 데이터 기반 인사이트를 얻을 수 있습니다.',
      ],
      faqs: [
        { q: 'Awesome Rank는 어떤 서비스인가요?', a: '국가 면적 비교, 소득 백분위 계산, 생활수준 퀴즈, 글로벌 통계 비교를 제공하는 인터랙티브 데이터 서비스입니다.' },
        { q: '개인정보는 안전한가요?', a: '네. 입력한 소득이나 응답 데이터는 브라우저 내부에서 계산되며 서버로 전송되지 않습니다.' },
        { q: '데이터 출처는 무엇인가요?', a: 'WID.world, Natural Earth, CIA World Factbook, UN Population Division, NCD-RisC 등 공신력 있는 공개 데이터를 사용합니다.' },
      ],
    },
    '/world-rank': {
      title: '월드 랭크 퀴즈 — 80억 인구 중 나는 어디쯤? | Awesome Rank',
      description: '15개 생활수준 질문으로 전 세계 백분위를 추정해보세요. 인프라, 연결성, 자산 수준을 기준으로 비교합니다.',
      heading: '월드 랭크 퀴즈 — 전 세계 생활수준 백분위 추정',
      subheading: '15개 질문으로 일상 생활수준을 전 세계 분포와 비교합니다.',
      keywords: '월드 랭크 퀴즈, 세계 생활수준 테스트, 글로벌 백분위, 나는 세계에서 몇 퍼센트, 생활수준 비교, 글로벌 랭킹',
      highlights: [
        '인프라·연결성·자산 3개 영역 15문항',
        '실측 통계 기반 베이지안 점수 모델',
        '즉시 글로벌 백분위와 티어 결과 제공',
        '결과 공유 링크 생성',
      ],
      bodyParagraphs: [
        '월드 랭크 퀴즈는 전기, 위생, 인터넷, 가전 보유 등 일상 생활 환경을 묻는 15개 질문으로 구성됩니다.',
        '응답은 전 세계 분포 통계에 기반해 계산되며, 결과는 글로벌 백분위와 함께 이해하기 쉬운 티어로 표시됩니다.',
      ],
      faqs: [
        { q: '점수는 어떻게 계산되나요?', a: '각 질문은 전 세계 보급률/분포를 반영해 가중치가 부여되며, 답변 조합을 확률적으로 추정해 백분위를 계산합니다.' },
        { q: '결과는 정확한가요?', a: '절대적인 개인 진단이 아니라 글로벌 통계에 기반한 추정치이며, 비교 지표로 활용하기 적합합니다.' },
        { q: '응답 데이터는 어디로 전송되나요?', a: '결과 계산 자체는 브라우저에서 이루어지며, 동의 없는 개인정보 전송은 없습니다.' },
      ],
    },
    '/income-rank': {
      title: '나는 세계에서 얼마나 부자인가? — 글로벌 소득 백분위 계산기 | Awesome Rank',
      description: '소득을 입력하고 80억 인구 중 위치를 확인하세요. WID.world 2024 데이터 기반, PPP/MER 비교 지원.',
      heading: '나는 세계에서 얼마나 부자인가? — 글로벌 소득 백분위 계산기',
      subheading: '최신 World Inequality Database 기반으로 전 세계 소득 분포에서의 위치를 확인하세요.',
      keywords: '나는 얼마나 부자인가, 글로벌 소득 백분위, 소득 백분위 계산기, 세계 소득 비교, PPP 계산기, 생활수준 순위',
      highlights: [
        'WID.world 2024 기반 글로벌 분포',
        'PPP(구매력) / MER(환율) 모드 지원',
        '가구원 수 보정 계산',
        '백분위·상위 n%·소득군 분류 제공',
      ],
      bodyParagraphs: [
        '연간 소득과 가구 구성을 입력하면 전 세계 소득 분포에서 자신의 위치를 백분위로 확인할 수 있습니다.',
        'PPP 모드는 국가별 물가 수준을 보정해 생활수준 비교에 적합하고, MER 모드는 시장 환율 기준의 명목 비교에 적합합니다.',
      ],
      faqs: [
        { q: 'PPP와 MER의 차이는 무엇인가요?', a: 'PPP는 국가별 물가를 반영해 실질 구매력을 비교하고, MER는 시장 환율 기준으로 명목 금액을 비교합니다.' },
        { q: '입력한 소득 정보는 저장되나요?', a: '계산은 브라우저에서 실행되며, 동의 없는 개인 식별 정보 전송은 없습니다.' },
        { q: '어떤 데이터를 기반으로 하나요?', a: '세계 소득 분포는 WID.world 2024 자료를 기반으로 계산됩니다.' },
      ],
    },
    '/country-compare': {
      title: '트루 사이즈 맵 — 국가 실제 면적 비교 | Awesome Rank',
      description: '등적 지도에서 국가를 드래그해 실제 면적을 비교하세요. 메르카토르 왜곡 없이 진짜 크기를 확인할 수 있습니다.',
      heading: '트루 사이즈 맵 — 국가의 실제 크기를 확인하세요',
      subheading: '메르카토르 왜곡이 없는 등적 지도 기반 인터랙티브 국가 면적 비교.',
      keywords: '트루 사이즈 맵, 국가 실제 크기, 국가 면적 비교, 메르카토르 왜곡, 아프리카 실제 크기, 등적 지도',
      highlights: [
        'Equal Earth 기반 왜곡 최소화',
        '국가·대륙·주/도 단위 비교 지원',
        '드래그 오버레이로 직관적 면적 비교',
        '면적 순위 테이블 실시간 제공',
      ],
      bodyParagraphs: [
        '일반적인 메르카토르 지도는 고위도 지역 면적을 과장해 실제 크기 감각을 왜곡합니다.',
        '트루 사이즈 맵은 등적 투영을 사용해 어느 위치에서도 면적 비율이 유지되도록 설계되어 정확한 비교가 가능합니다.',
      ],
      faqs: [
        { q: '왜 일반 지도와 크기가 다르게 보이나요?', a: '메르카토르 투영은 항해용 각도 보존을 우선해 면적이 왜곡됩니다. 등적 지도에서는 실제 면적 비율이 유지됩니다.' },
        { q: '아프리카는 실제로 얼마나 큰가요?', a: '아프리카는 약 3,037만 km²로 매우 넓으며, 메르카토르 지도에서 과소평가되는 대표적인 사례입니다.' },
        { q: '국가 외 행정구역도 비교할 수 있나요?', a: '네. 주/도 단위 등 다양한 엔티티를 함께 선택해 비교할 수 있습니다.' },
      ],
    },
    '/global-stats': {
      title: '글로벌 프로필 — 키·나이·생일 세계 비교 | Awesome Rank',
      description: '내 키, 나이, 생일이 세계 80억 인구에서 어느 위치인지 백분위로 확인하세요.',
      heading: '글로벌 프로필 — 내 키·나이·생일, 세계와 비교',
      subheading: '개인 통계를 입력하고 전 세계 인구 분포 내 백분위를 확인하세요.',
      keywords: '키 백분위, 나이 백분위, 생일 희소성, 글로벌 인구 통계, 세계와 키 비교, 세계 통계 비교',
      highlights: [
        '국가/성별 기준 키 백분위',
        '전 세계 인구 대비 나이 백분위',
        '생일 희소성 및 빈도 비교',
        'UN/NCD-RisC 데이터 기반 분석',
      ],
      bodyParagraphs: [
        '글로벌 프로필은 키, 나이, 생일을 기준으로 전 세계 분포 내 위치를 직관적으로 보여줍니다.',
        '국가와 성별을 반영한 통계 모델을 사용해 개인 수치를 백분위로 환산하고 비교 해석을 제공합니다.',
      ],
      faqs: [
        { q: '키 백분위는 어떻게 계산되나요?', a: '국가·성별별 평균과 분산을 반영한 분포 모델을 통해 해당 키의 상대 위치를 계산합니다.' },
        { q: '나이 비교는 어떤 기준을 쓰나요?', a: 'UN 인구 분포 데이터를 기반으로 전 세계 인구 중 더 어리거나 많은 인구 비율을 계산합니다.' },
        { q: '생일 희소성은 무엇을 의미하나요?', a: '특정 월/일의 출생 빈도를 바탕으로 얼마나 흔하거나 드문 날짜인지 상대적으로 보여줍니다.' },
      ],
    },
    '/privacy': {
      title: '개인정보처리방침 — Awesome Rank',
      description: 'Awesome Rank의 데이터 수집·이용·보호 정책을 확인하세요. 모든 계산은 브라우저에서 실행됩니다.',
      heading: '개인정보처리방침',
      subheading: '투명성, 개인정보 보호, 데이터 보안에 대한 약속.',
      keywords: '개인정보처리방침, 데이터 보호, 브라우저 내 계산, awesome rank 개인정보',
      highlights: [
        '브라우저 내 계산 원칙',
        '개인 데이터 서버 전송 최소화',
        '명시적 동의 기반 데이터 수집',
      ],
      bodyParagraphs: [
        'Awesome Rank는 개인정보 보호를 우선하며, 가능한 모든 계산을 클라이언트 환경에서 수행합니다.',
        '수집이 필요한 항목은 목적과 보관 범위를 명확히 안내하고, 사용자 동의 정책을 준수합니다.',
      ],
      faqs: [
        { q: '어떤 데이터가 수집되나요?', a: '서비스 개선을 위한 비식별 통계 정보가 중심이며, 민감한 개인 식별정보 수집은 최소화합니다.' },
        { q: '데이터 수집을 거부할 수 있나요?', a: '네. 동의 배너 및 설정을 통해 비필수 데이터 수집을 거부할 수 있습니다.' },
      ],
    },
  },
  es: {
    '/': {
      title: 'Awesome Rank — Mapa de tamaño real, ranking global de ingresos y quiz mundial',
      description: 'Compara el tamaño real de los países, calcula tu percentil global de ingresos y descubre tu posición entre 8 mil millones de personas.',
      heading: 'Awesome Rank — ¿Dónde te ubicas entre 8 mil millones de personas?',
      subheading: 'Herramientas interactivas para entender tu posición global en geografía, ingresos, estilo de vida y demografía.',
      keywords: 'awesome rank, mapa de tamaño real, percentil global de ingresos, quiz mundial, ranking global, comparación de nivel de vida',
      highlights: [
        'Mapa de tamaño real con proyección de área equivalente',
        'Calculadora de percentil de ingresos globales (PPP/MER)',
        'Quiz World Rank de 15 preguntas',
        'Perfil global de altura, edad y cumpleaños',
      ],
      bodyParagraphs: [
        'Awesome Rank reúne herramientas gratuitas para comparar tu situación con la población mundial sin sacrificar privacidad.',
        'Puedes analizar tamaño real de países, calcular tu posición en la distribución global de ingresos y explorar estadísticas demográficas globales.',
      ],
      faqs: [
        { q: '¿Qué es Awesome Rank?', a: 'Es una plataforma interactiva para comparar estilo de vida, ingresos y métricas demográficas a escala global.' },
        { q: '¿Se envían mis datos personales al servidor?', a: 'Los cálculos principales se realizan en tu navegador y la recolección de datos personales se minimiza.' },
        { q: '¿Qué fuentes de datos utiliza?', a: 'Se apoya en fuentes públicas como WID.world, Natural Earth, CIA World Factbook, UN y NCD-RisC.' },
      ],
    },
    '/world-rank': {
      title: 'Quiz World Rank — ¿Dónde te ubicas entre 8 mil millones? | Awesome Rank',
      description: 'Responde 15 preguntas para estimar tu percentil global de estilo de vida.',
      heading: 'Quiz World Rank — Estima tu percentil global',
      subheading: 'Un cuestionario de 15 preguntas para comparar tu nivel de vida con el mundo.',
      keywords: 'quiz world rank, percentil global, ranking de estilo de vida, test de nivel de vida, ranking mundial',
      highlights: [
        '15 preguntas sobre infraestructura, conectividad y activos',
        'Modelo probabilístico basado en estadísticas globales',
        'Resultado inmediato con percentil y nivel',
        'URL compartible de resultados',
      ],
      bodyParagraphs: [
        'El quiz evalúa condiciones cotidianas como acceso a servicios básicos, conectividad y bienes del hogar.',
        'Con tus respuestas, el sistema estima tu posición relativa dentro de la distribución mundial de nivel de vida.',
      ],
      faqs: [
        { q: '¿Cómo se calcula el resultado?', a: 'Cada respuesta aporta evidencia con pesos basados en frecuencias globales observadas.' },
        { q: '¿Es un resultado exacto?', a: 'Es una estimación estadística útil para comparación global, no una medición absoluta individual.' },
        { q: '¿Puedo compartir el resultado?', a: 'Sí, puedes generar un enlace con tu resultado para compartirlo fácilmente.' },
      ],
    },
    '/income-rank': {
      title: '¿Qué tan rico soy? — Calculadora de percentil global de ingresos | Awesome Rank',
      description: 'Ingresa tus ingresos y mira tu posición global con datos WID.world 2024. Compara en PPP y tipo de cambio de mercado.',
      heading: '¿Qué tan rico soy? — Calculadora de percentil global de ingresos',
      subheading: 'Descubre dónde caen tus ingresos dentro de la distribución mundial.',
      keywords: 'qué tan rico soy, calculadora de percentil de ingresos, ingresos globales, comparación salarial mundial, PPP',
      highlights: [
        'Distribución global basada en WID.world 2024',
        'Modo PPP y tipo de cambio de mercado',
        'Ajuste por tamaño del hogar',
        'Percentil global y clasificación por nivel de ingresos',
      ],
      bodyParagraphs: [
        'Introduce tus ingresos anuales para estimar tu posición en la distribución mundial de ingresos.',
        'Puedes alternar entre PPP para comparar poder adquisitivo y MER para comparaciones nominales en dólares.',
      ],
      faqs: [
        { q: '¿Qué diferencia hay entre PPP y MER?', a: 'PPP ajusta por costo de vida; MER usa conversión de mercado sin ajuste de precios locales.' },
        { q: '¿Se guarda mi ingreso?', a: 'La lógica principal de cálculo corre en el navegador y no requiere enviar tu ingreso personal para funcionar.' },
        { q: '¿De dónde salen los datos?', a: 'La distribución mundial se basa en el World Inequality Database 2024.' },
      ],
    },
    '/country-compare': {
      title: 'Mapa de tamaño real — Compara tamaños reales de países | Awesome Rank',
      description: 'Arrastra países en un mapa de área equivalente para comparar su tamaño real sin distorsión de Mercator.',
      heading: 'Mapa de tamaño real — El tamaño real de los países',
      subheading: 'Comparación interactiva de áreas reales con proyección de área equivalente.',
      keywords: 'mapa de tamaño real, tamaño real de países, comparación de áreas, distorsión de Mercator, mapa equivalente',
      highlights: [
        'Proyección Equal Earth para preservar áreas',
        'Comparación directa arrastrando entidades en el mapa',
        'Comparación de países, continentes y subregiones',
        'Tabla de ranking por superficie',
      ],
      bodyParagraphs: [
        'Muchos mapas tradicionales exageran áreas en latitudes altas. Esta herramienta corrige esa distorsión.',
        'Arrastra y superpone países para comparar su tamaño real con una referencia visual precisa.',
      ],
      faqs: [
        { q: '¿Por qué Mercator distorsiona tamaños?', a: 'Mantiene ángulos para navegación, pero amplifica áreas cerca de los polos.' },
        { q: '¿Puedo comparar regiones además de países?', a: 'Sí, puedes incluir distintas entidades geográficas según los filtros disponibles.' },
        { q: '¿Qué proyección se utiliza?', a: 'Se utiliza una proyección de área equivalente para mantener proporciones reales de superficie.' },
      ],
    },
    '/global-stats': {
      title: 'Perfil global — Compara tu altura, edad y cumpleaños | Awesome Rank',
      description: 'Compara tu altura, edad y fecha de nacimiento con la población mundial.',
      heading: 'Perfil global — Tu altura, edad y cumpleaños vs. el mundo',
      subheading: 'Introduce tus datos y obtén tu percentil global.',
      keywords: 'percentil de altura, percentil de edad, rareza de cumpleaños, estadísticas globales, comparación mundial',
      highlights: [
        'Percentil de altura por país y género',
        'Percentil de edad en la población mundial',
        'Rareza de cumpleaños por fecha',
        'Modelos estadísticos con datos globales',
      ],
      bodyParagraphs: [
        'Compara tus datos físicos y demográficos con distribuciones poblacionales globales.',
        'El resultado incluye percentiles e interpretaciones para entender tu posición relativa.',
      ],
      faqs: [
        { q: '¿Cómo se calcula el percentil de altura?', a: 'Se utiliza un modelo de distribución con parámetros por país y género.' },
        { q: '¿Qué significa el percentil de edad?', a: 'Indica qué proporción de la población mundial es más joven o mayor que tú.' },
        { q: '¿Cómo se estima la rareza de cumpleaños?', a: 'Se compara la frecuencia relativa de nacimientos por fecha en conjuntos estadísticos.' },
      ],
    },
    '/privacy': {
      title: 'Política de privacidad — Awesome Rank',
      description: 'Consulta cómo Awesome Rank recopila, usa y protege tus datos. Todos los cálculos se realizan en tu navegador.',
      heading: 'Política de privacidad',
      subheading: 'Nuestro compromiso con la transparencia y la protección de datos.',
      keywords: 'política de privacidad, protección de datos, cálculos en navegador, awesome rank privacidad',
      highlights: [
        'Cálculos locales en el navegador',
        'Minimización de datos personales',
        'Consentimiento explícito para recolección opcional',
      ],
      bodyParagraphs: [
        'Awesome Rank prioriza la privacidad y limita al máximo la recopilación de datos identificables.',
        'La política describe claramente qué datos se usan, con qué propósito y bajo qué base de consentimiento.',
      ],
      faqs: [
        { q: '¿Qué datos se recopilan?', a: 'Principalmente datos agregados y no sensibles para mejorar el servicio y generar estadísticas.' },
        { q: '¿Puedo rechazar la recolección opcional?', a: 'Sí, puedes gestionar el consentimiento y rechazar la recopilación no esencial.' },
      ],
    },
  },
  pt: {
    '/': {
      title: 'Awesome Rank — Mapa de tamanho real, ranking global de renda e quiz mundial',
      description: 'Compare o tamanho real dos países, calcule seu percentil global de renda e descubra sua posição entre 8 bilhões de pessoas.',
      heading: 'Awesome Rank — Onde você está entre 8 bilhões de pessoas?',
      subheading: 'Ferramentas interativas para revelar sua posição global em geografia, renda, estilo de vida e demografia.',
      keywords: 'awesome rank, mapa de tamanho real, percentil global de renda, quiz mundial, ranking global, comparação de padrão de vida',
      highlights: [
        'Mapa de tamanho real com projeção equivalente',
        'Calculadora de percentil global de renda (PPC/MER)',
        'Quiz World Rank com 15 perguntas',
        'Perfil global de altura, idade e aniversário',
      ],
      bodyParagraphs: [
        'Awesome Rank oferece ferramentas gratuitas para comparar sua posição com a população mundial com foco em privacidade.',
        'Você pode analisar tamanho real de países, posição de renda global e indicadores demográficos em uma única plataforma.',
      ],
      faqs: [
        { q: 'O que é o Awesome Rank?', a: 'É uma plataforma de comparação global para estilo de vida, renda e estatísticas demográficas.' },
        { q: 'Meus dados pessoais são enviados ao servidor?', a: 'Os cálculos principais rodam no navegador e a coleta de dados pessoais é minimizada.' },
        { q: 'Quais fontes são usadas?', a: 'A plataforma utiliza bases públicas como WID.world, Natural Earth, CIA World Factbook, UN e NCD-RisC.' },
      ],
    },
    '/world-rank': {
      title: 'Quiz World Rank — Onde você está entre 8 bilhões? | Awesome Rank',
      description: 'Responda 15 perguntas para estimar seu percentil global de estilo de vida.',
      heading: 'Quiz World Rank — Estime seu percentil global',
      subheading: 'Questionário de 15 perguntas para comparar seu padrão de vida com o restante do mundo.',
      keywords: 'quiz world rank, percentil global, ranking de estilo de vida, teste de padrão de vida, ranking mundial',
      highlights: [
        '15 perguntas sobre infraestrutura, conectividade e bens',
        'Modelo probabilístico com base em estatísticas globais',
        'Resultado imediato com percentil e faixa',
        'Link compartilhável de resultado',
      ],
      bodyParagraphs: [
        'O quiz avalia condições do dia a dia como acesso a serviços básicos, conectividade e ativos domésticos.',
        'As respostas são combinadas para estimar sua posição relativa na distribuição global de padrão de vida.',
      ],
      faqs: [
        { q: 'Como o resultado é calculado?', a: 'Cada resposta recebe peso estatístico com base na frequência global observada.' },
        { q: 'O resultado é exato?', a: 'É uma estimativa estatística útil para comparação, não uma medição absoluta individual.' },
        { q: 'Posso compartilhar meu resultado?', a: 'Sim, o sistema gera URL compartilhável com o resultado calculado.' },
      ],
    },
    '/income-rank': {
      title: 'Quão rico eu sou? — Calculadora de percentil global de renda | Awesome Rank',
      description: 'Informe sua renda e veja sua posição global com base no WID.world 2024. Compare em PPC e câmbio de mercado.',
      heading: 'Quão rico eu sou? — Calculadora de percentil global de renda',
      subheading: 'Descubra onde sua renda está na distribuição global.',
      keywords: 'quão rico eu sou, calculadora de percentil de renda, renda global, comparação salarial mundial, PPC',
      highlights: [
        'Distribuição global com base no WID.world 2024',
        'Modo PPC e câmbio de mercado',
        'Ajuste por tamanho da família',
        'Percentil global e classificação por faixa de renda',
      ],
      bodyParagraphs: [
        'Informe sua renda anual para estimar sua posição na distribuição mundial de renda.',
        'Use PPC para comparação de poder de compra ou MER para comparação nominal em dólar.',
      ],
      faqs: [
        { q: 'Qual a diferença entre PPC e MER?', a: 'PPC ajusta custo de vida local; MER usa câmbio de mercado sem ajuste de preços.' },
        { q: 'Minha renda é armazenada?', a: 'A lógica principal roda no navegador e não depende de envio obrigatório da renda pessoal.' },
        { q: 'Quais dados fundamentam o cálculo?', a: 'A distribuição global usada vem do World Inequality Database 2024.' },
      ],
    },
    '/country-compare': {
      title: 'Mapa de tamanho real — Compare o tamanho real dos países | Awesome Rank',
      description: 'Arraste países em um mapa de área equivalente para comparar tamanhos reais sem distorção de Mercator.',
      heading: 'Mapa de tamanho real — Veja o tamanho real dos países',
      subheading: 'Comparação interativa de áreas com projeção de área equivalente.',
      keywords: 'mapa de tamanho real, tamanho real dos países, comparação de áreas, distorção de Mercator, mapa equivalente',
      highlights: [
        'Projeção Equal Earth para preservar área',
        'Comparação por arraste e sobreposição no mapa',
        'Comparação de países, continentes e sub-regiões',
        'Ranking por área com tabela visual',
      ],
      bodyParagraphs: [
        'Mapas tradicionais podem distorcer áreas em altas latitudes. Esta ferramenta corrige esse efeito.',
        'Arraste países para sobrepor e comparar tamanhos reais de forma direta e visual.',
      ],
      faqs: [
        { q: 'Por que Mercator distorce tamanhos?', a: 'A projeção preserva ângulos para navegação, mas amplia áreas próximas aos polos.' },
        { q: 'Posso comparar outras regiões além de países?', a: 'Sim, você pode comparar diferentes entidades geográficas disponíveis nos filtros.' },
        { q: 'Qual projeção é usada?', a: 'Uma projeção de área equivalente, para manter proporções reais de superfície.' },
      ],
    },
    '/global-stats': {
      title: 'Perfil global — Compare sua altura, idade e aniversário | Awesome Rank',
      description: 'Compare sua altura, idade e data de nascimento com a população mundial.',
      heading: 'Perfil global — Sua altura, idade e aniversário vs. o mundo',
      subheading: 'Insira seus dados e descubra seu percentil global.',
      keywords: 'percentil de altura, percentil de idade, raridade de aniversário, estatísticas globais, comparação mundial',
      highlights: [
        'Percentil de altura por país e gênero',
        'Percentil de idade na população global',
        'Raridade de aniversário por data',
        'Modelos estatísticos com dados internacionais',
      ],
      bodyParagraphs: [
        'Compare seus dados físicos e demográficos com distribuições populacionais globais.',
        'O resultado inclui percentis e interpretações para facilitar a leitura da sua posição relativa.',
      ],
      faqs: [
        { q: 'Como o percentil de altura é calculado?', a: 'É usado um modelo de distribuição com parâmetros por país e gênero.' },
        { q: 'O que significa percentil de idade?', a: 'Mostra qual parcela da população mundial é mais jovem ou mais velha que você.' },
        { q: 'Como a raridade de aniversário é estimada?', a: 'Compara a frequência relativa de nascimentos por data em bases estatísticas.' },
      ],
    },
    '/privacy': {
      title: 'Política de privacidade — Awesome Rank',
      description: 'Saiba como o Awesome Rank coleta, usa e protege seus dados. Todos os cálculos rodam no navegador.',
      heading: 'Política de privacidade',
      subheading: 'Nosso compromisso com transparência e proteção de dados.',
      keywords: 'política de privacidade, proteção de dados, cálculos no navegador, awesome rank privacidade',
      highlights: [
        'Cálculos locais no navegador',
        'Minimização de dados pessoais',
        'Consentimento explícito para coleta opcional',
      ],
      bodyParagraphs: [
        'O Awesome Rank prioriza privacidade e reduz ao mínimo a coleta de dados identificáveis.',
        'A política detalha com clareza quais dados são usados, finalidade e base de consentimento.',
      ],
      faqs: [
        { q: 'Quais dados são coletados?', a: 'Principalmente dados agregados e não sensíveis para melhoria do serviço e estatísticas.' },
        { q: 'Posso recusar coleta opcional?', a: 'Sim, você pode gerenciar o consentimento e recusar coleta não essencial.' },
      ],
    },
  },
};

const NOT_FOUND_META = {
  en: {
    title: '404 Not Found — Awesome Rank',
    description: 'The page you requested could not be found.',
    heading: 'Page Not Found',
    body: 'The requested page does not exist or may have moved.',
  },
  ko: {
    title: '404 페이지를 찾을 수 없음 — Awesome Rank',
    description: '요청하신 페이지를 찾을 수 없습니다.',
    heading: '페이지를 찾을 수 없습니다',
    body: '요청하신 페이지가 없거나 이동되었을 수 있습니다.',
  },
  es: {
    title: '404 No encontrado — Awesome Rank',
    description: 'No se pudo encontrar la página solicitada.',
    heading: 'Página no encontrada',
    body: 'La página solicitada no existe o pudo haber sido movida.',
  },
  pt: {
    title: '404 Não encontrado — Awesome Rank',
    description: 'A página solicitada não foi encontrada.',
    heading: 'Página não encontrada',
    body: 'A página solicitada não existe ou pode ter sido movida.',
  },
};

// Redirect legacy URLs to locale-prefixed paths (/en, /ko, /es, /pt)
app.get('*', (req, res, next) => {
  const currentPath = normalizePath(req.path.toLowerCase());
  if (isBypassPath(currentPath)) return next();

  const { lang: pathLang, routePath } = splitLocalizedPath(currentPath);
  const langParam = typeof req.query.lang === 'string' ? req.query.lang.toLowerCase() : null;
  const queryLang = isSupportedLanguageCode(langParam) ? langParam : null;
  const appParam = typeof req.query.app === 'string' ? req.query.app : null;
  const appRoute = appParam ? mapAppToPath(appParam) : null;
  const targetRoute = appRoute || routePath;

  if (!ROUTE_META[targetRoute]) return next();

  if (targetRoute === '/admin') {
    const { params, removedTracking } = buildCanonicalParams(req.query);
    const query = params.toString();
    const location = query ? `/admin?${query}` : '/admin';
    if (currentPath !== '/admin' || appRoute || queryLang || langParam || removedTracking) {
      return res.redirect(301, location);
    }
    return next();
  }

  const effectiveLang = pathLang || queryLang || DEFAULT_LANGUAGE;
  const canonicalPath = buildLocalizedPath(targetRoute, effectiveLang);
  const { params, removedTracking } = buildCanonicalParams(req.query);
  const query = params.toString();
  const canonicalLocation = query ? `${canonicalPath}?${query}` : canonicalPath;

  const shouldRedirect = Boolean(
    appRoute ||
    !pathLang ||
    (queryLang && queryLang !== pathLang) ||
    currentPath !== canonicalPath ||
    langParam ||
    removedTracking
  );

  if (shouldRedirect) {
    return res.redirect(301, canonicalLocation);
  }
  return next();
});

const baseHtmlPath = join(FRONTEND_DIST, 'index.html');
const baseHtml = existsSync(baseHtmlPath) ? readFileSync(baseHtmlPath, 'utf-8') : null;

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function replaceMetaName(html, name, content) {
  const escaped = escapeHtml(content);
  const pattern = new RegExp(`<meta\\s+name="${name}"[^>]*>`, 'i');
  const replacement = `<meta name="${name}" content="${escaped}" />`;
  if (pattern.test(html)) {
    return html.replace(pattern, replacement);
  }
  return html.replace('</head>', `  ${replacement}\n  </head>`);
}

function replaceMetaProperty(html, property, content) {
  const escaped = escapeHtml(content);
  const pattern = new RegExp(`<meta\\s+property="${property}"[^>]*>`, 'i');
  const replacement = `<meta property="${property}" content="${escaped}" />`;
  if (pattern.test(html)) {
    return html.replace(pattern, replacement);
  }
  return html.replace('</head>', `  ${replacement}\n  </head>`);
}

function replaceLinkCanonical(html, href) {
  const escaped = escapeHtml(href);
  const pattern = /<link\s+rel="canonical"[^>]*>/i;
  const replacement = `<link rel="canonical" href="${escaped}" />`;
  if (pattern.test(html)) {
    return html.replace(pattern, replacement);
  }
  return html.replace('</head>', `  ${replacement}\n  </head>`);
}

function replaceTitleTag(html, title) {
  const escaped = escapeHtml(title);
  return html.replace(/<title>[^<]*<\/title>/i, `<title>${escaped}</title>`);
}

function getLanguageMeta(code) {
  return SUPPORTED_LANGUAGES.find((item) => item.code === code) || SUPPORTED_LANGUAGES[0];
}

function replaceOgLocaleAlternates(html, currentLang) {
  const withoutExisting = html.replace(/\s*<meta\s+property="og:locale:alternate"[^>]*>\s*/gi, '\n');
  const alternateLines = SUPPORTED_LANGUAGES
    .filter((item) => item.code !== currentLang)
    .map((item) => `    <meta property="og:locale:alternate" content="${escapeHtml(item.ogLocale)}" />`)
    .join('\n');

  if (!alternateLines) return withoutExisting;
  return withoutExisting.replace('</head>', `${alternateLines}\n  </head>`);
}

function resolveLanguage(req) {
  const { lang: pathLang } = splitLocalizedPath(req.path);
  if (pathLang) return pathLang;
  const langParam = typeof req.query.lang === 'string' ? req.query.lang.toLowerCase() : null;
  if (isSupportedLanguageCode(langParam)) return langParam;
  const header = req.headers['accept-language'];
  if (typeof header === 'string') {
    const parts = header.split(',').map((part) => part.trim().split(';')[0]);
    for (const part of parts) {
      const primary = part.toLowerCase().split('-')[0];
      if (isSupportedLanguageCode(primary)) return primary;
    }
  }
  return DEFAULT_LANGUAGE;
}

function detectVolatileParams(req) {
  const volatileKeys = new Set([
    'score',
    'income',
    'householdIncome',
    'adults',
    'children',
    'country',
    'currency',
    'year',
    'basis',
  ]);
  return Object.keys(req.query || {}).some((key) => volatileKeys.has(key));
}

function resolveRoute(req) {
  const { routePath } = splitLocalizedPath(req.path);
  if (ROUTE_META[routePath]) return routePath;
  const appParam = typeof req.query.app === 'string' ? req.query.app : null;
  const mapped = appParam ? mapAppToPath(appParam) : null;
  if (mapped && ROUTE_META[mapped]) return mapped;
  return null;
}

function buildHreflangLinks(pathname) {
  if (pathname === '/admin') return '';
  const lines = SUPPORTED_LANGUAGES.map((lang) => {
    const href = `${SITE_URL}${buildLocalizedPath(pathname, lang.code)}`;
    return `    <link rel="alternate" hreflang="${lang.code}" href="${href}" />`;
  });
  lines.push(`    <link rel="alternate" hreflang="x-default" href="${SITE_URL}${buildLocalizedPath(pathname, DEFAULT_LANGUAGE)}" />`);
  return lines.join('\n');
}

const SEO_NAV_LINKS = [
  { href: '/', label: 'Home' },
  { href: '/country-compare', label: 'True Size Map' },
  { href: '/income-rank', label: 'Income Percentile Calculator' },
  { href: '/world-rank', label: 'World Rank Quiz' },
  { href: '/global-stats', label: 'Global Profile' },
];

function buildLocalizedHref(path, lang) {
  return buildLocalizedPath(path, lang);
}

function buildSeoContent(meta, currentPath, lang) {
  const fallbackHighlights = routeFeatureFallback(currentPath);
  const items = Array.isArray(meta.highlights) && meta.highlights.length > 0
    ? meta.highlights
    : fallbackHighlights;
  const paragraphs = Array.isArray(meta.bodyParagraphs) ? meta.bodyParagraphs : [];
  const faqs = Array.isArray(meta.faqs) ? meta.faqs : [];
  const navLinks = SEO_NAV_LINKS
    .filter((link) => link.href !== currentPath)
    .map((link) => {
      const href = buildLocalizedHref(link.href, lang);
      return `<li><a href="${escapeHtml(href)}">${escapeHtml(link.label)}</a></li>`;
    })
    .join('');

  return `
    <main class="seo-shell">
      <header class="seo-hero">
        <h1>${escapeHtml(meta.heading)}</h1>
        <p>${escapeHtml(meta.subheading)}</p>
      </header>
      ${paragraphs.length > 0 ? `
      <section class="seo-about">
        ${paragraphs.map((p) => `<p>${escapeHtml(p)}</p>`).join('')}
      </section>` : `
      <section class="seo-summary">
        <p>${escapeHtml(meta.description)}</p>
      </section>`}
      ${items.length > 0 ? `
      <section class="seo-features">
        <h2>Key Features</h2>
        <ul>
          ${items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}
        </ul>
      </section>` : ''}
      ${faqs.length > 0 ? `
      <section class="seo-faq">
        <h2>Frequently Asked Questions</h2>
        <dl>
          ${faqs.map((faq) => `<dt>${escapeHtml(faq.q)}</dt><dd>${escapeHtml(faq.a)}</dd>`).join('')}
        </dl>
      </section>` : ''}
      <nav class="seo-nav">
        <h2>Explore More</h2>
        <ul>${navLinks}</ul>
      </nav>
      <noscript>JavaScript is required for the interactive experience. The overview above is available without scripts.</noscript>
    </main>
  `.trim();
}

function buildJsonLd(meta, canonicalUrl, lang, routeKey) {
  const langMeta = getLanguageMeta(lang);
  const inLanguage = langMeta.ogLocale.replace('_', '-');
  const name = meta.heading || meta.title;
  const description = meta.description;
  const featureList = Array.isArray(meta.highlights) && meta.highlights.length > 0
    ? meta.highlights
    : routeFeatureFallback(routeKey);

  if (meta.schemaType === 'WebPage') {
    return {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name,
      description,
      url: canonicalUrl,
      inLanguage,
      isPartOf: {
        '@type': 'WebSite',
        name: 'Awesome Rank',
        url: SITE_URL,
      },
    };
  }
  return {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name,
    description,
    url: canonicalUrl,
    inLanguage,
    applicationCategory: ['LifestyleApplication', 'FinanceApplication'],
    operatingSystem: 'Any',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
    },
    featureList,
    author: {
      '@type': 'Organization',
      name: 'Awesome Rank',
    },
  };
}

function stringifyJsonForScript(value) {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

function buildLocalizedMeta(routeKey, baseMeta, lang) {
  const langOverrides = LOCALIZED_META_OVERRIDES[lang];
  const routeOverrides = langOverrides && routeKey ? langOverrides[routeKey] : null;
  if (!routeOverrides) return baseMeta;
  return {
    ...baseMeta,
    ...routeOverrides,
  };
}

function renderNotFoundHtml(req) {
  if (!baseHtml) return null;
  const lang = resolveLanguage(req);
  const langMeta = getLanguageMeta(lang);
  const localized = NOT_FOUND_META[lang] || NOT_FOUND_META.en;
  const requestPath = normalizePath(req.path.toLowerCase());
  const canonicalPath = requestPath || '/';
  const canonicalUrl = `${SITE_URL}${canonicalPath}`;

  let html = baseHtml;
  html = html.replace(/<html lang="[^"]*"/i, `<html lang="${lang}"`);
  html = replaceTitleTag(html, localized.title);
  html = replaceMetaName(html, 'title', localized.title);
  html = replaceMetaName(html, 'description', localized.description);
  html = replaceMetaName(html, 'robots', 'noindex,nofollow');
  html = replaceLinkCanonical(html, canonicalUrl);
  html = replaceMetaProperty(html, 'og:url', canonicalUrl);
  html = replaceMetaProperty(html, 'og:title', localized.title);
  html = replaceMetaProperty(html, 'og:description', localized.description);
  html = replaceMetaProperty(html, 'og:locale', langMeta.ogLocale);
  html = replaceOgLocaleAlternates(html, lang);
  html = replaceMetaName(html, 'twitter:url', canonicalUrl);
  html = replaceMetaName(html, 'twitter:title', localized.title);
  html = replaceMetaName(html, 'twitter:description', localized.description);
  html = html.replace(
    '<div id="root"></div>',
    `<div id="root"><main class="seo-shell"><header class="seo-hero"><h1>${escapeHtml(localized.heading)}</h1><p>${escapeHtml(localized.body)}</p></header></main></div>`,
  );
  // Keep 404 page static: avoid client hydration replacing content with app home.
  html = html.replace(/<script\b[^>]*type="module"[^>]*>[\s\S]*?<\/script>/gi, '');
  return html;
}

function renderSeoHtml(req) {
  if (!baseHtml) return null;
  const routeKey = resolveRoute(req);
  if (!routeKey) return null;
  const baseMeta = ROUTE_META[routeKey];
  if (!baseMeta) return null;
  const lang = resolveLanguage(req);
  const meta = buildLocalizedMeta(routeKey, baseMeta, lang);
  const langMeta = getLanguageMeta(lang);
  const canonicalPath = routeKey === '/admin'
    ? '/admin'
    : buildLocalizedPath(routeKey, lang);
  const canonicalUrl = `${SITE_URL}${canonicalPath}`;
  const ogLocale = langMeta.ogLocale;
  const robots = detectVolatileParams(req)
    ? 'noindex, follow'
    : (meta.robots || 'index, follow');
  const hreflangLinks = buildHreflangLinks(routeKey);
  let dynamicMeta = { ...meta };

  if (routeKey === '/world-rank' && typeof req.query.score === 'string') {
    const parsedScore = Number.parseFloat(req.query.score);
    if (Number.isFinite(parsedScore) && parsedScore > 0) {
      const formatted = new Intl.NumberFormat(lang, { maximumSignificantDigits: 4 }).format(parsedScore);
      dynamicMeta = {
        ...dynamicMeta,
        title: `Top ${formatted}% — World Rank Result`,
        description: `This World Rank result is a modeled estimate placing you in the top ${formatted}% globally.`,
      };
    }
  }

  if (routeKey === '/income-rank' && (typeof req.query.householdIncome === 'string' || typeof req.query.income === 'string')) {
    const incomeValue = typeof req.query.householdIncome === 'string' ? req.query.householdIncome : req.query.income;
    const parsedIncome = incomeValue ? Number.parseFloat(incomeValue) : null;
    if (Number.isFinite(parsedIncome) && parsedIncome > 0) {
      const formattedIncome = new Intl.NumberFormat(lang, { maximumSignificantDigits: 4 }).format(parsedIncome);
      const basisValue = typeof req.query.basis === 'string' ? req.query.basis.toUpperCase() : null;
      const basis = basisValue === 'PPP' || basisValue === 'MER' ? basisValue : null;
      dynamicMeta = {
        ...dynamicMeta,
        title: `Income Rank Result — ${formattedIncome}${basis ? ` (${basis})` : ''}`,
        description: `See how an income of ${formattedIncome} compares globally${basis ? ` using ${basis}` : ''}.`,
      };
    }
  }

  const seoContent = buildSeoContent(dynamicMeta, routeKey, lang);
  const jsonLd = buildJsonLd(dynamicMeta, canonicalUrl, lang, routeKey);

  let html = baseHtml;
  html = html.replace(/<html lang="[^"]*"/i, `<html lang="${lang}"`);
  html = replaceTitleTag(html, dynamicMeta.title);
  html = replaceMetaName(html, 'title', dynamicMeta.title);
  html = replaceMetaName(html, 'description', dynamicMeta.description);
  html = replaceMetaName(html, 'keywords', dynamicMeta.keywords);
  html = replaceMetaName(html, 'robots', robots);
  html = replaceMetaName(html, 'language', langMeta.label);
  html = replaceLinkCanonical(html, canonicalUrl);
  html = replaceMetaProperty(html, 'og:url', canonicalUrl);
  html = replaceMetaProperty(html, 'og:title', dynamicMeta.title);
  html = replaceMetaProperty(html, 'og:description', dynamicMeta.description);
  html = replaceMetaProperty(html, 'og:locale', ogLocale);
  html = replaceOgLocaleAlternates(html, lang);
  html = replaceMetaName(html, 'twitter:url', canonicalUrl);
  html = replaceMetaName(html, 'twitter:title', dynamicMeta.title);
  html = replaceMetaName(html, 'twitter:description', dynamicMeta.description);

  html = html.replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/i, `<script type="application/ld+json">${stringifyJsonForScript(jsonLd)}</script>`);
  html = html.replace('<div id="root"></div>', `<div id="root">${seoContent}</div>`);
  if (hreflangLinks) {
    html = html.replace('</head>', `${hreflangLinks}\n  </head>`);
  }
  return html;
}

const postgresPool = new Pool({
  host: process.env.POSTGRES_HOST || '127.0.0.1',
  port: Number.parseInt(process.env.POSTGRES_PORT || '5432', 10),
  database: process.env.POSTGRES_DB || 'worldrank_prod',
  user: process.env.POSTGRES_USER || 'worldrank_app',
  password: process.env.POSTGRES_PASSWORD || '',
  max: Number.parseInt(process.env.POSTGRES_POOL_MAX || '10', 10),
  idleTimeoutMillis: Number.parseInt(process.env.POSTGRES_IDLE_TIMEOUT_MS || '30000', 10),
  connectionTimeoutMillis: Number.parseInt(process.env.POSTGRES_CONNECT_TIMEOUT_MS || '10000', 10),
});

function convertSqlitePlaceholdersToPg(sql) {
  let paramIndex = 0;
  return sql.replace(/\?/g, () => `$${++paramIndex}`);
}

async function executeQuery(statement) {
  if (typeof statement === 'string') {
    return postgresPool.query(statement);
  }

  const sql = typeof statement?.sql === 'string' ? statement.sql : '';
  const args = Array.isArray(statement?.args) ? statement.args : [];
  const convertedSql = convertSqlitePlaceholdersToPg(sql);
  return postgresPool.query(convertedSql, args);
}

const db = {
  execute: executeQuery,
};

// Initialize database
async function initDatabase() {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  if (!existsSync(MIGRATIONS_DIR)) {
    throw new Error(`Migrations directory not found: ${MIGRATIONS_DIR}`);
  }

  const migrationFiles = readdirSync(MIGRATIONS_DIR)
    .filter((fileName) => fileName.endsWith('.sql'))
    .sort((a, b) => a.localeCompare(b));

  for (const fileName of migrationFiles) {
    const alreadyApplied = await db.execute({
      sql: 'SELECT 1 FROM schema_migrations WHERE version = ? LIMIT 1',
      args: [fileName],
    });

    if (alreadyApplied.rows.length > 0) continue;

    const sql = readFileSync(join(MIGRATIONS_DIR, fileName), 'utf8').trim();
    const client = await postgresPool.connect();
    try {
      await client.query('BEGIN');
      if (sql.length > 0) {
        await client.query(sql);
      }
      await client.query(
        'INSERT INTO schema_migrations (version) VALUES ($1)',
        [fileName],
      );
      await client.query('COMMIT');
      console.log(`Applied migration: ${fileName}`);
    } catch (error) {
      await client.query('ROLLBACK');
      throw new Error(`Failed migration ${fileName}: ${error.message}`);
    } finally {
      client.release();
    }
  }

  console.log('Database migrations completed');
}

// Helper: Get country from IP using free API
async function getGeoFromIP(ip) {
  try {
    // Skip for localhost
    if (ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1') {
      return {
        country: 'Local',
        countryCode: 'Local',
        city: 'Localhost',
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
      };
    }

    const response = await fetch(`http://ip-api.com/json/${ip}?fields=country,countryCode,city,timezone`);
    const data = await response.json();
    return {
      country: data.country || 'Unknown',
      countryCode: data.countryCode || 'Unknown',
      city: data.city || 'Unknown',
      timezone: data.timezone || 'Unknown'
    };
  } catch {
    return { country: 'Unknown', countryCode: 'Unknown', city: 'Unknown', timezone: 'Unknown' };
  }
}

// Helper: Get real IP from request
function getClientIP(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim()
    || req.headers['x-real-ip']
    || req.socket.remoteAddress
    || '';
}

function normalizePayload(rawPayload) {
  if (rawPayload === undefined || rawPayload === null) {
    return { parsed: null, serialized: null, parseError: null };
  }

  if (typeof rawPayload === 'string') {
    try {
      return {
        parsed: JSON.parse(rawPayload),
        serialized: rawPayload,
        parseError: null,
      };
    } catch {
      return {
        parsed: null,
        serialized: rawPayload,
        parseError: 'payload is not valid JSON',
      };
    }
  }

  if (rawPayload && typeof rawPayload === 'object') {
    return {
      parsed: rawPayload,
      serialized: JSON.stringify(rawPayload),
      parseError: null,
    };
  }

  return {
    parsed: null,
    serialized: String(rawPayload),
    parseError: 'payload must be an object or JSON string',
  };
}

function validateIncomeRankPayload(parsedPayload) {
  if (!parsedPayload || typeof parsedPayload !== 'object' || Array.isArray(parsedPayload)) {
    return { valid: false, error: 'income-rank payload must be an object' };
  }

  const payload = parsedPayload;
  const basis = payload.basis;
  if (basis !== 'PPP' && basis !== 'MER') {
    return { valid: false, error: 'income-rank payload missing valid "basis"' };
  }

  const incomeAnnualUsd = payload.incomeAnnualUsd;
  if (typeof incomeAnnualUsd !== 'number' || !Number.isFinite(incomeAnnualUsd) || incomeAnnualUsd <= 0) {
    return { valid: false, error: 'income-rank payload missing valid "incomeAnnualUsd"' };
  }

  const topPercent = payload.topPercent;
  if (typeof topPercent !== 'number' || !Number.isFinite(topPercent) || topPercent < 0 || topPercent > 100) {
    return { valid: false, error: 'income-rank payload missing valid "topPercent"' };
  }

  if (!Object.prototype.hasOwnProperty.call(payload, 'countryCode')) {
    return { valid: false, error: 'income-rank payload must include "countryCode" (nullable)' };
  }

  const countryCode = payload.countryCode;
  if (countryCode !== null && typeof countryCode !== 'string') {
    return { valid: false, error: 'income-rank payload "countryCode" must be string or null' };
  }

  return { valid: true, error: null };
}

// API: Submit quiz response
app.post('/api/submit', async (req, res) => {
  try {
    const clientIP = getClientIP(req);
    const geo = await getGeoFromIP(clientIP);
    const body = req.body;
    const payloadState = normalizePayload(body.payload);
    const appPayload = payloadState.serialized;

    let appPayloadValid = null;
    let appPayloadError = payloadState.parseError;

    if (body.payload !== undefined) {
      appPayloadValid = payloadState.parseError ? 0 : 1;
    }

    if (body.appId === 'income-rank') {
      const incomePayloadValidation = validateIncomeRankPayload(payloadState.parsed);
      appPayloadValid = incomePayloadValidation.valid ? 1 : 0;
      appPayloadError = incomePayloadValidation.valid
        ? null
        : incomePayloadValidation.error;
    }

    await db.execute({
      sql: `
        INSERT INTO responses (
          timestamp, country, country_code, city, timezone_from_ip,
          app_id, quiz_version, question_set_id, score_algo_version,
          age_group, gender,
          question_ids, answers, question_times, answers_by_question_id, times_by_question_id, total_quiz_time,
          score, tier, yes_count,
          session_duration, selected_language, client_id, session_id,
          session_started_at, session_finished_at, completed,
          landing_url, landing_path, document_referrer,
          utm_source, utm_medium, utm_campaign, utm_content, utm_term,
          browser_language, languages, timezone, device_type,
          screen_width, screen_height, viewport_width, viewport_height,
          pixel_ratio, platform, connection_type,
          user_agent, referer,
          app_payload, app_payload_valid, app_payload_error
        ) VALUES (
          ?, ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?,
          ?, ?, ?, ?, ?, ?,
          ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?,
          ?, ?, ?,
          ?, ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?,
          ?, ?,
          ?, ?, ?
        )
      `,
      args: [
        new Date().toISOString(),
        geo.country,
        geo.countryCode,
        geo.city,
        geo.timezone,
        body.appId || null,
        body.quizVersion || null,
        body.questionSetId || null,
        body.scoreAlgoVersion || null,
        body.ageGroup || null,
        body.gender || null,
        JSON.stringify(body.questionIds || []),
        JSON.stringify(body.answers || []),
        JSON.stringify(body.questionTimes || []),
        JSON.stringify(body.answersByQuestionId || {}),
        JSON.stringify(body.timesByQuestionId || {}),
        body.totalQuizTime || null,
        body.score || null,
        body.tier || null,
        body.yesCount || null,
        body.sessionDuration || null,
        body.selectedLanguage || null,
        body.clientId || null,
        body.sessionId || null,
        body.sessionStartedAt || null,
        body.sessionFinishedAt || null,
        typeof body.completed === 'boolean' ? (body.completed ? 1 : 0) : null,
        body.landingUrl || null,
        body.landingPath || null,
        body.documentReferrer || null,
        body.utmSource || null,
        body.utmMedium || null,
        body.utmCampaign || null,
        body.utmContent || null,
        body.utmTerm || null,
        body.browserLanguage || null,
        body.languages || null,
        body.timezone || null,
        body.deviceType || null,
        body.screenWidth || null,
        body.screenHeight || null,
        body.viewportWidth || null,
        body.viewportHeight || null,
        body.pixelRatio || null,
        body.platform || null,
        body.connectionType || null,
        req.headers['user-agent'] || 'Unknown',
        req.headers['referer'] || 'Direct',
        appPayload,
        appPayloadValid,
        appPayloadError
      ]
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error saving data:', error);
    res.status(500).json({ success: false, error: 'Failed to save data' });
  }
});

// API: Get stats
app.get('/api/stats', async (req, res) => {
  try {
    const total = await db.execute('SELECT COUNT(*) as count FROM responses');
    const recent = await db.execute('SELECT * FROM responses ORDER BY id DESC LIMIT 100');

    res.json({
      totalResponses: total.rows[0].count,
      responses: recent.rows
    });
  } catch (error) {
    console.error('Error reading stats:', error);
    res.status(500).json({ error: 'Failed to read stats' });
  }
});

// API: Get aggregated stats
app.get('/api/stats/summary', async (req, res) => {
  try {
    const total = await db.execute('SELECT COUNT(*) as count FROM responses');

    const byCountry = await db.execute(`
      SELECT country, COUNT(*) as count
      FROM responses
      GROUP BY country
      ORDER BY count DESC
      LIMIT 20
    `);

    const byAgeGroup = await db.execute(`
      SELECT age_group, COUNT(*) as count
      FROM responses
      WHERE age_group IS NOT NULL
      GROUP BY age_group
      ORDER BY age_group
    `);

    const byGender = await db.execute(`
      SELECT gender, COUNT(*) as count
      FROM responses
      WHERE gender IS NOT NULL
      GROUP BY gender
    `);

    const byDevice = await db.execute(`
      SELECT device_type, COUNT(*) as count
      FROM responses
      GROUP BY device_type
    `);

    const byLanguage = await db.execute(`
      SELECT selected_language, COUNT(*) as count
      FROM responses
      WHERE selected_language IS NOT NULL
      GROUP BY selected_language
      ORDER BY count DESC
    `);

    res.json({
      totalResponses: total.rows[0].count,
      byCountry: byCountry.rows,
      byAgeGroup: byAgeGroup.rows,
      byGender: byGender.rows,
      byDevice: byDevice.rows,
      byLanguage: byLanguage.rows
    });
  } catch (error) {
    console.error('Error reading summary:', error);
    res.status(500).json({ error: 'Failed to read summary' });
  }
});

function quantile(values, q) {
  if (!Array.isArray(values) || values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = (sorted.length - 1) * q;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  const frac = idx - lo;
  return sorted[lo] * (1 - frac) + sorted[hi] * frac;
}

function getTopPercentBand(topPercent) {
  if (!Number.isFinite(topPercent) || topPercent < 0) return null;
  if (topPercent > 50) return '>50';
  if (topPercent > 20) return '50-20';
  if (topPercent > 10) return '20-10';
  if (topPercent > 1) return '10-1';
  if (topPercent > 0.1) return '1-0.1';
  return '<0.1';
}

// API: Income-rank aggregated stats
app.get('/api/stats/income-summary', async (req, res) => {
  try {
    const result = await db.execute(`
      SELECT id, timestamp, country_code, app_payload, app_payload_valid, app_payload_error
      FROM responses
      WHERE app_id = 'income-rank'
      ORDER BY id DESC
    `);

    const rows = result.rows || [];
    const byBasisMap = { PPP: 0, MER: 0 };
    const topPercentBandMap = {
      '>50': 0,
      '50-20': 0,
      '20-10': 0,
      '10-1': 0,
      '1-0.1': 0,
      '<0.1': 0,
    };
    const countryMap = new Map();
    const incomeValues = [];
    let validResponses = 0;

    const recentResponses = [];

    for (const row of rows) {
      const payloadState = normalizePayload(row.app_payload);
      const incomeValidation = validateIncomeRankPayload(payloadState.parsed);
      const payloadValidBySchema = incomeValidation.valid;
      const payloadValidColumn = row.app_payload_valid === null || row.app_payload_valid === undefined
        ? payloadValidBySchema
        : Number(row.app_payload_valid) === 1;
      const payloadValid = payloadValidBySchema && payloadValidColumn;
      const payloadError = row.app_payload_error || payloadState.parseError || incomeValidation.error;

      const payload = payloadState.parsed && typeof payloadState.parsed === 'object'
        ? payloadState.parsed
        : null;
      const basis = payload && (payload.basis === 'PPP' || payload.basis === 'MER') ? payload.basis : null;
      const incomeAnnualUsd = payload ? Number(payload.incomeAnnualUsd) : null;
      const topPercent = payload ? Number(payload.topPercent) : null;
      const countryCode = payload && Object.prototype.hasOwnProperty.call(payload, 'countryCode')
        ? payload.countryCode
        : null;

      if (payloadValid && basis) {
        validResponses += 1;
        byBasisMap[basis] += 1;

        if (Number.isFinite(incomeAnnualUsd) && incomeAnnualUsd > 0) {
          incomeValues.push(incomeAnnualUsd);
        }

        if (Number.isFinite(topPercent) && topPercent >= 0 && topPercent <= 100) {
          const band = getTopPercentBand(topPercent);
          if (band) topPercentBandMap[band] += 1;
        }

        const country = typeof countryCode === 'string' && countryCode
          ? countryCode
          : (typeof row.country_code === 'string' && row.country_code ? row.country_code : null);
        if (country) {
          countryMap.set(country, (countryMap.get(country) || 0) + 1);
        }
      }

      if (recentResponses.length < 50) {
        recentResponses.push({
          id: row.id,
          timestamp: row.timestamp,
          countryCode: typeof countryCode === 'string' && countryCode
            ? countryCode
            : (typeof row.country_code === 'string' ? row.country_code : null),
          basis,
          incomeAnnualUsd: Number.isFinite(incomeAnnualUsd) ? incomeAnnualUsd : null,
          topPercent: Number.isFinite(topPercent) ? topPercent : null,
          conversionSource: payload && typeof payload.conversionSource === 'string' ? payload.conversionSource : null,
          conversionDate: payload && typeof payload.conversionDate === 'string' ? payload.conversionDate : null,
          effectiveIncomeYear: payload && Number.isFinite(Number(payload.effectiveIncomeYear))
            ? Number(payload.effectiveIncomeYear)
            : null,
          payloadValid,
          payloadError,
        });
      }
    }

    const topCountries = [...countryMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([countryCode, count]) => ({ countryCode, count }));

    res.json({
      totalResponses: rows.length,
      validResponses,
      byBasis: [
        { basis: 'PPP', count: byBasisMap.PPP },
        { basis: 'MER', count: byBasisMap.MER },
      ],
      incomeUsdPercentiles: {
        p50: quantile(incomeValues, 0.5),
        p75: quantile(incomeValues, 0.75),
        p90: quantile(incomeValues, 0.9),
        p99: quantile(incomeValues, 0.99),
      },
      topPercentBands: [
        { band: '>50', count: topPercentBandMap['>50'] },
        { band: '50-20', count: topPercentBandMap['50-20'] },
        { band: '20-10', count: topPercentBandMap['20-10'] },
        { band: '10-1', count: topPercentBandMap['10-1'] },
        { band: '1-0.1', count: topPercentBandMap['1-0.1'] },
        { band: '<0.1', count: topPercentBandMap['<0.1'] },
      ],
      topCountries,
      recentResponses,
    });
  } catch (error) {
    console.error('Error reading income summary:', error);
    res.status(500).json({ error: 'Failed to read income summary' });
  }
});

// SPA fallback with SEO-friendly HTML
app.get('*', (req, res) => {
  const routeKey = resolveRoute(req);
  if (!routeKey) {
    const notFoundHtml = renderNotFoundHtml(req);
    if (notFoundHtml) {
      res.status(404).set('Content-Type', 'text/html');
      res.send(notFoundHtml);
      return;
    }
    res.status(404).send('Not Found');
    return;
  }
  const html = renderSeoHtml(req);
  if (html) {
    res.set('Content-Type', 'text/html');
    res.send(html);
  } else {
    res.sendFile(join(FRONTEND_DIST, 'index.html'));
  }
});

// Start server after database initialization
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function isRetryableDbInitError(error) {
  if (!error) return false;
  if (error.code === '57P03') return true; // PostgreSQL: cannot_connect_now
  if (error.code === 'ECONNREFUSED') return true;
  if (error.code === 'ETIMEDOUT') return true;
  return typeof error.message === 'string'
    && (error.message.includes('Connection terminated unexpectedly')
      || error.message.includes('the database system is starting up'));
}

async function initDatabaseWithRetry(maxRetries = 8, retryDelayMs = 250) {
  for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
    try {
      await initDatabase();
      return;
    } catch (error) {
      const isLastAttempt = attempt === maxRetries;
      if (!isRetryableDbInitError(error) || isLastAttempt) {
        throw error;
      }
      console.warn(
        `Database is not ready during initialization (attempt ${attempt}/${maxRetries}). Retrying in ${retryDelayMs}ms...`,
      );
      await sleep(retryDelayMs);
    }
  }
}

initDatabaseWithRetry()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  })
  .catch((error) => {
    console.error('Failed to initialize database:', error);
    process.exit(1);
  });
