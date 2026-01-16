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
    // 画面論理サイズ（中身の基準）。表示はクロップで全面フィット（黒帯なし）
    logicalW: 360,
    logicalH: 640,

    // 見た目
    playerSize: 48,

    // 物理
    gravity: 2200,
    jumpV1: 860,
    jumpV2: 780,
    jumpBoostV: 1280,
    maxFallV: 1800,

    // 走行
    baseSpeed: 260,
    boostSpeedAdd: 210,
    boostDuration: 0.85,
    jumpBoostSpeedAdd: 520,
    jumpBoostDuration: 1.25,

    // 地面（st.png 高さに合わせて最適化する）
    groundMinH: 130,
    groundMaxH: 210,

    // ガードレール
    railRideSpeedAdd: 55,      // 乗ってる間の加速（少し）
    railSpawnAhead: 900,       // 先読み生成距離
    railDespawnBehind: 300,    // 後ろ破棄距離
    railGapMin: 120,           // 最小間隔（連続っぽくも出る）
    railGapMax: 520,           // 最大間隔
    railBurstChance: 0.25,     // 連続出現の確率
    railBurstMin: 2,
    railBurstMax: 4,

    // ゲージ
    stockMax: 3,
    stockRegenSec: 3.0,
  };

  // ====== Utilities ======
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rand = (a, b) => a + Math.random() * (b - a);
  const randi = (a, b) => Math.floor(rand(a, b + 1));
  const nowMs = () => performance.now();

  function setOverlay(title, msg) {
    overlayTitle.textContent = title;
    overlayMsg.textContent = msg;
    overlay.classList.remove("hidden");
  }
  function hideOverlay() {
    overlay.classList.add("hidden");
  }

  // ====== Strong mobile lock (selection/gesture) ======
  // iOS Safari対策：ダブルタップや選択を抑止
  document.addEventListener("dblclick", (e) => e.preventDefault(), { passive: false });
  document.addEventListener("gesturestart", (e) => e.preventDefault(), { passive: false });
  document.addEventListener("gesturechange", (e) => e.preventDefault(), { passive: false });
  document.addEventListener("gestureend", (e) => e.preventDefault(), { passive: false });

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
  const ASSETS = {
    pl1:  { src: "PL1.png.png", img: null },
    pl2:  { src: "PL2.png.png", img: null },
    sk:   { src: "redsk.png",   img: null },
    st:   { src: "st.png",      img: null },
    rail: { src: "gardw.png",   img: null },
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
  const input = { jumpQueued:false, boostQueued:false, jumpBoostQueued:false };

  function attachButton(btn, onPress) {
    const press = (e) => { e.preventDefault(); onPress(); };
    btn.addEventListener("pointerdown", press, { passive:false });
    btn.addEventListener("pointerup", (e) => e.preventDefault(), { passive:false });
    btn.addEventListener("pointercancel", (e) => e.preventDefault(), { passive:false });
    btn.addEventListener("contextmenu", (e) => e.preventDefault(), { passive:false });
  }

  attachButton(btnJump, () => { input.jumpQueued = true; });
  attachButton(btnBoost, () => { input.boostQueued = true; });
  attachButton(btnJumpBoost, () => { input.jumpBoostQueued = true; });

  window.addEventListener("keydown", (e) => {
    if (e.repeat) return;
    const k = e.key.toLowerCase();
    if (k === " " || k === "spacebar") input.jumpQueued = true;
    if (k === "b") input.boostQueued = true;
    if (k === "n") input.jumpBoostQueued = true;
  });

  // ====== Game State ======
  const state = {
    running:false,
    rect:null,
    lastMs:0,

    fpsAcc:0, fpsCnt:0, fps:0,

    // world
    scrollX:0,
    distance:0,

    // stock
    stock: CONFIG.stockMax,
    stockTimer:0,

    // boost
    boostTimer:0,
    boostPower:0,

    // stage derived
    groundH: 160,
    groundTop: 480,
    stTileW: 0,
    stScale: 1,

    // rails
    rails: [],
    railNextX: 0,

    // player
    player: {
      x: 0,
      y: 0,
      vy: 0,
      w: CONFIG.playerSize,
      h: CONFIG.playerSize,
      onGround: true,
      onRail: false,
      jumpsUsed: 0, // 0/1/2
    },
  };

  function resetDerivedStage() {
    const stImg = ASSETS.st.img;
    const gh = clamp(stImg ? stImg.height : 160, CONFIG.groundMinH, CONFIG.groundMaxH);

    state.groundH = gh;
    state.groundTop = CONFIG.logicalH - gh;

    if (stImg) {
      state.stScale = gh / stImg.height;
      state.stTileW = Math.max(1, Math.floor(stImg.width * state.stScale));
    } else {
      state.stScale = 1;
      state.stTileW = 256;
    }
  }

  function resetGameLayout() {
    // 表示は「全面フィット（クロップ）」：黒帯なし
    const cw = canvas.width;
    const ch = canvas.height;
    const sx = cw / CONFIG.logicalW;
    const sy = ch / CONFIG.logicalH;
    const s = Math.max(sx, sy); // ★maxで全面フィット（はみ出しはクロップ）

    const viewW = CONFIG.logicalW * s;
    const viewH = CONFIG.logicalH * s;

    state.view = {
      s,
      offsetX: Math.floor((cw - viewW) / 2),
      offsetY: Math.floor((ch - viewH) / 2),
    };

    resetDerivedStage();

    const p = state.player;
    p.x = CONFIG.logicalW * 0.30;
    p.y = state.groundTop - p.h;
    p.vy = 0;
    p.onGround = true;
    p.onRail = false;
    p.jumpsUsed = 0;

    state.scrollX = 0;
    state.distance = 0;

    state.stock = CONFIG.stockMax;
    state.stockTimer = 0;

    state.boostTimer = 0;
    state.boostPower = 0;

    // rails
    state.rails = [];
    state.railNextX = 220; // すぐ出過ぎない程度
    seedRailsInitial();
  }

  // ====== Stock / Speed ======
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

  function baseRunSpeed() {
    const boost = state.boostTimer > 0 ? state.boostPower : 0;
    const railAdd = state.player.onRail ? CONFIG.railRideSpeedAdd : 0;
    return CONFIG.baseSpeed + boost + railAdd;
  }

  // ====== Jump / Boost ======
  function tryJump() {
    const p = state.player;

    if (p.onGround || p.onRail) {
      p.vy = -CONFIG.jumpV1;
      p.onGround = false;
      p.onRail = false;
      p.jumpsUsed = 1;
      return true;
    }
    if (!p.onGround && !p.onRail && p.jumpsUsed < 2) {
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
    p.onRail = false;
    p.jumpsUsed = 2;

    state.boostTimer = CONFIG.jumpBoostDuration;
    state.boostPower = CONFIG.jumpBoostSpeedAdd;
    return true;
  }

  // ====== Rails (gardw) ======
  function railDims() {
    const img = ASSETS.rail.img;
    if (!img) return { w: 140, h: 40, scale: 1 };

    const targetH = Math.round(state.groundH * 0.55);
    const scale = targetH / img.height;
    const w = Math.max(1, Math.floor(img.width * scale));
    const h = Math.max(1, Math.floor(img.height * scale));
    return { w, h, scale };
  }

  function addRail(atX) {
    const { w, h } = railDims();
    const bottom = state.groundTop + 2;
    const y = bottom - h;
    state.rails.push({ x: atX, y, w, h });
  }

  function planNextRailX(currentX) {
    if (Math.random() < CONFIG.railBurstChance) {
      const n = randi(CONFIG.railBurstMin, CONFIG.railBurstMax);
      let x = currentX;
      for (let i = 0; i < n; i++) {
        x += randi(90, 150);
        addRail(x);
      }
      return x + randi(CONFIG.railGapMin, CONFIG.railGapMax);
    }
    return currentX + randi(CONFIG.railGapMin, CONFIG.railGapMax);
  }

  function seedRailsInitial() {
    let x = state.railNextX;
    const startCount = 2;
    for (let i = 0; i < startCount; i++) {
      x = planNextRailX(x);
    }
    state.railNextX = x;
  }

  function spawnRails() {
    const camX = state.scrollX;
    const ahead = camX + CONFIG.railSpawnAhead;

    while (state.railNextX < ahead) {
      addRail(state.railNextX);
      state.railNextX = planNextRailX(state.railNextX);
    }

    const behind = camX - CONFIG.railDespawnBehind;
    state.rails = state.rails.filter(r => r.x + r.w > behind);
  }

  // ====== Collision with rails ======
  function resolveRailRide(prevY) {
    const p = state.player;
    p.onRail = false;

    const footY = p.y + p.h;
    const pxWorld = state.scrollX + p.x;

    for (let i = 0; i < state.rails.length; i++) {
      const r = state.rails[i];
      const railTop = r.y;

      const withinX =
        (pxWorld + p.w * 0.35) < (r.x + r.w) &&
        (pxWorld + p.w * 0.65) > (r.x);

      if (!withinX) continue;

      const prevFootY = prevY + p.h;
      const crossingTop = (prevFootY <= railTop) && (footY >= railTop);

      if (crossingTop && p.vy >= 0) {
        p.y = railTop - p.h;
        p.vy = 0;
        p.onRail = true;
        p.onGround = false;
        p.jumpsUsed = 0; // 乗れたらリセット（乗りやすい）
        return;
      }
    }
  }

  // ====== Render (logical space) ======
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
    const y = state.groundTop;

    ctx.fillStyle = "rgba(0,0,0,0.22)";
    ctx.fillRect(0, y, CONFIG.logicalW, state.groundH);

    if (!stImg) return;

    const tileW = state.stTileW;
    const tileH = state.groundH;

    const scroll = state.scrollX;
    let startX = -(((scroll % tileW) + tileW) % tileW);

    for (let drawX = startX; drawX < CONFIG.logicalW + tileW; drawX += tileW) {
      ctx.drawImage(stImg, 0, 0, stImg.width, stImg.height, drawX, y, tileW, tileH);
    }

    ctx.fillStyle = "rgba(255,255,255,0.10)";
    ctx.fillRect(0, y, CONFIG.logicalW, 1);
  }

  function drawRails() {
    const img = ASSETS.rail.img;
    if (!img) return;

    const camX = state.scrollX;

    for (let i = 0; i < state.rails.length; i++) {
      const r = state.rails[i];
      const sx = r.x - camX;
      if (sx > CONFIG.logicalW + 200 || sx + r.w < -200) continue;
      ctx.drawImage(img, 0, 0, img.width, img.height, sx, r.y, r.w, r.h);
    }
  }

  function drawPlayer() {
    const p = state.player;
    const plImg = (p.onGround || p.onRail) ? ASSETS.pl1.img : ASSETS.pl2.img;
    const skImg = ASSETS.sk.img;

    const drawW = p.w;
    const drawH = p.h;

    const shadowBaseY = p.onRail ? (p.y + p.h + 8) : (state.groundTop + 6);
    const shadowAlpha = (p.onGround || p.onRail) ? 0.28 : 0.14;
    ctx.fillStyle = `rgba(0,0,0,${shadowAlpha})`;
    ctx.beginPath();
    ctx.ellipse(p.x + drawW / 2, shadowBaseY, (drawW * 0.72) / 2, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    // スケボー位置：キャラがちゃんと乗って見えるように固定
    const boardW = drawW * 1.05;
    const boardH = drawH * 0.45;
    const boardX = p.x + (drawW - boardW) * 0.5;
    const boardY = p.y + drawH * 0.68;

    if (skImg) {
      ctx.drawImage(skImg, 0, 0, skImg.width, skImg.height, boardX, boardY, boardW, boardH);
    } else {
      ctx.fillStyle = "#ff3333";
      ctx.fillRect(boardX, boardY, boardW, boardH);
    }

    if (plImg) {
      ctx.drawImage(plImg, 0, 0, plImg.width, plImg.height, p.x, p.y, drawW, drawH);
    } else {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(p.x, p.y, drawW, drawH);
    }

    if (state.boostTimer > 0 || p.onRail) {
      const intensity = p.onRail ? 0.35 : clamp(state.boostPower / CONFIG.jumpBoostSpeedAdd, 0.25, 1.0);
      ctx.save();
      ctx.globalAlpha = clamp(0.18 + intensity * 0.30, 0.18, 0.55);
      ctx.fillStyle = "#ffffff";
      const tailCount = 4 + Math.floor(intensity * 5);
      for (let i = 0; i < tailCount; i++) {
        const w = 10 + i * 6;
        const h = 2;
        const tx = p.x - 8 - i * 10;
        const ty = p.y + p.h * (0.40 + i * 0.07);
        ctx.fillRect(tx, ty, w, h);
      }
      ctx.restore();
    }
  }

  function drawUIHints() {
    ctx.save();
    ctx.font = "bold 12px system-ui";
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.shadowColor = "rgba(0,0,0,0.35)";
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 2;
    ctx.fillText(`Speed: ${Math.round(baseRunSpeed())}`, 10, 20);
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

    // Input priority: JumpBoost > Boost > Jump
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

    // spawn rails
    spawnRails();

    // physics
    const p = state.player;
    const prevY = p.y;

    p.vy += CONFIG.gravity * dt;
    p.vy = clamp(p.vy, -99999, CONFIG.maxFallV);
    p.y += p.vy * dt;

    // rail first
    resolveRailRide(prevY);

    // ground collision
    if (!p.onRail) {
      if (p.y + p.h >= state.groundTop) {
        p.y = state.groundTop - p.h;
        p.vy = 0;
        if (!p.onGround) {
          p.onGround = true;
          p.jumpsUsed = 0;
        }
      } else {
        p.onGround = false;
      }
    } else {
      p.onGround = false;
    }

    // world scroll
    const spd = baseRunSpeed();
    state.scrollX += spd * dt;
    state.distance += spd * dt;

    // HUD
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

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    beginLogical();
    drawSky();
    drawStage();
    drawRails();
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
