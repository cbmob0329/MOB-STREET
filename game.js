// game.js (PART 1/3) 2026-01-20 FIX
// このPART1の末尾に PART2 → PART3 を順に追記すると完成します。

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
    GOAL_M: 600, // ここはレースごとに後で切替

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
    railHeightRatio: 0.43,

    // puddle (slowdown) ※画像は後で
    puddleSpawnAhead: 950,
    puddleDespawnBehind: 320,
    puddleGapMin: 160,
    puddleGapMax: 520,
    puddleWMin: 46,
    puddleWMax: 92,
    puddleSlowAmount: 65,
    puddleSlowSec: 0.65,

    // boost stock（要件反映）
    stockMax: 5,
    stockRegenSec: 5.0, // 5秒に1つ
    stockInitial: 0,    // 初期0

    // rings / jump boost
    ringNeed: 10,

    // countdown
    countdownSec: 3.0,

    // halfpipe
    halfpipeSpawnAhead: 1200,
    halfpipeDespawnBehind: 520,
    halfpipeGapMin: 520,
    halfpipeGapMax: 1200,

    // pipe shape (approx)
    pipeLipRatio: 0.18,
    pipeDepthRatio: 0.55,
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
    hpr:  { src: "hpr.png",     img: null },
    hpg:  { src: "hpg.png",     img: null },
    ring: { src: "ringtap.png", img: null },
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
    stock: CONFIG.stockInitial,
    stockTimer: 0,

    // rings (world)
    rings: [],
    ringNextX: 260,

    // obstacles
    rails: [],
    railNextX: 220,

    puddles: [],
    puddleNextX: 260,

    halfpipes: [],
    halfpipeNextX: 700,

    // runners
    runners: [],
    playerIndex: 0,

    // goal
    goalX: CONFIG.GOAL_M * CONFIG.PX_PER_M,

    // label
    raceName: "MOB STREET - 1P RUN",
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

      // rings
      rings: 0,

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

  // ★ ここが今回エラーになっている関数です（必ずPart1に入っていないと落ちます）
  function initRunners() {
    state.runners = [];

    // player (more left)
    const player = makeRunner("YOU", true, 1.00, 0, 1.0);
    player.screenX = Math.floor(CONFIG.logicalW * 0.18);
    state.runners.push(player);
    state.playerIndex = 0;

    // 5 named ghosts + (A..T) are handled in Part2で投入
    // ここでは最低限の初期化だけ保証
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
      r.rings = 0;
      r.finished = false;
      r.finishTime = Infinity;
      r.aiCooldown = rand(0.15, 0.45);
    }
  }

  // ====== Stock regen ======
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

  /* === PART 2 START === */
 // game.js (PART 2/3) 2026-01-20 FIX
