/* =====================================================================
   CHARTS — tiny dependency-free SVG charts that read colors from tokens.
   All colors use var(--token) so theme switches recolor without re-render.
   Swap for Recharts / Tremor / shadcn charts in a React app (see COMPONENTS.md).
   ===================================================================== */
(function () {
  const NS = "http://www.w3.org/2000/svg";
  let uid = 0;
  const el = (tag, attrs = {}, parent) => {
    const n = document.createElementNS(NS, tag);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  };
  // Smooth path through points (Catmull-Rom → Bezier)
  function smoothPath(pts, t = 0.18) {
    if (pts.length < 2) return "";
    let d = `M${pts[0][0]},${pts[0][1]}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
      const c1 = [p1[0] + (p2[0] - p0[0]) * t, p1[1] + (p2[1] - p0[1]) * t];
      const c2 = [p2[0] - (p3[0] - p1[0]) * t, p2[1] - (p3[1] - p1[1]) * t];
      d += ` C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${p2[0]},${p2[1]}`;
    }
    return d;
  }

  /** Sparkline / area chart with right-side ticks and highlight dots */
  function sparkline(svg, { series, yTicks = [], marks = [], min = 0, max = 100, axis = true, area = true, stroke = 1.3, smooth = 0.12, tickSuffix = "" }) {
    const W = svg.clientWidth || 260, H = svg.clientHeight || 100;
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    svg.innerHTML = "";
    const padR = axis ? 30 : 1, padT = 6, padB = 4;
    const iw = W - padR, ih = H - padT - padB;
    const x = i => (i / (series.length - 1)) * iw;
    const y = v => padT + ih - ((v - min) / (max - min)) * ih;
    const id = "g" + (++uid);
    const defs = el("defs", {}, svg);
    const lg = el("linearGradient", { id, x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
    el("stop", { offset: "0%", style: "stop-color:var(--viz-area-top)" }, lg);
    el("stop", { offset: "100%", style: "stop-color:var(--viz-area-bottom)" }, lg);
    if (axis) {
      yTicks.forEach(t => {
        const yy = y(t);
        el("line", { x1: 0, x2: iw, y1: yy, y2: yy, style: "stroke:var(--grid-line)", "stroke-dasharray": "2 4" }, svg);
        const tx = el("text", { x: W - 2, y: yy + 3, "text-anchor": "end" }, svg); tx.textContent = t + tickSuffix;
      });
    }
    const pts = series.map((v, i) => [+x(i).toFixed(1), +y(v).toFixed(1)]);
    const d = smooth ? smoothPath(pts, smooth) : "M" + pts.map(p => p.join(",")).join(" L");
    if (area) el("path", { d: `${d} L${iw},${padT + ih} L0,${padT + ih} Z`, fill: `url(#${id})` }, svg);
    el("path", { d, fill: "none", style: `stroke:var(--viz-line)`, "stroke-width": stroke, "stroke-linejoin": "round", "stroke-linecap": "round" }, svg);
    marks.forEach(i => {
      const [px, py] = pts[i];
      el("line", { x1: px, x2: px, y1: py, y2: padT + ih, style: "stroke:var(--viz-line)", "stroke-opacity": 0.25, "stroke-dasharray": "1 3" }, svg);
      el("circle", { cx: px, cy: py, r: 2.6, style: "fill:var(--viz-line)" }, svg);
    });
  }

  /** Bar chart with one highlighted (warm) peak + glass tooltip */
  function barChart(svg, wrap, { series, peakIndex, peakLabel, peakSub, yTicks = [], max }) {
    const W = svg.clientWidth || 280, H = svg.clientHeight || 150;
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    svg.innerHTML = "";
    const padR = 26, padT = 34, padB = 2;
    const iw = W - padR, ih = H - padT - padB;
    const n = series.length, gap = 2, bw = Math.max(2, iw / n - gap);
    const m = max || Math.max(...series);
    const id = "b" + (++uid), pid = "p" + uid;
    const defs = el("defs", {}, svg);
    const g1 = el("linearGradient", { id, x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
    el("stop", { offset: "0%", style: "stop-color:var(--viz-bar-top)" }, g1);
    el("stop", { offset: "100%", style: "stop-color:var(--viz-bar)", "stop-opacity": 0.35 }, g1);
    const g2 = el("linearGradient", { id: pid, x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
    el("stop", { offset: "0%", style: "stop-color:var(--viz-bar-peak)" }, g2);
    el("stop", { offset: "100%", style: "stop-color:var(--viz-bar-peak)", "stop-opacity": 0.05 }, g2);
    const f = el("filter", { id: id + "f", x: "-200%", y: "-50%", width: "500%", height: "200%" }, defs);
    el("feGaussianBlur", { stdDeviation: 4 }, f);

    yTicks.forEach((t, i) => {
      const yy = padT + (ih * i) / (yTicks.length - 1);
      el("line", { x1: 0, x2: iw, y1: yy, y2: yy, style: "stroke:var(--grid-line)", "stroke-dasharray": "2 4" }, svg);
      const tx = el("text", { x: W - 1, y: yy + 3, "text-anchor": "end" }, svg); tx.textContent = t;
    });
    series.forEach((v, i) => {
      const h = Math.max(2, (v / m) * ih), bx = i * (bw + gap), by = padT + ih - h;
      const peak = i === peakIndex;
      if (peak) el("rect", { x: bx - 2, y: by, width: bw + 4, height: h, rx: 2, style: "fill:var(--viz-bar-peak)", opacity: 0.55, filter: `url(#${id}f)` }, svg);
      const r = el("rect", { x: bx, y: by, width: bw, height: h, rx: Math.min(1.5, bw / 2), fill: `url(#${peak ? pid : id})` }, svg);
      if (!document.documentElement.dataset.static) {
      r.style.transformOrigin = `${bx}px ${padT + ih}px`;
      r.style.animation = `barIn 600ms ${i * 8}ms cubic-bezier(.22,1,.36,1) both`; }
      if (peak) {
        el("circle", { cx: bx + bw / 2, cy: by, r: 2.2, style: "fill:var(--viz-bar-peak)" }, svg);
        // tooltip (HTML glass chip, positioned in %)
        let tip = wrap.querySelector(".bar-tooltip");
        if (!tip) { tip = document.createElement("div"); tip.className = "glass glass--float bar-tooltip"; wrap.appendChild(tip); }
        tip.innerHTML = `${peakLabel}<small>${peakSub}</small>`;
        tip.style.left = ((bx + bw / 2) / W) * 100 + "%";
        tip.style.top = (by - 6) + "px";
      }
    });
    if (!document.getElementById("barIn-kf")) {
      const s = document.createElement("style"); s.id = "barIn-kf";
      s.textContent = "@keyframes barIn{from{transform:scaleY(0)}to{transform:scaleY(1)}}";
      document.head.appendChild(s);
    }
  }

  /** Segmented progress (e.g. 92% across 10 segments) */
  function segmented(host, { value, segments = 10 }) {
    host.innerHTML = "";
    const per = 100 / segments;
    for (let i = 0; i < segments; i++) {
      const s = document.createElement("i");
      const filled = Math.max(0, Math.min(1, (value - i * per) / per));
      if (filled >= 1) s.className = "on";
      else if (filled > 0) { s.className = "partial"; s.style.setProperty("--p", (filled * 100).toFixed(0) + "%"); }
      host.appendChild(s);
    }
  }

  window.Charts = { sparkline, barChart, segmented };
})();
