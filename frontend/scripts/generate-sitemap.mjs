import { writeFileSync } from 'fs';
import { join } from 'path';

const siteUrl = process.env.SITE_URL || 'https://awesomerank.com';
const lastmod = new Date().toISOString().slice(0, 10);

const languages = ['en', 'ko', 'es', 'pt'];
const routes = [
  { path: '/', changefreq: 'weekly', priority: '1.0' },
  { path: '/world-rank', changefreq: 'weekly', priority: '0.9' },
  { path: '/income-rank', changefreq: 'weekly', priority: '0.9' },
  { path: '/country-compare', changefreq: 'weekly', priority: '0.8' },
  { path: '/global-stats', changefreq: 'weekly', priority: '0.8' },
  { path: '/privacy', changefreq: 'yearly', priority: '0.3' },
];
const defaultLanguage = 'en';

function localizedPath(routePath, lang) {
  return routePath === '/' ? `/${lang}` : `/${lang}${routePath}`;
}

const lines = [];
lines.push('<?xml version="1.0" encoding="UTF-8"?>');
lines.push('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"');
lines.push('        xmlns:xhtml="http://www.w3.org/1999/xhtml">');

for (const route of routes) {
  const loc = `${siteUrl}${localizedPath(route.path, defaultLanguage)}`;
  lines.push('  <url>');
  lines.push(`    <loc>${loc}</loc>`);
  lines.push(`    <lastmod>${lastmod}</lastmod>`);
  lines.push(`    <changefreq>${route.changefreq}</changefreq>`);
  lines.push(`    <priority>${route.priority}</priority>`);
  for (const lang of languages) {
    const href = `${siteUrl}${localizedPath(route.path, lang)}`;
    lines.push(`    <xhtml:link rel="alternate" hreflang="${lang}" href="${href}"/>`);
  }
  const xDefault = `${siteUrl}${localizedPath(route.path, defaultLanguage)}`;
  lines.push(`    <xhtml:link rel="alternate" hreflang="x-default" href="${xDefault}"/>`);
  lines.push('  </url>');
}

lines.push('</urlset>');

const outputPath = join(process.cwd(), 'public', 'sitemap.xml');
writeFileSync(outputPath, `${lines.join('\n')}\n`, 'utf-8');

console.log(`Sitemap generated at ${outputPath}`);
