/* ============================================================
   LSTM — Long Short-Term Memory Neural Network
   The enemy AI brain. Learns from every player action.
   ============================================================ */
const LSTM = (() => {

  const IN  = CONFIG.LSTM.INPUT_SIZE;
  const H   = CONFIG.LSTM.HIDDEN_SIZE;
  const OUT = CONFIG.LSTM.OUTPUT_SIZE;
  const LR  = CONFIG.LSTM.LR;

  /* ── LSTM LAYER ── */
  class LSTMLayer {
    constructor(inSize, hidSize) {
      this.in  = inSize;
      this.h   = hidSize;
      const sz = inSize + hidSize;
      /* 4 gates: forget, input, cell, output */
      this.Wf = Utils.randMatrix(hidSize, sz,   0.08);
      this.Wi = Utils.randMatrix(hidSize, sz,   0.08);
      this.Wg = Utils.randMatrix(hidSize, sz,   0.08);
      this.Wo = Utils.randMatrix(hidSize, sz,   0.08);
      this.bf = Utils.zeros(hidSize);
      this.bi = Utils.zeros(hidSize);
      this.bg = Utils.zeros(hidSize);
      this.bo = Utils.zeros(hidSize);

      /* Bias forget gate towards 1 for stability */
      for (let i = 0; i < hidSize; i++) this.bf[i] = 1.0;

      /* Hidden + cell state */
      this.hState = Utils.zeros(hidSize);
      this.cState = Utils.zeros(hidSize);

      /* Save for learning */
      this._lastF = Utils.zeros(hidSize);
      this._lastI = Utils.zeros(hidSize);
      this._lastG = Utils.zeros(hidSize);
      this._lastO = Utils.zeros(hidSize);
      this._lastCombined = null;
    }

    reset() {
      this.hState = Utils.zeros(this.h);
      this.cState = Utils.zeros(this.h);
    }

    forward(x) {
      const combined = new Float32Array(this.in + this.h);
      combined.set(x, 0);
      combined.set(this.hState, this.in);

      const _apS = v => { const a = new Float32Array(v.length); for(let k=0;k<v.length;k++) a[k]=Utils.sigmoid(v[k]); return a; };
      const _apT = v => { const a = new Float32Array(v.length); for(let k=0;k<v.length;k++) a[k]=Math.tanh(v[k]); return a; };
      const f = _apS(Utils.matVecMul(this.Wf, combined, this.bf));
      const i = _apS(Utils.matVecMul(this.Wi, combined, this.bi));
      const g = _apT(Utils.matVecMul(this.Wg, combined, this.bg));
      const o = _apS(Utils.matVecMul(this.Wo, combined, this.bo));

      const cNew = new Float32Array(this.h);
      const hNew = new Float32Array(this.h);
      for (let j = 0; j < this.h; j++) {
        cNew[j] = f[j] * this.cState[j] + i[j] * g[j];
        hNew[j] = o[j] * Math.tanh(cNew[j]);
      }
      this.cState = cNew;
      this.hState = hNew;

      this._lastF = f;
      this._lastI = i;
      this._lastG = g;
      this._lastO = o;
      this._lastCombined = combined;

      return hNew;
    }

    /* Simple gradient nudge based on reward signal */
    nudge(reward) {
      if (!this._lastCombined) return;
      const lr = LR * reward;
      const sz = this.in + this.h;
      for (let r = 0; r < this.h; r++) {
        for (let c = 0; c < sz; c++) {
          const idx = r * sz + c;
          const x   = this._lastCombined[c];
          this.Wf.data[idx] += lr * this._lastF[r] * (1-this._lastF[r]) * x * 0.1;
          this.Wi.data[idx] += lr * this._lastI[r] * (1-this._lastI[r]) * x * 0.1;
          this.Wg.data[idx] += lr * (1-this._lastG[r]**2) * x * 0.1;
          this.Wo.data[idx] += lr * this._lastO[r] * (1-this._lastO[r]) * x * 0.1;
        }
      }
    }
  }

  /* ── FULL NETWORK ── */
  class LSTMNetwork {
    constructor() {
      this.layer1 = new LSTMLayer(IN, H);
      this.layer2 = new LSTMLayer(H, H);
      this.Wout   = Utils.randMatrix(OUT, H, 0.1);
      this.bout   = Utils.zeros(OUT);

      /* Learning history */
      this.inputHistory  = [];
      this.outputHistory = [];
      this.nodeActivations = [];
      this.adaptationCount = 0;
      this.threatLevel   = 0.2;

      /* Per-battle accumulator for LSTM input */
      this._inputAccum   = new Float32Array(IN);
      this._inputCounts  = new Float32Array(IN);
      this._tickCount    = 0;

      /* Saved for visualization */
      this.lastH1 = Utils.zeros(H);
      this.lastH2 = Utils.zeros(H);
      this.lastOutput = Utils.zeros(OUT);
      this.lastInput  = Utils.zeros(IN);
    }

    /* Build input vector from game state snapshot */
    buildInput(gameState) {
      const gs = gameState;
      const maxVal = [20, 10, 5, 5, 30, 10, 10, 3, 5, 50, 40, 600];
      return new Float32Array([
        Utils.clamp(gs.artilleryUsed  / maxVal[0], 0, 1),
        Utils.clamp(gs.airStrikesUsed / maxVal[1], 0, 1),
        Utils.clamp(gs.napalmUsed     / maxVal[2], 0, 1),
        Utils.clamp(gs.reconDeployed  / maxVal[3], 0, 1),
        Utils.clamp(gs.infantryDeploy / maxVal[4], 0, 1),
        Utils.clamp(gs.armorDeployed  / maxVal[5], 0, 1),
        Utils.clamp(gs.heliDeployed   / maxVal[6], 0, 1),
        Utils.clamp(gs.chemUsed       / maxVal[7], 0, 1),
        Utils.clamp(gs.navalUsed      / maxVal[8], 0, 1),
        Utils.clamp(gs.enemyContacts  / maxVal[9], 0, 1),
        Utils.clamp(gs.usCasualties   / maxVal[10],0, 1),
        Utils.clamp(gs.elapsed        / maxVal[11],0, 1),
      ]);
    }

    /* Forward pass — returns output probabilities */
    tick(gameState) {
      const input = this.buildInput(gameState);
      this.lastInput = input;

      const h1 = this.layer1.forward(input);
      const h2 = this.layer2.forward(h1);

      const rawOut = Utils.matVecMul(this.Wout, h2, this.bout);
      const output = Utils.softmax(Array.from(rawOut));

      this.lastH1 = h1;
      this.lastH2 = h2;
      this.lastOutput = output;

      /* Update threat level */
      this.threatLevel = Utils.clamp(
        0.2 + output[1] * 0.4 + output[4] * 0.4 + this.adaptationCount * 0.02,
        0, 1
      );

      /* Store history for ablation */
      this.inputHistory.push(Array.from(input));
      this.outputHistory.push([...output]);
      this.nodeActivations.push(Array.from(h2.slice(0, 8)));

      /* Cap history to last 200 ticks */
      if (this.inputHistory.length > 200) {
        this.inputHistory.shift();
        this.outputHistory.shift();
        this.nodeActivations.shift();
      }

      this._tickCount++;
      return output;
    }

    /* Called after each battle — reward = 1 (VC won) or -1 (US won) */
    learn(vcWon, battleStats) {
      const reward = vcWon ? 1.0 : -0.8;
      this.layer1.nudge(reward);
      this.layer2.nudge(reward);

      /* Nudge output weights */
      const lr = LR * reward;
      for (let r = 0; r < OUT; r++) {
        for (let c = 0; c < H; c++) {
          this.Wout.data[r * H + c] += lr * this.lastH2[c] * this.lastOutput[r] * 0.05;
        }
      }

      this.adaptationCount++;
    }

    /* Reset hidden state between battles (but KEEP weights) */
    resetState() {
      this.layer1.reset();
      this.layer2.reset();
      this._inputAccum.fill(0);
      this._inputCounts.fill(0);
      this._tickCount = 0;
    }

    /* ── ABLATION STUDY ──
       For each input, zero it out in history and measure output change.
       Returns array of {label, contribution, color} sorted descending. */
    ablationTest() {
      if (this.inputHistory.length < 2) {
        return CONFIG.LSTM.INPUT_LABELS.map((label, i) => ({
          label,
          contribution: Math.random() * 0.3 + 0.02,
          color: _ablationColor(i),
        }));
      }

      /* Baseline: avg output entropy over history */
      const baselineEntropy = this._avgEntropy(this.outputHistory);

      const contributions = [];
      for (let dim = 0; dim < IN; dim++) {
        /* Temporarily zero this dimension */
        const modifiedOutputs = [];
        this._tempReset();

        for (let t = 0; t < this.inputHistory.length; t++) {
          const inp = [...this.inputHistory[t]];
          inp[dim] = 0;
          const h1 = this.layer1.forward(new Float32Array(inp));
          const h2 = this.layer2.forward(h1);
          const rawOut = Utils.matVecMul(this.Wout, h2, this.bout);
          modifiedOutputs.push(Utils.softmax(Array.from(rawOut)));
        }
        this._tempReset();

        const modifiedEntropy = this._avgEntropy(modifiedOutputs);
        const delta = Math.abs(baselineEntropy - modifiedEntropy);
        contributions.push({ label: CONFIG.LSTM.INPUT_LABELS[dim], contribution: delta, color: _ablationColor(dim), dim });
      }

      /* Restore actual state */
      this.resetState();
      for (const inp of this.inputHistory) {
        const h1 = this.layer1.forward(new Float32Array(inp));
        this.layer2.forward(h1);
      }

      /* Normalize to sum = 1 */
      const total = contributions.reduce((s, c) => s + c.contribution, 0) || 1;
      contributions.forEach(c => c.contribution /= total);

      return contributions.sort((a, b) => b.contribution - a.contribution);
    }

    _tempReset() {
      this.layer1.hState = Utils.zeros(H);
      this.layer1.cState = Utils.zeros(H);
      this.layer2.hState = Utils.zeros(H);
      this.layer2.cState = Utils.zeros(H);
    }

    _avgEntropy(outputs) {
      if (!outputs.length) return 0;
      let total = 0;
      for (const out of outputs) {
        let e = 0;
        for (const p of out) { if (p > 1e-9) e -= p * Math.log(p); }
        total += e;
      }
      return total / outputs.length;
    }

    /* ── VISUALIZATION DATA ── */
    getVizData() {
      return {
        inputs:      Array.from(this.lastInput),
        h1:          Array.from(this.lastH1.slice(0, 10)),
        h2:          Array.from(this.lastH2.slice(0, 10)),
        outputs:     Array.from(this.lastOutput),
        threat:      this.threatLevel,
        adaptations: this.adaptationCount,
        outputLabels: CONFIG.LSTM.OUTPUT_LABELS,
        inputLabels:  CONFIG.LSTM.INPUT_LABELS,
      };
    }
  }

  function _ablationColor(i) {
    const colors = ['#4a8a2a','#6abf3a','#c8820a','#f5a623','#aa2010','#e03020','#2244aa','#4488ff','#8844aa','#cc66ff','#2a8a6a','#44ffcc'];
    return colors[i % colors.length];
  }

  /* ── PUBLIC API ── */
  const net = new LSTMNetwork();

  return {
    network: net,
    tick:         (gs)     => net.tick(gs),
    learn:        (won, s) => net.learn(won, s),
    resetState:   ()       => net.resetState(),
    ablationTest: ()       => net.ablationTest(),
    getVizData:   ()       => net.getVizData(),
    getThreat:    ()       => net.threatLevel,
    getAdaptations: ()     => net.adaptationCount,
    getOutputLabels: ()    => CONFIG.LSTM.OUTPUT_LABELS,
    /* Behavior index constants */
    B_HIDE:       0,
    B_AMBUSH:     1,
    B_DISPERSE:   2,
    B_MORTAR:     3,
    B_COUNTER:    4,
  };
})();
