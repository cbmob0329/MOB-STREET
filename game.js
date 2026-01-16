// game.js
(() => {
  "use strict";

  // ====== DOM ======
  const canvas = document.getElementById("gameCanvas");
  const ctx = canvas.getContext("2d", { alpha: false });

  const overlay = document.getElementById("overlay");
  const overlayTitle = document.getElementById("overlayTitle");
  const overlayMsg = document.getElementById("overlayMsg");

  const hudSpeed = document.getElementById("hudSpeed");
  const hudDist = document.getElementById("hudDist");
  const hudFps = document.getElementById("hudFps");

  const btnJump = document.getElementById("btnJump");
  const btnBoost = document.getElementById("btnBoost");
  const btnJumpBoost = document.getElementById("btnJumpBoost");

  const pips = Array.from(document.querySelectorAll(".pip"));

  // ====== Config ======
  const CONFIG = {
    // 表示・スケール
    logicalW: 360,
    logicalH: 640,

    // プレイヤー
    playerSize: 48,              // 見た目の基準
    hitBoxScale: 0.92,           // 判定は少し甘くする

    // 物理
    gravity: 2200,               // px/s^2
    jumpV1: 860,                 // 1段目
    jumpV2: 780,                 // 2段目
    jumpBoostV: 1280,            // ジャンプブースト（めっちゃ飛ぶ）
    maxFallV: 1800,

    // 走行
    baseSpeed: 260,              // px/s
    boostSpeedAdd: 210,          // BOOST 加速
    boostDuration: 0.85,         // 1回押し
    jumpBoostSpeedAdd: 520,      // 超ブースト加速
    jumpBoostDuration: 1.25,     // 超ブースト時間

    // ステージ
    groundHeightRatio: 0.26,     // 下の地面帯（st.png）
    stageParallax: 1.0,

    // ゲージ
    stockMax: 3,
    stockRegenSec: 3.0,

    // UI
    safeTextShadow: true,
  };

  // ====== Utilities ======
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function nowMs() { return performance.now(); }

  function setOverlay(title, msg) {
    overlayTitle.textContent = title;
    overlayMsg.textContent = msg;
    overlay.classList.remove("hidden");
  }
  function hideOverlay() {
    overlay.classList.add("hidden");
  }

  // ====== Resize / DPR ======
  function fitCanvas() {
    const dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
    const rect = canvas.getBoundingClientRect();

    const w = Math.max(1, Math.floor(rect.width * dpr));
    const h = Math.max(1, Math.floor(rect.height * dpr));

    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = false;

    return { dpr, rect };
  }

  // ====== Assets ======
  // ★ここがポイント：PL1/PL2 は拡張子が二重
  const ASSETS = {
    pl1: { src: "PL1.png.png", img: null },
    pl2: { src: "PL2.png.png", img: null },
    sk:  { src: "redsk.png",   img: null },
    st:  { src: "st.png",      img: null },
  };

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`Failed to load: ${src}`));
      img.src = src;
    });
  }

  async function loadAllAssets() {
    setOverlay("Loading...", "画像を読み込んでいます");
    const keys = Object.keys(ASSETS);

    for (let i = 0; i < keys.length; i++) {
      const k = keys[i];
      const a = ASSETS[k];
      setOverlay("Loading...", `${a.src} (${i + 1}/${keys.length})`);
      a.img = await loadImage(a.src);
    }
    hideOverlay();
  }

  // ====== Input ======
  const input = {
    jumpQueued: false,
    boostQueued: false,
    jumpBoostQueued: false,
  };

  function attachButton(btn, onPress) {
    const press = (e) => {
      e.preventDefault();
      onPress();
    };
    btn.addEventListener("pointerdown", press, { passive: false });
    btn.addEventListener("pointerup", (e) => e.preventDefault(), { passive: false });
    btn.addEventListener("pointercancel", (e) => e.preventDefault(), { passive: false });
  }

  attachButton(btnJump, () => { input.jumpQueued = true; });
  attachButton(btnBoost, () => { input.boostQueued = true; });
  attachButton(btnJumpBoost, () => { input.jumpBoostQueued = true; });

  // PCデバッグ用
  window.addEventListener("keydown", (e) => {
    if (e.repeat) return;
    const k = e.key.toLowerCase();
    if (k === " " || k === "spacebar") input.jumpQueued = true;
    if (k === "b") input.boostQueued = true;
    if (k === "n") input.jumpBoostQueued = true;
  });

  // スクロール抑止
  window.addEventListener("touchmove", (e) => e.preventDefault(), { passive: false });

  // ====== Game State ======
  const state = {
    running: false,

    dpr: 1,
    rect: null,

    lastMs: 0,
    fpsAcc: 0,
    fpsCnt: 0,
    fps: 0,

    scrollX: 0,
    distance: 0,

    stock: CONFIG.stockMax,
    stockTimer: 0,

    boostTimer: 0,
    boostPower: 0,

    player: {
      x: 0,
      y: 0,
      vy: 0,
      w: CONFIG.playerSize,
      h: CONFIG.playerSize,
      onGround: false,
      jumpsUsed: 0, // 0/1/2
    },
  };

  function resetGameLayout() {
    if (!state.rect) return;

    const cw = canvas.width;
    const ch = canvas.height;

    const sx = cw / CONFIG.logicalW;
    const sy = ch / CONFIG.logicalH;
    const s = Math.min(sx, sy);

    state.view = {
      s,
      offsetX: Math.floor((cw - CONFIG.logicalW * s) / 2),
      offsetY: Math.floor((ch - CONFIG.logicalH * s) / 2),
    };

    const groundH = CONFIG.logicalH * CONFIG.groundHeightRatio;
    const groundTop = CONFIG.logicalH - groundH;

    state.player.x = CONFIG.logicalW * 0.30;
    state.player.y = groundTop - state.player.h;
    state.player.vy = 0;
    state.player.onGround = true;
    state.player.jumpsUsed = 0;

    state.scrollX = 0;
    state.distance = 0;
    state.stock = CONFIG.stockMax;
    state.stockTimer = 0;
    state.boostTimer = 0;
    state.boostPower = 0;
  }

  // ====== Mechanics ======
  function tryJump() {
    const p = state.player;
    if (p.onGround) {
      p.vy = -CONFIG.jumpV1;
      p.onGround = false;
      p.jumpsUsed = 1;
      return true;
    }
    // 2段ジャンプ
    if (!p.onGround && p.jumpsUsed < 2) {
      p.vy = -CONFIG.jumpV2;
      p.jumpsUsed = 2;
      return true;
    }
    return false;
  }

  function tryBoost() {
    if (state.stock <= 0) return false;
    state.stock -= 1;
    state.boostTimer = CONFIG.boostDuration;
    state.boostPower = CONFIG.boostSpeedAdd;
    return true;
  }

  function tryJumpBoost() {
    if (state.stock < 3) return false;

    state.stock -= 3;

    const p = state.player;
    p.vy = -CONFIG.jumpBoostV;   // メッチャ飛ぶ
    p.onGround = false;
    p.jumpsUsed = 2;             // 追加ジャンプは抑制（安定）

    state.boostTimer = CONFIG.jumpBoostDuration;
    state.boostPower = CONFIG.jumpBoostSpeedAdd;
    return true;
  }

  function regenStock(dt) {
    state.stockTimer += dt;
    while (state.stockTimer >= CONFIG.stockRegenSec) {
      state.stockTimer -= CONFIG.stockRegenSec;
      if (state.stock < CONFIG.stockMax) state.stock += 1;
      else {
        state.stockTimer = Math.min(state.stockTimer, CONFIG.stockRegenSec * 0.35);
        break;
      }
    }
  }

  function currentSpeed() {
    return CONFIG.baseSpeed + (state.boostTimer > 0 ? state.boostPower : 0);
  }

  // ====== Render ======
  function beginLogical() {
    const v = state.view;
    ctx.setTransform(v.s, 0, 0, v.s, v.offsetX, v.offsetY);
  }

  function drawSky() {
    const g = ctx.createLinearGradient(0, 0, 0, CONFIG.logicalH);
    g.addColorStop(0, "#2a6fb8");
    g.addColorStop(0.45, "#173e78");
    g.addColorStop(1, "#081a2b");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, CONFIG.logicalW, CONFIG.logicalH);
  }

  function drawStage() {
    const stImg = ASSETS.st.img;
    const groundH = CONFIG.logicalH * CONFIG.groundHeightRatio;
    const y = CONFIG.logicalH - groundH;

    ctx.fillStyle = "rgba(0,0,0,0.22)";
    ctx.fillRect(0, y, CONFIG.logicalW, groundH);

    if (!stImg) return;

    const tileH = Math.max(1, Math.floor(groundH));
    const scale = tileH / stImg.height;
    const tileW = Math.max(1, Math.floor(stImg.width * scale));

    const scroll = state.scrollX * CONFIG.stageParallax;
    let x = -((scroll % tileW) + tileW) % tileW;
    x = -x;

    for (let drawX = x; drawX < CONFIG.logicalW + tileW; drawX += tileW) {
      ctx.drawImage(stImg, 0, 0, stImg.width, stImg.height, drawX, y, tileW, tileH);
    }

    ctx.fillStyle = "rgba(255,255,255,0.10)";
    ctx.fillRect(0, y, CONFIG.logicalW, 1);
  }

  function drawPlayer() {
    const p = state.player;

    const plImg = (p.onGround ? ASSETS.pl1.img : ASSETS.pl2.img);
    const skImg = ASSETS.sk.img;

    const drawW = p.w;
    const drawH = p.h;

    const skW = drawW * 1.02;
    const skH = drawH * 0.48;
    const skX = p.x + (drawW - skW) * 0.5;
    const skY = p.y + drawH - skH * 0.85;

    const groundH = CONFIG.logicalH * CONFIG.groundHeightRatio;
    const groundTop = CONFIG.logicalH - groundH;

    // 影
    const distToGround = clamp((groundTop - (p.y + p.h)), 0, 300);
    const shadowAlpha = p.onGround ? 0.28 : clamp(0.25 - distToGround / 1200, 0.06, 0.20);
    ctx.fillStyle = `rgba(0,0,0,${shadowAlpha})`;
    ctx.beginPath();
    ctx.ellipse(p.x + drawW / 2, groundTop + 6, (drawW * 0.72) / 2, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    // スケボー
    if (skImg) ctx.drawImage(skImg, 0, 0, skImg.width, skImg.height, skX, skY, skW, skH);
    else {
      ctx.fillStyle = "#ff3333";
      ctx.fillRect(skX, skY, skW, skH);
    }

    // キャラ
    if (plImg) ctx.drawImage(plImg, 0, 0, plImg.width, plImg.height, p.x, p.y, drawW, drawH);
    else {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(p.x, p.y, drawW, drawH);
    }

    // ブーストエフェクト
    if (state.boostTimer > 0) {
      const intensity = clamp(state.boostPower / CONFIG.jumpBoostSpeedAdd, 0.25, 1.0);
      ctx.save();
      ctx.globalAlpha = clamp(0.25 + intensity * 0.35, 0.25, 0.65);
      ctx.fillStyle = "#ffffff";
      const tailCount = 4 + Math.floor(intensity * 4);
      for (let i = 0; i < tailCount; i++) {
        const w = 10 + i * 6;
        const h = 2;
        const tx = p.x - 8 - i * 10;
        const ty = p.y + p.h * (0.35 + i * 0.08);
        ctx.fillRect(tx, ty, w, h);
      }
      ctx.restore();
    }
  }

  function drawUIHints() {
    ctx.save();
    ctx.font = "bold 12px system-ui";
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    if (CONFIG.safeTextShadow) {
      ctx.shadowColor = "rgba(0,0,0,0.35)";
      ctx.shadowBlur = 8;
      ctx.shadowOffsetY = 2;
    }
    ctx.fillText(`Speed: ${Math.round(currentSpeed())}`, 10, 20);
    ctx.fillText(`Stock: ${state.stock}/3`, 10, 38);
    ctx.restore();
  }

  function updateGaugeUI() {
    for (let i = 0; i < pips.length; i++) {
      if (i < state.stock) pips[i].classList.add("on");
      else pips[i].classList.remove("on");
    }
    btnBoost.classList.toggle("disabled", state.stock <= 0);
    btnJumpBoost.classList.toggle("disabled", state.stock < 3);
  }

  // ====== Loop ======
  function step(ms) {
    if (!state.running) return;

    const dt = clamp((ms - state.lastMs) / 1000, 0, 0.033);
    state.lastMs = ms;

    // FPS
    state.fpsAcc += dt;
    state.fpsCnt += 1;
    if (state.fpsAcc >= 0.5) {
      state.fps = Math.round(state.fpsCnt / state.fpsAcc);
      state.fpsAcc = 0;
      state.fpsCnt = 0;
      hudFps.textContent = String(state.fps);
    }

    regenStock(dt);

    // 優先順位：JumpBoost > Boost > Jump
    if (input.jumpBoostQueued) { input.jumpBoostQueued = false; tryJumpBoost(); }
    if (input.boostQueued)     { input.boostQueued = false;     tryBoost(); }
    if (input.jumpQueued)      { input.jumpQueued = false;      tryJump(); }

    // boost timer
    if (state.boostTimer > 0) {
      state.boostTimer -= dt;
      if (state.boostTimer <= 0) {
        state.boostTimer = 0;
        state.boostPower = 0;
      }
    }

    // physics
    const p = state.player;
    p.vy += CONFIG.gravity * dt;
    p.vy = clamp(p.vy, -99999, CONFIG.maxFallV);
    p.y += p.vy * dt;

    const groundH = CONFIG.logicalH * CONFIG.groundHeightRatio;
    const groundTop = CONFIG.logicalH - groundH;
    if (p.y + p.h >= groundTop) {
      p.y = groundTop - p.h;
      p.vy = 0;
      if (!p.onGround) {
        p.onGround = true;
        p.jumpsUsed = 0;
      }
    } else {
      p.onGround = false;
    }

    // scroll
    const spd = currentSpeed();
    state.scrollX += spd * dt;
    state.distance += spd * dt;

    hudSpeed.textContent = String(Math.round(spd));
    hudDist.textContent = String(Math.floor(state.distance));

    updateGaugeUI();

    render();
    requestAnimationFrame(step);
  }

  function render() {
    const { rect } = fitCanvas();
    state.rect = rect;

    if (!state.view) resetGameLayout();

    // clear
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // logical draw
    beginLogical();
    drawSky();
    drawStage();
    drawPlayer();
    drawUIHints();
  }

  // ====== Boot ======
  async function boot() {
    try {
      fitCanvas();
      await loadAllAssets();

      state.running = true;
      state.lastMs = nowMs();
      resetGameLayout();
      updateGaugeUI();
      requestAnimationFrame(step);
    } catch (err) {
      console.error(err);
      setOverlay("Error", String(err?.message || err));
    }
  }

  window.addEventListener("resize", () => {
    fitCanvas();
    resetGameLayout();
  });

  boot();
})();
