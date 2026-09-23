# Slide strategy

Phase 0 (Magi pass) and Phase 1 (design recon). No code changed for this doc.
Scoring changes it proposes land in Phase 3, and `docs/PRODUCT.md` is updated at that point.

---

## Phase 0 — the real question

**What makes a Miami driver open Slide instead of Google Maps or Waze on day 1, and still open it on day 30?**

Google and Waze answer one question: *what is the fastest way there right now?* They have live traffic,
and Slide does not. That is the honest starting point. If Slide competes on ETA, it loses, because
the public Valhalla server has no traffic feed and Slide will not fake one.

So Slide has to win on a question they don't answer:

> **"What is the least stressful way there that doesn't cost me real time?"**

- **Day 1:** the first route card has to show something Google can't: *"4 fewer lefts, 1 fewer merge, 2 min slower"*,
  or *"Smoothest AND fastest."* The driver can check that claim during the drive: they count the lefts
  they didn't have to make. A claim they can verify builds trust faster than an opaque score.
- **Day 30:** habit comes from the commute, not from exploring. Home/Work, the same route every day, and
  a pace car of *your own* last run on that route. Slide becomes the app that remembers how *your* drive
  went. Google doesn't show that, and Waze buries it under social reports.

### First principles: what "smooth AND fast" means, measured

"Smooth" has to be something a driver could count from the passenger seat. Every term below comes from
Valhalla `/route` maneuvers and `/trace_attributes` edges we already fetch, or from a named open source
(Phase 3):

| Event | How it's measured | Proposed weight (stop-equivalents) |
| --- | --- | --- |
| Unprotected left | left maneuver (types 14–16) at a node with no signal, crossing a road of equal or higher class, or with ≥2 opposing lanes | 2.0 |
| Protected / signalled left | left maneuver at a signalled node | 1.2 |
| U-turn | types 12–13 | 2.4 |
| Right turn | types 9–11 | 0.6 |
| Traffic signal passed | `edge.traffic_signal` / node signal on the path | 0.5 (roughly a 50% chance of a red) |
| Stop sign | `edge.stop_sign` where exposed | 0.8 |
| Lane change needed | lane count changes on the same road, or a turn onto a multi-lane road that must be crossed for the next maneuver within 0.3 mi | 0.7 |
| Speed drop | posted limit falls ≥10 mph and recovers within 1 mi (the 45→30→45 pattern) | 0.6 |
| Merge / ramp | types 17–25 | 0.5 (1.0 if the merge distance is under ~200 m, when the data shows it) |

**Effort** = the sum of those weights for the whole trip. The unit reads as "about this many stops".
The weights are a starting point. We tune them against drives the owner actually does, not against a theory.

**The Slide route contract (Phase 3):**

```
T_fast   = fastest route time (same engine, same data, apples to apples)
window   = T_fast × 10%       (configurable; proposed clamp 1–6 min, see decisions)
candidates = routes with T ≤ T_fast + window
Slide    = argmin Effort over candidates   (tie → faster)
if Slide == fastest → "Smoothest AND fastest"
if no candidate beats fastest on Effort → pick fastest and say "Fastest is also the smoothest we found"
```

Today `rankRoutes()` picks the highest `slideScore` **with no time bound**, so a route 20 minutes slower
can win. That is the most serious gap in the current product, and fixing it is the core Phase 3 work.

### Three perspectives

**Daily Miami commuter** (Kendall → Brickell, 35 min, the same route every day)
- Hates the unprotected left across US-1, the I-95 express-lane weave, and the drawbridge on the Miami River.
- Will trade 2 minutes to skip a left across six lanes, but not 10 minutes.
- Needs: Home/Work in one tap, an honest ETA, and a heads-up for known pain points.
- Day 30 hook: their own pace ghost, plus "This week: 11 fewer lefts than Google's line."

**Car enthusiast**
- Wants the drive to *feel* good: flowing roads, steady speeds, the 3D HUD, the car in the garage.
- Loves the pace ghost and the garage paint. They'll screenshot and share it.
- Risk: they push Slide toward "racing". Keep ghosts to presence and pace only, and never frame
  anything as "go faster to beat it".
- Needs: 60 fps, the chase cam, their car, and a route that flows.

**New driver** (a teen or someone new to Miami)
- Afraid of unprotected lefts, fast merges and lane changes on I-95. Wants confidence more than speed.
- The "why" line is the product for them: *"No unprotected lefts. One easy merge."*
- Needs: a big next-turn banner, lane guidance *before* the lane change, the posted speed always visible,
  and a calm voice later.
- This is the most loyal segment and the least well served by the incumbents.

### What most people miss

