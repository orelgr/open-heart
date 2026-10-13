# Open Heart — לבבות פתוחים

Conversation-card game for dates (two players), shipped as a mobile-first PWA.
UI name: **לבבות פתוחים** · Brand/folder/domain: **Open Heart** (`openheart.gmarup.com`).
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
- Deck building (`src/lib/deck.js`): selected categories in their `order` (light → deep), questions shuffled
  within each, power cards inserted after ≥ `meta.powerCardMinGap` questions (random by `powerCardChance`,
  guaranteed by 2×gap).
- PWA: `public/manifest.webmanifest`, `public/sw.js` (navigations + API network-first, static assets cache-first),
  registered only in production builds.

### API (backend/App.py)
| Route | Returns |
|---|---|
| `GET /api/health` | `{status:"ok"}` |
| `GET /api/content` | whole `questions.json` |
| `GET /api/categories` / `/api/categories/{id}` | category list (no questions) / one category |
| `GET /api/power-cards`, `GET /api/rules` | subsets |
| `GET /*` | built SPA (only if `frontend/dist` exists; path-traversal guarded) |

Env vars: `HOST` (0.0.0.0), `PORT` (8000), `RELOAD` (1 = auto-reload), `CORS_ORIGINS` (comma list, default `*`).

### questions.json schema
`meta{powerCardChance,powerCardMinGap}` · `categories[{id,order,title,subtitle,icon,tone,questions[]}]` (6 × 15)
· `powerCards[{id,type:"challenge"|"power",title,icon,text,seconds?}]` · `rules{intro,steps[{icon,title,text}],etiquette[],powerIntro}`.
`icon` = lucide-react name, mapped in `src/lib/icons.js` (add new names there). `tone` ∈ sand|gold|sage|sky|clay|plum.
To add content, edit only the JSON — no frontend change needed.

## Folder structure
```
backend/   App.py · questions.json · requirements.txt
frontend/  index.html · vite.config.js (proxy /api → :8000) · public/{icon.svg,manifest.webmanifest,sw.js}
  src/  main.jsx · App.jsx (content load, routing, screen transitions) · index.css (Tailwind v4 @theme tokens)
    lib/        api.js · router.js · deck.js · icons.js (icon map + category tones)
    components/ ui.jsx (Button, IconButton, Screen, TopBar, Backdrop) · Logo.jsx · Home.jsx · Rules.jsx
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
- **Card game patterns**: face-down deck with category-tinted backs, next card peeking behind (scale .94),
  tap = spring 3D flip (rotateY, `preserve-3d`, `backface-hidden`), drag-x swipe with rotation coupled to x,
  throw-out exit; power cards have a distinct dark/gold back with a breathing glow so they read as a surprise.
- **Fast navigation**: content preloaded/cached, screen transitions ≤ 220ms (exit 100ms), no route code splitting
  needed (124 KB gzip). `MotionConfig reducedMotion="user"` + CSS reduced-motion fallback.
- In-game rules: discreet glass book button at the left of the hint row → iOS bottom sheet (drag-down/Esc/X to close).
- Gotcha fixed in testing: the hidden 3D face still receives hits, so `CardBack` gets `pointer-events:none` when
  flipped; controls inside a card mark `data-no-flip` (checked on pointer-down, because Framer's tap fires after
  the button may have unmounted).

## Local & PM2 Execution Instructions

**Prereqs**: Python 3.10+, Node 20+.

### Local (development, two terminals)
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
pip3 install -r backend/requirements.txt
cd frontend && npm ci && npm run build && cd ..
npm i -g pm2
pm2 start ecosystem.config.js     # app name: open-heart, 127.0.0.1:8000
pm2 save && pm2 startup           # survive reboots
# update: git pull && (cd frontend && npm ci && npm run build) && pm2 restart open-heart
```
Point the reverse proxy (nginx/Caddy) for `openheart.gmarup.com` to `127.0.0.1:8000` with HTTPS (needed for the
service worker / installable PWA). Windows servers: set `PYTHON=python` (ecosystem uses `python3` by default).

## Testing (Playwright MCP, iPhone viewport 390×844)
Verified: home loads stats from Python API (90 questions/6 categories) · Home→Rules 45 ms · category multi-select
& count · card tap-flip · drag swipe advances · "next" button · power card appears within gap · 10 s timer counts
down without flipping the card · rules FAB opens/closes sheet · no horizontal/body scroll · 0 console errors ·
prod build served by FastAPI (`/`, `/sw.js`, `/api/content` → 200).
Stable test hooks: `data-testid` = start, open-rules, home-stats, cat-<id>, play, card (`data-kind`, `data-flipped`),
next, progress, rules-fab, rules-sheet, rules-close, timer-value, deck-done.

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
| `fetch('/api/...')` relative | absolute `API_BASE` (`https://openheart.gmarup.com`) via `expo-constants` |
| `dir="rtl"` on `<html>` | `I18nManager.forceRTL(true)` + reload; check `row` directions |
| `requestAnimationFrame` timer | same, or Reanimated `withTiming` for the ring |
| manifest / sw.js | not needed (app icons via `app.json`) |

## Changelog
- 2026-10-14 — v1.0.0: backend (FastAPI + 90 questions, 9 power cards, rules), frontend (home, rules page,
  category select, game with swipe/flip cards, power cards + 10 s timer, rules sheet), PWA, Playwright pass, PM2 config.
