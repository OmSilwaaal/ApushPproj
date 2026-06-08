/* ============================================================
   MAIN — Entry point. Initialize everything when DOM is ready.
   ============================================================ */
(function() {
  'use strict';

  /* Polyfill roundRect for older browsers */
  if (!CanvasRenderingContext2D.prototype.roundRect) {
    CanvasRenderingContext2D.prototype.roundRect = function(x, y, w, h, r) {
      r = Math.min(r, w / 2, h / 2);
      this.beginPath();
      this.moveTo(x + r, y);
      this.lineTo(x + w - r, y);
      this.quadraticCurveTo(x + w, y, x + w, y + r);
      this.lineTo(x + w, y + h - r);
      this.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
      this.lineTo(x + r, y + h);
      this.quadraticCurveTo(x, y + h, x, y + h - r);
      this.lineTo(x, y + r);
      this.quadraticCurveTo(x, y, x + r, y);
      this.closePath();
    };
  }

  /* Initialize game when DOM is ready */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => Game.init());
  } else {
    Game.init();
  }

  /* Global error handler — show friendly message */
  window.addEventListener('error', e => {
    console.error('Game error:', e.error);
  });
})();
