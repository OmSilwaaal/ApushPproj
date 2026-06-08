/* ============================================================
   COMBAT — Engagement resolution, strikes, area effects
   ============================================================ */
const Combat = (() => {

  /* ── COMBAT STATS (accumulated per battle for ablation) ── */
  let _stats = _freshStats();

  function _freshStats() {
    return {
      artilleryUsed:  0,
      airStrikesUsed: 0,
      napalmUsed:     0,
      reconDeployed:  0,
      infantryDeploy: 0,
      armorDeployed:  0,
      heliDeployed:   0,
      chemUsed:       0,
      navalUsed:      0,
      enemyContacts:  0,
      usCasualties:   0,
      vcKilled:       0,
      usKilled:       0,
      civilianKills:  0,
      elapsed:        0,
    };
  }

  /* Global combat broadcast — when a fight is happening, all units on the map know */
  let _lastCombatPos = null;
  let _combatCooldown = 0;
  function getCombatPos() { return _lastCombatPos; }

  /* ── AUTO-COMBAT (runs every frame) ── */
  function autoResolve(dt, speedMult, logFn) {
    const usUnits = Units.getUS();
    const vcUnits = Units.getVC();

    if (_combatCooldown > 0) _combatCooldown -= dt * speedMult;
    else _lastCombatPos = null;

    for (const u of usUnits) {
      if (!u.isAlive() || u.oneshot) continue;

      const enemy = _nearestInSight(u, vcUnits);
      if (enemy) {
        /* Always face the enemy during engagement */
        u.angle = Math.atan2(enemy.ty - u.ty, enemy.tx - u.tx);

        if (u.canAttack(enemy)) {
          /* Lock in place and fire */
          u.state = 'ATTACKING';
          const dmg = u.attack(enemy);
          if (dmg > 0) {
            _stats.enemyContacts++;
            _lastCombatPos = { tx: enemy.tx, ty: enemy.ty };
            _combatCooldown = 10;
            SoundSystem.play('gunshot', { x: u.tx, y: u.ty });
            /* Reveal fog around the firefight */
            GameMap.revealArea(Math.round(u.tx), Math.round(u.ty), 5, 0.9);
            GameMap.revealArea(Math.round(enemy.tx), Math.round(enemy.ty), 4, 0.8);
            if (!enemy.isAlive()) {
              _stats.vcKilled++;
              if (logFn) logFn(`${u.name} eliminated ${enemy.name}`, 'us');
            }
          }
          _alertNearbyVC(enemy, vcUnits, 6);
        } else if (u.state !== 'MOVING') {
          /* Close the gap — approach but stop short of stacking */
          u.state = 'ATTACKING';
          u.moveTo(Math.round(enemy.tx), Math.round(enemy.ty));
        }
      } else {
        /* No enemy visible — leave ATTACKING and resume autonomous behavior */
        if (u.state === 'ATTACKING') u.state = 'IDLE';
      }
    }

    for (const v of vcUnits) {
      if (!v.isAlive() || v.stationary) continue;

      const enemy = _nearestInSight(v, usUnits);
      if (enemy) {
        v.angle = Math.atan2(enemy.ty - v.ty, enemy.tx - v.tx);

        if (v.canAttack(enemy)) {
          v.state = 'ATTACKING';
          const dmg = v.attack(enemy);
          if (dmg > 0) {
            _lastCombatPos = { tx: v.tx, ty: v.ty };
            _combatCooldown = 10;
            SoundSystem.play('gunshot', { x: v.tx, y: v.ty });
            if (!enemy.isAlive()) {
              _stats.usKilled++;
              _stats.usCasualties++;
              if (logFn) logFn(`${enemy.name} KIA`, 'vc');
            }
          }
        } else if (v.state !== 'MOVING') {
          v.state = 'ATTACKING';
          v.moveTo(Math.round(enemy.tx), Math.round(enemy.ty));
        }
      } else {
        if (v.state === 'ATTACKING') v.state = 'IDLE';
      }
    }
  }

  /* Enemy in combat sight range (includes approach distance) */
  function _nearestInSight(unit, enemies) {
    let best = null, bestD = Infinity;
    /* Sight range for engaging: attack range + a few tiles to begin approach */
    const engageRange = (unit.range || 1) + 3;
    for (const e of enemies) {
      if (!e.isAlive()) continue;
      if (e.isVC() && e.hidden && !e.detected && e.alertLevel < 0.3) continue;
      const d = Utils.dist(unit.tx, unit.ty, e.tx, e.ty);
      if (d <= engageRange && d < bestD) { best = e; bestD = d; }
    }
    return best;
  }

  function _alertNearbyVC(hitUnit, vcUnits, radius) {
    for (const v of vcUnits) {
      if (!v.isAlive()) continue;
      const d = Utils.dist(hitUnit.tx, hitUnit.ty, v.tx, v.ty);
      if (d <= radius) {
        v.alertLevel = Math.min(1, v.alertLevel + 0.4);
        if (v.hidden && d <= 3) v.detected = true;
      }
    }
  }

  /* ── AREA DAMAGE (AOE strikes) ── */
  function applyAreaDamage(cx, cy, radius, baseDamage, faction, type, logFn) {
    const allUnits = Units.getAll();
    let kills = 0;

    for (const u of allUnits) {
      if (!u.isAlive()) continue;
      const d = Utils.dist(cx, cy, u.tx, u.ty);
      if (d > radius) continue;

      /* Skip friendlies unless it's agent orange */
      if (u.faction !== faction && type !== 'agent_orange') {
        const falloff = 1 - (d / radius);
        const dmg = Math.round(baseDamage * falloff * (0.7 + Math.random() * 0.6));
        const wasAlive = u.isAlive();
        u.takeDamage(dmg);
        if (wasAlive && !u.isAlive()) {
          kills++;
          if (u.isVC()) { _stats.vcKilled++; if (logFn) logFn(`Strike eliminated ${u.name}`, 'event'); }
          if (u.isUS()) { _stats.usKilled++; _stats.usCasualties++; if (logFn) logFn(`FRIENDLY FIRE: ${u.name} KIA`, 'warn'); }
        }
        /* Alert nearby VC */
        if (u.isVC()) {
          u.detected = true;
          u.alertLevel = 1;
        }
      }
    }

    /* Reveal area */
    GameMap.revealArea(cx, cy, radius + 1, 0.9);

    /* Burn/defoliate tiles */
    if (type === 'napalm') GameMap.burnArea(cx, cy, radius);
    if (type === 'agent_orange') GameMap.defoliate(cx, cy, radius + 1);

    /* Sound blast */
    GameMap.addSound(cx, cy, 9);
    if (type !== 'defoliate') SoundSystem.play(type === 'napalm' ? 'napalm' : 'explosion', { x: cx, y: cy });

    return kills;
  }

  /* ── PLAYER ACTIONS ── */
  function deployUnit(typeId, tx, ty, logFn) {
    if (!GameMap.isWalkable(tx, ty, CONFIG.UNITS[typeId]?.flying)) {
      if (logFn) logFn('Cannot deploy there — impassable terrain', 'warn');
      return null;
    }

    const u = Units.spawn(typeId, tx, ty, 'us');

    /* Update stats */
    switch(typeId) {
      case 'INFANTRY':
      case 'M60_GUNNER':
      case 'SHARPSHOOTER':
      case 'GRENADIER':    _stats.infantryDeploy++; break;
      case 'ARTILLERY':    _stats.artilleryUsed++;  break;
      case 'ARMOR':        _stats.armorDeployed++;  break;
      case 'HELICOPTER':   _stats.heliDeployed++;   break;
      case 'RECON':        _stats.reconDeployed++;  break;
      case 'NAPALM':       _stats.napalmUsed++;     break;
      case 'AIRSTRIKE':    _stats.airStrikesUsed++; break;
      case 'AGENT_ORANGE': _stats.chemUsed++;       break;
      case 'NAVAL':        _stats.navalUsed++;      break;
    }

    if (logFn) logFn(`Deployed ${u.name} at [${tx},${ty}]`, 'us');
    return u;
  }

  function launchStrike(typeId, tx, ty, logFn) {
    if (!GameMap.hasCoordinates(tx, ty) && CONFIG.UNITS[typeId]?.needsCoords) {
      if (logFn) logFn('No coordinates — deploy recon first', 'warn');
      return false;
    }

    const def    = CONFIG.UNITS[typeId];
    const radius = def.aoe || 1;
    const dmg    = def.atk;

    const onImpact = () => {
      applyAreaDamage(tx, ty, radius, dmg, 'vc', typeId === 'NAPALM' ? 'napalm' : typeId === 'AGENT_ORANGE' ? 'agent_orange' : 'blast', logFn);
    };

    if (typeof Effects !== 'undefined') {
      if (typeId === 'NAPALM') {
        Effects.addNapalmPlane(tx, ty, radius, onImpact);
        SoundSystem.play('napalm', { x: tx, y: ty });
      } else if (typeId === 'AGENT_ORANGE') {
        Effects.addAgentOrangePlane(tx, ty, radius, onImpact);
        SoundSystem.play('jet', { x: tx, y: ty });
      } else if (typeId === 'NAVAL') {
        /* Naval: instant shell arcs from off-screen bottom */
        for (let i = 0; i < 3; i++) {
          const offX = tx + Utils.randInt(-2, 2);
          const offY = ty + Utils.randInt(-2, 2);
          setTimeout(() => {
            Effects.addArtilleryShell(offX, GameMap.MAP_H + 5, offX, offY, () => {
              Effects.addBlast(offX, offY, radius * 0.6, 5);
              applyAreaDamage(offX, offY, radius * 0.6, dmg * 0.5, 'vc', 'blast', logFn);
            }, false);
          }, i * 400);
        }
        SoundSystem.play('artillery', { x: tx, y: ty });
      } else {
        /* AIRSTRIKE */
        Effects.addAirStrikePlane(tx, ty, radius, onImpact);
        SoundSystem.play('jet', { x: tx, y: ty });
      }
    } else {
      /* Fallback: instant damage */
      onImpact();
    }

    switch(typeId) {
      case 'AIRSTRIKE':   _stats.airStrikesUsed++; break;
      case 'NAPALM':      _stats.napalmUsed++;     break;
      case 'AGENT_ORANGE':_stats.chemUsed++;       break;
      case 'NAVAL':       _stats.navalUsed++;      break;
    }

    if (logFn) logFn(`${def.name} inbound to [${tx},${ty}]`, 'event');
    return true;
  }

  /* ── RESOLVE PENDING STRIKES (no-op — handled by Effects planes) ── */
  function resolveArrivedStrikes(logFn) {}

  /* ── ARTILLERY (placed on map, fires at coordinates) ── */
  function artilleryStrike(gunUnit, targetTX, targetTY, logFn) {
    if (!gunUnit || !gunUnit.isAlive()) return false;
    if (!GameMap.hasCoordinates(targetTX, targetTY)) {
      if (logFn) logFn('Artillery: no target coordinates in that sector', 'warn');
      return false;
    }
    const d = Utils.dist(gunUnit.tx, gunUnit.ty, targetTX, targetTY);
    if (d > gunUnit.range + 0.5) {
      if (logFn) logFn('Target out of artillery range', 'warn');
      return false;
    }

    /* Delay effect */
    setTimeout(() => {
      if (!gunUnit.isAlive()) return;
      Units.spawnEffect(targetTX, targetTY, 2, gunUnit.atk, 'blast');
      applyAreaDamage(targetTX, targetTY, 2, gunUnit.atk, 'vc', 'blast', logFn);
      SoundSystem.play('artillery', { x: targetTX, y: targetTY });
      gunUnit.attackCd = 4;
      _stats.artilleryUsed++;
    }, 1200);

    if (logFn) logFn(`Artillery firing at [${targetTX},${targetTY}]...`, 'us');
    GameMap.addSound(Math.round(gunUnit.tx), Math.round(gunUnit.ty), 8);
    return true;
  }

  function getStats()   { return { ..._stats }; }
  function resetStats() { _stats = _freshStats(); }
  function tickTime(dt) { _stats.elapsed += dt; }
  function addCasualty() { _stats.usCasualties++; }

  return {
    autoResolve, applyAreaDamage, deployUnit, launchStrike,
    resolveArrivedStrikes, artilleryStrike,
    getStats, resetStats, tickTime, getCombatPos,
  };
})();
