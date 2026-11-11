# Portable changes from Castafiore PRs

Source: [totoLab/Castafiore#1](https://github.com/totoLab/Castafiore/pull/1) (UI/UX redesign, 33 commits, 73 files) and [#2](https://github.com/totoLab/Castafiore/pull/2) (Moderato auth, 1 commit, 5 files). #2 is also the tail of the closed upstream PR [sawyerf/Castafiore#147](https://github.com/sawyerf/Castafiore/pull/147). Commit hashes below refer to this repo.

Castafiore is React Native (Expo). Items are tagged by how much they depend on that:

- **Any client**: the idea works on any stack (web, native, desktop).
- **RN only**: the idea is general, the code is React Native specific.
- **Moderato only**: needs the [moderato](https://github.com/totoLab/moderato) service next to the Subsonic server.

Everything here uses only standard Subsonic/OpenSubsonic endpoints unless marked Moderato.

---

## 1. Design foundations

### 1.1 Design tokens instead of literals (Any client) - `d6f1da2`, `4b34057`
- One size scale for text (`caption 12 / small 14 / medium 16 / large 20`), radius (`sm 4 / md 8 / lg 12 / xl 20 / circle 999`), icons and covers: [app/styles/size.js](../app/styles/size.js).
- Colours that must not follow the palette live in one `common` object merged into every theme: `overlay`, `danger`, `onImage` ([app/contexts/theme.js](../app/contexts/theme.js)).
- Why it matters for a Subsonic client: most have several themes and hardcoded `#fff` / `rgba(0,0,0,.5)` leak into light themes. Tokens make restyling a one-file change.

### 1.2 One icon wrapper over a modern icon set (RN only, idea is general) - `2746e9c`, `3154675`
- A single `Icon` component maps the old FontAwesome names to Lucide icons, so call sites kept passing strings ([app/components/Icon.js](../app/components/Icon.js)).
- A `filled` set draws solid variants (play, pause, heart, star, skip) because Lucide is outline-only.
- Result: `react-native-vector-icons` removed (no font files to bundle). Cost: `react-native-svg` is a native dependency, so a new native build is needed. `buffer` had to be added explicitly because `react-native-svg` imports it without declaring it (`eb6bbe8`).
- Takeaway: do the migration behind a wrapper with the old names, then delete the old library in a later commit.

### 1.3 Remove copy-pasted navigator options (RN only) - `827c7e0`
- Four native stack navigators each set `tabBarStyle`, which has no effect on a stack. Collapsed to `screenOptions={{ headerShown: false }}` ([app/screens/Stacks.js](../app/screens/Stacks.js)).

---

## 2. Accessibility

### 2.1 Labelled icon buttons with a larger hit area (Any client) - `bc4c930`
- `IconButton` takes a `label` and falls back to a per-icon default (`play` -> "Play", `ellipsis-h` -> "More options", ...), sets `accessibilityRole="button"` and `hitSlop={10}` ([app/components/button/IconButton.js](../app/components/button/IconButton.js)).
- Icon-only controls are the norm in music players, so a default label table fixes most screens at once.
- Mini-player buttons were enlarged to 44x44, the usual minimum touch target.

### 2.2 Secondary text contrast 4.5:1 (Any client) - `5e5c8ed`
- Raised `secondaryText` in three themes (dark `#808080` -> `#8c8c8c`, orange light `#999999` -> `#6b6b6b`, red light `#8f8f93` -> `#6c6c70`). Check each theme against WCAG AA; grey subtitle text (artist, album, year) is where music apps usually fail.

### 2.3 Respect "reduce motion" (RN only, idea is general) - `3e8ad25`, `dd6dec5`
- [app/utils/reducedMotion.js](../app/utils/reducedMotion.js): a module-level flag for plain style helpers plus a `useReducedMotion()` hook, fed by `AccessibilityInfo`. On web the equivalent is the `prefers-reduced-motion` media query.
- Applied to: press-shrink on items, skeleton pulse, popup transitions, mini-player swipe, full-player drag snap-back, sheets.

### 2.4 Tabs semantics (Any client)
- The full player's Cover/Queue/Lyrics switch uses `accessibilityRole="tab"` with `accessibilityState.selected`.

---

## 3. Screens and interaction patterns

### 3.1 Album / artist / playlist header (Any client) - `ed3d1d5`
- Centred cover (60% of width, max 260) over a soft vertical gradient from `tertiaryBack` to `primaryBack`, left-aligned title, and a large 56px circular Play button next to the existing actions ([app/components/PresHeader.js](../app/components/PresHeader.js)).
- One shared component serves album, artist, playlist, favourites and genre pages.

### 3.2 Visible options button on song rows (Any client) - `b41a747`
- Long-press / right-click menus are hard to discover. Rows now show an explicit "..." button that opens the same menu.

### 3.3 Mini player (RN only, idea is general) - `d7b979f`, `9e975d0`
- Thin progress line along the bottom edge, in its own component so only it re-renders each tick ([app/components/player/BoxPlayer.js](../app/components/player/BoxPlayer.js)).
- Swipe up opens the full player, swipe left/right skips next/previous, tap still opens. Thresholds: 15px to start, 60px horizontal, 40px vertical to commit. The handler reads state through a ref so the `PanResponder` is created once.

### 3.4 Full-screen player (Any client) - `befe8d0`, `ccc219d`
- Segmented control **Cover / Queue / Lyrics** replaces two toggle icons.
- Drag down to close, only while on the Cover tab (so the queue list can still scroll). Close on >120px or fast flick, otherwise spring back (no spring under reduced motion).
- Gradient backdrop, solid play button, text labels instead of unlabeled icons.
- Queue tab scrolls to the current song and keeps it centred when the track changes.
- Pitfall found: a local `size` variable shadowed the size tokens and crashed the player (`89a0316`). Name tokens distinctively or lint for shadowing.

### 3.5 Home (Any client) - `942a54b`, `c2c6280`, `fc63ce9`
- Title row, then a 2-column grid of recently played albums (`getAlbumList2` with `type=recent&size=8`), a "Refresh" pill, and "Random Song" (`getRandomSongs size=50`) under the grid.
- A hidden long-press that triggered a full library scan, which nobody could discover, was replaced by a **Rescan library** button in Settings > Informations calling `startScan` with `fullScan=true`, with a "Started" confirmation ([app/screens/Settings/Informations.js](../app/screens/Settings/Informations.js)). Hidden gestures for admin actions should be buttons.

### 3.6 Search (Any client) - `25c54f5`
- Search bar, **Recent searches** (stored locally, per-item delete), **Browse all** tiles: fixed entries (Artists, Albums, Songs) plus the top 20 genres by `songCount` from `getGenres`, each tile showing one cover from `getAlbumList2 type=byGenre size=1` ([app/screens/tabs/Search.js](../app/screens/tabs/Search.js)).
- Debounced `search3` (500ms, query length > 1) with an explicit state machine: `init / typing / loading / loaded / api_error / network_error`.

### 3.7 Bottom bar (Any client) - `2ed637e`
- Background `primaryBack`, active tab in `primaryText`, inactive in `secondaryText`. Colour alone no longer signals "disabled" vs "inactive". Label size uses the `caption` token.

---

## 4. Loading, empty and error states (Any client)

Subsonic servers are often self-hosted behind flaky links, so these matter more than in a SaaS app.

| State | Implementation | Commit |
|---|---|---|
| Loading | `Skeleton` (pulsing block, static under reduced motion) and `SkeletonRow` (title bar + 4 covers), hidden from screen readers ([app/components/Skeleton.js](../app/components/Skeleton.js)). Gives up after 8s so a failed request does not pulse forever ([HorizontalList.js](../app/components/lists/HorizontalList.js)). | `b80c5fe` |
| Empty | `EmptyState` with icon, one sentence and optional action ([app/components/EmptyState.js](../app/components/EmptyState.js)): "No results", "No playlists yet". | `cd2e7ee` |
| Subsonic error | Separate from network error. `getApi` rejects with `isApiError: true` when the response has `subsonic-response.error`, otherwise `false` ([app/utils/api.js](../app/utils/api.js)). | existing, now used |
| Offline | "Network Error" with a **Try again** button that re-runs the query. | `4f6f473` |

---

## 5. Subsonic protocol and server-connection details

### 5.1 Allow `http://` servers unless the page itself is https (Any client, web) - `1bce0bd`
- The old check refused all `http://` URLs on iOS and web. The real browser rule is mixed content: an **https page** cannot call http. A web build served over http (LAN, localhost) can reach an http Navidrome/Airsonic.
- New rule: block only if `window.location.protocol === 'https:'`, and say why: "This page is loaded over https, so the browser blocks http servers. Use an https address for the server, or open the app over http." ([app/screens/Settings/AddServer.js](../app/screens/Settings/AddServer.js))
- Native: Android needs `usesCleartextTraffic`; iOS needs `NSAppTransportSecurity.NSAllowsArbitraryLoads` ([app.config.js](../app.config.js)).

### 5.2 Subsonic token auth, reused for a second service (Any client) - `d7aac8b`
Subsonic auth (API 1.13+) sends `u`, `s` (random salt) and `t = md5(password + salt)`. Castafiore stores that query string per server. PR #2 reuses it to sign in to a **companion HTTP service** so the user has one account and no extra token to configure:

```
Authorization: Subsonic <user>:<salt>:<token>
```

Rules worth copying ([app/utils/songService.js](../app/utils/songService.js)):
- Parse the saved `u/s/t` from the stored query and reuse it as is. If the login was saved with a plain password (`p=` or `p=enc:<hex>`), derive a token from it.
- For plain-password logins, generate **one salt per login, not per request**. A service that caches verified tokens would otherwise re-verify against the server on every call.
- Percent-encode the username in the header.
- React Native's `URLSearchParams` has no `get()`, so the query is parsed by hand.
- Error mapping: 401 -> "server login not accepted, reconnect", 403 -> account not allowed, 429 -> too many pending, network failure -> "check its address". Show the server's `error` field when present.
- "Test connection" calls `GET /v1/me` and shows "Connected as <username>".

Works for any companion service (lyrics, scrobble relay, request/download bot) that can validate a Subsonic token against the same server.

### 5.3 Settings that save as you type (Any client) - `9f562ba`, `0f37654`
- Leaving a settings page without tapping "Save" silently dropped the value and a feature quietly turned off. Persist on every change, and show in the UI whether an optional integration is configured.

### 5.4 Platform bundle fix (RN only) - `666da0c`
- `useKeyboardIsOpen` existed only as `.android.js`, so the iOS bundle failed. Renamed to `.native.js` ([useKeyboardIsOpen.native.js](../app/utils/useKeyboardIsOpen.native.js)).

---

## 6. Song requests through a companion service (Moderato only, pattern is general)

Search shows results from the user's library (`search3`) and, below, a **Get more songs** section from the external catalogue. Commits `849e821`, `b1f8949`, `7c3122e`.

Companion API used ([app/utils/songService.js](../app/utils/songService.js)):

| Call | Purpose |
|---|---|
| `GET /v1/me` | who the service signed you in as |
| `GET /v1/search?q=&limit=` | `{ items, albums, catalogError? }` |
| `GET /v1/albums/:id` | album plus tracks, each requestable |
| `POST /v1/songs/request` `{ trackId }` | returns `{ job }` |
| `GET /v1/jobs/:id` | poll every 1s until `done` or `failed`; `done` carries `subsonicId` |

Client behaviour worth reusing:
- **Job progress UI**: six steps (`queued, resolving, downloading, tagging, scanning, done`) drawn as a segmented bar under the row, with plain-language labels.
- **Tap = get and play, download icon = add only** (`7c3122e`). Rows already in the library show a check.
- **After `done`, fetch the track with the standard `getSong?id=<subsonicId>`** and play it through the normal player. Nothing in the player needed to know about the service.
- **Only the latest tap plays**: a ref holds the last tapped id so an earlier request that finishes late does not interrupt playback.
- **Album "Get album" / "Add album"**: request every track at once (the service downloads one at a time); the first ready track starts playback, the rest are appended to the queue as they arrive, in album order. Button text switches to "Play album" once everything is in the library.
- **Degrade quietly**: when the service is unset, search shows a hint instead of failing; when only the catalogue is down (`catalogError`), library results still show.
- **Stale responses**: each catalogue search increments a counter and ignores replies from older queries.

---

## 7. Build and CI (Any Expo / RN client) - `ac86054`

- GitHub Actions workflow that builds an **unsigned iOS `.ipa`** on `macos-15` without an Apple developer account, for sideloading ([.github/workflows/ios.yml](../.github/workflows/ios.yml)): `expo prebuild -p ios`, `pod install`, `xcodebuild ... CODE_SIGNING_ALLOWED=NO`, zip `Payload/*.app`.
- `app.config.js` gets an `ios` block: own bundle id, `supportsTablet`, `UIBackgroundModes: ["audio"]` (required for background playback), and the ATS exception for http servers.

---

## 8. Porting checklist

Ordered by value for effort:

1. Empty, error and offline states with a retry action (4).
2. Labelled icon buttons, 44px targets, contrast check (2.1, 2.2).
3. Fix the http check to be mixed-content aware (5.1).
4. Persist settings on change (5.3).
5. Admin actions as visible buttons, for example Rescan library (3.5).
6. Skeleton loaders with a timeout (4).
7. Header, full-player tabs, mini-player gestures (3.1, 3.3, 3.4).
8. Token-signed requests to a companion service (5.2), then the request flow (6).

## 9. Known gaps in these PRs

- Not run on a device; gestures and layout need a visual check. Lint passes and the web bundle builds.
- New strings (Try again, No playlists yet, Rescan library, player labels, song-service texts) are English only. Other locales fall back to English.
- Commit `2746e9c` removes `react-native-vector-icons` one commit before imports are switched, so the tree only builds again from `3154675`. Squash or reorder if cherry-picking.
- The song-service job labels in `songService.js` are hardcoded English, while the UI strings use i18n keys (`songService.job.*`).
