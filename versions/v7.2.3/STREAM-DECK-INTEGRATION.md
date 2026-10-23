# Stream Deck integration plan — Football Results Studio v7.2.3

Status: implementation specification; NOT an installed or tested Stream Deck integration.

## Existing app interface (verified in server.js)
- Local HTTP server: http://127.0.0.1:8787
- GET /state, /health, /events
- POST /ingest with x-ingest-token header, JSON body
- Match selection via POST /ingest body: {"type":"settings","data":{"selectedMatchId":"<fixture id>"}}
- Existing OBS Browser Sources: /panels, /goal, /ticker, /match.
- The existing server does not yet have a Stream Deck control endpoint, camera animation, Twitch chat bot, or OBS WebSocket client.

## Implementation target
- Standalone Twitch bot: reads the studio's verified fixture data; responds to chat; queues requested matches for operator approval; never switches broadcast graphics autonomously.
- Local operator control API: authenticated localhost-only commands for match-select, previous/next, show-stats, show-events, show-lineups (if provider supplies), show-table, show-chat, return-to-studio, refresh.
- OBS WebSocket controller: camera source transforms and visibility of analysis graphics; snapshot and restore the original camera transform. Require WebSocket authentication. No public port forwarding.
- Analysis layout: six-row live results remain left; right league table/chat remains; stats in central area; presenter camera shrinks to bottom-centre beneath stats and above full-width vidiprinter. Return restores the original camera position. No interruption to goal/ticker queue.
- Match stats: only data actually supplied by SportsScore API; missing data shown as unavailable.
- Stream Deck: initially generic keys to trigger local commands; custom plugin for live key labels is a later enhancement.
- Failure handling: reconnect OBS/Twitch; mark stale feed; avoid duplicate goal events; preserve original camera transform even if control fails.

## Recommended installation (Windows)
1. Stream Deck app: https://www.elgato.com/ww/en/s/downloads
2. OBS Studio: https://obsproject.com/download (OBS 28+ has built-in WebSocket)
3. OBS plugin for Stream Deck: find **OBS Studio** in Elgato Marketplace from the Stream Deck app.
4. Node.js LTS: https://nodejs.org/en/download (existing app requires Node 18+).
5. No extra obs-websocket download for modern OBS.

## When local controller is ready
- OBS: Tools > WebSocket Server Settings; enable server and authentication; use a strong password; keep it local.
- Add /panels, /goal, /ticker, /match as OBS Browser Sources; use the existing 3440x1440 canvas.
- Set source names and exact coordinates in the controller config, not hardcoded guesses.
- Map Stream Deck keys to local controller actions.
- Test without going live: show-stats, navigate, restore, disconnect/reconnect OBS, replay goal while analysis is visible.

## Outstanding prerequisites
- Implement and test the local controller and OBS WebSocket client.
- Implement the standalone Twitch bot and Twitch OAuth authorization.
- Verify SportsScore feed support for match stats, tables and lineups.
- Obtain user's actual Stream Deck key count before producing an exact profile; generic actions can be designed without it.
- Never commit API keys, OAuth tokens, or OBS WebSocket passwords.
