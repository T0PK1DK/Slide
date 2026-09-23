# Slide — VIA design system

The night HUD, premium pass. Source of truth for any agent touching `src/styles.css`.
Skin lives in the **VIA skin** block at the bottom of `styles.css` — add new component styles there, using these tokens.

## Tokens

| Token | Value | Use |
|---|---|---|
| `--bg` | `#07080a` | App ground |
| `--glass` / `--glass-2` | `rgba(15,16,18,.86)` / `.96` | Panels over the map |
| `--surface` | `#16171a` | Cards, inputs, chips inside panels |
| `--line` | `#26272b` | 1px borders |
| `--text` | `#f4f3ef` | Primary text |
| `--muted` | `#a9a8ae` | Secondary text (≥4.5:1 on panels) |
| `--faint` | `#8c8b92` | Micro labels only |
| `--glow` | Garage pick, default `#f0a04b` copper | The ONE accent: route, maneuver tile, primary button, selected states |
| `--danger` | `#e5534b` | Off-route, over-limit, End |
| `--lift` | inset 1px white 6% | Top highlight on every panel |

## Type

- **Geist** for UI. **Geist Mono** for micro labels, speeds, posted-speed chip, status.
- Big numerals (distance, ETA, duration) are **weight 200**, tight tracking. Instructions and street names are **600**. Never thin type under 20px.
- Micro labels: mono, 10–11px, uppercase, `.16em` tracking.

## Rules

1. One accent. Everything else greyscale. Red only for danger.
2. Radii: panels 24–30px, cards 16–18px, pills 999px. Touch targets ≥44px.
3. Speed-limit sign is the **US regulatory** rectangle (white, black border), not the EU red ring.
4. No fake data: no traffic coloring until a real source exists (HANDOFF rule).
5. Keep the night HUD (HANDOFF rule 6). A high-glare daylight theme is a future opt-in toggle, never the default.

6. **The wordmark is SLIDE.** "VIA" is the name of this skin, not the product. The canvas's `VIA` pill becomes `SLIDE`.
7. Contrast was checked against the canvas values: `--faint` #8C8B92 on `--surface` is 5.3:1 and `--muted` is 7.6:1, so both pass. The track grey `#4A4B51` is 2.1:1 and may **only** be used for non-text bars, never for text or a state that has to be told apart.

---

## Screen build spec (VIA canvas → Slide)

Canvas: https://claude.ai/artifact/3nbD5TfjZeoWbQEyf5yXu2 (10 artboards: 390×844 phone, CarPlay 800×480).
Each screen below says what to **keep** from the canvas, what to **change** so it fits Slide's product rules,
and which shipped pattern it's grounded in. Recon sources are listed at the end.

The biggest correction is the same on four screens: the canvas assumes **live traffic and crowd reports**
(a "Slow / Stopped" bar, "N drivers confirmed", "Is it still there?"). Slide has neither, and HANDOFF rules 3
and 4 plus "never fake traffic" forbid inventing them. Every place those appear gets swapped for the
**Effort events** from `docs/STRATEGY.md` (lefts, signals, merges, posted-speed drops), which are real, countable
and the product's point.

### 01 Explore (map-first home)
- **Keep:** the bottom sheet with "Where to?" at weight 200 / 34px, the 56px search field, and Home / Work / Add tiles showing drive time.
  Grounded in Apple / Google Maps' collapsed sheet and the existing phone "Where to?" pill.
- **Change:**
  - Wordmark → SLIDE.
  - Drop the weather chip (`89°`): it has no data source in the stack and doesn't serve the core idea.
  - The "Crash on [ROAD] · LIVE" card shows **only** when a real FL511/FDOT incident source exists (Phase 3). Until then it's a "Your usual: 4 fewer lefts than fastest" card.
- **Add** (STRATEGY "living map"):
  - Your garage car in 3D at your location.
  - The "Miami driven %" pill.
  - Explore lenses **Driven · Usual · Pain points**, shown only when parked.

### 02 Search
- **Keep:** the focused field with an accent border, category chips, and result rows ≥68px with drive time on the right. "Along your route home · no detour" is a strong pattern.
  Grounded in Google Maps' "search along route".
