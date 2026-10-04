# Skins: app-specific layers

The base template (`/index.html` + `js/skin.default.js`) is **app-agnostic**. A *skin* layers an app's wording, data, icons, themes and token tweaks on top of it, **without editing the engine**.

```
js/skin.default.js        ← generic labels + fake data (always loaded first)
skins/<name>/skin.js      ← your app layer: defineSkin({...}) overrides
skins/<name>/skin.css     ← optional extra CSS (list it in SKIN.css)
css/tokens.css            ← themes; a skin can tweak tokens via SKIN.tokens
```

## Load a skin
- URL: `index.html?skin=<name>`
- Or hard-wire it: in `index.html`, add `<script>window.PGK_SKIN="<name>"</script>` before the loader script (or just add `<script src="skins/<name>/skin.js"></script>` right after `js/skin.default.js`).

## Make a new skin
1. Copy `skins/transit-example/` to `skins/<your-app>/`.
2. In `skin.js`, keep only what differs. `defineSkin()` **deep-merges objects** and **replaces arrays** (so `items: [...]` replaces the whole list).
3. Options you can set:

| Key | What |
|---|---|
| `meta.title`, `meta.demoBadge` | page title and data badge |
| `brand.name`, `brand.icon` | logo text and sprite icon id |
| `themes` | which theme buttons show, e.g. add `{id:"ember",label:"Ember",icon:"i-flame"}` |
| `defaultTheme` | force a starting theme |
| `tokens` | per-theme overrides, e.g. `{ night: { "--accent": "#ff7a00" } }` |
| `icons` | extra `<symbol>` markup added to the sprite |
| `css` | extra stylesheet paths |
| `nav` | tabs, search placeholder, avatar, notifications |
| `left.kpis / trend / list` | KPI tiles, hero stat + sparkline, list rows |
| `hero.mode` | `"map"` (procedural map, `scene` = path/nodes/clusters) or `"media"` (`media.src` image/video, or a gradient fallback) |
| `hero.chip / floatCard / device / viewModes / tiles` | hero overlays |
| `right.insights.cards[]` | `tone` danger/info/ok/accent, `icon`, `label`, `meta` or `metaNum`, `title`, `desc`, `media:"heat"`, `progress:{value,segments}` |
| `right.bars` | bar chart series, peak, labels |

Set any section to `null` (e.g. `right: { bars: null }`) to remove that card.

## Included example
- `transit-example/`: fleet/transit command center (the original reference content). Open `index.html?skin=transit-example`.
