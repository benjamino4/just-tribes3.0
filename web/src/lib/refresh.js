// ═══════════════════════════════════════════════════════════════════
// FILE: web/src/lib/refresh.js
// PURPOSE: Measure the display's native refresh rate.
// DEPENDS ON: nothing
// ═══════════════════════════════════════════════════════════════════
export function measureRefreshRate(durationMs = 500) {
  return new Promise((resolve) => {
    let frames = 0;
    const start = performance.now();
    function tick() {
      frames++;
      const elapsed = performance.now() - start;
      if (elapsed > durationMs) {
        const fps = frames / (elapsed / 1000);
        resolve(Math.round(fps / 10) * 10);
        return;
      }
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  });
}