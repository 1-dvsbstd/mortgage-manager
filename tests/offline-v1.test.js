const assert = require('node:assert/strict');
const fs = require('node:fs');

const index = fs.readFileSync('index.html', 'utf8');
const sw = fs.readFileSync('sw.js', 'utf8');
const market = JSON.parse(fs.readFileSync('public/market-rates.json', 'utf8'));
const polish = fs.readFileSync('src/v15.15.js', 'utf8');

assert.match(index, /navigator\.serviceWorker\.register\('\.\/sw\.js'\)/, 'Offline V1 should register its service worker');
assert.doesNotMatch(index, /serviceWorker\.getRegistrations\(\).*unregister/s, 'The app must not unregister service workers on load');
assert.doesNotMatch(index, /caches\.keys\(\).*caches\.delete/s, 'The app must not clear all caches on load');

[
  './index.html',
  './public/market-rates.json',
  './src/app-runtime.js',
  './src/app-navigation.js',
  './src/v15.15.js'
].forEach((asset) => {
  assert.ok(sw.includes(`'${asset}'`), `Service worker app shell is missing ${asset}`);
});

assert.match(sw, /ignoreSearch:\s*true/, 'Offline fallback should tolerate cache-busting query strings');

assert.equal(market.schema, 2, 'Commercial market feed should use the current schema');
assert.equal(market.source, 'Bank of England Database', 'Bundled benchmarks should use the Bank of England source');
assert.equal(market.licence, 'UK Open Government Licence', 'Bundled benchmarks should record their reuse licence');
assert.ok(Array.isArray(market.bands) && market.bands.length >= 2, 'Market feed should include benchmark bands');
assert.doesNotMatch(JSON.stringify(market), /Moneyfacts/i, 'Bundled commercial market data must not contain Moneyfacts data or branding');
assert.match(polish, /migrateLegacyMarketCache/, 'Old preview market caches should be migrated away');

console.log('Offline V1 service-worker and market-source checks passed');
