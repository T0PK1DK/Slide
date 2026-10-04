# Copy-paste prompts

Use these with Cursor, Claude, v0, Bolt, Lovable, Windsurf, etc. The base template is **app-agnostic**; your app's wording and data go in a **skin** (prompt 2b). **Attach or paste** `DESIGN-SYSTEM.md` and `css/tokens.css` (or `tokens.json`) with the prompt. For v0/Bolt, paste the token file contents, since they can't read your disk.

---

## 1. Master prompt: "Apply this design system to my app"

```text
You are restyling my existing app to match a premium "liquid glass" command-center design system.
I've attached DESIGN-SYSTEM.md (rules) and tokens.css (CSS variables for themes night / warm, plus optional ember).

GOAL: Make the app look calm, premium and easy to understand without changing features or data logic.

DO THIS:
1. Add tokens.css globally. Set <html data-theme="night"> by default; persist the user's choice in localStorage;
   default to "warm" if prefers-color-scheme is light.
2. Replace ALL hard-coded colors, radii, shadows, font sizes and spacing with the tokens
   (--bg-0, --surface-1/2/3, --surface-sel, --glass-*, --text-1/2/3, --line, --accent, --ok, --info, --danger,
   --radius-*, --space-*, --fs-*, --fw-*). No raw hex in components.
3. Create one reusable Glass surface (class or component) using the exact recipe:
   background: var(--glass-tint), var(--glass-fill); border:1px solid var(--glass-border);
   box-shadow: var(--glass-highlight), var(--glass-shadow); backdrop-filter: blur(var(--blur-md)) saturate(var(--saturate));
   border-radius: var(--radius-md). Use .glass--float for anything floating over imagery or maps.
4. Typography: Inter (200/300/400/500), tabular numerals. Big numbers use weight 200–300 with the unit at 50% size in --text-2.
   Only 3 text colors: --text-1, --text-2, --text-3.
5. Layout: top nav 56px, 12px gutters, 16px card padding. Desktop: left = status/state, center = one hero (map/chart/media),
   right = insights/actions. Tablet: hero on top, 2 columns below. Phone: single column.
6. Color is semantic and rare: red = problem (max 1–2 per screen), blue = suggestion, green = healthy, orange (--accent) = live/brand/peak.
   Colored areas are soft tints (--*-soft) with full-strength icon/text, never solid saturated cards.
7. Charts: monochrome lines/bars using --viz-* tokens; only the key data point gets --viz-bar-peak with a glow and a glass tooltip.
   Dashed gridlines at ~5% opacity, axis labels on the right in --text-3. No rainbow palettes, no 3D, no legends for 1–2 series.
8. Motion: 140ms hovers, 240ms toggles, 520ms staggered fade-up entrance, count-up numbers once. Respect prefers-reduced-motion.
9. Add a Night / Warm segmented theme switch in the top bar (Ember optional).

CONSTRAINTS: Don't change business logic, routes, or API calls. Don't add new dependencies unless needed
(if React + Tailwind, map tokens into tailwind.config theme.extend.colors via var(--token)).
Work screen by screen; after each, list what changed and anything you couldn't map.
```

---

## 2. Audit a clunky app and map it to the template

```text
Act as a senior product designer. Audit my app against the attached DESIGN-SYSTEM.md.

For EACH screen/route in the app:
1. Screenshot-level summary: what's on it, what the user is trying to do.
2. Clutter score 1–10 with the top 5 specific problems (e.g. "4 accent colors", "bold 32px numbers",
   "3 competing CTAs", "borders 2px", "no clear hero", "inconsistent spacing 10/14/18px").
3. Map it to the template zones:
   - LEFT (state): which existing elements become KPI pair, hero stat + sparkline, selectable list
   - CENTER (hero): the one thing that deserves the most space (map, main chart, media, editor…)
   - RIGHT (insights/actions): alert cards (red/blue/green semantics), progress card, bar chart card
   - TOP NAV: ≤7 items, live indicator, search ⌘K, theme switch, avatar
4. What to DELETE or hide behind a "View all" / chevron.
5. The exact template components to use (TopNav, KpiPairCard, HeroStatSparkline, SelectableList, HeroMap/HeroPanel,
   FloatingInfoCard, AlertCard, ProgressCard, BarChartCard, SegmentedControl, StatusPill).

Output a table: Screen | Current problems | Zone mapping | Components | Remove/merge | Effort (S/M/L).
Then give a prioritized plan: quick wins first (tokens + typography + spacing), then layout, then charts.
```

