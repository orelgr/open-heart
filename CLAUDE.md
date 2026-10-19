# Open Heart — לבבות פתוחים

Conversation-card game for dates (two players), shipped as a mobile-first PWA.
UI name: **לבבות פתוחים** · Brand/folder: **Open Heart** · Production domain: **`openhearts.gmarup.com`** (subdomain of gmarup.com).
Remote: `https://github.com/orelgr/open-heart`.

## Architecture

```
Browser (React SPA, RTL Hebrew)  ──GET /api/content──►  FastAPI (backend/App.py)  ──reads──►  backend/questions.json
        ▲                                                      │
        └──────────── in production FastAPI also serves frontend/dist (same origin, single PM2 process)
```

- **One request** (`/api/content`) returns categories + questions + power cards + rules. The client caches it in
  `localStorage` (stale-while-revalidate, `src/lib/api.js`), so every screen after first load renders instantly.
- Routing is a 20-line hash router (`src/lib/router.js`): `#/`, `#/rules`, `#/select`, `#/play`. Browser back works.
- Deck building (`src/lib/deck.js`): questions from all selected categories are shuffled **together** (mixed),
  and a power card is dealt every `meta.powerCardMinGap`..`powerCardMaxGap` questions (3..5, never consecutive,
  none as the last card). Power cards are drawn without repetition until all 15 were used.
- PWA: `public/manifest.webmanifest`, `public/sw.js` (navigations + API network-first, static assets cache-first),
  registered only in production builds.

### API (backend/App.py)
| Route | Returns |
|---|---|
| `GET /api/health` | `{status:"ok"}` |
| `GET /api/content` | whole `questions.json` |
| `GET /api/categories` / `/api/categories/{id}` | category list (no questions) / one category |
| `GET /api/power-cards`, `GET /api/rules` | subsets |
| `GET /api/auth/session` | `{user|null}` (no 401 for guests) |
| `POST /api/auth/register` `login` `logout` `password` | account flows (JSON body, Origin-checked, rate-limited) |
| `GET/PATCH/DELETE /api/auth/me`, `GET /api/auth/export` | profile, rename couple `{name,partner}`, delete (needs password), data export |
| `GET /api/cards/answered`, `PUT`/`DELETE /api/cards/answered/{key}`, `DELETE /api/cards/answered` | checked-off cards: list, mark, unmark, reset all |
| `GET /*` | built SPA (only if `frontend/dist` exists; path-traversal guarded) |

Env vars: `HOST` (0.0.0.0), `PORT` (8000), `RELOAD` (1 = auto-reload), `CORS_ORIGINS` (comma list, default `*`),
`SECRET_KEY` (base64 ≥32 bytes; else `data/secret.key` is generated), `DATA_DIR` (`backend/data`), `COOKIE_SECURE`
(1; set 0 only for plain-http LAN testing), `PASSWORD_MIN_LENGTH` (12), `HIBP_CHECK` (1), `AUDIT_RETENTION_DAYS` (365).

### Accounts (required: every route except #/login #/register #/privacy shows login). Compliance: `SECURITY.md`
SQLite (`db.py`, WAL, `STRICT`, `secure_delete`), connection per request. Email + name AES-256-GCM encrypted
(AAD = `field:public_id`), email looked up via HMAC; passwords Argon2id; session = random token in HttpOnly
`__Host-session` cookie, only its SHA-256 stored. Never cache `/api/auth` (SW skips it, `no-store`).
Privacy notice text = `PRIVACY` in `Account.jsx`; bump `PRIVACY_VERSION` in `auth.py` when it changes.
One account per couple: `name` + `partner` (encrypted) are the two player names, edited on Home (debounced PATCH).
**Answered cards**: ✓ button on a flipped question / "מה יענה?" card (`CheckButton` in `Card.jsx`) marks it and
advances; `buildDeck(content, ids, answered)` leaves marked cards out; `#/answered` lists them and unchecking returns a
card to the deck. Key (`answerKey`) = `<categoryId>-<index>` or `pc-<powerCardId>`, so **append** new questions at
the end of a category (reordering would shift keys).

