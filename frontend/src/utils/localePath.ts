export const SUPPORTED_LANGUAGE_CODES = ['en', 'ko', 'es', 'pt'] as const;

export type SupportedLanguageCode = (typeof SUPPORTED_LANGUAGE_CODES)[number];

export function isSupportedLanguageCode(value: string | null | undefined): value is SupportedLanguageCode {
  if (!value) return false;
  return SUPPORTED_LANGUAGE_CODES.includes(value.toLowerCase() as SupportedLanguageCode);
}

function normalizePathname(pathname: string) {
  let normalized = pathname || '/';
  if (!normalized.startsWith('/')) normalized = `/${normalized}`;
  if (normalized.length > 1 && normalized.endsWith('/')) {
    normalized = normalized.slice(0, -1);
  }
  return normalized;
}

export function splitLocalizedPath(pathname: string) {
  const normalized = normalizePathname(pathname);
  const segments = normalized.split('/').filter(Boolean);
  if (segments.length === 0) {
    return { lang: null, path: '/' as const };
  }
  const [first, ...rest] = segments;
  const langCandidate = first.toLowerCase();
  if (!isSupportedLanguageCode(langCandidate)) {
    return { lang: null, path: normalized };
  }
  const strippedPath = rest.length === 0 ? '/' : `/${rest.join('/')}`;
  return { lang: langCandidate, path: normalizePathname(strippedPath) };
}

export function buildLocalizedPath(pathname: string, language: string | null | undefined) {
  const normalizedPath = normalizePathname(pathname);
  if (normalizedPath === '/admin') return '/admin';
  const normalizedLang = language?.toLowerCase() || 'en';
  const lang = isSupportedLanguageCode(normalizedLang) ? normalizedLang : 'en';
  return normalizedPath === '/' ? `/${lang}` : `/${lang}${normalizedPath}`;
}
