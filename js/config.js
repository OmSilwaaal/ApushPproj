/* ============================================================
   CONFIG — Game constants
   ============================================================ */
const CONFIG = {
  TILE:       32,
  MAP_W:      60,
  MAP_H:      40,
  FPS:        60,
  GAME_SPEEDS: [0.5, 1, 2, 3],

  /* ── TILE TYPES ── */
  TILES: {
    JUNGLE:   { id:0, name:'Jungle',     color:'#1a3a0a', dark:'#0f2206', move:0.4, cover:0.7, sight:-2, sound_absorb:0.6 },
    CLEARING: { id:1, name:'Clearing',   color:'#4a7a2a', dark:'#2d5018', move:1.0, cover:0.1, sight: 0, sound_absorb:0.1 },
    WATER:    { id:2, name:'Water',      color:'#1a4a7a', dark:'#0f2f55', move:0.0, cover:0.0, sight: 1, sound_absorb:0.2 },
    HILLS:    { id:3, name:'Hills',      color:'#6a4a2a', dark:'#4a3018', move:0.6, cover:0.5, sight: 2, sound_absorb:0.3 },
    VILLAGE:  { id:4, name:'Village',    color:'#8a7a5a', dark:'#5a5038', move:0.8, cover:0.3, sight: 0, sound_absorb:0.2 },
    ROAD:     { id:5, name:'Road',       color:'#5a5a4a', dark:'#3a3a2a', move:1.5, cover:0.0, sight: 0, sound_absorb:0.0 },
    PADDY:    { id:6, name:'Rice Paddy', color:'#3a5a3a', dark:'#253a25', move:0.5, cover:0.1, sight: 1, sound_absorb:0.1 },
    BASE:     { id:7, name:'Base Camp',  color:'#4a4a2a', dark:'#2e2e18', move:1.0, cover:0.4, sight: 0, sound_absorb:0.2 },
    DEFOLIAT: { id:8, name:'Defoliated', color:'#7a6a3a', dark:'#504525', move:0.9, cover:0.0, sight: 2, sound_absorb:0.0 },
    BURNED:   { id:9, name:'Burned',     color:'#3a2a1a', dark:'#200e08', move:0.7, cover:0.0, sight: 1, sound_absorb:0.1 },
  },

  /* ── UNIT DEFINITIONS ── */
  UNITS: {
    /* US Forces */
    INFANTRY:     { id:'INFANTRY',     name:'Infantry Squad',       faction:'us', hp:100, atk:25, def:15, spd:1.6, sight:4, noise:2.0, cost:10, cdSec:5,  symbol:'I', flying:false, limited:false, range:1,  attackRate:1.5, accuracy:0.70 },
    M60_GUNNER:   { id:'M60_GUNNER',   name:'M60 Machine Gunner',   faction:'us', hp:90,  atk:20, def:12, spd:1.0, sight:4, noise:5.5, cost:20, cdSec:9,  symbol:'G', flying:false, limited:false, range:2,  attackRate:4.5, accuracy:0.50, burst:true },
    SHARPSHOOTER: { id:'SHARPSHOOTER', name:'Army Sharpshooter',    faction:'us', hp:30,  atk:95, def:4,  spd:1.3, sight:10,noise:0.2, cost:15, cdSec:14, symbol:'X', flying:false, limited:false, range:10, attackRate:0.28,accuracy:0.90 },
    GRENADIER:    { id:'GRENADIER',    name:'M79 Grenadier',        faction:'us', hp:75,  atk:60, def:13, spd:0.9, sight:3, noise:3.5, cost:18, cdSec:11, symbol:'Z', flying:false, limited:false, range:4,  attackRate:0.45,accuracy:0.65, aoe:1.2 },
    ARTILLERY:    { id:'ARTILLERY',    name:'M102 Howitzer',        faction:'us', hp:80,  atk:90, def:5,  spd:0.8, sight:2, noise:8.0, cost:25, cdSec:12, symbol:'A', flying:false, limited:false, range:8,  attackRate:0.2, accuracy:0.80, needsCoords:true },
    ARMOR:        { id:'ARMOR',        name:'M48 Patton Tank',      faction:'us', hp:200, atk:60, def:55, spd:1.3, sight:3, noise:5.0, cost:40, cdSec:15, symbol:'T', flying:false, limited:false, range:1,  attackRate:0.6, accuracy:0.68 },
    HELICOPTER:   { id:'HELICOPTER',   name:'UH-1 Huey',            faction:'us', hp:60,  atk:45, def:10, spd:4.0, sight:6, noise:4.0, cost:30, cdSec:10, symbol:'H', flying:true,  limited:false, range:2,  attackRate:2.0, accuracy:0.62 },
    RECON:        { id:'RECON',        name:'LRRP Recon Team',      faction:'us', hp:35,  atk:10, def:5,  spd:2.0, sight:7, noise:0.5, cost:0,  cdSec:6,  symbol:'R', flying:false, limited:true,  range:1,  attackRate:0.8, accuracy:0.58 },
    AIRSTRIKE:    { id:'AIRSTRIKE',    name:'F-105 Air Strike',     faction:'us', hp:999, atk:150,def:999,spd:0,   sight:6, noise:9.0, cost:50, cdSec:18, symbol:'F', flying:true,  limited:false, range:0,  oneshot:true, aoe:1.5, needsCoords:false },
    NAPALM:       { id:'NAPALM',       name:'Napalm Strike',        faction:'us', hp:999, atk:100,def:999,spd:0,   sight:4, noise:8.0, cost:35, cdSec:22, symbol:'N', flying:true,  limited:false, range:0,  oneshot:true, aoe:2.5, burns:true, needsCoords:false },
    AGENT_ORANGE: { id:'AGENT_ORANGE', name:'Agent Orange',         faction:'us', hp:999, atk:20, def:999,spd:0,   sight:0, noise:5.0, cost:35, cdSec:30, symbol:'O', flying:true,  limited:false, range:0,  oneshot:true, aoe:3.5, defoliate:true, opinionDmg:15, needsCoords:false },
    NAVAL:        { id:'NAVAL',        name:'Naval Bombardment',    faction:'us', hp:999, atk:100,def:999,spd:0,   sight:0, noise:7.0, cost:45, cdSec:20, symbol:'B', flying:false, limited:false, range:10, oneshot:true, aoe:2,   needsCoords:false },

    /* VC/NVA Forces */
    VC_SQUAD:   { id:'VC_SQUAD',   name:'VC Infantry',          faction:'vc', hp:80,  atk:30, def:12, spd:1.3, sight:3, noise:1.0, symbol:'V', hidden:true,  tunnelCapable:true, attackRate:1.4, accuracy:0.62 },
    VC_SNIPER:  { id:'VC_SNIPER',  name:'VC Sniper',            faction:'vc', hp:40,  atk:70, def:6,  spd:1.0, sight:7, noise:0.2, symbol:'S', hidden:true,  range:7, attackRate:0.6, accuracy:0.88 },
    VC_MORTAR:  { id:'VC_MORTAR',  name:'VC Mortar Team',       faction:'vc', hp:55,  atk:85, def:8,  spd:0.8, sight:3, noise:4.0, symbol:'M', hidden:true,  range:7, attackRate:0.3, accuracy:0.80 },
    VC_TUNNEL:  { id:'VC_TUNNEL',  name:'Tunnel Complex',       faction:'vc', hp:200, atk:18, def:80, spd:0.0, sight:2, noise:0.0, symbol:'T', hidden:true,  stationary:true, attackRate:0.4, accuracy:0.70 },
    VC_COMMAND: { id:'VC_COMMAND', name:'VC Command Cell',      faction:'vc', hp:110, atk:30, def:18, spd:1.2, sight:5, noise:0.5, symbol:'C', hidden:true,  attackRate:1.0, accuracy:0.65 },
    VC_RPG:     { id:'VC_RPG',     name:'VC RPG Team',          faction:'vc', hp:55,  atk:90, def:8,  spd:1.2, sight:4, noise:3.0, symbol:'P', hidden:true,  range:6, attackRate:0.35, accuracy:0.55, aoe:1.2 },
    VC_RPK:     { id:'VC_RPK',     name:'RPK Machine Gunner',   faction:'vc', hp:65,  atk:20, def:12, spd:1.0, sight:4, noise:4.5, symbol:'K', hidden:false, range:3, attackRate:3.8, accuracy:0.48, burst:true },
    NVA_REG:    { id:'NVA_REG',    name:'NVA Regular Infantry', faction:'vc', hp:100, atk:45, def:28, spd:1.4, sight:4, noise:2.0, symbol:'N', hidden:false, attackRate:1.4, accuracy:0.64 },
    NVA_HEAVY:  { id:'NVA_HEAVY',  name:'NVA Heavy Weapons',   faction:'vc', hp:120, atk:75, def:22, spd:1.0, sight:3, noise:3.5, symbol:'W', hidden:false, range:5, attackRate:0.5, accuracy:0.68 },
    NVA_TANK:   { id:'NVA_TANK',   name:'T-54 Tank',            faction:'vc', hp:240, atk:75, def:60, spd:1.2, sight:3, noise:5.0, symbol:'K', hidden:false, attackRate:0.6, accuracy:0.70 },
  },

  /* ── LSTM CONFIG ── */
  LSTM: {
    INPUT_SIZE:  12,
    HIDDEN_SIZE: 20,
    OUTPUT_SIZE:  5,
    LR: 0.015,
    INPUT_LABELS: [
      'Artillery Used','Air Strikes','Napalm Used','Recon Deployed',
      'Infantry Deployed','Armor Deployed','Helicopters','Chemical Agents',
      'Naval Strikes','Enemy Contacts','US Casualties','Time Pressure'
    ],
    OUTPUT_LABELS: ['Hide/Tunnel','Ambush','Disperse','Mortar Attack','Counterattack'],
  },

  /* ── PUBLIC OPINION ── */
  OPINION_START: 100,
  OPINION_THRESHOLDS: [90, 80, 70, 60, 50, 40, 30],

  /* ── ANTIWAR EVENTS (triggered when opinion drops below threshold) ── */
  ANTIWAR_EVENTS: [
    { threshold: 90, year: 1965, headline: 'Anti-War Protests Begin in Major Cities', story: 'Students and activists across the country stage protests against U.S. involvement in Vietnam. The movement is small but vocal, with marches in New York, San Francisco, and Washington D.C. The administration dismisses the protesters as a fringe minority.', icon: '✊', opinionDrop: 0, scorePenalty: 200 },
    { threshold: 80, year: 1967, headline: 'March on the Pentagon Draws 100,000 Protesters', story: 'One of the largest anti-war demonstrations in American history sees over 100,000 people march on Washington D.C. Confrontations between protesters and soldiers are broadcast on national television. Public support for the war continues to erode.', icon: '📢', opinionDrop: 0, scorePenalty: 400 },
    { threshold: 70, year: 1968, headline: 'My Lai Massacre Reported — Public Outrage', story: 'Reports emerge that U.S. soldiers killed between 347 and 504 unarmed South Vietnamese civilians in the hamlet of My Lai. The revelation shocks the American public and severely damages the military\'s credibility. Protests intensify nationwide.', icon: '📰', opinionDrop: 0, scorePenalty: 600 },
    { threshold: 60, year: 1970, headline: 'Kent State: National Guard Kills Four Students', story: 'Ohio National Guard soldiers open fire on student protesters at Kent State University, killing four and wounding nine. The killings trigger a nationwide student strike, closing hundreds of universities. The image of dead students on American soil galvanizes the anti-war movement.', icon: '🕊️', opinionDrop: 0, scorePenalty: 1000 },
    { threshold: 50, year: 1971, headline: 'Pentagon Papers Published — Government Deceived Public', story: 'The New York Times begins publishing the Pentagon Papers, classified documents revealing that the government systematically lied to Congress and the public about the scope and progress of the war. Public trust in the government collapses to historic lows.', icon: '📃', opinionDrop: 0, scorePenalty: 1200 },
    { threshold: 40, year: 1971, headline: 'Vietnam Veterans Against the War: "Who Will Be Last to Die?"', story: 'Hundreds of decorated Vietnam veterans throw their medals onto the steps of the Capitol building in protest. John Kerry asks Congress: "How do you ask a man to be the last man to die for a mistake?" The testimony is broadcast live and watched by millions.', icon: '🎖️', opinionDrop: 0, scorePenalty: 800 },
    { threshold: 30, year: 1973, headline: 'Congress Passes War Powers Resolution — Limits Presidential Power', story: 'Overriding a presidential veto, Congress passes the War Powers Resolution, requiring the President to notify Congress within 48 hours of committing armed forces and prohibiting forces from being committed for more than 60 days without authorization. The era of unchecked presidential war powers is over.', icon: '⚖️', opinionDrop: 0, scorePenalty: 500 },
  ],

  /* ── HISTORICAL DOCS (for the Documents library) ── */

  /* ── SCORING ── */
  SCORE: {
    ENEMY_KILL:        50,
    OBJECTIVE_CAPTURE: 500,
    BATTLE_WIN:        2000,
    BATTLE_LOSS:       -1000,
    US_CASUALTY:       -30,
    CIVILIAN_KILL:     -200,
    AGENT_ORANGE_USE:  -100,
    NAPALM_CIVILIAN:   -300,
    TIME_BONUS_MAX:    500,
  },

  /* ── SOUND LEVELS ── */
  SOUND_THRESHOLD: 3.5,
  SOUND_DECAY:     0.85,
};

/* Convenience: get tile config by id number */
CONFIG.tileById = (function() {
  const map = {};
  for (const key of Object.keys(CONFIG.TILES)) {
    map[CONFIG.TILES[key].id] = CONFIG.TILES[key];
  }
  return (id) => map[id] || CONFIG.TILES.CLEARING;
})();