---

## 2b. Create an app skin (layer my app on top of the generic template)

```text
I'm using the Premium Glass Kit (attached: index.html, js/skin.default.js, skins/transit-example/skin.js, skins/README.md).
The engine (js/app.js) and CSS are app-agnostic; all labels and data come from window.SKIN.

Create skins/<APP-NAME>/skin.js for my app: <DESCRIBE APP, its main objects, key metrics, alerts, and who uses it>.
Use defineSkin({...}) and override ONLY what differs from skin.default.js (objects deep-merge, arrays replace):
- brand.name, nav.tabs (≤7, first one live), nav.searchPlaceholder
- left.kpis (2 tiles: one healthy/ok, one problem/danger), left.trend (my most important % metric + 48-point series),
  left.list (4 rows of my main object: name, status+tone, meta, sub, value+unit, 10-point series)
- hero.mode: "map" if my data is geographic (give scene nodes/labels) or "media" with media.src for an image/video;
  hero.chip, hero.floatCard, hero.device (or device.show=false)
- right.insights.cards: exactly one danger, one info, one ok-with-progress card, written in my domain's language
- right.bars: my main volume-over-time metric with a highlighted peak
- themes: keep night + warm; add ember only if I ask. Optional tokens overrides per theme (e.g. my brand accent).
- any domain icons as <symbol viewBox="0 0 24 24"> in icons:{}.
Keep the copy short (titles ≤4 words, descriptions ≤12 words). Mark it as demo data unless I give real data.
Then tell me how to open it: index.html?skin=<APP-NAME>.
```

---

## 3. Find and choose matching components (21st.dev / shadcn)

```text
I'm building <APP DESCRIPTION, e.g. "a booking dashboard for a barbershop"> using <STACK, e.g. Next.js + Tailwind + shadcn>.
It must follow the attached DESIGN-SYSTEM.md (dark graphite glass, thin numerals, semantic color, warm orange accent).

For each UI need below, recommend 2–3 components from 21st.dev, shadcn/ui, Aceternity UI, Magic UI or Tremor.
Only cite components you can actually find (give the URL). For each: why it fits, what to restyle
(replace colors with tokens, remove gradients/neon, set radius to var(--radius-md), add .glass), and the install command.

Needs: app shell/sidebar, top nav with search ⌘K, command palette, theme toggle (3 themes), KPI stat card with sparkline,
area chart, bar chart with highlighted peak, segmented progress/tracker, alert/insight cards, status pills,
selectable list rows with mini chart, toasts, data table, empty state, <ADD YOUR OWN>.

Rules: max ONE "wow" effect (glow/beam) on the whole page; prefer components that accept className and use CSS variables;
reject anything with hard-coded rainbow/neon palettes. End with a final shortlist and the exact install commands in order.
```
*(If you have the 21st MCP connected in Cursor/Claude, add: "Use the 21st MCP to search and install.")*

---

## 4. Add a new theme layer

```text
Add a new theme called "<NAME>" to my tokens.css using the SAME variable names as [data-theme="night"].
Mood: <e.g. "deep ocean navy with teal accent" / "brand: #FF6B00 orange on charcoal" / "soft rosé light mode">.

Rules:
- Keep the structure: bg-0 < bg-1 < surface-1 < surface-2 < surface-3 < surface-sel, each step only 3–6% brighter (dark themes)
  or slightly darker/whiter (light themes).
- Glass: fill ~60% opacity, border 7–9% opacity, 1px top inner highlight, shadow per the recipe.
- Text: 3 levels with WCAG AA contrast for --text-1 and --text-2 against --surface-1.
- Status colors keep their meaning (red/blue/green/accent) but adjust lightness for this background.
- Map tokens (--map-water, --map-land, --map-light as an "r, g, b" triplet, --map-path) and viz tokens (--viz-*) included.
- Add a button to the theme segmented control: <button data-theme-btn="<name>">…</button>.
Output only the new CSS block + the button HTML, then a 5-line note on contrast checks.
```

