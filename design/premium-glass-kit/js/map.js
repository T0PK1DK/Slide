/* =====================================================================
   HERO MAP — procedural "night city" map drawn on <canvas> + SVG overlay.
   No tiles, no API keys, works offline. Colors come from tokens
   (--map-water, --map-land, --map-light, --map-path…).
   Optional: real tiles via Leaflet + CARTO Dark Matter (see app.js / README).
   ===================================================================== */
(function () {
  const NS = "http://www.w3.org/2000/svg";
  const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();

  // ---- deterministic noise ----
  function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
  function makeNoise(seed) {
    const r = rng(seed), P = new Uint8Array(512), G = [];
    for (let i = 0; i < 256; i++) { P[i] = i; G.push(r()); }
    for (let i = 255; i > 0; i--) { const j = (r() * (i + 1)) | 0; [P[i], P[j]] = [P[j], P[i]]; }
    for (let i = 0; i < 256; i++) P[i + 256] = P[i];
    const f = t => t * t * (3 - 2 * t);
    const v = (x, y) => G[P[(P[x & 255] + y) & 255] & 255];
    const n2 = (x, y) => {
      const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
      const a = v(xi, yi), b = v(xi + 1, yi), c = v(xi, yi + 1), d = v(xi + 1, yi + 1);
      const u = f(xf), w = f(yf);
      return a + (b - a) * u + (c - a) * w + (a - b - c + d) * u * w;
    };
    return (x, y) => { let s = 0, a = 0.5, fr = 1; for (let o = 0; o < 5; o++) { s += a * n2(x * fr, y * fr); a *= 0.5; fr *= 2.03; } return s / 0.97; };
  }
  function distToPolyline(x, y, pts) {
    let best = 1e9;
    for (let i = 0; i < pts.length - 1; i++) {
      const [x1, y1] = pts[i], [x2, y2] = pts[i + 1];
      const dx = x2 - x1, dy = y2 - y1, L = dx * dx + dy * dy;
      let t = L ? ((x - x1) * dx + (y - y1) * dy) / L : 0; t = Math.max(0, Math.min(1, t));
      const ex = x1 + t * dx - x, ey = y1 + t * dy - y; const d = ex * ex + ey * ey; if (d < best) best = d;
    }
    return Math.sqrt(best);
  }

  // ---- land field (cached per seed) ----
  const FIELD = {};
  function landField(scene) {
    const key = scene.seed;
    if (FIELD[key]) return FIELD[key];
    const GW = 250, GH = 155, cell = 4, noise = makeNoise(scene.seed);
    const data = new Float32Array(GW * GH);
    for (let gy = 0; gy < GH; gy++) for (let gx = 0; gx < GW; gx++) {
      const x = gx * cell, y = gy * cell;
      let v = noise(x / 210, y / 210);
      const dr = distToPolyline(x, y, scene.path);
      v += 0.22 * Math.exp(-(dr * dr) / (2 * 70 * 70));               // land hugs the path
      // a bay: carve water through the lower-left & a channel across the middle
      const bx = (x - 330) / 260, by = (y - 520) / 150; v -= 0.30 * Math.exp(-(bx * bx + by * by));
      const cx = (x - 120) / 160, cy = (y - 330) / 120; v -= 0.18 * Math.exp(-(cx * cx + cy * cy));
      const ex = (x - 980) / 120, ey = (y - 200) / 160; v -= 0.12 * Math.exp(-(ex * ex + ey * ey));
      data[gy * GW + gx] = v;
    }
    return (FIELD[key] = { GW, GH, cell, data, at(x, y) { const gx = Math.max(0, Math.min(GW - 1, (x / cell) | 0)), gy = Math.max(0, Math.min(GH - 1, (y / cell) | 0)); return data[gy * GW + gx]; } });
  }

  function hexToRgb(h) { h = h.replace("#", ""); if (h.length === 3) h = h.split("").map(c => c + c).join(""); const n = parseInt(h, 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }

  /**
   * render(canvas, scene, opts)
   * opts.view = {x,y,w,h} logical window (default whole 1000×620)
   * opts.mode = "map" | "satellite" | "terrain"
   * opts.lightRGB = override light color "r, g, b" (used for the red heat thumbnail on alert cards)
   */
  function render(canvas, scene, opts = {}) {
    const view = opts.view || { x: 0, y: 0, w: 1000, h: 620 };
    const mode = opts.mode || "map";
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const W = canvas.clientWidth, H = canvas.clientHeight;
    if (!W || !H) return;
    canvas.width = W * dpr; canvas.height = H * dpr;
    const ctx = canvas.getContext("2d");
    const s = Math.max(W / view.w, H / view.h);
    const ox = (W - view.w * s) / 2 - view.x * s, oy = (H - view.h * s) / 2 - view.y * s;
    const isLight = getComputedStyle(document.documentElement).colorScheme === "light";

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = css("--map-water"); ctx.fillRect(0, 0, W, H);

    // land
    const F = landField(scene), TH = 0.5;
    const off = document.createElement("canvas"); off.width = F.GW; off.height = F.GH;
    const octx = off.getContext("2d"), img = octx.createImageData(F.GW, F.GH);
    const land = hexToRgb(css("--map-land"));
    const noise2 = makeNoise(scene.seed + 11);
    for (let i = 0; i < F.data.length; i++) {
      const v = F.data[i];
      let a = Math.max(0, Math.min(1, (v - TH) / 0.025));
      const gx0 = i % F.GW, gy0 = (i / F.GW) | 0;
      let shade = isLight ? 0.99 + noise2(gx0 / 3, gy0 / 3) * 0.02 : 0.88 + noise2(gx0 / 3, gy0 / 3) * 0.28;
      if (mode === "terrain") shade = 1 + Math.floor((v - TH) * 28) * (isLight ? -0.035 : 0.09);
      if (mode === "satellite") { const gx = i % F.GW, gy = (i / F.GW) | 0; shade = 0.75 + noise2(gx / 6, gy / 6) * (isLight ? 0.5 : 0.9); }
      img.data[i * 4] = Math.min(255, land[0] * shade); img.data[i * 4 + 1] = Math.min(255, land[1] * shade); img.data[i * 4 + 2] = Math.min(255, land[2] * shade);
      img.data[i * 4 + 3] = a * 255;
    }
    octx.putImageData(img, 0, 0);
    ctx.save();
    ctx.translate(ox, oy); ctx.scale(s, s);
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high";
    ctx.drawImage(off, 0, 0, F.GW * F.cell, F.GH * F.cell);
    // coastline hairline
    ctx.globalAlpha = 1; ctx.filter = "none";

    // lights
    const r = rng(scene.seed * 31 + 5);
    const light = opts.lightRGB || css("--map-light"), cool = opts.lightRGB || css("--map-light-cool");
    ctx.globalCompositeOperation = isLight ? "multiply" : "lighter";
    const px = 1 / s; // one screen pixel in logical units
    // streets: short grid-like walks around each cluster (snapped to the city's grid angle)
    ctx.lineCap = "round";
    scene.clusters.forEach(([cx, cy, cr]) => {
      const base = r() * Math.PI / 2, roads = Math.round(cr / 3.2);
      for (let k = 0; k < roads; k++) {
        const a0 = r() * Math.PI * 2, d0 = Math.pow(r(), 0.9) * cr;
        let x = cx + Math.cos(a0) * d0, y = cy + Math.sin(a0) * d0 * 0.8;
        let ang = base + ((r() * 4) | 0) * Math.PI / 2;
        ctx.beginPath(); ctx.moveTo(x, y);
        const steps = 3 + (r() * 9) | 0;
        for (let st = 0; st < steps; st++) {
          if (r() < 0.22) ang += (r() < 0.5 ? 1 : -1) * Math.PI / 2;
          const a = ang + (r() - 0.5) * 0.12, L = 5 + r() * 7;
          x += Math.cos(a) * L; y += Math.sin(a) * L;
          if (F.at(x, y) < TH) break;
          ctx.lineTo(x, y);
        }
        const near = 1 - Math.min(1, Math.hypot(x - cx, y - cy) / cr);
        ctx.strokeStyle = `rgba(${light}, ${isLight ? 0.18 + near * 0.15 : 0.05 + near * 0.16 + r() * 0.05})`;
        ctx.lineWidth = px * (0.7 + r() * 0.6); ctx.stroke();
      }
    });
    // arterials: soft curves linking neighbouring clusters
    for (let i = 0; i < scene.clusters.length; i++) {
      const a = scene.clusters[i], b = scene.clusters[(i + 3) % scene.clusters.length];
      const mx = (a[0] + b[0]) / 2 + (r() - 0.5) * 120, my = (a[1] + b[1]) / 2 + (r() - 0.5) * 120;
      ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.quadraticCurveTo(mx, my, b[0], b[1]);
      ctx.strokeStyle = `rgba(${light}, ${isLight ? 0.2 : 0.09})`; ctx.lineWidth = px * 1.1; ctx.stroke();
    }
    // dots
    const N = (opts.dots || 24000) * (isLight ? 0.7 : 1);
    for (let i = 0; i < N; i++) {
      let x, y, dense = 0;
      if (r() < 0.62) {
        const c = scene.clusters[(r() * scene.clusters.length) | 0];
        const a = r() * Math.PI * 2, d = Math.pow(r(), 1.6) * c[2];
        x = c[0] + Math.cos(a) * d; y = c[1] + Math.sin(a) * d * 0.8; dense = 1 - d / c[2];
      } else { x = r() * 1000; y = r() * 620; }
      if (F.at(x, y) < TH + 0.004) continue;
      const bright = r() < 0.06 + dense * 0.12;
      const alpha = isLight ? 0.18 + r() * 0.25 : (bright ? 0.55 + r() * 0.45 : 0.10 + r() * 0.28 + dense * 0.2);
      ctx.fillStyle = `rgba(${r() < 0.7 ? light : cool}, ${alpha})`;
      const sz = px * (bright ? 1.6 + r() : 0.8 + r() * 0.9);
      ctx.fillRect(x, y, sz, sz);
    }
    // soft glow blobs on dense cores
    if (!isLight) scene.clusters.forEach(([cx, cy, cr]) => {
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, cr * 0.9);
      g.addColorStop(0, `rgba(${light}, 0.10)`); g.addColorStop(1, `rgba(${light}, 0)`);
      ctx.fillStyle = g; ctx.fillRect(cx - cr, cy - cr, cr * 2, cr * 2);
    });
    // optional red heat lines (alert thumbnail)
    if (opts.heat) {
      ctx.globalCompositeOperation = isLight ? "source-over" : "lighter";
      const danger = css("--danger");
      for (let pass = 0; pass < 2; pass++) {
        ctx.strokeStyle = danger; ctx.globalAlpha = pass ? 0.95 : 0.35; ctx.lineWidth = pass ? px * 1.6 : px * 7;
        ctx.filter = pass ? "none" : `blur(${3}px)`;
        ctx.beginPath(); scene.path.forEach(([x, y], i) => i ? ctx.lineTo(x, y + Math.sin(i) * 4) : ctx.moveTo(x, y)); ctx.stroke();
        opts.heat.forEach(seg => { ctx.beginPath(); seg.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.stroke(); });
      }
      ctx.filter = "none"; ctx.globalAlpha = 1;
    }
    ctx.restore();
    ctx.globalCompositeOperation = "source-over";
  }

  /** Draw path, nodes and labels into an SVG whose viewBox matches the scene space */
  function overlay(svg, scene, { scale = 1, labels = true, flow = true } = {}) {
    svg.innerHTML = "";
    const mk = (t, a, p = svg) => { const n = document.createElementNS(NS, t); for (const k in a) n.setAttribute(k, a[k]); p.appendChild(n); return n; };
    const pts = scene.path;
    // smooth path
    let d = `M${pts[0][0]},${pts[0][1]}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2, t = 0.2;
      d += ` C${p1[0] + (p2[0] - p0[0]) * t},${p1[1] + (p2[1] - p0[1]) * t} ${p2[0] - (p3[0] - p1[0]) * t},${p2[1] - (p3[1] - p1[1]) * t} ${p2[0]},${p2[1]}`;
    }
    mk("path", { d, class: "map-path-glow", style: `stroke-width:${9 * scale}px` });
    mk("path", { d, class: "map-path", style: `stroke-width:${2.4 * scale}px` });
    if (flow) mk("path", { d, class: "map-path-flow", style: `stroke-width:${2.4 * scale}px` });
    scene.nodes.forEach(n => {
      const g = mk("g", { class: `map-node map-node--${n.type}`, transform: `translate(${n.x},${n.y}) scale(${scale})` });
      if (n.type === "hub") {
        mk("circle", { r: 34, class: "halo" }, g);
        mk("circle", { r: 20, class: "halo" }, g);
        mk("circle", { r: 11, class: "ring", style: "stroke-width:1.6" }, g);
        mk("circle", { r: 4, class: "core" }, g);
      } else if (n.type === "item") {
        mk("circle", { r: 18, class: "halo" }, g);
        mk("circle", { r: 11, class: "ring" }, g);
        // tiny item glyph
        mk("rect", { x: -4.5, y: -5, width: 9, height: 9, rx: 2, fill: "none", style: "stroke:var(--map-path)", "stroke-width": 1.2 }, g);
        mk("line", { x1: -4.5, x2: 4.5, y1: -1, y2: -1, style: "stroke:var(--map-path)", "stroke-width": 1 }, g);
      } else if (n.type === "alert") {
        mk("circle", { r: 22, class: "halo" }, g);
        mk("circle", { r: 11, class: "ring" }, g);
        mk("text", { y: 4.5, "text-anchor": "middle", style: "fill:#fff;font:600 12px var(--font-sans)" }, g).textContent = "!";
      } else if (n.type === "accent") {
        mk("circle", { r: 14, class: "halo" }, g);
        mk("circle", { r: 6, class: "ring" }, g);
      } else {
        mk("circle", { r: 12, class: "halo" }, g);
        mk("circle", { r: 6, class: "ring", style: "stroke-width:1.8" }, g);
        mk("circle", { r: 2, class: "core" }, g);
      }
      if (labels && n.label) {
        const t = mk("text", { x: n.x + (n.lx || 14), y: n.y + (n.ly || 4), class: "map-label", "text-anchor": (n.lx || 0) < 0 ? "middle" : "start" });
        t.textContent = n.label;
      }
    });
  }

  window.HeroMap = { render, overlay };
})();
