/* ============================================================
   GAME — Main game controller, state machine, loop
   ============================================================ */
const Game = (() => {

  /* ── STATE ── */
  let _state = 'MENU';   /* MENU | LOADING | BRIEFING | PLAYING | PAUSED | POST_BATTLE | VICTORY */
  let _currentBattleIdx = 0;
  let _campaignScore    = 0;
  let _publicOpinion    = CONFIG.OPINION_START;
  let _triggeredThresholds = new Set();

  /* Per-battle state */
  let _elapsed      = 0;
  let _resources    = 0;
  let _reconRemaining = 0;
  let _selectedUnit = null;
  let _actionMode   = null;
  let _gameSpeed    = 1;
  let _paused       = false;
  let _patrolMarkMode = false;
  let _strikeBanner   = null;
  let _baseStart      = null;       /* US base center — units only spawn here */
  let _resourceTimer  = 0;          /* passive income timer */
  let _attackAlert    = null;       /* { text, timer } — enemy wave alert */
  let _captureState   = {};         /* objective capture progress keyed by name */
  let _capReinforceTimer = {};      /* cooldown for vc reinforcements per objective */
  let _histEventIdx   = 0;          /* next historical event to fire for this battle */

  /* Unit info panel — only rebuild when something changes */
  let _unitInfoCache = { id: null, hp: -1, state: '', behavior: '' };

  /* Canvas */
  let _canvas   = null;
  let _ctx      = null;
  let _overlayCanvas = null;
  let _overlayCtx    = null;
  let _canvasW  = 900;
  let _canvasH  = 500;

  let _lastTime = 0;
  let _rafId    = null;

  /* Scroll keys */
  const _keys = {};

  /* ── INITIALIZATION ── */
  function init() {
    SoundSystem.init();
    UI.initDocsModal();
    UI.initTutorial();
    _setupMenuListeners();
    _setupGameListeners();
    _setupPostBattleListeners();
    _setupModalListeners();
    _resizeCanvas();
    window.addEventListener('resize', _resizeCanvas);
    UI.showScreen('screen-menu');
  }

  function _resizeCanvas() {
    const wrap = document.getElementById('canvas-wrap');
    if (!wrap) return;
    _canvasW = wrap.clientWidth  || 900;
    _canvasH = wrap.clientHeight || 500;

    ['gameCanvas', 'overlayCanvas'].forEach(id => {
      const c = document.getElementById(id);
      if (c) { c.width = _canvasW; c.height = _canvasH; }
    });

    _canvas        = document.getElementById('gameCanvas');
    _ctx           = _canvas?.getContext('2d');
    _overlayCanvas = document.getElementById('overlayCanvas');
    _overlayCtx    = _overlayCanvas?.getContext('2d');

    if (_ctx) GameMap.setCanvas(_ctx, _canvasW, _canvasH);
  }

  /* ── MENU LISTENERS ── */
  function _setupMenuListeners() {
    document.getElementById('btn-start-campaign')?.addEventListener('click', () => {
      SoundSystem.play('uiClick');
      /* Go fullscreen on first user gesture */
      if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(() => {});
      }
      startCampaign();
    });
    document.getElementById('btn-historical-docs')?.addEventListener('click', () => {
      SoundSystem.play('uiClick');
      UI.showModal('modal-docs');
    });
    document.getElementById('btn-tutorial')?.addEventListener('click', () => {
      SoundSystem.play('uiClick');
      UI.showTutorial();
    });
    document.getElementById('btn-about')?.addEventListener('click', () => {
      SoundSystem.play('uiClick');
      UI.showModal('modal-about');
    });
    document.getElementById('close-about')?.addEventListener('click', () => {
      UI.hideModal('modal-about');
    });
    document.getElementById('close-about-btn')?.addEventListener('click', () => {
      UI.hideModal('modal-about');
    });
  }

  /* ── GAME SCREEN LISTENERS ── */
  function _setupGameListeners() {
    /* Action buttons */
    document.querySelectorAll('.act-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const action = btn.dataset.action;
        if (!action) return;
        SoundSystem.play('uiClick');
        _handleActionButtonClick(action);
      });
    });

    /* Canvas clicks */
    const canvasEl = document.getElementById('gameCanvas');
    if (canvasEl) {
      canvasEl.addEventListener('click', _onCanvasClick);
      canvasEl.addEventListener('contextmenu', e => { e.preventDefault(); _onRightClick(e); });
      canvasEl.addEventListener('mousemove', _onMouseMove);
      canvasEl.addEventListener('wheel', _onWheel);
    }

    /* Behavior mode buttons — exposed as window globals so inline onclick works */
    window.GAME_setBehavior = function(mode) {
      if (!_selectedUnit || !_selectedUnit.isAlive()) return;
      _selectedUnit.behaviorMode   = mode;
      _selectedUnit._patrolPause   = 0;
      _selectedUnit.patrolIdx      = 0;
      _selectedUnit.patrolWaypoints = []; /* always reset waypoints on mode change */
      _patrolMarkMode = false;
      if (mode === 'PATROL') {
        _patrolMarkMode = true;
        UI.log('PATROL — Click map to place waypoints. Right-click when done.', 'event');
      }
      _unitInfoCache.id = null;
      UI.updateUnitInfo(_selectedUnit);
      SoundSystem.play('deploy');
    };
    window.GAME_startPatrolMark = function() {
      if (!_selectedUnit) return;
      _patrolMarkMode = true;
      UI.log('Click on the map to add patrol waypoints. Right-click when done.', 'event');
    };
    window.GAME_clearPatrol = function() {
      if (!_selectedUnit) return;
      _selectedUnit.patrolWaypoints = [];
      _selectedUnit.patrolIdx = 0;
      _patrolMarkMode = false;
      _unitInfoCache.id = null;
      UI.updateUnitInfo(_selectedUnit);
      UI.log('Patrol waypoints cleared.', 'event');
    };

    /* ── SQUAD SYSTEM ── */
    window.GAME_assignSquad = function(squadId) {
      if (!_selectedUnit) return;
      const prevSquad = _selectedUnit.squadId;

      /* If this unit was leader of a previous squad, hand off to next member */
      if (_selectedUnit.squadLeader && prevSquad !== null) {
        const heir = Units.getUS().find(u => u.id !== _selectedUnit.id && u.squadId === prevSquad && u.isAlive());
        if (heir) heir.squadLeader = true;
      }
      _selectedUnit.squadLeader = false;
      _selectedUnit.squadId = squadId;

      /* First unit assigned to a squad becomes squad leader */
      if (squadId !== null) {
        const existing = Units.getUS().filter(u => u.id !== _selectedUnit.id && u.squadId === squadId && u.isAlive());
        if (existing.length === 0) _selectedUnit.squadLeader = true;
      }

      _unitInfoCache.id = null;
      UI.updateUnitInfo(_selectedUnit);
      const leaderTag = _selectedUnit.squadLeader ? ' (Squad Leader)' : '';
      if (squadId) UI.log(`Unit assigned to Squad ${squadId}${leaderTag}`, 'us');
      else UI.log('Unit removed from squad', 'us');
      SoundSystem.play('uiClick');
    };

    /* HUD controls */
    document.getElementById('btn-pause')?.addEventListener('click', togglePause);
    document.getElementById('btn-docs')?.addEventListener('click', () => {
      SoundSystem.play('uiClick');
      UI.showModal('modal-docs');
    });
    document.getElementById('btn-intel')?.addEventListener('click', () => {
      SoundSystem.play('uiClick');
      const stats  = Combat.getStats();
      const vizData = LSTM.getVizData();
      UI.showIntelReport(stats, Battles.get(_currentBattleIdx), EnemyAI.getBehaviorLabel(), Math.round(vizData.threat * 100), vizData);
    });
    document.getElementById('btn-speed')?.addEventListener('click', () => {
      const speeds = CONFIG.GAME_SPEEDS;
      const idx = speeds.indexOf(_gameSpeed);
      _gameSpeed = speeds[(idx + 1) % speeds.length];
      document.getElementById('btn-speed').textContent = _gameSpeed + '×';
      SoundSystem.play('uiClick');
    });

    /* Keyboard */
    window.addEventListener('keydown', e => { _keys[e.key] = true; _onKeyDown(e); });
    window.addEventListener('keyup',   e => { _keys[e.key] = false; });

    /* Brief buttons */
    document.getElementById('btn-deploy')?.addEventListener('click', () => {
      SoundSystem.play('deploy');
      launchBattle();
    });
    document.getElementById('btn-brief-back')?.addEventListener('click', () => {
      SoundSystem.play('uiClick');
      UI.showScreen('screen-menu');
    });
  }

  function _setupPostBattleListeners() {
    document.getElementById('btn-pb-next')?.addEventListener('click', () => {
      SoundSystem.play('uiClick');
      nextBattle();
    });
    document.getElementById('btn-pb-docs')?.addEventListener('click', () => {
      SoundSystem.play('uiClick');
      UI.initDocsModal();
      UI.showModal('modal-docs');
    });
  }

  function _setupModalListeners() {
    document.getElementById('close-docs')?.addEventListener('click', () => UI.hideModal('modal-docs'));
    document.getElementById('close-antiwar')?.addEventListener('click', () => {
      UI.hideModal('modal-antiwar');
      if (_paused) togglePause();
    });
    document.getElementById('close-intel')?.addEventListener('click', () => UI.hideModal('modal-intel'));
  }

  /* ── CAMPAIGN FLOW ── */
  function startCampaign() {
    _currentBattleIdx = 0;
    _campaignScore    = 0;
    _publicOpinion    = CONFIG.OPINION_START;
    _triggeredThresholds.clear();
    UI.showLoading(() => {
      _showCurrentBriefing();
    });
  }

  function _showCurrentBriefing() {
    const battle = Battles.get(_currentBattleIdx);
    if (!battle) { _showVictory(); return; }
    UI.showBriefing(battle, _currentBattleIdx, Battles.count(), LSTM.getAdaptations());
  }

  function launchBattle() {
    const battle = Battles.get(_currentBattleIdx);
    if (!battle) return;

    _state          = 'PLAYING';
    _elapsed        = 0;
    _paused         = false;
    _selectedUnit   = null;
    _actionMode     = null;
    _strikeBanner   = null;
    _attackAlert    = null;
    _patrolMarkMode = false;
    _resources      = battle.assets.resources;
    _reconRemaining = battle.assets.recon;
    _resourceTimer  = 0;
    _captureState   = {};
    _capReinforceTimer = {};
    _histEventIdx   = 0;
    _baseStart      = battle.mapConfig.usStart;

    /* Clear and regenerate */
    Units.clear();
    Combat.resetStats();
    GameMap.generate(battle);
    EnemyAI.init(battle, battle.mapConfig);

    /* Pre-deploy some US units at base */
    const start = battle.mapConfig.usStart;
    _preDeployUSBase(battle, start);

    _resizeCanvas();
    GameMap.setCanvas(_ctx, _canvasW, _canvasH);
    GameMap.scrollTo(start.x, start.y);

    UI.showScreen('screen-game');
    UI.initLog();
    UI.updateReconCount(_reconRemaining);
    UI.setEl('hud-op-name',     battle.opName);
    UI.setEl('hud-battle-date', battle.date);
    _updateResourceDisplay();

    /* Clear cooldowns */
    document.querySelectorAll('.act-btn').forEach(b => b.classList.remove('on-cooldown', 'selected'));

    UI.log(`=== ${battle.name} ===`, 'event');
    UI.log('Deploy forces and achieve your objectives.', 'event');

    /* Start loop */
    _lastTime = performance.now();
    if (_rafId) cancelAnimationFrame(_rafId);
    _rafId = requestAnimationFrame(_gameLoop);
  }

  function _preDeployUSBase(battle, start) {
    /* Pool of unit types to randomly pick from */
    const pool = ['INFANTRY','INFANTRY','M60_GUNNER','SHARPSHOOTER','GRENADIER','INFANTRY'];
    const shuffle = (arr) => {
      const a = [...arr];
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    };

    /* Squad 1 — west of base */
    const sq1Types = shuffle(pool).slice(0, 4);
    const sq1Pos   = [[-2,-1],[-1,-1],[-2,0],[-1,0]];
    for (let i = 0; i < 4; i++) {
      const tx = start.x + sq1Pos[i][0], ty = start.y + sq1Pos[i][1];
      if (!GameMap.isWalkable(tx, ty, false)) continue;
      const u = Units.spawn(sq1Types[i], tx, ty, 'us');
      u.behaviorMode = 'GUARD';
      u.squadId = 1;
      u.squadLeader = (i === 0);
    }

    /* Squad 2 — east of base */
    const sq2Types = shuffle(pool).slice(0, 4);
    const sq2Pos   = [[1,-1],[2,-1],[1,0],[2,0]];
    for (let i = 0; i < 4; i++) {
      const tx = start.x + sq2Pos[i][0], ty = start.y + sq2Pos[i][1];
      if (!GameMap.isWalkable(tx, ty, false)) continue;
      const u = Units.spawn(sq2Types[i], tx, ty, 'us');
      u.behaviorMode = 'GUARD';
      u.squadId = 2;
      u.squadLeader = (i === 0);
    }
  }

  /* ── GAME LOOP ── */
  function _gameLoop(now) {
    _rafId = requestAnimationFrame(_gameLoop);
    const rawDt = (now - _lastTime) / 1000;
    _lastTime = now;
    const dt = Math.min(rawDt, 0.05);

    if (_state === 'PLAYING' && !_paused) {
      /* Timer and cooldowns always run — never blocked by system errors */
      _elapsed += dt;
      if (_strikeBanner) {
        _strikeBanner.timer -= dt;
        if (_strikeBanner.timer <= 0) _strikeBanner = null;
      }
      UI.currentTimeStr = Utils.formatTime(_elapsed);
      Combat.tickTime(dt);
      UI.updateCooldowns(dt * _gameSpeed);
      UI.updateHUD({
        opName:        Battles.get(_currentBattleIdx)?.opName,
        battleDate:    Battles.get(_currentBattleIdx)?.date,
        campaignScore: _campaignScore,
        elapsed:       _elapsed,
        resources:     _resources,
        opinion:       _publicOpinion,
      });

      /* Game systems — wrapped so a throw never freezes the HUD */
      try {
        _updateSystems(dt);
      } catch(e) {
        console.error('[GameLoop] system error:', e);
      }
    }
    _render();
  }

  function _updateSystems(dt) {
    const speed = _gameSpeed;
    const eff   = dt * speed;

    _handleScroll(eff);
    Units.update(dt, speed);
    GameMap.updateFog(Units.getAll());
    GameMap.updateSound();
    if (typeof Effects !== 'undefined') Effects.update(eff);
    Combat.autoResolve(dt, speed, (msg, type) => UI.log(msg, type));
    Combat.resolveArrivedStrikes((msg, type) => UI.log(msg, type));

    const stats = Combat.getStats();
    EnemyAI.update(dt, speed, { ...stats, elapsed: _elapsed }, (msg, type) => UI.log(msg, type));

    /* Passive resource income — 2 resources every 5 real seconds */
    _resourceTimer += dt;
    if (_resourceTimer >= 5.0) {
      _resourceTimer -= 5.0;
      _resources += 2;
      _updateResourceDisplay();
    }

    /* Enemy attack wave alert */
    const waveAlert = EnemyAI.getAttackAlert();
    if (waveAlert && !_attackAlert) {
      _attackAlert = { text: '⚠ ENEMY OFFENSIVE — ALL UNITS ALERT', timer: 5.0 };
      SoundSystem.play('alert');
    }
    if (_attackAlert) {
      _attackAlert.timer -= dt;
      if (_attackAlert.timer <= 0) _attackAlert = null;
    }

    /* Update kill/casualty HUD */
    UI.setEl('hud-kills',      String(stats.vcKilled));
    UI.setEl('hud-casualties', String(stats.usCasualties));

    /* Objective capture logic */
    _updateObjectiveCapture(eff);

    Units.getAll().filter(u => u.dead && u.faction === 'us' && !u._penalized).forEach(u => {
      u._penalized = true;
      _resources = Math.max(0, _resources - 5);
    });

    _refreshUnitInfoIfChanged();

    /* Historical in-battle event messages */
    const battle = Battles.get(_currentBattleIdx);
    if (battle && battle.historicalEvents) {
      while (_histEventIdx < battle.historicalEvents.length &&
             _elapsed >= battle.historicalEvents[_histEventIdx].time) {
        UI.log(battle.historicalEvents[_histEventIdx].msg, 'history');
        _histEventIdx++;
      }
    }

    const doctrineCanvas = document.getElementById('lstmCanvas');
    const vizData        = LSTM.getVizData();
    UI.renderDoctrineViz(doctrineCanvas, vizData);
    UI.updateDoctrinePanel(vizData);

    GameMap.renderMinimap(document.getElementById('minimapCanvas'));

    _checkBattleEnd(stats);
    _checkOpinionThresholds();
  }


  function _updateObjectiveCapture(eff) {
    const objectives = GameMap.getObjectives();
    const usAlive    = Units.getUS().filter(u => u.isAlive() && !u.flying);

    for (const obj of objectives) {
      if (obj.captured || obj.type === 'defend') continue;

      const key = obj.name;
      if (!_captureState[key]) _captureState[key] = 0;
      if (!_capReinforceTimer[key]) _capReinforceTimer[key] = 0;

      const nearby = usAlive.filter(u => Utils.dist(u.tx, u.ty, obj.x, obj.y) <= 4);

      if (nearby.length > 0) {
        _captureState[key] = Math.min(1, _captureState[key] + eff * 0.08 * nearby.length);

        /* Spawn VC reinforcements to contest — throttled */
        _capReinforceTimer[key] -= eff;
        if (_capReinforceTimer[key] <= 0 && _captureState[key] > 0.1) {
          _capReinforceTimer[key] = 18; /* respawn every 18 game-seconds */
          const vcTypes = ['VC_SQUAD','NVA_REG','VC_RPG','VC_RPK'];
          for (let i = 0; i < 3; i++) {
            const angle = Math.random() * Math.PI * 2;
            const dist  = 6 + Math.random() * 4;
            const tx    = Math.round(obj.x + Math.cos(angle) * dist);
            const ty    = Math.round(obj.y + Math.sin(angle) * dist);
            if (GameMap.isWalkable(tx, ty, false)) {
              const vType = vcTypes[Math.floor(Math.random() * vcTypes.length)];
              const v = Units.spawn(vType, tx, ty, 'vc');
              v.alertLevel = 1; v.hidden = false; v.detected = true;
              v.moveTo(obj.x, obj.y);
            }
          }
          UI.log(`Enemy reinforcing ${obj.name}!`, 'warn');
        }

        if (_captureState[key] >= 1.0) {
          obj.captured = true;
          UI.log(`OBJECTIVE SECURED: ${obj.name}!`, 'us');
          _modifyOpinion(4, 'Objective secured');
          _campaignScore += 500;
          SoundSystem.play('deploy');
        }
      } else {
        /* Decay slowly when uncontested */
        _captureState[key] = Math.max(0, _captureState[key] - eff * 0.03);
      }
    }
  }

  function _refreshUnitInfoIfChanged() {
    const u = _selectedUnit?.isAlive() ? _selectedUnit : null;
    const id  = u?.id ?? null;
    const hp  = u?.hp ?? -1;
    const st  = u?.state ?? '';
    const bm  = u?.behaviorMode ?? '';
    const pc  = u?.patrolWaypoints?.length ?? 0;
    const c   = _unitInfoCache;
    if (id !== c.id || hp !== c.hp || st !== c.state || bm !== c.behavior || pc !== c.patrolCount) {
      c.id = id; c.hp = hp; c.state = st; c.behavior = bm; c.patrolCount = pc;
      UI.updateUnitInfo(u);
    }
  }

  function _render() {
    if (!_ctx) return;
    _ctx.clearRect(0, 0, _canvasW, _canvasH);

    /* Screen shake */
    const shake = (typeof Effects !== 'undefined') ? Effects.getShake() : { x: 0, y: 0 };
    _ctx.save();
    _ctx.translate(shake.x, shake.y);

    /* Map tiles */
    GameMap.render(_ctx);

    /* Units */
    Units.render(_ctx, _selectedUnit?.id);

    /* Particle effects */
    if (typeof Effects !== 'undefined') Effects.render(_ctx, GameMap.vpX, GameMap.vpY);

    _ctx.restore();

    /* Overlay canvas (cursor mode indicator) */
    if (_overlayCtx) {
      _overlayCtx.clearRect(0, 0, _canvasW, _canvasH);
      _renderOverlay(_overlayCtx);
    }
  }

  function _renderOverlay(ctx) {
    const T = CONFIG.TILE;

    /* Patrol waypoint markers for selected unit */
    if (_selectedUnit && _selectedUnit.patrolWaypoints.length > 0) {
      ctx.save();
      ctx.strokeStyle = '#44ffaa';
      ctx.fillStyle   = 'rgba(68,255,170,0.25)';
      ctx.lineWidth   = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      for (let i = 0; i < _selectedUnit.patrolWaypoints.length; i++) {
        const wp = _selectedUnit.patrolWaypoints[i];
        const sc = GameMap.tileToScreen(wp.x, wp.y);
        const px = sc.x + T / 2, py = sc.y + T / 2;
        i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
      }
      /* Close loop */
      if (_selectedUnit.patrolWaypoints.length > 1) {
        const first = _selectedUnit.patrolWaypoints[0];
        const sc0   = GameMap.tileToScreen(first.x, first.y);
        ctx.lineTo(sc0.x + T / 2, sc0.y + T / 2);
      }
      ctx.stroke();
      ctx.setLineDash([]);

      /* Diamond markers at each waypoint */
      _selectedUnit.patrolWaypoints.forEach((wp, i) => {
        const sc = GameMap.tileToScreen(wp.x, wp.y);
        const px = sc.x + T / 2, py = sc.y + T / 2;
        ctx.fillStyle = i === _selectedUnit.patrolIdx % _selectedUnit.patrolWaypoints.length
          ? '#ffff44' : '#44ffaa';
        ctx.beginPath();
        ctx.moveTo(px, py - 6); ctx.lineTo(px + 6, py);
        ctx.lineTo(px, py + 6); ctx.lineTo(px - 6, py);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = 'rgba(0,0,0,0.8)';
        ctx.font = 'bold 8px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(i + 1, px, py);
      });
      ctx.restore();
    }

    if (_patrolMarkMode) {
      const t     = Date.now() * 0.004;
      const alpha = 0.06 + 0.03 * Math.sin(t);
      ctx.fillStyle = `rgba(68,255,170,${alpha})`;
      ctx.fillRect(0, 0, _canvasW, _canvasH);
      ctx.fillStyle = '#44ffaa';
      ctx.font = 'bold 13px Oswald, monospace';
      ctx.textAlign = 'center';
      ctx.fillText('PATROL MODE — Click to add waypoints · Right-click to finish', _canvasW / 2, 24);
    } else if (_actionMode) {
      /* Pulsing "targeting" overlay */
      const t     = Date.now() * 0.003;
      const alpha = 0.08 + 0.04 * Math.sin(t);
      ctx.fillStyle = `rgba(200,130,10,${alpha})`;
      ctx.fillRect(0, 0, _canvasW, _canvasH);

      /* Banner */
      ctx.fillStyle = 'rgba(200,130,10,0.9)';
      ctx.font = 'bold 13px Oswald, monospace';
      ctx.textAlign = 'center';
      const actionName = (CONFIG.UNITS[_actionMode]?.name || _actionMode).toUpperCase();
      ctx.fillText(`TARGETING: ${actionName} — Right-click to cancel`, _canvasW / 2, 24);
    }

    if (_paused) {
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(0, 0, _canvasW, _canvasH);
      ctx.fillStyle = '#c8820a';
      ctx.font = 'bold 32px Oswald, monospace';
      ctx.textAlign = 'center';
      ctx.fillText('⏸  PAUSED', _canvasW / 2, _canvasH / 2);
    }

    /* Strike inbound banner */
    if (_strikeBanner && _strikeBanner.timer > 0) {
      const frac  = _strikeBanner.timer / 3.0;
      const pulse = 0.7 + 0.3 * Math.sin(Date.now() * 0.01);
      ctx.save();
      ctx.globalAlpha = Math.min(1, frac * 2) * pulse;
      ctx.fillStyle = 'rgba(220,40,40,0.85)';
      ctx.fillRect(0, _canvasH / 2 - 32, _canvasW, 64);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 26px Oswald, monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = '#ff0000';
      ctx.shadowBlur  = 18;
      ctx.fillText(_strikeBanner.text, _canvasW / 2, _canvasH / 2);
      ctx.restore();
    }

    /* Enemy attack wave alert */
    if (_attackAlert && _attackAlert.timer > 0) {
      const frac  = Math.min(1, _attackAlert.timer / 5.0);
      const pulse = 0.6 + 0.4 * Math.sin(Date.now() * 0.015);
      ctx.save();
      ctx.globalAlpha = frac * pulse;
      ctx.fillStyle = 'rgba(200,10,10,0.8)';
      ctx.fillRect(0, 52, _canvasW, 44);
      ctx.fillStyle = '#ffdddd';
      ctx.font = 'bold 20px Oswald, monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = '#ff0000'; ctx.shadowBlur = 12;
      ctx.fillText(_attackAlert.text, _canvasW / 2, 74);
      ctx.restore();
    }

    /* Objective capture progress bars */
    const objectives = GameMap.getObjectives();
    let barY = _canvasH - 90;
    for (const obj of objectives) {
      if (obj.captured || obj.type === 'defend') continue;
      const prog = _captureState[obj.name] || 0;
      if (prog <= 0) continue;
      ctx.save();
      const barW = 180, barH = 14;
      const bx   = _canvasW - barW - 16;
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillRect(bx - 4, barY - 4, barW + 8, barH + 20);
      ctx.fillStyle = '#888';
      ctx.fillRect(bx, barY + 12, barW, barH - 8);
      ctx.fillStyle = prog > 0.7 ? '#44ff88' : '#c8820a';
      ctx.fillRect(bx, barY + 12, barW * prog, barH - 8);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 9px Share Tech Mono, monospace';
      ctx.textAlign = 'left';
      ctx.fillText(`CAPTURING: ${obj.name.toUpperCase()} — ${Math.round(prog*100)}%`, bx, barY + 10);
      ctx.restore();
      barY -= 38;
    }
  }

  /* ── INPUT HANDLERS ── */
  function _handleActionButtonClick(action) {
    if (_state !== 'PLAYING' || _paused) return;

    /* Normalize key: buttons use lowercase, CONFIG uses UPPERCASE */
    const actionKey = action.toUpperCase();

    /* Check resources */
    const def = CONFIG.UNITS[actionKey];
    const cost = def?.cost || 0;
    if (cost > 0 && _resources < cost) {
      UI.log(`Insufficient resources (need ${cost})`, 'warn');
      SoundSystem.play('alert');
      return;
    }

    /* Check cooldown */
    const cdKey = actionKey.toLowerCase();
    if (UI.isOnCooldown(cdKey)) {
      UI.log('Still on cooldown', 'warn');
      return;
    }

    /* Recon: count-limited */
    if (action === 'recon' && _reconRemaining <= 0) {
      UI.log('No recon teams remaining', 'warn');
      SoundSystem.play('alert');
      return;
    }

    /* Toggle action mode */
    if (_actionMode === actionKey) {
      _actionMode = null;
      UI.setActionSelected(action, false);
    } else {
      _actionMode = actionKey;
      UI.setActionSelected(action, true);
    }
  }

  function _onCanvasClick(e) {
    if (_state !== 'PLAYING') return;
    const rect = _canvas.getBoundingClientRect();
    const sx   = e.clientX - rect.left;
    const sy   = e.clientY - rect.top;
    const tile = GameMap.screenToTile(sx, sy);

    /* Patrol waypoint marking mode */
    if (_patrolMarkMode && _selectedUnit && _selectedUnit.isAlive()) {
      const wp = { x: tile.x, y: tile.y };
      _selectedUnit.patrolWaypoints.push(wp);
      _selectedUnit.behaviorMode = 'PATROL';
      /* Add same waypoint to squad members — do NOT reset _patrolPause or patrolIdx here */
      if (_selectedUnit.squadId !== null) {
        Units.getUS().filter(u => u.id !== _selectedUnit.id && u.squadId === _selectedUnit.squadId && u.isAlive())
          .forEach(u => { u.patrolWaypoints.push({ ...wp }); u.behaviorMode = 'PATROL'; });
      }
      _unitInfoCache.id = null;
      UI.updateUnitInfo(_selectedUnit);
      UI.log(`Patrol waypoint ${_selectedUnit.patrolWaypoints.length} set at [${tile.x},${tile.y}]`, 'us');
      SoundSystem.play('uiClick');
      return;
    }

    /* Action mode (deploying units/strikes) */
    if (_actionMode) {
      _executeAction(_actionMode, tile.x, tile.y);
      _hideContextMenu();
      return;
    }

    /* No action mode — handle unit interaction */
    const clicked = Units.atTile(tile.x, tile.y);

    if (_selectedUnit && _selectedUnit.isAlive() && _selectedUnit.faction === 'us') {
      /* Attack order on enemy */
      if (clicked && clicked.faction === 'vc' && clicked.isAlive()) {
        _selectedUnit.moveTo(Math.round(clicked.tx), Math.round(clicked.ty));
        _selectedUnit.target = clicked;
        UI.log(`${_selectedUnit.name}: attack order`, 'us');
        SoundSystem.play('deploy');
        _hideContextMenu();
        return;
      }
      /* Select a different friendly unit */
      if (clicked && clicked.faction === 'us') {
        _selectedUnit = clicked;
        _unitInfoCache.id = null;
        UI.updateUnitInfo(clicked);
        SoundSystem.play('uiClick');
        _hideContextMenu();
        return;
      }
      /* Move order — left-click on walkable tile */
      if (GameMap.isWalkable(tile.x, tile.y, _selectedUnit.flying)) {
        _selectedUnit.moveTo(tile.x, tile.y);
        /* Squad members get staggered offsets around the destination */
        _moveSquadWith(_selectedUnit, tile.x, tile.y);
        SoundSystem.play('deploy');
        _hideContextMenu();
        return;
      }
    }

    /* No selection or clicked empty space — try to select a unit */
    _trySelectUnit(tile.x, tile.y);
    _hideContextMenu();
  }

  function _onRightClick(e) {
    const rect = _canvas.getBoundingClientRect();
    const sx   = e.clientX - rect.left;
    const sy   = e.clientY - rect.top;
    const tile = GameMap.screenToTile(sx, sy);

    if (_patrolMarkMode) {
      _patrolMarkMode = false;
      if (_selectedUnit && _selectedUnit.patrolWaypoints.length > 0) {
        /* Reset all units in the squad and immediately send them to waypoint 0 */
        const kickPatrol = (u) => {
          u.patrolIdx    = 0;
          u._patrolDwell = 0;   /* reset dwell timer so first waypoint is fresh */
          u.behaviorMode = 'PATROL';
          u.stopMoving();

          /* Immediately kick off movement — don't wait for next IDLE update tick */
          const wp = u.patrolWaypoints[0];
          if (!wp) return;
          let wx = wp.x, wy = wp.y;
          if (u.squadId !== null && !u.squadLeader) {
            const h  = (u.id * 2654435769) >>> 0;
            const ox = ((h & 3) - 1), oy = (((h >> 2) & 3) - 1);
            if (GameMap.isWalkable(wp.x + ox, wp.y + oy, false)) {
              wx = wp.x + ox; wy = wp.y + oy;
            }
          }
          if (Utils.dist(u.tx, u.ty, wx, wy) >= 1.2) u.moveTo(wx, wy);
        };
        kickPatrol(_selectedUnit);
        if (_selectedUnit.squadId !== null) {
          Units.getUS()
            .filter(u => u.id !== _selectedUnit.id && u.squadId === _selectedUnit.squadId && u.isAlive())
            .forEach(kickPatrol);
        }
      }
      if (_selectedUnit) UI.updateUnitInfo(_selectedUnit);
      UI.log('Patrol route set — heading to waypoint 1.', 'event');
      return;
    }

    if (_actionMode) {
      /* Cancel action */
      _actionMode = null;
      UI.setActionSelected(null, false);
      return;
    }

    if (_selectedUnit) {
      /* Move selected unit */
      const u = _selectedUnit;
      if (u.faction === 'us' && u.isAlive()) {
        /* Check if clicking on enemy */
        const target = Units.atTile(tile.x, tile.y);
        if (target && target.faction === 'vc' && target.isAlive()) {
          /* Attack order */
          u.moveTo(Math.round(target.tx), Math.round(target.ty));
          u.target = target;
          UI.log(`${u.name}: attack order on ${target.name}`, 'us');
          SoundSystem.play('deploy');
        } else if (GameMap.isWalkable(tile.x, tile.y, u.flying)) {
          u.moveTo(tile.x, tile.y);
          /* Also move squad members when right-clicking a squad leader */
          if (u.squadLeader) _moveSquadWith(u, tile.x, tile.y);
          SoundSystem.play('deploy');
        } else {
          UI.log('Cannot move there — terrain blocked', 'warn');
        }
      }
    } else {
      _showContextMenu(e.clientX, e.clientY, tile);
    }
  }

  function _onMouseMove(e) {
    const rect = _canvas.getBoundingClientRect();
    const sx   = e.clientX - rect.left;
    const sy   = e.clientY - rect.top;
    const tile = GameMap.screenToTile(sx, sy);

    /* Update coordinate crosshair in action mode */
    const ch = document.getElementById('coord-crosshair');
    const cl = document.getElementById('coord-label');
    if (_actionMode && ch) {
      ch.classList.remove('hidden');
      ch.style.left = sx + 'px';
      ch.style.top  = sy + 'px';
      if (cl) cl.textContent = `X:${tile.x} Y:${tile.y}`;
    } else if (ch) {
      ch.classList.add('hidden');
    }
  }

  function _onWheel(e) {
    GameMap.scrollBy(e.deltaX * 0.5, e.deltaY * 0.5);
    GameMap.clampViewport();
  }

  function _onKeyDown(e) {
    if (e.key === 'Escape') {
      _actionMode = null;
      _patrolMarkMode = false;
      UI.setActionSelected(null, false);
      _selectedUnit = null;
      UI.updateUnitInfo(null);
      _hideContextMenu();
    }
    if (e.key === ' ') { e.preventDefault(); togglePause(); }
    if (e.key === 'Tab') { e.preventDefault(); _cycleSelectedUnit(); }

    /* Ctrl+1-4: select all units in that squad */
    if (e.ctrlKey && e.key >= '1' && e.key <= '4') {
      e.preventDefault();
      const sid = parseInt(e.key);
      const squad = Units.getUS().filter(u => u.squadId === sid && u.isAlive());
      if (squad.length) {
        _selectedUnit = squad[0];
        _unitInfoCache.id = null;
        UI.updateUnitInfo(_selectedUnit);
        GameMap.scrollTo(Math.round(_selectedUnit.tx), Math.round(_selectedUnit.ty));
        UI.log(`Squad ${sid} selected — ${squad.length} unit(s)`, 'us');
        SoundSystem.play('uiClick');
      }
    }
  }

  function _handleScroll(dt) {
    const spd = 200 * dt;
    if (_keys['ArrowLeft']  || _keys['a']) GameMap.scrollBy(-spd, 0);
    if (_keys['ArrowRight'] || _keys['d']) GameMap.scrollBy(spd, 0);
    if (_keys['ArrowUp']    || _keys['w']) GameMap.scrollBy(0, -spd);
    if (_keys['ArrowDown']  || _keys['s']) GameMap.scrollBy(0, spd);
    GameMap.clampViewport();
  }

  /* ── ACTION EXECUTION ── */
  function _executeAction(typeId, tx, ty) {
    const def  = CONFIG.UNITS[typeId];
    if (!def)  return;
    const cost = def.cost || 0;

    if (cost > 0 && _resources < cost) {
      UI.log(`Not enough resources (need ${cost})`, 'warn');
      SoundSystem.play('alert');
      _actionMode = null;
      UI.setActionSelected(null, false);
      return;
    }

    let success = false;

    if (def.oneshot) {
      /* Strike weapons */
      success = Combat.launchStrike(typeId, tx, ty, (msg, t) => UI.log(msg, t));
    } else if (typeId === 'RECON') {
      /* Recon: always spawn at base camp and pathfind to target so fog is no obstacle */
      const battle = Battles.get(_currentBattleIdx);
      const start  = battle?.mapConfig?.usStart || { x: tx, y: ty };
      const spawnX = Math.round(start.x);
      const spawnY = Math.round(start.y);
      const u = Units.spawn('RECON', spawnX, spawnY, 'us');
      u.moveTo(tx, ty);
      Combat.getStats(); /* trigger stats update */
      Combat._reconCount = (Combat._reconCount || 0) + 1;
      success = true;
      _selectedUnit = u;
      UI.log(`Recon team deployed — moving to [${tx},${ty}]`, 'us');
    } else {
      /* Deployable units — must be placed within base deploy zone */
      if (_baseStart) {
        const d = Utils.dist(tx, ty, _baseStart.x, _baseStart.y);
        if (d > 4.5) {
          UI.log('Deploy within the base zone (blue circle)', 'warn');
          SoundSystem.play('alert');
          return;
        }
      }
      if (!GameMap.isWalkable(tx, ty, def.flying)) {
        UI.log('Cannot deploy there — impassable terrain', 'warn');
        return;
      }
      const u = Combat.deployUnit(typeId, tx, ty, (msg, t) => UI.log(msg, t));
      if (u) {
        success = true;
        _selectedUnit = u;
      }
    }

    if (success) {
      _resources -= cost;
      _updateResourceDisplay();

      if (typeId === 'RECON') {
        _reconRemaining--;
        UI.updateReconCount(_reconRemaining);
      }

      /* Opinion damage for certain weapons */
      if (typeId === 'AGENT_ORANGE') {
        _modifyOpinion(-8, 'Agent Orange use detected by press');
      }
      if (typeId === 'NAPALM') {
        _modifyOpinion(-4, 'Napalm strike reported in media');
      }

      /* Show a flash banner for air strikes so player knows the plane is inbound */
      if (['AIRSTRIKE','NAPALM','AGENT_ORANGE','NAVAL'].includes(typeId)) {
        const labels = { AIRSTRIKE:'✈ AIR STRIKE INBOUND', NAPALM:'🔥 NAPALM INBOUND',
                         AGENT_ORANGE:'☁ AGENT ORANGE INBOUND', NAVAL:'💥 NAVAL BOMBARDMENT' };
        _strikeBanner = { text: labels[typeId] || 'STRIKE INBOUND', timer: 3.0 };
      }

      SoundSystem.play('deploy');
      UI.startCooldown(typeId.toLowerCase(), CONFIG.UNITS[typeId]?.cdSec || 10);
    }

    /* Return to normal mode */
    _actionMode = null;
    UI.setActionSelected(null, false);
  }

  function _moveSquadWith(leader, tx, ty) {
    if (leader.squadId === null) return;
    const offsets = [[-1,0],[1,0],[0,1],[-1,1],[1,1],[0,-1]];
    Units.getUS()
      .filter(u => u.id !== leader.id && u.squadId === leader.squadId && u.isAlive())
      .forEach((u, i) => {
        const [ox, oy] = offsets[i % offsets.length];
        const nx = tx + ox, ny = ty + oy;
        u.moveTo(GameMap.isWalkable(nx, ny, u.flying) ? nx : tx,
                 GameMap.isWalkable(nx, ny, u.flying) ? ny : ty);
      });
  }

  function _trySelectUnit(tx, ty) {
    const u = Units.atTile(tx, ty);
    if (u && u.faction === 'us' && u.isAlive()) {
      _selectedUnit = u;
      _unitInfoCache.id = null; /* force redraw */
      UI.updateUnitInfo(u);
      SoundSystem.play('uiClick');
    } else {
      _selectedUnit = null;
      _unitInfoCache.id = null;
      UI.updateUnitInfo(null);
    }
  }

  function _cycleSelectedUnit() {
    const usUnits = Units.getUS();
    if (!usUnits.length) return;
    if (!_selectedUnit) {
      _selectedUnit = usUnits[0];
    } else {
      const idx = usUnits.findIndex(u => u.id === _selectedUnit.id);
      _selectedUnit = usUnits[(idx + 1) % usUnits.length];
    }
    _unitInfoCache.id = null;
    UI.updateUnitInfo(_selectedUnit);
    if (_selectedUnit) GameMap.scrollTo(Math.round(_selectedUnit.tx), Math.round(_selectedUnit.ty));
  }

  /* ── CONTEXT MENU ── */
  function _showContextMenu(sx, sy, tile) {
    const menu = document.getElementById('context-menu');
    if (!menu) return;
    menu.style.left = sx + 'px';
    menu.style.top  = sy + 'px';
    menu.classList.remove('hidden');

    const title = document.getElementById('ctx-title');
    if (title) title.textContent = `[${tile.x},${tile.y}] ${GameMap.getTileConfig(tile.x,tile.y)?.name || ''}`;

    const acts = document.getElementById('ctx-actions');
    if (!acts) return;
    acts.innerHTML = '';

    const options = [
      { label: '🔭 Deploy Recon Here', action: () => { _actionMode = 'RECON'; _executeAction('RECON', tile.x, tile.y); } },
      { label: '💥 Artillery Strike', action: () => { _actionMode = 'ARTILLERY'; _executeAction('ARTILLERY', tile.x, tile.y); } },
    ];
    for (const opt of options) {
      const div = document.createElement('div');
      div.className = 'ctx-action';
      div.textContent = opt.label;
      div.addEventListener('click', () => { opt.action(); _hideContextMenu(); });
      acts.appendChild(div);
    }
  }

  function _hideContextMenu() {
    document.getElementById('context-menu')?.classList.add('hidden');
  }

  /* ── WIN/LOSS CHECKING ── */
  function _checkBattleEnd(stats) {
    const battle = Battles.get(_currentBattleIdx);
    if (!battle) return;
    const win = battle.winCondition;
    const loss = battle.lossCondition;

    /* Check objectives captured */
    const objs     = GameMap.getObjectives();
    const captured = objs.filter(o => o.captured).length;

    /* Loss conditions */
    if (loss.usCasualties && stats.usCasualties >= loss.usCasualties) {
      _endBattle(false, 'Too many casualties — withdrawal ordered');
      return;
    }
    if (loss.timeLimit && _elapsed >= loss.timeLimit) {
      if (!win.survivalMode) {
        _endBattle(false, 'Time expired — mission failed');
        return;
      }
    }
    if (loss.opinionDrop && CONFIG.OPINION_START - _publicOpinion >= loss.opinionDrop) {
      _endBattle(false, 'Public support collapsed — mission aborted');
      return;
    }

    /* Win conditions */
    if (win.survivalMode && win.timeLimit && _elapsed >= win.timeLimit) {
      _endBattle(true, 'Objective held — mission complete');
      return;
    }
    if (win.objectives && captured >= win.objectives) {
      if (!win.vcKills || stats.vcKilled >= win.vcKills) {
        _endBattle(true, 'Objectives secured — mission complete');
        return;
      }
    }
    /* Fallback: all VC dead — guard against firing before VC even spawn */
    if (_elapsed > 5 && Units.getVC().filter(v => v.isAlive()).length === 0) {
      _endBattle(true, 'All enemy forces eliminated');
    }
  }

  function _endBattle(victory, reason) {
    if (_state !== 'PLAYING') return;
    _state = 'POST_BATTLE';

    if (_rafId) cancelAnimationFrame(_rafId);

    const stats  = Combat.getStats();
    const battle = Battles.get(_currentBattleIdx);

    /* Score */
    let score = 0;
    score += stats.vcKilled * CONFIG.SCORE.ENEMY_KILL;
    score -= stats.usCasualties * CONFIG.SCORE.US_CASUALTY;
    score -= stats.civilianKills * CONFIG.SCORE.CIVILIAN_KILL;
    if (victory) score += CONFIG.SCORE.BATTLE_WIN;
    else         score += CONFIG.SCORE.BATTLE_LOSS;
    /* Time bonus */
    if (victory) {
      const timeBonus = Math.max(0, CONFIG.SCORE.TIME_BONUS_MAX - Math.floor(_elapsed / 10) * 50);
      score += timeBonus;
    }
    _campaignScore += score;

    /* Update doctrine campaign experience */
    EnemyAI.onBattleEnd(!victory, stats);

    /* Ablation */
    const ablation = LSTM.ablationTest();

    /* Determine result label */
    let result;
    if (victory && stats.usCasualties < 10) {
      result = { label: 'DECISIVE VICTORY', css: 'victory' };
    } else if (victory) {
      result = { label: 'PYRRHIC VICTORY', css: 'pyrrhic' };
    } else {
      result = { label: 'MISSION FAILED', css: 'defeat' };
    }

    UI.log(`=== ${reason} ===`, 'event');
    SoundSystem.play(victory ? 'victory' : 'defeat');

    setTimeout(() => {
      UI.showPostBattle(result, battle, stats, ablation);
    }, 1000);
  }

  /* ── NEXT BATTLE ── */
  function nextBattle() {
    _currentBattleIdx++;
    if (_currentBattleIdx >= Battles.count()) {
      _showVictory();
    } else {
      _showCurrentBriefing();
    }
  }

  function _showVictory() {
    /* Show final screen — for now reuse menu */
    UI.showScreen('screen-menu');
    setTimeout(() => {
      alert(`CAMPAIGN COMPLETE!\n\nFinal Score: ${Utils.formatScore(_campaignScore)}\nPublic Opinion: ${Math.round(_publicOpinion)}%\n\nThe Vietnam War ended with the Fall of Saigon on April 30, 1975.\n58,220 Americans gave their lives. Over 2 million Vietnamese civilians perished.\n\nHistory is not a game — but understanding it is essential.`);
    }, 500);
  }

  /* ── OPINION / ANTI-WAR EVENTS ── */
  function _modifyOpinion(delta, reason) {
    const prev = _publicOpinion;
    _publicOpinion = Utils.clamp(_publicOpinion + delta, 0, 100);
    if (reason && Math.abs(delta) >= 2) UI.log(`Opinion: ${Math.round(_publicOpinion)}% (${delta>0?'+':''}${Math.round(delta)}% — ${reason})`, 'event');
  }

  function _checkOpinionThresholds() {
    for (const event of CONFIG.ANTIWAR_EVENTS) {
      if (_triggeredThresholds.has(event.threshold)) continue;
      if (_publicOpinion <= event.threshold) {
        _triggeredThresholds.add(event.threshold);
        _campaignScore -= event.scorePenalty;
        togglePause(); /* Pause while showing event */
        UI.showAntiwarEvent(event);
        SoundSystem.play('opinionDrop');
      }
    }
  }

  /* ── MISC ── */
  function togglePause() {
    _paused = !_paused;
    const btn = document.getElementById('btn-pause');
    if (btn) btn.textContent = _paused ? '▶' : '⏸';
    if (btn) btn.classList.toggle('active', _paused);
  }

  function _updateResourceDisplay() {
    UI.setEl('hud-resources', Math.round(_resources));
  }

  return {
    init, startCampaign, launchBattle, nextBattle, togglePause,
  };
})();
