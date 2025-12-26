import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { countries } = require('country-data');

const __dirname = dirname(fileURLToPath(import.meta.url));
const outputPath = resolve(__dirname, '../src/data/countryCurrency.json');

const entries = countries.all
  .filter((entry) => entry.alpha2 && entry.status === 'assigned')
  .map((entry) => ({
    code: entry.alpha2,
    iso3: entry.alpha3,
    name: entry.name,
    currency: entry.currencies?.[0] ?? null,
  }))
  .sort((a, b) => a.name.localeCompare(b.name, 'en'));

writeFileSync(outputPath, `${JSON.stringify(entries, null, 2)}\n`, 'utf-8');
console.log(`Wrote ${entries.length} entries to ${outputPath}`);