// Part1の末尾にこのPart2を追記してください。次に Part3 を追記すると完成です。

  // ====== Helpers ======
  function railTargetH() {
    return Math.round(state.groundH * 0.43);
  }

  function isInsideAnyPipeSpan(x0, x1) {
    for (let i = 0; i < state.halfpipes.length; i++) {
      const p = state.halfpipes[i];
      if ((x1 > p.x) && (x0 < p.x + p.w)) return true;
    }
    return false;
  }

  // ====== Halfpipe helpers (ON GROUND, jump-to-ride) ======
  function halfpipeDims(img) {
    const targetH = railTargetH(); // pipe height ~ rail height
    const scale = targetH / img.height;
    const w = Math.max(1, Math.floor(img.width * scale));
    const h = Math.max(1, Math.floor(img.height * scale));
    const lipY = Math.max(2, Math.floor(h * 0.18));
    const depth = Math.max(10, Math.floor(h * 0.55));
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
    // cosine bowl
    const y = rimY + pipe.depth * (1 - Math.cos(2 * Math.PI * t)) * 0.5;
    return y;
  }

  function pipeSpeedBonus(pipe, xw) {
    const t = clamp((xw - pipe.x) / pipe.w, 0, 1);
    const centerDist = Math.abs(t - 0.5) / 0.5; // 0..1
    const k = 1 - clamp(centerDist, 0, 1);      // 1 at center
    return 40 + (220 - 40) * k;
  }

  function inMobBoostZone(pipe, xw) {
    const t = clamp((xw - pipe.x) / pipe.w, 0, 1);
    const zw = 0.14 * 0.5;
    const inL = Math.abs(t - 0.23) <= zw;
    const inR = Math.abs(t - 0.77) <= zw;
    return inL || inR;
  }

  // ====== Runners setup (26: player + 5 named + 20 letters) ======
  function addAllGhostsEasy() {
    const named = [
      { name: "フレンチ",   wr: 0.60, lane: 1, a: 0.78 },
      { name: "レッド",     wr: 0.70, lane: 2, a: 0.76 },
      { name: "レッドブルー", wr: 0.90, lane: 3, a: 0.74 },
      { name: "ブラック",   wr: 0.85, lane: 4, a: 0.72 },
      { name: "ホワイト",   wr: 0.75, lane: 5, a: 0.70 },
    ];

    // named 5 (boost + rings active)
    for (const g of named) {
      const mul = 0.98 + g.wr * 0.06; // 0.60->1.016, 0.90->1.034
      const r = makeRunner(g.name, false, mul, g.lane, g.a);
      r.aiType = "named";
      r.winRate = g.wr;
      state.runners.push(r);
    }

    // letters A..T (20) (sometimes boost + rings)
    const letters = "ABCDEFGHIJKLMNOPQRST".split("");
    for (let i = 0; i < letters.length; i++) {
      const nm = letters[i];
      const wr = 0.30;
      const mul = 0.98 + wr * 0.05 + rand(-0.005, 0.005);
      const r = makeRunner(nm, false, mul, 0, 0.0); // not drawn by default
      r.aiType = "letter";
      r.winRate = wr;
      state.runners.push(r);
    }
  }

  function initRaceEasy() {
    CONFIG.GOAL_M = 600;
    state.goalX = CONFIG.GOAL_M * CONFIG.PX_PER_M;
    state.raceName = "EASY 600m";

    // reset runners
    initRunners();         // player only in Part1
    addAllGhostsEasy();    // add ghosts here

    // place all runners at start
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
      r.rings = 0;
      r.finished = false;
      r.finishTime = Infinity;
      r.aiCooldown = rand(0.15, 0.55);
    }
  }

  // ====== Visibility / Rank ======
  function isRunnerVisible(r) {
    // Easy: show player + named ghosts only
    if (r.isPlayer) return true;
    return r.aiType === "named";
  }

  function getMinimapRunners() {
    // minimap: show visible only (player + named)
    return state.runners.filter(isRunnerVisible);
  }

  function getPlayerRank() {
    const list = state.runners
      .map(r => ({ r, d: r.xw }))
      .sort((a, b) => b.d - a.d);
    for (let i = 0; i < list.length; i++) {
      if (list[i].r.isPlayer) return i + 1;
    }
    return null;
  }

  // ====== Boost / JumpBoost rules ======
  function boostMulForPlayerNow() {
    const player = state.runners[state.playerIndex];
    const pipe = getActivePipeAtX(player.xw + player.w * 0.5);
    if (pipe && inMobBoostZone(pipe, player.xw + player.w * 0.5)) return 1.5;
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

    const mul = boostMulForPlayerNow();
    applyBoostToRunner(r, 210, 0.85, mul);
    return true;
  }

  function tryJumpBoostPlayer() {
    const r = state.runners[state.playerIndex];
    if (r.finished) return false;
    if ((r.rings || 0) < 10) return false;
    r.rings = Math.max(0, (r.rings || 0) - 10);

    r.vy = -1280;
    r.onGround = false;
    r.onRail = false;
    r.onPipe = false;
    r.jumpsUsed = 2;

    const mul = boostMulForPlayerNow();
    applyBoostToRunner(r, 520, 1.25, mul);
    return true;
  }

  // ====== Rings (world objects + per-runner pickup via probability) ======
  function ringDims() {
    const img = ASSETS.ring.img;
    if (!img) return { w: 22, h: 22 };
    const base = 22;
    const s = base / img.height;
    const w = Math.max(12, Math[ii] ? Math.floor(img.width * s) : Math.floor(img.width * s)); // safety
    const h = base;
    return { w, h };
  }

  function addRing(atX) {
    const { w, h } = ringDims();
    const y = state.groundTop - h - 26; // floating
    state.rings.push({ x: atX, y, w, h });
    state.ringNextX = atX + randi(90, 180);
  }

  function seedRingsInitial() {
    let x = state.ringNextX;
    for (let i = 0; i < 10; i++) {
      addRing(x);
      x = state.ringNextX;
    }
  }

  function spawnRings() {
    const player = state.runners[state.playerIndex];
    const ahead = player.xw + 1000;

    while (state.ringNextX < ahead) addRing(state.ringNextX);

    const behind = state.cameraX - 420;
    state.rings = state.rings.filter(rg => rg.x + rg.w > behind);
  }

  function tryPickupRings(r) {
    if (r.finished) return;

    // per-runner independent pickup:
    // - if runner overlaps ring zone, pick with probability depending on AI strength
    // - player always picks when overlap
    const cx = r.xw + r.w * 0.5;

    for (let i = 0; i < state.rings.length; i++) {
      const rg = state.rings[i];
      if (cx < rg.x || cx > rg.x + rg.w) continue;

      if (r.isPlayer) {
        r.rings = Math.min(99, (r.rings || 0) + 1);
        return;
      } else {
        const wr = r.winRate || 0.3;
        const p = clamp(0.25 + wr * 0.65, 0.25, 0.92); // stronger picks more
        if (Math.random() < p) {
          r.rings = Math.min(99, (r.rings || 0) + 1);
          return;
        }
      }
    }
  }

  // ====== Timers / Speed ======
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

  function runnerSpeed(r) {
    const base = 260 * (r.isPlayer ? 1.0 : (r.speedMul || 1.0));
    const boost = (r.boostTimer > 0 ? (r.boostPower || 0) : 0);
    const railAdd = (r.onRail ? 55 : 0);
    const slow = (r.slowTimer > 0 ? 65 : 0);

    let pipeAdd = 0;
    if (r.onPipe) {
      const pipe = getActivePipeAtX(r.xw + r.w * 0.5);
      if (pipe) pipeAdd = pipeSpeedBonus(pipe, r.xw + r.w * 0.5);
    }

    return Math.max(30, base + boost + railAdd + pipeAdd - slow);
  }

  // ====== Jump / AI ======
  function tryJump(r) {
    if (r.finished) return false;

    if (r.onGround || r.onRail || r.onPipe) {
      r.vy = -860;
      r.onGround = false;
      r.onRail = false;
      r.onPipe = false;
      r.jumpsUsed = 1;
      return true;
    }
    if (!r.onGround && !r.onRail && !r.onPipe && r.jumpsUsed < 2) {
      r.vy = -780;
      r.jumpsUsed = 2;
      return true;
    }
    return false;
  }

  function aiTryUseBoost(r, dt) {
    if (r.finished) return;

    // named: often uses boost + jumpboost if rings>=10
    // letter: sometimes
    const wr = r.winRate || 0.3;

    if (r.aiType === "named") {
      if ((r.rings || 0) >= 10 && Math.random() < (0.10 + wr * 0.08) * dt * 60) {
        // jumpboost
        r.rings -= 10;
        r.vy = -1280;
        r.onGround = false;
        r.onRail = false;
        r.onPipe = false;
        r.jumpsUsed = 2;

        // mob mul if in zone
        const pipe = getActivePipeAtX(r.xw + r.w * 0.5);
        const mul = (pipe && inMobBoostZone(pipe, r.xw + r.w * 0.5)) ? 1.5 : 1.0;
        applyBoostToRunner(r, 520, 1.25, mul);
        return;
      }

      if (Math.random() < (0.04 + wr * 0.05) * dt * 60) {
        const pipe = getActivePipeAtX(r.xw + r.w * 0.5);
        const mul = (pipe && inMobBoostZone(pipe, r.xw + r.w * 0.5)) ? 1.5 : 1.0;
        applyBoostToRunner(r, 210, 0.85, mul);
        return;
      }
    } else {
      // letters: rare
      if ((r.rings || 0) >= 10 && Math.random() < 0.012 * dt * 60) {
        r.rings -= 10;
        r.vy = -1280;
        r.onGround = false;
        r.onRail = false;
        r.onPipe = false;
        r.jumpsUsed = 2;
        applyBoostToRunner(r, 520, 1.25, 1.0);
        return;
      }
      if (Math.random() < 0.010 * dt * 60) {
        applyBoostToRunner(r, 210, 0.85, 1.0);
        return;
      }
    }
  }

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

    const gap = randi(160, 560);
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
    const ahead = player.xw + 950;

    while (state.railNextX < ahead) {
      const x = state.railNextX;
      if (!isInsideAnyPipeSpan(x, x + 240)) addRail(x);
      else state.railNextX += randi(240, 380);
    }

    const behind = state.cameraX - 320;
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

  // ====== Puddles (slow) ======
  function addPuddle(atX) {
    const w = randi(46, 92);
    const h = 12;
    const y = state.groundTop + Math.floor(state.groundH * 0.22);
    state.puddles.push({ x: atX, y, w, h });

    const gap = randi(160, 520);
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
    const ahead = player.xw + 950;

    while (state.puddleNextX < ahead) {
      const x = state.puddleNextX;
      if (!isInsideAnyPipeSpan(x, x + 180)) addPuddle(x);
      else state.puddleNextX += randi(220, 360);
    }

    const behind = state.cameraX - 320;
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
        r.slowTimer = Math.max(r.slowTimer, 0.65);
        return;
      }
    }
  }

  // ====== Halfpipes ======
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

    const gap = randi(520, 1200);
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
    const ahead = player.xw + 1200;

    while (state.halfpipeNextX < ahead) {
      addHalfpipe(state.halfpipeNextX, (Math.random() < 0.5) ? "hpr" : "hpg");
    }

    const behind = state.cameraX - 520;
    state.halfpipes = state.halfpipes.filter(p => p.x + p.w > behind);
  }

  // ★ slope ride stick fix
  function resolvePipeRide(r, prevY) {
    if (r.onRail) {
      r.onPipe = false;
      return;
    }

    const cx = r.xw + r.w * 0.5;
    const pipe = getActivePipeAtX(cx);

    if (!pipe) {
      r.onPipe = false;
      return;
    }

    const prevFootY = prevY + r.h;
    const footY = r.y + r.h;
    const surfaceY = pipeSurfaceY(pipe, cx);

    // already riding => follow
    if (r.onPipe) {
      r.y = surfaceY - r.h;
      r.vy = 0;
      return;
    }

    // jump-to-ride only (must come from above ground)
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

  // ====== Finish / Result (Easy only for now) ======
  function updateFinish(r) {
    const distM = r.xw / CONFIG.PX_PER_M;
    if (!r.finished && distM >= CONFIG.GOAL_M) {
      r.finished = true;
      r.finishTime = state.runTime;
    }
  }

  function allFinished() {
    for (let i = 0; i < state.runners.length; i++) if (!state.runners[i].finished) return false;
    return true;
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

    r.vy += 2200 * dt;
    r.vy = clamp(r.vy, -99999, 1800);
    r.y += r.vy * dt;

    resolveRailRide(r, prevY);
    resolvePipeRide(r, prevY);

    if (r.onPipe) r.onGround = false;

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
    spawnRings();

    for (let i = 0; i < state.runners.length; i++) {
      const r = state.runners[i];

      updateTimers(r, dt);
      tryPickupRings(r);

      if (!r.isPlayer) {
        ghostAI(r, dt);
        aiTryUseBoost(r, dt);
      }

      updateRunnerPhysics(r, dt);
      advanceRunner(r, dt);
      updateFinish(r);
    }

    // camera follows player
    const player = state.runners[state.playerIndex];
    state.cameraX = player.xw - player.screenX;

    if (allFinished()) showResult();
  }

  // ====== Main Loop ======
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
      if (hudFps) hudFps.textContent = String(state.fps);
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

      // player input
      if (input.jumpBoostQueued) { input.jumpBoostQueued = false; tryJumpBoostPlayer(); }
      if (input.boostQueued)     { input.boostQueued = false;     tryBoostPlayer(); }
      if (input.jumpQueued)      { input.jumpQueued = false;      tryJump(state.runners[state.playerIndex]); }

      state.runTime += dt;
      updateRace(dt);
    }

    if (typeof updateGaugeUI === "function") updateGaugeUI();
    if (typeof render === "function") render();

    requestAnimationFrame(step);
  }

  /* === PART 3 START === */
 // game.js (PART 3/3) 2026-01-20 FIX
