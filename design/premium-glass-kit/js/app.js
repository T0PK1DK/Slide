/* =====================================================================
   APP ENGINE — renders every [data-slot] from window.SKIN.
   Components are small template functions; swap or delete freely.
   No app-specific wording lives here — it all comes from the skin.
   ===================================================================== */
(function () {
  const S = window.SKIN, root = document.documentElement;
  const $ = (s, p = document) => p.querySelector(s);
  const $$ = (s, p = document) => [...p.querySelectorAll(s)];
  const params = new URLSearchParams(location.search);
  const esc = v => String(v ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const icon = (id, attrs = "") => `<svg ${attrs}><use href="#${esc(id)}"/></svg>`;
  const slot = name => $(`[data-slot="${name}"]`);
  if (params.has("static")) root.dataset.static = "1"; // screenshots: no entrance motion
  if (S.meta && S.meta.title) document.title = S.meta.title;

  /* ---------- Skin extras: icons, css, token overrides ---------- */
  const defs = $("svg defs");
  Object.values(S.icons || {}).forEach(markup => defs.insertAdjacentHTML("beforeend", markup));
  (S.css || []).forEach(href => { const l = document.createElement("link"); l.rel = "stylesheet"; l.href = href; document.head.appendChild(l); });
  const ov = Object.entries(S.tokens || {}).map(([theme, vars]) =>
    `[data-theme="${theme}"]{${Object.entries(vars).map(([k, v]) => `${k}:${v}`).join(";")}}`).join("\n");
  if (ov) { const st = document.createElement("style"); st.textContent = ov; document.head.appendChild(st); }

  /* ---------- Component: TopNav ---------- */
  function TopNav(n, brand, themes) {
    return `
      <div class="brand">${icon(brand.icon)}<span>${esc(brand.name)}</span></div>
      <nav class="tabs" aria-label="Primary">${n.tabs.map(t => `
        <button class="tab" ${t.active ? 'aria-current="page"' : ""}>${t.live ? '<span class="dot dot--live"></span><span class="t-caps">' + esc(t.label) + "</span>" : esc(t.label)}</button>`).join("")}
      </nav>
      <div class="nav-right">
        <label class="search">${icon("i-search", 'width="15" height="15"')}<input id="cmdk" placeholder="${esc(n.searchPlaceholder)}" /><span class="kbd">⌘K</span></label>
        <div class="seg theme-seg" role="group" aria-label="Theme">${themes.map(t => `
          <button data-theme-btn="${esc(t.id)}" aria-pressed="false" title="${esc(t.label)}">${icon(t.icon, 'width="13" height="13"')}<span class="lbl">${esc(t.label)}</span></button>`).join("")}
        </div>
        ${n.notifications ? `<button class="icon-btn hide-sm" aria-label="Notifications">${icon("i-bell")}<span class="badge-dot"></span></button>` : ""}
        <div class="avatar" aria-label="Account">${esc(n.avatar)}</div>
      </div>`;
  }

  /* ---------- Component: KpiPairCard ---------- */
  const KpiPair = k => `
    <div class="card-head"><h2 class="t-title">${esc(k.title)}</h2>${k.period ? `<span class="pill-select">${esc(k.period)} ${icon("i-chev-d")}</span>` : ""}</div>
    <div class="kpi-pair">${k.items.map(i => `
      <div class="kpi"><div class="num num--kpi" data-countup="${+i.value}">${esc(i.value)}</div><div class="label"><span class="dot dot--${esc(i.tone)}"></span>${esc(i.label)}</div></div>`).join("")}
    </div>`;

  /* ---------- Component: HeroStatSparkline ---------- */
  const Trend = t => `
    <div class="card-head" style="margin-bottom:4px"><h3 class="t-title" style="font-size:var(--fs-sm)">${esc(t.title)}</h3>${icon("i-chev-r", 'class="chev"')}</div>
    <div class="stat-hero">
      <div class="num num--hero"><span data-countup="${+t.value}" data-decimals="${t.decimals || 0}">${esc(t.value)}</span><span class="u">${esc(t.unit)}</span></div>
      ${t.delta ? `<span class="delta ${t.deltaDir === "down" ? "delta--down" : ""}">${icon("i-up", 'width="10" height="10"' + (t.deltaDir === "down" ? ' style="transform:rotate(180deg)"' : ""))}${esc(t.delta)}</span>` : ""}
    </div>
    <svg class="sparkline" id="trend-spark" role="img" aria-label="${esc(t.title)} trend (demo)"></svg>
    <div class="viz-axis">${(t.xLabels || []).map(x => `<span>${esc(x)}</span>`).join("")}</div>`;

  /* ---------- Component: SelectableList ---------- */
  const List = l => `
    <div class="list-head"><h3 class="t-title">${esc(l.title)}</h3>${l.action ? `<a href="#" class="link-sm">${esc(l.action)} ${icon("i-arrow-r", 'width="13" height="13"')}</a>` : ""}</div>
    <div id="item-list" role="listbox" aria-label="${esc(l.title)}" style="margin-top:var(--space-3)">${l.items.map((u, i) => `
      <button class="list-row" role="option" aria-selected="${!!u.selected}">
        <div><div class="name"><span class="dot dot--${esc(u.tone)}"></span>${esc(u.name)}</div>
          <div class="status">${esc(u.status)}</div>
          <svg class="thumb" viewBox="0 0 120 26"><use href="#${esc(u.thumbIcon || l.thumbIcon)}"/></svg></div>
        <div><div class="meta"><span>${esc(u.meta)}</span>${icon("i-chev-r", 'class="chev"')}</div>
          <div class="meta-sub">${esc(u.sub)}</div>
          <div class="mini"><svg data-mini="${i}"></svg><span class="val">${esc(u.value)}<small>${esc(u.unit)}</small></span></div></div>
      </button>`).join("")}
    </div>`;

  /* ---------- Component: HeroTop (view modes + status chip) ---------- */
  const HeroTop = h => `
    <div class="hero-tools">
      <button class="glass icon-btn" style="border-radius:12px;width:38px;height:38px" aria-label="Fullscreen">${icon("i-expand")}</button>
      ${h.mode === "map" && h.viewModes?.length ? `<div class="seg" role="group" aria-label="View" id="map-mode">${h.viewModes.map((m, i) =>
        `<button aria-pressed="${i === 0}" data-mode="${esc(m.id)}">${esc(m.label)}</button>`).join("")}</div>` : ""}
    </div>
    ${h.chip ? `<div class="glass weather">
      ${icon(h.chip.icon)}
      <div><div class="big">${esc(h.chip.primary)}</div><div class="t-meta">${esc(h.chip.secondary)}</div></div>
      ${h.chip.clock ? `<span class="divider hide-sm"></span><div class="hide-sm"><div class="big" id="clock">--</div><div class="t-meta" id="date">--</div></div>` : ""}
    </div>` : ""}`;

  /* ---------- Component: FloatingInfoCard ---------- */
  const FloatCard = f => `
    <div class="head">${icon(f.icon, 'class="ic"')}<span>${esc(f.title)}</span>${icon("i-chev-r", 'class="chev" style="margin-left:auto"')}</div>
    <div class="body">
      <div><div class="num num--md">${esc(f.value)} <span class="u" style="font-size:.6em">${esc(f.unit)}</span></div><div class="t-meta">${esc(f.caption)}</div></div>
      <svg class="spark" id="float-spark"></svg>
    </div>`;

  /* ---------- Component: DevicePreview ---------- */
  const Device = (d, brand) => `
    <div class="screen">
      <div class="notch"></div>
      <div class="status"><span>9:41</span><span>●●● ▮</span></div>
      <div class="mini-brand"><span style="display:flex;gap:5px;align-items:center">${icon(brand.icon, 'width="10" height="10"')}${esc(brand.name)}</span><span class="kbd" style="font-size:8px">≡</span></div>
      <div class="mini-map"><canvas id="mini-canvas"></canvas><svg id="mini-overlay" preserveAspectRatio="xMidYMid slice"></svg></div>
      <div class="glass mini-card">
        <div class="row row--between" style="font-size:10px"><span class="row" style="gap:5px"><span class="dot dot--ok" style="width:5px;height:5px"></span>${esc(d.title)}</span>${icon("i-chev-r", 'width="10" height="10" class="chev"')}</div>
        <div class="num" style="margin-top:6px">${esc(d.value)} <span class="u">${esc(d.unit)}</span></div>
        <div class="t-meta" style="font-size:9px">${esc(d.caption)}</div>
      </div>
      <div class="dots"><div><span></span><span></span><span style="background:var(--text-1)"></span><span></span><span></span></div><div class="go">${icon("i-chev-r", 'width="12" height="12"')}</div></div>
    </div>`;

  /* ---------- Component: InsightPanel → AlertCard / ProgressCard ---------- */
  const InsightCard = (c, i) => `
    <article class="insight ${c.tone === "danger" || c.tone === "info" ? "insight--" + c.tone : ""}">
      <div class="ihead"><span class="icon-tile icon-tile--${esc(c.tone)}">${icon(c.icon)}</span><span class="label">${esc(c.label)}</span>
        ${c.metaNum ? `<span class="right num" style="font-size:var(--fs-lg);font-weight:var(--fw-regular)">${esc(c.metaNum)}</span>` : c.meta ? `<span class="right ${c.tone === "danger" ? "t-meta" : ""}">${esc(c.meta)}</span>` : ""}</div>
      ${c.title ? `<div class="title">${esc(c.title)}</div>` : ""}
      ${c.desc ? `<p class="desc" ${c.title ? "" : 'style="margin-top:6px"'}>${esc(c.desc)}</p>` : ""}
      ${c.media === "heat" ? `<div class="heat"><canvas data-heat="${i}"></canvas></div>` : ""}
      ${c.progress ? `<div class="segbar" data-progress="${i}"></div>` : ""}
    </article>`;
  const Insights = p => `
    <div class="card-head is-link"><div><h2 class="t-panel">${esc(p.title)}</h2><p class="t-sub">${esc(p.subtitle)}</p></div>${icon("i-chev-r", 'class="chev"')}</div>
    ${p.cards.map(InsightCard).join("")}`;

  /* ---------- Component: BarChartCard ---------- */
  const Bars = b => `
    <div class="card-head"><div><h2 class="t-panel" style="font-size:var(--fs-lg)">${esc(b.title)}</h2><p class="t-sub">${esc(b.subtitle)}</p></div>
      ${b.period ? `<span class="pill-select">${esc(b.period)} ${icon("i-chev-d")}</span>` : ""}</div>
    <div class="chart-wrap" id="bars-wrap"><svg class="barchart" id="bars-chart" role="img" aria-label="${esc(b.title)} (demo)"></svg></div>
    <div class="viz-axis" style="padding-right:26px">${(b.xLabels || []).map(x => `<span>${esc(x)}</span>`).join("")}</div>
    <div class="row row--between" style="margin-top:var(--space-3)"><span class="demo-badge">${esc(S.meta.demoBadge)}</span><span class="t-meta">${esc(b.footnote || "")}</span></div>`;

  /* ---------- Mount ---------- */
  const fill = (name, html) => { const el = slot(name); if (el) { if (html == null) el.remove(); else el.innerHTML = html; } };
  fill("topnav", TopNav(S.nav, S.brand, S.themes));
  fill("kpis", S.left.kpis && KpiPair(S.left.kpis));
  fill("trend", S.left.trend && Trend(S.left.trend));
  fill("list", S.left.list && List(S.left.list));
  fill("hero-top", HeroTop(S.hero));
  fill("float-card", S.hero.floatCard && FloatCard(S.hero.floatCard));
  fill("device", S.hero.device && S.hero.device.show ? Device(S.hero.device, S.brand) : null);
  fill("insights", S.right.insights && Insights(S.right.insights));
  fill("bars", S.right.bars && Bars(S.right.bars));
  if (S.hero.floatCard && S.hero.floatCard.pos) Object.assign($("#float-card").style, S.hero.floatCard.pos);

  /* ---------- Theme switch ---------- */
  const THEMES = S.themes.map(t => t.id);
  function setTheme(t) {
    if (!THEMES.includes(t)) t = (S.defaultTheme && THEMES.includes(S.defaultTheme)) ? S.defaultTheme : THEMES[0];
    root.setAttribute("data-theme", t);
    try { localStorage.setItem("pgk-theme", t); } catch (e) {}
    $$("[data-theme-btn]").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.themeBtn === t)));
    requestAnimationFrame(drawHero);
  }
  $$("[data-theme-btn]").forEach(b => b.addEventListener("click", () => setTheme(b.dataset.themeBtn)));
  const initial = params.get("theme") || (function () { try { return localStorage.getItem("pgk-theme"); } catch (e) { return null; } })() || S.defaultTheme || root.getAttribute("data-theme");
  setTheme(initial);

  /* ---------- List selection ---------- */
  $$(".list-row").forEach(b => b.addEventListener("click", () => {
    $$(".list-row").forEach(x => x.setAttribute("aria-selected", "false")); b.setAttribute("aria-selected", "true");
  }));

  /* ---------- Charts ---------- */
  function drawCharts() {
    const t = S.left.trend;
    if (t && $("#trend-spark")) Charts.sparkline($("#trend-spark"), t);
    $$("[data-mini]").forEach(s => {
      const u = S.left.list.items[+s.dataset.mini], mx = Math.max(...u.series) * 1.1;
      Charts.sparkline(s, { series: u.series, min: 0, max: mx, axis: false, area: true, stroke: 1, smooth: 0 });
    });
    const f = S.hero.floatCard;
    if (f && f.series && $("#float-spark")) Charts.sparkline($("#float-spark"), { series: f.series, min: 0, max: Math.max(...f.series) * 1.1, axis: false, area: false, stroke: 1, smooth: 0 });
    if (S.right.bars && $("#bars-chart")) Charts.barChart($("#bars-chart"), $("#bars-wrap"), S.right.bars);
  }
  (S.right.insights?.cards || []).forEach((c, i) => { if (c.progress) Charts.segmented($(`[data-progress="${i}"]`), c.progress); });

  /* ---------- Hero (map or media) ---------- */
  const hero = $("#hero"), H = S.hero;
  let viewMode = H.viewModes?.[0]?.id || "map";
  if (H.mode === "media") {
    hero.classList.add("mode-media");
    const m = H.media || {};
    if (m.src) $("#media-host").innerHTML = m.type === "video"
      ? `<video src="${esc(m.src)}" autoplay muted loop playsinline></video>` : `<img src="${esc(m.src)}" alt="${esc(m.alt)}">`;
  } else {
    HeroMap.overlay($("#map-overlay"), H.scene);
    const mini = $("#mini-overlay");
    if (mini) { mini.setAttribute("viewBox", "180 120 520 488"); HeroMap.overlay(mini, H.scene, { scale: 2.2, labels: false, flow: false }); }
  }
  function drawHero() {
    if (H.mode !== "media") {
      HeroMap.render($("#map-canvas"), H.scene, { mode: viewMode });
      if ($("#mini-canvas")) HeroMap.render($("#mini-canvas"), H.scene, { view: { x: 180, y: 120, w: 520, h: 488 }, dots: 9000 });
    }
    $$("[data-heat]").forEach(c => HeroMap.render(c, H.scene, {
      view: { x: 360, y: 220, w: 460, h: 200 }, dots: 9000, lightRGB: "255, 110, 100",
      heat: [[[380, 300], [440, 280], [520, 300], [600, 290], [690, 330], [780, 300]], [[420, 360], [500, 330], [560, 360], [640, 340], [720, 395], [800, 380]]]
    }));
  }
  $$("#map-mode button").forEach(b => b.addEventListener("click", () => {
    $$("#map-mode button").forEach(x => x.setAttribute("aria-pressed", String(x === b)));
    viewMode = b.dataset.mode; drawHero();
  }));

  /* Optional real tiles: SKIN.hero.tiles = true or ?tiles=1 (needs internet; Leaflet + CARTO Dark Matter). */
  if (H.mode === "map" && (H.tiles || params.get("tiles") === "1")) {
    const l = document.createElement("link"); l.rel = "stylesheet"; l.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"; document.head.appendChild(l);
    const s = document.createElement("script"); s.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    s.onload = () => {
      hero.classList.add("use-tiles");
      const m = L.map("leaflet-host", { zoomControl: false }).setView(H.tilesCenter || [37.77, -122.35], H.tilesZoom || 11);
      L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>', maxZoom: 19
      }).addTo(m);
      $("#map-overlay").style.display = "none";
    };
    document.body.appendChild(s);
  }

  /* ---------- Clock ---------- */
  function tickClock() {
    const c = $("#clock"), d = $("#date"); if (!c) return;
    const now = new Date();
    const [hm, ap] = now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }).split(" ");
    c.innerHTML = `${hm} <span class="t-meta">${ap || ""}</span>`;
    d.textContent = now.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  }
  tickClock(); setInterval(tickClock, 30000);

  /* ---------- Count-up numbers ---------- */
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  $$("[data-countup]").forEach(n => {
    const end = parseFloat(n.dataset.countup), dec = +(n.dataset.decimals || 0);
    if (reduce || root.dataset.static) { n.textContent = end.toFixed(dec); return; }
    const t0 = performance.now(), dur = 900;
    const tick = t => { const p = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - p, 3); n.textContent = (end * e).toFixed(dec); if (p < 1) requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  });

  /* ---------- ⌘K focuses search (wire a command palette here) ---------- */
  addEventListener("keydown", e => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); $("#cmdk")?.focus(); } });

  /* ---------- Redraw on resize ---------- */
  let raf;
  const redraw = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => { drawCharts(); drawHero(); }); };
  new ResizeObserver(redraw).observe(document.body);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(redraw);
  redraw();
})();
