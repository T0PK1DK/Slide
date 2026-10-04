# Game layer (logic only)

On-device progress for Slide. Logic and storage — no HUD CSS, no edits to existing screens.
Grim leaves slots on Arrival (XP / badge), a share-card mount, and a 3D-car stage.
Those slots should call `useGameProgress()` and `mountShareCard(el)`.

Nard owns voice and lane data. No server calls in the game layer yet.

## What is scored

A trip is scored from **real GPS samples** the drive loop already has:

| Field | Source | If missing |
|---|---|---|
| `speedMph` | `Fix.speedMph` (GPS or distance/time) | segment skipped |
| `headingDeg` | `Fix.headingDeg` | turn factor skipped |
| `at` | GPS timestamp | segment skipped |
| `postedMph` | route speed band at current progress | limit factor skipped |
| `lon` / `lat` | GPS | distance falls back to speed × time; causeway badge skipped |

No invented traffic, no fake heading, no assumed limit.

## Smooth score (`src/lib/game/smoothScore.ts`)

Distance-weighted mean of the factors that actually exist on each segment (dt 0.3–8 s, not parked):

1. **Pace** — `|Δmph / Δt|`. Full credit ≤ 3 mph/s, zero ≥ 10 mph/s.
2. **Turn** — heading change rate. Full credit ≤ 12°/s, zero ≥ 50°/s. Skipped without heading.
3. **Limit** — at or under the posted sign is full credit. **Closer to the limit is not worth more.** Over the sign tapers; ≥ 10 mph over **zeros that segment**.

Going faster never raises the score. Trip total is 0–100, or `null` when nothing real could be scored.

## XP and levels (`src/lib/game/xp.ts`)

XP comes from **smooth miles** and a **score-only** bonus. Never from peak speed or time saved.

```
xpAtLevel(n) = 40 × (n − 1) × n     // n ≥ 1
```

| Level | XP to reach |
|---|---|
| 1 | 0 |
| 2 | 80 |
| 3 | 240 |
| 4 | 480 |
| 5 | 800 |
| 6 | 1200 |
| 10 | 3600 |

```
trip XP = floor(distanceMi × (score / 100) × 10 + qualityBonus(score))
qualityBonus = 20 if score ≥ 90, 12 if ≥ 75, 5 if ≥ 60, else 0
```

A trip under 0.2 mi (same bar as history) or with `score === null` earns 0.

## Badges (`src/lib/game/badges.ts`)

Bronze / silver / gold. No licensed brands.

| Id | Name | Counts | Bronze / silver / gold |
|---|---|---|---|
| `first-line` | First Line | scored trips | 1 / 3 / 10 |
| `smooth-streak` | Glass Line | consecutive trips with score ≥ 75 | 3 / 7 / 21 |
| `gentle-brake` | Soft Pedal | trips with pace data and no harsh brake | 1 / 10 / 25 |
| `night-owl` | Night Owl | score ≥ 70, started 8pm–5am local | 1 / 5 / 15 |
| `smooth-miles` | Long Slide | miles × score/100 | 10 / 50 / 100 |
| `limit-keeper` | Sign Reader | posted limit present, 0 s over | 1 / 10 / 25 |
| `causeway` | Causeway | GPS inside 450 m of MacArthur or Rickenbacker | 1 / 5 / 15 |

A badge that needs a missing signal does not increment.

## Unlocks (`src/lib/game/unlocks.ts`)

Starter six + Solid / Stripes / Fade stay free (existing Garage unchanged).

| Item | Opens |
|---|---|
| Nimbus (touring coupe) | level 5 |
| Glider (low touring wagon) | Night Owl silver |
| Halo livery | Soft Pedal silver |
| Dusk livery | Night Owl bronze |

`canUseVehicle` / `canUseLivery` are the gates for Grim's picker and stage. The Garage still lists only the starter six / three liveries so this PR does not change screen layout.

## Storage

`localStorage` key `slide.game.v1`. No IndexedDB yet (the blob is small). No network.
`eraseDeviceData()` already deletes every `slide.*` key.

Raw GPS traces are **not** persisted — only aggregates (XP, counts, last trip id).

## Exported API

Import from `src/lib/game` (or `src/lib/game/progress` for just the hook).

```ts
import { useGameProgress } from "./lib/game";

const game = useGameProgress();
```

`useGameProgress()` is a vanilla singleton (not React). Pass `{ store }` only in tests.

### `GameApi`

| Method | Returns | Use |
|---|---|---|
| `get()` | `GameProgress` | Profile / stage: level, XP, badges |
| `subscribe(fn)` | unsubscribe | Re-render a slot when progress changes |
| `preview(input)` | `TripAward` | Arrival preview without writing |
| `commit(input)` | `TripAward` | Persist after a real live-GPS save. Idempotent on `tripId` |
| `beginDrive()` | void | Clear the in-memory sample buffer at Go |
| `recordSample(sample)` | void | Drive loop (already wired in `main.ts`) |
| `samples()` | `TelemetrySample[]` | Debug / tests |
| `lastAward()` | `TripAward \| null` | **Arrival XP/badge slot** and **share-card mount** |
| `canUseVehicle(id)` | boolean | Stage / picker gate |
| `canUseLivery(id)` | boolean | Stage / picker gate |
| `unlocked()` | `{ vehicles, liveries }` | What the stage may show as owned |
| `xpBar()` | `{ level, into, need }` | Level rail |
| `reset()` | void | Tests |

