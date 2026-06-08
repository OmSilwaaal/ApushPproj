/* ============================================================
   SOUND — Web Audio API procedural sounds
   ============================================================ */
const SoundSystem = (() => {

  let _ctx  = null;
  let _muted = false;
  let _vol   = 0.4;
  let _masterGain = null;

  function init() {
    try {
      _ctx = new (window.AudioContext || window.webkitAudioContext)();
      _masterGain = _ctx.createGain();
      _masterGain.gain.value = _vol;
      _masterGain.connect(_ctx.destination);
    } catch (e) {
      console.warn('Web Audio API unavailable:', e);
    }
  }

  function _resume() {
    if (_ctx && _ctx.state === 'suspended') _ctx.resume();
  }

  /* ── PRIMITIVE GENERATORS ── */

  function _noise(duration, filterFreq, filterQ, gainVal, decay) {
    if (!_ctx || _muted) return;
    _resume();

    const bufSz  = Math.ceil(_ctx.sampleRate * duration);
    const buffer = _ctx.createBuffer(1, bufSz, _ctx.sampleRate);
    const data   = buffer.getChannelData(0);
    for (let i = 0; i < bufSz; i++) data[i] = Math.random() * 2 - 1;

    const src    = _ctx.createBufferSource();
    src.buffer   = buffer;

    const filter = _ctx.createBiquadFilter();
    filter.type  = 'bandpass';
    filter.frequency.value = filterFreq;
    filter.Q.value = filterQ;

    const gain   = _ctx.createGain();
    gain.gain.setValueAtTime(gainVal, _ctx.currentTime);
    if (decay) gain.gain.exponentialRampToValueAtTime(0.001, _ctx.currentTime + duration);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(_masterGain);
    src.start();
    src.stop(_ctx.currentTime + duration);
  }

  function _tone(freq, duration, type, gainVal, decay) {
    if (!_ctx || _muted) return;
    _resume();

    const osc    = _ctx.createOscillator();
    osc.type     = type || 'sine';
    osc.frequency.value = freq;

    const gain   = _ctx.createGain();
    gain.gain.setValueAtTime(gainVal, _ctx.currentTime);
    if (decay) gain.gain.exponentialRampToValueAtTime(0.001, _ctx.currentTime + duration);

    osc.connect(gain);
    gain.connect(_masterGain);
    osc.start();
    osc.stop(_ctx.currentTime + duration);
  }

  function _bump(freq, endFreq, duration, gainVal) {
    if (!_ctx || _muted) return;
    _resume();

    const osc    = _ctx.createOscillator();
    osc.type     = 'sawtooth';
    osc.frequency.setValueAtTime(freq, _ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(endFreq, _ctx.currentTime + duration);

    const gain   = _ctx.createGain();
    gain.gain.setValueAtTime(gainVal, _ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, _ctx.currentTime + duration);

    osc.connect(gain);
    gain.connect(_masterGain);
    osc.start();
    osc.stop(_ctx.currentTime + duration);
  }

  /* ── SOUND EFFECTS ── */

  const SOUNDS = {
    gunshot() {
      /* Short sharp crack */
      _noise(0.08, 1200, 2, 0.5, true);
      _tone(200, 0.04, 'square', 0.15, true);
    },
    explosion() {
      /* Low boom + noise */
      _noise(0.6, 150, 0.5, 0.8, true);
      _bump(120, 30, 0.5, 0.4);
    },
    artillery() {
      /* Artillery fire — loud boom */
      _noise(0.9, 80, 0.3, 0.9, true);
      _bump(200, 40, 0.7, 0.5);
      setTimeout(() => _noise(0.4, 200, 1, 0.4, true), 300);
    },
    napalm() {
      /* Fire whoosh */
      _noise(1.5, 400, 1, 0.6, true);
      _tone(60, 1.5, 'sine', 0.3, true);
    },
    helicopter() {
      /* Thrum */
      for (let i = 0; i < 4; i++) {
        setTimeout(() => _tone(80 + i*5, 0.1, 'sawtooth', 0.2, true), i * 120);
      }
    },
    jet() {
      /* Jet engine pass */
      _noise(0.3, 3000, 0.8, 0.4, true);
      setTimeout(() => _noise(0.4, 1000, 1, 0.3, true), 200);
    },
    deploy() {
      /* Click confirm */
      _tone(440, 0.05, 'square', 0.15, true);
      setTimeout(() => _tone(660, 0.05, 'square', 0.1, true), 60);
    },
    alert() {
      /* Warning beep */
      _tone(880, 0.1, 'square', 0.2, true);
      setTimeout(() => _tone(880, 0.1, 'square', 0.2, true), 200);
    },
    opinionDrop() {
      /* Low warning tone */
      _tone(220, 0.5, 'sine', 0.15, true);
    },
    victory() {
      /* Simple chord */
      [261, 329, 392].forEach((f, i) => {
        setTimeout(() => _tone(f, 0.8, 'sine', 0.15, true), i * 100);
      });
    },
    defeat() {
      _bump(440, 110, 1.0, 0.2);
    },
    uiClick() {
      _tone(660, 0.04, 'square', 0.08, true);
    },
    hover() {
      _tone(880, 0.02, 'sine', 0.04, true);
    },
  };

  function play(name, _position) {
    /* Position is unused (no spatial audio) but kept for API compatibility */
    if (_muted || !_ctx) return;
    const fn = SOUNDS[name];
    if (fn) {
      try { fn(); } catch(e) { /* ignore */ }
    }
  }

  function setMuted(m) { _muted = m; }
  function setVolume(v) {
    _vol = v;
    if (_masterGain) _masterGain.gain.value = v;
  }
  function isMuted() { return _muted; }

  return { init, play, setMuted, setVolume, isMuted };
})();
