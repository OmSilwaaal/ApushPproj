/* ============================================================
   ENEMY CONTROLLER — Drives VC/NVA unit behavior using
   historical doctrine profiles from the LSTM (doctrine) module.
   ============================================================ */
const EnemyAI = (() => {

  let _battle     = null;
  let _tickTimer  = 0;
  const TICK_RATE = 0.8;   /* Seconds between AI decisions */
  let _currentBehavior = LSTM.B_HIDE;
  let _behaviorLabel   = 'Observing';
  let _patrolPoints    = [];
  let _attackWaveTimer    = 120 + Math.random() * 60;
  let _attackAlertPending = false;

  /* ── INITIALIZATION ── */
  function init(battleCfg, mapCfg) {
    _battle = battleCfg;
    _tickTimer = 0;
    _currentBehavior    = LSTM.B_HIDE;
    _behaviorLabel      = 'Holding Position';
    _attackWaveTimer    = 120 + Math.random() * 60;
    _attackAlertPending = false;
    _spawnEnemies(battleCfg);
    _buildPatrolPoints(mapCfg);
    LSTM.resetState();
    LSTM.setBattle(battleCfg.id);
  }

  function _spawnEnemies(battleCfg) {
    const mc = battleCfg.mapConfig;
    if (!mc.vcGroups) return;

    for (const group of mc.vcGroups) {
      for (let i = 0; i < group.count; i++) {
        /* Random position within group area */
        let tx, ty, attempts = 0;
        do {
          tx = group.area.x + Utils.randInt(0, group.area.w - 1);
          ty = group.area.y + Utils.randInt(0, group.area.h - 1);
          attempts++;
        } while (!GameMap.isWalkable(tx, ty, false) && attempts < 20);

        if (attempts >= 20) continue;

        const u = Units.spawn(group.type, tx, ty, 'vc');
        /* Stagger initial patrol */
        u.alertLevel = Utils.rand(0.2, 0.4);
      }
    }
  }

  function _buildPatrolPoints(mapCfg) {
    _patrolPoints = [];
    /* Create a grid of waypoints across the map */
    for (let y = 5; y < CONFIG.MAP_H - 5; y += 8) {
      for (let x = 5; x < CONFIG.MAP_W - 5; x += 8) {
        if (GameMap.isWalkable(x, y, false)) {
          _patrolPoints.push({ x, y });
        }
      }
    }
  }

  /* ── MAIN UPDATE ── */
  function update(dt, speedMult, gameState, logFn) {
    const eff = dt * speedMult;
    _tickTimer += eff;

    /* Attack wave countdown */
    _attackWaveTimer -= eff;
    if (_attackWaveTimer <= 0) {
      _attackWaveTimer    = 120 + Math.random() * 60;
      _attackAlertPending = true;
      _launchAttackWave(logFn);
    }

    /* Sound-based detection */
    _updateSoundDetection(logFn);

    if (_tickTimer >= TICK_RATE) {
      _tickTimer -= TICK_RATE;
      _aiTick(gameState, logFn);
    }

    /* Per-frame micro-behaviors */
    _microBehaviors(eff, logFn);
  }

  function _updateSoundDetection(logFn) {
    const vcUnits = Units.getVC();
    for (const v of vcUnits) {
      if (!v.isAlive() || v.dead) continue;
      const sound = GameMap.getSoundAt(Math.round(v.tx), Math.round(v.ty));
      if (sound > CONFIG.SOUND_THRESHOLD) {
        v.alertLevel = Math.min(1, v.alertLevel + sound * 0.1);
        if (v.alertLevel > 0.4 && v.hidden) {
          /* Don't fully reveal, but increase awareness */
          if (sound > 6 && !v.detected) {
            v.detected = true;
            if (logFn) logFn('VC unit alerted by sound!', 'vc');
          }
        }
      }
    }
  }

  function _aiTick(gameState, logFn) {
    /* Run doctrine selector */
    const output     = LSTM.tick(gameState);
    const behaviorIdx = _pickBehavior(output);
    _currentBehavior  = behaviorIdx;
    _behaviorLabel    = LSTM.getOutputLabels()[behaviorIdx] || 'Unknown';

    if (logFn) {
      const conf = Math.round(output[behaviorIdx] * 100);
      logFn(`Enemy: ${_behaviorLabel} (${conf}%)`, 'vc');
    }

    /* Execute behavior */
    switch (behaviorIdx) {
      case LSTM.B_HIDE:    _executeBehaviorHide();   break;
      case LSTM.B_AMBUSH:  _executeBehaviorAmbush(); break;
      case LSTM.B_DISPERSE:_executeBehaviorDisperse();break;
      case LSTM.B_MORTAR:  _executeBehaviorMortar(logFn); break;
      case LSTM.B_COUNTER: _executeBehaviorCounter();break;
    }
  }

  function _pickBehavior(output) {
    /* Softmax already done — pick argmax with slight randomness */
    let best = 0, bestV = -Infinity;
    for (let i = 0; i < output.length; i++) {
      /* Add small noise to prevent always picking same */
      const v = output[i] + Utils.rand(-0.05, 0.05);
      if (v > bestV) { bestV = v; best = i; }
    }
    return best;
  }

  /* ── BEHAVIOR IMPLEMENTATIONS ── */

  function _executeBehaviorHide() {
    /* Move VC to jungle/tunnel cover */
    const vcUnits = Units.getVC().filter(v => !v.stationary && v.isAlive());
    for (const v of vcUnits) {
      if (v.alertLevel > 0.6) continue; /* Alert units don't hide */
      const cover = _findCover(v);
      if (cover) v.moveTo(cover.x, cover.y);
      v.hidden = true;
    }
  }

  function _executeBehaviorAmbush() {
    /* Move VC to intercept US units via predicted paths */
    const usUnits = Units.getUS();
    if (!usUnits.length) return;

    const vcUnits = Units.getVC().filter(v => !v.stationary && v.isAlive());
    for (const v of vcUnits) {
      /* Find nearest US unit */
      let nearest = null, nearestD = Infinity;
      for (const u of usUnits) {
        const d = Utils.dist(v.tx, v.ty, u.tx, u.ty);
        if (d < nearestD) { nearest = u; nearestD = d; }
      }

      if (nearest && nearestD > 2 && nearestD < 20) {
        /* Move to a position ahead of the US unit's path */
        const intercept = _predictIntercept(nearest, v);
        if (intercept) v.moveTo(intercept.x, intercept.y);
        v.hidden = true; /* Stay hidden for ambush */
      }
    }
  }

  function _executeBehaviorDisperse() {
    /* Spread out to reduce AOE vulnerability */
    const vcGroups = _getVCGroups();
    for (const group of vcGroups) {
      if (group.length < 2) continue;
      const center = _groupCenter(group);
      for (const v of group) {
        if (v.stationary) continue;
        /* Move away from center */
        const dx = v.tx - center.x, dy = v.ty - center.y;
        const len = Math.hypot(dx, dy) || 1;
        const tx  = Math.round(v.tx + (dx/len) * 6);
        const ty  = Math.round(v.ty + (dy/len) * 6);
        if (GameMap.isWalkable(tx, ty, false)) v.moveTo(tx, ty);
        /* Go underground if tunnel nearby */
        const tunnel = _nearbyTunnel(v, 4);
        if (tunnel) {
          v.inGround = true;
          v.moveTo(Math.round(tunnel.tx), Math.round(tunnel.ty));
        }
      }
    }
  }

  function _executeBehaviorMortar(logFn) {
    /* Find mortar teams and fire at detected US positions */
    const mortarTeams = Units.getVC().filter(v =>
      v.typeId === 'VC_MORTAR' && v.isAlive() && v.attackCd <= 0
    );
    const usUnits = Units.getUS();

    for (const mortar of mortarTeams) {
      /* Find US unit in range */
      let target = null;
      for (const u of usUnits) {
        if (!GameMap.hasCoordinates(Math.round(u.tx), Math.round(u.ty))) continue;
        const d = Utils.dist(mortar.tx, mortar.ty, u.tx, u.ty);
        if (d <= (mortar.range || 6)) { target = u; break; }
      }
      if (!target) continue;

      /* Fire with delay */
      const tx = Math.round(target.tx), ty = Math.round(target.ty);
      const delay = 1500 + Math.random() * 1000;
      setTimeout(() => {
        if (!mortar.isAlive()) return;
        Units.spawnEffect(tx, ty, 2, mortar.atk, 'blast');
        Combat.applyAreaDamage(tx, ty, 2, mortar.atk, 'us', 'blast', logFn);
        SoundSystem.play('explosion', { x: tx, y: ty });
        mortar.attackCd = 8;
        mortar.detected = true;
        if (logFn) logFn('Incoming mortar fire!', 'warn');
      }, delay);
    }
  }

  function _executeBehaviorCounter() {
    /* Coordinated attack — move all alert VC towards nearest US cluster */
    const usUnits = Units.getUS();
    if (!usUnits.length) return;

    /* Find US cluster center */
    let cx = 0, cy = 0;
    for (const u of usUnits) { cx += u.tx; cy += u.ty; }
    cx /= usUnits.length; cy /= usUnits.length;

    const vcUnits = Units.getVC().filter(v =>
      !v.stationary && v.isAlive() && v.alertLevel > 0.3
    );

    for (const v of vcUnits) {
      const d = Utils.dist(v.tx, v.ty, cx, cy);
      if (d > 3) {
        /* Move to attack, maintain some spread */
        const angle   = Math.atan2(cy - v.ty, cx - v.tx) + Utils.rand(-0.4, 0.4);
        const moveDist= Math.min(d - 2, 8);
        const tx = Math.round(v.tx + Math.cos(angle) * moveDist);
        const ty = Math.round(v.ty + Math.sin(angle) * moveDist);
        if (GameMap.isWalkable(tx, ty, false)) v.moveTo(tx, ty);
        v.hidden = false;
        v.detected = true;
      }
    }
  }

  /* ── MICRO-BEHAVIORS (every frame) ── */
  function _microBehaviors(dt, logFn) {
    const vcUnits = Units.getVC();

    /* VC rally: when a unit is detected under fire, nearby comrades converge */
    const fightingVC = vcUnits.filter(v => v.isAlive() && v.detected && v.hitFlash);
    for (const fv of fightingVC) {
      for (const other of vcUnits) {
        if (other.id === fv.id || !other.isAlive() || other.stationary) continue;
        if (other.state === 'MOVING') continue;
        const d = Utils.dist(fv.tx, fv.ty, other.tx, other.ty);
        if (d > 12 || d < 2) continue;
        other.alertLevel = Math.min(1, other.alertLevel + 0.5);
        other.hidden = false;
        /* Flank from a slightly offset angle so they don't stack */
        const baseAngle = Math.atan2(fv.ty - other.ty, fv.tx - other.tx);
        const angle = baseAngle + Utils.rand(-0.6, 0.6);
        const moveDist = Math.min(d - 1.5, 6);
        const tx = Math.round(other.tx + Math.cos(angle) * moveDist);
        const ty = Math.round(other.ty + Math.sin(angle) * moveDist);
        if (GameMap.isWalkable(tx, ty, false)) other.moveTo(tx, ty);
      }
    }

    for (const v of vcUnits) {
      if (!v.isAlive() || v.stationary) continue;

      /* Alert units stop hiding */
      if (v.alertLevel > 0.7) v.hidden = false;

      /* Wounded detected units try to reach cover (once) */
      if (v.detected && v.hp < v.maxHp * 0.5 && v.state === 'IDLE' && !v._retreating) {
        v._retreating = true;
        const cover = _findCover(v);
        if (cover) v.moveTo(cover.x, cover.y);
      }
    }

    /* VC cohesion: lone units drift toward nearby allies so they travel in groups */
    for (const v of vcUnits) {
      if (!v.isAlive() || v.stationary || v.state !== 'IDLE') continue;
      if (v.alertLevel > 0.5) continue; /* alert units handled by other behaviors */

      v._cohesionCd = (v._cohesionCd || 0) - dt;
      if (v._cohesionCd > 0) continue;
      v._cohesionCd = 2.5 + Math.random() * 1.5;

      /* Count allies within grouping radius */
      let nearbyCount = 0, nearestAlly = null, nearestD = Infinity;
      for (const other of vcUnits) {
        if (other.id === v.id || !other.isAlive()) continue;
        const d = Utils.dist(v.tx, v.ty, other.tx, other.ty);
        if (d < 9) nearbyCount++;
        if (d < nearestD) { nearestD = d; nearestAlly = other; }
      }

      /* Lone unit (< 2 nearby): move toward nearest ally */
      if (nearbyCount < 2 && nearestAlly && nearestD > 4 && nearestD < 28) {
        const angle = Math.atan2(nearestAlly.ty - v.ty, nearestAlly.tx - v.tx) + Utils.rand(-0.35, 0.35);
        const moveDist = Math.min(nearestD - 3, 7);
        const nx = Math.round(v.tx + Math.cos(angle) * moveDist);
        const ny = Math.round(v.ty + Math.sin(angle) * moveDist);
        if (GameMap.isWalkable(nx, ny, false)) v.moveTo(nx, ny);
      }
    }
  }

  /* ── ATTACK WAVE ── */
  function _launchAttackWave(logFn) {
    const usUnits = Units.getUS().filter(u => u.isAlive());
    if (!usUnits.length) return;

    /* Target US cluster center */
    let cx = 0, cy = 0;
    for (const u of usUnits) { cx += u.tx; cy += u.ty; }
    cx /= usUnits.length;
    cy /= usUnits.length;

    const vcUnits = Units.getVC().filter(v => v.isAlive() && !v.stationary);
    for (const v of vcUnits) {
      v.alertLevel = 1;
      v.hidden     = false;
      v.detected   = true;
      v._retreating = false;
      const angle    = Math.atan2(cy - v.ty, cx - v.tx) + Utils.rand(-0.5, 0.5);
      const d        = Utils.dist(v.tx, v.ty, cx, cy);
      const moveDist = Math.min(d, 14);
      const nx = Math.round(v.tx + Math.cos(angle) * moveDist);
      const ny = Math.round(v.ty + Math.sin(angle) * moveDist);
      if (GameMap.isWalkable(nx, ny, false)) v.moveTo(nx, ny);
    }
    if (logFn) logFn('Enemy launches coordinated offensive!', 'warn');
  }

  function getAttackAlert() {
    if (_attackAlertPending) { _attackAlertPending = false; return true; }
    return false;
  }

  /* ── HELPERS ── */

  function _findCover(unit) {
    /* Look for nearby jungle or tunnel */
    let bestTile = null, bestScore = -Infinity;
    const tiles  = Utils.tileInRadius(Math.round(unit.tx), Math.round(unit.ty), 8, CONFIG.MAP_W, CONFIG.MAP_H);
    for (const { x, y } of tiles) {
      if (!GameMap.isWalkable(x, y, false)) continue;
      const tc    = GameMap.getTileConfig(x, y);
      const score = tc.cover - (GameMap.isVisible(x, y) ? 1 : 0);
      if (score > bestScore) { bestScore = score; bestTile = { x, y }; }
    }
    return bestTile;
  }

  function _predictIntercept(usUnit, vcUnit) {
    /* Predict where US unit will be, pick ambush point on path */
    if (!usUnit.targetTile) {
      return { x: Math.round(usUnit.tx + 3), y: Math.round(usUnit.ty) };
    }
    /* Position between current and destination */
    const fx = (usUnit.tx + usUnit.targetTile.x) / 2;
    const fy = (usUnit.ty + usUnit.targetTile.y) / 2;
    /* Add some lateral offset */
    const lx = Math.round(fx + Utils.rand(-3, 3));
    const ly = Math.round(fy + Utils.rand(-3, 3));
    if (GameMap.isWalkable(lx, ly, false)) return { x: lx, y: ly };
    return { x: Math.round(fx), y: Math.round(fy) };
  }

  function _getVCGroups() {
    /* Cluster VC units into proximity groups */
    const vcUnits = Units.getVC().filter(v => v.isAlive());
    const groups  = [];
    const visited = new Set();

    for (const v of vcUnits) {
      if (visited.has(v.id)) continue;
      const group = [v];
      visited.add(v.id);
      for (const other of vcUnits) {
        if (visited.has(other.id)) continue;
        if (Utils.dist(v.tx, v.ty, other.tx, other.ty) < 6) {
          group.push(other);
          visited.add(other.id);
        }
      }
      groups.push(group);
    }
    return groups;
  }

  function _groupCenter(group) {
    let cx = 0, cy = 0;
    for (const v of group) { cx += v.tx; cy += v.ty; }
    return { x: cx / group.length, y: cy / group.length };
  }

  function _nearbyTunnel(unit, radius) {
    return Units.getVC().find(v =>
      v.typeId === 'VC_TUNNEL' && v.isAlive() &&
      Utils.dist(unit.tx, unit.ty, v.tx, v.ty) <= radius
    ) || null;
  }

  function getBehaviorLabel() { return _behaviorLabel; }

  function onBattleEnd(vcWon, stats) {
    LSTM.learn(vcWon, stats);
  }

  return { init, update, getBehaviorLabel, onBattleEnd, getAttackAlert };
})();