- **Change:**
  - The category chips (Gas / Coffee / Parking / EV) depend on Photon's POI coverage. Hide a chip when a Miami test query returns nothing.
  - Row times come from one Valhalla matrix call, not one `/route` per row, to stay within public rate limits.

### 03 Place
- **Keep:** the title at weight 300, "Directions" as the 2-wide primary button with "14 min · 6.2 mi", and the Save / Share / Call tiles at 64px.
- **Change:**
  - "Best time to leave" needs historical speeds we don't have. Replace it with **Leave by / Arrive by** using `leaveByForTarget()`.
  - The parking card is fed by the **TapN stub** (`src/lib/sources/tapn.ts`, Phase 6), behind its flag. With the flag off, hide the card.

### 04 Route preview (the most important screen)
- **Keep:**
  - The Leave now / Leave at / Arrive by segmented pills.
  - Two radio cards with a big thin time.
  - Map time pills (selected in accent, the other in surface).
  - A 60px Start button.

  Grounded in Grab's route card with a plain reason ("2 traffic lights") and Google's grey alternates with time callouts.
- **Change:**
  - **Card titles are Slide vs Fastest**, not "Fastest · I-95 / No highways". The Slide card is first and preselected.
  - **The sub-line is the why-line**, e.g. "4 fewer lefts · 2 min slower" or "Smoothest AND fastest", straight from the ranking event list.
  - **The strip under each card is an Effort strip, not traffic:** ticks for lefts, signals, merges and posted-speed drops along the route's length. The legend becomes `Left · Signal · Merge · Speed drop`, told apart by glyph shape, not by colour alone.
  - When no route fits the +10% window, show one card with "Fastest is also the smoothest we found".
  - Keep "Avoid tolls" and "Avoid highways" in Profile, not here.

### 05 Active navigation (Drive)
- **Keep:**
  - The maneuver banner: distance thin + big, street name at 600, and a "Then NE 2nd Ave" row.
  - Lane guidance (`aria-label` "use the right two lanes").
  - The US limit sign next to the current speed.
  - An arrival block and a calm End button.

  Grounded in the Apple / Google maneuver banner, Grab's distance-first banner with a "then" row, and Tesla's limit next to speed.
- **Change:**
  - **Remove "Report a hazard"** (no crowd reports).
  - The timeline chip "SLOW · I-95 · +3 MIN" becomes the **trip timeline**: progress, pace-ghost delta, and ticks for the next posted-speed drop and the next left.
  - Mute / Route overview / Search along route stay as 44px icon buttons.
- **Add (Phase 5):**
  - A chase camera.
  - A glowing lane ribbon.
  - 3D car + ghost cars.
  - Posted-speed lookahead ("Hold 45 → 30 in 0.4 mi").

### 06 Hazard reroute
The canvas version is a Waze pattern. Rebuild it so it complies with the product rules, or cut it until a source exists.
- **Keep:** the red alert sheet, the Stay vs New route comparison as two arrival times, and an auto-accept ring on the recommended option (Google Maps precedent; 8s is fine).
- **Change:**
  - The source must be **official**: an FL511 / FDOT closure or a drawbridge opening. The label becomes e.g. "FL511 · Lane closure · 0.8 mi".
  - **Remove** "[N] drivers confirmed" and the "Is it still there? Still there / Cleared" row. That's crowd reporting.
  - The new-route card also shows its Effort cost: "Saves 6 min · 2 more lefts".
  - Never auto-accept a reroute that is **less smooth AND** saves under 2 min.

### 07 Arrival
- **Keep:** "ARRIVED · 12:47 PM", the destination at weight 300, the stat row (drive time / distance), the parking entrance row, "Pin where I parked" (on-device only), and Done.
- **Change:**
  - "SAVED 6 min" has no baseline in Slide. Replace it with **"vs your pace ghost −0:42"** and **"4 fewer lefts than fastest"**.
  - Add "+0.3% Miami driven" when the drive covered new road (the day-30 hook).
  - The parking row comes from the TapN stub, behind its flag.

### 08 Active nav — Daylight
- **Keep:** the full light palette (ground `#F2F0EB`, cards `#FFFFFF`, text `#111214`), identical layout to Drive.
- **Change:** it's an **opt-in** theme. Profile's "Auto daylight mode" defaults **off** (Rule 5). The accent stays the garage colour, darkened only if it falls below 3:1 on white.