1. **Countable beats clever.** A "Slide score 82" is a number nobody trusts. "4 fewer lefts" is a promise
   the drive proves true turn by turn. The trip timeline on the drive bar should tick those events off as
   the driver passes them, so the proof shows up live.
2. **Miami-specific friction is mapped and open.** Movable bridges (`bridge:movable` in OSM: Miami River,
   the Venetian and Julia Tuttle area, Intracoastal crossings), school zones (county open data), and
   unprotected lefts across six-lane arterials (US-1, Biscayne, 27th Ave). Google treats these as delay.
   Slide can treat them as *stress*, and name them on the card: "avoids 1 drawbridge".

### The 3D "living map" layer (owner direction, 2026-09-23)

The owner shared Snap Map screenshots (3D Bitmoji on a dark map, activity heat, Footsteps "2.4% Explored",
a "Me 1m" trail) and Waze on CarPlay (other drivers as avatars on the route, signal icons, a speed bubble).
The ask: **the same living-map feel, but with cars instead of avatars, so navigating feels like Forza.**

This fits the core idea because it turns the day-30 habit into something you can see. Here's how it maps
without breaking the product rules:

| Snap / Waze idea | Slide version | Needs a server? |
| --- | --- | --- |
| Your 3D Bitmoji standing at your location | **Your garage car in 3D** parked at your location on Explore, idling with headlights; it pulls onto the route when you hit Go | No |
| Footsteps "2.4% Explored" | **"Miami driven: 3.1%"**: every road you've driven glows on your map like a Forza progress map, and the number goes up | No (on-device) |
| Heat blobs of activity | **Your own drive heat**: where you actually drive, used for Home/Work suggestions and "your usual" | No (on-device) |
| "Me 1m" trail line | Your last run's trail, which is what the **pace ghost** replays | No |
| Wazers on the road as avatars | **Ghost cars on the road around you**, simulated today and clearly labeled as such | No, until presence exists |
| Waze signal icons on the route | **Signals, lefts and merges drawn on the route as small icons**: the Effort events made visible | No |
| Friends' Bitmoji at their real locations | **Friends' cars, opt-in only**, deferred until presence is designed | Yes |

Rules this layer must keep:
- **Privacy:** driven roads, heat and trails stay on the device (HANDOFF rule 4). No uploads.
- **Presence later, and opt-in:** friends' live cars need a real presence design (who sees you, when,
  how precisely, and a one-tap "hide me"). Until then, ghosts stay client-side (CLAUDE.md). Real friends
  are never shown while *you* are driving, so nothing tempts you to look at them.
- **No sponsored pins:** Snap's "Top Pick" promotions (the Popeyes "Big Box is Back!" pins) are ads.
  Slide has none.
- **Game vibe ≠ racing:** progress comes from *roads explored* and *calm drives*, never from speed.
  Nothing rewards arriving sooner than the pace ghost.

This changes one earlier call: the Phase 5 "surprise feature" should be **Miami driven %**, the glowing
map of every road you've driven. It's the most Forza-like thing that's also legal, private and sticky, and
the day-30 hook becomes something you can see.

### Recommendation

**Build Slide as "the calm route that doesn't cost you time", and prove it on every card.**
Rank by Effort inside a time window of the fastest route, explain the difference in plain countable words,
and make your own pace ghost the day-30 hook. The 3D HUD and the VIA skin make it feel premium, but they
are not why someone switches apps.

**Confidence: about 70%.** The main risk is the lack of live traffic: at 5:30 pm on I-95 our "fastest"
can be wrong by 10+ minutes, and then "+2 min" is meaningless. Mitigations: show "no live traffic yet"
honestly, pull FDOT/FL511 speeds when they're approved (Phase 3), and lean on relative claims (fewer
lefts), which stay true even when the ETA is off.

**The single most important build decision:**
make **route ranking one pure, tested module** (`src/plan/rank.ts`) that returns, per route, the *event list*
(each left, signal, merge and speed drop with its position), not just a score. The why-line, route card,
trip timeline ticks, voice prompts and pace ghost all read from that same list. Get it right once and
every surface agrees. Get it wrong and each screen invents its own story.

---

## Phase 1 — design recon

Sources: Mobbin (Grab screens, linked below); Mobbin doesn't index Google Maps, Waze, Apple Maps or
Tesla drive views, so those rows are from the publicly shipped products and their published docs and
screenshots. No scraping, and no copied assets.

- Grab route choice with a plain reason, "2 traffic lights · Taken by many Grab drivers":
  https://mobbin.com/screens/d3e54b54-989f-41bb-8497-accc33bf451e
