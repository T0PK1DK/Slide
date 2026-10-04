# Premium Glass Kit

An **app-agnostic** "liquid glass" dashboard base layer, reverse-engineered from the rondesignlab SEKAI command-center concept.
The base shows neutral placeholder content and fake data, with a **Night / Warm** theme switch. App-specific versions are layered on top as **skins**.

Live preview: https://premium-glass-kit.kingleonardjr19.workers.dev
- `?theme=warm` / `?theme=night`
- `?skin=transit-example` loads the example app skin (it also exposes the optional Ember theme)
- `?tiles=1` swaps in real CARTO dark map tiles (needs internet)

## Three layers
| Layer | Files | Controls |
|---|---|---|
| **Tokens** (how it looks) | `css/tokens.css` → `tokens.json` | colors, glass, type, spacing, radii, motion, per theme |
| **Skin** (what it says) | `js/skin.default.js` (generic) + optional `skins/<app>/skin.js` | labels, data, nav, which cards appear, hero mode, icons, theme list, token tweaks |
| **Engine** (how it works) | `index.html` (slots), `css/components.css`, `js/app.js`, `js/charts.js`, `js/map.js` | renders components from the skin; no app wording |

## Files
| Path | What |
|---|---|
| `index.html` | Layout shell. Each `[data-slot]` is filled from the skin. Static, no build step |
| `css/tokens.css` | Design tokens: `night`, `warm` (default pair) and optional `ember` |
| `tokens.json` | The same tokens as JSON |
| `css/components.css` | Component styles (they read tokens only) |
| `js/skin.default.js` | **Generic placeholder skin** plus the `defineSkin()` merge helper |
| `js/app.js` | Engine: component templates, theme switch, interactions |
| `js/charts.js` | Tiny SVG sparkline, bar chart and segmented progress |
| `js/map.js` | Procedural night map (canvas) plus SVG path overlay. No API keys |
| `skins/README.md` | How to write a skin (all options) |
| `skins/transit-example/` | Example app skin (fleet/transit command center) |
| `DESIGN-SYSTEM.md` | Why it looks premium, palette, glass recipe, rules, do/don't |
| `COMPONENTS.md` | 21st.dev / shadcn / Aceternity / Magic UI / Tremor add-ons plus Mobbin references |
| `PROMPTS.md` | Copy-paste prompts (apply system, audit, create an app skin, pick components, new theme, per-component) |
| `screenshots/` | Base template in Night and Warm (desktop 1440×900 and phone 390), plus a tablet shot and `extra-*` example-skin shots |
| `shoot.sh` | Regenerates screenshots with headless Chrome |

## Run
```bash
cd premium-glass-kit && python3 -m http.server 8080   # or double-click index.html
```

## Components (slots)
TopNav + ThemeSwitch · KpiPairCard · HeroStatSparkline · SelectableList · HeroPanel (map **or** media) · HeroTop (view modes + status chip) · FloatingInfoCard · DevicePreview · HeroControls · InsightPanel → AlertCard (danger/info) + ProgressCard (segmented) · BarChartCard.
Remove a component by deleting its slot in `index.html`, or by setting it to `null` in a skin.

## Layer an app on top (skins)
1. Copy `skins/transit-example/` to `skins/my-app/`.
2. Edit `skin.js`. Call `defineSkin({...})` with only what differs. Objects deep-merge; arrays replace.
3. Open `index.html?skin=my-app`, or make it permanent by adding `<script src="skins/my-app/skin.js"></script>` right after `js/skin.default.js` in `index.html`.
4. Optional extras in the skin: `themes` (e.g. add Ember), `tokens` (per-theme overrides such as your brand accent), `icons` (extra SVG symbols), `css` (extra stylesheet), `hero.mode: "media"` with `media.src`.
All options are listed in `skins/README.md`. There's a ready-made AI prompt in `PROMPTS.md` §2b.

## Add a theme
Copy a `[data-theme]` block in `css/tokens.css`, rename it and change the values. Then add `{ id, label, icon }` to `themes` in the skin.

## Deploy (Cloudflare Workers static assets)
```toml
# wrangler.toml next to a ./public copy of this folder
name = "premium-glass-kit"
compatibility_date = "2025-01-01"
[assets]
directory = "./public"
```
`npx wrangler deploy`

All numbers and names in the template are placeholder demo data.