// Part1+Part2の末尾にこのPart3を追記して完成です。

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
    g.addColorStop(0, "#2b74c9");
    g.addColorStop(0.45, "#173f7e");
    g.addColorStop(1, "#071727");
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

      // subtle MOB boost zone hint
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

  function drawRings() {
    const img = ASSETS.ring.img || null;
    const list = state.rings || [];
    for (let i = 0; i < list.length; i++) {
      const rg = list[i];
      const sx = rg.x - state.cameraX;
      if (sx > CONFIG.logicalW + 200 || sx + rg.w < -200) continue;

      if (img) ctx.drawImage(img, 0, 0, img.width, img.height, sx, rg.y, rg.w, rg.h);
      else {
        ctx.save();
        ctx.globalAlpha = 0.9;
        ctx.strokeStyle = "rgba(255,220,80,0.95)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(sx + rg.w / 2, rg.y + rg.h / 2, Math.min(rg.w, rg.h) * 0.33, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
    }
  }

  function drawGoalLine() {
    const goalX = state.goalX || (CONFIG.GOAL_M * CONFIG.PX_PER_M);
    const sx = goalX - state.cameraX;

    if (sx < -40 || sx > CONFIG.logicalW + 40) return;

    ctx.save();
    ctx.globalAlpha = 0.95;
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.fillRect(sx - 3, state.groundTop - 160, 6, 220);

    ctx.globalAlpha = 0.9;
    const bandY = state.groundTop + Math.floor(state.groundH * 0.06);
    const bandH = 18;
    for (let i = 0; i < 16; i++) {
      ctx.fillStyle = (i % 2 === 0) ? "rgba(0,0,0,0.55)" : "rgba(255,255,255,0.55)";
      ctx.fillRect(sx - 64 + i * 8, bandY, 8, bandH);
    }

    ctx.globalAlpha = 0.95;
    ctx.fillStyle = "rgba(255,80,80,0.95)";
    ctx.beginPath();
    ctx.moveTo(sx + 3, state.groundTop - 150);
    ctx.lineTo(sx + 46, state.groundTop - 138);
    ctx.lineTo(sx + 3, state.groundTop - 126);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
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

    const laneOffset = r.isPlayer ? 0 : ((r.screenLane || 0) * 6);
    const x = sx;
    const y = r.y + laneOffset;

    if (x < -160 || x > CONFIG.logicalW + 160) return;

    const shadowBaseY = (r.onRail || r.onPipe) ? (y + r.h + 8) : (state.groundTop + 6);
    const shadowAlpha = (r.onGround || r.onRail || r.onPipe) ? 0.26 : 0.14;

    ctx.save();
    ctx.globalAlpha = r.alpha ?? 1.0;

    ctx.fillStyle = `rgba(0,0,0,${shadowAlpha})`;
    ctx.beginPath();
    ctx.ellipse(x + r.w / 2, shadowBaseY, (r.w * 0.72) / 2, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    const boardW = r.w * 1.05;
    const boardH = r.h * 0.45;
    const boardX = x + (r.w - boardW) * 0.5;
    const boardY = y + r.h * 0.68;

    if (skImg) ctx.drawImage(skImg, 0, 0, skImg.width, skImg.height, boardX, boardY, boardW, boardH);
    if (plImg) ctx.drawImage(plImg, 0, 0, plImg.width, plImg.height, x, y, r.w, r.h);

    const boostActive = (r.boostTimer && r.boostTimer > 0) || r.onRail || r.onPipe;
    if (boostActive) {
      const intensity = r.onRail ? 0.35 : clamp((r.boostPower || 0) / (CONFIG.jumpBoostSpeedAdd || 1), 0.25, 1.0);
      ctx.globalAlpha = (r.alpha ?? 1.0) * clamp(0.14 + intensity * 0.28, 0.14, 0.52);
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

  function drawMiniMap() {
    const pad = 10;
    const x = pad;
    const y = pad + 6;
    const w = CONFIG.logicalW - pad * 2;
    const h = 22;

    const goalX = state.goalX || (CONFIG.GOAL_M * CONFIG.PX_PER_M);

    ctx.save();
    ctx.globalAlpha = 0.92;

    ctx.fillStyle = "rgba(0,0,0,0.35)";
    roundRect(ctx, x, y, w, h, 8);
    ctx.fill();

    ctx.globalAlpha = 0.85;
    ctx.fillStyle = "rgba(255,255,255,0.16)";
    roundRect(ctx, x + 6, y + 9, w - 12, 4, 4);
    ctx.fill();

    ctx.globalAlpha = 0.95;
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.fillRect(x + w - 10, y + 6, 2, h - 12);

    const denom = Math.max(1, goalX);
    const list = getMinimapRunners();

    for (let i = 0; i < list.length; i++) {
      const r = list[i];
      const t = clamp(r.xw / denom, 0, 1);
      const px = x + 6 + (w - 12) * t;
      const py = y + 11;

      ctx.fillStyle = r.isPlayer ? "rgba(120,220,255,0.95)" : "rgba(255,255,255,0.75)";
      ctx.fillRect(px - 1, py - 5, 2, 10);
    }

    ctx.globalAlpha = 0.85;
    ctx.font = "bold 10px system-ui";
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    const player = state.runners[state.playerIndex];
    const distM = Math.floor(player.xw / CONFIG.PX_PER_M);
    ctx.fillText(`${distM}m / ${CONFIG.GOAL_M}m`, x + 10, y + 18);

    ctx.restore();
  }

  function drawRankBox() {
    const rank = getPlayerRank();
    const total = state.runners.length;

    ctx.save();
    ctx.globalAlpha = 0.92;
    ctx.font = "bold 12px system-ui";

    const txt = `RANK ${rank}/${total}`;
    const tw = ctx.measureText(txt).width;
    const bx = CONFIG.logicalW - 10 - (tw + 18);
    const by = 44;

    ctx.fillStyle = "rgba(0,0,0,0.35)";
    roundRect(ctx, bx, by, tw + 18, 22, 8);
    ctx.fill();

    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.fillText(txt, bx + 9, by + 15);

    ctx.restore();
  }

  function drawHUDLogical() {
    const player = state.runners[state.playerIndex];
    const speed = runnerSpeed(player);
    const distM = Math.floor(player.xw / CONFIG.PX_PER_M);

    if (hudSpeed) hudSpeed.textContent = String(Math.round(speed));
    if (hudDist) hudDist.textContent = String(distM);

    ctx.save();
    ctx.font = "bold 12px system-ui";
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.shadowColor = "rgba(0,0,0,0.35)";
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 2;

    ctx.fillText(state.raceName || "", 10, 46);
    ctx.fillText(`TIME ${formatTime(state.runTime)}`, 10, 62);
    ctx.fillText(`RING ${(player.rings || 0)}/10`, 10, 78);
    ctx.restore();
  }

  function updateGaugeUI() {
    for (let i = 0; i < pips.length; i++) {
      if (i < (state.stock || 0)) pips[i].classList.add("on");
      else pips[i].classList.remove("on");
    }
    btnBoost?.classList.toggle("disabled", (state.stock || 0) <= 0);

    const player = state.runners[state.playerIndex];
    const canJumpBoost = (player && (player.rings || 0) >= 10);
    btnJumpBoost?.classList.toggle("disabled", !canJumpBoost);
  }

  function render() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    beginLogical();
    drawSky();
    drawStage();

    drawPuddles();
    drawRings();
    drawHalfpipes();
    drawRails();
    drawGoalLine();

    for (let i = 0; i < state.runners.length; i++) {
      const r = state.runners[i];
      if (r.isPlayer) continue;
      if (!isRunnerVisible(r)) continue;
      drawRunner(r);
    }
    drawRunner(state.runners[state.playerIndex]);

    drawMiniMap();
    drawRankBox();
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
    initRaceEasy(); // Easyのみ（3試合は次段階で拡張）

    state.cameraX = 0;
    state.runTime = 0;
    state.countdownLeft = CONFIG.countdownSec;

    state.stock = CONFIG.stockInitial;
    state.stockTimer = 0;

    state.goalX = CONFIG.GOAL_M * CONFIG.PX_PER_M;

    state.rails = [];
    state.railNextX = 220;

    state.puddles = [];
    state.puddleNextX = 260;

    state.halfpipes = [];
    state.halfpipeNextX = 700;

    state.rings = [];
    state.ringNextX = 260;

    seedHalfpipesInitial();
    seedRailsInitial();
    seedPuddlesInitial();
    seedRingsInitial();

    hidePanel();
  }

  function restart() {
    hidePanel();
    state.phase = GAME.PHASE.COUNTDOWN;
    resetWorld();
    setOverlay("3", "READY");
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
