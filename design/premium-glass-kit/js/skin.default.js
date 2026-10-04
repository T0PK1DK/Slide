/* =====================================================================
   DEFAULT SKIN — generic, app-agnostic placeholder content.
   Every label, number and option shown on the page comes from here.
   ALL DATA IS FAKE. Layer an app-specific skin on top with defineSkin()
   (see skins/transit-example/skin.js and README.md).
   ===================================================================== */
(function () {
  // Deep-merge helper: arrays and primitives replace, objects merge.
  function merge(base, over) {
    if (Array.isArray(over) || typeof over !== "object" || over === null) return over;
    const out = Array.isArray(base) ? {} : { ...(base || {}) };
    for (const k in over) out[k] = (k in out && typeof out[k] === "object" && !Array.isArray(out[k])) ? merge(out[k], over[k]) : over[k];
    return out;
  }
  window.defineSkin = function (partial) { window.SKIN = merge(window.SKIN || {}, partial); };

  const wave = (n, base, amp, drift, seed = 1) => Array.from({ length: n }, (_, i) =>
    +(base + Math.sin(i * 0.9 + seed) * amp * 0.5 + Math.sin(i * 2.3 + seed * 2) * amp * 0.3 + (i / n) * drift).toFixed(1));

  window.defineSkin({
    meta: { title: "Premium Glass Kit · Dashboard Template", demoBadge: "All figures are demo data" },

    /* Optional per-skin token overrides, e.g. { night: { "--accent": "#ff7a00" } } */
    tokens: {},
    /* Optional extra CSS file(s) for this skin and extra icon <symbol> markup */
    css: [],
    icons: {},

    brand: { name: "BRAND", icon: "i-logo" },

    /* Theme switch. Add "ember" (warm dark) here to expose the optional third theme. */
    themes: [
      { id: "night", label: "Night", icon: "i-moon" },
      { id: "warm",  label: "Warm",  icon: "i-sun" }
    ],
    defaultTheme: null, // null → follows system (dark → first theme, light → "warm")

    nav: {
      tabs: [
        { label: "Live Overview", live: true, active: true },
        { label: "Projects" }, { label: "Reports" }, { label: "Analytics" }, { label: "Insights" }, { label: "Settings" }
      ],
      searchPlaceholder: "Search items, people, or pages…",
      avatar: "AB",
      notifications: true
    },

    left: {
      kpis: {
        title: "Overview", period: "24h",
        items: [ { value: 12, label: "Active", tone: "ok" }, { value: 4, label: "Alerts", tone: "danger" } ]
      },
      trend: {
        title: "Efficiency", value: 78.3, decimals: 1, unit: "%", delta: "+4.2%", deltaDir: "up",
        series: wave(48, 56, 10, 18, 2), marks: [21, 29, 43], min: 0, max: 100, yTicks: [25, 50, 75, 100], tickSuffix: "%",
        xLabels: ["00:00", "04:00", "08:00", "12:00", "16:00", "20:00"]
      },
      list: {
        title: "Active Items", action: "View all", thumbIcon: "i-thumb",
        items: [
          { name: "Item Alpha",   status: "Online",  tone: "ok",   meta: "Workspace A", sub: "Team North · Weekly", value: 87, unit: "%", series: [4,6,5,7,6,8,7,9,8,10], selected: true },
          { name: "Item Bravo",   status: "Syncing", tone: "idle", meta: "Workspace B", sub: "Team South · Daily",  value: 64, unit: "%", series: [6,5,6,4,5,4,6,5,7,6] },
          { name: "Item Charlie", status: "Online",  tone: "ok",   meta: "Workspace C", sub: "Team East · Monthly", value: 91, unit: "%", series: [3,4,6,5,7,8,7,9,10,9] },
          { name: "Item Delta",   status: "Review",  tone: "warn", meta: "Workspace D", sub: "Team West · Paused",  value: 32, unit: "%", series: [7,6,6,5,4,5,3,4,3,2] }
        ]
      }
    },

    hero: {
      mode: "map",            // "map" (procedural night map) | "media" (image / video / gradient)
      media: { src: null, type: "image", alt: "" },   // used when mode = "media"
      tiles: false,           // true → Leaflet + CARTO Dark Matter tiles (needs internet)
      viewModes: [ { id: "map", label: "Map" }, { id: "satellite", label: "Satellite" }, { id: "terrain", label: "Terrain" } ],
      chip: { icon: "i-pulse", primary: "Live", secondary: "All systems normal", clock: true },
      floatCard: { icon: "i-spark", title: "Featured Metric", value: "2.5", unit: "k", caption: "events per minute", series: [5,6,4,7,5,8,6,7,9,8], pos: { left: "57%", top: "28%" } },
      device: { show: true, title: "Featured Metric", value: "2.5", unit: "k", caption: "events per minute" },
      /* Map scene in a 1000×620 virtual space (matches the SVG viewBox). Node types: point | item | hub | alert | accent */
      scene: {
        seed: 7,
        path: [[270,140],[293,130],[316,155],[332,190],[344,250],[366,275],[404,290],[443,310],[466,325],[502,345],[541,370],[567,362],[593,350],[616,370],[632,400],[658,410],[691,430],[724,460],[740,510]],
        nodes: [
          { x: 270, y: 140, type: "point", label: "Location A", lx: 14, ly: -10 },
          { x: 332, y: 190, type: "item" },
          { x: 344, y: 252, type: "accent" },
          { x: 466, y: 325, type: "hub", label: "Main Hub", lx: 26, ly: 6 },
          { x: 541, y: 370, type: "item", label: "Location B", lx: -30, ly: 46 },
          { x: 593, y: 350, type: "alert" },
          { x: 658, y: 410, type: "item", label: "Location C", lx: 40, ly: -38 },
          { x: 740, y: 510, type: "point", label: "Endpoint", lx: -18, ly: 34 }
        ],
        clusters: [[290,150,90],[470,325,150],[615,380,110],[730,480,100],[370,230,70],[560,500,80],[300,430,70],[700,220,90],[180,250,90],[860,330,90]]
      }
    },

    right: {
      insights: {
        title: "Insights", subtitle: "Real-time analysis and AI-powered suggestions.",
        cards: [
          { tone: "danger", icon: "i-alert", label: "Anomaly Detected", meta: "AI Analysis", title: "+18% error rate in Module B",
            desc: "Unusual spike expected between 1:50 PM – 2:20 PM.", media: "heat" },
          { tone: "info", icon: "i-shuffle", label: "Suggestion", meta: "2.5 min", title: "Rebalance workload to Group East", desc: "Saves an estimated 18 minutes." },
          { tone: "ok", icon: "i-chart", label: "Goal Progress", metaNum: "92%", desc: "Target completion across all workstreams.", progress: { value: 92, segments: 10 } }
        ]
      },
      bars: {
        title: "Activity", subtitle: "Live demand", period: "Today",
        series: [3,4,3,5,4,6,5,7,6,8,9,11,12.4,10,11,12,11,10,12,11,9,10,11,10,9,10,8,9,10,9,8,7,9,8,7,8,9,11,10,12,9,13,11,8,10,7,9,6],
        peakIndex: 12, peakLabel: "12.4K", peakSub: "6:10 AM", yTicks: ["20K","15K","10K","5K","0"], max: 20,
        xLabels: ["00:00", "06:00", "12:00", "18:00", "24:00"], footnote: "Updated just now"
      }
    }
  });
})();
