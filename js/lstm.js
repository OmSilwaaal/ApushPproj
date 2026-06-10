/* ============================================================
   ENEMY DOCTRINE — Historically-grounded enemy behavior selection

   Replaces any notion of "AI learning" with authentic VC/NVA
   tactical doctrine drawn from documented battle accounts.
   The enemy behaves as they actually did — not as a machine learner.
   ============================================================ */
const LSTM = (() => {

  /* Behavior index constants (unchanged — used throughout ai.js) */
  const B_HIDE     = 0;
  const B_AMBUSH   = 1;
  const B_DISPERSE = 2;
  const B_MORTAR   = 3;
  const B_COUNTER  = 4;

  const OUTPUT_LABELS = [
    'Defensive Hold', 'Ambush / Hit-Run', 'Disperse / Evade',
    'Indirect Fire', 'Direct Assault'
  ];
  const INPUT_LABELS = [
    'Artillery Used','Air Strikes','Napalm Used','Recon Deployed',
    'Infantry Deployed','Armor Deployed','Helicopters','Chemical Agents',
    'Naval Strikes','Enemy Contacts','US Casualties','Time Pressure'
  ];

  /*
   * Historical doctrine profiles — one per battle.
   * Weights express the tactical emphasis the VC/NVA actually applied
   * in each engagement, based on after-action reports and historical accounts.
   *   [B_HIDE, B_AMBUSH, B_DISPERSE, B_MORTAR, B_COUNTER]
   */
  const BATTLE_DOCTRINES = [
    /* 0 — Ap Bac, Jan 1963
       VC 514th Bn held prepared positions along irrigation dikes and stood
       and fought — an unusual decision that exposed ARVN's command failures. */
    {
      name: 'Guerrilla Defense',
      description: 'Prepared positions along irrigation dikes. Disciplined fire held until US helicopters were within range — the VC stood and fought rather than flee.',
      historicalNote: '"This is a miserable damn performance, just like it always is." — Col. John Paul Vann, US Army Advisor, after Ap Bac',
      weights: [0.25, 0.35, 0.08, 0.22, 0.10],
    },
    /* 1 — Ia Drang, Nov 1965
       NVA Commander Nguyen Huu An ordered troops to "grab the belt buckle" —
       close to within 30m of US lines so artillery and air power could not fire. */
    {
      name: '"Grab the Belt" Assault',
      description: 'Close assault to within 30 meters of US positions — the "hug" tactic. At that range, American air power and artillery risk hitting their own men.',
      historicalNote: '"We must get so close that their artillery cannot fire without killing their own men." — NVA Cmdr. Nguyen Huu An, Ia Drang Valley, 1965',
      weights: [0.08, 0.18, 0.12, 0.15, 0.47],
    },
    /* 2 — Junction City, Feb–May 1967
       COSVN dissolved into an extensive tunnel and bunker system and
       slipped across the Cambodian border — a recurring US strategic failure. */
    {
      name: 'Tunnel Network Defense',
      description: 'Disperse into underground tunnels and bunkers. Fight in short bursts then withdraw. COSVN will slip into Cambodia before encirclement is complete.',
      historicalNote: 'Despite 22 US and 4 ARVN battalions, COSVN headquarters escaped into Cambodia — demonstrating the limits of conventional operations against a tunnel-based enemy.',
      weights: [0.42, 0.28, 0.18, 0.08, 0.04],
    },
    /* 3 — Khe Sanh, Jan–Jul 1968
       NVA modeled the siege on Dien Bien Phu (1954): trench-digging toward
       the perimeter, coordinated mortar and artillery from surrounding hills. */
    {
      name: 'Siege & Encirclement',
      description: 'Dig trenches toward the perimeter. Rain mortars from the surrounding hills. Starve the base of supplies and deny the airstrip.',
      historicalNote: 'Gen. Vo Nguyen Giap modeled Khe Sanh on Dien Bien Phu, where the same tactics destroyed the French army in Vietnam in 1954.',
      weights: [0.12, 0.10, 0.15, 0.43, 0.20],
    },
    /* 4 — Battle of Hue, Jan–Mar 1968
       NVA fortified every building in the Citadel. The ancient walls absorbed
       artillery. Marines had to retrain for urban combat on the spot. */
    {
      name: 'Urban Strongpoint Defense',
      description: 'Fortify every building. Fight room by room. The Citadel\'s walls absorb artillery and napalm. Make the Americans pay for every meter.',
      historicalNote: 'US Marines had never trained for urban combat at this scale. The Battle of Hue was the longest and bloodiest engagement of the Tet Offensive.',
      weights: [0.18, 0.22, 0.10, 0.15, 0.35],
    },
    /* 5 — Lam Son 719, Feb–Mar 1971
       NVA deployed Soviet-supplied T-54 tanks alongside massed infantry —
       the first time ARVN faced large-scale armor. AA guns grounded helicopters. */
    {
      name: 'Combined Arms Counterattack',
      description: 'Coordinate tank columns with infantry. Blanket the area with anti-aircraft fire to neutralize the helicopter advantage. The ARVN cannot stand against armor.',
      historicalNote: 'Images of ARVN soldiers clinging to helicopter skids to escape became the defining image of Lam Son 719 — proving Vietnamization had failed.',
      weights: [0.05, 0.15, 0.08, 0.27, 0.45],
    },
    /* 6 — Easter Offensive / An Loc, Apr–Jun 1972
       Three NVA divisions executed a Soviet-style siege: massive artillery
       preparation followed by tank-infantry assault. B-52s struck within 1km
       of friendly lines — the closest strategic bombing in US history. */
    {
      name: 'Conventional Siege',
      description: 'Three-division siege. Mass artillery preparation, then armor-infantry assault. Surround and strangle. Do not allow resupply on Route 13.',
      historicalNote: 'B-52 Arc Light strikes fell within 1 kilometer of friendly lines at An Loc — the closest B-52 strikes to friendly troops in the entire war.',
      weights: [0.05, 0.12, 0.08, 0.32, 0.43],
    },
    /* 7 — Fall of Saigon, Apr 1975
       No more concealment needed. NVA Tank No. 843 drove openly down the
       main boulevard and crashed through the Presidential Palace gates at 11:30 AM. */
    {
      name: 'Final Offensive',
      description: 'No more hiding. Drive armor openly down the boulevards. The war is over — it is only a question of how many are evacuated before the gates fall.',
      historicalNote: 'NVA Tank No. 843 crashed through the gates of the Presidential Palace at 11:30 AM, April 30, 1975. The last American helicopter left the embassy roof at 7:53 AM.',
      weights: [0.03, 0.08, 0.04, 0.28, 0.57],
    },
  ];

  /* Historical factors used in post-battle analysis (replacing "ablation") */
  const HISTORICAL_FACTORS = [
    { label: 'Air Power Effectiveness',    color: '#4a8a2a' },
    { label: 'Terrain Advantage',          color: '#6abf3a' },
    { label: 'Supply Line Integrity',      color: '#c8820a' },
    { label: 'Troop Morale',               color: '#f5a623' },
    { label: 'Intelligence Quality',       color: '#aa2010' },
    { label: 'Command & Control',          color: '#e03020' },
    { label: 'Domestic Public Support',    color: '#2244aa' },
    { label: 'ARVN Cooperation',           color: '#4488ff' },
    { label: 'Civilian Loyalty (Locals)',  color: '#8844aa' },
    { label: 'Ho Chi Minh Trail Supply',   color: '#cc66ff' },
    { label: 'Media / Press Coverage',     color: '#2a8a6a' },
    { label: 'Congressional Authorization',color: '#44ffcc' },
  ];

  /* Per-battle historical factor weights — based on what historians
     identify as decisive in each engagement. */
  const BATTLE_FACTOR_WEIGHTS = [
    /* Ap Bac    */ [0.12, 0.18, 0.08, 0.20, 0.15, 0.12, 0.05, 0.10, 0.00, 0.00, 0.00, 0.00],
    /* Ia Drang  */ [0.28, 0.15, 0.08, 0.18, 0.12, 0.08, 0.05, 0.06, 0.00, 0.00, 0.00, 0.00],
    /* Jct City  */ [0.20, 0.12, 0.15, 0.10, 0.18, 0.10, 0.05, 0.10, 0.00, 0.00, 0.00, 0.00],
    /* Khe Sanh  */ [0.35, 0.20, 0.10, 0.12, 0.08, 0.08, 0.07, 0.00, 0.00, 0.00, 0.00, 0.00],
    /* Hue       */ [0.15, 0.20, 0.08, 0.12, 0.10, 0.10, 0.15, 0.10, 0.00, 0.00, 0.00, 0.00],
    /* Lam Son   */ [0.20, 0.18, 0.12, 0.18, 0.08, 0.12, 0.12, 0.00, 0.00, 0.00, 0.00, 0.00],
    /* An Loc    */ [0.30, 0.12, 0.10, 0.15, 0.08, 0.10, 0.15, 0.00, 0.00, 0.00, 0.00, 0.00],
    /* Saigon    */ [0.10, 0.08, 0.05, 0.05, 0.05, 0.05, 0.30, 0.05, 0.07, 0.10, 0.10, 0.00],
  ];

  /* ── STATE ── */
  let _battleIdx     = 0;
  let _battlesPlayed = 0;
  let _lastOutput    = [0.2, 0.2, 0.2, 0.2, 0.2];
  let _threatLevel   = 0.2;

  /* Stub — code that checks LSTM.network.inputHistory.length won't crash */
  const network = {
    get inputHistory()    { return new Array(_battlesPlayed * 12); },
    get adaptationCount() { return _battlesPlayed; },
  };

  /* ── PUBLIC API ── */

  function setBattle(idx) {
    _battleIdx = Math.min(Math.max(0, idx), BATTLE_DOCTRINES.length - 1);
  }

  function resetState() { /* Doctrine is stateless per battle — nothing to reset */ }

  /*
   * tick() — select behavior weights from historical doctrine, adjusted by
   * real game-state signals that mirror how the VC/NVA actually responded
   * to US tactical patterns.
   */
  function tick(gameState) {
    const doc = BATTLE_DOCTRINES[_battleIdx] || BATTLE_DOCTRINES[0];
    const w   = [...doc.weights];

    /* Heavy air power → VC tunnels and disperses (documented countermeasure) */
    if ((gameState.airStrikesUsed || 0) > 2 || (gameState.napalmUsed || 0) > 0) {
      w[B_HIDE]     += 0.15;
      w[B_DISPERSE] += 0.10;
      w[B_COUNTER]  -= 0.12;
    }
    /* Large infantry presence → VC prepares ambushes on approach routes */
    if ((gameState.infantryDeploy || 0) > 5) {
      w[B_AMBUSH] += 0.10;
    }
    /* Late battle phase → pressure mounts, more aggressive */
    if ((gameState.elapsed || 0) > 300) {
      w[B_COUNTER] += 0.08;
      w[B_MORTAR]  += 0.05;
    }
    /* US casualties rising → enemy grows bolder (VC political-will strategy) */
    if ((gameState.usCasualties || 0) > 8) {
      w[B_COUNTER] += 0.10;
      w[B_MORTAR]  += 0.05;
      w[B_HIDE]    -= 0.05;
    }

    /* Normalize */
    const sum = w.reduce((a, b) => a + b, 0) || 1;
    let out   = w.map(v => Math.max(0, v / sum));

    /* Small variation — prevents repetitive, mechanical behavior */
    out = out.map(v => v + (Math.random() - 0.5) * 0.04);
    const sum2 = out.reduce((a, b) => a + b, 0) || 1;
    out = out.map(v => Math.max(0, v / sum2));

    _lastOutput  = out;
    _threatLevel = Math.min(1,
      0.2 + out[B_COUNTER] * 0.4 + out[B_AMBUSH] * 0.25 + _battlesPlayed * 0.03
    );
    return out;
  }

  /* Called after each battle — increment campaign experience counter */
  function learn(vcWon, stats) { _battlesPlayed++; }

  /*
   * ablationTest() — returns historically-grounded battle factors
   * (replaces the LSTM ablation study with actual historical analysis).
   */
  function ablationTest() {
    const weights = BATTLE_FACTOR_WEIGHTS[_battleIdx] || BATTLE_FACTOR_WEIGHTS[0];
    const total   = weights.reduce((a, b) => a + b, 0) || 1;
    return HISTORICAL_FACTORS
      .map((f, i) => ({ label: f.label, contribution: weights[i] / total, color: f.color }))
      .filter(f => f.contribution > 0.001)
      .sort((a, b) => b.contribution - a.contribution);
  }

  function getVizData() {
    const doc = BATTLE_DOCTRINES[_battleIdx] || BATTLE_DOCTRINES[0];
    return {
      doctrineName:   doc.name,
      doctrineDesc:   doc.description,
      historicalNote: doc.historicalNote,
      outputs:        _lastOutput,
      threat:         _threatLevel,
      adaptations:    _battlesPlayed,
      outputLabels:   OUTPUT_LABELS,
      inputLabels:    INPUT_LABELS,
      battleIdx:      _battleIdx,
    };
  }

  function getThreat()       { return _threatLevel; }
  function getAdaptations()  { return _battlesPlayed; }
  function getOutputLabels() { return OUTPUT_LABELS; }

  return {
    setBattle, resetState, tick, learn, ablationTest, getVizData,
    getThreat, getAdaptations, getOutputLabels,
    B_HIDE, B_AMBUSH, B_DISPERSE, B_MORTAR, B_COUNTER,
    network,
  };
})();
