# Slide design research and gap analysis

*2026-10-04, for Grim (design lead), Nard (integration) and Leon (game layer). Read this before touching any UI.*

Slide is a **Waze competitor with a game soul**: the smoothest route within +10% of the fastest, a car you own and customise, and a night HUD that feels like a racing game, all on real data only. This document covers:

1. Why the current design keeps breaking.
2. What the best apps do (research with sources).
3. Every gap between Slide and a Waze-class app.
4. Exactly what to build, in order.

---

## 1. Root cause: why "mistakes" keep happening

`src/styles.css` is **1,169 lines built as 6 stacked layers**, each one overriding the last instead of replacing it:

| Layer | Line | Came from |
|---|---|---|
| Base | 1 | first build |
| VIA skin | 284 | VIA canvas |
| Night network | 427 | SEKAI image |
| Desktop Command | 725 | SEKAI dashboard |
| Themes (Night/Ember/Sand) | 962 | LUMEN |
| Clean pass + Finish pass | 1012, 1144 | Apple recon, audit |

Measured on `main`:

| What | Count | A healthy system has |
|---|---|---|
| Corner radii in use | **16** | ~5 |
| Hard-coded hex colours | **67** | 0 outside the token file |
| Font sizes | **30** | ~9 (a type scale) |
| `!important` | **19** | 0 |

The effect is that every new change fights an older layer. A fix in one place gets undone by a rule 400 lines away, and screens drift apart: the radar was green while everything else was copper, chips overlapped cards, and so on.

