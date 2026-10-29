# 🐸 LARPED ONE OUT

A chaotic browser party game about music and pop culture. Everyone is a cute voxel frog at the clubhouse table; at the end, the lowest scorer is exposed as an ugly toad.

- **2–12 players**, no download. The host gets a 4-letter code and a QR code, and friends join from any phone or computer. The host plays too.
- **19 minigames**: Guess the Song (0.5 s → 8 s clips), Finish the Lyrics, Guess the Artist, Guess the Album, Album Cover (pixel reveal), Song from Emojis, Reverse, Speed-Up, Intro, Outro, Release Year, Which Came First, Finish the Quote, TV Theme, Movie Sound, Character, Higher or Lower, Name the Genre and trivia. There is also a double-points final round.
- **Social rounds**: duels with point steals, wagers, *Who Will Flop?* predictions, and secret sabotage (harmless flies on a rival's screen).
- **Voting**: every player's coloured glove cursor is visible on the table. Vote for maps (bottle spin), categories, answers and rematches, and change your vote until the timer ends.
- **Six maps**: Swamp Clubhouse, Mushroom Tavern, Rainy Forest Cabin, Floating Lily Pad Disco, Frog Arcade and Moonlit Pond. Each has its own lighting, music and DJ outfit, plus random events (giant fly, mic swallow, mushroom confetti, chair fall, DJ zap, mosquito).
- **Finale**: the lights go out, the DJ stops, a spotlight finds last place and they turn into a warty toad under a giant "LARPED ONE OUT", with hammer slapstick and thrown lily pads. The winner takes the golden lily-pad throne.
- **Cabin main menu**: your frog lounges by the fire listening to vinyl. Each menu is a physical station in the room:
  - the party table (play),
  - a changing room with a real mirror,
  - Mossy's stall, which has 3 daily deals,
  - the record shelf (collection),
  - a scrapbook profile with draggable stickers,
  - DJ Lilypadd's tutorial poster.
- **Progression**: coins and XP from playing, levels, 24 achievements, titles, banners, and 165 cosmetics. Everything is earned in game; there is no real money and nothing pay-to-win.

## Quick start

Requires Node.js 22.13 or newer (it uses the built-in `node:sqlite` for profiles).

```bash
npm install
```

```bash
npm run dev
```

Open <http://localhost:5173>. The game server runs on port 8787, and Vite proxies `/ws` and `/api` to it. On your Wi-Fi, the lobby QR code points at your computer's LAN address, so phones can scan it and join.

For production:

```bash
npm run build
```

```bash
npm start
```

This serves the built client and the WebSocket server together on `PORT` (default 8787). A `Dockerfile` is included.

```bash
docker build -t larped-one-out .
```

```bash
docker run -p 8787:8787 -v loo-data:/app/data larped-one-out
```

## How to play

1. Tap **PLAY** at the party table, then **Host a party**, or try **Practice vs bots**.
2. Share the code, link or QR code. Friends' frogs hop onto stools around the table.
3. The host picks a preset (Quick, Classic, Marathon, Chaos, Music only, Pop culture) or tunes rounds, timer, difficulty, categories, minigames and rules.
4. Point your glove at the answers. Correct answers score up to 1000 points: faster answers score more, streaks add bonuses, trailing frogs get a small underdog boost, and the final round counts double.
5. Whoever is last after the final round gets LARPED ONE OUT.

New players can run **DJ Lilypadd's tutorial** (the poster on the cabin's left wall). It is a short real game against practice bots that runs entirely in the browser.

## Music, licensing and honesty

