import { spawn } from 'child_process';
import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import net from 'net';

const SUPPORTED_LANGUAGES = [
  { code: 'en', ogLocale: 'en_US' },
  { code: 'ko', ogLocale: 'ko_KR' },
  { code: 'es', ogLocale: 'es_ES' },
  { code: 'pt', ogLocale: 'pt_BR' },
];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        server.close(() => reject(new Error('Failed to resolve free port')));
        return;
      }
      const { port } = address;
      server.close((closeError) => {
        if (closeError) {
          reject(closeError);
          return;
        }
        resolve(port);
      });
    });
  });
}

function splitLocalizedPath(pathname) {
  const normalized = pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
  const segments = normalized.split('/').filter(Boolean);
  if (segments.length === 0) return { lang: null, routePath: '/' };
  const [first, ...rest] = segments;
  const lang = first.toLowerCase();
  if (!SUPPORTED_LANGUAGES.some((item) => item.code === lang)) {
    return { lang: null, routePath: normalized || '/' };
  }
  const routePath = rest.length === 0 ? '/' : `/${rest.join('/')}`;
  return { lang, routePath };
}

function buildLocalizedPath(routePath, lang) {
  return routePath === '/' ? `/${lang}` : `/${lang}${routePath}`;
}

function normalizeLocation(location) {
  if (!location) return '';
  if (location.startsWith('http://') || location.startsWith('https://')) {
    const parsed = new URL(location);
    return `${parsed.pathname}${parsed.search}`;
  }
  return location;
}

function parseAttributes(tag) {
  const attrs = {};
  const attrPattern = /([^\s=/>]+)\s*=\s*("([^"]*)"|'([^']*)')/g;
  let match = attrPattern.exec(tag);
  while (match) {
    const name = match[1].toLowerCase();
    const value = match[3] ?? match[4] ?? '';
    attrs[name] = value;
    match = attrPattern.exec(tag);
  }
  return attrs;
}

function getTags(html, tagName) {
  const tags = [];
  const regex = new RegExp(`<${tagName}\\b[^>]*>`, 'gi');
  let match = regex.exec(html);
  while (match) {
    tags.push(match[0]);
    match = regex.exec(html);
  }
  return tags;
}

function getMetaContent(html, key, value) {
  const tags = getTags(html, 'meta');
  for (const tag of tags) {
    const attrs = parseAttributes(tag);
    if (attrs[key] === value) {
      return attrs.content || '';
    }
  }
  return '';
}

function getMetaContents(html, key, value) {
  const results = [];
  const tags = getTags(html, 'meta');
  for (const tag of tags) {
    const attrs = parseAttributes(tag);
    if (attrs[key] === value) {
      results.push(attrs.content || '');
    }
  }
  return results;
}

function getCanonicalHref(html) {
  const tags = getTags(html, 'link');
  for (const tag of tags) {
    const attrs = parseAttributes(tag);
    if (attrs.rel === 'canonical') return attrs.href || '';
  }
  return '';
}

function getHreflangMap(html) {
  const result = new Map();
  const tags = getTags(html, 'link');
  for (const tag of tags) {
    const attrs = parseAttributes(tag);
    if (attrs.rel === 'alternate' && attrs.hreflang) {
      result.set(attrs.hreflang, attrs.href || '');
    }
  }
  return result;
}

function getJsonLdObjects(html) {
  const list = [];
  const regex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match = regex.exec(html);
  while (match) {
    const raw = (match[1] || '').trim();
    try {
      const parsed = JSON.parse(raw);
      list.push(parsed);
    } catch {
      // ignore invalid json blocks
    }
    match = regex.exec(html);
  }
  return list;
}

function startServer(port, dbPath, siteUrl) {
  const child = spawn('node', ['server/server.js'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PORT: String(port),
      SITE_URL: siteUrl,
      TURSO_DATABASE_URL: `file:${dbPath}`,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let logs = '';
  child.stdout.on('data', (chunk) => {
    logs += chunk.toString();
  });
  child.stderr.on('data', (chunk) => {
    logs += chunk.toString();
  });

  return { child, getLogs: () => logs };
}

async function waitForServerReady(baseUrl, child, getLogs) {
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`Server exited early with code ${child.exitCode}\n${getLogs()}`);
    }
    try {
      const response = await fetch(`${baseUrl}/en`, { redirect: 'manual' });
      if (response.status >= 200 && response.status < 500) return;
    } catch {
      // retry until timeout
    }
    await sleep(250);
  }
  throw new Error(`Server start timeout after 30s\n${getLogs()}`);
}

async function stopServer(child) {
  if (!child || child.exitCode !== null) return;

  await new Promise((resolve) => {
    const timer = setTimeout(() => {
      if (child.exitCode === null) child.kill('SIGKILL');
    }, 3000);

    child.once('exit', () => {
      clearTimeout(timer);
      resolve();
    });

    child.kill('SIGTERM');
  });
}

