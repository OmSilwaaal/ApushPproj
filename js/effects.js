/* ============================================================
   EFFECTS — Particles, tracers, muzzle flash, artillery arcs,
             napalm/airstrike planes, screen shake, bloom
   All positions stored in WORLD TILE coordinates (floats).
   Converted to screen-space at render time using vpX/vpY.
   ============================================================ */
const Effects = (() => {
  const T    = CONFIG.TILE;
  const MAX_PARTICLES = 600;

  /* ── SCREEN SHAKE ── */
  let _shakeI = 0, _shakeX = 0, _shakeY = 0;

  /* ── PARTICLE ── */
  let _particles = [];

  /* ── TRACER (muzzle → target line) ── */
  let _tracers = [];

  /* ── MUZZLE FLASH ── */
  let _flashes = [];

  /* ── BLAST RING ── */
  let _blasts = [];

  /* ── ARTILLERY / MORTAR SHELLS ── */
  let _shells = [];

  /* ── PLANES (napalm, airstrike, agent orange) ── */
  let _planes = [];

  /* ── FIRE TILES (lingering napalm fire) ── */
  let _fireTiles = [];

  /* ── HELPERS ── */
  function _w2s(wx, wy, vpX, vpY) {
    return { x: wx * T - vpX, y: wy * T - vpY };
  }
  function _randRange(lo, hi) { return lo + Math.random() * (hi - lo); }

  /* ── PARTICLE SPAWNING ── */
  function _addParticle(wx, wy, vx, vy, life, color, size, gravity) {
    if (_particles.length >= MAX_PARTICLES) return;
    _particles.push({ wx, wy, vx, vy, life, maxLife: life,
                      color, size: size || 2, gravity: gravity !== undefined ? gravity : 3, dead: false });
  }

  /* ── PUBLIC EMITTERS ── */

  function addMuzzleFlash(wx, wy, color) {
    _flashes.push({ wx, wy, color: color || '#ffffa0', life: 0.09, maxLife: 0.09 });
    for (let i = 0; i < 6; i++) {
      const a = _randRange(0, Math.PI * 2);
      const v = _randRange(1.5, 4);
      _addParticle(wx, wy, Math.cos(a) * v, Math.sin(a) * v - 1,
                   _randRange(0.05, 0.12), color || '#ffee88', _randRange(1, 2.5), 2);
    }
  }

  function addTracer(wx1, wy1, wx2, wy2, color) {
    _tracers.push({ wx1, wy1, wx2, wy2, color: color || '#ffffaa',
                    life: 0.12, maxLife: 0.12 });
  }

  function addHitSpark(wx, wy, count, color) {
    const n = count || 8;
    for (let i = 0; i < n; i++) {
      const a = _randRange(0, Math.PI * 2);
      const v = _randRange(1, 4);
      _addParticle(wx, wy,
        Math.cos(a) * v, Math.sin(a) * v - 1.5,
        _randRange(0.12, 0.3), color || '#ff6644', _randRange(1, 2.5), 4);
    }
  }

  function addBlast(wx, wy, radius, shakePower, faction) {
    const isVC = faction === 'vc';
    _blasts.push({ wx, wy, radius, life: 0.7, maxLife: 0.7, isVC });

    /* Fire/ember particles — orange for US, red for VC */
    for (let i = 0; i < 24; i++) {
      const a = _randRange(0, Math.PI * 2);
      const v = _randRange(2, 5);
      const cols = isVC
        ? ['#ff2200', '#cc0000', '#ff4422', '#dd1100', '#ff3300']
        : ['#ff8800', '#ff4400', '#ffcc00', '#ff2200', '#ff6600'];
      _addParticle(wx, wy, Math.cos(a) * v, Math.sin(a) * v - 2.5,
                   _randRange(0.4, 0.9), cols[i % cols.length], _randRange(2, 5), 3);
    }
    /* Smoke */
    for (let i = 0; i < 10; i++) {
      _addParticle(
        wx + _randRange(-radius * 0.5, radius * 0.5),
        wy + _randRange(-0.3, 0.3),
        _randRange(-0.5, 0.5), _randRange(-1.5, -3.5),
        _randRange(0.9, 1.6),
        `rgba(${60 + i * 5},${60 + i * 5},${60 + i * 5},0.6)`,
        _randRange(3, 7), -0.5  /* smoke rises */
      );
    }
    /* Debris */
    for (let i = 0; i < 8; i++) {
      const a = _randRange(0, Math.PI * 2);
      _addParticle(wx, wy, Math.cos(a) * _randRange(1, 3), Math.sin(a) * _randRange(1, 3) - 1,
                   _randRange(0.3, 0.6), '#8a7060', _randRange(1, 3), 5);
    }

    _startShake(shakePower || Math.min(radius * 8, 18));
  }

  /* ── ARTILLERY SHELL ── */
  function addArtilleryShell(wx1, wy1, wx2, wy2, onImpact, isMortar) {
    const dist  = Math.hypot(wx2 - wx1, wy2 - wy1);
    const travelTime = isMortar
      ? Math.max(0.8, dist * 0.14)   /* mortar: slow arc */
      : Math.max(0.5, dist * 0.08);  /* artillery: fast */
    _shells.push({ wx1, wy1, wx2, wy2, t: 0, travelTime, onImpact,
                   trail: [], done: false, isMortar });
  }

  function _shellPos(s, t) {
    const t2 = Utils.clamp(t, 0, 1);
    const wx = s.wx1 + (s.wx2 - s.wx1) * t2;
    const wy = s.wy1 + (s.wy2 - s.wy1) * t2;
    const dist = Math.hypot(s.wx2 - s.wx1, s.wy2 - s.wy1);
    const arcH = dist * (s.isMortar ? 0.6 : 0.35);
    const arcOff = -4 * arcH * t2 * (1 - t2);   /* parabola, negative = up */
    return { wx, wy: wy + arcOff };
  }

  /* ── NAPALM PLANE ── */
  function addNapalmPlane(targetWX, targetWY, radius, onImpact) {
    _addPlane('napalm', targetWX, targetWY, radius, onImpact, 16);
  }

  /* ── AIR STRIKE PLANE ── */
  function addAirStrikePlane(targetWX, targetWY, radius, onImpact) {
    _addPlane('airstrike', targetWX, targetWY, radius, onImpact, 24);
  }

  /* ── AGENT ORANGE PLANE ── */
  function addAgentOrangePlane(targetWX, targetWY, radius, onImpact) {
    _addPlane('agent_orange', targetWX, targetWY, radius, onImpact, 12);
  }

  /* Plane stores its starting SCREEN-pixel x so it always begins visible */
  function _addPlane(type, targetWX, targetWY, radius, onImpact, speed) {
    /* Convert target to screen coords, then back-track 10 tiles in WORLD coords.
       This guarantees the plane always starts near the left edge of the visible area. */
    _planes.push({
      type, speed,
      x: targetWX - 10,       /* 10 tiles west of target — always near viewport */
      y: targetWY,
      targetX: targetWX, targetY: targetWY,
      endX: targetWX + 14,
      radius, onImpact,
      dropped: false, done: false,
      trailTimer: 0,
    });
  }

  /* ── LINGERING FIRE (napalm ground fire) ── */
  function addFireTile(wx, wy) {
    if (_fireTiles.length < 200) {
      _fireTiles.push({ wx, wy, life: _randRange(3, 6), maxLife: 5 });
    }
  }

  /* ── SCREEN SHAKE ── */
  function _startShake(intensity) {
    _shakeI = Math.max(_shakeI, Math.min(intensity, 22));
  }
  function getShake() { return { x: Math.round(_shakeX), y: Math.round(_shakeY) }; }

  /* ── UPDATE ── */
  function update(dt) {
    /* Decay screen shake */
    _shakeI  *= 0.80;
    if (_shakeI > 0.2) {
      _shakeX = _shakeI * _randRange(-1, 1);
      _shakeY = _shakeI * _randRange(-1, 1);
    } else { _shakeX = _shakeY = 0; }

    /* Particles */
    for (const p of _particles) {
      p.wx   += p.vx * dt;
      p.wy   += p.vy * dt;
      p.vy   += p.gravity * dt;
      p.life -= dt;
      if (p.life <= 0) p.dead = true;
    }
    if (_particles.length > MAX_PARTICLES) {
      _particles.sort((a, b) => b.life - a.life);
      _particles.length = MAX_PARTICLES;
    }
    _particles = _particles.filter(p => !p.dead);

    /* Tracers */
    for (const t of _tracers) t.life -= dt;
    _tracers = _tracers.filter(t => t.life > 0);

    /* Flashes */
    for (const f of _flashes) f.life -= dt;
    _flashes = _flashes.filter(f => f.life > 0);

    /* Blasts */
    for (const b of _blasts) b.life -= dt;
    _blasts = _blasts.filter(b => b.life > 0);

    /* Artillery shells */
    for (const s of _shells) {
      if (s.done) continue;
      s.t += dt / s.travelTime;

      const pos = _shellPos(s, s.t);
      s.trail.push({ ...pos, age: 0 });
      for (const tp of s.trail) tp.age += dt;
      s.trail = s.trail.filter(tp => tp.age < 0.2);

      if (s.t >= 1) {
        s.done = true;
        addBlast(s.wx2, s.wy2, s.isMortar ? 1.5 : 2.5, s.isMortar ? 10 : 16);
        SoundSystem.play(s.isMortar ? 'explosion' : 'artillery');
        if (s.onImpact) s.onImpact(s.wx2, s.wy2);
      }
    }
    _shells = _shells.filter(s => !s.done || s.trail.length > 0);

    /* Planes */
    for (const p of _planes) {
      if (p.done) continue;
      p.x += p.speed * dt;

      /* Exhaust trail */
      p.trailTimer += dt;
      if (p.trailTimer > 0.05) {
        p.trailTimer = 0;
        _addParticle(p.x - 1, p.y, -_randRange(0.2, 0.8), _randRange(-0.1, 0.1),
                     _randRange(0.3, 0.7), p.type === 'agent_orange' ? '#aacc44' : '#aabbcc', 2, -0.2);
      }

      /* Drop payload when passing over target */
      if (!p.dropped && p.x >= p.targetX - 0.5) {
        p.dropped = true;
        const cbk = p.onImpact;
        const rad = p.radius;
        const tx  = p.targetX, ty = p.targetY;

        if (p.type === 'napalm') {
          SoundSystem.play('jet');
          addArtilleryShell(p.x, p.y, tx, ty + 0.5, (ix, iy) => {
            /* Napalm fire spread */
            for (let i = 0; i < 20; i++) {
              const a = _randRange(0, Math.PI * 2);
              const d = _randRange(0, rad);
              addFireTile(Math.round(ix + Math.cos(a) * d),
                          Math.round(iy + Math.sin(a) * d));
              _addParticle(ix + Math.cos(a) * d * 0.5, iy + Math.sin(a) * d * 0.5,
                Math.cos(a) * 0.5, Math.sin(a) * 0.5 - 1.2,
                _randRange(1.5, 3), `hsl(${_randRange(10, 45)},100%,${_randRange(40, 65)}%)`, _randRange(3, 6), -1.5);
            }
            _startShake(14);
            SoundSystem.play('napalm');
            if (cbk) cbk(ix, iy);
          }, false);

        } else if (p.type === 'airstrike') {
          SoundSystem.play('jet');
          /* Two quick blasts */
          addBlast(tx, ty, rad, 18);
          setTimeout(() => addBlast(tx + _randRange(-1, 1), ty + _randRange(-1, 1), rad * 0.7, 10), 250);
          SoundSystem.play('explosion');
          if (cbk) cbk(tx, ty);

        } else if (p.type === 'agent_orange') {
          SoundSystem.play('jet');
          /* Chemical cloud particles */
          for (let i = 0; i < 40; i++) {
            _addParticle(
              tx + _randRange(-rad, rad), ty + _randRange(-rad * 0.5, rad * 0.5),
              _randRange(-0.3, 0.3), _randRange(-0.5, 0.2),
              _randRange(1.5, 3.5),
              `rgba(${_randRange(150, 200)},${_randRange(180, 220)},${_randRange(30, 70)},0.75)`,
              _randRange(3, 7), -0.2
            );
          }
          if (cbk) cbk(tx, ty);
        }
      }

      if (p.x > p.endX) p.done = true;
    }
    _planes = _planes.filter(p => !p.done);

    /* Fire tiles */
    for (const f of _fireTiles) {
      f.life -= dt;
      /* Emit fire particles sporadically */
      if (Math.random() < dt * 4) {
        _addParticle(f.wx + _randRange(-0.4, 0.4), f.wy + _randRange(-0.3, 0.3),
                     _randRange(-0.2, 0.2), _randRange(-1.5, -0.5),
                     _randRange(0.3, 0.7),
                     `hsl(${_randRange(15, 45)},100%,${_randRange(45, 65)}%)`,
                     _randRange(2, 5), -1.2);
      }
    }
    _fireTiles = _fireTiles.filter(f => f.life > 0);
  }

  /* ── RENDER ── */
  function render(ctx, vpX, vpY) {
    /* Fire tiles (ground flames) */
    for (const f of _fireTiles) {
      const { x, y } = _w2s(f.wx, f.wy, vpX, vpY);
      if (x < -T || y < -T || x > 2000 || y > 1200) continue;
      const alpha = Utils.clamp(f.life / f.maxLife, 0.1, 0.8);
      const flicker = 0.6 + 0.4 * Math.sin(Date.now() * 0.01 + f.wx * 3.7);
      ctx.save();
      ctx.globalAlpha = alpha * flicker;
      ctx.fillStyle = `hsl(${_randRange(15, 35)},100%,50%)`;
      ctx.shadowColor = '#ff6600';
      ctx.shadowBlur  = 8;
      ctx.fillRect(x - T * 0.3, y - T * 0.3, T * 0.6, T * 0.6);
      ctx.restore();
    }

    /* Blast rings */
    for (const b of _blasts) {
      const { x, y } = _w2s(b.wx, b.wy, vpX, vpY);
      const prog  = 1 - b.life / b.maxLife;
      const r     = b.radius * T * prog;
      const alpha = b.life / b.maxLife;
      ctx.save();
      /* Inner flash */
      if (prog < 0.25) {
        const fa = (0.25 - prog) / 0.25;
        const gradient = ctx.createRadialGradient(x, y, 0, x, y, b.radius * T * 0.8);
        if (b.isVC) {
          gradient.addColorStop(0, `rgba(255,210,210,${fa * 0.9})`);
          gradient.addColorStop(0.4, `rgba(220,40,20,${fa * 0.6})`);
          gradient.addColorStop(1, `rgba(160,0,0,0)`);
        } else {
          gradient.addColorStop(0, `rgba(255,240,180,${fa * 0.9})`);
          gradient.addColorStop(0.4, `rgba(255,120,30,${fa * 0.6})`);
          gradient.addColorStop(1, `rgba(255,50,10,0)`);
        }
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(x, y, b.radius * T * 0.8, 0, Math.PI * 2);
        ctx.fill();
      }
      /* Shockwave ring */
      ctx.strokeStyle = b.isVC
        ? `rgba(220,50,50,${alpha * 0.85})`
        : `rgba(255,${Math.round(180 - prog * 140)},50,${alpha * 0.85})`;
      ctx.lineWidth   = Math.max(1, 3 * (1 - prog));
      ctx.shadowColor = '#ff8800';
      ctx.shadowBlur  = 12;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    /* Muzzle flashes (bloom) */
    for (const f of _flashes) {
      const { x, y } = _w2s(f.wx, f.wy, vpX, vpY);
      const alpha = f.life / f.maxLife;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.shadowColor = f.color;
      ctx.shadowBlur  = 20;
      const g = ctx.createRadialGradient(x, y, 0, x, y, 12);
      g.addColorStop(0, f.color);
      g.addColorStop(1, 'transparent');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    /* Tracers */
    for (const t of _tracers) {
      const p1  = _w2s(t.wx1, t.wy1, vpX, vpY);
      const p2  = _w2s(t.wx2, t.wy2, vpX, vpY);
      const alpha = (t.life / t.maxLife);
      ctx.save();
      ctx.globalAlpha = alpha;
      /* Glow layer */
      ctx.strokeStyle = t.color;
      ctx.lineWidth   = 3;
      ctx.shadowColor = t.color;
      ctx.shadowBlur  = 8;
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
      /* Core bright line */
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth   = 1;
      ctx.shadowBlur  = 0;
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
      ctx.restore();
    }

    /* Artillery shells + trails */
    for (const s of _shells) {
      /* Trail */
      const tLen = s.trail.length;
      for (let i = 0; i < tLen; i++) {
        const tp  = s.trail[i];
        const { x, y } = _w2s(tp.wx, tp.wy, vpX, vpY);
        const a  = (1 - tp.age / 0.2) * 0.75;
        if (a <= 0) continue;
        ctx.fillStyle = s.isMortar
          ? `rgba(255,120,50,${a})`
          : `rgba(255,220,80,${a})`;
        ctx.fillRect(x - 2, y - 2, 4, 4);
      }
      /* Shell */
      if (!s.done && s.t < 1) {
        const pos   = _shellPos(s, s.t);
        const { x, y } = _w2s(pos.wx, pos.wy, vpX, vpY);
        ctx.save();
        ctx.fillStyle   = s.isMortar ? '#ff8844' : '#ffe080';
        ctx.shadowColor = s.isMortar ? '#ff4400' : '#ff8800';
        ctx.shadowBlur  = 10;
        ctx.beginPath();
        ctx.arc(x, y, s.isMortar ? 3 : 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }

    /* Planes — drawn large so they're impossible to miss */
    for (const p of _planes) {
      const { x, y } = _w2s(p.x, p.y, vpX, vpY);
      if (x < -1200 || x > 2400) continue;
      ctx.save();

      let bodyColor, glowColor, trailColor;
      if (p.type === 'agent_orange') {
        bodyColor = '#ccdd44'; glowColor = '#aacc22'; trailColor = '#aacc44';
      } else if (p.type === 'napalm') {
        bodyColor = '#ff8833'; glowColor = '#ff4400'; trailColor = '#ff6600';
      } else {
        bodyColor = '#aabbdd'; glowColor = '#88aaff'; trailColor = '#ccddff';
      }

      /* Long engine trail */
      for (let i = 1; i <= 8; i++) {
        ctx.fillStyle = trailColor;
        ctx.globalAlpha = Math.max(0, 0.4 - i * 0.045);
        ctx.fillRect(x - 28 - i * 7, y - 2, 6, 4);
      }

      /* Glow halo behind plane */
      ctx.shadowColor = glowColor;
      ctx.shadowBlur  = 20;
      ctx.fillStyle   = glowColor;
      ctx.globalAlpha = 0.3;
      ctx.beginPath();
      ctx.ellipse(x, y, 34, 10, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.shadowBlur  = 14;

      /* Fuselage — 2.5× bigger than before */
      ctx.fillStyle = bodyColor;
      ctx.beginPath();
      ctx.moveTo(x + 34, y);          /* nose */
      ctx.lineTo(x - 24, y - 10);
      ctx.lineTo(x - 16, y);
      ctx.lineTo(x - 24, y + 10);
      ctx.closePath();
      ctx.fill();

      /* Wings */
      ctx.beginPath();
      ctx.moveTo(x + 4, y);
      ctx.lineTo(x - 8,  y - 22);
      ctx.lineTo(x - 20, y - 4);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(x + 4, y);
      ctx.lineTo(x - 8,  y + 22);
      ctx.lineTo(x - 20, y + 4);
      ctx.closePath();
      ctx.fill();

      /* Tail fin */
      ctx.beginPath();
      ctx.moveTo(x - 16, y);
      ctx.lineTo(x - 24, y - 14);
      ctx.lineTo(x - 28, y);
      ctx.closePath();
      ctx.fill();

      /* Cockpit glint */
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.shadowBlur = 0;
      ctx.beginPath();
      ctx.ellipse(x + 16, y - 3, 5, 3, -0.3, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }

    /* Particles */
    for (const p of _particles) {
      const { x, y } = _w2s(p.wx, p.wy, vpX, vpY);
      if (x < -10 || y < -10 || x > 2200 || y > 1400) continue;
      const alpha = Math.max(0, p.life / p.maxLife);
      const sz    = Math.max(0.5, p.size * Math.sqrt(alpha));
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle   = p.color;
      if (alpha > 0.4 && sz > 1.5) {
        ctx.shadowColor = p.color;
        ctx.shadowBlur  = 4;
      }
      ctx.fillRect(x - sz * 0.5, y - sz * 0.5, sz, sz);
      ctx.restore();
    }
  }

  function clear() {
    _particles = []; _tracers = []; _flashes = [];
    _blasts = []; _shells = []; _planes = []; _fireTiles = [];
    _shakeI = _shakeX = _shakeY = 0;
  }

  return {
    update, render, clear, getShake,
    addMuzzleFlash, addTracer, addHitSpark, addBlast,
    addArtilleryShell, addNapalmPlane, addAirStrikePlane, addAgentOrangePlane,
    addFireTile,
    startScreenShake: _startShake,
  };
})();
