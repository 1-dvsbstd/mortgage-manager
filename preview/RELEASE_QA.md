# Offline V1 — Browser Release QA

Use this on the `offline-v1-foundation` branch before merging or selling the app.

## 1. Update and launch

```powershell
cd C:\mortgage-manager-offline-v1
git pull
py -m http.server 8000
```

Open `http://localhost:8000` in Chrome or Edge.

## 2. Normal-use smoke test

- Confirm Current, Upcoming and Future views all open.
- Edit balance, payment, rate, fixed-rate end and home value.
- Change the regular overpayment scenario.
- Add a one-off overpayment.
- Open Setup & data and confirm the saved values are present.
- Open How calculations work and confirm the methodology/disclaimer is readable.

## 3. Backup → clear → restore

1. In Setup & data, export a backup.
2. Note a few values that are easy to recognise (balance, payment, home value and an overpayment/history entry).
3. Choose **Clear all local data** and confirm.
4. Allow the app to reload and confirm it returns to first-run/default state.
5. Open Setup & data → Backup & restore → Restore backup.
6. Confirm the warning says the restore will replace current Mortgage Manager data.
7. Restore the exported JSON and allow the app to reload.
8. Confirm the noted values, history and overpayments are back.

PASS: restored state matches the exported state and no stale post-export Mortgage Manager data remains.

## 4. Offline app-shell test

The service worker needs one successful online load before this test.

1. Load the app normally and wait a few seconds.
2. Refresh once so the current service worker is controlling the page.
3. Open DevTools → Application → Service Workers and confirm `sw.js` is registered/activated.
4. In DevTools → Network, select **Offline**.
5. Refresh `http://localhost:8000`.
6. Move between Current, Upcoming and Future and edit a local mortgage value.

PASS: the app reloads and its local planning features continue to work without network access.

## 5. Online-rate fallback test

Before going offline, enable Online mode once so a benchmark snapshot is saved locally.

1. Return DevTools → Network to Online.
2. Toggle Mortgage Manager to **Online** and let the market rates load.
3. Switch DevTools → Network to **Offline**.
4. Refresh the app.
5. Check Upcoming → Rate scenarios.

PASS: the saved benchmark remains visible and the connectivity copy indicates that fresh online data is unavailable / saved data is being used rather than pretending a refresh succeeded.

## 6. No-cache first-offline behaviour

Use a new Incognito/InPrivate window or clear site storage.

1. Ensure DevTools network is Offline before the app has had a successful load.
2. Navigate to the local URL.

EXPECTED: there is no promise that a never-loaded web app can bootstrap from the network while disconnected. Offline support applies after the app shell has been loaded/cached once (or when distributed as a self-contained offline package).

## 7. Keyboard/focus pass

- Tab through the top Offline/Online switch and Setup & data control.
- Use Space/Enter on the connectivity switch.
- In Upcoming, tab to each live-rate choice and select it with Enter/Space.
- Open/close Setup & data by keyboard and press Escape to close it.
- Confirm focus indicators are visible and no keyboard action traps focus.

## 8. Mobile-width pass

In Chrome/Edge DevTools device emulation, check roughly 390 × 844 and 430 × 932.

- Header does not overflow.
- Bottom navigation remains usable.
- Online/offline control and Setup & data are not clipped.
- Current, Upcoming and Future cards do not horizontally scroll.
- Rate cards stack cleanly.
- Setup & data sections remain readable and tappable.

## Release result

Only mark the browser QA items in `OFFLINE_V1.md` complete after actually running the relevant steps above. Automated tests protect the calculation and offline architecture, but they do not replace this browser pass.