async function run() {
  const failures = [];
  const assert = (condition, message) => {
    if (!condition) failures.push(message);
  };

  const port = await getFreePort();
  const siteUrl = `http://127.0.0.1:${port}`;
  const tempDir = mkdtempSync(join(tmpdir(), 'awesomerank-seo-'));
  const dbPath = join(tempDir, 'responses.db');
  const { child, getLogs } = startServer(port, dbPath, siteUrl);

  try {
    await waitForServerReady(siteUrl, child, getLogs);

    const request = async (path) => fetch(`${siteUrl}${path}`, { redirect: 'manual' });

    const rootRedirect = await request('/');
    assert(rootRedirect.status === 301, `Expected / to return 301, got ${rootRedirect.status}`);
    assert(
      normalizeLocation(rootRedirect.headers.get('location')) === '/en',
      `Expected / redirect location /en, got ${rootRedirect.headers.get('location')}`,
    );

    const trackingRedirect = await request('/en?utm_source=x');
    assert(trackingRedirect.status === 301, `Expected /en?utm_source=x to return 301, got ${trackingRedirect.status}`);
    assert(
      normalizeLocation(trackingRedirect.headers.get('location')) === '/en',
      `Expected /en?utm_source=x redirect location /en, got ${trackingRedirect.headers.get('location')}`,
    );

    const incomeTrackingRedirect = await request('/ko/income-rank?utm_source=x&householdIncome=1000');
    assert(
      incomeTrackingRedirect.status === 301,
      `Expected /ko/income-rank with utm to return 301, got ${incomeTrackingRedirect.status}`,
    );
    assert(
      normalizeLocation(incomeTrackingRedirect.headers.get('location')) === '/ko/income-rank?householdIncome=1000',
      `Expected ko income redirect to preserve functional params only, got ${incomeTrackingRedirect.headers.get('location')}`,
    );

    const notFoundResponse = await request('/en/missing');
    assert(notFoundResponse.status === 404, `Expected /en/missing to return 404, got ${notFoundResponse.status}`);
    const notFoundHtml = await notFoundResponse.text();
    const robots = getMetaContent(notFoundHtml, 'name', 'robots').toLowerCase().replace(/\s+/g, '');
    assert(robots === 'noindex,nofollow', `Expected 404 robots to be noindex,nofollow, got ${robots || '(missing)'}`);
    assert(
      !/<script\b[^>]*type=["']module["'][^>]*>/i.test(notFoundHtml),
      'Expected 404 page to be non-hydrated static HTML (module script removed)',
    );

    const localePages = ['/ko', '/es/world-rank', '/pt/income-rank'];

    for (const path of localePages) {
      const response = await request(path);
      assert(response.status === 200, `Expected ${path} to return 200, got ${response.status}`);
      const html = await response.text();
      const { lang, routePath } = splitLocalizedPath(path);
      const expectedLang = lang || 'en';
      const expectedOgLocale = SUPPORTED_LANGUAGES.find((item) => item.code === expectedLang)?.ogLocale || 'en_US';
      const expectedCanonical = `${siteUrl}${path}`;

      const canonical = getCanonicalHref(html);
      assert(canonical === expectedCanonical, `Expected canonical for ${path} to be ${expectedCanonical}, got ${canonical || '(missing)'}`);

      const ogUrl = getMetaContent(html, 'property', 'og:url');
      assert(ogUrl === expectedCanonical, `Expected og:url for ${path} to be ${expectedCanonical}, got ${ogUrl || '(missing)'}`);

      const ogLocale = getMetaContent(html, 'property', 'og:locale');
      assert(ogLocale === expectedOgLocale, `Expected og:locale for ${path} to be ${expectedOgLocale}, got ${ogLocale || '(missing)'}`);

      const ogAlternates = getMetaContents(html, 'property', 'og:locale:alternate').sort();
      const expectedAlternates = SUPPORTED_LANGUAGES
        .filter((item) => item.code !== expectedLang)
        .map((item) => item.ogLocale)
        .sort();
      assert(
        JSON.stringify(ogAlternates) === JSON.stringify(expectedAlternates),
        `Expected og:locale:alternate for ${path} to be [${expectedAlternates.join(', ')}], got [${ogAlternates.join(', ')}]`,
      );

      const hreflangMap = getHreflangMap(html);
      for (const locale of SUPPORTED_LANGUAGES) {
        const expectedHref = `${siteUrl}${buildLocalizedPath(routePath, locale.code)}`;
        const actualHref = hreflangMap.get(locale.code);
        assert(
          actualHref === expectedHref,
          `Expected hreflang ${locale.code} for ${path} to be ${expectedHref}, got ${actualHref || '(missing)'}`,
        );
      }
      const expectedXDefault = `${siteUrl}${buildLocalizedPath(routePath, 'en')}`;
      assert(
        hreflangMap.get('x-default') === expectedXDefault,
        `Expected hreflang x-default for ${path} to be ${expectedXDefault}, got ${hreflangMap.get('x-default') || '(missing)'}`,
      );

      const jsonLd = getJsonLdObjects(html)[0] || null;
      assert(Boolean(jsonLd), `Expected JSON-LD script on ${path}`);
      if (jsonLd) {
        const expectedInLanguage = expectedOgLocale.replace('_', '-');
        assert(
          jsonLd.inLanguage === expectedInLanguage,
          `Expected JSON-LD inLanguage for ${path} to be ${expectedInLanguage}, got ${jsonLd.inLanguage || '(missing)'}`,
        );
      }
    }

    const filterRedirect = await request('/ko/world-rank?gclid=1&score=2.5');
    assert(filterRedirect.status === 301, `Expected gclid URL to return 301, got ${filterRedirect.status}`);
    assert(
      normalizeLocation(filterRedirect.headers.get('location')) === '/ko/world-rank?score=2.5',
      `Expected gclid to be stripped with score preserved, got ${filterRedirect.headers.get('location')}`,
    );

    if (failures.length > 0) {
      console.error('SEO smoke checks failed:');
      for (const failure of failures) {
        console.error(`- ${failure}`);
      }
      process.exitCode = 1;
      return;
    }

    console.log('SEO smoke checks passed.');
  } finally {
    await stopServer(child);
  }
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
