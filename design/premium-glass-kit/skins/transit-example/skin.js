/* =====================================================================
   EXAMPLE SKIN: transit / fleet command center (the original SEKAI-style content)
   Loaded on top of js/skin.default.js. Only override what differs —
   defineSkin() deep-merges objects; arrays replace.
   Use: index.html?skin=transit-example   (or open skins/transit-example/)
   ALL DATA IS FAKE.
   ===================================================================== */
defineSkin({
  meta: { title: "Transit Command Center · Example Skin" },
  brand: { name: "TRANSIT" },

  /* expose all three themes for this app */
  themes: [
    { id: "night", label: "Night", icon: "i-moon" },
    { id: "ember", label: "Ember", icon: "i-flame" },
    { id: "warm",  label: "Warm",  icon: "i-sun" }
  ],

  /* app-specific icon added to the sprite */
  icons: {
    route: '<symbol id="i-route" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="18" r="2"/><circle cx="18" cy="6" r="2"/><path d="M8 18h7a3 3 0 0 0 0-6H9a3 3 0 0 1 0-6h7"/></symbol>',
    bus: '<symbol id="i-bus" viewBox="0 0 120 26" fill="none" stroke="currentColor" stroke-width="1"><rect x="2" y="3" width="112" height="17" rx="3"/><path d="M8 7h14v7H8zM26 7h14v7H26zM44 7h14v7H44zM62 7h14v7H62zM80 7h12v7H80zM98 4v15"/><circle cx="22" cy="21" r="3" fill="var(--bg-0)"/><circle cx="92" cy="21" r="3" fill="var(--bg-0)"/></symbol>'
  },

  nav: {
    tabs: [ { label: "Live Network", live: true, active: true }, { label: "Fleet" }, { label: "Routes" }, { label: "Analytics" }, { label: "AI Analysis" }, { label: "Maintenance" } ],
    searchPlaceholder: "Search locations, vehicles, or routes…",
    avatar: "JD"
  },

  left: {
    kpis: { title: "Network Overview" },
    trend: { title: "Operational Efficiency" },
    list: {
      title: "Active Vehicles", thumbIcon: "i-bus",
      items: [
        { name: "Bus 6023", status: "On Route",    tone: "ok",   meta: "Route 14", sub: "Downtown ↔ Airport", value: 87, unit: "%", series: [4,6,5,7,6,8,7,9,8,10], selected: true },
        { name: "Bus 4120", status: "Charging",    tone: "idle", meta: "Route 7",  sub: "Harbor ↔ Central",   value: 64, unit: "%", series: [6,5,6,4,5,4,6,5,7,6] },
        { name: "Bus 2209", status: "On Route",    tone: "ok",   meta: "Route 3",  sub: "University ↔ East",  value: 91, unit: "%", series: [3,4,6,5,7,8,7,9,10,9] },
        { name: "E-Bus 07", status: "Maintenance", tone: "warn", meta: "Route 5",  sub: "Depot",              value: 32, unit: "%", series: [7,6,6,5,4,5,3,4,3,2] }
      ]
    }
  },

  hero: {
    chip: { icon: "i-moon", primary: "22°C", secondary: "Clear", clock: true },
    floatCard: { icon: "i-route", title: "Route 14", value: "2.5", unit: "min", caption: "to next stop" },
    device: { title: "Route 14", value: "2.5", unit: "min", caption: "to next stop" },
    scene: {
      nodes: [
        { x: 270, y: 140, type: "point", label: "Harbor District", lx: 14, ly: -10 },
        { x: 332, y: 190, type: "item" },
        { x: 344, y: 252, type: "accent" },
        { x: 466, y: 325, type: "hub", label: "Central Station", lx: 26, ly: 6 },
        { x: 541, y: 370, type: "item", label: "Riverside", lx: -30, ly: 46 },
        { x: 593, y: 350, type: "alert" },
        { x: 658, y: 410, type: "item", label: "East Valley", lx: 40, ly: -38 },
        { x: 740, y: 510, type: "point", label: "Airport", lx: -18, ly: 34 }
      ]
    }
  },

  right: {
    insights: {
      title: "Navigation Intelligence",
      cards: [
        { tone: "danger", icon: "i-alert", label: "Congestion Predicted", meta: "AI Analysis", title: "+18 min delay on Route 14",
          desc: "Heavy traffic expected near Central Station between 1:50 AM – 2:20 AM.", media: "heat" },
        { tone: "info", icon: "i-shuffle", label: "Alternate Route", meta: "2.5 min", title: "Reroute via East Corridor", desc: "Saves an estimated 18 minutes." },
        { tone: "ok", icon: "i-chart", label: "Schedule Adherence", metaNum: "92%", desc: "On-time performance across all routes.", progress: { value: 92, segments: 10 } }
      ]
    },
    bars: { title: "Passenger Flow", subtitle: "Live network demand", peakSub: "1:40 AM" }
  }
});
