# Slide product notes

## Promise

Give a driver the line they would pick if they knew every street: fewest ugly moves, posted speeds on the rail, an arrival time that matches how the road actually drives.

## Non-goals for v1

- Becoming a social hazard network
- Ad-supported police spotting
- Global POI encyclopedia
- Replacing transit / walking modes

## Scoring (v0)

```
score ≈ 38
      + 42 * road_class_weight
      + 8  * posted_speed_coverage
      - 4.2 * weighted_turns_per_mile
      - 3.1 * signals_per_mile
      - 10 * normalized_speed_variance
```

Clamped 1–99. Displayed next to the route label.

Turns are weighted by how they actually drive, not counted flat:

| maneuver | weight |
| --- | --- |
| u-turn | 2.4 |
| left / sharp left / slight left | 1.8 |
| right / sharp right / slight right | 1.0 |
| roundabout | 0.8 |
| ramp, fork, merge | 0.5 |

An unprotected left waits on a gap in oncoming traffic; a right is slow-and-go.
Counting them equally is what makes a "fewest turns" router pick a line that
drives badly, which is the opposite of the promise above.

## Slide route contract (2026-09-25)

The Slide route is the smoothest line **within +10% of the fastest time** (`SLIDE_WINDOW` in `src/lib/smooth.ts`).

```
T_fast = fastest candidate's duration (same engine, same request batch)
candidates = routes with duration ≤ T_fast × 1.10
Slide pick = highest Slide score among candidates (tie → quicker)
```

- If nothing in the window beats the fastest line, the fastest **is** the Slide pick and wears both tags ("Fastest is also the smoothest line we found").
- A much smoother line that is more than 10% slower is still drawn, but it can never be the Slide pick.
- Candidates come from three parallel requests (Slide costing, Fastest costing, No-tolls costing, each with `alternates: 2`), de-duplicated, capped at 4.
- Tags: **Slide pick**, **Fastest**, and **No tolls** on the quickest toll-free line when the fastest has tolls. Toll status comes from Valhalla's `summary.has_toll`. When it's missing, nothing is shown: no guessing, and no dollar amounts without a price source.

Before this, `rankRoutes()` picked the highest score with no time bound, so a route 20 minutes slower could win.

## Timing contract

- Store duration in seconds internally.
- Display minutes on the card, clock time for arrival.
- Segment time uses expected edge speed, not posted. Posted is shown so the driver can compare “what the sign says” vs “what the model thinks traffic allows.”
- When live speeds exist, expected becomes `min(posted, live)` unless the driver opts into faster-than-limit (they should not; we will not suggest it).

## Voice later

Speak the next posted change before the maneuver:

“Hold 45. In half a mile it drops to 30 for the school zone.”

That is more useful than “continue on.”