### questions.json schema
`meta{powerCardMinGap,powerCardMaxGap}` · `categories[{id,order,title,subtitle,icon,tone,questions[]}]` (6 × 15)
· `powerCards[{id,type:"challenge"|"power",turn:"single"|"both",nextTurn?:"both",title,icon,text,seconds?}]` · `rules{intro,steps[{icon,title,text}],etiquette[],powerIntro}`.
`icon` = lucide-react name, mapped in `src/lib/icons.js` (add new names there). `tone` ∈ sand|gold|sage|sky|clay|plum.
To add content, edit only the JSON — no frontend change needed.

## Folder structure
```
backend/   App.py · auth.py · cards.py · db.py · security.py · backup_db.py · questions.json · requirements.txt · data/ (gitignored)
frontend/  index.html · vite.config.js (proxy /api → :8000) · public/{icon.svg,manifest.webmanifest,sw.js}
  src/  main.jsx · App.jsx (content load, routing, screen transitions) · index.css (Tailwind v4 @theme tokens)
    lib/        api.js · auth.js · cards.js · router.js · deck.js · icons.js (icon map + category tones)
    components/ ui.jsx (Button, IconButton, Screen, TopBar, Backdrop) · Logo.jsx · Home.jsx · Account.jsx · Answered.jsx (#/answered)
                (AuthPage #/login #/register, AccountPage #/account, PrivacyPage #/privacy) · Rules.jsx
                (RulesPage, RulesContent, RulesSheet) · CategorySelect.jsx · Game.jsx · Card.jsx · Timer.jsx
ecosystem.config.js   PM2 process file
```

## Design decisions
- **Apple HIG feel**: warm ivory canvas `#F5F1EB`, ink `#1D1D1F`, single accent champagne-gold `#B8955A`; night
  `#1F2433` reserved for power cards. Glass material = `.glass` (white 62% + `blur(20px) saturate(180%)`).
  Radii 28px cards / pill buttons 56px tall (≥44pt touch targets). Soft two-layer shadows.
- **Typography**: Heebo (UI) + Frank Ruhl Libre (display: title & questions) — elegant, readable Hebrew.
- **Mood**: mature, family-friendly. Logo = two arcs of an *open* heart (gold + ink), no red hearts; category tones
  are desaturated naturals.
- **Card game patterns**: real 3-layer stack (`Game.jsx` renders `deck.slice(index, index+3)` keyed by card, so
  each card physically moves up a layer instead of being swapped). Choreography lives in `Card.jsx` `variants`,
  driven by a shared `nav` object `{mode: start|next|back, dir, dragged, backFrom}` passed to both
  `AnimatePresence custom` (exits) and each card (enters):
  - start: cards are dealt in from below, staggered back → front.
  - drag: rotation coupled to x, light sweep (`glare`), cards behind lean forward via shared `progress` motion value.
  - thrown exit keeps momentum on an upward arc; button exit = small anticipation lift then arc out.
  - back (undo): card returns from the side it left (`exitDirs`), bottom card sinks away.
  - flip: spring rotateY with a lift (scale 1.07, y −12) via `useAnimate` on an inner wrapper.
  - `html, body { overflow: clip }` so off-screen cards never scroll the page.
  Power cards have a distinct dark/gold back with a breathing glow so they read as a surprise.
- **Fast navigation**: content preloaded/cached, screen transitions ≤ 220ms (exit 100ms), no route code splitting
  needed (124 KB gzip). `MotionConfig reducedMotion="user"` + CSS reduced-motion fallback.
- In-game rules: discreet glass book button at the left of the hint row → iOS bottom sheet (drag-down/Esc/X to close).
- Gotcha fixed in testing: the hidden 3D face still receives hits, so `CardBack` gets `pointer-events:none` when
  flipped; controls inside a card mark `data-no-flip` (checked on pointer-down, because Framer's tap fires after
  the button may have unmounted).

## Local & PM2 Execution Instructions

**Prereqs**: Python 3.10+, Node 20+.

