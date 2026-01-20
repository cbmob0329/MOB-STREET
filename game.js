// game.js (PART 1/3)
// このPart1の末尾に Part2 → Part3 を順に追記すると完成します。

(() => {
  "use strict";

  // ====== DOM ======
  const canvas = document.getElementById("gameCanvas");
  const ctx = canvas.getContext("2d", { alpha: false });

  const overlay = document.getElementById("overlay");
  const overlayTitle = document.getElementById("overlayTitle");
  const overlayMsg = document.getElementById("overlayMsg");

  const overlayPanel = document.getElementById("overlayPanel");
  const panelBody = document.getElementById("panelBody");
  const btnRetry = document.getElementById("btnRetry");

  const hudSpeed = document.getElementById("hudSpeed");
  const hudDist = document.getElementById("hudDist");
  const hudFps = document.getElementById("hudFps");

  const btnJump = document.getElementById("btnJump");
  const btnBoost = document.getElementById("btnBoost");
  const btnJumpBoost = document.getElementById("btnJumpBoost");

  const pips = Array.from(document.querySelectorAll(".pip"));

  // ====== Strong mobile lock ======
  document.addEventListener("dblclick", (e) => e.preventDefault(), { passive: false });
  document.addEventListener("gesturestart", (e) => e.preventDefault(), { passive: false });
  document.addEventListener("gesturechange", (e) => e.preventDefault(), { passive: false });
  document.addEventListener("gestureend", (e) => e.preventDefault(), { passive: false });
  document.addEventListener("contextmenu", (e) => e.preventDefault(), { passive: false });
  window.addEventListener("touchmove", (e) => e.preventDefault(), { passive: false });

  // ====== Config ======
  const CONFIG = {
    logicalW: 360,
    logicalH: 640,

    // distance unit
    PX_PER_M: 10,
    GOAL_M: 600,

    // visuals / body
    playerSize: 48,

    // physics
    gravity: 2200,
    jumpV1: 860,
    jumpV2: 780,
    jumpBoostV: 1280,
    maxFallV: 1800,

    // run
    baseSpeed: 260,
    boostSpeedAdd: 210,
    boostDuration: 0.85,
    jumpBoostSpeedAdd: 520,
    jumpBoostDuration: 1.25,

    // ground derived from st.png height
    groundMinH: 130,
    groundMaxH: 210,

    // rail (lower)
    railRideSpeedAdd: 55,
    railSpawnAhead: 950,
    railDespawnBehind: 320,
    railGapMin: 160,
    railGapMax: 560,
    railHeightRatio: 0.43, // lower

    // puddle (slowdown)
    puddleSpawnAhead: 950,
    puddleDespawnBehind: 320,
    puddleGapMin: 160,
    puddleGapMax: 520,
    puddleWMin: 46,
    puddleWMax: 92,
    puddleSlowAmount: 65,
    puddleSlowSec: 0.65,

    // stock
    stockMax: 3,
    stockRegenSec: 3.0,

    // countdown
    countdownSec: 3.0,

    // halfpipe (ON GROUND like rail; must JUMP to ride)
    halfpipeSpawnAhead: 1200,
    halfpipeDespawnBehind: 520,
    halfpipeGapMin: 520,
    halfpipeGapMax: 1200,

    // pipe shape (gameplay approximation)
    pipeLipRatio: 0.18,      // rim position in image height
    pipeDepthRatio: 0.55,    // depth under rim
    pipeRideSpeedMaxAdd: 220,
    pipeRideSpeedMinAdd: 40,

    // MOB boost zone on pipe
    mobBoostMul: 1.5,
    mobZoneWRatio: 0.14,
    mobZonePosL: 0.23,
    mobZonePosR: 0.77,
  };

  // ====== Utils ======
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rand = (a, b) => a + Math.random() * (b - a);
  const randi = (a, b) => Math.floor(rand(a, b + 1));
  const nowMs = () => performance.now();

  function formatTime(sec) {
    if (!isFinite(sec)) return "--:--.--";
    const m = Math.floor(sec / 60);
    const s = sec - m * 60;
    const ss = s.toFixed(2).padStart(5, "0");
    return `${String(m).padStart(2, "0")}:${ss}`;
  }

  function setOverlay(title, msg) {
    overlayTitle.textContent = title;
    overlayMsg.textContent = msg || "";
    overlay.classList.remove("hidden");
  }
  function hideOverlay() {
    overlay.classList.add("hidden");
  }
  function showPanel(html) {
    panelBody.innerHTML = html;
    overlayPanel.classList.remove("hidden");
  }
  function hidePanel() {
    overlayPanel.classList.add("hidden");
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
  const ASSETS = {
    pl1:  { src: "PL1.png.png", img: null },
    pl2:  { src: "PL2.png.png", img: null },
    sk:   { src: "redsk.png",   img: null },
    st:   { src: "st.png",      img: null },
    rail: { src: "gardw.png",   img: null },
    hpr:  { src: "hpr.png",     img: null }, // blue
    hpg:  { src: "hpg.png",     img: null }, // red
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

  btnRetry?.addEventListener("click", () => restart());

  // ====== Game State ======
  const GAME = {
    PHASE: {
      LOADING: "loading",
      COUNTDOWN: "countdown",
      RUN: "run",
      RESULT: "result",
      ERROR: "error",
    },
  };

  const state = {
    phase: GAME.PHASE.LOADING,

    lastMs: 0,
    fpsAcc: 0,
    fpsCnt: 0,
    fps: 0,

    // derived stage
    groundH: 160,
    groundTop: 480,
    stTileW: 256,
    stScale: 1,

    // camera
    cameraX: 0,

    // time
    runTime: 0,
    countdownLeft: CONFIG.countdownSec,

    // stock
    stock: CONFIG.stockMax,
    stockTimer: 0,

    // obstacles
    rails: [],
    railNextX: 0,

    puddles: [],
    puddleNextX: 0,

    halfpipes: [],
    halfpipeNextX: 0,

    // runners
    runners: [],
    playerIndex: 0,
  };

  function makeRunner(name, isPlayer, speedMul, screenLane, alpha) {
    return {
      name,
      isPlayer,

      // world
      xw: 0,

      // render
      screenLane,
      alpha,

      // body
      w: CONFIG.playerSize,
      h: CONFIG.playerSize,
      screenX: 0,
      y: 0,
      vy: 0,

      // flags
      onGround: true,
      onRail: false,
      onPipe: false,
      jumpsUsed: 0,

      // modifiers
      boostTimer: 0,
      boostPower: 0,
      slowTimer: 0,

      // race
      finished: false,
      finishTime: Infinity,

      // AI
      speedMul,
      aiCooldown: 0,
    };
  }

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

  function initRunners() {
    state.runners = [];

    // player more left
    const player = makeRunner("YOU", true, 1.00, 0, 1.0);
    player.screenX = Math.floor(CONFIG.logicalW * 0.18);
    state.runners.push(player);
    state.playerIndex = 0;

    // 4 ghosts
    const ghostDefs = [
      { name:"GHOST 1", mul: 0.985, lane: 1, a: 0.75 },
      { name:"GHOST 2", mul: 1.005, lane: 2, a: 0.72 },
      { name:"GHOST 3", mul: 0.995, lane: 3, a: 0.70 },
      { name:"GHOST 4", mul: 1.015, lane: 4, a: 0.68 },
    ];
    for (const g of ghostDefs) state.runners.push(makeRunner(g.name, false, g.mul, g.lane, g.a));

    for (let i = 0; i < state.runners.length; i++) {
      const r = state.runners[i];
      r.xw = 0;
      r.y = state.groundTop - r.h;
      r.vy = 0;
      r.onGround = true;
      r.onRail = false;
      r.onPipe = false;
      r.jumpsUsed = 0;
      r.boostTimer = 0;
      r.boostPower = 0;
      r.slowTimer = 0;
      r.finished = false;
      r.finishTime = Infinity;
      r.aiCooldown = rand(0.15, 0.45);
    }
  }

  // ====== Stock ======
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

  // ====== Rail helpers ======
  function railTargetH() {
    return Math.round(state.groundH * CONFIG.railHeightRatio);
  }

  // ====== Halfpipe helpers (ON GROUND) ======
  function halfpipeDims(img) {
    // size same as rail-ish (height)
    const targetH = railTargetH();
    const scale = targetH / img.height;
    const w = Math.max(1, Math.floor(img.width * scale));
    const h = Math.max(1, Math.floor(img.height * scale));
    const lipY = Math.max(2, Math.floor(h * CONFIG.pipeLipRatio));
    const depth = Math.max(10, Math.floor(h * CONFIG.pipeDepthRatio));
    return { w, h, lipY, depth };
  }

  function getActivePipeAtX(xw) {
    for (let i = 0; i < state.halfpipes.length; i++) {
      const p = state.halfpipes[i];
      if (xw >= p.x && xw <= p.x + p.w) return p;
    }
    return null;
  }

  function pipeSurfaceY(pipe, xw) {
    const t = clamp((xw - pipe.x) / pipe.w, 0, 1);
    const rimY = pipe.y + pipe.lipY;
    const y = rimY + pipe.depth * (1 - Math.cos(2 * Math.PI * t)) * 0.5;
    return y;
  }

  function pipeSpeedBonus(pipe, xw) {
    const t = clamp((xw - pipe.x) / pipe.w, 0, 1);
    const centerDist = Math.abs(t - 0.5) / 0.5; // 0..1
    const k = 1 - clamp(centerDist, 0, 1);      // 1 at center
    return CONFIG.pipeRideSpeedMinAdd + (CONFIG.pipeRideSpeedMaxAdd - CONFIG.pipeRideSpeedMinAdd) * k;
  }

  function inMobBoostZone(pipe, xw) {
    const t = clamp((xw - pipe.x) / pipe.w, 0, 1);
    const zw = CONFIG.mobZoneWRatio * 0.5;
    const inL = Math.abs(t - CONFIG.mobZonePosL) <= zw;
    const inR = Math.abs(t - CONFIG.mobZonePosR) <= zw;
    return inL || inR;
  }

  function isInsideAnyPipeSpan(x0, x1) {
    for (let i = 0; i < state.halfpipes.length; i++) {
      const p = state.halfpipes[i];
      if ((x1 > p.x) && (x0 < p.x + p.w)) return true;
    }
    return false;
  }

  // ====== Speed ======
  function runnerSpeed(r) {
    const base = CONFIG.baseSpeed * (r.isPlayer ? 1.0 : r.speedMul);
    const boost = (r.boostTimer > 0 ? r.boostPower : 0);
    const railAdd = (r.onRail ? CONFIG.railRideSpeedAdd : 0);
    const slow = (r.slowTimer > 0 ? CONFIG.puddleSlowAmount : 0);

    let pipeAdd = 0;
    if (r.onPipe) {
      const pipe = getActivePipeAtX(r.xw + r.w * 0.5);
      if (pipe) pipeAdd = pipeSpeedBonus(pipe, r.xw + r.w * 0.5);
    }

    return Math.max(30, base + boost + railAdd + pipeAdd - slow);
  }

  function updateTimers(r, dt) {
    if (r.boostTimer > 0) {
      r.boostTimer -= dt;
      if (r.boostTimer <= 0) {
        r.boostTimer = 0;
        r.boostPower = 0;
      }
    }
    if (r.slowTimer > 0) {
      r.slowTimer -= dt;
      if (r.slowTimer < 0) r.slowTimer = 0;
    }
    if (!r.isPlayer && r.aiCooldown > 0) {
      r.aiCooldown -= dt;
      if (r.aiCooldown < 0) r.aiCooldown = 0;
    }
  }

  // ====== Actions ======
  function tryJump(r) {
    if (r.finished) return false;

    if (r.onGround || r.onRail || r.onPipe) {
      r.vy = -CONFIG.jumpV1;
      r.onGround = false;
      r.onRail = false;
      r.onPipe = false;
      r.jumpsUsed = 1;
      return true;
    }
    if (!r.onGround && !r.onRail && !r.onPipe && r.jumpsUsed < 2) {
      r.vy = -CONFIG.jumpV2;
      r.jumpsUsed = 2;
      return true;
    }
    return false;
  }

  function boostMultiplierForPlayerNow() {
    const player = state.runners[state.playerIndex];
    const pipe = getActivePipeAtX(player.xw + player.w * 0.5);
    if (pipe && inMobBoostZone(pipe, player.xw + player.w * 0.5)) return CONFIG.mobBoostMul;
    return 1.0;
  }

  function applyBoostToRunner(r, power, duration, mul) {
    r.boostTimer = duration;
    r.boostPower = power * mul;
  }

  function tryBoostPlayer() {
    const r = state.runners[state.playerIndex];
    if (r.finished) return false;
    if (state.stock <= 0) return false;
    state.stock -= 1;

    const mul = boostMultiplierForPlayerNow();
    applyBoostToRunner(r, CONFIG.boostSpeedAdd, CONFIG.boostDuration, mul);
    return true;
  }

  function tryJumpBoostPlayer() {
    const r = state.runners[state.playerIndex];
    if (r.finished) return false;
    if (state.stock < 3) return false;
    state.stock -= 3;

    r.vy = -CONFIG.jumpBoostV;
    r.onGround = false;
    r.onRail = false;
    r.onPipe = false;
    r.jumpsUsed = 2;

    const mul = boostMultiplierForPlayerNow();
    applyBoostToRunner(r, CONFIG.jumpBoostSpeedAdd, CONFIG.jumpBoostDuration, mul);
    return true;
  }

  // ====== Rails ======
  function railDims() {
    const img = ASSETS.rail.img;
    if (!img) return { w: 150, h: railTargetH() };
    const targetH = railTargetH();
    const scale = targetH / img.height;
    const w = Math.max(1, Math.floor(img.width * scale));
    const h = Math.max(1, Math.floor(img.height * scale));
    return { w, h };
  }

  function addRail(atX) {
    const { w, h } = railDims();
    const bottom = state.groundTop + 2;
    const y = bottom - h;
    state.rails.push({ x: atX, y, w, h });

    const gap = randi(CONFIG.railGapMin, CONFIG.railGapMax);
    state.railNextX = atX + w + gap;
  }

  function seedRailsInitial() {
    let x = state.railNextX;
    for (let i = 0; i < 3; i++) {
      if (!isInsideAnyPipeSpan(x, x + 200)) addRail(x);
      else x += 260;
      x = state.railNextX;
    }
  }

  function spawnRails() {
    const player = state.runners[state.playerIndex];
    const ahead = player.xw + CONFIG.railSpawnAhead;

    while (state.railNextX < ahead) {
      const x = state.railNextX;
      if (!isInsideAnyPipeSpan(x, x + 240)) addRail(x);
      else state.railNextX += randi(240, 380);
    }

    const behind = state.cameraX - CONFIG.railDespawnBehind;
    state.rails = state.rails.filter(r => r.x + r.w > behind);
  }

  function resolveRailRide(r, prevY) {
    r.onRail = false;

    const footY = r.y + r.h;
    const prevFootY = prevY + r.h;
    const xw = r.xw;

    for (let i = 0; i < state.rails.length; i++) {
      const rail = state.rails[i];
      const railTop = rail.y;

      const withinX =
        (xw + r.w * 0.35) < (rail.x + rail.w) &&
        (xw + r.w * 0.65) > (rail.x);

      if (!withinX) continue;

      const crossingTop = (prevFootY <= railTop) && (footY >= railTop);
      if (crossingTop && r.vy >= 0) {
        r.y = railTop - r.h;
        r.vy = 0;
        r.onRail = true;
        r.onGround = false;
        r.onPipe = false;
        r.jumpsUsed = 0;
        return;
      }
    }
  }

  // ====== Puddles ======
  function addPuddle(atX) {
    const w = randi(CONFIG.puddleWMin, CONFIG.puddleWMax);
    const h = 12;
    const y = state.groundTop + Math.floor(state.groundH * 0.22);
    state.puddles.push({ x: atX, y, w, h });

    const gap = randi(CONFIG.puddleGapMin, CONFIG.puddleGapMax);
    state.puddleNextX = atX + w + gap;
  }

  function seedPuddlesInitial() {
    let x = state.puddleNextX;
    for (let i = 0; i < 4; i++) {
      if (!isInsideAnyPipeSpan(x, x + 160)) addPuddle(x);
      else x += 240;
      x = state.puddleNextX;
    }
  }

  function spawnPuddles() {
    const player = state.runners[state.playerIndex];
    const ahead = player.xw + CONFIG.puddleSpawnAhead;

    while (state.puddleNextX < ahead) {
      const x = state.puddleNextX;
      if (!isInsideAnyPipeSpan(x, x + 180)) addPuddle(x);
      else state.puddleNextX += randi(220, 360);
    }

    const behind = state.cameraX - CONFIG.puddleDespawnBehind;
    state.puddles = state.puddles.filter(p => p.x + p.w > behind);
  }

  function applyPuddleSlow(r) {
    if (r.onRail || r.onPipe) return;
    const footY = r.y + r.h;
    if (footY < state.groundTop - 1) return;

    const cx = r.xw + r.w * 0.5;
    for (let i = 0; i < state.puddles.length; i++) {
      const p = state.puddles[i];
      if (cx > p.x && cx < (p.x + p.w)) {
        r.slowTimer = Math.max(r.slowTimer, CONFIG.puddleSlowSec);
        return;
      }
    }
  }

  /* === PART 2 START === */
 // game.js (PART 2/3)
// Part1の末尾にこのPart2を追記してください。

  // ====== Halfpipes (ON GROUND, jump-to-ride) ======
  function addHalfpipe(atX, kind) {
    const img = (kind === "hpg") ? ASSETS.hpg.img : ASSETS.hpr.img;
    const d = halfpipeDims(img);

    // ON GROUND: bottom aligns with ground bottom (same as rail)
    const bottom = state.groundTop + 2;
    const y = bottom - d.h;

    const pipe = {
      kind,
      img,
      x: atX,
      y,
      w: d.w,
      h: d.h,
      lipY: d.lipY,
      depth: d.depth,
    };
    state.halfpipes.push(pipe);

    const gap = randi(CONFIG.halfpipeGapMin, CONFIG.halfpipeGapMax);
    state.halfpipeNextX = atX + d.w + gap;
  }

  function seedHalfpipesInitial() {
    let x = state.halfpipeNextX;
    for (let i = 0; i < 1; i++) {
      addHalfpipe(x, Math.random() < 0.5 ? "hpr" : "hpg");
      x = state.halfpipeNextX;
    }
  }

  function spawnHalfpipes() {
    const player = state.runners[state.playerIndex];
    const ahead = player.xw + CONFIG.halfpipeSpawnAhead;

    while (state.halfpipeNextX < ahead) {
      addHalfpipe(state.halfpipeNextX, (Math.random() < 0.5) ? "hpr" : "hpg");
    }

    const behind = state.cameraX - CONFIG.halfpipeDespawnBehind;
    state.halfpipes = state.halfpipes.filter(p => p.x + p.w > behind);
  }

  // ★ Fix: slope ride must "stick" after landing, otherwise runner falls through
  // jump-to-ride: only land if coming from above ground; once onPipe, follow surface every frame
  function resolvePipeRide(r, prevY) {
    // rail overrides pipe
    if (r.onRail) {
      r.onPipe = false;
      return;
    }

    const cx = r.xw + r.w * 0.5;
    const pipe = getActivePipeAtX(cx);

    // outside pipe => release
    if (!pipe) {
      r.onPipe = false;
      return;
    }

    const prevFootY = prevY + r.h;
    const footY = r.y + r.h;
    const surfaceY = pipeSurfaceY(pipe, cx);

    // 1) already riding: follow surface (no fall)
    if (r.onPipe) {
      r.y = surfaceY - r.h;
      r.vy = 0;
      return;
    }

    // 2) not riding: can land only when falling from above ground
    const wasAboveGround = prevFootY < (state.groundTop - 2);
    const crossing = (prevFootY <= surfaceY) && (footY >= surfaceY);

    if (crossing && r.vy >= 0 && wasAboveGround) {
      r.y = surfaceY - r.h;
      r.vy = 0;
      r.onPipe = true;
      r.onGround = false;
      r.jumpsUsed = 0;
    }
  }

  // ====== Ghost AI ======
  function ghostAI(r, dt) {
    if (r.finished) return;
    if (r.aiCooldown > 0) return;

    const lookahead = 150;
    const xw = r.xw;

    // rail close -> jump
    let targetRail = null;
    for (let i = 0; i < state.rails.length; i++) {
      const rail = state.rails[i];
      if (rail.x + rail.w < xw) continue;
      const dx = rail.x - xw;
      if (dx >= 0 && dx <= lookahead) { targetRail = rail; break; }
    }
    if (targetRail && (r.onGround || r.onRail || r.onPipe)) {
      tryJump(r);
      r.aiCooldown = rand(0.35, 0.65);
      return;
    }

    // occasional hop (avoid hopping while onPipe)
    if (!r.onPipe && (r.onGround || r.onRail) && Math.random() < 0.04) {
      tryJump(r);
      r.aiCooldown = rand(0.55, 0.9);
      return;
    }

    r.aiCooldown = rand(0.25, 0.55);
  }

  // ====== Finish / Result ======
  function allFinished() {
    for (let i = 0; i < state.runners.length; i++) if (!state.runners[i].finished) return false;
    return true;
  }

  function updateFinish(r) {
    const distM = r.xw / CONFIG.PX_PER_M;
    if (!r.finished && distM >= CONFIG.GOAL_M) {
      r.finished = true;
      r.finishTime = state.runTime;
    }
  }

  function showResult() {
    state.phase = GAME.PHASE.RESULT;

    const list = state.runners
      .map(r => ({ name: r.name, t: r.finishTime, isPlayer: r.isPlayer }))
      .sort((a, b) => a.t - b.t);

    let html = "";
    for (let i = 0; i < list.length; i++) {
      const row = list[i];
      const rank = i + 1;
      html += `
        <div class="row">
          <div class="name">${rank}. ${row.name}${row.isPlayer ? " (YOU)" : ""}</div>
          <div class="time">${formatTime(row.t)}</div>
          <div class="rank">#${rank}</div>
        </div>
      `;
    }

    setOverlay("RESULT", `GOAL ${CONFIG.GOAL_M}m`);
    showPanel(html);
  }

  // ====== Physics / Race update ======
  function updateRunnerPhysics(r, dt) {
    if (r.finished) return;

    const prevY = r.y;

    r.vy += CONFIG.gravity * dt;
    r.vy = clamp(r.vy, -99999, CONFIG.maxFallV);
    r.y += r.vy * dt;

    // rail ride
    resolveRailRide(r, prevY);

    // pipe ride (jump-to-ride + stick)
    resolvePipeRide(r, prevY);

    // ★ if onPipe, ensure not overridden by ground
    if (r.onPipe) r.onGround = false;

    // ground collision (only if not on rail/pipe)
    if (!r.onRail && !r.onPipe) {
      if (r.y + r.h >= state.groundTop) {
        r.y = state.groundTop - r.h;
        r.vy = 0;
        r.onGround = true;
        r.jumpsUsed = 0;
      } else {
        r.onGround = false;
      }
    } else {
      r.onGround = false;
    }

    // puddle
    applyPuddleSlow(r);
  }

  function advanceRunner(r, dt) {
    if (r.finished) return;
    r.xw += runnerSpeed(r) * dt;
  }

  function updateRace(dt) {
    spawnHalfpipes();
    spawnRails();
    spawnPuddles();

    for (let i = 0; i < state.runners.length; i++) {
      const r = state.runners[i];
      updateTimers(r, dt);
      if (!r.isPlayer) ghostAI(r, dt);

      updateRunnerPhysics(r, dt);
      advanceRunner(r, dt);
      updateFinish(r);
    }

    const player = state.runners[state.playerIndex];
    state.cameraX = player.xw - player.screenX;

    if (allFinished()) showResult();
  }

  // ====== Main Loop (render in Part3) ======
  function step(ms) {
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

    fitCanvas();

    if (state.phase === GAME.PHASE.COUNTDOWN) {
      state.countdownLeft -= dt;
      const t = Math.max(0, state.countdownLeft);
      const n = Math.ceil(t);
      if (t > 0) {
        setOverlay(String(n), "READY");
      } else {
        state.phase = GAME.PHASE.RUN;
        hideOverlay();
        state.runTime = 0;
      }
    }

    if (state.phase === GAME.PHASE.RUN) {
      regenStock(dt);

      // input priority
      if (input.jumpBoostQueued) { input.jumpBoostQueued = false; tryJumpBoostPlayer(); }
      if (input.boostQueued)     { input.boostQueued = false;     tryBoostPlayer(); }
      if (input.jumpQueued)      { input.jumpQueued = false;      tryJump(state.runners[state.playerIndex]); }

      state.runTime += dt;
      updateRace(dt);
    }

    updateGaugeUI();
    render();

    requestAnimationFrame(step);
  }

  /* === PART 3 START === */
 // game.js (PART 3/3)
// Part2の末尾にこのPart3を追記してください。これで完成です。

  // ====== Render ======
  function beginLogical() {
    const cw = canvas.width;
    const ch = canvas.height;
    const sx = cw / CONFIG.logicalW;
    const sy = ch / CONFIG.logicalH;
    const s = Math.max(sx, sy); // full-fit cropping (no black bars)

    const viewW = CONFIG.logicalW * s;
    const viewH = CONFIG.logicalH * s;
    const offsetX = Math.floor((cw - viewW) / 2);
    const offsetY = Math.floor((ch - viewH) / 2);

    ctx.setTransform(s, 0, 0, s, offsetX, offsetY);
    ctx.imageSmoothingEnabled = false;
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

    if (stImg) {
      const tileW = state.stTileW;
      const tileH = state.groundH;
      const scroll = state.cameraX;
      let startX = -(((scroll % tileW) + tileW) % tileW);

      for (let drawX = startX; drawX < CONFIG.logicalW + tileW; drawX += tileW) {
        ctx.drawImage(stImg, 0, 0, stImg.width, stImg.height, drawX, y, tileW, tileH);
      }
    }

    ctx.fillStyle = "rgba(255,255,255,0.10)";
    ctx.fillRect(0, y, CONFIG.logicalW, 1);
  }

  function drawRails() {
    const img = ASSETS.rail.img;
    if (!img) return;

    for (let i = 0; i < state.rails.length; i++) {
      const r = state.rails[i];
      const sx = r.x - state.cameraX;
      if (sx > CONFIG.logicalW + 240 || sx + r.w < -240) continue;
      ctx.drawImage(img, 0, 0, img.width, img.height, sx, r.y, r.w, r.h);
    }
  }

  function roundRect(c, x, y, w, h, r) {
    const rr = Math.min(r, w * 0.5, h * 0.5);
    c.beginPath();
    c.moveTo(x + rr, y);
    c.arcTo(x + w, y, x + w, y + h, rr);
    c.arcTo(x + w, y + h, x, y + h, rr);
    c.arcTo(x, y + h, x, y, rr);
    c.arcTo(x, y, x + w, y, rr);
    c.closePath();
  }

  function drawPuddles() {
    for (let i = 0; i < state.puddles.length; i++) {
      const p = state.puddles[i];
      const sx = p.x - state.cameraX;
      if (sx > CONFIG.logicalW + 240 || sx + p.w < -240) continue;

      ctx.save();
      ctx.globalAlpha = 0.55;
      ctx.fillStyle = "rgba(120,190,255,0.55)";
      roundRect(ctx, sx, p.y, p.w, p.h, 6);
      ctx.fill();

      ctx.globalAlpha = 0.35;
      ctx.fillStyle = "rgba(255,255,255,0.35)";
      roundRect(ctx, sx + 6, p.y + 2, Math.max(8, p.w * 0.35), Math.max(3, p.h * 0.35), 6);
      ctx.fill();
      ctx.restore();
    }
  }

  function drawHalfpipes() {
    for (let i = 0; i < state.halfpipes.length; i++) {
      const p = state.halfpipes[i];
      const sx = p.x - state.cameraX;
      if (sx > CONFIG.logicalW + 300 || sx + p.w < -300) continue;

      ctx.drawImage(p.img, 0, 0, p.img.width, p.img.height, sx, p.y, p.w, p.h);

      // subtle hint at MOB boost zones (no text)
      ctx.save();
      ctx.globalAlpha = 0.10;
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      const zw = p.w * CONFIG.mobZoneWRatio;
      const zl = (p.w * CONFIG.mobZonePosL) - zw * 0.5;
      const zr = (p.w * CONFIG.mobZonePosR) - zw * 0.5;
      const rimY = p.y + p.lipY;
      ctx.fillRect(sx + zl, rimY - 2, zw, 4);
      ctx.fillRect(sx + zr, rimY - 2, zw, 4);
      ctx.restore();
    }
  }

  function drawRunner(r) {
    const plImg = (r.onGround || r.onRail || r.onPipe) ? ASSETS.pl1.img : ASSETS.pl2.img;
    const skImg = ASSETS.sk.img;

    let sx;
    if (r.isPlayer) {
      sx = r.screenX;
    } else {
      const player = state.runners[state.playerIndex];
      const dx = r.xw - player.xw;
      sx = player.screenX + dx;
    }

    const laneOffset = r.isPlayer ? 0 : (r.screenLane * 6);
    const x = sx;
    const y = r.y + laneOffset;

    if (x < -160 || x > CONFIG.logicalW + 160) return;

    const shadowBaseY = (r.onRail || r.onPipe) ? (y + r.h + 8) : (state.groundTop + 6);
    const shadowAlpha = (r.onGround || r.onRail || r.onPipe) ? 0.26 : 0.14;

    ctx.save();
    ctx.globalAlpha = r.alpha;

    ctx.fillStyle = `rgba(0,0,0,${shadowAlpha})`;
    ctx.beginPath();
    ctx.ellipse(x + r.w / 2, shadowBaseY, (r.w * 0.72) / 2, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    // board placement (character rides)
    const boardW = r.w * 1.05;
    const boardH = r.h * 0.45;
    const boardX = x + (r.w - boardW) * 0.5;
    const boardY = y + r.h * 0.68;

    if (skImg) ctx.drawImage(skImg, 0, 0, skImg.width, skImg.height, boardX, boardY, boardW, boardH);
    else {
      ctx.fillStyle = "#ff3333";
      ctx.fillRect(boardX, boardY, boardW, boardH);
    }

    if (plImg) ctx.drawImage(plImg, 0, 0, plImg.width, plImg.height, x, y, r.w, r.h);
    else {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(x, y, r.w, r.h);
    }

    // speed effect
    if (r.boostTimer > 0 || r.onRail || r.onPipe) {
      const intensity = r.onRail ? 0.35 : clamp((r.boostPower || 0) / CONFIG.jumpBoostSpeedAdd, 0.25, 1.0);
      ctx.globalAlpha = r.alpha * clamp(0.14 + intensity * 0.28, 0.14, 0.52);
      ctx.fillStyle = "#ffffff";
      const tailCount = 4 + Math.floor(intensity * 5);
      for (let i = 0; i < tailCount; i++) {
        const w = 10 + i * 6;
        const h = 2;
        const tx = x - 8 - i * 10;
        const ty = y + r.h * (0.40 + i * 0.07);
        ctx.fillRect(tx, ty, w, h);
      }
    }

    ctx.restore();
  }

  function drawHUDLogical() {
    const player = state.runners[state.playerIndex];
    const speed = runnerSpeed(player);
    const distM = Math.floor(player.xw / CONFIG.PX_PER_M);

    hudSpeed.textContent = String(Math.round(speed));
    hudDist.textContent = String(distM);

    ctx.save();
    ctx.font = "bold 12px system-ui";
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.shadowColor = "rgba(0,0,0,0.35)";
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 2;

    const phaseText = (state.phase === GAME.PHASE.RUN) ? `GOAL ${CONFIG.GOAL_M}m` : "READY";
    ctx.fillText(phaseText, 10, 20);
    ctx.fillText(`TIME ${formatTime(state.runTime)}`, 10, 38);
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

  function render() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    beginLogical();

    drawSky();
    drawStage();
    drawPuddles();
    drawHalfpipes();
    drawRails();

    for (let i = 0; i < state.runners.length; i++) {
      if (state.runners[i].isPlayer) continue;
      drawRunner(state.runners[i]);
    }
    drawRunner(state.runners[state.playerIndex]);

    drawHUDLogical();
  }

  // ====== Boot / Restart ======
  function fail(err) {
    console.error(err);
    state.phase = GAME.PHASE.ERROR;
    setOverlay("Error", String(err?.message || err));
    hidePanel();
  }

  function resetWorld() {
    resetDerivedStage();
    initRunners();

    state.cameraX = 0;
    state.runTime = 0;
    state.countdownLeft = CONFIG.countdownSec;

    state.stock = CONFIG.stockMax;
    state.stockTimer = 0;

    state.rails = [];
    state.railNextX = 220;

    state.puddles = [];
    state.puddleNextX = 260;

    state.halfpipes = [];
    state.halfpipeNextX = 700;

    seedHalfpipesInitial();
    seedRailsInitial();
    seedPuddlesInitial();

    hidePanel();
  }

  function restart() {
    hidePanel();
    setOverlay("3", "READY");
    state.phase = GAME.PHASE.COUNTDOWN;
    resetWorld();
  }

  async function boot() {
    try {
      state.phase = GAME.PHASE.LOADING;
      setOverlay("Loading...", "画像を読み込んでいます");
      hidePanel();

      fitCanvas();
      await loadAllAssets();

      resetWorld();
      state.phase = GAME.PHASE.COUNTDOWN;
      setOverlay("3", "READY");

      state.lastMs = nowMs();
      requestAnimationFrame(step);
    } catch (err) {
      fail(err);
    }
  }

  window.addEventListener("resize", () => fitCanvas());

  boot();
})();
