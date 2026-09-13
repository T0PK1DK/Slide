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
      - 4.2 * turns_per_mile
      - 3.1 * signals_per_mile
      - 10 * normalized_speed_variance
```

Clamped 1–99. Displayed next to the route label.

## Timing contract

- Store duration in seconds internally.
- Display minutes on the card, clock time for arrival.
- Segment time uses expected edge speed, not posted. Posted is shown so the driver can compare “what the sign says” vs “what the model thinks traffic allows.”
- When live speeds exist, expected becomes `min(posted, live)` unless the driver opts into faster-than-limit (they should not; we will not suggest it).

## Voice later

Speak the next posted change before the maneuver:

“Hold 45. In half a mile it drops to 30 for the school zone.”

That is more useful than “continue on.”
