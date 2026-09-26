# Mortgage Manager — Design Consolidation Checklist

This checklist tracks the consolidation and final visual-polish pass on the `design-consolidation` branch.

## Guardrails
- [x] Work on a separate branch from `main`
- [x] Treat current `main` as the visual reference
- [x] No feature changes during consolidation
- [x] No calculation/storage/model rewrites as part of the visual pass
- [ ] Preserve current behaviour on Current / Upcoming / Future / Setup & data
- [x] Run regression tests before merge (GitHub Actions passed on draft consolidation PR)
- [x] Regression tests updated for retired V15/expandable assets

## 1. Design foundations
- [x] Create one authoritative design-token file
- [x] Move the current light palette out of the V15 patch layer
- [x] Replace repeated core surface/text/accent colours with tokens
- [ ] Continue replacing one-off page colours as components are consolidated
- [x] Remove competing global palette overrides from legacy/V15 layers
- [x] Define final spacing scale
- [x] Define final typography scale
- [x] Define final radius scale
- [x] Define final shadow/elevation scale
- [x] Define interaction/focus tokens
- [x] Define chart data-visualisation palette

## 2. Global shell
- [x] Consolidate page background and app-shell rules
- [x] Warm scrollbar ownership restored; legacy green premium override removed
- [x] Chromium scrollbar-color legacy override removed
- [x] Consolidate top bar / brand / version / save-state styling
- [x] Consolidate Current / Upcoming / Future navigation
- [ ] Verify desktop header alignment
- [ ] Verify mobile header alignment

## 3. Shared components
- [ ] Consolidate primary / secondary / ghost / icon buttons
- [ ] Consolidate chips and segmented controls (Current trajectory controls consolidated)
- [ ] Consolidate card surfaces (Current journey consolidated)
- [ ] Consolidate inset tiles / metric blocks (Current summary tiles consolidated)
- [ ] Consolidate labels, eyebrows and metadata
- [x] Consolidate Setup form inputs and select controls
- [x] Browser autofill matches Setup field styling
- [x] Focused/selected Setup text stays dark on light fields
- [ ] Consolidate non-Setup form controls
- [x] Consolidate disclosure chevrons into one app-wide icon system
- [x] Consolidate Setup modal/backdrop shell
- [ ] Consolidate remaining non-Setup modal/backdrop controls
- [x] Start removing obsolete duplicate component rules
- [ ] Continue duplicate-rule removal component by component
- [x] Runtime UI styles moved out of JS injection into static CSS
- [x] Final Offline V1 polish styles moved out of V15.15 JS injection

## 4. Current
- [x] Current premium pass applied using Ink & Parchment
- [x] Current hero flex regression fixed; quick-edit row restored beneath hero story
- [x] Mortgage-free progress simplified to single equity colour
- [x] Hero display serif restrained for large-format readability
- [x] Current mortgage journey rebuilt with centred milestones and clearer spacing
- [x] Hero layout and typography
- [ ] Replace homepage house artwork with premium new image
- [x] Mortgage progress block
- [x] Metric strip
- [ ] Overpayment controls
- [x] Home/equity presentation
- [x] Trajectory card and controls
- [x] Current-page responsive rules
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
- [x] First automatic Setup open uses the same three-tab flow
- [x] Remove redundant first-run setup note entirely
- [ ] Mortgage/property inputs
- [x] Restore numeric borrowing multiple and collapsible Next-home assumptions section
- [x] Flatten nested Home profile field boxes
- [ ] Backup/restore/reset controls
- [x] Methodology/help panel belongs to Upcoming Setup tab only
- [x] Setup modal width/history-row geometry consolidated
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
- [x] Fold `layout-finalize.css` into final page refinement layer preserving cascade
- [x] Fold legacy `layout-qa.css` into `layout-finalize.css` preserving cascade
- [x] Retire all standalone V15 CSS patch files into authoritative/page refinement owners
- [x] Fold `premium.css` into adjacent component layer preserving cascade
- [ ] Move surviving rules to authoritative component/page files (v15.11 and v15.12 fully redistributed)
- [ ] Remove redundant `!important` declarations where safe
- [x] Remove superseded standalone V15 stylesheet files
- [x] Remove superseded/no-op scripts (expandable-card and V15.14 loader)
- [ ] Remove dead selectors/styles (expansion remnants, runtime expanded-state CSS and superseded global shell/theme declarations removed)
- [x] Remove retired expansion work from surviving V15.11 runtime
- [x] Reduce active stylesheet count only after component ownership is validated
- [ ] Continue pruning duplicate/obsolete rules in isolated source stylesheets
- [x] Asset integrity check: no missing index/service-worker assets after consolidation
- [x] Delete superseded source stylesheets only after component-by-component validation

## 10. Optional colour themes
- [x] Keep consolidation token-based so multiple themes remain possible
- [x] Design 3 curated themes after core consolidation — Parchment (default), Warm and Dusk
- [ ] Ensure every theme preserves semantic colours and accessibility contrast
- [x] Add a local theme selector in Setup & data
- [x] Persist chosen theme on-device
- [ ] Verify charts, controls, focus states and illustrations in every theme

- [x] Slate/blue direction dropped after visual review

## 11. Final premium polish
- [x] Premium visual-system comparison lab created (4 palette directions, shared type/spacing/radius/shadow/focus system)
- [x] Ink & Parchment applied as the premium foundation
- [x] Review palette after consolidation — Ink & Parchment selected
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


## Parked post-consolidation product notes
- [ ] Upgrade native select/dropdown presentation for a more premium menu treatment
- [ ] Recent valuation / estimate should store and display its valuation date
