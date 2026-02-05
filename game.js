// game.js (LOADER)  MOB STREET - 1P RUN
// Loads split scripts WITHOUT changing HTML.
// VERSION TAG is appended to each script URL to avoid cache delay on GitHub Pages.

(() => {
  "use strict";

  // ★ここだけ変えれば全JSのキャッシュが一括更新されます
  const BUILD = "v6.7-brief-goal-ghost";

  const SCRIPTS = [
    "js/config.js",
    "js/state.js",
    "js/world.js",
    "js/physics.js",
    "js/ui.dom.js",
    "js/draw.js",
    "js/loop.js",
  ];

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const el = document.createElement("script");
      el.src = `${src}?v=${encodeURIComponent(BUILD)}`;
      el.async = false; // keep order
      el.onload = () => resolve();
      el.onerror = () => reject(new Error("Failed to load script: " + src));
      document.head.appendChild(el);
    });
  }

  (async () => {
    try {
      for (const s of SCRIPTS) await loadScript(s);
      if (window.MOB && typeof window.MOB.boot === "function") {
        window.MOB.boot();
      } else {
        throw new Error("MOB.boot() not found after loading scripts.");
      }
    } catch (e) {
      console.error(e);
      // If overlay exists, show error
      const overlay = document.getElementById("overlay");
      const overlayTitle = document.getElementById("overlayTitle");
      const overlayMsg = document.getElementById("overlayMsg");
      if (overlay) overlay.style.display = "block";
      if (overlayTitle) overlayTitle.textContent = "Error";
      if (overlayMsg) overlayMsg.textContent = String(e);
    }
  })();
})();