- Grab drive banner, distance-first maneuver with a "then" row beneath:
  https://mobbin.com/screens/699363da-045c-4dbb-80f3-4ed394f29195

### How each app handles the drive

| Surface | Tesla | Apple Maps | Waze | Google Maps |
| --- | --- | --- | --- | --- |
| Drive view | Car centered, low chase cam, surrounding vehicles rendered as grey 3D shapes, road lines drawn | Pitched 3D, detailed landmarks, route as a thick blue ribbon | Flat, cartoon style, high-contrast route | Pitched 2.5D, blue route, traffic colors on the route |
| Next turn | Small card in a corner (large screen) | Big banner, distance in large numerals, then the street; a "then" row for the next maneuver | Top banner, distance + arrow | Green banner, arrow + street, a "then" chip |
| Lane guidance | Lanes drawn on the road itself | Lane arrows in the banner as you get close, active lanes lit | Basic lane arrows | Lane arrows in the banner, active lanes highlighted |
| Speed | Big current speed with the limit sign next to it | Limit sign in a corner; current speed optional | Speedometer turns red above the limit | Limit sign + speed, turns red when over |
| Route choice | Picks one, alternates are hidden | 2–3 cards, time + "fastest"/"fewer tolls" | One route + ETA, alternates are secondary | Grey alternates with "+5 min" callouts on the map; eco route with a leaf and "% less fuel" |

### Borrowed / Rejected / Unique to Slide

| | What | From | Why |
| --- | --- | --- | --- |
| **Borrowed** | Car-centered low chase camera with surrounding vehicles as translucent shapes | Tesla | Gives instant spatial awareness and is the signature feel the owner asked for |
| **Borrowed** | Distance-first maneuver banner in large numerals, street name at 600 weight, a "then" row | Apple Maps, Grab | Readable in the 1.5 s glance budget |
| **Borrowed** | Lane arrows appear only as the maneuver approaches, with the correct lanes lit | Apple / Google | Lane guidance too early is noise; too late is dangerous |
| **Borrowed** | Speed-limit sign next to current speed | Tesla / Google | The posted limit is always visible; this is already in Slide |
| **Borrowed** | Time-delta callouts on alternate routes on the map | Google Maps | Lets the driver compare routes without reading a list |
| **Borrowed** | A plain, countable reason on the route card ("2 traffic lights") | Grab, and Google's eco route | Closest existing pattern to Slide's "why" line; proves drivers read it |
| **Borrowed** | Your own 3D character standing on a dark living map | Snap Map (owner screenshots) | Becomes your garage car in 3D on Explore: the Forza feel before you even drive |
| **Borrowed** | Progress-of-exploration meter ("2.4% Explored") | Snap Map Footsteps | Becomes "Miami driven %", with roads you've driven glowing; on-device only |
| **Borrowed** | Other drivers on the road as characters; signal icons on the route | Waze on CarPlay (owner screenshot) | Ghost cars around you, plus Effort events (signals, lefts) drawn on the route |
| **Rejected** | Sponsored "Top Pick" place pins | Snap Map | Ads. Slide has none |
| **Rejected (for now)** | Friends' live locations | Snap Map | Needs a presence design; opt-in only, never shown while you drive |
| **Rejected** | Police, hazard and social report feed | Waze | Product rule: no police feed, no social hazard network |
| **Rejected** | Traffic-colored route when we have no traffic data | Google | Never fake traffic. The ribbon stays one accent color until a real source exists |
| **Rejected** | Red "you're speeding" speedo as the main speed signal | Waze | Stays calm: we show the posted limit and never suggest speed. A subtle over-limit tint is enough |
| **Rejected** | Hiding alternates entirely | Tesla | Choice between Slide and Fastest *is* the product; it must stay one tap away |
| **Rejected** | Cartoon flat style | Waze | Slide is a premium night HUD, not a game UI |
| **Unique to Slide** | Route choice ranked by Effort within +10% of fastest, with "4 fewer lefts, 2 min slower" | — | The core idea; nobody ranks on countable stress |
| **Unique to Slide** | Trip timeline on the drive bar: progress, pace-ghost delta, posted-speed drops and upcoming lefts as ticks | — | Shows the route's promise coming true while you drive |
| **Unique to Slide** | Your own last run as a pace ghost on the same route | Forza idea, applied to commuting | The day-30 habit; legal because it's pace, not a race |
| **Unique to Slide** | Posted-speed lookahead ("Hold 45 → 30 in 0.4 mi") | — | Already partly built; incumbents only show the current limit |
| **Unique to Slide** | Miami friction named on the card: drawbridges, school zones, unprotected lefts across 6 lanes | OSM + county open data | Local truth that generic routers treat as a few seconds of delay |
