/* ============================================================
   UI — Screen management, HUD updates, modals, LSTM visualization
   ============================================================ */
const UI = (() => {

  /* ── SCREEN MANAGEMENT ── */
  function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const el = document.getElementById(id);
    if (el) el.classList.add('active');
  }

  function showModal(id) {
    const el = document.getElementById(id);
    if (el) el.classList.remove('hidden');
  }

  function hideModal(id) {
    const el = document.getElementById(id);
    if (el) el.classList.add('hidden');
  }

  /* ── LOADING SCREEN ── */
  const LOADING_STEPS = [
    'Initializing LSTM neural network...',
    'Loading terrain generation algorithms...',
    'Processing historical battle data...',
    'Spawning enemy AI units...',
    'Calibrating fog of war systems...',
    'Loading declassified documents...',
    'Preparing campaign timeline...',
    'Systems ready.',
  ];

  function showLoading(onDone) {
    showScreen('screen-loading');
    const bar  = document.getElementById('loading-bar');
    const status = document.getElementById('loading-status');
    const fact   = document.getElementById('loading-fact');

    const facts = [
      '58,220 American military personnel died in the Vietnam War.',
      'The war lasted 19 years and 5 months (1955–1975).',
      'An estimated 2 million Vietnamese civilians died during the war.',
      'Over 500,000 tons of napalm were dropped by US forces.',
      'The Viet Cong tunnel system stretched over 250 kilometers.',
      'Over 3.4 million Americans served in Southeast Asia during the war.',
      'The Gulf of Tonkin Resolution passed 416-0 in the House and 88-2 in the Senate.',
      'At peak involvement (April 1969), 543,482 US troops were in Vietnam.',
      'The average age of US soldiers killed in Vietnam was 23.11 years.',
      'Agent Orange contaminated over 4.8 million acres of Vietnamese land.',
      'The US spent $168 billion on the Vietnam War (equivalent to over $1 trillion today).',
      'Ho Chi Minh declared Vietnamese independence on September 2, 1945 — citing the US Declaration of Independence.',
      'The Tet Offensive launched simultaneous attacks on 108 cities and bases on January 31, 1968.',
      'Walter Cronkite called the war a "stalemate" in 1968 — Johnson reportedly said if he\'d lost Cronkite, he\'d lost America.',
      'The Pentagon Papers, leaked by Daniel Ellsberg in 1971, revealed the government had systematically deceived Congress.',
      'The Paris Peace Accords were signed January 27, 1973 — US combat troops left by March 29, 1973.',
      'Saigon fell to North Vietnamese forces April 30, 1975, ending the war.',
    ];

    fact.textContent = `"${Utils.randChoice(facts)}"`;

    let step = 0;
    const interval = setInterval(() => {
      if (step >= LOADING_STEPS.length) {
        clearInterval(interval);
        setTimeout(onDone, 400);
        return;
      }
      const pct = ((step + 1) / LOADING_STEPS.length) * 100;
      bar.style.width = pct + '%';
      status.textContent = LOADING_STEPS[step];
      step++;
    }, 180);
  }

  /* ── BRIEFING SCREEN ── */
  function showBriefing(battle, battleNum, totalBattles, aiAdaptations) {
    document.getElementById('brief-op-name').textContent   = battle.opName;
    document.getElementById('brief-battle-name').textContent = battle.name;
    document.getElementById('brief-date').textContent      = battle.date;
    document.getElementById('brief-situation').textContent = battle.situation;
    document.getElementById('brief-history').textContent   = battle.history;
    document.getElementById('brief-intel').textContent     = battle.intel;
    document.getElementById('brief-terrain').textContent   = battle.terrain;
    document.getElementById('brief-battle-num').textContent =
      `Engagement ${battleNum + 1} of ${totalBattles}`;

    /* Objectives */
    const ol = document.getElementById('brief-objectives');
    ol.innerHTML = '';
    for (const obj of battle.objectives) {
      const li = document.createElement('li');
      li.textContent = obj;
      ol.appendChild(li);
    }

    /* Assets */
    const ad = document.getElementById('brief-assets');
    ad.innerHTML = '';
    const a = battle.assets;
    const chips = [
      ['Infantry', a.infantry],
      ['Artillery', a.artillery],
      ['Armor',     a.armor],
      ['Helicopters', a.helicopter],
      ['Recon Teams', a.recon],
      ['Air Strikes',  a.airstrike],
      ['Napalm Strikes', a.napalm],
    ];
    for (const [label, val] of chips) {
      if (!val) continue;
      const chip = document.createElement('div');
      chip.className = 'asset-chip';
      chip.innerHTML = `${label}: <span>${val}</span>`;
      ad.appendChild(chip);
    }

    /* AI note */
    const aiNote = document.getElementById('brief-ai-note');
    if (aiAdaptations === 0) {
      aiNote.textContent = 'LSTM has no prior battle data. Enemy will use basic guerrilla tactics.';
    } else {
      aiNote.textContent = `LSTM has ${aiAdaptations} adaptation${aiAdaptations > 1 ? 's' : ''}. ${battle.aiNote}`;
    }

    showScreen('screen-briefing');
  }

  /* ── GAME HUD ── */
  function updateHUD(state) {
    setEl('hud-op-name',       state.opName || '--');
    setEl('hud-battle-date',   state.battleDate || '--');
    setEl('hud-campaign-score',Utils.formatScore(state.campaignScore || 0));
    setEl('hud-time',          Utils.formatTime(state.elapsed || 0));
    setEl('hud-resources',     Math.round(state.resources || 0));
    updateOpinion(state.opinion || 100);
  }

  function updateOpinion(pct) {
    const fill   = document.getElementById('opinion-fill');
    const text   = document.getElementById('opinion-text');
    const status = document.getElementById('opinion-status');
    if (!fill) return;

    const clamped = Utils.clamp(pct, 0, 100);
    fill.style.width = clamped + '%';
    fill.style.backgroundPosition = `${100 - clamped}% 0%`;
    text.textContent = Math.round(clamped) + '%';

    let label;
    if (clamped >= 80) label = 'Support: Strong';
    else if (clamped >= 60) label = 'Support: Moderate';
    else if (clamped >= 40) label = 'Support: Weak';
    else if (clamped >= 20) label = 'Support: Collapsing';
    else                    label = 'Support: NONE';
    status.textContent = label;
  }

  function updateReconCount(n) {
    setEl('recon-count', `${n} left`);
    const btn = document.querySelector('[data-action="recon"]');
    if (btn) btn.disabled = n <= 0;
  }

  /* ── ACTION BUTTONS + COOLDOWNS ── */
  const _cooldowns = {};

  function startCooldown(actionId, durationSec) {
    _cooldowns[actionId] = { elapsed: 0, total: durationSec };
    const cdEl = document.getElementById(`cd-${actionId}`);
    if (cdEl) {
      cdEl.style.transform = 'scaleX(1)';
      cdEl.style.transition = 'none';
    }
    const btn = document.querySelector(`[data-action="${actionId}"]`);
    if (btn) btn.classList.add('on-cooldown');
  }

  function updateCooldowns(dt) {
    for (const [id, cd] of Object.entries(_cooldowns)) {
      cd.elapsed += dt;
      const cdEl = document.getElementById(`cd-${id}`);
      const pct  = Utils.clamp(1 - cd.elapsed / cd.total, 0, 1);
      if (cdEl) {
        cdEl.style.transform = `scaleX(${pct})`;
        cdEl.style.transition = 'transform 0.1s linear';
      }
      if (cd.elapsed >= cd.total) {
        delete _cooldowns[id];
        const btn = document.querySelector(`[data-action="${id}"]`);
        if (btn) btn.classList.remove('on-cooldown');
      }
    }
  }

  function isOnCooldown(actionId) {
    return !!_cooldowns[actionId];
  }

  function setActionSelected(actionId, selected) {
    document.querySelectorAll('.act-btn').forEach(b => b.classList.remove('selected'));
    if (selected) {
      const btn = document.querySelector(`[data-action="${actionId}"]`);
      if (btn) btn.classList.add('selected');
    }
  }

  /* ── UNIT INFO PANEL ── */
  function updateUnitInfo(unit) {
    const panel = document.getElementById('unit-info');
    if (!panel) return;

    if (!unit) {
      panel.innerHTML = '<div class="no-select-msg">Click a unit to inspect</div>';
      return;
    }

    const info = unit.getInfo();
    const hpPct  = Math.round((info.hp / info.maxHp) * 100);
    const morPct = Math.round((info.morale / info.maxMorale) * 100);
    const bm     = info.behaviorMode || 'GUARD';

    const behaviorHtml = unit.faction === 'us' ? `
      <div class="uc-behavior-row">
        <button class="uc-bmode-btn${bm==='GUARD'  ?' active':''}" onclick="GAME_setBehavior('GUARD')"   title="Hold position">🛡 Guard</button>
        <button class="uc-bmode-btn${bm==='PATROL' ?' active':''}" onclick="GAME_setBehavior('PATROL')"  title="Patrol waypoints">↩ Patrol</button>
        <button class="uc-bmode-btn${bm==='EXPLORE'?' active':''}" onclick="GAME_setBehavior('EXPLORE')" title="Explore">🔭 Explore</button>
      </div>
      ${bm === 'PATROL' ? `<button class="uc-patrol-add-btn" onclick="GAME_startPatrolMark()">+ Mark Patrol Point (${info.patrolCount} set)</button>` : ''}
      ${bm === 'PATROL' && info.patrolCount > 0 ? `<button class="uc-patrol-add-btn uc-patrol-clear" onclick="GAME_clearPatrol()">✕ Clear Waypoints</button>` : ''}
      <div class="uc-squad-row">
        <span class="uc-label">Squad:</span>
        ${[1,2,3,4].map(n => `<button class="uc-squad-btn${info.squadId===n?' active':''}" onclick="GAME_assignSquad(${n})" title="Assign to Squad ${n} (Ctrl+${n} to select)">${n}</button>`).join('')}
        <button class="uc-squad-btn${!info.squadId?' active':''}" onclick="GAME_assignSquad(null)" title="No squad">–</button>
      </div>
    ` : '';

    const accStr = info.accuracy ? `<span class="uc-acc">Accuracy ${info.accuracy}%</span>` : '';

    panel.innerHTML = `
      <div class="unit-card">
        <div class="uc-name">${info.name}</div>
        <div class="uc-type">${unit.faction.toUpperCase()} · ${unit.typeId}${info.squadId ? ` · Sq.${info.squadId}` : ''}</div>
        <div class="uc-stat-row">
          <span class="uc-stat-label">HP</span>
          <div class="uc-bar"><div class="uc-bar-fill uc-bar-hp" style="width:${hpPct}%"></div></div>
          <span class="uc-stat-val">${info.hp}/${info.maxHp}</span>
        </div>
        <div class="uc-stat-row">
          <span class="uc-stat-label">MOR</span>
          <div class="uc-bar"><div class="uc-bar-fill uc-bar-morale" style="width:${morPct}%"></div></div>
          <span class="uc-stat-val">${info.morale}%</span>
        </div>
        <div class="uc-status">Status: ${info.state}${info.detected?' · EXPOSED':''}${accStr}</div>
        ${behaviorHtml}
      </div>
    `;
  }

  /* ── LSTM VISUALIZATION ── */
  function renderLSTMViz(canvas, vizData) {
    if (!canvas || !vizData) return;
    const ctx = canvas.getContext('2d');
    const W   = canvas.width, H = canvas.height;

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#050a04';
    ctx.fillRect(0, 0, W, H);

    if (!vizData) return;

    const { inputs, h1, h2, outputs, outputLabels } = vizData;
    const N_IN  = inputs.length;
    const N_H   = h1.length;
    const N_OUT = outputs.length;

    /* Layer X positions */
    const X_IN  = 20;
    const X_H1  = W * 0.38;
    const X_H2  = W * 0.62;
    const X_OUT = W - 20;

    /* Draw connections (sparse for readability) */
    ctx.globalAlpha = 0.15;
    ctx.strokeStyle = '#4a8a2a';
    ctx.lineWidth = 0.5;

    /* Input → H1 (sample connections) */
    for (let i = 0; i < Math.min(N_IN, 6); i++) {
      const y1 = _nodeY(i, N_IN, H);
      for (let j = 0; j < Math.min(N_H, 5); j++) {
        const y2 = _nodeY(j, N_H, H);
        const act = inputs[i] * (h1[j] + 0.5);
        if (act > 0.2) {
          ctx.globalAlpha = act * 0.3;
          ctx.beginPath();
          ctx.moveTo(X_IN + 6, y1);
          ctx.lineTo(X_H1 - 6, y2);
          ctx.stroke();
        }
      }
    }

    /* H1 → H2 */
    for (let i = 0; i < Math.min(N_H, 5); i++) {
      const y1 = _nodeY(i, N_H, H);
      for (let j = 0; j < Math.min(N_H, 5); j++) {
        const y2 = _nodeY(j, N_H, H);
        ctx.globalAlpha = h1[i] * h2[j] * 0.4;
        ctx.beginPath();
        ctx.moveTo(X_H1 + 6, y1);
        ctx.lineTo(X_H2 - 6, y2);
        ctx.stroke();
      }
    }

    ctx.globalAlpha = 1;

    /* Input nodes */
    for (let i = 0; i < N_IN; i++) {
      const y = _nodeY(i, N_IN, H);
      _drawNode(ctx, X_IN, y, 4, inputs[i], '#2244aa');
    }

    /* H1 nodes */
    for (let i = 0; i < Math.min(N_H, 8); i++) {
      const y = _nodeY(i, Math.min(N_H, 8), H);
      _drawNode(ctx, X_H1, y, 5, h1[i], '#2a6a2a');
    }

    /* H2 nodes */
    for (let i = 0; i < Math.min(N_H, 8); i++) {
      const y = _nodeY(i, Math.min(N_H, 8), H);
      _drawNode(ctx, X_H2, y, 5, h2[i], '#4a8a2a');
    }

    /* Output nodes + labels */
    for (let i = 0; i < N_OUT; i++) {
      const y = _nodeY(i, N_OUT, H);
      _drawNode(ctx, X_OUT, y, 6, outputs[i], '#c8820a');

      /* Output label */
      ctx.fillStyle = `rgba(200,130,10,${0.4 + outputs[i] * 0.6})`;
      ctx.font = '8px monospace';
      ctx.textAlign = 'right';
      ctx.fillText(outputLabels[i].split('/')[0], X_OUT - 10, y + 3);
    }

    /* Layer labels */
    ctx.fillStyle = '#2a4a1a';
    ctx.font = '8px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('IN', X_IN, H - 4);
    ctx.fillText('LSTM', X_H1, H - 4);
    ctx.fillText('LSTM', X_H2, H - 4);
    ctx.fillText('OUT', X_OUT, H - 4);
  }

  function _nodeY(i, total, H) {
    const padding = 12;
    const avail   = H - padding * 2 - 12;
    if (total <= 1) return H / 2;
    return padding + (i / (total - 1)) * avail;
  }

  function _drawNode(ctx, x, y, r, activation, color) {
    const alpha = 0.2 + Math.abs(activation) * 0.8;
    const glow  = Math.abs(activation) > 0.5;

    if (glow) {
      ctx.shadowColor  = color;
      ctx.shadowBlur   = 6;
    }
    ctx.fillStyle = color;
    ctx.globalAlpha = Utils.clamp(alpha, 0.1, 1);
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
  }

  function updateAIPanel(vizData) {
    const threatBar = document.getElementById('threat-bar');
    const adaptEl   = document.getElementById('ai-adaptations');
    const tacticEl  = document.getElementById('ai-current-tactic');
    if (!vizData) return;

    if (threatBar) {
      const threatPct = Math.round(vizData.threat * 100);
      threatBar.style.width = threatPct + '%';
      /* Color shift: green → amber → red */
      const pos = 100 - threatPct;
      threatBar.style.backgroundPosition = `${pos}% 0%`;
    }
    if (adaptEl)  adaptEl.textContent  = vizData.adaptations;
    if (tacticEl && typeof EnemyAI !== 'undefined') tacticEl.textContent = `Tactic: ${EnemyAI.getBehaviorLabel()}`;
  }

  /* ── BATTLE LOG ── */
  let _logEl = null;

  function initLog() {
    _logEl = document.getElementById('log-entries');
  }

  function log(msg, type) {
    if (!_logEl) return;
    const entry = document.createElement('div');
    entry.className = `log-entry ${type || ''}`;
    const time = document.createElement('span');
    time.className = 'log-time';
    time.textContent = UI._currentTimeStr || '0:00';
    entry.appendChild(time);
    entry.appendChild(document.createTextNode(msg));
    _logEl.prepend(entry);
    /* Cap log length */
    while (_logEl.children.length > 50) _logEl.removeChild(_logEl.lastChild);
  }

  /* ── POST-BATTLE SCREEN ── */
  function showPostBattle(result, battle, stats, ablation) {
    const resultEl = document.getElementById('pb-result');
    resultEl.textContent = result.label;
    resultEl.className   = `pb-result ${result.css}`;
    setEl('pb-battle-name', battle.name);
    setEl('pb-date',        battle.date);
    setEl('pb-historical',  battle.historicalOutcome);

    /* Battle stats */
    const statsEl = document.getElementById('pb-stats');
    statsEl.innerHTML = '';
    const rows = [
      ['Enemy Killed',      stats.vcKilled,       'good'],
      ['US Casualties',     stats.usCasualties,   'bad'],
      ['Artillery Strikes', stats.artilleryUsed,  null],
      ['Air Strikes',       stats.airStrikesUsed, null],
      ['Napalm Used',       stats.napalmUsed,      stats.napalmUsed > 0 ? 'bad' : null],
      ['Recon Deployed',    stats.reconDeployed,  null],
      ['Battle Duration',   Utils.formatTime(stats.elapsed), null],
    ];
    for (const [label, val, cls] of rows) {
      const row = document.createElement('div');
      row.className = 'stat-row';
      row.innerHTML = `<span class="stat-label">${label}</span><span class="stat-val ${cls||''}">${val}</span>`;
      statsEl.appendChild(row);
    }

    /* Ablation bars */
    const ablEl = document.getElementById('ablation-bars');
    ablEl.innerHTML = '';
    if (ablation && ablation.length) {
      for (const item of ablation.slice(0, 7)) {
        const pct = Math.round(item.contribution * 100);
        const row = document.createElement('div');
        row.className = 'ablation-row';
        row.innerHTML = `
          <div class="ablation-label">${item.label}</div>
          <div class="ablation-bar-wrap">
            <div class="ablation-bar-fill" data-pct="${pct}%"
              style="width:0%;background:${item.color}"></div>
          </div>
        `;
        ablEl.appendChild(row);
      }
      /* Animate in */
      setTimeout(() => {
        ablEl.querySelectorAll('.ablation-bar-fill').forEach(bar => {
          bar.style.width = bar.getAttribute('data-pct');
        });
      }, 100);

      /* Note about top factor */
      const top  = ablation[0];
      const note = `Most influential factor: ${top.label} (${Math.round(top.contribution * 100)}% contribution to outcome).`;
      setEl('ablation-note', note);
    }

    showScreen('screen-post-battle');
  }

  /* ── ANTI-WAR EVENT ── */
  function showAntiwarEvent(event) {
    setEl('antiwar-headline', event.headline);
    setEl('antiwar-story',    event.story);
    setEl('antiwar-date',     `Year: ${event.year}`);
    setEl('antiwar-penalty',  `-${event.scorePenalty} pts`);
    setEl('antiwar-opinion',  `-${event.opinionDrop || 10}%`);

    const art = document.getElementById('antiwar-art');
    if (art) art.textContent = event.icon;

    showModal('modal-antiwar');
    SoundSystem.play('alert');
  }

  /* ── DOCUMENTS MODAL ── */
  function initDocsModal() {
    const sidebar = document.getElementById('docs-sidebar');
    const viewer  = document.getElementById('docs-viewer');
    if (!sidebar || !viewer) return;

    sidebar.innerHTML = '';
    for (const doc of Battles.docs) {
      const item = document.createElement('div');
      item.className = 'doc-item';
      item.dataset.id = doc.id;
      item.innerHTML = `
        <div class="doc-item-title">${doc.title}</div>
        <div class="doc-item-date">${doc.date}</div>
      `;
      item.addEventListener('click', () => {
        sidebar.querySelectorAll('.doc-item').forEach(i => i.classList.remove('active'));
        item.classList.add('active');
        _renderDoc(viewer, doc);
        SoundSystem.play('uiClick');
      });
      sidebar.appendChild(item);
    }
  }

  function _renderDoc(viewer, doc) {
    viewer.innerHTML = `
      <div class="doc-paper">
        <div class="doc-stamp ${doc.stamp === 'TOP SECRET' ? 'classified' : 'secret'}">${doc.stamp}</div>
        <h2>${doc.title}</h2>
        <div class="doc-meta">Date: ${doc.date} · Classification: ${doc.stamp}</div>
        ${doc.content.split('\n\n').map(p => `<p>${p.replace(/\n/g,'<br>')}</p>`).join('')}
      </div>
    `;
  }

  /* ── INTEL REPORT ── */
  function showIntelReport(stats, battle, behaviorLabel, threatPct) {
    const content = document.getElementById('intel-content');
    if (!content) return;

    content.innerHTML = `
      <div style="padding:20px;font-size:12px;line-height:1.8;color:#c8d4b8;">
        <h3 style="color:#c8820a;letter-spacing:2px;margin-bottom:12px;">CURRENT ENGAGEMENT INTELLIGENCE</h3>
        <div style="margin-bottom:16px;">
          <strong style="color:#f5a623;">Battle:</strong> ${battle.name}<br>
          <strong style="color:#f5a623;">Date:</strong> ${battle.date}<br>
          <strong style="color:#f5a623;">Elapsed:</strong> ${Utils.formatTime(stats.elapsed)}
        </div>
        <h4 style="color:#4a8a2a;margin-bottom:8px;">ENEMY AI STATUS</h4>
        <div style="margin-bottom:16px;">
          <strong>Current Tactic:</strong> ${behaviorLabel}<br>
          <strong>Threat Level:</strong> ${threatPct}%<br>
          <strong>Adaptations:</strong> ${LSTM.getAdaptations()}<br>
          <strong>Enemy Contacts:</strong> ${stats.enemyContacts}
        </div>
        <h4 style="color:#4a8a2a;margin-bottom:8px;">US FORCE STATUS</h4>
        <div>
          <strong>Active Units:</strong> ${Units.getUS().length}<br>
          <strong>Casualties:</strong> ${stats.usCasualties}<br>
          <strong>Enemy KIA:</strong> ${stats.vcKilled}
        </div>
        <div style="margin-top:16px;padding:10px;background:rgba(170,32,16,0.1);border:1px solid #6a1208;font-size:11px;">
          <strong style="color:#e03020;">LSTM NETWORK NOTE:</strong><br>
          The enemy AI has processed ${LSTM.network.inputHistory.length} game states this battle.
          Pattern analysis suggests the enemy has identified your ${_topPattern(stats)}.
        </div>
      </div>
    `;
    showModal('modal-intel');
  }

  function _topPattern(stats) {
    const s = stats;
    if (s.airStrikesUsed > 3) return 'heavy reliance on air support — expect tunneling and dispersal';
    if (s.reconDeployed > 2) return 'reconnaissance patterns — expect ambushes on recon routes';
    if (s.infantryDeploy > 8) return 'large infantry concentrations — expect mortar targeting';
    return 'movement patterns — AI is still analyzing';
  }

  /* ── TUTORIAL ── */
  const TUTORIAL_STEPS = [
    {
      icon: '🇺🇸',
      title: 'Welcome — Vietnam: The Long War',
      html: `<p>This AP US History simulation places you in command of US forces during the Vietnam War (1963–1975). Your decisions will echo real strategic choices made by American commanders — with real historical consequences.</p>
<div class="tut-fact">"We were wrong, terribly wrong. We owe it to future generations to explain why." — Robert S. McNamara, Secretary of Defense, 1995</div>
<p>You will fight through 8 historically-accurate battles, from the early advisory years to the final US withdrawal. An LSTM neural network drives the enemy AI — it learns from your tactics and adapts, just as the real Viet Cong studied and countered American patterns.</p>
<p class="tut-tip">📋 Access classified historical documents anytime during battle using the 📋 button in the top HUD.</p>`,
    },
    {
      icon: '🌏',
      title: 'Why Were We in Vietnam?',
      html: `<p>After World War II, the United States pursued a policy of <strong>containment</strong> — halting the global spread of Soviet-backed communism. When France lost its colony of Indochina to Ho Chi Minh's communist forces in 1954, American strategists feared a cascade effect.</p>
<div class="tut-highlight">THE DOMINO THEORY — President Eisenhower argued that if Vietnam fell to communism, neighboring nations would follow like a row of falling dominoes: Laos, Cambodia, Thailand, and eventually all of Southeast Asia. This fear drove US involvement for two decades.</div>
<p>President Kennedy sent 16,700 military <em>advisors</em> by 1963. After the disputed Gulf of Tonkin incident in August 1964, President Johnson used the Gulf of Tonkin Resolution to escalate into full-scale war — without a formal declaration of war from Congress.</p>
<div class="tut-fact">Historical note: The "second attack" on USS Maddox on August 4, 1964 — the primary justification for the resolution — almost certainly never happened. McNamara acknowledged this in 1995.</div>`,
    },
    {
      icon: '🗺️',
      title: 'Reading the Battlefield',
      html: `<p>The map represents the dense terrain of South Vietnam. Each tile type affects movement speed, cover, and enemy concealment differently.</p>
<div class="tut-highlight">🌿 <strong>Jungle</strong> — 40% movement speed · Heavy cover · Hides enemy units<br>
🌾 <strong>Clearing</strong> — 100% speed · Low cover · Good visibility<br>
🏘️ <strong>Village</strong> — 80% speed · Civilians present — killing them collapses public opinion<br>
⛰️ <strong>Hills</strong> — 60% speed · Elevated cover and sight range<br>
🛣️ <strong>Road</strong> — 150% speed · No cover · Exposed to ambush<br>
🌾 <strong>Rice Paddy</strong> — 50% speed · Little cover</div>
<p><strong>Fog of War:</strong> Dark areas are unexplored. Deploy Recon teams or use Explore mode to reveal enemy positions. Viet Cong units are <em>hidden by default</em> — they only appear when they fire or are detected by nearby recon.</p>
<p class="tut-tip">💡 Use the minimap (top-right panel) for a strategic overview. Blue = your forces, Red = detected enemy, Diamond = objectives.</p>`,
    },
    {
      icon: '🪖',
      title: 'Commanding Your Forces',
      html: `<p><strong>Selecting Units:</strong> Left-click any friendly unit to select it. Unit stats appear in the right panel. Right-click the map to move the selected unit to that location.</p>
<div class="tut-highlight"><strong>Behavior Modes (right panel buttons):</strong><br>
🔭 <strong>EXPLORE</strong> — Unit moves autonomously toward unexplored (dark) areas of the map<br>
🛡️ <strong>GUARD</strong> — Unit holds position and engages any enemy that enters its range<br>
↩ <strong>PATROL</strong> — Unit walks a looping route between waypoints you place on the map</div>
<p><strong>Setting Patrol Routes:</strong> Select a unit → set mode to PATROL → click "Mark Patrol Point" → left-click 2 to 4 map locations → right-click to confirm. Units loop the route indefinitely.</p>
<p><strong>Squads:</strong> Assign units to squads (1–4) in the unit panel. Moving a squad leader automatically repositions followers. Use squads to coordinate flanking maneuvers.</p>
<p class="tut-tip">💡 Pre-deployed units at your base start in GUARD mode. Newly deployed units begin in EXPLORE mode and automatically move toward uncharted territory.</p>`,
    },
    {
      icon: '⚔️',
      title: 'Combat & the LSTM Enemy AI',
      html: `<p>Combat resolves automatically when enemy units enter your weapons range. Watch the <strong>BATTLE LOG</strong> (bottom-right) for real-time engagement reports.</p>
<div class="tut-highlight"><strong>Enemy AI — LSTM Neural Network:</strong><br>
The enemy uses a Long Short-Term Memory (LSTM) recurrent neural network. It tracks your use of artillery, airstrikes, troop deployments, and casualties across every battle — then adapts its behavior for the next engagement. The AI panel (right side) visualizes its current activation in real time.</div>
<p><strong>Enemy behaviors:</strong> <em>Hide/Tunnel</em> (go underground to avoid area fire), <em>Ambush</em> (wait in concealment until you approach), <em>Disperse</em> (scatter to reduce airstrike effectiveness), <em>Mortar</em> (indirect suppression), and <em>Counterattack</em> (aggressive rush).</p>
<div class="tut-fact">Historical parallel: The Viet Cong coined the phrase "grab them by the belt buckle" — staying so close to US forces that American air power and artillery could not be called without hitting their own men. They studied US tactics relentlessly.</div>
<p><strong>Public Opinion</strong> is your hidden resource. US casualties, civilian deaths, and chemical weapon use erode domestic support. Real historical anti-war events trigger when support hits key thresholds.</p>`,
    },
    {
      icon: '✈️',
      title: 'Strategic Assets & Political Cost',
      html: `<p>Your most powerful weapons carry the heaviest political consequences — just as they did for real US commanders.</p>
<div class="tut-highlight">✈️ <strong>Air Strike (F-105 Thunderchief)</strong> — Precision bombing · 50 resources · High damage<br>
🔥 <strong>Napalm Strike</strong> — Area incendiary · Burns terrain permanently · 35 resources · Severe civilian risk<br>
☣️ <strong>Agent Orange</strong> — Clears all jungle cover in area · Harms all units · Major opinion penalty<br>
💥 <strong>Artillery (M102 Howitzer)</strong> — Requires recon coordinates · Powerful indirect fire<br>
🚁 <strong>Helicopter (UH-1 Huey)</strong> — Fast air-mobile fire support · 30 resources<br>
🔭 <strong>RECON team</strong> — Reveals fog of war · Unlocks artillery coordinates (3 teams per battle)</div>
<div class="tut-fact">Between 1962 and 1971, the US Air Force sprayed 20 million gallons of Agent Orange defoliant over Vietnam. Its active chemical, dioxin, caused widespread cancer, birth defects, and environmental damage that continues to affect Vietnamese communities today — making it one of the most contested decisions of the entire war.</div>
<p class="tut-tip">💡 Deploy RECON first to reveal enemy positions, then call artillery on confirmed targets. This mirrors real MACV doctrine.</p>`,
    },
    {
      icon: '📊',
      title: 'Winning, Losing & History',
      html: `<p>Each battle has specific <strong>objectives</strong> listed in the pre-battle briefing — capture highlighted positions and eliminate enemy forces. But military victory is only half the challenge.</p>
<div class="tut-highlight"><strong>Public Opinion</strong> starts at 100% and falls from:<br>
• US casualties · Civilian deaths (large penalty) · Agent Orange use (−15%)<br>
• Historical anti-war events trigger automatically at 90%, 80%, 70%, 60%, 50%, 40%, 30%<br>
• Real events: the March on the Pentagon, My Lai, Kent State, Pentagon Papers, and more</div>
<p>After each battle, review the <strong>LSTM Ablation Analysis</strong> — it shows which of your tactical decisions most influenced the outcome. This mirrors the real analytical method used by military strategists to evaluate campaign effectiveness.</p>
<div class="tut-fact">"The war was being won militarily and lost politically." — Many historians' summary of the Vietnam War. Every battle you win here reflects this tension. The US military never lost a major engagement — but lost the war. Understanding how and why is the core lesson of this simulation.</div>
<p style="color:var(--green-vivid);margin-top:10px;">Good luck, Commander. The history books are watching.</p>`,
    },
  ];

  let _tutStep = 0;
  let _tutInitialized = false;

  function _tutRender() {
    const s     = TUTORIAL_STEPS[_tutStep];
    const total = TUTORIAL_STEPS.length;
    setEl('tutorial-step-label', `HOW TO PLAY — STEP ${_tutStep + 1} OF ${total}`);

    const iconEl  = document.getElementById('tutorial-icon');
    const titleEl = document.getElementById('tutorial-title');
    const textEl  = document.getElementById('tutorial-text');
    const dotsEl  = document.getElementById('tutorial-dots');
    const prevBtn = document.getElementById('btn-tut-prev');
    const nextBtn = document.getElementById('btn-tut-next');

    if (iconEl)  iconEl.textContent = s.icon;
    if (titleEl) titleEl.textContent = s.title;
    if (textEl)  textEl.innerHTML = s.html;

    if (dotsEl) {
      dotsEl.innerHTML = '';
      for (let i = 0; i < total; i++) {
        const dot = document.createElement('div');
        dot.className = 'tutorial-dot' + (i === _tutStep ? ' active' : i < _tutStep ? ' done' : '');
        dotsEl.appendChild(dot);
      }
    }
    if (prevBtn) prevBtn.style.visibility = _tutStep === 0 ? 'hidden' : 'visible';
    if (nextBtn) nextBtn.textContent = _tutStep === total - 1 ? '✓ CLOSE' : 'NEXT ▶';
  }

  function initTutorial() {
    if (_tutInitialized) return;
    _tutInitialized = true;

    document.getElementById('btn-tut-next')?.addEventListener('click', () => {
      if (_tutStep < TUTORIAL_STEPS.length - 1) {
        _tutStep++;
        _tutRender();
      } else {
        hideModal('modal-tutorial');
        try { localStorage.setItem('vtlw_tutorial_seen', '1'); } catch(e) {}
      }
    });

    document.getElementById('btn-tut-prev')?.addEventListener('click', () => {
      if (_tutStep > 0) { _tutStep--; _tutRender(); }
    });

    document.getElementById('close-tutorial')?.addEventListener('click', () => {
      hideModal('modal-tutorial');
      try { localStorage.setItem('vtlw_tutorial_seen', '1'); } catch(e) {}
    });

    /* Auto-show on first visit */
    let seen = false;
    try { seen = !!localStorage.getItem('vtlw_tutorial_seen'); } catch(e) {}
    if (!seen) {
      setTimeout(() => { _tutStep = 0; _tutRender(); showModal('modal-tutorial'); }, 600);
    }
  }

  function showTutorial() {
    _tutStep = 0;
    _tutRender();
    showModal('modal-tutorial');
  }

  /* ── HELPERS ── */
  function setEl(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  }

  let _currentTimeStr = '0:00';

  return {
    showScreen, showModal, hideModal, showLoading, showBriefing,
    updateHUD, updateOpinion, updateReconCount,
    startCooldown, updateCooldowns, isOnCooldown, setActionSelected,
    updateUnitInfo, renderLSTMViz, updateAIPanel,
    initLog, log, showPostBattle, showAntiwarEvent,
    initDocsModal, showIntelReport,
    initTutorial, showTutorial,
    setEl,
    set currentTimeStr(v) { _currentTimeStr = v; },
  };
})();
