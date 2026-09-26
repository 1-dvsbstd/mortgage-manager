# Mortgage Manager — Design Consolidation Checklist

This checklist tracks the consolidation and final visual-polish pass on the `design-consolidation` branch.

## Guardrails
- [x] Work on a separate branch from `main`
- [x] Treat current `main` as the visual reference
- [x] No feature changes during consolidation
- [x] No calculation/storage/model rewrites as part of the visual pass
- [ ] Preserve current behaviour on Current / Upcoming / Future / Setup & data
- [ ] Run regression tests before merge

## 1. Design foundations
- [x] Create one authoritative design-token file
- [x] Move the current light palette out of the V15 patch layer
- [x] Replace repeated core surface/text/accent colours with tokens
- [ ] Continue replacing one-off page colours as components are consolidated
- [x] Remove competing global palette overrides from legacy/V15 layers
- [ ] Define final spacing scale
- [ ] Define final typography scale
- [ ] Define final radius scale
- [ ] Define final shadow/elevation scale
- [ ] Define interaction/focus tokens
- [ ] Define chart data-visualisation palette

## 2. Global shell
- [ ] Consolidate page background and app-shell rules
- [ ] Consolidate top bar / brand / version / save-state styling
- [ ] Consolidate Current / Upcoming / Future navigation
- [ ] Verify desktop header alignment
- [ ] Verify mobile header alignment

## 3. Shared components
- [ ] Consolidate primary / secondary / ghost / icon buttons
- [ ] Consolidate chips and segmented controls (Current trajectory controls consolidated)
- [ ] Consolidate card surfaces (Current journey consolidated)
- [ ] Consolidate inset tiles / metric blocks (Current summary tiles consolidated)
- [ ] Consolidate labels, eyebrows and metadata
- [x] Consolidate Setup form inputs and select controls
- [ ] Consolidate non-Setup form controls
- [x] Consolidate disclosure chevrons into one app-wide icon system
- [x] Consolidate Setup modal/backdrop shell
- [ ] Consolidate remaining non-Setup modal/backdrop controls
- [x] Start removing obsolete duplicate component rules
- [ ] Continue duplicate-rule removal component by component

## 4. Current
- [ ] Hero layout and typography
- [ ] Replace homepage house artwork with premium new image
- [ ] Mortgage progress block
- [ ] Metric strip
- [ ] Overpayment controls
- [ ] Home/equity presentation
- [ ] Trajectory card and controls
- [ ] Current-page responsive rules
- [ ] Visual check by Nathan

## 5. Upcoming
- [ ] Section/card spacing
- [x] Consolidate Upcoming rate/summary/current-fix card surface ownership into `v15.4.css`
- [x] Upcoming deal-end position spacing/surfaces consolidated
- [ ] Deal-end position final polish
- [ ] Milestone/timeline treatment
- [ ] Rate scenario cards
- [ ] Payment/interest hierarchy
- [ ] Upcoming responsive rules
- [ ] Visual check by Nathan

## 6. Future
- [x] Cost comparison bars update immediately with overpayment changes
- [x] Consolidate Future planning/overpayment control styling
- [ ] Planning/overpayment strip visual polish
- [ ] Property-value card
- [ ] Forecast timeline
- [ ] Looking-ahead / next-home sections
- [x] Remove duplicate Future forecast/timeline implementations
- [x] Restore retained Looking Ahead shell and typography after duplicate cleanup
- [x] Future looking-ahead timeline surface ownership moved to final page rules
- [x] Future floating summary/range tiles consolidated
- [ ] Cost/value presentation
- [ ] Future responsive rules
- [ ] Visual check by Nathan

## 7. Setup & data
- [x] Setup navigation/tabs
- [x] Remove redundant first-run setup note entirely
- [ ] Mortgage/property inputs
- [x] Restore numeric borrowing multiple and collapsible Next-home assumptions section
- [x] Flatten nested Home profile field boxes
- [ ] Backup/restore/reset controls
- [ ] Methodology/help panels
- [ ] Modal and close-state consistency
- [ ] Setup responsive rules
- [ ] Visual check by Nathan

## 8. Charts
- [x] Create one Current trajectory chart-surface owner
- [ ] Standardise chart heading treatment
- [ ] Standardise axes and tick typography
- [ ] Reduce grid-line visual weight
- [ ] Standardise line widths and area fills
- [ ] Standardise rounded bars
- [ ] Standardise legends (Current trajectory consolidated)
- [ ] Apply semantic data colours consistently
- [ ] Review Current trajectory chart
- [ ] Review Future charts
- [ ] Visual check by Nathan

## 9. Legacy cleanup
- [x] Map/retire legacy theme rules in `layout-finalize.css`
- [x] Map legacy `layout-qa.css` colours onto shared tokens
- [ ] Map selectors in V15 patch files (Current trajectory + Upcoming card ownership consolidated)
- [x] Retire legacy global theme declarations from `premium.css`
- [ ] Move surviving rules to authoritative component/page files
- [ ] Remove redundant `!important` declarations where safe
- [ ] Remove superseded V15 stylesheet files (started: retired v15.10 removed)
- [ ] Remove superseded V15 script files where safe
- [ ] Remove dead selectors/styles
- [x] Reduce active stylesheet stack to five logical bundles
- [ ] Prune duplicate/obsolete rules inside the consolidated bundles
- [ ] Delete superseded source stylesheets after visual validation

## 10. Optional colour themes
- [x] Keep consolidation token-based so multiple themes remain possible
- [ ] Design 3–4 complete colour palettes after core consolidation
- [ ] Ensure every theme preserves semantic colours and accessibility contrast
- [ ] Add a local theme selector in Setup & data
- [ ] Persist chosen theme on-device
- [ ] Verify charts, controls, focus states and illustrations in every theme

## 11. Final premium polish
- [ ] Review palette after consolidation
- [ ] Review typography hierarchy
- [ ] Review whitespace/rhythm
- [ ] Review microcopy prominence
- [ ] Review hover/focus/pressed motion
- [ ] Review shadows/borders for modern feel
- [ ] Cross-page consistency check
- [ ] Final visual approval by Nathan

## 12. Release QA
- [ ] Desktop Chrome
- [ ] Desktop Edge
- [ ] Mobile Chrome
- [ ] Mobile Safari
- [ ] Keyboard/focus
- [ ] Offline reload
- [ ] Rate-feed cached fallback
- [ ] Backup → clear → restore
- [ ] `npm test`
- [ ] Merge only after visual approval