---

## 5. Short per-component prompts

**Glass card**
```text
Create a reusable <GlassCard> (props: as, float?: boolean, padding?: "sm"|"md", className). Use tokens: var(--glass-tint), var(--glass-fill),
1px var(--glass-border), var(--glass-highlight) + var(--glass-shadow), blur(var(--blur-md)) saturate(var(--saturate)), radius var(--radius-md).
float=true uses --glass-fill-strong and --glass-shadow-float. No other colors.
```

**KPI pair (12 Active / 4 Alerts)**
```text
Build a KpiPair card: title + period select pill (24h ▾) top row; two columns split by a 1px var(--line) divider; each = 32px weight-300
tabular numeral + status dot (green --ok / red --danger-dot with soft glow) + 12px --text-2 label. Count up once on mount.
```

**Hero stat + sparkline**
```text
Build a HeroStat card: small title + chevron; 44px weight-200 number with "%" at half size in --text-2; green delta "+4.2%" right-aligned;
SVG area sparkline (1.3px var(--viz-line), gradient var(--viz-area-top)→transparent), dashed gridlines at 25/50/75/100 labelled on the right
in 9px --text-3, 2–3 highlighted points as dots with dotted drop lines; time labels under it.
```

**Bar chart with highlighted peak**
```text
Build a BarChart: 48 thin bars (2px gap, rounded 1.5px), vertical gradient var(--viz-bar-top)→var(--viz-bar). One peak index uses
var(--viz-bar-peak) with a blurred glow copy behind it and a floating glass tooltip ("12.4K / 1:40 AM") above. Right-side y labels, dashed grid.
Bars grow in with a 600ms staggered scaleY animation (disabled for reduced motion).
```

**Segmented progress**
```text
Build SegmentedProgress(value 0–100, segments=10): grid of 4px-tall rounded segments with 4px gaps; full segments var(--ok-muted),
partial segment uses a hard-stop gradient, empty var(--viz-seg-empty).
```

**Alert / insight card**
```text
Build InsightCard(tone: "danger"|"info"|"ok"|"accent", icon, label, meta, title, description, media?). 26px rounded icon tile
(danger: --danger-tile + --danger-glow; info: --info-solid; ok: --ok-muted), label in tone text color, meta right-aligned in --text-3,
13px title, 11px --text-2 description. Danger tone adds a soft top wash linear-gradient(var(--danger-soft), transparent).
```

**Selectable list row**
```text
Build a ListRow: 2-column grid. Left: name + status dot, status text, faint line-art thumbnail. Right: secondary title + chevron,
10px sub-label, 70×22 mini sparkline, and a 15px weight-300 percentage. Selected row = var(--surface-sel) + var(--glass-border-strong). role="option".
```

**Top nav**
```text
Build TopNav (56px, sticky, blurred translucent bg-0, bottom 1px --line): spaced-caps logo; tabs where the active one shows an orange pulsing
dot + caps label + a 1px gradient underline in --accent; right side: pill search with ⌘K hint, Night/Warm segmented switch,
bell with red badge dot, circular avatar. Collapse tabs on tablet, hide search on phone.
```

**Command palette (⌘K)**
```text
Add a ⌘K command palette as a centered .glass--float panel (max-width 560px, radius var(--radius-lg)) over a 40% dark scrim with blur.
Sections: Recent, Actions (incl. "Switch theme: Night/Warm"), Pages. Arrow-key navigation, Enter to run, Esc to close,
footer with keyboard hints in --text-3 kbd chips. Base it on shadcn Command (cmdk).
```

**Hero panel (map or media)**
```text
Build a HeroPanel (radius var(--radius-xl)) with two modes: "media" (image/video/gradient, cover-fit) and "map". For map mode use using MapLibre/Leaflet with CARTO Dark Matter (night/ember) or Positron (warm) tiles,
dimmed by a radial vignette. Draw one path as a 2.4px var(--map-path) line with a 9px blurred var(--map-path-glow) underlay and slow flowing dashes.
Nodes: hub (concentric halos), points (ring), items (ring + glyph), one red pulsing alert node. Floating glass: map-style segmented control top-left,
status/time chip top-right, floating metric card, zoom/locate controls bottom-right.
```