- **Real music plays live.** Every clip is performed in your browser by the game's own Web Audio synthesizer from a written score. Nothing is a fake placeholder sound.
- **Public-domain compositions.** The 39 classical and folk pieces (Beethoven, Mozart, Grieg, Joplin, traditional songs…) have expired copyrights. Each song records why it is public domain (composer's death year, US publication date) in `rights.basis`. Our arrangements and performances are original and released as CC0.
- **Original House Band songs.** These 13 original CC0 songs power Finish the Lyrics, Name the Genre and Album Cover. They were written for the game, so no copyrighted lyrics are reproduced.
- **Metadata-only questions for copyrighted music.** Questions about copyrighted music (Guess the Artist, Release Year, Which Came First, Guess the Album, TV/movie/anime/game trivia) use only factual metadata: titles, artists, years and track lists. No audio, artwork or lyrics are used. When a round's topic has no playable recording, the DJ switches to a *liner-notes round* and the screen explains why.
- **Per-recording licence check.** Every recording's licence is checked individually (`src/shared/content.ts`, `src/server/content.ts`). Audio only plays if the licence is PD, CC0, CC BY or CC BY-SA, with attribution shown. NonCommercial and NoDerivatives material is automatically demoted to metadata-only, because rounds modify and redistribute clips. External files also need a verification date and source URL.
- **Credits board.** The in-game board (📜 in the cabin) and `/api/credits` list the licence and legal basis of every playable piece.

See [CREDITS.md](CREDITS.md) for every asset, font and library.

### Optional online sources

All built-in content works offline with no API keys. A server operator can add more by setting these environment variables:

| Service | Env vars | What it adds |
| --- | --- | --- |
| MusicBrainz | none (set `LOO_USER_AGENT` with contact info) | Artist release groups and track lists for metadata rounds (`artist name` in the lobby's import box). Rate-limited to about 1 request per second. |
| Openverse | none | Openly licensed audio (`audio: <search words>` in the import box). Each result's licence is checked, cover versions are filtered heuristically, and NC/ND results are rejected. |
| Wikimedia Commons | none | Openly licensed audio files for the same `audio:` search, with each file's licence read from its metadata. |
| Jamendo | `JAMENDO_CLIENT_ID` | CC BY / CC BY-SA tracks only. Most Jamendo music is NC/ND and is therefore rejected. |
| Spotify Web API | `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET` | Imports **titles and artists only** from a public playlist link, linking back to Spotify. |
| TMDB | `TMDB_READ_TOKEN` or `TMDB_API_KEY` | Movie and TV titles and years (`tmdb: movies` / `tmdb: tv`). "This product uses the TMDB API but is not endorsed or certified by TMDB." |

Audio from external sources streams through a same-origin proxy (`/api/audio/<token>`). It is never stored, and it only plays when its licence passed the check. Imported content applies to that one room only and is never persisted. `LOO_OFFLINE=1` disables every connector.

**Spotify:**
- The game never plays Spotify audio in quizzes. Spotify playback requires each listener to have Premium and to sign in through Spotify's own SDK, and Spotify's Developer Policy restricts how its content may be used in games.
- The import is therefore limited to metadata.
- Operators should review Spotify's Developer Terms and Policy themselves before enabling it.
- Spotify has also limited which playlists new apps can read: editorial and algorithmic playlists may be unavailable.

**Live testing status:** the connectors are written against the services' documented APIs, but this repository's development environment had no outbound network access, so **they have not been tested against the live services**. Everything built in (songs, questions, art, multiplayer) is fully tested.

## Architecture

```
src/shared/     Engine shared by server and browser: protocol, Room state machine, scoring,
                question generators, bots, cosmetics, progression, music notation
src/server/     HTTP + WebSocket server, room manager, profiles (node:sqlite), economy, connectors
src/content/    Built-in content: public-domain songs, original songs, metadata trivia
src/client/     Three.js client: pixel renderer, voxel frogs, clubhouse, cabin menu, HUD, audio
tests/unit/     Vitest: full games with fake clocks, reconnects, host migration, scoring, content
tests/e2e/      Real server + two WebSocket players + a bot playing a full game
```

- **Server-authoritative.** The server runs every room: phase timers, answer validation, scoring, bots, host migration (after 8 s), reconnects by session token, and rate limiting. Clients receive per-player snapshots, and correct answers are never sent before the reveal.
- **Synced countdowns and audio.** The server stamps each question with a start time and deadline. Clients sync their clocks with ping/pong and schedule the clip sample-accurately on the Web Audio clock.
- **Persistent profiles.** A random token is stored in `localStorage`, and the server keeps a SQLite row keyed by the token's hash.
- **Rendering.** Scenes render into a low-resolution target with a normal/depth edge pass for the pixel-art look. Frogs and props are built from voxels with ambient occlusion, and all UI frames are generated pixel art. The quality setting scales resolution and shadows for phones.

## Tests

```bash
npm test
```

63 unit tests run complete games against real content and verify that no answers leak.

```bash
npm run test:e2e
```

The e2e suite starts the real server with a 10× room clock, then plays a whole game with two WebSocket clients and a bot. It covers a mid-game disconnect and seat restore, rewards, profile persistence, the shop and the HTTP API.

```bash
npm run typecheck
```

## Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `8787` | HTTP + WebSocket port |
| `LOO_DB` | `data/profiles.sqlite` | Profile database file |
| `LOO_STATIC` | `dist/client` | Built client directory |
| `LOO_OFFLINE` | unset | `1` disables all online connectors |
| `LOO_USER_AGENT` | built-in | User-Agent for MusicBrainz and other APIs (include contact info) |
| `LOO_TIME_SCALE` | `1` | Test only: speeds up every room clock |

## License

The code and original assets are MIT-licensed (see `package.json`). The original music, characters and art are additionally dedicated to the public domain under CC0. Third-party fonts and libraries keep their own licences (see [CREDITS.md](CREDITS.md)).