### 09 Profile & vehicle
- **Keep:** the vehicle card (make/model, fuel, SunPass, plate), the Driving toggles (Avoid tolls "when it costs under 5 min", Avoid highways, Auto daylight, Voice, Speed alerts), and Home / Work.
- **Change:**
  - "Speed alerts · chime when over the limit" is allowed. It never suggests a speed, it only warns.
  - SunPass and plate are stored only through `garage.ts`, on-device.
- **Add:**
  - The **Slide window** setting ("Accept up to +10% for a smoother route").
  - The **Garage** entry: the 3D car, paint, glow, trail and camera, which already exist in `garage.ts`.
  - "Miami driven %" with a **Clear my drive history** button (privacy).

### 10 CarPlay
- Reference only. Real CarPlay needs a native iOS app and an Apple entitlement (HANDOFF known gaps).
- Use this layout for **phone landscape in a mount**: maneuver on the left, map on the right, limit sign + ETA.
- Remove its "Report a hazard" button, same as Drive.

### Reference: "SEKAI" night-network look (owner, 2026-09-23)
A desktop transit-ops dashboard the owner likes: a satellite night map with city lights, a thin white route line with a
soft glow, circular glowing markers with pulse rings, glass cards with big thin numerals, and a Map / Satellite / Terrain switch.
It's a **look** reference; its layout is a fleet control room, not a phone in a car mount.

| Take | How it lands in Slide |
| --- | --- |
| Night map with warm city lights, water near-black, roads faint | Night basemap target (with the Snap street-level ref). Satellite imagery needs a licensed tile source; until then, get the feel from OpenFreeMap dark + a warm tint on roads and buildings |
| Thin white route core + wide soft glow; the vehicle as a glowing circle with a pulse ring | Route ribbon and the player / ghost markers in Plan and Explore (Drive keeps the 3D car) |
| Floating glass card: "2.5 min · to next stop" with a sparkline | The Route preview time pill and the Drive next-maneuver card; the sparkline becomes the posted-speed profile |
| Big weight-200 numerals (78.3%), mono micro labels | Already in the VIA tokens; this confirms them |
| Status dots (green active / red alert) | Only for real states: GPS locked, offline, off-route |
| Map / Satellite / Terrain segmented switch | The existing 3D / FLAT skin toggle, restyled as this segmented control |
| **Do not take:** "Congestion Predicted · AI Analysis", the red congestion heat, "+18 min delay" | Predicted traffic with no data behind it is fake traffic (product rule). Only show it once a licensed live or historical speed source exists |
| **Do not take:** the three-column desktop layout, fleet list, passenger-flow chart | Not a driver screen. A desktop "trip review" page could reuse the style later |

**Built (2026-09-23):** the full dashboard as the **Command view** (`src/hud/command.ts`; every SEKAI panel mapped to real Slide data, see HANDOFF session log), plus the basemap palette + route ribbon in `src/lib/maplook.ts`, the "you" marker in `src/map/you.ts`, glass / card / FAB / status-dot styles in the *Night network* block at the end of `src/styles.css`.

### Missing from the canvas (design these next)
- **Onboarding:** location permission with a reason line, then set Home / Work, then pick your car. Three screens, skippable.
- **Offline / no-route:** a calm sheet "Can't reach the route engine — retrying" with the last cached route if one exists; "No smooth route inside +10% — showing fastest".
- **Skeleton HUD:** the Explore sheet and search field paint before the map. The map fades in when the style loads (Phase 2).
- **Garage:** a 3D car turntable with paint / glow / trail and the Miami driven map.

### Recon sources
- Grab route choice with a countable reason: https://mobbin.com/screens/d3e54b54-989f-41bb-8497-accc33bf451e
- Grab distance-first maneuver banner with a "then" row: https://mobbin.com/screens/699363da-045c-4dbb-80f3-4ed394f29195
- BlaBlaCar route choice labelled by what it avoids ("No tolls"): https://mobbin.com/screens/fa750de7-2392-452e-b580-e06e5afedcb6
- Tesla, Apple Maps, Google Maps and Waze drive views: from the shipped products, as summarised in `docs/STRATEGY.md` (Mobbin doesn't index them).
- Owner screenshots: Waze on CarPlay, Snap Map (see STRATEGY "3D living map").
