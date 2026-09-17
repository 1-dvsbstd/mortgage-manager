# Mortgage Manager — Offline V1 Release Checklist

The goal of Offline V1 is a polished one-off purchase that works fully without an account, keeps mortgage data on the user's device, and can optionally refresh dated market benchmarks when Online mode is enabled.

## Core experience
- [x] Mortgage balance, payment, rate and projected payoff
- [x] Regular overpayment scenarios and interest/term impact
- [x] One-off / lump-sum overpayments
- [x] Home value, equity and LTV
- [x] Mortgage history and monthly snapshots
- [x] Fixed-deal end planning
- [x] Home-value and next-home planning

## Offline data and ownership
- [x] Local persistence
- [x] First-run setup
- [x] Export backup
- [x] Import / restore backup
- [x] Restore replaces the app dataset cleanly rather than leaving stale Mortgage Manager keys behind
- [x] Reject unsupported/newer backup versions before changing local data
- [x] Clear all local data
- [ ] Complete a backup → clear → restore round-trip on a clean browser profile

## Optional online market mode
- [x] Offline / Online toggle
- [x] Mortgage data remains local; Online mode only fetches benchmark data
- [x] Locally cached market-rate snapshot
- [x] Dated market source shown in the UI
- [x] LTV-aware 2-year and 5-year indicative benchmark projections
- [x] Selectable deal-end planning benchmark
- [x] Graceful cached fallback if fresh data cannot be reached
- [x] Connectivity copy distinguishes fresh online data from saved fallback data
- [x] Commercial benchmark source moved to Bank of England Database data under the UK Open Government Licence
- [x] Legacy Moneyfacts preview cache is discarded automatically
- [x] Source/licensing and attribution approach documented in `MARKET_DATA.md`
- [x] Monthly market-data update cadence documented in `MARKET_DATA.md`

## Onboarding and trust
- [x] Clear first-run setup copy
- [x] On-device privacy messaging
- [x] Indicative-rate / not-an-offer wording in the product
- [x] Add a short Methodology / How calculations work section
- [x] Add clear planning-tool / not-financial-advice wording alongside the methodology
- [ ] Final legal/commercial wording review before sale
- [ ] Review empty states for missing optional inputs

## Offline/PWA architecture
- [x] Service worker registered by the app
- [x] Full current app shell pre-cached
- [x] Market snapshot included in cache
- [x] Cache-busting query strings fall back to cached assets offline
- [x] Old development code that unregistered service workers / deleted caches removed
- [x] Automated Offline V1 service-worker guard included in `npm test`
- [ ] Browser no-network reload verified manually

## Visual and functional QA
- [x] Automated mortgage regression tests passing on the Offline V1 branch
- [x] Automated Offline V1 caching/service-worker checks passing on the Offline V1 branch
- [x] Automated commercial market-source guard included in `npm test`
- [x] Live market cards moved into the visible Upcoming → Rate scenarios section
- [x] Mobile top-bar controls compacted
- [x] Browser QA procedure documented in `RELEASE_QA.md`
- [ ] Desktop Chrome / Edge interaction pass
- [ ] Mobile Safari / Chrome interaction pass
- [ ] Keyboard and focus pass
- [ ] True no-network Offline mode pass
- [ ] Market-feed failure and cached-fallback pass
- [ ] Backup / restore destructive-flow pass

## Sales package
- [ ] Choose the public release name / version
- [ ] Final one-off price
- [ ] Product / landing-page copy
- [ ] Sales screenshots
- [ ] Download / installation instructions
- [ ] FAQ and privacy note
- [ ] Decide distribution channel for first test launch

## Ship blockers
Before Offline V1 is offered for sale, all of these must be complete:
- [ ] Backup round-trip verified in a browser
- [ ] Desktop and mobile smoke tests complete
- [ ] Offline / failed-rate-feed behaviour verified in a browser
- [x] Methodology and core disclaimer copy present in-product
- [ ] Final legal/commercial wording review complete
- [x] Market data source / redistribution wording reviewed and moved to an OGL-reusable source
- [ ] Sales package and install instructions complete
