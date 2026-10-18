# Football Results Studio — standalone + DexterAI developer package

**Status:** working local prototype, not an official DexterAI plugin, not a live-score data subscription, and not a finished signed Windows executable. Everything in the demo is fictional. Software code is MIT-licensed; it does not grant rights to external football data, team badges or third-party graphics.

## Start on Windows

1. Install **Node.js 18+** from https://nodejs.org/ (Node.js LTS recommended).
2. Unzip this folder and double-click **START-WINDOWS.bat**. It launches `http://127.0.0.1:8787/dashboard`.
3. In the dashboard enter the demo token **`local-testing-only-change-me`**. This token is only for private local testing. To use a secure token, launch from PowerShell:

   ```powershell
   $env:INGEST_TOKEN="choose-a-long-random-secret"
   node server.js
   ```

4. Click **Load fictional demo fixtures**, then **Send event** or **Simulate three quick goals**.
5. Click the overlay links to see the graphics. Add one or more URLs as OBS Browser Sources (1920×1080). The background is transparent.

No npm install is required. On macOS/Linux: `INGEST_TOKEN='a-secret' node server.js`.

## OBS sources (independent so your existing DexterAI layout stays unchanged)

- `http://127.0.0.1:8787/overlay` — all three modules
- `http://127.0.0.1:8787/panels` — six rotating score panels
- `http://127.0.0.1:8787/goal` — large goal alerts only
- `http://127.0.0.1:8787/ticker` — continuous horizontal ticker only
- `http://127.0.0.1:8787/dashboard` — local test/control dashboard, **not** for broadcast

Use `/overlay?rotate=10000&alert=8000` to override milliseconds. The layout CSS is intentionally a placeholder: the developers should hook the event stream into **your current DexterAI visual design** rather than replace your design with the included graphics. The separate module URLs allow OBS positioning and sizing without changing the backend.

## Developer interface

`GET /state`: current fixtures, history, settings and competition names.

`GET /events`: server-sent events (SSE), starting with `type:"state"`; subsequently `type:"fixtures"`, `type:"event"`, `type:"settings"`. Subscribe with `EventSource('http://127.0.0.1:8787/events')` when running on the same origin. A different origin needs a same-origin proxy or a securely configured bridge (no permissive CORS by default).

`POST /ingest`: JSON `{ "type": "fixtures"|"event"|"settings"|"clear", "data": ... }` with header `x-ingest-token: YOUR_SECRET`. Never put this secret in overlay/browser source URLs or public JavaScript.

Fixture example:

```json
{"id":"provider:match-123","competition":"PL","home":"Hull City","away":"Fulham","homeScore":0,"awayScore":1,"status":"LIVE","minute":67,"kickoff":"2026-10-17T15:00:00+01:00"}
```

Goal example:

```json
{"eventId":"provider:goal-123","kind":"goal","fixtureId":"provider:match-123","team":"Hull City","scorer":"Example Player","minute":"68","homeScore":1,"awayScore":1}
```

Supported competition codes in rotation order: `PL`, `CH`, `L1`, `L2`, `FAC`, `EFLC`, `UCL`. Only competitions with fixtures are shown; 6 fixtures per page. Supported events: `goal`, `red_card`, `half_time`, `full_time`, `var`, `info`, `kickoff`, `correction`. Goal alerts are queued and pause score rotation. Event IDs are deduplicated and recent history persists in `state.json` (created at runtime). A goal is **only** announced when an explicit goal event arrives: a score correction alone never triggers an alert. Simultaneous goals appear in sequence.

The ticker uses the event history and does not depend on Sports Score Bot, Twitch chat or DexterAI chat. If a provider does not supply scorer/minute, omit those optional fields.

### Live provider adapter (not bundled)

The provider integration should: (1) fetch fixtures for the selected UK local calendar day, (2) map its competition identifiers to the codes above, (3) normalise match scores/statuses and send a complete `fixtures` array, (4) detect provider-confirmed unique events and send `event` payloads, (5) handle corrections/VAR separately, (6) obey provider rate limits and attribution terms, and (7) retain stable fixture/event IDs across polling and restarts. **Do not infer goals solely from score changes** or fabricate scorers. Verify provider permissions for monetised Twitch display and redistribution. Avoid copying BBC/Sky graphics or using unauthorised club logos.

### Example curl (PowerShell)

```powershell
$headers = @{ 'x-ingest-token'='local-testing-only-change-me' }
$body = @{ type='fixtures'; data=@(@{id='demo:1';competition='PL';home='Hull City';away='Fulham';homeScore=0;awayScore=0;status='LIVE'}) } | ConvertTo-Json -Depth 8
Invoke-RestMethod -Uri http://127.0.0.1:8787/ingest -Method Post -Headers $headers -ContentType 'application/json' -Body $body
```

## Run tests

`npm test` (Node.js 18+). No external dependencies.

## Security / production

- Server binds to `127.0.0.1` by default. Do not expose the ingest endpoint to the internet. Dashboard requires the local secret for modifications.
- For remote DexterAI systems, put a secure, authenticated reverse proxy or private VPN between them; configure CORS intentionally, add TLS, access controls and request rate limiting.
- The browser EventSource reconnects automatically and receives current state/history on reconnect. For large production workloads, add provider-specific replay, logging, monitoring and a real database.
- `state.json` is runtime data and should not be committed. Change the demo token before any nonlocal use.
- No official DexterAI API/SDK has been verified. Developers must adapt the SSE/HTTP bridge to DexterAI's supported extension mechanism.

## Licence

MIT for the code in this package. No third-party code or data is bundled. The interface and graphics are an original starter implementation and can be restyled to your existing broadcast layout.
