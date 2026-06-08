/* ============================================================
   UNITS — Unit class, spawning, movement, state management
   ============================================================ */
const Units = (() => {

  const T = CONFIG.TILE;

  /* ── UNIT CLASS ── */
  class Unit {
    constructor(typeId, tx, ty, faction) {
      this.id       = Utils.uid();
      this.typeId   = typeId;
      const def     = CONFIG.UNITS[typeId];
      this.def      = def;
      this.name     = def.name;
      this.faction  = faction || def.faction;

      /* Tile position (float for smooth movement) */
      this.tx = tx;
      this.ty = ty;

      /* Stats */
      this.maxHp  = def.hp;
      this.hp     = def.hp;
      this.atk    = def.atk;
      this.def    = def.def;
      this.spd    = def.spd;
      this.sight  = def.sight;
      this.noise  = def.noise;
      this.flying = def.flying || false;
      this.range  = def.range || 1;
      this.oneshot= def.oneshot || false;
      this.aoe    = def.aoe || 0;

      /* State machine */
      this.state    = 'IDLE';  /* IDLE, MOVING, ATTACKING, DEAD, INGROUND, RETREATING */
      this.dead     = false;
      this.inGround = false;

      /* Movement path */
      this.path     = [];
      this.pathIdx  = 0;
      this.moveTimer= 0;
      this.target   = null;    /* Unit target for combat */
      this.targetTile = null;  /* Tile target for movement */

      /* VC specifics */
      this.hidden   = def.hidden || false;
      this.detected = false;
      this.alertLevel = 0;     /* 0-1: how alert this unit is */
      this.tunnelCapable = def.tunnelCapable || false;
      this.stationary    = def.stationary || false;

      /* Combat cooldown */
      this.attackCd = 0;
      this.attackRate = CONFIG.UNITS[typeId]?.attackRate || 1.5;

      /* Visual effects */
      this.flashTimer = 0;
      this.hitFlash   = false;
      this.angle      = 0;     /* Facing direction (radians) */
      this.fireEffect = 0;     /* Muzzle flash timer */

      /* Morale (0-100) */
      this.morale     = 80 + Utils.randInt(0, 20);
      this.maxMorale  = this.morale;

      /* For one-shot effects (airstrikes etc.) */
      this.arrivedAt  = null;
      this.firedAt    = null;

      /* Accuracy: probability each shot hits (0-1) */
      this.accuracy = def.accuracy || 0.70;

      /* AoE: radius of explosive attack (0 = direct fire) */
      this.aoe = def.aoe || 0;

      /* Squad assignment (null = unassigned, 1-4 = squad number) */
      this.squadId     = null;
      this.squadLeader = false;

      /* Noise suppression (recon teams are sneaky) */
      if (typeId === 'RECON') this.noise = 0.3;

      /* Autonomous behavior — mobile US units explore by default */
      const mobile = ['INFANTRY','M60_GUNNER','SHARPSHOOTER','GRENADIER','ARMOR','HELICOPTER','RECON'];
      this.behaviorMode    = (faction === 'us' && mobile.includes(typeId)) ? 'EXPLORE' : 'GUARD';
      this.patrolWaypoints = [];
      this.patrolIdx       = 0;
      this._patrolPause    = 0;
      this._rallyCd        = Math.random() * 2; /* stagger first rally check */
    }

    getSightRadius() {
      const tc = GameMap.getTileConfig(Math.round(this.tx), Math.round(this.ty));
      return this.sight + (tc ? tc.sight : 0);
    }

    isUS()  { return this.faction === 'us'; }
    isVC()  { return this.faction === 'vc'; }
    isAlive() { return !this.dead && this.hp > 0; }

    takeDamage(amount, source) {
      if (this.dead) return;
      /* Defense reduces damage */
      const reduction = this.def / (this.def + 50);
      const dmg       = Math.max(1, Math.round(amount * (1 - reduction)));
      this.hp -= dmg;
      this.hitFlash    = true;
      this.flashTimer  = 0.3;

      /* Morale hit */
      this.morale = Utils.clamp(this.morale - dmg * 0.3, 0, this.maxMorale);

      /* VC units become visible when hit */
      if (this.isVC() && this.hidden) this.detected = true;

      if (this.hp <= 0) {
        this.hp   = 0;
        this.dead = true;
        this.state= 'DEAD';
      }
      return dmg;
    }

    moveTo(targetTX, targetTY) {
      if (this.stationary || this.dead) return;
      const walkable = (x, y) => GameMap.isWalkable(x, y, this.flying);
      this.path = Utils.aStar(
        Math.round(this.tx), Math.round(this.ty),
        targetTX, targetTY,
        walkable, CONFIG.MAP_W, CONFIG.MAP_H
      );
      this.pathIdx    = 0;
      this.targetTile = { x: targetTX, y: targetTY };
      this.state      = 'MOVING'; /* direct-steer fallback handles empty path */
    }

    stopMoving() {
      this.path     = [];
      this.pathIdx  = 0;
      this.state    = 'IDLE';
      this.targetTile = null;
    }

    update(dt, speedMult) {
      if (this.dead) return;
      const eff = dt * (speedMult || 1);

      /* Flash/fire timers */
      if (this.flashTimer > 0) { this.flashTimer -= eff; if (this.flashTimer <= 0) this.hitFlash = false; }
      if (this.fireEffect  > 0) this.fireEffect -= eff;

      /* Attack cooldown */
      if (this.attackCd > 0) this.attackCd -= eff;

      /* Alert level decay */
      if (this.alertLevel > 0) this.alertLevel = Utils.clamp(this.alertLevel - eff * 0.05, 0, 1);

      /* One-shot expire */
      if (this.oneshot && this.arrivedAt && !this.firedAt) this.firedAt = Date.now();

      /* ── MOVEMENT ── two independent layers: ──────────────
         Layer 1: Player/AI ordered path (A*) — sets state MOVING
         Layer 2: Continuous autonomous wander (velocity-based)
      ─────────────────────────────────────────────────────── */
      if (this.state === 'MOVING') {
        this._followPath(eff);
      }

      /* Wander runs every frame unless following an ordered path */
      if (this.state !== 'MOVING') {
        this._applyWander(eff);
      }

      /* ── PATROL ────────────────────────────────────────────────
         Works from any non-ATTACKING state so that a missed IDLE
         frame can never permanently stall the route.
           • d < 1.2  →  stop + dwell 0.5 s, then advance index
           • d ≥ 1.2 + IDLE  →  moveTo waypoint
           • d ≥ 1.2 + MOVING →  _followPath already drives travel
      ──────────────────────────────────────────────────────────── */
      if (this.faction === 'us' && this.behaviorMode === 'PATROL' &&
          this.patrolWaypoints.length > 0) {

        const n  = this.patrolWaypoints.length;
        const pi = (this.patrolIdx || 0) % n;
        const wp = this.patrolWaypoints[pi];

        /* Compute actual target once — used for both arrival check and moveTo */
        let wx = wp.x, wy = wp.y;
        if (this.squadId !== null && !this.squadLeader) {
          const h  = (this.id * 2654435769) >>> 0;
          const ox = ((h & 3) - 1);
          const oy = (((h >> 2) & 3) - 1);
          if (GameMap.isWalkable(wp.x + ox, wp.y + oy, false)) {
            wx = wp.x + ox; wy = wp.y + oy;
          }
        }

        const d = Utils.dist(this.tx, this.ty, wx, wy);

        if (d < 1.2) {
          /* Arrived: ensure we stop, then dwell before advancing */
          if (this.state === 'MOVING') this.stopMoving();
          if (this.state !== 'ATTACKING') {
            this._patrolDwell = (this._patrolDwell || 0) + eff;
            if (this._patrolDwell >= 0.5) {
              this._patrolDwell = 0;
              this.patrolIdx    = pi + 1;
            }
          }
        } else if (this.state === 'IDLE') {
          /* Far from waypoint and free: move there now */
          this._patrolDwell = 0;
          this.moveTo(wx, wy);
        }
        /* state=MOVING: _followPath is already driving travel to this waypoint  */
        /* state=ATTACKING: combat takes priority; resumes on next IDLE           */
      }

      /* ── SQUAD FOLLOWING ────────────────────────────────────────
         Non-leader members track their squad leader in EXPLORE/GUARD.
         Runs from IDLE *and* MOVING so a follower that is already
         heading somewhere wrong gets re-routed toward the leader.
         Disabled during active patrol (members share the route).
      ──────────────────────────────────────────────────────────── */
      if (this.faction === 'us' && this.squadId !== null && !this.squadLeader &&
          (this.state === 'IDLE' || this.state === 'MOVING') &&
          !(this.behaviorMode === 'PATROL' && this.patrolWaypoints.length > 0)) {
        this._squadFollowCd = (this._squadFollowCd || 0) - eff;
        if (this._squadFollowCd <= 0) {
          const leader = Units.getUS().find(u => u.squadId === this.squadId && u.squadLeader && u.isAlive());
          if (leader) {
            const leaderMoving = leader.state === 'MOVING';
            this._squadFollowCd = leaderMoving
              ? 0.35 + Math.random() * 0.15
              : 0.8  + Math.random() * 0.3;

            const d = Utils.dist(this.tx, this.ty, leader.tx, leader.ty);
            if (d > 2.0) {
              const tx = (leaderMoving && leader.targetTile) ? leader.targetTile.x : Math.round(leader.tx);
              const ty = (leaderMoving && leader.targetTile) ? leader.targetTile.y : Math.round(leader.ty);

              /* Skip re-route if already heading to roughly the right place */
              if (this.state === 'MOVING' && this.targetTile &&
                  Utils.dist(this.targetTile.x, this.targetTile.y, tx, ty) < 3) {
                /* already on course */
              } else {
                const base = Math.atan2(ty - this.ty, tx - this.tx);
                const side = ((this.id & 1) ? 0.45 : -0.45);
                const ang  = base + side;
                const nx   = Math.round(this.tx + Math.cos(ang) * Math.max(1.5, d - 1.5));
                const ny   = Math.round(this.ty + Math.sin(ang) * Math.max(1.5, d - 1.5));
                if (GameMap.isWalkable(nx, ny, this.flying)) {
                  this.moveTo(nx, ny);
                } else if (GameMap.isWalkable(tx, ty, this.flying)) {
                  this.moveTo(tx, ty);
                }
              }
            }
          } else {
            this._squadFollowCd = 0.8 + Math.random() * 0.3;
          }
        }
      }

      /* Rally to nearby fights (EXPLORE mode, idle units) */
      if (this.faction === 'us' && this.behaviorMode === 'EXPLORE' &&
          this.state !== 'MOVING') {
        this._rallyCd = (this._rallyCd || 0) - eff;
        if (this._rallyCd <= 0) {
          this._rallyCd = 1.0 + Math.random() * 0.5;
          this._checkRally();
        }
      }

      /* Sound emission */
      if (this.noise > 0.5) {
        GameMap.addSound(Math.round(this.tx), Math.round(this.ty),
          this.state === 'MOVING' ? this.noise : this.noise * 0.4);
      }
    }

    /* Follow an A*-computed or direct-steer path */
    _followPath(eff) {
      const tc  = GameMap.getTileConfig(Math.round(this.tx), Math.round(this.ty));
      const spd = this.spd * (tc ? (tc.move || 0.5) : 1);

      /* Direct-steer when no A* path */
      if (this.path.length === 0 && this.targetTile) {
        const dx = this.targetTile.x - this.tx;
        const dy = this.targetTile.y - this.ty;
        const d  = Math.hypot(dx, dy);
        if (d < 0.2) {
          this.tx = this.targetTile.x; this.ty = this.targetTile.y;
          this.state = 'IDLE'; this.targetTile = null; this.arrivedAt = Date.now();
        } else {
          const move = Math.min(spd * eff, d);
          this.angle = Math.atan2(dy, dx);
          this.tx += (dx / d) * move;
          this.ty += (dy / d) * move;
        }
        return;
      }

      /* A* path following */
      if (this.pathIdx >= this.path.length) {
        this.state = 'IDLE'; this.path = []; this.targetTile = null;
        this.arrivedAt = Date.now();
        return;
      }
      const wp = this.path[this.pathIdx];
      const dx = wp.x - this.tx, dy = wp.y - this.ty;
      const d  = Math.hypot(dx, dy);
      if (d < 0.1) {
        this.tx = wp.x; this.ty = wp.y; this.pathIdx++;
      } else {
        const move = Math.min(spd * eff, d);
        this.angle = Math.atan2(dy, dx);
        this.tx += (dx / d) * move;
        this.ty += (dy / d) * move;
      }
    }

    /* Velocity-based wander — runs every frame, produces true real-time movement */
    _applyWander(eff) {
      if (this.dead || this.stationary) return;
      if (this.state === 'ATTACKING') return;

      const isExplore    = this.faction === 'us' && this.behaviorMode === 'EXPLORE';
      /* Patrol units wander normally while waiting for waypoints to be placed */
      const isPatrolIdle = this.faction === 'us' && this.behaviorMode === 'PATROL' && this.patrolWaypoints.length === 0;
      const isVC         = this.faction === 'vc';
      if (!isExplore && !isPatrolIdle && !isVC) return;

      /* Init wander direction on first call */
      if (this._wAngle === undefined) {
        this._wAngle = Math.random() * Math.PI * 2;
        this._wTimer = Math.random() * 0.5; /* stagger start so not all units sync */
      }

      /* Count down to next direction change */
      this._wTimer -= eff;
      if (this._wTimer <= 0) {
        this._wTimer = 1.5 + Math.random() * 2.5;
        if (isExplore) {
          /* Seek an unrevealed (fogged) tile — explore dark areas of the map */
          let fogX = -1, fogY = -1;
          for (let i = 0; i < 30; i++) {
            const sx = Utils.randInt(0, CONFIG.MAP_W - 1);
            const sy = Utils.randInt(0, CONFIG.MAP_H - 1);
            if (!GameMap.isRevealed(sx, sy) && GameMap.isWalkable(sx, sy, false)) {
              fogX = sx; fogY = sy;
              break;
            }
          }
          if (fogX >= 0) {
            this._wAngle = Math.atan2(fogY - this.ty, fogX - this.tx) + (Math.random() - 0.5) * 0.5;
          } else {
            this._wAngle = Math.random() * Math.PI * 2;
          }
        } else {
          this._wAngle = Math.random() * Math.PI * 2;
        }
      }

      /* Compute new position */
      const nx = this.tx + Math.cos(this._wAngle) * this.spd * eff;
      const ny = this.ty + Math.sin(this._wAngle) * this.spd * eff;

      /* Bounce off map edges — steer toward center */
      if (nx < 1 || ny < 1 || nx >= CONFIG.MAP_W - 1 || ny >= CONFIG.MAP_H - 1) {
        this._wAngle = Math.atan2(CONFIG.MAP_H / 2 - this.ty, CONFIG.MAP_W / 2 - this.tx)
                       + (Math.random() - 0.5) * 0.8;
        this._wTimer = 0;
        return;
      }

      /* Check destination tile walkability */
      const bx = Math.round(nx), by = Math.round(ny);
      const tc = GameMap.getTileConfig(bx, by);
      if (tc && tc.move > 0) {
        /* Slow down in difficult terrain */
        const slowFactor = Math.min(1, tc.move);
        this.tx = this.tx + (nx - this.tx) * slowFactor;
        this.ty = this.ty + (ny - this.ty) * slowFactor;
        this.angle = this._wAngle;
      } else {
        /* Blocked — bounce: rotate 90-180° */
        this._wAngle += Math.PI * (0.5 + Math.random() * 0.5);
        this._wTimer  = 0;
      }
    }

    _checkRally() {
      let targetTX = null, targetTY = null, minD = Infinity;

      /* Check US units actively in combat */
      for (const u of Units.getUS()) {
        if (u.id === this.id || !u.isAlive()) continue;
        if (u.state !== 'ATTACKING' && !u.hitFlash) continue;
        const d = Utils.dist(this.tx, this.ty, u.tx, u.ty);
        if (d < minD && d < 22) { minD = d; targetTX = u.tx; targetTY = u.ty; }
      }
      /* Check detected VC */
      for (const v of Units.getVC()) {
        if (!v.isAlive() || !v.detected) continue;
        const d = Utils.dist(this.tx, this.ty, v.tx, v.ty);
        if (d < minD && d < 22) { minD = d; targetTX = v.tx; targetTY = v.ty; }
      }
      /* Fallback: last known combat position */
      if (targetTX === null && typeof Combat !== 'undefined') {
        const pos = Combat.getCombatPos();
        if (pos) { targetTX = pos.tx; targetTY = pos.ty; }
      }

      if (targetTX === null) return;
      const dx = targetTX - this.tx, dy = targetTY - this.ty;
      const d  = Math.hypot(dx, dy);
      if (d < 3) return;
      const tx = Math.round(this.tx + (dx / d) * (d - 2));
      const ty = Math.round(this.ty + (dy / d) * (d - 2));
      if (GameMap.isWalkable(tx, ty, this.flying)) this.moveTo(tx, ty);
    }

    canAttack(target) {
      if (!target || !target.isAlive()) return false;
      if (this.attackCd > 0) return false;
      const d = Utils.dist(this.tx, this.ty, target.tx, target.ty);
      return d <= (this.range + 0.5);
    }

    attack(target) {
      if (!this.canAttack(target)) return 0;
      this.attackCd   = 1 / (this.attackRate || 1.5);
      this.fireEffect = 0.15;
      GameMap.addSound(Math.round(this.tx), Math.round(this.ty), this.noise * 2);

      const wx1 = this.tx, wy1 = this.ty;
      const wx2 = target.tx, wy2 = target.ty;
      const isArt       = this.typeId === 'ARTILLERY' || this.typeId === 'VC_MORTAR' || this.typeId === 'NVA_HEAVY';
      const isExplosive = this.aoe > 0 && !isArt;
      const tracerColor = this.isUS() ? '#ffdd44' : '#ff6644';
      const flashColor  = this.isUS() ? '#88ccff' : '#ffaa44';

      /* Accuracy roll — artillery always hits (AoE), others miss sometimes */
      const hits = isArt || (Math.random() < this.accuracy);

      if (isArt) {
        if (typeof Effects !== 'undefined') {
          Effects.addArtilleryShell(wx1, wy1, wx2, wy2, () => {
            Effects.addBlast(wx2, wy2, 1.2, 3, this.faction);
          }, true);
        }
        const dmg = target.takeDamage(this.atk + Utils.randInt(-5, 5));
        return dmg;
      }

      /* Grenadier / RPG — shell arc, AoE on impact */
      if (isExplosive) {
        const landX = hits ? wx2 : wx2 + Utils.rand(-2, 2);
        const landY = hits ? wy2 : wy2 + Utils.rand(-2, 2);
        const aoeR  = this.aoe, atkDmg = this.atk, pf = this.faction;
        if (typeof Effects !== 'undefined') {
          Effects.addMuzzleFlash(wx1, wy1, flashColor);
          Effects.addArtilleryShell(wx1, wy1, landX, landY, () => {
            Effects.addBlast(landX, landY, aoeR, 12, pf);
            if (typeof Combat !== 'undefined')
              Combat.applyAreaDamage(Math.round(landX), Math.round(landY), aoeR, atkDmg, pf, 'blast', null);
            SoundSystem.play('explosion', { x: landX, y: landY });
          }, false);
          Effects.startScreenShake(3 + Math.random() * 3);
        }
        return hits ? this.atk : 0;
      }

      /* Small arms — tracer hits or near-miss */
      if (typeof Effects !== 'undefined') {
        Effects.addMuzzleFlash(wx1, wy1, flashColor);
        if (hits) {
          Effects.addTracer(wx1, wy1, wx2, wy2, tracerColor);
          Effects.addHitSpark(wx2, wy2, 8, tracerColor);
          Effects.addHitSpark(wx2, wy2, 4, '#c8a060');
        } else {
          const mX = wx2 + Utils.rand(-2.5, 2.5), mY = wy2 + Utils.rand(-2.5, 2.5);
          const dim = this.isUS() ? 'rgba(255,200,60,0.4)' : 'rgba(255,100,60,0.4)';
          Effects.addTracer(wx1, wy1, mX, mY, dim);
        }
        Effects.startScreenShake(hits ? 1.5 + Math.random() * 2 : 0.4);
      }

      if (!hits) return 0;
      return target.takeDamage(this.atk + Utils.randInt(-5, 5));
    }

    /* Serialized description for UI */
    getInfo() {
      return {
        name:         this.name,
        hp:           this.hp,
        maxHp:        this.maxHp,
        morale:       Math.round(this.morale),
        maxMorale:    this.maxMorale,
        state:        this.state,
        detected:     this.detected,
        behaviorMode: this.behaviorMode,
        patrolCount:  this.patrolWaypoints.length,
        squadId:      this.squadId,
        accuracy:     Math.round(this.accuracy * 100),
      };
    }
  }

  /* ── SPECIAL: EXPLOSION / STRIKE EFFECT UNIT ── */
  class StrikeEffect {
    constructor(tx, ty, radius, damage, type) {
      this.id        = Utils.uid();
      this.tx        = tx;
      this.ty        = ty;
      this.radius    = radius;
      this.damage    = damage;
      this.type      = type;  /* 'blast', 'napalm', 'defoliate' */
      this.age       = 0;
      this.duration  = type === 'napalm' ? 3.0 : 0.8;
      this.done      = false;
      this.applied   = false;
    }
    update(dt) {
      this.age += dt;
      if (this.age >= this.duration) this.done = true;
    }
    getProgress() { return Utils.clamp(this.age / this.duration, 0, 1); }
  }

  /* ── UNIT REGISTRY ── */
  let _units   = [];
  let _effects = [];

  function spawn(typeId, tx, ty, faction) {
    const u = new Unit(typeId, tx, ty, faction);
    _units.push(u);
    return u;
  }

  function spawnEffect(tx, ty, radius, damage, type) {
    const e = new StrikeEffect(tx, ty, radius, damage, type);
    _effects.push(e);
    return e;
  }

  function removeUnit(unitOrId) {
    const id = typeof unitOrId === 'number' ? unitOrId : unitOrId.id;
    _units = _units.filter(u => u.id !== id);
  }

  function getAll()  { return _units; }
  function getUS()   { return _units.filter(u => u.isUS() && !u.dead); }
  function getVC()   { return _units.filter(u => u.isVC() && !u.dead); }
  function getEffects() { return _effects; }
  function getById(id)  { return _units.find(u => u.id === id) || null; }
  function clear()   { _units = []; _effects = []; }

  function update(dt, speedMult) {
    for (const u of _units) {
      try { u.update(dt, speedMult); }
      catch(e) { console.warn('[Unit error]', u?.typeId, e.message); }
    }
    for (const e of _effects) e.update(dt * speedMult);
    _effects = _effects.filter(e => !e.done);
    _units   = _units.filter(u => !(u.dead && u.oneshot));
  }

  /* Find unit at tile position */
  function atTile(tx, ty) {
    return _units.find(u =>
      !u.dead &&
      Math.round(u.tx) === tx &&
      Math.round(u.ty) === ty
    ) || null;
  }

  /* Units within radius of tile */
  function inRadius(cx, cy, radius, filter) {
    return _units.filter(u => {
      if (u.dead) return false;
      if (filter && !filter(u)) return false;
      return Utils.dist(cx, cy, u.tx, u.ty) <= radius;
    });
  }

  /* ── RENDERING ── */
  function render(ctx, selectedId) {
    if (!ctx) return;

    /* Draw effects first */
    for (const e of _effects) {
      if (!GameMap.isVisible(Math.round(e.tx), Math.round(e.ty))) continue;
      _renderEffect(ctx, e);
    }

    /* Draw units */
    for (const u of _units) {
      if (u.dead) continue;

      /* VC units: only render if detected or visible */
      if (u.isVC() && u.hidden && !u.detected) {
        if (!GameMap.isVisible(Math.round(u.tx), Math.round(u.ty))) continue;
        /* Draw ghillie suit (bush clusters) then faint unit outline */
        _drawGhillieBushes(ctx, u);
        _renderUnit(ctx, u, selectedId, 0.35);
        continue;
      }
      if (u.isVC() && !GameMap.isVisible(Math.round(u.tx), Math.round(u.ty)) && !u.detected) {
        continue; /* Don't render hidden VC */
      }

      _renderUnit(ctx, u, selectedId, 1.0);
    }
  }

  /* Ghillie suit: stable bush clusters around a hidden VC unit */
  function _drawGhillieBushes(ctx, u) {
    const px = u.tx * CONFIG.TILE - GameMap.vpX + CONFIG.TILE / 2;
    const py = u.ty * CONFIG.TILE - GameMap.vpY + CONFIG.TILE / 2;
    if (px < -40 || py < -40 || px > GameMap.vpW + 40 || py > GameMap.vpH + 40) return;

    const R = CONFIG.TILE * 0.52;
    const shades = ['#2d5a1b','#3a7a22','#1e4010','#4a8c2a','#234d15','#3d6e20','#507726','#1a3a0d'];
    ctx.save();
    ctx.globalAlpha = 0.85;
    /* Use unit id as a stable seed so positions don't flicker */
    for (let i = 0; i < 8; i++) {
      const a     = ((u.id * 37 + i * 79) % 628) / 100;
      const dist  = R * (0.35 + (u.id * 13 + i * 43) % 65 / 100);
      const bx    = px + Math.cos(a) * dist;
      const by    = py + Math.sin(a) * dist;
      const br    = 2.8 + (u.id * 7 + i * 31) % 30 / 10;
      ctx.fillStyle = shades[i % shades.length];
      ctx.beginPath();
      ctx.arc(bx, by, br, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function _renderUnit(ctx, u, selectedId, alpha) {
    const px = u.tx * CONFIG.TILE - GameMap.vpX + CONFIG.TILE / 2;
    const py = u.ty * CONFIG.TILE - GameMap.vpY + CONFIG.TILE / 2;

    /* Out of viewport? */
    if (px < -32 || py < -32 || px > GameMap.vpW + 32 || py > GameMap.vpH + 32) return;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(px, py);

    const isUS    = u.isUS();
    const isSelected = u.id === selectedId;
    const HALF    = CONFIG.TILE * 0.4;

    /* Selection ring */
    if (isSelected) {
      ctx.strokeStyle = '#ffffaa';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, HALF + 4, 0, Math.PI * 2);
      ctx.stroke();
      /* Movement arrow if moving */
      if (u.state === 'MOVING' && u.targetTile) {
        const dx = u.targetTile.x - u.tx;
        const dy = u.targetTile.y - u.ty;
        const angle = Math.atan2(dy, dx);
        ctx.strokeStyle = 'rgba(255,255,170,0.5)';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(dx * CONFIG.TILE, dy * CONFIG.TILE);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    /* Shadow */
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(2, HALF*0.3, HALF*0.8, HALF * 0.25, 0, 0, Math.PI * 2);
    ctx.fill();

    /* Body color (set before _drawUnitShape so it can inherit) */
    const bodyColor = isUS
      ? (u.hitFlash ? '#aaddff' : _usColor(u.typeId))
      : (u.hitFlash ? '#ffaaaa' : _vcColor(u.typeId));

    ctx.fillStyle = bodyColor;
    ctx.strokeStyle = isUS ? '#0d1a3a' : '#2a0505';
    ctx.lineWidth = 1;

    /* Draw shape (_drawUnitShape handles its own rotation so shapes stay upright) */
    _drawUnitShape(ctx, u, HALF, isUS);

    /* Health bar (no rotation needed — always screen-aligned) */
    _drawHealthBar(ctx, u, HALF);

    /* Behavior mode indicator */
    if (u.faction === 'us' && u.behaviorMode !== 'GUARD') {
      const bIcon = u.behaviorMode === 'EXPLORE' ? '🔭' : '↩';
      ctx.font = `${Math.round(HALF * 0.7)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(bIcon, HALF + 4, -HALF - 4);
    }

    /* Squad badge — number above the unit, gold diamond for leader */
    if (u.faction === 'us' && u.squadId !== null) {
      const bx = 0, by = -HALF - 11;
      ctx.save();
      if (u.squadLeader) {
        ctx.fillStyle = '#ffdd00';
        ctx.strokeStyle = '#aa8800';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(bx,      by - 7);
        ctx.lineTo(bx + 6,  by);
        ctx.lineTo(bx,      by + 7);
        ctx.lineTo(bx - 6,  by);
        ctx.closePath();
        ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#000';
      } else {
        ctx.fillStyle = 'rgba(20,44,120,0.95)';
        ctx.strokeStyle = '#4466cc';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(bx, by, 6, 0, Math.PI * 2);
        ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#88aaff';
      }
      ctx.font = 'bold 8px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(u.squadId, bx, by);
      ctx.restore();
    }

    /* Muzzle flash */
    if (u.fireEffect > 0) {
      ctx.fillStyle = `rgba(255,200,50,${u.fireEffect * 6})`;
      ctx.beginPath();
      ctx.arc(HALF * 0.8, 0, 5, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  function _drawUnitShape(ctx, u, HALF, isUS) {
    const tid = u.typeId;
    const dark = isUS ? '#0a1535' : '#2a0505';
    const mid  = isUS ? '#1a2a5a' : '#5a0a0a';

    ctx.save();
    ctx.rotate(-u.angle); /* Keep shapes upright regardless of facing */

    if (tid === 'INFANTRY' || tid === 'VC_SQUAD' || tid === 'NVA_REG' || tid === 'VC_COMMAND') {
      /* ── SOLDIER SILHOUETTE ── */
      /* Legs */
      ctx.strokeStyle = ctx.fillStyle;
      ctx.lineWidth = HALF * 0.28;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-HALF*0.18, HALF*0.22);
      ctx.lineTo(-HALF*0.22, HALF*0.72);
      ctx.moveTo( HALF*0.18, HALF*0.22);
      ctx.lineTo( HALF*0.22, HALF*0.72);
      ctx.stroke();
      /* Body */
      ctx.beginPath();
      ctx.roundRect(-HALF*0.38, -HALF*0.2, HALF*0.76, HALF*0.44, HALF*0.1);
      ctx.fill(); ctx.stroke();
      /* Arms */
      ctx.lineWidth = HALF * 0.22;
      ctx.beginPath();
      ctx.moveTo(-HALF*0.38, -HALF*0.1);
      ctx.lineTo(-HALF*0.62, HALF*0.2);
      ctx.moveTo( HALF*0.38, -HALF*0.1);
      ctx.lineTo( HALF*0.65,  HALF*0.05);
      ctx.stroke();
      /* Rifle barrel */
      ctx.strokeStyle = dark;
      ctx.lineWidth = HALF * 0.15;
      ctx.beginPath();
      ctx.moveTo(HALF*0.52, -HALF*0.08);
      ctx.lineTo(HALF*0.95, HALF*0.18);
      ctx.stroke();
      /* Head/Helmet */
      ctx.fillStyle = ctx.fillStyle; /* restore fill */
      ctx.beginPath();
      ctx.arc(0, -HALF*0.42, HALF*0.28, 0, Math.PI*2);
      ctx.fill();
      /* Helmet brim */
      ctx.strokeStyle = dark; ctx.lineWidth = HALF*0.18;
      ctx.beginPath();
      ctx.moveTo(-HALF*0.34, -HALF*0.32);
      ctx.lineTo( HALF*0.34, -HALF*0.32);
      ctx.stroke();

    } else if (tid === 'RECON' || tid === 'VC_SNIPER') {
      /* ── CROUCHING SNIPER ── */
      /* Body low/crouched */
      ctx.lineWidth = HALF * 0.26;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-HALF*0.2, HALF*0.5);
      ctx.lineTo(-HALF*0.1, HALF*0.0);
      ctx.lineTo( HALF*0.1, HALF*0.0);
      ctx.lineTo( HALF*0.2, HALF*0.5);
      ctx.strokeStyle = ctx.fillStyle;
      ctx.stroke();
      ctx.beginPath();
      ctx.roundRect(-HALF*0.32, -HALF*0.18, HALF*0.64, HALF*0.36, HALF*0.1);
      ctx.fill(); ctx.stroke();
      /* Long rifle */
      ctx.strokeStyle = dark; ctx.lineWidth = HALF*0.18;
      ctx.beginPath();
      ctx.moveTo(-HALF*0.2, -HALF*0.1);
      ctx.lineTo( HALF*1.0, -HALF*0.1);
      ctx.stroke();
      /* Scope */
      ctx.beginPath();
      ctx.arc(HALF*0.5, -HALF*0.18, HALF*0.1, 0, Math.PI*2);
      ctx.fillStyle = dark; ctx.fill();
      /* Head */
      ctx.fillStyle = u.def.color || ctx.fillStyle;
      ctx.beginPath();
      ctx.arc(0, -HALF*0.38, HALF*0.24, 0, Math.PI*2);
      ctx.fill();

    } else if (tid === 'ARTILLERY' || tid === 'VC_MORTAR' || tid === 'NVA_HEAVY') {
      /* ── ARTILLERY / MORTAR ── */
      /* Base plate */
      ctx.beginPath();
      ctx.roundRect(-HALF*0.7, HALF*0.1, HALF*1.4, HALF*0.55, 3);
      ctx.fill(); ctx.stroke();
      /* Wheel left */
      ctx.beginPath();
      ctx.arc(-HALF*0.5, HALF*0.45, HALF*0.22, 0, Math.PI*2);
      ctx.fillStyle = dark; ctx.fill();
      /* Wheel right */
      ctx.beginPath();
      ctx.arc( HALF*0.5, HALF*0.45, HALF*0.22, 0, Math.PI*2);
      ctx.fill();
      /* Barrel */
      ctx.fillStyle = mid;
      ctx.beginPath();
      ctx.roundRect(-HALF*0.12, -HALF*0.75, HALF*0.24, HALF*0.9, HALF*0.08);
      ctx.fill(); ctx.stroke();
      /* Muzzle */
      ctx.beginPath();
      ctx.arc(0, -HALF*0.75, HALF*0.16, 0, Math.PI*2);
      ctx.fillStyle = dark; ctx.fill();

    } else if (tid === 'ARMOR' || tid === 'NVA_TANK') {
      /* ── TANK ── */
      /* Hull */
      ctx.beginPath();
      ctx.roundRect(-HALF*0.9, -HALF*0.38, HALF*1.8, HALF*0.76, 3);
      ctx.fill(); ctx.stroke();
      /* Tread stripes top */
      ctx.strokeStyle = dark; ctx.lineWidth = HALF*0.12;
      for (let i = -3; i <= 3; i++) {
        ctx.beginPath();
        ctx.moveTo(i * HALF*0.28, -HALF*0.38);
        ctx.lineTo(i * HALF*0.28, -HALF*0.52);
        ctx.stroke();
      }
      /* Tread stripes bottom */
      for (let i = -3; i <= 3; i++) {
        ctx.beginPath();
        ctx.moveTo(i * HALF*0.28, HALF*0.38);
        ctx.lineTo(i * HALF*0.28, HALF*0.52);
        ctx.stroke();
      }
      /* Turret */
      ctx.fillStyle = mid;
      ctx.strokeStyle = dark; ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(0, 0, HALF*0.5, HALF*0.38, 0, 0, Math.PI*2);
      ctx.fill(); ctx.stroke();
      /* Barrel */
      ctx.strokeStyle = dark; ctx.lineWidth = HALF*0.22;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(HALF*1.05, 0);
      ctx.stroke();

    } else if (tid === 'HELICOPTER') {
      /* ── HELICOPTER ── */
      /* Fuselage */
      ctx.beginPath();
      ctx.ellipse(0, 0, HALF*0.85, HALF*0.38, 0, 0, Math.PI*2);
      ctx.fill(); ctx.stroke();
      /* Nose */
      ctx.beginPath();
      ctx.ellipse(HALF*0.75, 0, HALF*0.28, HALF*0.22, 0, 0, Math.PI*2);
      ctx.fill();
      /* Tail boom */
      ctx.strokeStyle = ctx.fillStyle; ctx.lineWidth = HALF*0.18;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-HALF*0.8, 0);
      ctx.lineTo(-HALF*1.2, HALF*0.1);
      ctx.stroke();
      /* Tail rotor */
      ctx.strokeStyle = isUS ? 'rgba(150,200,255,0.9)' : 'rgba(255,150,100,0.9)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-HALF*1.2, -HALF*0.28);
      ctx.lineTo(-HALF*1.2,  HALF*0.28);
      ctx.stroke();
      /* Main rotor (spinning) */
      const rot = (Date.now() * 0.012) % (Math.PI * 2);
      ctx.save(); ctx.rotate(rot);
      ctx.strokeStyle = isUS ? 'rgba(100,180,255,0.85)' : 'rgba(255,120,80,0.85)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-HALF*1.3, 0); ctx.lineTo(HALF*1.3, 0);
      ctx.moveTo(0, -HALF*1.3); ctx.lineTo(0, HALF*1.3);
      ctx.stroke();
      ctx.restore();
      /* Skids */
      ctx.strokeStyle = dark; ctx.lineWidth = HALF*0.14;
      ctx.beginPath();
      ctx.moveTo(-HALF*0.5, HALF*0.42); ctx.lineTo(HALF*0.5, HALF*0.42);
      ctx.moveTo(-HALF*0.5, HALF*0.38); ctx.lineTo(-HALF*0.5, HALF*0.52);
      ctx.moveTo( HALF*0.5, HALF*0.38); ctx.lineTo( HALF*0.5, HALF*0.52);
      ctx.stroke();

    } else if (tid === 'VC_TUNNEL') {
      /* ── TUNNEL ENTRANCE ── */
      ctx.beginPath();
      ctx.ellipse(0, HALF*0.2, HALF*0.7, HALF*0.45, 0, 0, Math.PI*2);
      ctx.fill(); ctx.stroke();
      /* Opening (dark hole) */
      ctx.fillStyle = 'rgba(0,0,0,0.85)';
      ctx.beginPath();
      ctx.ellipse(0, HALF*0.25, HALF*0.42, HALF*0.28, 0, 0, Math.PI*2);
      ctx.fill();
      /* Entry ladder lines */
      ctx.strokeStyle = 'rgba(200,80,50,0.7)';
      ctx.lineWidth = 1;
      for (let i = -1; i <= 1; i++) {
        ctx.beginPath();
        ctx.moveTo(i * HALF*0.2, HALF*0.08);
        ctx.lineTo(i * HALF*0.2, HALF*0.42);
        ctx.stroke();
      }
      /* T sign above */
      ctx.fillStyle = 'rgba(200,80,50,0.9)';
      ctx.font = `bold ${Math.round(HALF*0.65)}px monospace`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('T', 0, -HALF*0.5);

    } else if (tid === 'M60_GUNNER' || tid === 'VC_RPK') {
      /* ── MACHINE GUNNER — wide bipod stance ── */
      ctx.lineWidth = HALF * 0.26; ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-HALF*0.18, HALF*0.22); ctx.lineTo(-HALF*0.24, HALF*0.76);
      ctx.moveTo( HALF*0.18, HALF*0.22); ctx.lineTo( HALF*0.24, HALF*0.76);
      ctx.strokeStyle = ctx.fillStyle; ctx.stroke();
      /* Wide body */
      ctx.beginPath();
      ctx.roundRect(-HALF*0.44, -HALF*0.24, HALF*0.88, HALF*0.50, HALF*0.08);
      ctx.fill(); ctx.stroke();
      /* Belt of ammo — dots across body */
      ctx.fillStyle = 'rgba(255,200,80,0.8)';
      for (let i = -2; i <= 2; i++) {
        ctx.beginPath(); ctx.arc(i * HALF*0.18, HALF*0.06, HALF*0.08, 0, Math.PI*2); ctx.fill();
      }
      /* Long barrel */
      ctx.strokeStyle = dark; ctx.lineWidth = HALF*0.22;
      ctx.beginPath(); ctx.moveTo(-HALF*0.2, -HALF*0.12); ctx.lineTo(HALF*1.15, -HALF*0.12); ctx.stroke();
      /* Bipod legs */
      ctx.lineWidth = HALF*0.14;
      ctx.beginPath(); ctx.moveTo(HALF*0.7, -HALF*0.12); ctx.lineTo(HALF*0.55, HALF*0.22); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(HALF*0.7, -HALF*0.12); ctx.lineTo(HALF*0.85, HALF*0.22); ctx.stroke();
      /* Head */
      ctx.fillStyle = ctx.fillStyle; ctx.beginPath();
      ctx.arc(0, -HALF*0.44, HALF*0.28, 0, Math.PI*2); ctx.fill();

    } else if (tid === 'SHARPSHOOTER') {
      /* ── ARMY SHARPSHOOTER — prone position, long rifle ── */
      ctx.lineWidth = HALF*0.24; ctx.lineCap = 'round';
      /* Prone body */
      ctx.beginPath(); ctx.ellipse(0, HALF*0.1, HALF*0.72, HALF*0.3, 0, 0, Math.PI*2);
      ctx.fill(); ctx.stroke();
      /* Extra long barrel with bipod */
      ctx.strokeStyle = dark; ctx.lineWidth = HALF*0.16;
      ctx.beginPath(); ctx.moveTo(-HALF*0.4, -HALF*0.1); ctx.lineTo(HALF*1.3, -HALF*0.1); ctx.stroke();
      /* Scope */
      ctx.fillStyle = '#222';
      ctx.beginPath(); ctx.arc(HALF*0.5, -HALF*0.22, HALF*0.12, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(HALF*0.7, -HALF*0.22, HALF*0.12, 0, Math.PI*2); ctx.fill();
      ctx.strokeStyle = '#222'; ctx.lineWidth = HALF*0.08;
      ctx.beginPath(); ctx.moveTo(HALF*0.62, -HALF*0.22); ctx.lineTo(HALF*0.5, -HALF*0.22); ctx.stroke();
      /* Suppressor */
      ctx.strokeStyle = dark; ctx.lineWidth = HALF*0.22;
      ctx.beginPath(); ctx.moveTo(HALF*1.1, -HALF*0.1); ctx.lineTo(HALF*1.3, -HALF*0.1); ctx.stroke();
      /* Head (camouflaged, low) */
      ctx.fillStyle = ctx.fillStyle;
      ctx.beginPath(); ctx.arc(-HALF*0.5, -HALF*0.24, HALF*0.22, 0, Math.PI*2); ctx.fill();

    } else if (tid === 'GRENADIER') {
      /* ── GRENADIER — chunky M79 launcher ── */
      ctx.lineWidth = HALF*0.26; ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-HALF*0.18, HALF*0.22); ctx.lineTo(-HALF*0.22, HALF*0.72);
      ctx.moveTo( HALF*0.18, HALF*0.22); ctx.lineTo( HALF*0.22, HALF*0.72);
      ctx.strokeStyle = ctx.fillStyle; ctx.stroke();
      ctx.beginPath(); ctx.roundRect(-HALF*0.38, -HALF*0.2, HALF*0.76, HALF*0.44, HALF*0.1);
      ctx.fill(); ctx.stroke();
      /* Stubby M79 */
      ctx.strokeStyle = dark; ctx.lineWidth = HALF*0.32; /* thick barrel */
      ctx.beginPath(); ctx.moveTo(HALF*0.2, -HALF*0.08); ctx.lineTo(HALF*0.85, -HALF*0.08); ctx.stroke();
      /* Round grenade chamber */
      ctx.beginPath(); ctx.arc(HALF*0.56, -HALF*0.08, HALF*0.22, 0, Math.PI*2);
      ctx.fillStyle = dark; ctx.fill();
      ctx.fillStyle = 'rgba(80,180,60,0.9)';
      ctx.beginPath(); ctx.arc(HALF*0.56, -HALF*0.08, HALF*0.14, 0, Math.PI*2); ctx.fill();
      /* Head */
      ctx.fillStyle = ctx.fillStyle;
      ctx.beginPath(); ctx.arc(0, -HALF*0.42, HALF*0.28, 0, Math.PI*2); ctx.fill();

    } else if (tid === 'VC_RPG') {
      /* ── RPG TROOPER — tube on shoulder ── */
      ctx.lineWidth = HALF*0.26; ctx.lineCap = 'round';
      /* Body */
      ctx.beginPath(); ctx.moveTo(-HALF*0.18, HALF*0.22); ctx.lineTo(-HALF*0.22, HALF*0.72); ctx.stroke();
      ctx.beginPath(); ctx.moveTo( HALF*0.18, HALF*0.22); ctx.lineTo( HALF*0.22, HALF*0.72); ctx.stroke();
      ctx.beginPath(); ctx.roundRect(-HALF*0.38, -HALF*0.2, HALF*0.76, HALF*0.44, HALF*0.1);
      ctx.fill(); ctx.stroke();
      /* RPG tube across shoulder */
      ctx.strokeStyle = '#886644'; ctx.lineWidth = HALF*0.34;
      ctx.beginPath(); ctx.moveTo(-HALF*0.7, HALF*0.1); ctx.lineTo(HALF*0.95, -HALF*0.18); ctx.stroke();
      /* Warhead cone */
      ctx.fillStyle = '#cc6622';
      ctx.beginPath(); ctx.moveTo(HALF*0.95, -HALF*0.18);
      ctx.lineTo(HALF*1.1, -HALF*0.26); ctx.lineTo(HALF*1.05, -HALF*0.12); ctx.closePath(); ctx.fill();
      /* Exhaust end */
      ctx.fillStyle = dark;
      ctx.beginPath(); ctx.arc(-HALF*0.7, HALF*0.1, HALF*0.18, 0, Math.PI*2); ctx.fill();
      /* Head */
      ctx.fillStyle = ctx.fillStyle;
      ctx.beginPath(); ctx.arc(0, -HALF*0.42, HALF*0.28, 0, Math.PI*2); ctx.fill();

    } else {
      /* Generic fallback */
      ctx.beginPath();
      ctx.arc(0, 0, HALF, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.font = `bold ${Math.round(HALF * 0.9)}px monospace`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(u.def.symbol, 0, 1);
    }

    ctx.restore();
  }

  function _drawHealthBar(ctx, u, HALF) {
    if (u.hp === u.maxHp) return;
    const bw = HALF * 2.2;
    const bh = 3;
    const bx = -HALF * 1.1;
    const by = -HALF - 6;
    const pct = u.hp / u.maxHp;

    ctx.fillStyle = '#300a0a';
    ctx.fillRect(bx, by, bw, bh);
    ctx.fillStyle = pct > 0.5 ? '#4a8a2a' : pct > 0.25 ? '#c8820a' : '#aa2010';
    ctx.fillRect(bx, by, bw * pct, bh);
  }

  function _renderEffect(ctx, e) {
    const px = e.tx * CONFIG.TILE - GameMap.vpX + CONFIG.TILE / 2;
    const py = e.ty * CONFIG.TILE - GameMap.vpY + CONFIG.TILE / 2;
    const p  = e.getProgress();
    const r  = CONFIG.TILE * (e.radius + 0.5);

    ctx.save();

    if (e.type === 'blast') {
      /* Expanding ring */
      const alpha = 1 - p;
      ctx.strokeStyle = `rgba(255,180,50,${alpha})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(px, py, r * p, 0, Math.PI * 2);
      ctx.stroke();
      /* Core flash */
      if (p < 0.3) {
        ctx.fillStyle = `rgba(255,220,100,${(0.3-p)/0.3})`;
        ctx.beginPath();
        ctx.arc(px, py, r * 0.4 * (1-p), 0, Math.PI * 2);
        ctx.fill();
      }
      /* Particles */
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI / 4) + p;
        const d = r * p * 0.7;
        const ppx = px + Math.cos(a) * d;
        const ppy = py + Math.sin(a) * d;
        ctx.fillStyle = `rgba(255,100,30,${(1-p)*0.7})`;
        ctx.fillRect(ppx - 2, ppy - 2, 4, 4);
      }
    } else if (e.type === 'napalm') {
      /* Fire effect */
      for (let fi = 0; fi < 12; fi++) {
        const a   = (fi / 12) * Math.PI * 2;
        const d   = r * (0.3 + Math.random() * 0.5);
        const fpx = px + Math.cos(a) * d;
        const fpy = py + Math.sin(a) * d;
        const fh  = (1 - p) * 20 + Math.random() * 10;
        const falpha = (1-p) * 0.8;
        ctx.fillStyle = `rgba(255,${Math.round(50+100*Math.random())},20,${falpha})`;
        ctx.fillRect(fpx-4, fpy-fh, 8, fh);
      }
      ctx.fillStyle = `rgba(200,80,20,${(1-p)*0.3})`;
      ctx.beginPath();
      ctx.arc(px, py, r * 0.8, 0, Math.PI * 2);
      ctx.fill();
    } else if (e.type === 'defoliate') {
      ctx.strokeStyle = `rgba(180,220,80,${1-p})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(px, py, r * p, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.restore();
  }

  function _usColor(tid) {
    const colors = {
      INFANTRY: '#2244aa', ARTILLERY: '#1a3a88', ARMOR: '#153070',
      HELICOPTER: '#3388cc', RECON: '#22aa88', AIRSTRIKE: '#44aadd',
      NAPALM: '#cc4400', NAVAL: '#1155aa', AGENT_ORANGE: '#88aa22',
      M60_GUNNER: '#1a3366', SHARPSHOOTER: '#226644', GRENADIER: '#4a6622',
    };
    return colors[tid] || '#2244aa';
  }

  function _vcColor(tid) {
    const colors = {
      VC_SQUAD: '#aa2010', VC_SNIPER: '#880808', VC_MORTAR: '#992010',
      VC_TUNNEL: '#552008', VC_COMMAND: '#cc2010', NVA_REG: '#cc2010',
      NVA_HEAVY: '#aa1008', NVA_TANK: '#882008',
      VC_RPG: '#882200', VC_RPK: '#aa1500',
    };
    return colors[tid] || '#aa2010';
  }

  return {
    Unit, StrikeEffect,
    spawn, spawnEffect, removeUnit, getAll, getUS, getVC, getEffects,
    getById, clear, update,
    atTile, inRadius, render,
  };
})();
