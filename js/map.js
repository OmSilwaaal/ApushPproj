/* ============================================================
   MAP — Tile grid, terrain generation, fog of war, rendering
   ============================================================ */
const GameMap = (() => {

  const T = CONFIG.TILE;
  const MW = CONFIG.MAP_W;
  const MH = CONFIG.MAP_H;

  let _tiles      = null;   /* Uint8Array [MH * MW] tile type ids */
  let _fog        = null;   /* Float32Array — 0=fully hidden, 1=fully visible */
  let _revealed   = null;   /* Uint8Array — ever seen? */
  let _sound      = null;   /* Float32Array — current sound level per tile */
  let _objectives = [];
  let _battleId   = -1;
  let _vcZones    = [];   /* enemy territory rectangles for border overlay */
  let _baseStart  = null; /* US base center for spawn-area indicator */

  /* Viewport */
  let _vpX = 0, _vpY = 0;  /* Pixel scroll offset */
  let _canvasW = 900, _canvasH = 500;

  /* Canvas refs set by init */
  let _ctx = null;

  /* ── GENERATION ── */
  function generate(battleCfg) {
    _battleId   = battleCfg.id;
    _tiles      = new Uint8Array(MW * MH);
    _fog        = new Float32Array(MW * MH);
    _revealed   = new Uint8Array(MW * MH);
    _sound      = new Float32Array(MW * MH);
    _objectives = [];
    _vcZones    = battleCfg.mapConfig.vcGroups?.map(g => g.area) || [];
    _baseStart  = battleCfg.mapConfig.usStart;

    const mc = battleCfg.mapConfig;
    _generateTerrain(mc);
    _placeObjectives(battleCfg);
    _placeUSBase(mc.usStart);
  }

  function _generateTerrain(mc) {
    const biome    = mc.biome;
    const jungleP  = mc.features.jungle  || 0.3;
    const waterP   = mc.features.water   || 0.1;
    const hillP    = mc.features.hills   || 0.15;
    const villageN = mc.features.village || 2;
    const roadN    = mc.features.roads   || 1;

    const T_JUNGLE   = CONFIG.TILES.JUNGLE.id;
    const T_CLEARING = CONFIG.TILES.CLEARING.id;
    const T_WATER    = CONFIG.TILES.WATER.id;
    const T_HILLS    = CONFIG.TILES.HILLS.id;
    const T_VILLAGE  = CONFIG.TILES.VILLAGE.id;
    const T_ROAD     = CONFIG.TILES.ROAD.id;
    const T_PADDY    = CONFIG.TILES.PADDY.id;

    /* Base terrain from noise */
    for (let y = 0; y < MH; y++) {
      for (let x = 0; x < MW; x++) {
        const n  = Utils.fbm(x * 0.08, y * 0.08, 4, 0.5, 2.0);
        const n2 = Utils.fbm(x * 0.12 + 100, y * 0.12 + 100, 3, 0.5, 2.0);
        let tid;

        if (biome === 'DELTA') {
          /* Mekong Delta: lots of water and paddies */
          if (n < waterP) tid = T_WATER;
          else if (n < waterP + 0.25) tid = T_PADDY;
          else if (n2 < jungleP) tid = T_JUNGLE;
          else tid = T_CLEARING;
        } else if (biome === 'HIGHLAND') {
          /* Central Highlands: jungle and hills */
          if (n < hillP * 0.3) tid = T_HILLS;
          else if (n < hillP) tid = T_HILLS;
          else if (n2 < jungleP) tid = T_JUNGLE;
          else tid = T_CLEARING;
          if (n < waterP * 0.2) tid = T_WATER;
        } else if (biome === 'WARZONE') {
          /* War Zone C: dense jungle */
          if (n2 < jungleP * 1.3) tid = T_JUNGLE;
          else if (n < 0.1) tid = T_HILLS;
          else tid = T_CLEARING;
          if (n < waterP * 0.5) tid = T_WATER;
        } else if (biome === 'URBAN') {
          /* Urban: village tiles with roads */
          if (n < 0.08) tid = T_WATER;
          else if (n < 0.4) tid = T_VILLAGE;
          else tid = T_CLEARING;
        } else {
          /* Default */
          if (n < waterP) tid = T_WATER;
          else if (n2 < jungleP) tid = T_JUNGLE;
          else tid = T_CLEARING;
        }
        _setTile(x, y, tid);
      }
    }

    /* Place villages */
    for (let v = 0; v < villageN; v++) {
      const vx = Utils.randInt(5, MW - 10);
      const vy = Utils.randInt(5, MH - 10);
      for (let dy = -3; dy <= 3; dy++) {
        for (let dx = -3; dx <= 3; dx++) {
          if (Math.hypot(dx, dy) <= 3) {
            const tx = vx+dx, ty = vy+dy;
            if (tx>=0&&ty>=0&&tx<MW&&ty<MH) _setTile(tx, ty, T_VILLAGE);
          }
        }
      }
    }

    /* Place roads (horizontal + vertical strips) */
    for (let r = 0; r < roadN; r++) {
      /* Horizontal road */
      const ry = Utils.randInt(10, MH - 10);
      for (let x = 0; x < MW; x++) {
        if (_getTile(x, ry) !== T_WATER) _setTile(x, ry, T_ROAD);
      }
    }

    /* Smooth water bodies (remove isolated water tiles) */
    for (let y = 1; y < MH-1; y++) {
      for (let x = 1; x < MW-1; x++) {
        if (_getTile(x,y) === T_WATER) {
          const neighbors = [
            _getTile(x+1,y), _getTile(x-1,y),
            _getTile(x,y+1), _getTile(x,y-1)
          ].filter(t => t === T_WATER).length;
          if (neighbors < 2) _setTile(x, y, T_PADDY);
        }
      }
    }
  }

  function _placeObjectives(battleCfg) {
    const mc = battleCfg.mapConfig;
    if (!mc.objectives) return;
    for (const obj of mc.objectives) {
      _objectives.push({ ...obj, captured: false, lost: false });
      /* Mark area as village/base around objective */
      const tid = (obj.type === 'lz' || obj.type === 'defend' || obj.type === 'airstrip')
        ? CONFIG.TILES.BASE.id
        : (obj.type === 'town' || obj.type === 'citadel' || obj.type === 'palace')
          ? CONFIG.TILES.VILLAGE.id
          : CONFIG.TILES.CLEARING.id;
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          const tx = obj.x+dx, ty = obj.y+dy;
          if (tx>=0&&ty>=0&&tx<MW&&ty<MH) _setTile(tx, ty, tid);
        }
      }
    }
  }

  function _placeUSBase(start) {
    const tid = CONFIG.TILES.BASE.id;
    for (let dy = -3; dy <= 3; dy++) {
      for (let dx = -3; dx <= 3; dx++) {
        const tx = start.x+dx, ty = start.y+dy;
        if (tx>=0&&ty>=0&&tx<MW&&ty<MH) {
          _setTile(tx, ty, tid);
        }
      }
    }
    /* Reveal starting area */
    revealArea(start.x, start.y, 6, 1.0);
  }

  /* ── FOG OF WAR ── */
  function revealArea(cx, cy, radius, brightness) {
    const tiles = Utils.tileInRadius(cx, cy, radius, MW, MH);
    for (const { x, y } of tiles) {
      const idx = y * MW + x;
      const d   = Utils.dist(cx, cy, x, y);
      const v   = brightness * (1 - d / (radius + 1));
      if (v > _fog[idx]) _fog[idx] = v;
      if (brightness > 0.5) _revealed[idx] = 1;
    }
  }

  function updateFog(units) {
    /* Decay existing fog */
    for (let i = 0; i < _fog.length; i++) {
      if (_fog[i] > 0.3 && !_revealed[i]) {
        _fog[i] *= 0.985;
      } else if (_fog[i] > 0 && _revealed[i]) {
        /* Revealed tiles keep partial visibility */
        if (_fog[i] > 0.3) _fog[i] *= 0.99;
      }
    }
    /* Update based on US unit positions */
    for (const u of units) {
      if (u.faction !== 'us' || u.dead) continue;
      const sight = u.getSightRadius();
      revealArea(Math.round(u.tx), Math.round(u.ty), sight, 1.0);
    }
  }

  function isVisible(tx, ty) {
    if (tx < 0 || ty < 0 || tx >= MW || ty >= MH) return false;
    return _fog[ty * MW + tx] > 0.5;
  }

  function isRevealed(tx, ty) {
    if (tx < 0 || ty < 0 || tx >= MW || ty >= MH) return false;
    return _revealed[ty * MW + tx] === 1;
  }

  function getVisibility(tx, ty) {
    if (tx < 0 || ty < 0 || tx >= MW || ty >= MH) return 0;
    return _fog[ty * MW + tx];
  }

  function hasCoordinates(tx, ty) {
    /* Player can use coordinates in a tile if they've ever seen it */
    return isRevealed(tx, ty) || isVisible(tx, ty);
  }

  /* ── SOUND PROPAGATION ── */
  function addSound(cx, cy, level) {
    const radius = level * 3;
    const tiles  = Utils.tileInRadius(cx, cy, radius, MW, MH);
    for (const { x, y } of tiles) {
      const d  = Utils.dist(cx, cy, x, y);
      const tc = CONFIG.tileById(_getTile(x, y));
      const absorbed = 1 - tc.sound_absorb;
      const s  = level * (1 - d/radius) * absorbed;
      const idx = y * MW + x;
      if (s > _sound[idx]) _sound[idx] = s;
    }
  }

  function updateSound() {
    for (let i = 0; i < _sound.length; i++) {
      _sound[i] *= CONFIG.SOUND_DECAY;
    }
  }

  function getSoundAt(tx, ty) {
    if (tx < 0 || ty < 0 || tx >= MW || ty >= MH) return 0;
    return _sound[ty * MW + tx];
  }

  /* ── TILE ACCESS ── */
  function _setTile(x, y, id) { _tiles[y * MW + x] = id; }
  function _getTile(x, y)     { return _tiles[y * MW + x] || 0; }
  function getTile(x, y)      { return _getTile(x, y); }
  function getTileConfig(x, y){ return CONFIG.tileById(_getTile(x, y)); }
  function isWalkable(x, y, flying) {
    if (x < 0 || y < 0 || x >= MW || y >= MH) return false;
    const t = CONFIG.tileById(_getTile(x, y));
    if (flying) return true;
    return t.move > 0;
  }
  function getObjectives() { return _objectives; }

  /* ── RENDERING ── */
  function setCanvas(ctx, w, h) {
    _ctx = ctx; _canvasW = w; _canvasH = h;
  }

  function clampViewport() {
    _vpX = Utils.clamp(_vpX, 0, Math.max(0, MW * T - _canvasW));
    _vpY = Utils.clamp(_vpY, 0, Math.max(0, MH * T - _canvasH));
  }

  function scrollTo(tileX, tileY) {
    _vpX = tileX * T - _canvasW / 2;
    _vpY = tileY * T - _canvasH / 2;
    clampViewport();
  }

  function scrollBy(dx, dy) {
    _vpX += dx; _vpY += dy;
    clampViewport();
  }

  function render(ctx) {
    if (!_tiles) return;
    const ctx2 = ctx || _ctx;
    if (!ctx2) return;

    const startTX = Math.floor(_vpX / T);
    const startTY = Math.floor(_vpY / T);
    const endTX   = Math.min(MW - 1, Math.ceil((_vpX + _canvasW) / T));
    const endTY   = Math.min(MH - 1, Math.ceil((_vpY + _canvasH) / T));

    for (let ty = startTY; ty <= endTY; ty++) {
      for (let tx = startTX; tx <= endTX; tx++) {
        const px = tx * T - _vpX;
        const py = ty * T - _vpY;
        const tid = _getTile(tx, ty);
        const tc  = CONFIG.tileById(tid);
        const vis = _fog[ty * MW + tx];

        /* Base tile color */
        ctx2.fillStyle = _revealed[ty*MW+tx] ? tc.color : tc.dark;
        ctx2.fillRect(px, py, T, T);

        /* Terrain detail texture */
        _drawTileDetail(ctx2, px, py, tid, tc, vis, tx, ty);

        /* Fog overlay */
        if (vis < 1.0) {
          const alpha = Math.max(0, 1 - vis) * 0.92;
          ctx2.fillStyle = `rgba(0,0,0,${alpha.toFixed(2)})`;
          ctx2.fillRect(px, py, T, T);
        }

        /* Grid lines (subtle) */
        ctx2.strokeStyle = 'rgba(0,0,0,0.15)';
        ctx2.lineWidth = 0.5;
        ctx2.strokeRect(px, py, T, T);
      }
    }

    /* Objectives */
    _drawObjectives(ctx2);

    /* Enemy territory borders */
    _drawVCZones(ctx2);

    /* US base spawn area */
    _drawBaseSpawnZone(ctx2);
  }

  function _drawTileDetail(ctx, px, py, tid, tc, vis, tx, ty) {
    if (vis < 0.08) return;
    const alpha = Math.min(1, vis) * 0.85;
    /* Deterministic seed from tile position */
    const seed = ((tx || 0) * 2654435769 + (ty || 0) * 1013904223) >>> 0;

    if (tid === CONFIG.TILES.JUNGLE.id) {
      /* Dark canopy base */
      ctx.fillStyle = `rgba(4,22,2,${alpha * 0.55})`;
      ctx.fillRect(px, py, T, T);
      /* Draw 4-6 tree canopies per tile */
      const treeCount = 4 + (seed % 3);
      for (let i = 0; i < treeCount; i++) {
        const ox = ((seed * (i * 7 + 3)) >>> 8) % (T - 8) + 4;
        const oy = ((seed * (i * 11 + 5)) >>> 8) % (T - 8) + 4;
        const r  = 4 + (seed * (i + 2) >>> 12) % 4;
        /* Outer dark canopy */
        ctx.fillStyle = `rgba(8,30,4,${alpha * 0.9})`;
        ctx.beginPath();
        ctx.arc(px + ox, py + oy, r, 0, Math.PI * 2);
        ctx.fill();
        /* Inner lighter highlight */
        ctx.fillStyle = `rgba(18,52,8,${alpha * 0.6})`;
        ctx.beginPath();
        ctx.arc(px + ox - 1, py + oy - 1, r * 0.5, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (tid === CONFIG.TILES.CLEARING.id) {
      /* Occasional bush tufts to break up flat green */
      if ((seed % 5) < 2) {
        ctx.fillStyle = `rgba(38,68,14,${alpha * 0.5})`;
        const bx = px + ((seed >>> 6) % (T - 8)) + 4;
        const by = py + ((seed >>> 14) % (T - 8)) + 4;
        ctx.beginPath();
        ctx.arc(bx, by, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(bx + 4, by + 1, 2, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (tid === CONFIG.TILES.WATER.id) {
      ctx.fillStyle = `rgba(30,80,140,${alpha * 0.5})`;
      ctx.fillRect(px+4, py+12, T-8, 2);
      ctx.fillRect(px+2, py+20, T-4, 2);
    } else if (tid === CONFIG.TILES.HILLS.id) {
      ctx.fillStyle = `rgba(90,60,30,${alpha * 0.5})`;
      ctx.fillRect(px+6, py+18, T-12, 4);
      ctx.fillRect(px+12, py+10, T-24, 3);
    } else if (tid === CONFIG.TILES.ROAD.id) {
      ctx.fillStyle = `rgba(120,110,80,${alpha})`;
      ctx.fillRect(px+T/2-3, py, 6, T);
    } else if (tid === CONFIG.TILES.PADDY.id) {
      ctx.strokeStyle = `rgba(40,80,50,${alpha * 0.6})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(px, py+T/2); ctx.lineTo(px+T, py+T/2);
      ctx.moveTo(px+T/2, py); ctx.lineTo(px+T/2, py+T);
      ctx.stroke();
    } else if (tid === CONFIG.TILES.BASE.id) {
      ctx.strokeStyle = `rgba(80,80,40,${alpha})`;
      ctx.lineWidth = 1;
      ctx.strokeRect(px+3, py+3, T-6, T-6);
    } else if (tid === CONFIG.TILES.DEFOLIAT.id) {
      ctx.fillStyle = `rgba(180,140,60,${alpha * 0.3})`;
      ctx.fillRect(px, py, T, T);
    } else if (tid === CONFIG.TILES.BURNED.id) {
      ctx.fillStyle = `rgba(50,20,10,${alpha * 0.5})`;
      ctx.fillRect(px, py, T, T);
    }
  }

  function _drawVCZones(ctx) {
    const t = Date.now() * 0.001;
    for (const zone of _vcZones) {
      const px = zone.x * T - _vpX;
      const py = zone.y * T - _vpY;
      const pw = zone.w * T;
      const ph = zone.h * T;
      /* Only draw if any part is visible */
      if (px + pw < 0 || py + ph < 0 || px > _canvasW || py > _canvasH) continue;
      ctx.save();
      ctx.globalAlpha = 0.07 + 0.03 * Math.sin(t);
      ctx.fillStyle = '#cc2010';
      ctx.fillRect(px, py, pw, ph);
      ctx.globalAlpha = 0.35;
      ctx.strokeStyle = '#ff4433';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 5]);
      ctx.strokeRect(px + 1, py + 1, pw - 2, ph - 2);
      ctx.setLineDash([]);
      /* "HOSTILE ZONE" label at top-left corner */
      ctx.globalAlpha = 0.55;
      ctx.fillStyle = '#ff4433';
      ctx.font = 'bold 8px Share Tech Mono, monospace';
      ctx.textAlign = 'left';
      ctx.fillText('HOSTILE ZONE', px + 4, py + 10);
      ctx.restore();
    }
  }

  function _drawBaseSpawnZone(ctx) {
    if (!_baseStart) return;
    const cx = _baseStart.x * T - _vpX + T / 2;
    const cy = _baseStart.y * T - _vpY + T / 2;
    const r  = 4 * T;
    const t  = Date.now() * 0.002;
    ctx.save();
    ctx.globalAlpha = 0.12 + 0.05 * Math.sin(t);
    ctx.strokeStyle = '#4488ff';
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 6]);
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 0.06;
    ctx.fillStyle = '#2266cc';
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = '#4488ff';
    ctx.font = 'bold 8px Share Tech Mono, monospace';
    ctx.textAlign = 'center';
    ctx.fillText('DEPLOY ZONE', cx, cy + r + 12);
    ctx.restore();
  }

  function _drawObjectives(ctx) {
    for (const obj of _objectives) {
      const px = obj.x * T - _vpX + T/2;
      const py = obj.y * T - _vpY + T/2;
      const vis = _fog[obj.y * MW + obj.x];
      if (vis < 0.15) continue;

      const captured = obj.captured;
      const alpha = Math.min(1, vis);

      /* Pulsing marker */
      const pulse = 0.7 + 0.3 * Math.sin(Date.now() * 0.003);
      const color = captured ? '#4a8a2a' : (obj.lost ? '#aa2010' : '#c8820a');

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(px, py - 12);
      ctx.lineTo(px - 6, py - 4);
      ctx.lineTo(px + 6, py - 4);
      ctx.closePath();
      ctx.stroke();
      ctx.fillStyle = color + '44';
      ctx.fill();

      /* Pulse ring */
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.globalAlpha = alpha * pulse * 0.5;
      ctx.beginPath();
      ctx.arc(px, py, T * 1.5, 0, Math.PI*2);
      ctx.stroke();

      /* Label */
      ctx.globalAlpha = alpha;
      ctx.fillStyle = '#fff';
      ctx.font = '9px Share Tech Mono, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(obj.name, px, py + T + 4);

      ctx.restore();
    }
  }

  /* ── MINIMAP ── */
  function renderMinimap(mCanvas) {
    if (!_tiles || !mCanvas) return;
    const mCtx  = mCanvas.getContext('2d');
    const mW    = mCanvas.width;
    const mH    = mCanvas.height;
    const scaleX = mW / MW;
    const scaleY = mH / MH;

    mCtx.clearRect(0, 0, mW, mH);

    /* Draw tiles */
    for (let ty = 0; ty < MH; ty++) {
      for (let tx = 0; tx < MW; tx++) {
        const tc  = CONFIG.tileById(_getTile(tx, ty));
        const rev = _revealed[ty * MW + tx];
        const vis = _fog[ty * MW + tx];
        if (!rev && vis < 0.1) {
          mCtx.fillStyle = '#050a04';
        } else {
          mCtx.fillStyle = tc.color;
          if (vis < 0.5) mCtx.fillStyle = tc.dark;
        }
        mCtx.fillRect(tx * scaleX, ty * scaleY, Math.ceil(scaleX), Math.ceil(scaleY));
      }
    }

    /* Viewport rect */
    mCtx.strokeStyle = 'rgba(200,130,10,0.7)';
    mCtx.lineWidth = 1;
    mCtx.strokeRect(
      (_vpX / T) * scaleX,
      (_vpY / T) * scaleY,
      (_canvasW / T) * scaleX,
      (_canvasH / T) * scaleY
    );
  }

  /* ── COORDINATE CONVERSION ── */
  function screenToTile(sx, sy) {
    return {
      x: Math.floor((sx + _vpX) / T),
      y: Math.floor((sy + _vpY) / T),
    };
  }

  function tileToScreen(tx, ty) {
    return {
      x: tx * T - _vpX,
      y: ty * T - _vpY,
    };
  }

  /* Apply defoliation to tiles in radius */
  function defoliate(cx, cy, radius) {
    const tiles = Utils.tileInRadius(cx, cy, radius, MW, MH);
    for (const { x, y } of tiles) {
      const tid = _getTile(x, y);
      if (tid === CONFIG.TILES.JUNGLE.id) {
        _setTile(x, y, CONFIG.TILES.DEFOLIAT.id);
      }
    }
    revealArea(cx, cy, radius * 1.5, 0.8);
  }

  /* Apply fire/napalm to tiles */
  function burnArea(cx, cy, radius) {
    const tiles = Utils.tileInRadius(cx, cy, radius, MW, MH);
    for (const { x, y } of tiles) {
      const tid = _getTile(x, y);
      if (tid !== CONFIG.TILES.WATER.id) {
        _setTile(x, y, CONFIG.TILES.BURNED.id);
      }
    }
  }

  return {
    generate, updateFog, updateSound, addSound, getSoundAt,
    getTile, getTileConfig, isWalkable, isVisible, isRevealed,
    getVisibility, hasCoordinates, revealArea,
    getObjectives, setObjectiveCaptured(name) {
      const o = _objectives.find(o => o.name === name);
      if (o) o.captured = true;
    },
    render, renderMinimap, setCanvas, scrollTo, scrollBy, clampViewport,
    screenToTile, tileToScreen, defoliate, burnArea,
    get vpX() { return _vpX; },
    get vpY() { return _vpY; },
    get vpW() { return _canvasW; },
    get vpH() { return _canvasH; },
  };
})();
