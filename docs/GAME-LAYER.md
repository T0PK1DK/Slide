# Game layer (logic only)

On-device progress for Slide. This PR is **logic and storage only** — no HUD, no CSS.
Grim leaves slots on Arrival (XP / badge), a share-card mount, and a 3D-car stage.
Those slots should call `useGameProgress()` and read `lastAward()` / `get()`.

Nard owns voice and lane data. Do not add server calls here. Friends leaderboard is a later PR.

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

## Later PRs (not this one)

- Opal-style unlock stage + 3D car
- Shareable trip card UI
- Opt-in weekly friends smooth-score leaderboard
