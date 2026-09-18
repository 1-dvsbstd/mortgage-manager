const assert = require('node:assert/strict');
const fs = require('node:fs');

const index = fs.readFileSync('index.html', 'utf8');
const sw = fs.readFileSync('sw.js', 'utf8');
const market = JSON.parse(fs.readFileSync('public/market-rates.json', 'utf8'));
const polish = fs.readFileSync('src/v15.15.js', 'utf8');
const finalPolish = fs.readFileSync('src/offline-v1-final.js', 'utf8');
const finalStyle = fs.readFileSync('src/offline-v1-final.css', 'utf8');
const expandable = fs.readFileSync('src/expandable-cards.js', 'utf8');
const launcher = fs.readFileSync('launch.ps1', 'utf8');

assert.match(index, /navigator\.serviceWorker\.register\('\.\/sw\.js'\)/, 'Offline V1 should register its service worker');
assert.doesNotMatch(index, /serviceWorker\.getRegistrations\(\).*unregister/s, 'The app must not unregister service workers on load');
assert.doesNotMatch(index, /caches\.keys\(\).*caches\.delete/s, 'The app must not clear all caches on load');

[
  './index.html',
  './public/home-editorial.svg',
  './public/market-rates.json',
  './src/app-runtime.js',
  './src/app-navigation.js',
  './src/v15.15.js',
  './src/offline-v1-final.css',
  './src/offline-v1-final.js'
].forEach((asset) => {
  assert.ok(sw.includes(`'${asset}'`), `Service worker app shell is missing ${asset}`);
});

assert.match(sw, /ignoreSearch:\s*true/, 'Offline fallback should tolerate cache-busting query strings');
assert.match(sw, /cache:'no-store'/, 'Service worker should bypass ordinary browser cache while online');
assert.match(index, /offline-v1-final\.css\?v=01522/, 'Final UI stylesheet should be loaded directly after legacy layers');
assert.match(index, /offline-v1-final\.js\?v=01522/, 'Final UI script should be loaded directly after legacy layers');
assert.match(finalPolish, /V0\.15\.21/, 'Final UI should expose the current visible build marker');
assert.match(finalPolish, /wireMonthPicker/, 'Final UI should provide the custom month/year picker');
assert.match(finalPolish, /undefined\|nan/i, 'Final UI layer should guard invalid LTV milestones');
assert.match(finalStyle, /grid-template-columns:repeat\(4/, 'Current summary should use a compact four-column desktop grid');
assert.doesNotMatch(expandable, /openCard\(/, 'Legacy expandable-card runtime must remain inert');
assert.match(launcher, /Cache-Control: no-store, no-cache/, 'Windows launcher should prevent stale browser shell caching');
assert.match(launcher, /Serving from:/, 'Windows launcher should show which folder is actually being served');

assert.equal(market.schema, 2, 'Commercial market feed should use the current schema');
assert.equal(market.source, 'Bank of England Database', 'Bundled benchmarks should use the Bank of England source');
assert.equal(market.licence, 'UK Open Government Licence', 'Bundled benchmarks should record their reuse licence');
assert.ok(Array.isArray(market.bands) && market.bands.length >= 2, 'Market feed should include benchmark bands');
assert.doesNotMatch(JSON.stringify(market), /Moneyfacts/i, 'Bundled commercial market data must not contain Moneyfacts data or branding');
assert.match(polish, /migrateLegacyMarketCache/, 'Old preview market caches should be migrated away');

console.log('Offline V1 service-worker, final-polish, stale-shell and market-source checks passed');