**Fix (Grim's first job):** rebuild the stylesheet as **one token-driven system** from the owner's kit in `design/premium-glass-kit/`:
- `css/tokens.css` is the token source.
- `DESIGN-SYSTEM.md` has the rules.
- `COMPONENTS.md` has the parts.

Components may only read `var(--token)`. Delete the layers; never add a seventh.

---

## 2. Research: what the best apps do

Sources are real shipped screens on Mobbin.

### Waze, the competitor ([drive](https://mobbin.com/screens/ee18584a-a962-489d-ada1-478abe6f5e81), [report grid](https://mobbin.com/screens/c58c2829-399b-4ea9-9afc-df4fce23d252), [report detail](https://mobbin.com/screens/f90ac8bb-949b-4eb5-9b53-851d192ced8d), [drive overview](https://mobbin.com/screens/ee3c2442-e669-40aa-9f5b-20a127950249), [My impact](https://mobbin.com/screens/f84a809a-ec2c-44b1-8e8b-df1d1c4a8dc4), [reports around you](https://mobbin.com/screens/c5f7db98-3f82-4558-8334-bdf2e9a22740))

- **Your avatar is a car on the map**, and other drivers ("Wazers") show as playful characters. The map feels inhabited.
- **Speedometer is a circle bottom-left; Report is a big orange circle bottom-right.** Two thumbs, two jobs, always in the same place.
- **"Where to?" lives in a bottom sheet** with a mic button.
- **The report grid is 10 big round, coloured icons** (Traffic, Police, Crash, Hazard…). Each opens a **sub-type step** (Hazard: Object / Shoulder / Weather), then Send / Later.
- **Social proof pill:** "521 reports around you".
- **Drive overview** shows events along a progress bar (hazard and crash icons on the line), plus **"Find the best time to leave"** as a bar chart.
- **Gamification:** "You'll get 6 points every time you report", and a **My impact** screen.
- Weak spots Slide can beat: a cluttered map, a cartoon style that reads childish, ad pins, and no "smooth" concept at all.

### Google Maps ([stops editor](https://mobbin.com/screens/ff95f1f9-8b5f-40f0-a94b-f240b3f65f29), [route preview with lanes](https://mobbin.com/screens/ef0cd948-1366-48f9-911f-47dbe05d1be3), [choose your home icon](https://mobbin.com/screens/f39a9d55-1fdf-4a81-8c60-f39b85d729cb), [saved places](https://mobbin.com/screens/fcdac553-8862-466a-a2f7-d0c777fa4fa6))

- **Customisable identity:** you pick your navigation **vehicle icon** and even **how your home looks** from a grid of ~40 illustrated houses. Cheap to build, people love it.
- **Lane guidance** strip with arrows under the turn card.
- **Stops editor:** A/B/C markers, drag handles, "Total trip: 48 min", Done.
- Saved places rows have one-tap **Start**.

### Apple Maps ([route sheet](https://mobbin.com/screens/ff2d40e9-559a-466c-acde-1fc81f08b5d3), [nav banner](https://mobbin.com/screens/fa3e962f-5b20-4705-b9ee-853017b9c8b4), [home](https://mobbin.com/screens/edf0fec0-9d0f-4ce8-b206-86becffb51f4))

- **One floating sheet** with a large radius; big bold titles; grouped inset lists with hairline dividers.
- **Map controls in one small capsule** (map type, locate).
- **Nav banner:** huge distance plus a two-line instruction, and page dots for upcoming steps.
- A bottom search pill with mic and avatar. Almost no chrome on the map.

### Dashboards: Mintlify, Copilot Money, Plain ([1](https://mobbin.com/screens/03b084b9-d5ed-41be-a9ca-43445af854f2), [2](https://mobbin.com/screens/1bfa784d-99eb-4850-88e2-4064d4d06452), [3](https://mobbin.com/screens/e892500e-f820-4e3e-af83-973bf50ed22e))

- Few borders, one accent colour, three grey levels.
- Stat tile = label, number, delta.
- **Empty states explain what will appear.** They don't show "—".

### Game layer: customisation and rewards ([Opal unlock](https://mobbin.com/screens/4ce4460a-018b-4678-ae44-e51e63508b53), [Apple Store configurator](https://mobbin.com/screens/a9004fb9-c1e8-4f58-8993-f1138449a78e), [Garmin badge](https://mobbin.com/screens/4b83593e-4774-4406-925b-188979a822fe), [Oura crowns](https://mobbin.com/screens/834bf230-bccd-42b3-ae7b-4e875d5e2f2d), [Flighty passport](https://mobbin.com/screens/6e35a583-21a4-4d21-ae0c-c6829a92ac35), [Future share card](https://mobbin.com/screens/dcc4e946-a776-4295-ba32-16cf358e2358), [Tripadvisor milestones](https://mobbin.com/screens/0ab004d9-af72-4e6d-ac39-3d7643ddde90))

- **Hero object on a stage, one action:** Opal's gem "Unlocked today · Owned by 23% · Apply Theme". This is the model for unlocking a car or livery.
- **Configurator:** big preview on top, option pills in a bottom sheet (Apple Store).
- **Badges with tiers and progress** (Garmin, Tripadvisor "First-timer → Newbie").
- **Fun totals:** Flighty's "3.2× around Earth".
- **Shareable stat card** after an activity (Future): a big thin numeral and a Share button. This is free marketing for Slide.

---

## 3. Gap list: Slide vs. a Waze-class app

Status: ✅ done · 🟡 partial · ❌ missing.

### Core navigation

| Gap | Status | Note |
|---|---|---|
| **Voice guidance** | 🟡 | `speechSynthesis` at 0.5 / 0.1 / now. Mute is Grim's `#drive-mute` (`slide:voice-mute` / `html[data-voice]`). `slide.voice.v1` stays in sync. |
| Lane guidance | 🟡 | Real Valhalla `lanes` in Grim's `#lane-strip` on the #35 drive HUD. Hidden with no data. |
| Route alternatives list (phone) | ✅ | Swipeable review cards from real ranked routes (`#route-carousel`). Map bubbles stay. |
| Leave-by / best time to leave | 🟡 | `#leave-by` uses a real Slide costing + 3 min buffer. Incidents mentioned only when the feed has some. No invented delay. |
| Offline / no route / permission denied states | ✅ | `#net-sheet` (offline / no-route / busy) and `#loc-banner` (denied / unavailable / timeout / insecure). |
| Route-loading skeleton | ❌ | |
| Place card (name, address, save, Go) | ✅ | `#place-card` after a real search pick. Save is on-device recents. |
| Search: recents, Home/Work, categories (gas, food, parking) | 🟡 | |
| Upcoming events on the route progress bar | ❌ | Radar items and speed drops as icons on a line (Waze drive overview). |
| Arrival summary | 🟡 | Trip card chrome + Share (`#arr-share`). `#arr-xp` / `#share-card-mount` still Leon. |
| Auto day/night map | ❌ | Night is the default. Optional "Day" map for sunlight readability is a separate decision for King. |

### Waze-parity social

| Gap | Status | Note |
|---|---|---|
| Report button bottom-right, speedometer bottom-left | ✅ | `#drive-report` BR, `#speedo` BL. Radar disc stays up-right. |
| Report grid with icons and a sub-type step | ✅ | Glass icons + subtype step, then Send / Later. Submit still sends the kind only. |
| "N reports around you" pill | ❌ | A real count from `reports_near()` only. |
| Friends on the map as their cars | 🟡 | Today friends show as rough-area circles. Show their **chosen ride** inside the circle, still never precise. |
| My impact (reports confirmed, drivers helped) | ❌ | Real counts only. |

### Game layer (Slide's unique edge, owned by Leon)

| Gap | Status | Note |
|---|---|---|
| Pick your ride, paint, livery, glow | ✅ | `src/lib/vehicles.ts`, Garage showroom. |
| 3D car models | ❌ | Next step: low-poly glTF on a MapLibre custom layer (three.js), with 2D SVG as the fallback. |
| XP / levels from **smooth** driving | ❌ | Reward smoothness, steady speed, finishing under the limit and reporting. **Never reward speed or time.** |
| Unlockable rides and liveries | ❌ | "Unlocked: Ember livery, 10 smooth drives". Opal-style stage. |
| Badges with tiers | ❌ | First Line, Night Owl, Bridge Runner (MacArthur, Rickenbacker), 100 Smooth Miles. |
| Weekly friend leaderboard (smooth score) | ❌ | Mutual friends only, opt-in. |
| Shareable trip card | ❌ | Thin big numerals, your ride, the line drawn, a Share button. No exact addresses on it. |
| Collab packs | 🟡 | The `pack` field exists. Packs need a store/unlock screen and **a signed licence** before any real brand appears. |
| "Miami driven %" map | ❌ | Roads you've driven glow. On-device only. |
| Custom Home/Work icons | ❌ | Cheap delight, after Google Maps. |

### Desktop Command view

| Gap | Status | Note |
|---|---|---|
| Empty states | ✅ | Explanations instead of "—" (`src/lib/empty.ts`). |
| LUMEN fidelity (city-lights map, phone mockup, flow chart) | 🟡 | Map lights depend on tiles. The phone mockup is decorative, so leave it out. |

### Accessibility and quality

- Contrast ≥ 4.5:1, 44 px targets, `prefers-reduced-motion`: partly done. Audit every screen.
- Only 7 `aria-live`/status regions. Turn changes and report alerts must be announced.
- `src/main.ts` is 1,389 lines. Split it (`hud/ drive/ plan/ map/`) before big UI work, in its own PR with no behaviour change.

---

## 4. Build order (one PR each, screenshots before and after on phone and desktop)

1. **Grim: Design system rebuild.** ✅ One token file (`src/styles/tokens.css`) from `design/premium-glass-kit/css/tokens.css`, mapped to Slide's themes (Night default, Ember, Sand) and the Garage glow accent. `styles.css` is tokens → base → components → screens. Targets met (see HANDOFF session log). **No visual regression** on the screens in `docs/DESIGN.md`.
2. **Grim: Screen pass** ✅ against the gap list (review carousel, drive thumbs, report grid, place card, fail sheets, arrival trip card, empty states).
3. **Nard: Voice guidance** (`speechSynthesis`) and **lane data** from Valhalla maneuvers. Then **leave-by** UI. Wire the "reports around you" count.
4. **Leon: Game layer.** XP from smooth score, badges, unlocks on an Opal-style stage, the trip share card, the friend leaderboard (Supabase, opt-in, mutual friends). Later, a 3D ride on a MapLibre custom layer.
5. **Everyone:** split `main.ts` before step 2 lands, if possible.

## 5. Non-negotiables (from HANDOFF and the owner)

- **Real data only.** No fake drivers, traffic, police or "demo data" labels.
- **Never encourage speeding.** The game rewards smooth and safe driving, never speed.
- **Slide identity stays:**
  - the spaced SLIDE wordmark and the mono tag chip
  - uppercase mono HUD labels
  - the Garage glow accent and the glowing route
  - the Slide pick contract
  - the night HUD as default
- **No real brands** (cars, games) without a signed licence.
- **Privacy:** personal data on the phone; friends see rough areas only; nothing shown while driving that tempts a glance.
- **Before every PR:** `npm run build` and `npm test` pass, the screens are checked in a browser, and `TASKS.md` plus the HANDOFF session log are updated.
