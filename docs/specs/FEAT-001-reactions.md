# Spec: FEAT-001 — Video reactions

**Intent:** [docs/intent/FEAT-001-reactions.md](../intent/FEAT-001-reactions.md) (accepted by PM, 26 Nov 2026) · **Issue:** Prad-n/plyr#4 · **Status:** Draft for review · **Date:** 26 Nov 2026

This spec turns the accepted intent into requirements and a design for the Plyr 3.8.5 codebase. It adds one option (`reactions`), one control (`reactions`), one event (`reaction`) and one storage key (`reactions`), following the extension points in the README. Anything the intent asks for that this change can't deliver is listed under [Flags](#flags-what-this-change-cant-do-or-needs-a-decision).

## 1. Scope

In scope (phase 1):

- A brand-level `reactions` option, off by default, that a brand turns on once for its site or app (in the constructor options, `Plyr.defaults`, `Plyr.setup()`, or the existing `data-plyr-config` attribute). It holds no per-video settings.
- A per-video ID, separate from `reactions`: a `data-plyr-video-id` attribute on the `<video>` (like the existing `data-plyr-embed-id`), or a top-level `videoId` option for players created in JavaScript.
- A **React** button in the controls bar, and a reaction row (a small bubble above the button) with up to 7 reactions.
- One reaction per viewer per video: pick, switch, or remove (pick the same one again).
- The viewer's reaction remembered in `localStorage` per video ID, using Plyr's existing `Storage`.
- A `reaction` event with `video_id`, `reaction`, `channel` and `brand`, fired on every change.
- Keyboard, touch and screen-reader support.
- HTML5 `<video>` only (the brands' own files).
- Types (`plyr.d.ts`), docs (`docs/USAGE.md`, `CONTROLS.md`), tests, and a vertical (9:16) demo with reactions turned on.

## 2. Requirements and acceptance criteria

| ID  | Requirement                                                                                                                                               | Acceptance criteria                                                                                                                                                                                                                                                                                                                                                                                                              |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | **Off by default.** No change for players that don't turn it on.                                                                                          | With default options: no `[data-plyr="reactions"]` element, no `reaction` events, nothing written under `reactions` in storage. Existing smoke tests pass unchanged.                                                                                                                                                                                                                                                             |
| R2  | **Turned on per brand, in setup or with a `data-` attribute.** The `reactions` option has no per-video fields.                                            | With `<video data-plyr-video-id="v1">`, `new Plyr(el, { reactions: { enabled: true } })` renders the React button. So does `data-plyr-config='{"reactions":{"enabled":true}}'`, and so does `Plyr.setup('.js-player', { reactions: brandConfig })` across several videos, each with its own ID.                                                                                                                                  |
| R3  | **Each video has the brand's own ID**, from `data-plyr-video-id` on the `<video>` or the top-level `videoId` option (the attribute wins if both are set). | If reactions are on but the video has no ID, that player doesn't render the button and logs a warning (`debug` console). No events fire. Other players on the page are unaffected.                                                                                                                                                                                                                                               |
| R4  | **HTML5 video only.**                                                                                                                                     | The button isn't rendered for audio, YouTube or Vimeo, even when `enabled` is true.                                                                                                                                                                                                                                                                                                                                              |
| R5  | **React button opens a row of reactions in a bubble above it.**                                                                                           | Clicking the button shows the row (`hidden` removed, `aria-expanded="true"`). Clicking it again, pressing Escape, or clicking outside closes it (`aria-expanded="false"`).                                                                                                                                                                                                                                                       |
| R6  | **Reactions: up to 7, chosen by the brand; default 👍 ❤️ 👏 😲 😢 🔥 😡.**                                                                                | Default row shows the 7 codes in this order: `thumbs_up`, `heart`, `clap`, `wow`, `sad`, `fire`, `angry`. `options: ['fire', 'heart']` shows only those two, in that order. Unknown codes and duplicates are dropped with a warning; at most 7 are shown.                                                                                                                                                                        |
| R7  | **Pick one: row closes and the button shows the chosen reaction.**                                                                                        | After picking `heart`, the row is hidden, the button shows ❤️, `aria-pressed="true"` on the ❤️ item, and the button's accessible name says the current reaction (for example "React, current reaction: Heart").                                                                                                                                                                                                                  |
| R8  | **One reaction per viewer per video; switch; same again removes.**                                                                                        | Pick `heart` then `fire`: stored value is `fire`, only `fire` is pressed. Pick `fire` again: stored value removed, nothing pressed, button back to its default icon.                                                                                                                                                                                                                                                             |
| R9  | **Remembered on the device across visits.** Nothing sent to a server.                                                                                     | A new player with the same video ID (after `destroy()`, or on reload) shows the stored reaction. A different video ID shows none. The player makes no `fetch`/XHR call for reactions.                                                                                                                                                                                                                                            |
| R10 | **Minimal data.** Only video ID and reaction code on the device.                                                                                          | Storage holds `reactions: { "<videoId>": "<code>" }` inside Plyr's existing `plyr` key; a removed reaction deletes its entry. Nothing else is added.                                                                                                                                                                                                                                                                             |
| R11 | **`reaction` event for analytics, with `video_id`, `reaction`, `channel`, `brand`.**                                                                      | Every change fires `reaction` (via `player.on('reaction', …)` or a listener on the container). `event.detail` has `video_id` (the video's ID from R3), `reaction` (the code, or `removed`), `channel` and `brand` (from setup, unchanged), plus Plyr's usual `detail.plyr`. Restoring a stored reaction on load does **not** fire an event.                                                                                      |
| R12 | **`channel` and `brand` set once at setup.**                                                                                                              | `reactions: { channel: 'Web' \| 'Mobile', brand: '<name>' }`; values are passed through as given. Default `channel` is `'Web'`, default `brand` is `''`.                                                                                                                                                                                                                                                                         |
| R13 | **No analytics vendor code.**                                                                                                                             | No vendor names or calls in `src/`. The brand maps the event.                                                                                                                                                                                                                                                                                                                                                                    |
| R14 | **Accessible: keyboard, touch, screen readers.**                                                                                                          | Button: `aria-haspopup`, `aria-expanded`, `aria-controls`. Row: `role="group"` with a label; each item is a `<button>` with a text label ("Heart") and `aria-pressed`. Opening moves focus to the current (or first) reaction; Left/Right/Home/End move between reactions; Escape closes and returns focus to the React button; Space/Enter on an item doesn't toggle playback. Touch targets ≥ 44 × 44 CSS px on touch devices. |
| R15 | **Works on a 9:16 player on phone-sized screens.**                                                                                                        | In the demo at 360 × 640 the React button sits in the controls bar and the 7-item row fits inside the player (no horizontal overflow, no clipping). Checked by hand in the demo; jsdom can't lay out.                                                                                                                                                                                                                            |
| R16 | **No performance cost: no extra network requests, no start-up delay, small file growth.**                                                                 | No new sprite icon and no new requests (the icon is an inline SVG and reactions are emoji text). The row is built only when enabled. JS and CSS size growth is measured (min + gzip) and reported in the PR against the tech lead's budget (see Flag F3).                                                                                                                                                                        |
| R17 | **Frozen build settings.**                                                                                                                                | No change to the build target, CSS toolchain or pinned PostCSS versions. `pnpm build:player`, `pnpm lint`, `pnpm fmt:check`, `pnpm typecheck` and `pnpm test` pass.                                                                                                                                                                                                                                                              |
| R18 | **Testable before launch: demo page with reactions on and a vertical sample video.**                                                                      | `demo/index.html` has a 9:16 player with reactions on, `ratio: '9:16'` set **at creation** (the runtime `player.ratio` setter is broken, Prad-n/plyr#5, not fixed here), an openly licensed vertical video with its credit and licence, and an on-page log of `reaction` events.                                                                                                                                                 |

## 3. Design

### 3.1 Option

Added to `src/js/config/defaults.js` and `Options` in `plyr.d.ts`:

```js
// Brand-level: set once by the brand's site or app, the same for every video.
reactions: {
  enabled: false,
  channel: 'Web',  // 'Web' or 'Mobile'; passed through to the event
  brand: '',       // brand name; passed through to the event
  options: ['thumbs_up', 'heart', 'clap', 'wow', 'sad', 'fire', 'angry'],
},

// Per video: the brand's own ID. Top-level, not part of `reactions`.
videoId: null,
```

The video ID is read from `data-plyr-video-id` on the media element first, then from `config.videoId`. Using a `data-plyr-*` attribute on the element follows the existing `data-plyr-provider` and `data-plyr-embed-id` pattern, so a page can set up many videos with one shared `reactions` config.

The 7 known codes and their emoji are a fixed map in the reactions module. `options` selects and orders from that map. Labels come from `i18n` (`react`, `reactionCurrent`, and one label per code, for example `heart: 'Heart'`), so brands can translate them like any other Plyr label.

### 3.2 Control

- `'reactions'` is added to the default `controls` list, before `'captions'`. It renders only when R2–R4 are met, so the default list has no visible change. If a brand passes its own `controls` array without `'reactions'` and turns the feature on, the control is inserted before `'fullscreen'` (or at the end). Custom controls HTML (string or function) is not supported (see Out of scope).
- Selectors: `selectors.buttons.reactions = '[data-plyr="reactions"]'`; `listeners.reactions = null`, so a brand handler in `config.listeners` can run first, as for other controls.
- Markup, created in a new module `src/js/reactions.js` and called from `controls.create()`:

  ```html
  <div class="plyr__controls__item plyr__reactions">
    <!-- + plyr__reactions--selected when a reaction is set -->
    <button
      type="button"
      class="plyr__control"
      data-plyr="reactions"
      aria-haspopup="true"
      aria-expanded="false"
      aria-controls="plyr-reactions-{id}"
    >
      <svg viewBox="0 0 18 18" aria-hidden="true" focusable="false">…inline smiley…</svg>
      <span class="plyr__reactions__current" aria-hidden="true">❤️</span>
      <span class="plyr__sr-only">React</span>
    </button>
    <div class="plyr__reactions__row" id="plyr-reactions-{id}" role="group" aria-label="Reactions" hidden>
      <button type="button" class="plyr__reactions__item" data-reaction="thumbs_up" aria-pressed="false">
        <span aria-hidden="true">👍</span><span class="plyr__sr-only">Thumbs up</span>
      </button>
      …
    </div>
  </div>
  ```

- The icon is an inline SVG, not a sprite icon, because `iconUrl` defaults to the 3.8.5 CDN sprite, which has no reaction icon (README, Known quirks). This also avoids any extra request.

### 3.3 Behaviour (`src/js/reactions.js`)

A plain module with methods called as `fn.call(player)`, like the other modules.

- `setup()`: checks R2–R4, resolves the video ID (attribute, then option), normalises `options`, reads the stored reaction for that ID, and updates the button without firing an event.
- `toggleRow(show)`: shows/hides the row, updates `aria-expanded`, adds a container class (`plyr--reactions-open`) so the controls don't auto-hide while the row is open, and manages focus.
- `select(code)`: same as current → remove; otherwise set. Updates storage, the button and `aria-pressed`, closes the row, returns focus to the button, then fires `reaction`.
- Keyboard handling sits on the row (Left/Right/Home/End/Escape) and stops these keys reaching Plyr's global shortcuts (seek, volume). A document click outside closes the row, as with the settings menu.

### 3.4 Event

`triggerEvent.call(player, player.media, 'reaction', false, { video_id, reaction, channel, brand })`, with `'reaction'` added to `config.events` so it's re-dispatched to the container and reaches `player.on`. Added to `PlyrEventMap` in `plyr.d.ts` with a typed `detail`.

### 3.5 Storage

Stored in Plyr's existing `localStorage` object (`config.storage.key`, default `plyr`) as `reactions: { [videoId]: code }`. `Storage.set()` deep-merges, so it can't delete a nested entry; a small additive `Storage` method replaces one top-level key wholesale so removal deletes the entry. Existing keys and behaviour don't change. If storage is blocked or `config.storage.enabled` is `false`, reactions still work and fire events for the session but aren't remembered.

### 3.6 Styles

New `src/sass/components/reactions.scss`, imported in `plyr.scss`, BEM names checked by Stylelint. The row is positioned above the button like the settings popup, right-aligned to the button, with `max-width` limited to the player width and wrapping if needed. Uses existing CSS custom properties (menu background, radius, shadow) so brand theming carries over. No toolchain change.

## 4. Tests

New file `tests/reactions.test.js` (Vitest + jsdom, same mocks as the smoke tests):

1. Off by default: no button, no `reaction` events, no `reactions` storage key (R1).
2. Turned on with options, with `data-plyr-config`, and with one shared config across two videos with different IDs (R2).
3. Video ID from `data-plyr-video-id`, from the `videoId` option, and the attribute winning over the option; no ID: no button, warning logged (R3). Audio element: no button (R4).
4. Button opens and closes the row; `aria-expanded` follows; Escape and outside click close it (R5, R14).
5. Default set and order; brand subset and order; unknown codes and duplicates dropped; max 7 (R6).
6. Pick: row closes, button shows the emoji, `aria-pressed` set; event fired with all four fields (R7, R11, R12).
7. Switch and remove: storage updated, removal sends `removed` and deletes the entry (R8, R10).
8. Remembered: new player with the same video ID restores the reaction without firing an event; another video ID shows none (R9, R11).
9. Storage blocked or disabled: still works and fires events, nothing stored (R3.5).
10. Keyboard: focus moves into the row on open, arrows/Home/End move focus, Space on an item doesn't play the video (R14).
11. No network: `fetch` and `XMLHttpRequest` aren't called during setup or a reaction (R9, R16).
12. `ratio: '9:16'` at creation gives `player.ratio === '9:16'` (R18; guards the demo setup, not the #5 setter).

Plus: the existing 5 smoke tests unchanged, `pnpm lint`, `pnpm fmt:check`, `pnpm typecheck`, `pnpm build:player`, a size comparison of `dist/` before and after, and a manual check of the demo at 360 × 640 (R15).

## 5. Out of scope

From the intent: server-side storage, counts or totals, user accounts, moderation, YouTube and Vimeo, native (non-web) players, consent handling, and the brands' analytics mapping.

Also out of scope for this change:

- Fixing the `player.ratio` setter (Prad-n/plyr#5).
- Changing the video ID after setup or on a `player.source` change: one video ID per player instance in phase 1.
- Custom controls HTML (`controls` as a string or function) and custom (non-default) reaction codes or emoji.
- HLS (`.m3u8`) support.
- A public JavaScript API for reactions beyond the option and the event.

## 6. Flags: what this change can't do or needs a decision

- **F1 — Engagement target (5% of plays react in month 1)** can't be met or measured by the player. It depends on rollout and on the brands' analytics. The player supplies the `reaction` event; measuring plays and reactions is for the analytics teams.
- **F2 — "Analytics works in UAT with all four fields"** can only be partly verified here: tests check the event and its fields. Seeing it in Adobe Analytics needs a brand's UAT setup and mapping, which is out of scope.
- **F3 — File size budget** is "set by the tech lead" and isn't set yet. The PR reports the measured min + gzip growth of `plyr.min.js` and `plyr.css`; the tech lead needs to confirm it's within budget.
- **F4 — "Up to 7 reactions, chosen by each brand"** is read as: a brand picks and orders from the 7 default codes. The intent says the event's `reaction` is "one of the codes above", so new codes or custom emoji aren't supported. PM to confirm.
- **F5 — `channel` values** are passed through as given; the player doesn't detect web view vs browser (intent note 3).
- **F6 — HLS:** not covered. If brands stream `.m3u8`, they need hls.js alongside Plyr; reactions would still work because they don't depend on the source type (intent note 2, needs TL confirmation).
- **F7 — Storage settings:** if a brand sets `storage.enabled: false`, reactions aren't remembered across visits. That's consistent with how Plyr treats volume and speed, but differs from "remembered until the viewer clears their data".
- **F8 — Consent:** `localStorage` use without consent handling is accepted for phase 1 by the intent, but must be revisited before a real launch.
- **F9 — Phone layout (R15)** is checked by hand in the demo; there's no automated visual test.
