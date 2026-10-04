# Add-on Components: research list

All links below came from tool results during research (web search, 21st.dev's own category listings, and the Mobbin connector). None were guessed.
*21st.dev note:* 21st.dev is **not** a connected connector. These links come from its public category listings (`21st.dev/community/components/s/<category>`, which return `…/components/<name>.md` links). I dropped the `.md` suffix to get the human page, and spot-checked several of those pages (they return HTTP 200). Install pattern from 21st.dev:
`npx shadcn@latest add "https://21st.dev/r/<author>/<component>?api_key=$API_KEY_21ST"` (needs a free 21st API key from https://21st.dev/mcp; free tier has daily install limits). You can also connect the **21st MCP** to Cursor/Claude: `npx @21st-dev/cli@latest init --client cursor`.

**How to pick:** prefer components that (1) accept `className` so you can apply `.glass` tokens, (2) use CSS variables for color, and (3) have no hard-coded gradients or neon. Restyle everything to the tokens in `css/tokens.css`.

---

## 1. 21st.dev

### Glass / surfaces
| Component | Author | Why it fits |
|---|---|---|
| [Liquid Glass Card](https://21st.dev/@designali-in/components/liquid-glass-card) | Ali Imam | Liquid-glass card wrapper (`LiquidCard`, accepts `className`) |
| [Glass Card](https://21st.dev/@Smit-Prajapati/components/glass-card) | Smit Prajapati | 3D glass card |
| [Glass Card (header/title/content/footer)](https://docs.21st.dev/@molecule-lab-rushil/components/glass-card) | molecule-lab | shadcn-style Card API with frosted blur. Easiest drop-in |
| [Apple Liquid glass switcher](https://21st.dev/@dennysdionigi/components/apple-liquid-glass-switcher) | dennysdionigi | Apple-style glass segmented switch, good for the theme toggle |
| [Toggle Switch Glass](https://21st.dev/@zochory/components/toggle-switch-glass) | Zachary Bensalem | Glass toggle |
| [Shine Border](https://21st.dev/@dillionverma/components/shine-border) | Dillion Verma | Subtle animated edge for one hero card only |
| [Border Beam](https://21st.dev/@appica-dev/components/border-beam) | appica-dev | Same idea. Use on max 1 element |

### Dashboards / layout / sidebars
| Component | Author | Why |
|---|---|---|
| [Dashboard Sidebar](https://21st.dev/@arunjdass/components/dashboard-sidebar) | Arun Dass | Dual-theme (charcoal/alabaster) shell, collapsible multi-level nav |
| [Dashboard with Collapsible Sidebar](https://21st.dev/@uniquesonu/components/dashboard-with-collapsible-sidebar) | Sonu Kumar | Sidebar plus dark toggle plus stats |
| [Sidebar (shadcn)](https://21st.dev/@shadcn/components/sidebar) | shadcn | The standard: composable, MIT |
| [Animated Sidebar](https://21st.dev/@starc007/components/animated-sidebar) | Saurabh | Smooth collapse animation |
| [App Dashboard Layout](https://21st.dev/@shadcnstore/components/app-1) | shadcnstore | Full app shell starter |
| [Bento Dashboard](https://21st.dev/@daiwiikharihar/components/bento-dashboard) | daiv09 | Bento layout for overview screens |
| [Efferd Dashboard 2](https://21st.dev/@efferd/components/efferd-dashboard-2) / [Commerce Dashboard](https://21st.dev/@efferd/components/dashboard-4) | Efferd | Clean, low-noise dashboards |
| [System Status Block](https://21st.dev/@preetsuthar17/components/system-status-block) | Preet Suthar | Status rows, like the Overview KPI card |

### Stat cards / KPIs
| Component | Author |
|---|---|
| [Statistics Card 7](https://21st.dev/@sean0205/components/statistics-card-7) · [Statistics Card 2](https://21st.dev/@sean0205/components/statistics-card-2) | Sean |
| [Stats cards with links (area chart)](https://21st.dev/@ephraimduncan/components/stats-cards-with-links/stats-card-with-area-chart) · [circular progress variant](https://21st.dev/@ephraimduncan/components/stats-cards-with-links/stats-cards-with-circular-progress) | Ephraim Duncan |
| [Progress Metric Card](https://21st.dev/@makviesainte/components/progress-metric-card) | Mak VieSainte |
| [Advanced Stats](https://21st.dev/@uilayout.contact/components/advanced-stats) · [Bold Stats](https://21st.dev/@uilayout.contact/components/stats-bold) | ui layout |

### Charts
| Component | Author | Maps to |
|---|---|---|
| [Area Chart (dark)](https://21st.dev/@SubframeApp/components/area-chart/dark-chart) | Subframe | Efficiency sparkline (HeroStatSparkline) |
| [Area Chart with Glowing Dot Markers](https://21st.dev/@sean0205/components/c-chart-16) | Sean | Sparkline with highlight dots |
| [Hover Trace Bar Chart](https://21st.dev/@LegionWebDev/components/hover-trace-bar-chart) | LegionWebDev | Activity bar chart plus hover |
| [Bar Chart (inset label)](https://21st.dev/@intentui/components/bar-chart/inset-label) | IntentUI | Labeled bars |
| [Partition Bar](https://21st.dev/@8starlabs/components/partition-bar) | 8starlabs | Segmented progress / composition |
| [Stacked Activity Bars](https://21st.dev/@eugeneshilow/components/stacked-activity) | Evge | Activity timelines |
| [Line Charts 9](https://21st.dev/@sean0205/components/line-charts-9) | Sean | Multi-line trends |
| [Donut Chart With Center Stats](https://21st.dev/@sean0205/components/c-chart-20) | Sean | Use instead of pies |
| [Tooltip with chart](https://21st.dev/@originui/components/tooltip/tooltip-with-chart) | Origin UI | Rich hover cards |
| [Heat Calendar](https://21st.dev/@starc007/components/heat-calendar) | Saurabh | Usage heatmaps |

### Command palette / search
| Component | Author |
|---|---|
| [Command Palette (Raycast-style)](https://21st.dev/@rafa-porto/components/command-palette/command-palette) | Rafael Porto. ⌘K, MIT, framer-motion |
| [Apple Spotlight](https://21st.dev/@samitkapoor/components/apple-spotlight) | Samit Kapoor. Most "Apple" feeling |
| [Command Menu with Global Search](https://21st.dev/@ephraimduncan/components/command-menu-04) | Ephraim Duncan |
| [Kbd Input Group](https://21st.dev/@uiable/components/kbd-input-group) | uiable. The search pill with ⌘K |
| [Expandable Search Bar](https://21st.dev/@arunachalam/components/expandable-search-bar) | Arunachalam |
| [Command Palette category](https://21st.dev/community/components/s/command-palette) | 34 options |

### Toggles / theme switch / tabs
| Component | Author |
|---|---|
| [Theme Switcher](https://21st.dev/@ncdai/components/theme-switcher-1) | ncdai |
| [Animated Theme Toggler](https://21st.dev/@arunachalam/components/animated-theme-toggler) | Arunachalam |
| [Toggle Theme](https://21st.dev/@efferd/components/toggle-theme) | Efferd |
| [Toggle Group (theme)](https://21st.dev/@cnippet-dev/components/cnippet-toggle-group/theme) | cnippet |
| [Segmented Control](https://21st.dev/@ddoemonn/components/segmented-control) | ddoemonn. view-mode pill (Map/Satellite/Terrain) |
| [Pill Morph Tabs](https://21st.dev/@ruixen.ui/components/pill-morph-tabs) · [Animated Tabs](https://21st.dev/@preetsuthar17/components/animated-tabs) · [Vercel Tabs](https://21st.dev/@yadwinder/components/vercel-tabs) | various |
| [Theme Toggle category](https://docs.21st.dev/community/components/s/theme-toggle) | 80 options |

### Alerts / notifications / badges
| Component | Author |
|---|---|
| [Dismissible Alert Stack](https://21st.dev/@olewandowski1/components/notifications-5) | Oliver |
| [Alert with Action Buttons](https://21st.dev/@sean0205/components/alert-with-action-buttons) | Sean. insight cards with an "Apply suggestion" action |
| [Notification Popover](https://21st.dev/@chetanverma16/components/notification-popover/notification-popover) | Chetan Verma. Bell dropdown |
| [Sonner (toasts)](https://21st.dev/@shadcn/components/sonner) | shadcn |
| [Status Dot](https://21st.dev/@edwinvakayil/components/status-dot) · [Status Badge](https://21st.dev/@serafimcloud/components/status-badge) · [Badge Delta](https://21st.dev/@serafimcloud/components/badge-delta/complex) | various |
| [Activity Feed](https://21st.dev/@felipemenezes098/components/item-19) · [Recent Activity Card](https://21st.dev/@olewandowski1/components/activity-1) | various |

### Backgrounds (for hero panels without a map)
[Elegant Dark Pattern](https://21st.dev/@jatin-yadav05/components/elegant-dark-pattern) · [Dark Gradient Background](https://21st.dev/@jatin-yadav05/components/dark-gradient-background) · [Background snippets: radial dark gray](https://21st.dev/@ibelick/components/background-snippets/background-radial-dark-gray) · [Dot Pattern](https://21st.dev/@dillionverma/components/dot-pattern) · [Honey Ember Background](https://21st.dev/@bidyut10/components/honey-ember-background) (warm theme) · [Sonar Grid](https://21st.dev/@n1m4mz/components/sonar-grid)

---

## 2. shadcn/ui (base layer for React apps)
- [Blocks](https://ui.shadcn.com/blocks): `dashboard-01` (sidebar, KPI section cards, interactive area chart, data table). Best starting skeleton to reskin with these tokens.
- [Chart docs](https://ui.shadcn.com/docs/components/radix/chart): built on Recharts v3, themed via CSS variables, so map `--chart-1…` to our `--viz-*` tokens.
- [Example source: chart-area-interactive.tsx](https://github.com/shadcn-ui/ui/blob/15ac1be9/apps/v4/registry/new-york-v4/blocks/dashboard-01/components/chart-area-interactive.tsx)

## 3. Aceternity UI (use 1 effect per page, max)
- [Glowing Effect](https://ui.aceternity.com/components/glowing-effect): Cursor-style border glow. Use `variant="white"` and `glow={false}` (hover only) to stay calm. `npx shadcn@latest add @aceternity/glowing-effect`
- [Bento Grid](https://ui.aceternity.com/components/bento-grid) and [Bento Grid collection](https://ui.aceternity.com/bento-grid): marketing or overview pages.

## 4. Magic UI
- [Number Ticker](https://magicui.design/docs/components/number-ticker): count-up for KPIs (`decimalPlaces`, `startValue`). `pnpm dlx shadcn@latest add @magicui/number-ticker`
- [Border Beam](https://magicui.design/docs/components/border-beam): travelling light on a border. Tint it with `--accent`, one element only.

## 5. Tremor (dashboard-specific)
- [Spark Chart](https://www.tremor.so/docs/visualizations/spark-chart): SparkArea/Line/Bar, perfect for the list-row mini charts.
- [Tracker](https://www.tremor.so/docs/visualizations/tracker): segmented status bar (Goal Progress / uptime).
- [Tremor home](https://www.tremor.so/) · [Tremor NPM](https://npm.tremor.so/) · [GitHub](https://github.com/tremorlabs/tremor-npm/)

## 6. Maps
- [CARTO Basemaps](https://carto.com/basemaps/) (Dark Matter = the reference look, Positron = light). See [Dark Matter / Positron refresh](https://carto.com/blog/positron-dark-matter-new-look/). Free key for non-commercial use: [API key page](https://carto.com/basemaps/apikey/). Keep OSM and CARTO attribution visible.
- [CartoDB/basemap-styles](https://github.com/CartoDB/basemap-styles): open style JSONs for MapLibre if you want to recolor to the Ember palette.
- In this template: `index.html?tiles=1` swaps the procedural map for Leaflet + CARTO Dark Matter.

## 7. Apple Liquid Glass references
- [HIG: Materials](https://developer.apple.com/design/human-interface-guidelines/materials): use glass for floating controls and navigation, regular (more opaque) glass for text-heavy areas.
- [Adopting Liquid Glass](https://developer.apple.com/documentation/TechnologyOverviews/adopting-liquid-glass?changes=latest_major%2Clatest_major) · [WWDC25: Meet Liquid Glass](https://developer.apple.com/videos/play/wwdc2025/219/)

---

## 8. Mobbin reference screens (via the Mobbin connector)

Pulled with `search_screens`. These are the best matches for the layout, IA and patterns. Click through to study spacing, hierarchy and how each app keeps dense data calm. (Mobbin may require a login to view.)

### Dark analytics / command-center dashboards (web)
| App | What to steal | Link |
|---|---|---|
| **Cloudflare** | Dark metrics row with inline sparklines, right-rail "next steps" cards, map panel at bottom. Closest IA to this template | [screen](https://mobbin.com/screens/fa011061-0438-45b8-9371-caa44424b211) |
| **Kraken Pro** | Near-black trading dashboard, configurable widget panel, tiny trend charts per row | [screen](https://mobbin.com/screens/202be2d8-704f-49a1-9f2c-bb94818c95b0) |
| **Vapi** | KPI cards with *tinted* glow per metric (green/orange/purple/blue), very premium | [screen](https://mobbin.com/screens/84b8241c-f17c-4e54-aca4-7c4551e2432d) |
| **Mintlify** | Restrained stat tiles plus single-color bar chart, lots of black space | [screen](https://mobbin.com/screens/03b084b9-d5ed-41be-a9ca-43445af854f2) |
| **StackAI** | Grid of small-multiple charts with consistent gray bars | [screen](https://mobbin.com/screens/03fb91f0-89d0-45e6-ada1-34d533a3febf) |
| **Basedash** | Monospace numerals, thin line chart, donut with center total | [screen](https://mobbin.com/screens/190a82d9-8013-45c6-b768-5cc7d0cc2a7b) |
| **Posh** | Single glowing area chart with a clean tooltip | [screen](https://mobbin.com/screens/a5dfb295-302e-4298-83e0-d78a646e2c15) |
| **Featurebase** | Stat header plus area chart plus two ranked lists | [screen](https://mobbin.com/screens/368b2a57-0906-4e2f-b894-682cb11187cb) |
| **Jobber** | Workflow status cards with thin colored top accents (warm palette idea) | [screen](https://mobbin.com/screens/9de47309-e37f-40db-b3c8-847d17392de7) |
| **Graphite** | Insight cards with "Good" status pills and explanations | [screen](https://mobbin.com/screens/2bf19b77-5788-40d1-a5de-b48ba037205f) |
| **Lovable (Nexus demo)** | Typical AI-generated dashboard. Good as a *before* example of what to calm down | [screen](https://mobbin.com/screens/ad361de1-19e5-4115-b654-876e0d8c06a8) |
| Navan | Live map plus traveler side panel (light) | [screen](https://mobbin.com/screens/4c2b8f2d-ee9b-44da-9e53-1ec3f2e12301) |
| Visitors | Full-bleed map with small floating dark glass panel | [screen](https://mobbin.com/screens/10aeefed-ad6b-406e-bceb-8db395b12796) |

### Live tracking / ETA (iOS)
| App | What to steal | Link |
|---|---|---|
| **Uber Eats** | Segmented progress bar plus "15 min away" map chip | [screen](https://mobbin.com/screens/c6a30e0d-0980-429a-a7f5-dc6149b198b1) |
| **Careem** | Big "4 minutes" numeral plus "On time" pill plus route line | [screen](https://mobbin.com/screens/b6b6e5da-e7e5-47b5-81b0-d33a4003a870) |
| **Grab** | Stepper progress with icons, "On time" status | [screen](https://mobbin.com/screens/e488eb81-4d0f-44a1-acc7-0c08c82af941) |
| **Keeta** | ETA range plus milestone progress plus promise card | [screen](https://mobbin.com/screens/da2106a1-d3ed-4538-8b88-501f792df2b2) |
| foodpanda | Route on map plus ETA card with ring progress | [screen](https://mobbin.com/screens/e9535db6-10e1-4c82-899a-f034c749d0cb) |
| Lyft | "1 min" bubble on route, bottom sheet | [screen](https://mobbin.com/screens/5d96e2a6-e7d9-4798-a76a-1c4dc174009b) |

### Command palettes (web)
| App | What to steal | Link |
|---|---|---|
| **Fey** | Dark glass palette with keyboard hints. Most premium | [screen](https://mobbin.com/screens/ff52ac90-4d18-4765-98da-df1e362a5ee1) |
| **Vapi** | Grouped actions / recent / pages plus footer hints | [screen](https://mobbin.com/screens/593d7acd-2e16-4365-bcd6-02ce52f48f3b) |
| Frame.io | Shortcut cheat-sheet palette | [screen](https://mobbin.com/screens/7bf0c9af-dd42-4511-a35e-15e097df461b) |
| Magnific | Light palette with shortcut chips | [screen](https://mobbin.com/screens/e22e26e2-f813-4f1e-beda-43c9ecf26419) |
| Juicebox / Mintlify | Clean light palettes | [Juicebox](https://mobbin.com/screens/2af813bf-0129-45d1-81ed-069edee76e16) · [Mintlify](https://mobbin.com/screens/7c7ad31f-9dfe-4be7-83d7-6002fe31d4d0) |
