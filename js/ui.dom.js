// js/ui.dom.js  MOB STREET - 1P RUN  (DOM / UI)
(() => {
  "use strict";

  const MOB = (window.MOB = window.MOB || {});
  const CONFIG = MOB.CONFIG;

  const ui = (MOB.ui = MOB.ui || {});
  ui.canvas = document.getElementById("gameCanvas");
  ui.ctx = ui.canvas.getContext("2d");

  // DOM refs
  const topRight = document.getElementById("topRight");
  const top8 = document.getElementById("top8");
  const stockBar = document.getElementById("stockBar");

  // ★ジャンプブースト用：ゲージDOMを追加（CSSは既存barを流用）
  let jbBar = null;
  (function ensureJBBar(){
    const gauge = document.querySelector(".gauge");
    if (!gauge) return;
    jbBar = document.createElement("div");
    jbBar.className = "gauge__bar";
    jbBar.style.marginTop = "8px";
    gauge.appendChild(jbBar);
  })();

  ui.resize = function resize() {
    const rect = ui.canvas.getBoundingClientRect();
    ui.canvas.width = Math.floor(rect.width * window.devicePixelRatio);
    ui.canvas.height = Math.floor(rect.height * window.devicePixelRatio);
  };

  ui.updateTop8 = function updateTop8() {
    const rs = MOB.state.runners.slice(0, 8);
    let html = `<div class="h">TOP 8</div>`;
    rs.forEach((r, i) => {
      const me = r.isPlayer ? " me" : "";
      html += `<div class="row${me}"><span>${i+1}. ${r.name}</span><span>${Math.floor(r.x/CONFIG.PX_PER_M)}m</span></div>`;
    });
    top8.innerHTML = html;
  };

  ui.updateRank = function updateRank() {
    const me = MOB.state.runners.find(r => r.isPlayer);
    const idx = MOB.state.runners.indexOf(me) + 1;
    topRight.textContent = `RANK ${idx}/${MOB.state.runners.length}`;
  };

  ui.updateStockBars = function updateStockBars() {
    const me = MOB.state.runners.find(r => r.isPlayer);
    const p1 = (me.stockBoost / CONFIG.STOCK_MAX) * 100;
    stockBar.style.setProperty("--p", p1 + "%");
    stockBar.style.background = "rgba(255,255,255,0.12)";
    stockBar.style.position = "relative";
    stockBar.style.setProperty("overflow", "hidden");
    stockBar.style.setProperty("--fill", p1 + "%");
    stockBar.style.setProperty("width", "100%");

    stockBar.style.setProperty("--w", p1 + "%");
    stockBar.style.setProperty("background", "rgba(255,255,255,0.12)");
    stockBar.style.setProperty("position", "relative");
    stockBar.style.setProperty("overflow", "hidden");
    stockBar.style.setProperty("height", "12px");
    stockBar.style.setProperty("borderRadius", "999px");
    stockBar.style.setProperty("boxShadow", "inset 0 0 0 999px rgba(0,0,0,0)");

    stockBar.style.setProperty("background", "linear-gradient(90deg, var(--accent) var(--w), rgba(255,255,255,0.12) var(--w))");

    if (jbBar) {
      const p2 = (me.stockJB / CONFIG.STOCK_MAX) * 100;
      jbBar.style.setProperty("--w", p2 + "%");
      jbBar.style.setProperty("height", "12px");
      jbBar.style.setProperty("borderRadius", "999px");
      jbBar.style.setProperty("background", "linear-gradient(90deg, #ffcf5a var(--w), rgba(255,255,255,0.12) var(--w))");
    }
  };

  ui.showResult = function showResult() {
    const modal = document.getElementById("resultModal");
    if (!modal) return;
    modal.style.display = "flex";
  };

  window.addEventListener("resize", ui.resize);
  ui.resize();
})();
