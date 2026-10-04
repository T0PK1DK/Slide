# Premium Glass Kit: Design System

Reverse-engineered from the rondesignlab **"SEKAI"** command-center concept (Instagram carousel). The template is **app-agnostic**: generic labels and fake data, with any app-specific wording supplied by a *skin* (`skins/`). This is a **base layer**: tokens plus a few rules you can put under any project so it feels calm, premium and easy to read. Then you add your own looks on top as themes.

> Source of truth: `css/tokens.css` (with a generated copy in `tokens.json`). Live template: `index.html`.

---

## 1. Why the reference feels premium (plain language)

1. **It's nearly black, not pure black.** The background is a deep blue-graphite (`#05090C`), not `#000`. Pure black looks cheap and harsh. A slightly tinted near-black looks expensive.
2. **Depth comes from tiny brightness steps, not heavy shadows.** Background, then column, then card, then selected card each step up only 3–6% in brightness (`#05090C → #0A0E11 → #0F1316 → #161A1E → #262A2E`).
3. **Each card has a 1px "glass edge".** Every card has a barely visible translucent border (`rgba(255,255,255,.07)`) and a 1px inner highlight on the top edge. That is the "liquid glass" feel. It reads as a physical pane of glass catching light.
4. **The big numbers are thin.** `78.3`, `12`, `4` and `2.5 min` use a very light weight (200–300) at a large size. Thin plus large reads as confident and calm. Bold plus large reads as shouting.
5. **Gray does most of the work.** About 90% of the UI is white or gray text on graphite. Secondary text is a muted gray (`#9AA0A6`) and tertiary text is darker (`#5F666C`).
6. **Color only shows up when it means something.** Red appears in exactly one place (congestion alert). Blue is one suggestion. Green is "healthy". Orange is "live / you are here / peak". Because color is rare, your eye goes straight to it.
7. **One hero visual.** The dark map with a single glowing white path is the only "loud" element. Everything around it is quiet, so the page never feels busy.
8. **Generous, even spacing.** It uses a 12px gutter everywhere, 16px card padding, and an 8px rhythm inside cards. Nothing touches anything else.
9. **Floating glass over imagery.** The floating info card, status chip, map controls and phone mockup float over the map with blur. That gives depth without clutter.
10. **Restrained motion.** Live dots pulse slowly, the path flows and numbers count up once. Nothing bounces.

---

## 2. Palette (hex sampled from the reference images)

Sampled with PIL from `37f64a3f…jpg` (desktop dashboard). JPEG compression shifts values slightly, so tokens are rounded or cleaned up.

### Night (graphite, matches reference)

| Role | Token | Hex | Sampled from |
|---|---|---|---|
| App background | `--bg-0` | `#05090C` | page edge (sampled `#05090C`) |
| Column backdrop | `--bg-1` | `#0A0E11` | left column gap (`#0A0E11`) |
| Card | `--surface-1` | `#0F1316` | list card in reference (`#0F1316`), overview card (`#111518`) |
| Raised card / panel | `--surface-2` | `#161A1E` | right panel (`#16191D`) |
| Hover | `--surface-3` | `#1C2023` | (`#1C2023`) |
| Selected item | `--surface-sel` | `#262A2E` | selected list row in reference (`#292D30`) |
| Primary text | `--text-1` | `#F2F4F5` | numerals and titles |
| Secondary text | `--text-2` | `#9AA0A6` | descriptions |
| Tertiary text | `--text-3` | `#5F666C` | axis ticks and meta |
| Accent (warm) | `--accent` | `#E79D58` | LIVE NETWORK dot (`#E79D58`), flow peak (`#DF9150`) |
| Success | `--ok` / `--ok-muted` | `#5DD17E` / `#4E8A64` | Active dot (`#5DD17E`), adherence bar (`#48835F`–`#537B62`) |
| Info | `--info-solid` / `--info-text` | `#2F66B8` / `#8BB4E5` | suggestion icon tile (`#285FAD`), icon glyph (`#8BB4E5`) |
| Danger | `--danger-dot` / `--danger-tile` | `#DD3633` / `#5A1F25` | Alerts dot (`#DD3633`), congestion icon bg (`#571F25`) |
| Map water / land | `--map-water` / `--map-land` | `#04080B` / `#11171C` | map (`#080D11`) |

### Warm (warm light): the default second theme
Warm paper background `#EFE9E1`, cards `#F7F3EE` / white glass, ink text `#1F1A15`, burnt-orange accent `#E0782A`. Status colors are darkened so they hold contrast on light backgrounds. Token id: `warm`.

