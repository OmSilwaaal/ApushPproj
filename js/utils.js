/* ============================================================
   UTILS — Math, A* pathfinding, helpers
   ============================================================ */
const Utils = (() => {

  /* ── MATH ── */
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function lerp(a, b, t)    { return a + (b - a) * t; }
  function dist(ax, ay, bx, by) { return Math.hypot(bx - ax, by - ay); }
  function distManhattan(ax,ay,bx,by){ return Math.abs(bx-ax)+Math.abs(by-ay); }
  function sign(v)          { return v < 0 ? -1 : v > 0 ? 1 : 0; }
  function rand(lo, hi)     { return lo + Math.random() * (hi - lo); }
  function randInt(lo, hi)  { return Math.floor(rand(lo, hi + 1)); }
  function randChoice(arr)  { return arr[Math.floor(Math.random() * arr.length)]; }
  function randGauss()      {
    let u = 0, v = 0;
    while(!u) u = Math.random();
    while(!v) v = Math.random();
    return Math.sqrt(-2.0*Math.log(u)) * Math.cos(2*Math.PI*v);
  }
  function sigmoid(x)    { return 1 / (1 + Math.exp(-x)); }
  function tanh(x)       { return Math.tanh(x); }
  function relu(x)       { return Math.max(0, x); }
  function softmax(arr)  {
    const max = Math.max(...arr);
    const exps = arr.map(v => Math.exp(v - max));
    const sum  = exps.reduce((a,b) => a+b, 0);
    return exps.map(v => v / sum);
  }
  function dotProduct(a, b) {
    let s = 0;
    for (let i = 0; i < a.length; i++) s += a[i] * b[i];
    return s;
  }
  function vecAdd(a, b)   { return a.map((v,i) => v + b[i]); }
  function vecMul(a, b)   { return a.map((v,i) => v * b[i]); }
  function vecScale(a, s) { return a.map(v => v * s); }
  function zeros(n)       { return new Float32Array(n); }
  function ones(n)        { return new Float32Array(n).fill(1); }
  function randVec(n, scale) {
    const v = new Float32Array(n);
    for (let i = 0; i < n; i++) v[i] = randGauss() * (scale || 0.1);
    return v;
  }
  /* Matrix stored as Float32Array row-major [rows × cols] */
  function randMatrix(rows, cols, scale) {
    const m = new Float32Array(rows * cols);
    for (let i = 0; i < m.length; i++) m[i] = randGauss() * (scale || 0.1);
    return { data: m, rows, cols };
  }
  function matVecMul(mat, vec, bias) {
    const out = new Float32Array(mat.rows);
    for (let r = 0; r < mat.rows; r++) {
      let s = bias ? bias[r] : 0;
      for (let c = 0; c < mat.cols; c++) s += mat.data[r * mat.cols + c] * vec[c];
      out[r] = s;
    }
    return out;
  }
  function matAdd(m, delta) {
    for (let i = 0; i < m.data.length; i++) m.data[i] += delta.data[i];
  }

  /* ── A* PATHFINDING ── */
  function aStar(startX, startY, goalX, goalY, walkable, mapW, mapH) {
    if (startX === goalX && startY === goalY) return [];

    const key = (x, y) => y * mapW + x;
    const heuristic = (x, y) => Math.abs(goalX - x) + Math.abs(goalY - y);

    const open  = new Map();
    const closed= new Set();
    const gCost = new Map();
    const fCost = new Map();
    const parent= new Map();

    const sk = key(startX, startY);
    gCost.set(sk, 0);
    fCost.set(sk, heuristic(startX, startY));
    open.set(sk, { x: startX, y: startY });

    const dirs = [
      {dx:1,dy:0,cost:1},{dx:-1,dy:0,cost:1},{dx:0,dy:1,cost:1},{dx:0,dy:-1,cost:1},
      {dx:1,dy:1,cost:1.414},{dx:-1,dy:1,cost:1.414},{dx:1,dy:-1,cost:1.414},{dx:-1,dy:-1,cost:1.414},
    ];
    let iterations = 0;
    const MAX_ITER = 3000;

    while (open.size > 0 && iterations++ < MAX_ITER) {
      /* find lowest f in open */
      let bestKey = null, bestF = Infinity;
      for (const [k] of open) {
        const f = fCost.get(k) || Infinity;
        if (f < bestF) { bestF = f; bestKey = k; }
      }
      const cur = open.get(bestKey);
      if (cur.x === goalX && cur.y === goalY) {
        return reconstructPath(parent, bestKey, startX, startY, mapW);
      }
      open.delete(bestKey);
      closed.add(bestKey);

      for (const d of dirs) { const {dx, dy} = d;
        const nx = cur.x + dx, ny = cur.y + dy;
        if (nx < 0 || ny < 0 || nx >= mapW || ny >= mapH) continue;
        const nk = key(nx, ny);
        if (closed.has(nk)) continue;
        if (!walkable(nx, ny)) continue;

        const tentG = (gCost.get(bestKey) || 0) + (d.cost || 1);
        if (tentG < (gCost.get(nk) || Infinity)) {
          parent.set(nk, bestKey);
          gCost.set(nk, tentG);
          fCost.set(nk, tentG + heuristic(nx, ny));
          if (!open.has(nk)) open.set(nk, { x: nx, y: ny });
        }
      }
    }
    return []; /* no path */
  }

  function reconstructPath(parent, endKey, sx, sy, mapW) {
    const path = [];
    let ck = endKey;
    while (parent.has(ck)) {
      path.unshift({ x: ck % mapW, y: Math.floor(ck / mapW) });
      ck = parent.get(ck);
    }
    return path;
  }

  /* ── PERLIN-LIKE NOISE (simple value noise) ── */
  const _noiseTable = (() => {
    const t = new Float32Array(512);
    for (let i = 0; i < 256; i++) t[i] = t[i+256] = Math.random();
    return t;
  })();
  function smoothNoise(x, y) {
    const ix = Math.floor(x) & 255, iy = Math.floor(y) & 255;
    const fx = x - Math.floor(x), fy = y - Math.floor(y);
    const ux = fx*fx*(3-2*fx), uy = fy*fy*(3-2*fy);
    const n00 = _noiseTable[_noiseTable[ix]+iy];
    const n10 = _noiseTable[_noiseTable[ix+1]+iy];
    const n01 = _noiseTable[_noiseTable[ix]+iy+1];
    const n11 = _noiseTable[_noiseTable[ix+1]+iy+1];
    return lerp(lerp(n00,n10,ux), lerp(n01,n11,ux), uy);
  }
  function fbm(x, y, octaves, persistence, lacunarity) {
    let val = 0, amp = 1, freq = 1, maxVal = 0;
    for (let o = 0; o < octaves; o++) {
      val    += smoothNoise(x * freq, y * freq) * amp;
      maxVal += amp;
      amp    *= persistence;
      freq   *= lacunarity;
    }
    return val / maxVal;
  }

  /* ── GEOMETRY ── */
  function tileInRadius(cx, cy, r, mapW, mapH) {
    const tiles = [];
    const ri = Math.ceil(r);
    for (let dy = -ri; dy <= ri; dy++) {
      for (let dx = -ri; dx <= ri; dx++) {
        if (Math.hypot(dx, dy) <= r) {
          const x = cx + dx, y = cy + dy;
          if (x >= 0 && y >= 0 && x < mapW && y < mapH)
            tiles.push({ x, y });
        }
      }
    }
    return tiles;
  }

  function lineOfSight(x0, y0, x1, y1, opaque) {
    /* Bresenham's line */
    let dx = Math.abs(x1-x0), dy = Math.abs(y1-y0);
    let sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx - dy;
    let cx = x0, cy = y0;
    while (true) {
      if (cx === x1 && cy === y1) return true;
      if (cx !== x0 || cy !== y0) { if (opaque(cx, cy)) return false; }
      const e2 = 2 * err;
      if (e2 > -dy) { err -= dy; cx += sx; }
      if (e2 <  dx) { err += dx; cy += sy; }
    }
  }

  /* ── FORMATTING ── */
  function formatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2,'0')}`;
  }
  function formatScore(n) {
    return n.toLocaleString();
  }
  function pct(v, total) { return total ? Math.round(100*v/total) : 0; }

  /* ── UUID ── */
  let _uidCounter = 0;
  function uid() { return ++_uidCounter; }

  /* ── COLOR ── */
  function lerpColor(c1, c2, t) {
    const parse = h => [
      parseInt(h.slice(1,3),16),
      parseInt(h.slice(3,5),16),
      parseInt(h.slice(5,7),16)
    ];
    const [r1,g1,b1] = parse(c1);
    const [r2,g2,b2] = parse(c2);
    const r = Math.round(lerp(r1,r2,t));
    const g = Math.round(lerp(g1,g2,t));
    const b = Math.round(lerp(b1,b2,t));
    return `rgb(${r},${g},${b})`;
  }
  function hexToRgba(hex, a) {
    const r = parseInt(hex.slice(1,3),16);
    const g = parseInt(hex.slice(3,5),16);
    const b = parseInt(hex.slice(5,7),16);
    return `rgba(${r},${g},${b},${a})`;
  }

  /* ── DEEP CLONE ── */
  function clone(obj) { return JSON.parse(JSON.stringify(obj)); }

  return {
    clamp, lerp, dist, distManhattan, sign, rand, randInt, randChoice, randGauss,
    sigmoid, tanh, relu, softmax, dotProduct, vecAdd, vecMul, vecScale,
    zeros, ones, randVec, randMatrix, matVecMul, matAdd,
    aStar, smoothNoise, fbm, tileInRadius, lineOfSight,
    formatTime, formatScore, pct, uid,
    lerpColor, hexToRgba, clone,
  };
})();