### Local, one command (what you usually want)
```bash
backend/.venv/Scripts/python backend/App.py   # Windows; or press Run on App.py in VS Code (interpreter = backend/.venv)
```
Rebuilds `frontend/dist` when `frontend/src` / `public` changed (`npm install` too if needed), serves API + SPA on
http://localhost:8000 and opens the browser. Refuses to start if the port is taken (an old server still running).
`AUTO_BUILD=0` / `OPEN_BROWSER=0` turn those off; both are skipped automatically under PM2.

### Local (development with hot reload, two terminals)
```bash
# 1) Backend  → http://127.0.0.1:8000
cd backend
pip install -r requirements.txt
python App.py              # RELOAD=1 python App.py  for auto-reload

# 2) Frontend → http://localhost:5173  (proxies /api to :8000)
cd frontend
npm install
npm run dev
```
Mobile check: open http://localhost:5173 → F12 → Toggle device toolbar (Ctrl+Shift+M) → iPhone 12/14 Pro.
Real phone on same Wi-Fi: use the "Network:" URL Vite prints (server.host = true).

### Production with PM2 (single process serves API + SPA)
```bash
git clone https://github.com/orelgr/open-heart.git && cd open-heart
python3 -m venv backend/.venv && backend/.venv/bin/pip install -r backend/requirements.txt
cd frontend && npm ci && npm run build && cd ..
npm i -g pm2
pm2 start ecosystem.config.js     # app name: open-heart, 127.0.0.1:8000
pm2 save && pm2 startup           # survive reboots
# update: git pull && (cd frontend && npm ci && npm run build) && pm2 restart open-heart
```
Point the reverse proxy (nginx/Caddy) for `openhearts.gmarup.com` to `127.0.0.1:8000` with HTTPS (needed for the
service worker / installable PWA). Windows servers: set `PYTHON=python` (ecosystem uses `python3` by default).

## Testing (Playwright MCP, iPhone viewport 390×844)
Verified: home loads stats from Python API (90 questions/6 categories) · Home→Rules 45 ms · category multi-select
& count · card tap-flip · drag swipe advances · "next" button · power card appears within gap · 10 s timer counts
down without flipping the card · rules FAB opens/closes sheet · no horizontal/body scroll · 0 console errors ·
prod build served by FastAPI (`/`, `/sw.js`, `/api/content` → 200).
Stable test hooks: `data-testid` = start, open-rules, home-stats, cat-<id>, play, card (`data-kind`, `data-flipped`),
next, progress, rules-fab, rules-sheet, rules-close, timer-value, deck-done, account, auth-{name,partner,email,password,consent,submit}, card-check, open-answered, answered-count,
answered-list, answered-toggle, reset-confirm, account-name, logout, delete-confirm.

## React Native Migration Path
Logic (`lib/deck.js`, `lib/api.js` minus localStorage, content JSON, backend) ports **unchanged**. Map:

| Web (now) | React Native (Expo) |
|---|---|
| `div` / `main` / `header` / `section` | `View` (`SafeAreaView` for `Screen`; replace `.safe-top/.safe-bottom`) |
| `p`, `span`, `h1–h3` | `Text` (fonts via `expo-font`: Heebo, FrankRuhlLibre) |
| `button` / `motion.button` (whileTap scale) | `Pressable` + Reanimated `withSpring` scale |
| `overflow-y-auto` lists | `ScrollView` (categories could be `FlatList`) |
| Tailwind classes | NativeWind (same class names mostly) or `StyleSheet` from tokens in `index.css @theme` |
| `.glass` backdrop-filter | `expo-blur` `BlurView` (intensity ~40, tint "light") |
| CSS gradients (card backs, tones) | `expo-linear-gradient` |
| Framer Motion `drag="x"` + exit (Card.jsx) | `react-native-gesture-handler` `Gesture.Pan` + Reanimated `translateX`/`rotate` interpolate, `runOnJS(onSwipe)` |
| 3D flip (`rotateY`, `preserve-3d`, `backface-hidden`) | two absolutely-stacked `Animated.View`s with `transform:[{perspective:1400},{rotateY}]` and `backfaceVisibility:'hidden'` |
| `AnimatePresence` screen transitions | `@react-navigation/native-stack` (animation: 'fade'/'slide_from_left' for RTL) |
| Hash router (`#/`, `#/rules`, `#/select`, `#/play`) | Stack screens: Home, Rules, Select, Game |
| `RulesSheet` (drag-to-close) | `@gorhom/bottom-sheet` or native `Modal presentationStyle="pageSheet"` |
| SVG (`LogoMark`, `Timer` ring, `icon.svg`) | `react-native-svg` (same paths) |
| `lucide-react` | `lucide-react-native` (same names; `lib/icons.js` map unchanged) |
| `localStorage` cache | `@react-native-async-storage/async-storage` |
| `navigator.vibrate` | `expo-haptics` (`impactAsync(Light)`, `notificationAsync` on timer end) |
| `fetch('/api/...')` relative | absolute `API_BASE` (`https://openhearts.gmarup.com`) via `expo-constants` |
| `dir="rtl"` on `<html>` | `I18nManager.forceRTL(true)` + reload; check `row` directions |
| `requestAnimationFrame` timer | same, or Reanimated `withTiming` for the ring |
| manifest / sw.js | not needed (app icons via `app.json`) |