### `GameProgress`

```ts
{
  xp: number;
  level: number;
  trips: number;
  smoothMiles: number;
  totalMiles: number;
  streak: number;
  bestStreak: number;
  counts: Record<BadgeId, number>;
  badges: Partial<Record<BadgeId, BadgeTier>>;
  lastTripId: string | null;
  updatedAt: number;
}
```

### `TripAward` (Arrival + share card)

```ts
{
  tripId: string;
  score: SmoothScore;          // .total is 0–100 or null
  xpEarned: number;
  xpTotal: number;
  level: number;
  leveledUp: boolean;
  badgesEarned: { id, name, tier }[];
  unlocks: { type: "vehicle" | "livery", id, name }[];
  shareCard: {                 // no addresses
    score: number | null;
    xp: number;
    miles: number;
    level: number;
    badge: { name, tier } | null;
  };
  alreadyRecorded: boolean;
}
```

### `DriveInput`

```ts
{
  tripId: string;
  startedAt: number;
  endedAt: number;
  samples?: TelemetrySample[];  // defaults to the live buffer
  distanceMi?: number;          // real GPS miles from the drive log
}
```

### `TelemetrySample`

```ts
{ at: number; speedMph: number; headingDeg: number | null; postedMph: number | null; lon?: number; lat?: number }
```

## Already wired

`main.ts` calls `beginDrive()` on Go, `recordSample()` on each live GPS fix while driving, and `commit()` next to `recordTrip()` when a live drive ≥ 0.2 mi is saved. Arrival copy is unchanged — Grim fills the slots.

## Share card (`src/lib/game/shareCard.ts`)

1080×1350 PNG from `TripAward.shareCard` plus the current ride and livery **names**. Theme: CSS variables `--bg`, `--surface` / `--glass`, `--text`, `--muted`, `--glow`, `--line` when they exist; otherwise a neutral night palette. No addresses, coordinates, map tiles, or times of day.

```ts
import { mountShareCard, shareTrip, buildShareCardView } from "./lib/game";

const input = {
  card: game.lastAward()!.shareCard,
  ride: { name: "Slipstream", livery: "Stripes" },
};

const slot = mountShareCard(el, input); // Grim's mount node
await slot.share();                     // Web Share with a PNG file, else download
await shareTrip(input);                 // same, without a preview node
```

| Export | Use |
|---|---|
| `buildShareCardView(card, ride)` | Pure view: `score, xp, miles, level, badge, ride, livery` |
| `cardLines(view)` | The strings that will be painted (tests + a11y) |
| `readShareTheme(el?)` | CSS tokens or fallbacks |
| `renderShareCardPng(view)` | Offscreen canvas → `image/png` blob |
| `mountShareCard(el, input?)` | Preview into Grim's element. `{ update, share, unmount }` |
| `shareTrip(input)` | `"shared" \| "downloaded" \| "cancelled"` |

Filename is `slide-{score}.png` (or `slide-smooth.png`). Share text is only "Smooth score on Slide".

## Weekly leaderboard (`src/lib/game/leaderboard.ts`)

Local model. **Opt-in defaults OFF.** Week is Monday 00:00 – next Monday 00:00, device local time (`2026-W23`). `rankWeek` never invents friends — it only sorts the entries you pass.

```ts
const board = useLeaderboard();
board.setOptIn(true);                    // required before anything is shareable
board.recordTrip(award.score.total, award.shareCard.miles, endedAt);
const me = board.shareableEntry(handle); // null if opted out or no trips this week
const rows = board.rank([me, ...friends].filter(Boolean), board.weekId());
```

`LeaderboardEntry` fields: `handle`, `weekId`, `smoothAvg`, `trips`, `smoothMiles`. No dest, coords, or clock.

### Sync contract (future backend — not built)

A later PR may upload **only** when `optIn === true`, and only this payload:

```ts
{
  weekId: string;       // local Mon–Sun id, same format
  handle: string;       // already-public @handle
  smoothAvg: number;    // mean smooth score, 0–100
  trips: number;
  smoothMiles: number;
}
```

Rules the server must keep:

1. Refuse the write if the account has not opted in (server-side flag, default off).
2. Return only **mutual friends** who also opted in for that `weekId`. Never a global board.
3. Never accept or return GPS, addresses, dest labels, route shapes, timestamps of day, or raw samples.
4. `smoothAvg` is the telemetry smooth score, not trip time and not peak speed.
5. One row per (user, weekId). Client may retry; last write wins.
6. Stopping opt-in deletes the published row for the current week and stops reads of friends' rows.
7. Transport: existing Supabase session. No new `VITE_` keys. Rate-limit writes (e.g. once per trip commit, not per GPS fix).

Until that lands, `useLeaderboard()` stores `slide.game.board.v1` on the phone. `eraseDeviceData()` wipes it with every other `slide.*` key.

## Later PRs

- Opal-style unlock stage + 3D car
- Arrival slot that calls `mountShareCard` (Grim)
- Friends leaderboard UI + the sync above (opt-in, mutual friends)
