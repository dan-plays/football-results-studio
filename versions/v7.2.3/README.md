# Football Results Studio v2 — local OBS rehearsal build

**This is an upgrade of the existing local prototype, not an official DexterAI plugin or a live football scores service. All demo scores and fixtures are fictional.**

## Quick start (Windows)

1. Install Node.js 18 or later.
2. Extract this ZIP to a **new folder** (do not overwrite your existing installation yet).
3. Double-click `START-WINDOWS.bat`, and open `http://127.0.0.1:8787/dashboard`.
4. Enter the token printed by the launcher (`local-testing-only-change-me` for local rehearsal only).
5. Click **Load fictional demo fixtures**, then send goals, full-time and other events.
6. Under **Competition priority**, reorder competitions with arrows, tick/untick, and click **Save competition settings**.
7. Open OBS and add `/panels`, `/goal`, `/ticker` as separate Browser Sources; add `/match` if you want to replace the chat region. Do a local recording, **not a live broadcast**, to rehearse.

If port 8787 is already in use, close the old server before starting v2.

## URLs

- `http://127.0.0.1:8787/dashboard` — operator controls
- `http://127.0.0.1:8787/panels` — rotating 6-match scoreboard
- `http://127.0.0.1:8787/goal` — queued goal alerts
- `http://127.0.0.1:8787/ticker` — colour-coded event ticker
- `http://127.0.0.1:8787/match` — selected Match Centre (separate OBS source)
- `http://127.0.0.1:8787/overlay` — combined test overlay
- `http://127.0.0.1:8787/state` — JSON data
- `http://127.0.0.1:8787/events` — server-sent updates

## Competition and display rules

19 competitions are included: UEFA Champions League, Europa League, Conference League, FA Cup, EFL Cup, Premier League, Championship, League One, League Two, EFL Trophy, National League, National League North, National League South, Scottish Premiership, Championship, League One, League Two, Scottish Cup, Scottish League Cup. This order is editable and saved in `state.json` locally. Disabled competitions are hidden from the scoreboard.

- Active and half-time fixtures first, then upcoming fixtures, in six-match pages by competition.
- Full-time fixtures go to the final mixed **Earlier Results** pages with their original competition colours.
- Empty competitions are skipped.
- Explicit goal events trigger queued alerts; score changes alone do not imply a goal.
- A full-time event enters the ticker immediately; its match moves to Earlier Results.
- Match Centre shows score and verified events from the current feed; **no invented possession, xG, lineups or season tallies**.
- Goal and ticker alerts work across enabled fixtures independently of the current page.

## What remains before a genuine EFL Cup live broadcast

**Not implemented:** licensed real-time football provider and event adapter; verified live scorer tallies, lineups, xG; direct DexterAI API/plugin integration; automatic OBS chat-source switching; Stream Deck integration. Those require provider details, permissions and/or DexterAI developer documentation. The `/match` source can be manually toggled with OBS or mapped to a Stream Deck action later.

**Security:** binds to localhost by default. Ingest requires `INGEST_TOKEN`. Default rehearsal token is insecure and should be changed for any production use. Never expose this local service directly to the internet.

Run `npm test` for the automated checks.


## Historical Saturday replay (17 October 2026)
Open `/dashboard`, enter your ingest token and click **Start 120-second replay**. The app loads sourced final scores for selected English/Scottish fixtures and six verified 12:30 results. Each second advances the match clock one minute up to 90, then holds completed results for 30 seconds. Four goals from Middlesbrough–Cardiff have verified scorer/minute and produce real timed goal alerts; other final scores are applied at 90 minutes **without invented scorer times**. The event clock is simulated and half-time at 45 seconds is illustrative, not an accurate wall-clock recreation. `kickoffVerified:false` marks matches whose 15:00 kickoff time was not individually confirmed, and the dataset is **not exhaustive** (especially National League and FA Cup qualifying). Source links and provenance are in `replay-2026-10-17.json`. To capture, start OBS recording just before clicking Start Replay.

## v4 OBS replay updates
- Six full-width fixture rows per competition page.
- Goal ticker is a stationary FOOTBALL LIVE bar; incoming events rise into place and queue for 2.8 seconds each, rather than marquee scrolling.
- Five verified Manchester City 3–2 Ipswich goals (19, 21, 34, 69, 90) added from official Manchester City and Sky Sports match reports.
- Replay Reset clears old scores/events and shows 15:00 games as NS (not started) until Start.
- Other fixtures with no verified individual goal minutes still reconcile to confirmed final scores at 90; no fake scorer alerts are generated.
- IMPORTANT: if the ticker is a separate OBS source, reload the browser source after updating.

## v5 historical replay improvements
The 17 October replay includes additional verified goals and red cards from the Premier League and Championship. Red cards appear in both the goal/incident alert source and rising ticker, without modifying the score. 12:30 fixtures are kept as earlier results. Incident minutes 90+2 and 90+4 are played at elapsed replay seconds 92 and 94. Full-time reconciliation occurs at second 100 to allow stoppage-time events. Not every goal in all 57 fixtures has a verified time; missing events are not invented.


## v6 layout
The ticker source now displays four persistent rows, BBC Final Score/Soccer Saturday-inspired. It queues events at 1.05-second intervals, keeping the most recent four. Scoreboard has six full-width rows. Use SETUP-V6.txt for instructions. Historical replay incident coverage is incomplete.


## v6.1 ticker update
The `/ticker` Browser Source is now a full-width lower-third with compact competition tags and four readable lines. Read `SETUP-V6-1.txt` for OBS canvas sizing and crop removal.


## v6.2: Match your DexterAI and Sports Score Bot colours

Dashboard → **Theme & colours**. Choose a starting preset, edit six global colours and optionally each competition colour. Click **Save theme & competition colours**. Changes are persisted in `state.json` and pushed to open OBS browser sources through the existing event stream. The presets are approximations, not colours extracted from your OBS setup; use the colour pickers for an exact match. Keep your browser sources at their existing URLs.

## v6.3 — theme based on user OBS recordings
The default DexterAI preset has been updated to approximate the supplied OBS recordings: plum/navy panels, warm copper/red outlines and lime status labels. Use Theme & colours on the dashboard to save the preset and edit every colour. Existing installations with previously saved themes must select and save the updated preset.

### v6.3 Hex Edition
Every theme and competition colour now has a direct editable #RRGGBB field alongside its colour picker. Changes preview immediately and are saved with the existing Save theme button.