## Changelog
- 2026-10-19 - v1.7: login required to play; couple's names saved on the account (register asks both); ✓ on a card
  checks it off and jumps to the next one; Home "עניתם" button → `#/answered` list where unchecking puts the card back
  in the deck. DB schema v2 (`users.partner_enc`, `answered_cards`, auto-migrated).
- 2026-10-19 - v1.6: optional accounts on SQLite (register/login/logout, change password, export, delete), encrypted
  PII, Argon2id, HIBP check, rate limits, CSP + security headers, privacy page, `SECURITY.md` (Amendment 13 / 2017
  data-security regs / NIST 800-63B-4 / OWASP ASVS 5 mapping). Account button at the top of Home.
- 2026-10-19 - v1.5: "מה יענה?" guess cards (`type:"guess"`, 6 cards, Lightbulb back): `card.player` answers, the other
  guesses first. Power card "קלף הניחוש" (`nextTurn:"guess"`) turns the next question into a guess (`card.guess`, gold pill).
- 2026-10-19 - v1.5: player names & turns. Home screen has two name inputs (saved in localStorage,
  `lib/players.js`). `buildDeck` assigns `card.player` (0/1 alternating from a random starter, or "both" for
  `turn:"both"` power cards and the question after a `nextTurn:"both"` card: mirror, choice). Cards show
  "<name>, תורך לענות" / "שניכם עונים" on back and front (`data-testid="turn"`); hidden if a name is empty.
- 2026-10-14 - v1.4: shuffle intro is now two acts (~4.7 s, `ShuffleIntro.jsx`): a 3D table riffle (split, halves hinge on their outer edge so the inner corners lift, cards release in place and interleave in the overlap, halves pushed together,
  alternating cascade, tap-square, then the table tilts up and shrinks) hands off to the helix bloom. Dark power cards
  (night + gold bolt, every 4th card) appear in both acts.
- 2026-10-14 - v1.3: hand-free "open heart" shuffle intro (`ShuffleIntro.jsx`, 3 s): the deck blooms into a spinning
  3D helix of 14 category-coloured cards around the logo, then spirals back into one stack with a golden pulse and
  sparkles. Each card is two nested motion layers (outer rotateY+y = position on ring, inner translateZ = radius) so
  transforms compose radially. Tap to skip, haptic ticks, reduced-motion fallback. Snappier springs (flip ~0.3 s,
  card exit ~0.3 s, screen transitions 0.16 s).
- 2026-10-14 — v1.2: categories mixed in one shuffled deck; power cards more frequent (every 3-5 cards, ~19%) and
  15 power cards (was 9); all long dashes removed from copy.
- 2026-10-14 — v1.1: stacked-deck animation choreography (deal-in, lean, throw/arc, undo return, lifted flip);
  home subtitle split to two lines without dash; production domain → gmarup.com.
- 2026-10-14 — v1.0.0: backend (FastAPI + 90 questions, 9 power cards, rules), frontend (home, rules page,
  category select, game with swipe/flip cards, power cards + 10 s timer, rules sheet), PWA, Playwright pass, PM2 config.
