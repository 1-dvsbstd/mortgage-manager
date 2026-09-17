const assert = require('node:assert/strict');
const fs = require('node:fs');

const index = fs.readFileSync('index.html', 'utf8');
const sw = fs.readFileSync('sw.js', 'utf8');

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

console.log('Offline V1 service-worker checks passed');
