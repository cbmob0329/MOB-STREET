// js/loop.js  MOB STREET - 1P RUN  (BOOT / INPUT / LOOP)
(() => {
  "use strict";

  const MOB = (window.MOB = window.MOB || {});
  const CONFIG = MOB.CONFIG;

  function fitCanvasToPlayArea() {
    const canvas = MOB.ui.canvas;

    let top = null;
    const rects = [];
    if (MOB.ui.btnJump) rects.push(MOB.ui.btnJump.getBoundingClientRect());
    if (MOB.ui.btnBoost) rects.push(MOB.ui.btnBoost.getBoundingClientRect());
    if (MOB.ui.btnItem) rects.push(MOB.ui.btnItem.getBoundingClientRect());

    for (const r of rects) {
      if (r && r.top > 0) top = (top === null) ? r.top : Math.min(top, r.top);
    }
    if (top === null) top = Math.floor(window.innerHeight * 0.65);

    const safePad = 6;
    const playH = Math.max(260, Math.floor(top - safePad));

    canvas.style.width = "100%";
    canvas.style.height = playH + "px";
    canvas.style.display = "block";
  }

  function resizeCanvas() {
    const canvas = MOB.ui.canvas;
    const ctx = MOB.ui.ctx;

    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const r = canvas.getBoundingClientRect();
    const w = Math.max(1, Math.floor(r.width));
    const h = Math.max(1, Math.floor(r.height));
    canvas.width = Math.max(1, Math.floor(w * dpr));
    canvas.height = Math.max(1, Math.floor(h * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function bindInput() {
    const input = MOB.input;

    MOB.ui.btnJump?.addEventListener("pointerdown", () => { input.jump = true; });
    MOB.ui.btnBoost?.addEventListener("pointerdown", () => { input.boost = true; });

    window.addEventListener("keydown", e => {
      if (e.key === " ") input.jump = true;
      if (e.key === "b") input.boost = true;
    });

    // ITEM無効
    if (MOB.ui.btnItem) {
      MOB.ui.btnItem.style.opacity = "0.35";
      MOB.ui.btnItem.style.filter = "grayscale(0.7)";
      MOB.ui.btnItem.style.pointerEvents = "none";
    }
  }

  function updateCountdown(dt) {
    MOB.state.countdown -= dt;
    if (MOB.state.countdown <= 0) MOB.state.phase = "run";
  }

  function update(dt) {
    if (MOB.state.phase === "brief") {
      MOB.updateRank();
      MOB.updateTop8();
      MOB.ui.updateStockBar();
      return;
    }
    if (MOB.state.phase === "countdown") {
      updateCountdown(dt);
      MOB.updateRank();
      MOB.updateTop8();
      MOB.ui.updateStockBar();
      return;
    }
    if (MOB.state.phase === "run") {
      MOB.updateRun(dt);
      return;
    }
  }

  function loop(t) {
    const dt = Math.min((t - MOB.state.lastTime) / 1000, 0.033);
    MOB.state.lastTime = t;

    if (MOB.state.phase !== "loading") {
      update(dt);
    }
    MOB.render();
    requestAnimationFrame(loop);
  }

  async function boot() {
    try {
      MOB.state.phase = "loading";
      if (MOB.ui.overlay) MOB.ui.overlay.style.display = "block";
      if (MOB.ui.overlayTitle) MOB.ui.overlayTitle.textContent = "Loading";
      if (MOB.ui.overlayMsg) MOB.ui.overlayMsg.textContent = "assets";

      await MOB.loadAssets((file) => {
        if (MOB.ui.overlayTitle) MOB.ui.overlayTitle.textContent = "Loading";
        if (MOB.ui.overlayMsg) MOB.ui.overlayMsg.textContent = file;
      });

      // layout stabilize
      fitCanvasToPlayArea();
      resizeCanvas();
      MOB.ui.attachVersionBadge();
      MOB.ui.ensureStockBarFill();

      await new Promise(res => requestAnimationFrame(() => res()));
      fitCanvasToPlayArea();
      resizeCanvas();
      MOB.ui.attachVersionBadge();
      MOB.ui.ensureStockBarFill();

      if (MOB.ui.overlay) MOB.ui.overlay.style.display = "none";

      MOB.initRace(0);

      MOB.state.lastTime = performance.now();
      MOB.state.phase = "brief";
      requestAnimationFrame(loop);
    } catch (e) {
      if (MOB.ui.overlay) {
        MOB.ui.overlay.style.display = "block";
        if (MOB.ui.overlayTitle) MOB.ui.overlayTitle.textContent = "Error";
        if (MOB.ui.overlayMsg) MOB.ui.overlayMsg.textContent = String(e);
      }
      console.error(e);
    }
  }

  window.addEventListener("resize", () => {
    fitCanvasToPlayArea();
    resizeCanvas();
    MOB.ui.attachVersionBadge();
    MOB.ui.ensureStockBarFill();
  });

  MOB.boot = function mobBoot() {
    // ensure UI ready
    MOB.ui.attachVersionBadge();
    bindInput();
    boot();
  };
})();
