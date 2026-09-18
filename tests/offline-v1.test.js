const assert = require('node:assert/strict');
const fs = require('node:fs');

const index = fs.readFileSync('index.html', 'utf8');
const sw = fs.readFileSync('sw.js', 'utf8');
const market = JSON.parse(fs.readFileSync('public/market-rates.json', 'utf8'));
const polish = fs.readFileSync('src/v15.15.js', 'utf8');
const finalPolish = fs.readFileSync('src/offline-v1-final.js', 'utf8');
const finalStyle = fs.readFileSync('src/offline-v1-final.css', 'utf8');
const journeyStyle = fs.readFileSync('src/v15-polish.css', 'utf8');
const journeyScript = fs.readFileSync('src/v15-polish.js', 'utf8');
const legacyHoverStyle = fs.readFileSync('src/v15.11.css', 'utf8');
const refreshScript = fs.readFileSync('src/v15-refresh.js', 'utf8');
const pageRefine = fs.readFileSync('src/page-refine.js', 'utf8');
const futureCardsStyle = fs.readFileSync('src/v15.10.css', 'utf8');
const expandable = fs.readFileSync('src/expandable-cards.js', 'utf8');
const launcher = fs.readFileSync('launch.ps1', 'utf8');

assert.match(index, /navigator\.serviceWorker\.register\('\.\/sw\.js'\)/, 'Offline V1 should register its service worker');
assert.match(index, /isHostedPreview/, 'Hosted preview should explicitly bypass the offline cache');
assert.match(index, /serviceWorker\.getRegistrations\(\)/, 'Hosted preview should unregister stale preview workers');
assert.match(index, /caches\.keys\(\)/, 'Hosted preview should clear stale preview caches');

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
assert.match(index, /offline-v1-final\.css\?v=01527/, 'Final UI stylesheet should be loaded directly after legacy layers');
assert.match(index, /offline-v1-final\.js\?v=01527/, 'Final UI script should be loaded directly after legacy layers');
assert.match(finalPolish, /V0\.15\.26/, 'Final UI should expose the current visible build marker');
assert.match(finalPolish, /wireMonthPicker/, 'Final UI should provide the custom month/year picker');
assert.match(finalPolish, /undefined\|nan/i, 'Final UI layer should guard invalid LTV milestones');
assert.match(finalStyle, /grid-template-columns:repeat\(4/, 'Current summary should use a compact four-column desktop grid');

assert.doesNotMatch(index, /expandable-cards\.css/, 'Abandoned expandable-card stylesheet must not ship');
assert.doesNotMatch(index, /v15\.14\.js/, 'Retired v15.14 loader must not ship');
assert.doesNotMatch(sw, /expandable-cards\.js|expandable-cards\.css|v15\.14\.js/, 'Offline shell must not cache retired UI assets');
assert.doesNotMatch(polish, /document\.createElement\('style'\)/, 'v15.15 must not inject a stylesheet after the final CSS');
assert.doesNotMatch(polish, /applyMarketChoice|MARKET_CHOICE_KEY/, 'Market benchmarks must stay read-only');
assert.doesNotMatch(legacyHoverStyle, /premium hover lift across the product|v15-current-journey:hover/, 'Legacy blanket hover lift must stay retired');
assert.match(journeyStyle, /\.v15-current-journey\{[\s\S]*box-shadow:none/, 'Visible Current journey should be flat inside its parent card');
assert.match(journeyScript, /v15-current-journey-line/, 'Current journey should render an explicit connecting track');
assert.match(journeyStyle, /\.v15-current-journey-line\{[^}]*right:calc\(20% - 24px\)/, 'Current journey track should end at the final milestone centre');
assert.doesNotMatch(journeyScript, /\[250,700,1200\]|setTimeout\(run, 80\)/, 'Current journey should not use delayed rerender loops');
assert.doesNotMatch(refreshScript, /function renderJourney\(/, 'Hidden duplicate Upcoming journey renderer must stay removed');
assert.match(pageRefine, /next-home-subhead[^\n]*remove\(\)/, 'Future split layout should remove the duplicate inner heading');
assert.match(futureCardsStyle, /#futureWaitPlanner \.next-home-timeline-rows\{[\s\S]*gap:12px!important/, 'Future timeline should use gaps between separate cards');
assert.match(futureCardsStyle, /#futureWaitPlanner \.next-home-timeline-row\{[\s\S]*border-radius:17px!important[\s\S]*box-shadow:0 10px 28px/, 'Future timeline rows should remain individual raised cards');
assert.match(finalStyle, /body \[hidden\]\{display:none!important\}/, 'Semantic hidden state must override legacy display rules');
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
