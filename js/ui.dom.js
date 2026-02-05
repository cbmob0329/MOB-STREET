// js/ui.dom.js  MOB STREET - 1P RUN  (DOM UI / MODALS / OVERLAYS)
(() => {
  "use strict";

  const MOB = (window.MOB = window.MOB || {});
  const CONFIG = MOB.CONFIG;

  const ui = (MOB.ui = MOB.ui || {});

  ui.canvas = document.getElementById("gameCanvas");
  ui.ctx = ui.canvas.getContext("2d", { alpha: false });

  ui.overlay = document.getElementById("overlay");
  ui.overlayTitle = document.getElementById("overlayTitle");
  ui.overlayMsg = document.getElementById("overlayMsg");

  ui.btnJump = document.getElementById("btnJump");
  ui.btnBoost = document.getElementById("btnBoost");
  ui.btnItem = document.getElementById("btnJumpBoost"); // 今は無効

  // ===== MOBILE LOCK (no select/zoom) =====
  (function lockMobile() {
    const prevent = (e) => { e.preventDefault(); };
    ["dblclick", "contextmenu", "gesturestart", "gesturechange", "gestureend"].forEach(ev => {
      document.addEventListener(ev, prevent, { passive: false });
    });
    window.addEventListener("touchmove", prevent, { passive: false });
    document.documentElement.style.webkitUserSelect = "none";
    document.documentElement.style.userSelect = "none";
  })();

  // ===== TOP8 =====
  ui.ensureTop8Panel = function ensureTop8Panel() {
    let el = document.getElementById("jsTop8");
    if (!el) {
      el = document.createElement("div");
      el.id = "jsTop8";
      el.style.position = "fixed";
      el.style.left = "10px";
      el.style.top = "64px";
      el.style.zIndex = "99998";
      el.style.width = "190px";
      el.style.maxHeight = "220px";
      el.style.overflow = "hidden";
      el.style.padding = "8px 10px";
      el.style.borderRadius = "12px";
      el.style.background = "rgba(0,0,0,0.28)";
      el.style.backdropFilter = "blur(6px)";
      el.style.color = "rgba(255,255,255,0.92)";
      el.style.font = "12px system-ui";
      el.style.lineHeight = "1.35";
      el.style.pointerEvents = "none";
      el.style.whiteSpace = "pre";
      document.body.appendChild(el);
    }
    ui.top8Panel = el;
    return el;
  };
  ui.ensureTop8Panel();

  // ===== RESULT MODAL =====
  ui.ensureResultModal = function ensureResultModal() {
    let modal = document.getElementById("jsResultModal");
    if (modal) return modal;

    modal = document.createElement("div");
    modal.id = "jsResultModal";
    modal.style.position = "fixed";
    modal.style.left = "0";
    modal.style.top = "0";
    modal.style.right = "0";
    modal.style.bottom = "0";
    modal.style.zIndex = "99999";
    modal.style.display = "none";
    modal.style.alignItems = "center";
    modal.style.justifyContent = "center";
    modal.style.background = "rgba(0,0,0,0.45)";
    modal.style.backdropFilter = "blur(6px)";
    modal.style.pointerEvents = "auto";

    const card = document.createElement("div");
    card.style.width = "min(92vw, 420px)";
    card.style.maxHeight = "min(74vh, 560px)";
    card.style.display = "flex";
    card.style.flexDirection = "column";
    card.style.borderRadius = "16px";
    card.style.background = "rgba(10,12,18,0.92)";
    card.style.border = "1px solid rgba(255,255,255,0.10)";
    card.style.boxShadow = "0 20px 60px rgba(0,0,0,0.55)";
    card.style.overflow = "hidden";

    const head = document.createElement("div");
    head.style.padding = "14px 14px 10px";
    head.style.borderBottom = "1px solid rgba(255,255,255,0.10)";
    head.innerHTML = `
      <div id="rmTitle" style="font:800 16px system-ui;color:#fff;">RESULT</div>
      <div id="rmMeta" style="margin-top:4px;font:600 12px system-ui;color:rgba(255,255,255,0.70);"></div>
    `;

    const list = document.createElement("div");
    list.id = "rmList";
    list.style.padding = "10px 12px";
    list.style.overflow = "auto";
    list.style.flex = "1";
    list.style.display = "block";

    const style = document.createElement("style");
    style.textContent = `
      #rmList .item{
        display:flex;justify-content:space-between;gap:12px;
        padding:7px 8px;border-radius:10px;
        font:600 13px system-ui;color:rgba(255,255,255,0.90);
      }
      #rmList .item:nth-child(odd){ background:rgba(255,255,255,0.05); }
      #rmList .item.me{ background:rgba(0,255,204,0.13); color:#00ffd7; }
      #rmBtns{ display:flex; gap:10px; padding:12px; border-top:1px solid rgba(255,255,255,0.10); }
      #rmBtns button{
        flex:1; padding:12px 10px; border:0; border-radius:12px;
        font:800 14px system-ui; color:#fff;
        background:rgba(255,255,255,0.12);
      }
      #rmBtns button.primary{ background:rgba(0,0,0,0.55); border:1px solid rgba(255,255,255,0.18); }
    `;
    document.head.appendChild(style);

    const btns = document.createElement("div");
    btns.id = "rmBtns";
    btns.innerHTML = `
      <button id="rmRetry">RETRY</button>
      <button id="rmNext" class="primary">NEXT RACE</button>
    `;

    card.appendChild(head);
    card.appendChild(list);
    card.appendChild(btns);
    modal.appendChild(card);
    document.body.appendChild(modal);

    return modal;
  };

  ui.resultModal = ui.ensureResultModal();
  ui.rmTitle = document.getElementById("rmTitle");
  ui.rmMeta = document.getElementById("rmMeta");
  ui.rmList = document.getElementById("rmList");
  ui.rmRetry = document.getElementById("rmRetry");
  ui.rmNext = document.getElementById("rmNext");

  ui.hideResult = function hideResult() {
    if (ui.resultModal) ui.resultModal.style.display = "none";
  };

  ui.showResult = function showResult() {
    const state = MOB.state;
    if (state.phase === "result") return;
    state.phase = "result";

    MOB.updateRank();
    MOB.updateTop8();
    ui.updateStockBar();

    const race = CONFIG.RACES[state.raceIndex] || CONFIG.RACES[0] || { name: "EASY", goal: 600 };
    const list = [...state.runners].sort((a, b) => a.finishTime - b.finishTime);

    const me = state.runners[state.playerIndex];
    let myRank = list.findIndex(r => r === me) + 1;
    if (myRank <= 0) myRank = state.rank;

    if (ui.rmTitle) ui.rmTitle.textContent = `RESULT - ${race.name}`;
    if (ui.rmMeta) ui.rmMeta.textContent = `GOAL ${race.goal}m  /  YOUR RANK ${myRank}/${state.runners.length}`;

    if (ui.rmList) {
      let html = "";
      for (let i = 0; i < list.length; i++) {
        const r = list[i];
        const t = isFinite(r.finishTime) ? `${r.finishTime.toFixed(2)}s` : "--";
        const cls = r.isPlayer ? "item me" : "item";
        html += `<div class="${cls}"><span>${i + 1}. ${r.name}</span><span>${t}</span></div>`;
      }
      ui.rmList.innerHTML = html;
      ui.rmList.scrollTop = 0;
    }

    if (ui.resultModal) ui.resultModal.style.display = "flex";
  };

  // buttons
  ui.rmRetry?.addEventListener("pointerdown", () => {
    ui.hideResult();
    MOB.initRace(MOB.state.raceIndex);
  });
  ui.rmNext?.addEventListener("pointerdown", () => {
    ui.hideResult();
    const nextIdx = (MOB.state.raceIndex < CONFIG.RACES.length - 1) ? (MOB.state.raceIndex + 1) : 0;
    MOB.initRace(nextIdx);
  });

  // ===== BRIEF MODAL =====
  ui.ensureBriefModal = function ensureBriefModal() {
    let modal = document.getElementById("jsBriefModal");
    if (modal) return modal;

    modal = document.createElement("div");
    modal.id = "jsBriefModal";
    modal.style.position = "fixed";
    modal.style.left = "0";
    modal.style.top = "0";
    modal.style.right = "0";
    modal.style.bottom = "0";
    modal.style.zIndex = "99997";
    modal.style.display = "none";
    modal.style.alignItems = "center";
    modal.style.justifyContent = "center";
    modal.style.background = "rgba(0,0,0,0.35)";
    modal.style.backdropFilter = "blur(6px)";
    modal.style.pointerEvents = "auto";

    const card = document.createElement("div");
    card.style.width = "min(92vw, 420px)";
    card.style.borderRadius = "18px";
    card.style.background = "rgba(10,12,18,0.92)";
    card.style.border = "1px solid rgba(255,255,255,0.10)";
    card.style.boxShadow = "0 20px 60px rgba(0,0,0,0.55)";
    card.style.overflow = "hidden";

    const body = document.createElement("div");
    body.style.padding = "18px 16px 14px";
    body.style.textAlign = "center";
    body.innerHTML = `
      <div id="bmLine1" style="font:900 26px system-ui;color:#fff;letter-spacing:0.5px;">距離 0m</div>
      <div id="bmLine2" style="margin-top:10px;font:800 16px system-ui;color:rgba(255,255,255,0.90);">準備中</div>
    `;

    const btns = document.createElement("div");
    btns.style.display = "flex";
    btns.style.gap = "10px";
    btns.style.padding = "12px";
    btns.style.borderTop = "1px solid rgba(255,255,255,0.10)";
    btns.innerHTML = `
      <button id="bmStart" class="primary" style="
        flex:1;padding:12px 10px;border:0;border-radius:14px;
        font:900 15px system-ui;color:#fff;
        background:rgba(0,0,0,0.60);border:1px solid rgba(255,255,255,0.18);
      ">START</button>
    `;

    card.appendChild(body);
    card.appendChild(btns);
    modal.appendChild(card);
    document.body.appendChild(modal);
    return modal;
  };

  ui.briefModal = ui.ensureBriefModal();
  ui.bmLine1 = document.getElementById("bmLine1");
  ui.bmLine2 = document.getElementById("bmLine2");
  ui.bmStart = document.getElementById("bmStart");

  ui.hideBrief = function hideBrief() {
    if (ui.briefModal) ui.briefModal.style.display = "none";
  };

  ui.showBrief = function showBrief() {
    const state = MOB.state;
    const race = CONFIG.RACES[state.raceIndex] || CONFIG.RACES[0] || { goal: 600, survive: 5 };
    const isLast = (state.raceIndex === (CONFIG.RACES.length - 1));

    if (ui.bmLine1) ui.bmLine1.textContent = `距離 ${race.goal}m`;
    if (ui.bmLine2) {
      ui.bmLine2.textContent = isLast
        ? "ラストレース、優勝目指して頑張ろう🥇"
        : `${race.survive}位以内にゴールすればクリア！`;
    }
    if (ui.briefModal) ui.briefModal.style.display = "flex";
  };

  ui.bmStart?.addEventListener("pointerdown", () => {
    ui.hideBrief();
    MOB.state.countdown = 3;
    MOB.state.phase = "countdown";
  });

  // ===== VERSION BADGE =====
  ui.attachVersionBadge = function attachVersionBadge() {
    try {
      const host =
        (ui.btnJump && ui.btnJump.closest(".controls")) ||
        (ui.btnJump && ui.btnJump.parentElement) ||
        document.body;

      let badge = document.getElementById("jsVersionBadge");
      if (!badge) {
        badge = document.createElement("div");
        badge.id = "jsVersionBadge";
        badge.style.position = "absolute";
        badge.style.right = "12px";
        badge.style.bottom = "12px";
        badge.style.zIndex = "99999";
        badge.style.padding = "6px 10px";
        badge.style.borderRadius = "10px";
        badge.style.font = "800 12px system-ui";
        badge.style.color = "rgba(255,255,255,0.92)";
        badge.style.background = "rgba(0,0,0,0.35)";
        badge.style.backdropFilter = "blur(6px)";
        badge.style.pointerEvents = "none";

        const cs = getComputedStyle(host);
        if (cs.position === "static") host.style.position = "relative";
        host.appendChild(badge);
      }
      badge.textContent = MOB.VERSION;
    } catch (e) {}
  };

  // ===== STOCK BAR =====
  ui.stockFill = null;

  ui.ensureStockBarFill = function ensureStockBarFill() {
    const bar = document.querySelector(".stockBar, #stockBar, .boostBar") || null;
    if (!bar) return null;

    let fill = document.getElementById("stockFill");
    if (!fill) {
      fill = document.createElement("div");
      fill.id = "stockFill";
      fill.style.position = "absolute";
      fill.style.left = "0";
      fill.style.top = "0";
      fill.style.bottom = "0";
      fill.style.width = "0%";
      fill.style.borderRadius = "999px";
      fill.style.background = "rgba(0,255,204,0.90)";
      bar.style.position = "relative";
      bar.appendChild(fill);
    }
    ui.stockFill = fill;
    return fill;
  };

  ui.updateStockBar = function updateStockBar() {
    if (!ui.stockFill) return;
    const pct = MOB.clamp(MOB.state.stock / CONFIG.STOCK_MAX, 0, 1) * 100;
    ui.stockFill.style.width = pct.toFixed(1) + "%";
  };
})();