### Ember (warm dark): optional third theme, King's oranges at night
Espresso surfaces (`#0D0907 → #19130F → #33271D`), cream text `#F7EFE6`, amber accent `#FF9F43`, amber city lights. Same structure, warmer mood. Token id: `ember`. It is hidden in the default switch; a skin can expose it via `themes`.

> **Rule:** every theme defines the **same token names**. Components never use raw hex.

---

## 3. Glass recipe

```css
.glass {
  background:
    linear-gradient(180deg, rgba(255,255,255,.045), rgba(255,255,255,.012)), /* --glass-tint: top is a touch brighter */
    rgba(22,26,30,.62);                                                     /* --glass-fill */
  border: 1px solid rgba(255,255,255,.07);                                  /* --glass-border */
  border-radius: 14px;                                                      /* --radius-md */
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,.06),                                    /* --glass-highlight (top edge catch-light) */
    0 1px 2px rgba(0,0,0,.4), 0 12px 32px -12px rgba(0,0,0,.7);             /* --glass-shadow */
  backdrop-filter: blur(20px) saturate(140%);                               /* --blur-md, --saturate */
}
```

- **Regular glass** (cards in columns): fill at about 60% opacity. The blur barely matters because the background is flat.
- **Floating glass** (`.glass--float`, over the map or photos): about 78% fill plus a deeper shadow (`--glass-shadow-float`). Floating glass is where the blur really shows.
- **Light theme glass:** a white fill at about 62%, a warm-brown 9% border, and a white inner highlight at 90%.
- Apple's HIG guidance (Materials / Liquid Glass) says to use glass for **controls and navigation that float above content**, not for every content block. Use regular (more opaque) glass where text is dense.

## 4. Radii

| Token | px | Use |
|---|---|---|
| `--radius-xs` | 6 | segment bars, inner chips |
| `--radius-sm` | 10 | icon tiles, inputs, select pills |
| `--radius-md` | 14 | cards |
| `--radius-lg` | 18 | panels (Insights) |
| `--radius-xl` | 26 | hero/map panel, device |
| `--radius-pill` | 999 | segmented controls, search, status pills, avatar |

**Nesting rule:** inner radius = outer radius − padding. For example, a 18px panel with 4px inset gets a 14px card inside.

## 5. Spacing (4px base)

`4 · 8 · 12 · 16 · 20 · 24 · 32 · 40 · 48`. Use `--gutter: 12px` between all cards and columns, `16px` card padding, and `8px` between items inside a card. The phone layout drops the gutter to 10px.

Layout: top nav is 56px. Desktop grid is `300px | 1fr | 320px`. Under 1180px it becomes hero on top with two columns below. Under 720px everything is one column.

## 6. Typography

- **Font:** **Inter** (free, Google Fonts) with weights 200/300/400/500. Alternatives that keep the same feel: **Manrope** (a bit softer, rounder), **Geist** (Vercel, crisp), **SF Pro** (Apple devices only, via `-apple-system`). Use **JetBrains Mono** for `⌘K` and code.
- **Tabular numerals** everywhere (`font-feature-settings: "tnum"`) so numbers don't jiggle when they update.

| Role | Size / weight | Example |
|---|---|---|
| Hero stat | 44px / 200, tracking −0.02em | `78.3%` |
| KPI | 32px / 300 | `12` `4` |
| Medium stat | 24px / 300 | `2.5 k` |
| Panel title | 18px / 400 | Insights |
| Card title | 15px / 400 | Overview |
| Body | 13px / 400 | Rebalance workload to Group East |
| Secondary | 12px / 400, `--text-2` | Saves an estimated 18 minutes |
| Meta / axis | 10–11px, `--text-3` | 00:00 · 25% |
| Caps label | 11px / 500, tracking 0.08em | LIVE OVERVIEW |
| Marketing slide | 64px / 300, one word in `--text-1`, the rest in `--text-2` | "78% of operators need **command centers**" |

Units (`%`, `k`, `min`) are **half size and gray** next to the thin numeral.

## 7. Hierarchy rules

1. **One hero per screen** (map, chart or photo). Everything else supports it.
2. **Three text levels max**: primary, secondary, tertiary. Never use a fourth gray.
3. **Headline, then number, then explanation.** For example: "Goal Progress", then "92%", then "Target completion across all workstreams."
4. **Left column = state** ("what is happening"). **Center = where** (map or hero). **Right column = insights and actions** ("what should I do").
5. Cards contain **one idea**. If a card needs two titles, split it.
6. A chevron (›) on a card means "this opens". Use no other affordance noise.
7. Selected item = brighter surface plus a slightly stronger border, **not** a colored outline.

## 8. Status color semantics (use sparingly)

| Color | Meaning | Where it's allowed |
|---|---|---|
| **Red** `--danger` | Something is wrong / predicted problem | Alert dot, alert icon tile (with soft glow), alert card wash, alert map node. **Max 1–2 per screen.** |
| **Blue** `--info` | Suggestion / alternative / neutral info | Recommendation card icon tile and label |
| **Green** `--ok` | Healthy / on track / live and active | Status dots, segmented progress fill, positive delta |
| **Orange** `--accent` | Brand, "live", "now", peak or highlight | LIVE tab dot, active tab underline, chart peak, focus ring, current-position node |
| Gray | Idle / charging / unknown | Status dot `--text-3` |

Colored areas are always **soft**: a 12–16% tint background plus full-strength text or icon. Never a solid saturated card.

## 9. Data-viz style

- **Monochrome first:** lines and bars are white (or ink in Warm) at 20–85% opacity. **Only the important point gets color** (orange peak with glow and a glass tooltip).
- Line: 1.2–1.4px stroke, slight smoothing, area fill fading from 16% to 0%.
- Highlight points: small 2.5px dots plus a dotted drop line.
- Gridlines: dashed `2 4`, about 5% opacity. Axis labels on the **right**, 9–10px, `--text-3`.
- Bars: thin (2–4px) with 2px gaps and a vertical gradient (brighter top).
- Segmented progress: 10 segments, 4px tall, 4px gaps, `--ok-muted` fill.
- Mini charts in list rows: no axes, 70×22px.
- No legends unless there are more than 2 series. Write the meaning in the title instead.

## 10. Motion

| What | How |
|---|---|
| Hover / press | 140ms, `cubic-bezier(.22,1,.36,1)`; background step plus chevron nudges 2px |
| Toggles / theme swap | 240ms ease-out |
| Entrance | cards fade up 8px over 520ms, staggered 60ms |
| Numbers | count up once on load (900ms, ease-out cubic) |
| Ambient | live dots pulse every 2.4s, alert node halo ripples, path dashes flow slowly |
| Reduced motion | honor `prefers-reduced-motion`: everything is instant |

Avoid springy bounces, spinning loaders and parallax. Calm motion is what reads as premium.

## 11. Do / Don't (decluttering)

**Do**
- ✅ Use the token names. Change the look by swapping a theme, not by editing components.
- ✅ Keep 12px gutters and 16px padding everywhere, so the rhythm stays consistent.
- ✅ Give each screen one hero and one accent color.
- ✅ Put thin, big numbers with small gray units.
- ✅ Use gray for "fine" and color only for "needs attention".
- ✅ Group related controls in one segmented pill (Map / Satellite / Terrain).
- ✅ Put explanations in a one-line gray subtitle under titles.
- ✅ Hide secondary nav items on smaller screens rather than wrapping them.

**Don't**
- ❌ Use pure black `#000`, pure white cards on dark, or saturated colored card backgrounds.
- ❌ Use more than 3 grays or more than 1 accent per screen.
- ❌ Add drop shadows darker or bigger than the token. Depth comes from borders and brightness steps.
- ❌ Use bold weights for big numbers.
- ❌ Use rainbow charts, 3D charts, pie charts with 6+ slices, or legends on everything.
- ❌ Pile up badges, emojis and icons on every row.
- ❌ Use borders thicker than 1px or colored borders around normal cards.
- ❌ Use glass on top of glass on top of glass. Max one floating layer over the hero.
- ❌ Put more than about 7 nav items in the top bar.

## 12. Adding a new theme ("layering a look")

1. Copy the `[data-theme="ember"]` block in `css/tokens.css`.
2. Rename it (e.g. `[data-theme="ocean"]`) and change only the values.
3. Expose it in the switch by adding `{ id: "ocean", label: "Ocean", icon: "i-moon" }` to `themes` in `js/skin.default.js` (or in your app skin).
4. Done. The canvas map and charts read tokens at draw time, and the switch redraws them.
5. Optional: regenerate `tokens.json` (the Python snippet in README).

## 13. Base template vs. app skins

- **Base** (`index.html` + `js/skin.default.js`): neutral labels ("Overview", "Efficiency", "Active Items", "Insights", "Activity"), fake numbers, Night/Warm switch. Use it as-is for any project.
- **Skin** (`skins/<app>/skin.js`): an app's own words, data, icons, extra themes and token tweaks, merged on top with `defineSkin({...})`. The engine (`js/app.js`) and the CSS never contain app wording.
- Example: `skins/transit-example/`, the original transit content (`index.html?skin=transit-example`).
- Rule of thumb: **tokens = how it looks, skin = what it says, engine = how it works.** Change only the layer you need.
