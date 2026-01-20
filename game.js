// game.js (PART 1/3)
// Part1 → Part2 → Part3 を順に追記して完成。

(() => {
  "use strict";

  // =========================================================
  // DOM (既存HTMLに無くても動くように、必要要素は動的に補完)
  // =========================================================
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

  // 既存が3ピップ想定だった場合でも、JS側で5個に合わせる
  const pipsContainer = document.querySelector(".pips") || document.getElementById("pips") || null;
  let pips = Array.from(document.querySelectorAll(".pip"));

  function ensureHudExtras() {
    const hud = document.getElementById("hud") || document.body;

    // Rank display
    let rankEl = document.getElementById("hudRank");
    if (!rankEl) {
      rankEl = document.createElement("div");
      rankEl.id = "hudRank";
      rankEl.style.position = "fixed";
      rankEl.style.right = "10px";
      rankEl.style.top = "10px";
      rankEl.style.zIndex = "50";
      rankEl.style.fontFamily = "system-ui, sans-serif";
      rankEl.style.fontWeight = "800";
      rankEl.style.fontSize = "14px";
      rankEl.style.color = "#fff";
      rankEl.style.textShadow = "0 2px 8px rgba(0,0,0,0.6)";
      rankEl.textContent = "RANK --/--";
      hud.appendChild(rankEl);
    }

    // Ring display
    let ringEl = document.getElementById("hudRing");
    if (!ringEl) {
      ringEl = document.createElement("div");
      ringEl.id = "hudRing";
      ringEl.style.position = "fixed";
      ringEl.style.left = "10px";
      ringEl.style.top = "10px";
      ringEl.style.zIndex = "50";
      ringEl.style.fontFamily = "system-ui, sans-serif";
      ringEl.style.fontWeight = "800";
      ringEl.style.fontSize = "14px";
      ringEl.style.color = "#fff";
      ringEl.style.textShadow = "0 2px 8px rgba(0,0,0,0.6)";
      ringEl.textContent = "RING 0/10";
      hud.appendChild(ringEl);
    }

    // Heat display
    let heatEl = document.getElementById("hudHeat");
    if (!heatEl) {
      heatEl = document.createElement("div");
      heatEl.id = "hudHeat";
      heatEl.style.position = "fixed";
      heatEl.style.left = "10px";
      heatEl.style.top = "32px";
      heatEl.style.zIndex = "50";
      heatEl.style.fontFamily = "system-ui, sans-serif";
      heatEl.style.fontWeight = "800";
      heatEl.style.fontSize = "13px";
      heatEl.style.color = "#fff";
      heatEl.style.textShadow = "0 2px 8px rgba(0,0,0,0.6)";
      heatEl.textContent = "EASY 600m";
      hud.appendChild(heatEl);
    }

    return {
      rankEl: document.getElementById("hudRank"),
      ringEl: document.getElementById("hudRing"),
      heatEl: document.getElementById("hudHeat"),
    };
  }

  const hudExtras = ensureHudExtras();

  // =========================================================
  // Strong mobile lock (長押し選択・拡大等を抑止)
  // =========================================================
  document.addEventListener("dblclick", (e) => e.preventDefault(), { passive: false });
  document.addEventListener("gesturestart", (e) => e.preventDefault(), { passive: false });
  document.addEventListener("gesturechange", (e) => e.preventDefault(), { passive: false });
  document.addEventListener("gestureend", (e) => e.preventDefault(), { passive: false });
  document.addEventListener("contextmenu", (e) => e.preventDefault(), { passive: false });
  window.addEventListener("touchmove", (e) => e.preventDefault(), { passive: false });

  // =========================================================
  // Config
  // =========================================================
  const CONFIG = {
    logicalW: 360,
    logicalH: 640,

    PX_PER_M: 10,               // 10px = 1m
    countdownSec: 3.0,

    // player body
    playerSize: 48,
    playerScreenXRatio: 0.18,   // more left

    // physics
    gravity: 2200,
    jumpV1: 860,
    jumpV2: 780,
    jumpBoostV: 1280,
    maxFallV: 1800,

    // speed
    baseSpeed: 260,
    boostSpeedAdd: 210,
    boostDuration: 0.85,

    // jump-boost (RING)
    jumpBoostSpeedAdd: 520,
    jumpBoostDuration: 1.25,
    ringsToJumpBoost: 10,

    // stock (BOOST)
    stockMax: 5,
    stockRegenSec: 5.0,         // ★ 5秒に1つ
    stockStart: 0,              // ★ 最初0

    // ground from st.png
    groundMinH: 130,
    groundMaxH: 210,

    // rail
    railRideSpeedAdd: 55,
    railSpawnAhead: 950,
    railDespawnBehind: 320,
    railGapMin: 180,            // non-connected
    railGapMax: 620,
    railHeightRatio: 0.43,      // lower

    // puddle
    puddleSpawnAhead: 950,
    puddleDespawnBehind: 320,
    puddleGapMin: 200,
    puddleGapMax: 700,
    puddleWMin: 46,
    puddleWMax: 92,
    puddleSlowAmount: 65,
    puddleSlowSec: 0.65,

    // rings (visual objects only; ghosts gain virtually too)
    ringSpawnAhead: 980,
    ringDespawnBehind: 320,
    ringGapMin: 80,
    ringGapMax: 180,
    ringYRatio: 0.50,           // groundTop + groundH*ratio
    ringPickRadius: 18,

    // halfpipe (on ground, jump-to-ride)
    halfpipeSpawnAhead: 1200,
    halfpipeDespawnBehind: 520,
    halfpipeGapMin: 520,
    halfpipeGapMax: 1200,

    pipeLipRatio: 0.18,
    pipeDepthRatio: 0.55,
    pipeRideSpeedMaxAdd: 220,
    pipeRideSpeedMinAdd: 40,

    // MOB boost zone on pipe
    mobBoostMul: 1.5,
    mobZoneWRatio: 0.14,
    mobZonePosL: 0.23,
    mobZonePosR: 0.77,

    // minimap
    minimapX: 10,
    minimapY: 46,
    minimapW: 340,
    minimapH: 16,

    // goal line draw range
    goalDrawRangeM: 120,
  };

  // =========================================================
  // Utils
  // =========================================================
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

  // =========================================================
  // Resize
  // =========================================================
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
  }

  // =========================================================
  // Assets
  // =========================================================
  const ASSETS = {
    pl1:  { src: "PL1.png.png", img: null },
    pl2:  { src: "PL2.png.png", img: null },
    sk:   { src: "redsk.png",   img: null },
    st:   { src: "st.png",      img: null },
    rail: { src: "gardw.png",   img: null },
    hpr:  { src: "hpr.png",     img: null },     // blue halfpipe
    hpg:  { src: "hpg.png",     img: null },     // red halfpipe
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

  // =========================================================
  // Input
  // =========================================================
  const input = { jumpQueued:false, boostQueued:false, jumpBoostQueued:false };

  function attachButton(btn, onPress) {
    if (!btn) return;
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

  // =========================================================
  // Tournament definition
  // =========================================================
  const NAMED = [
    { name: "フレンチ",   win: 0.60 },
    { name: "レッド",     win: 0.70 },
    { name: "レッドブルー", win: 0.90 },
    { name: "ブラック",   win: 0.85 },
    { name: "ホワイト",   win: 0.75 },
  ];
  const LETTERS = "ABCDEFGHIJKLMNOPQRST".split("").map(ch => ({ name: ch, win: 0.30 }));

  const SILVER = { name: "シルバー", win: 0.95 };
  const GOLD   = { name: "ゴールド", win: 0.95 };

  const TOURNAMENT = [
    { key: "EASY",   distM: 600,  entrants: 26, advance: 16, addFinalists: [] },
    { key: "NORMAL", distM: 1000, entrants: 16, advance: 6,  addFinalists: [] },
    { key: "HARD",   distM: 1200, entrants: 8,  advance: 0,  addFinalists: [SILVER, GOLD] },
  ];

  // =========================================================
  // Game State
  // =========================================================
  const GAME = {
    PHASE: {
      LOADING: "loading",
      COUNTDOWN: "countdown",
      RUN: "run",
      BETWEEN: "between",
      RESULT: "result",
      GAMEOVER: "gameover",
      ERROR: "error",
    },
  };

  const state = {
    phase: GAME.PHASE.LOADING,

    lastMs: 0,
    fpsAcc: 0,
    fpsCnt: 0,
    fps: 0,

    // stage derived
    groundH: 160,
    groundTop: 480,
    stTileW: 256,
    stScale: 1,

    cameraX: 0,

    // time
    runTime: 0,
    countdownLeft: CONFIG.countdownSec,

    // world objects
    rails: [],
    railNextX: 0,

    puddles: [],
    puddleNextX: 0,

    halfpipes: [],
    halfpipeNextX: 0,

    rings: [],
    ringNextX: 0,

    // race/tournament
    roundIndex: 0,
    goalM: TOURNAMENT[0].distM,
    entrants: [],      // Runner objects in current race
    survivors: [],     // names of survivors after race
    playerName: "YOU",
    playerAlive: true,

    // render control
    visibleRunners: [],    // subset to render on screen (not ranking)
  };

  // =========================================================
  // Runner model
  // =========================================================
  function makeRunner(def, isPlayer) {
    const win = def.win ?? 0.30;

    // skill: winRate -> affects speed + decisions
    const skill = clamp(win, 0.10, 0.98);

    // speed multiplier: small range so it still feels fair
    const speedMul = isPlayer ? 1.00 : (0.97 + skill * 0.10); // 0.98..1.07
    const ai = {
      skill,
      // decision timers
      cd: rand(0.12, 0.45),
      // boost tendency
      boostAggro: isPlayer ? 0 : clamp(0.10 + skill * 0.50, 0.12, 0.70),
      ringAggro:  clamp(0.10 + skill * 0.55, 0.18, 0.75),
    };

    return {
      name: def.name,
      isPlayer,

      // world
      xw: 0,
      y: 0,
      vy: 0,

      // body
      w: CONFIG.playerSize,
      h: CONFIG.playerSize,
      screenX: 0,

      // flags
      onGround: true,
      onRail: false,
      onPipe: false,
      jumpsUsed: 0,

      // BOOST stock
      stock: CONFIG.stockStart,
      stockTimer: 0,

      // boost active
      boostTimer: 0,
      boostPower: 0,

      // slowdown
      slowTimer: 0,

      // RING -> jumpboost
      rings: 0,

      // race
      finished: false,
      finishTime: Infinity,
      eliminated: false,

      // AI
      speedMul,
      ai,
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

  /* === PART 2 START === */
 // game.js (PART 2/3)
// Part1の末尾に追記してください。

  // =========================================================
  // Round setup / entrants management
  // =========================================================
  function buildEntrantDefsForRound(roundIdx, prevSurvivorNames) {
    const round = TOURNAMENT[roundIdx];

    if (round.key === "EASY") {
      // 26人：YOU + named 5 + letters 20
      const defs = [{ name: state.playerName, win: 0.50, isPlayer: true }];
      for (const n of NAMED) defs.push({ ...n, isPlayer: false });
      for (const l of LETTERS) defs.push({ ...l, isPlayer: false });
      return defs;
    }

    if (round.key === "NORMAL") {
      // 16人：EASY上位16（YOU含む可能性）
      // prevSurvivorNames からdefを復元
      const defs = [];
      for (const nm of prevSurvivorNames) {
        if (nm === state.playerName) defs.push({ name: state.playerName, win: 0.50, isPlayer: true });
        else {
          const foundNamed = NAMED.find(x => x.name === nm);
          const foundLetter = LETTERS.find(x => x.name === nm);
          const base = foundNamed || foundLetter || { name: nm, win: 0.30 };
          defs.push({ ...base, isPlayer: false });
        }
      }
      return defs;
    }

    // HARD: prev上位6 + Silver & Gold
    if (round.key === "HARD") {
      const defs = [];
      for (const nm of prevSurvivorNames) {
        if (nm === state.playerName) defs.push({ name: state.playerName, win: 0.50, isPlayer: true });
        else {
          const foundNamed = NAMED.find(x => x.name === nm);
          const foundLetter = LETTERS.find(x => x.name === nm);
          const base = foundNamed || foundLetter || { name: nm, win: 0.30 };
          defs.push({ ...base, isPlayer: false });
        }
      }
      for (const add of round.addFinalists) defs.push({ ...add, isPlayer: false });
      return defs;
    }
    return [];
  }

  function setVisibleRunnersForRound() {
    const round = TOURNAMENT[state.roundIndex];
    const entrants = state.entrants;

    const player = entrants.find(r => r.isPlayer);
    if (!player) {
      state.visibleRunners = [];
      return;
    }

    // EASY/NORMAL：プレイヤー＋「残っている名前付き」最大5のみ表示
    // HARD：全員表示
    if (round.key === "HARD") {
      state.visibleRunners = entrants.slice();
      return;
    }

    const visible = [player];

    // 名前付き優先（落ちたら減る）
    const namedSet = new Set(NAMED.map(x => x.name));
    const namedAlive = entrants.filter(r => !r.isPlayer && namedSet.has(r.name));
    // 走っている順に近い順（距離差が小さい）から詰める
    namedAlive.sort((a, b) => Math.abs(a.xw - player.xw) - Math.abs(b.xw - player.xw));
    for (let i = 0; i < namedAlive.length && visible.length < 6; i++) visible.push(namedAlive[i]);

    state.visibleRunners = visible;
  }

  function startRound(roundIdx, prevSurvivorNames) {
    state.roundIndex = roundIdx;
    const round = TOURNAMENT[roundIdx];
    state.goalM = round.distM;

    // heat HUD
    hudExtras.heatEl.textContent = `${round.key} ${round.distM}m`;

    // entrants defs
    const defs = buildEntrantDefsForRound(roundIdx, prevSurvivorNames);

    // create runners
    state.entrants = defs.map(d => makeRunner(d, !!d.isPlayer));

    // initial positions
    const player = state.entrants.find(r => r.isPlayer);
    for (const r of state.entrants) {
      r.xw = 0;
      r.y = state.groundTop - r.h;
      r.vy = 0;
      r.onGround = true;
      r.onRail = false;
      r.onPipe = false;
      r.jumpsUsed = 0;

      r.stock = CONFIG.stockStart;
      r.stockTimer = 0;
      r.boostTimer = 0;
      r.boostPower = 0;
      r.slowTimer = 0;
      r.rings = 0;

      r.finished = false;
      r.finishTime = Infinity;
      r.eliminated = false;

      if (r.isPlayer) r.screenX = Math.floor(CONFIG.logicalW * CONFIG.playerScreenXRatio);
    }

    // reset world
    state.cameraX = 0;
    state.runTime = 0;
    state.countdownLeft = CONFIG.countdownSec;

    state.rails = [];
    state.railNextX = 220;

    state.puddles = [];
    state.puddleNextX = 260;

    state.halfpipes = [];
    state.halfpipeNextX = 700;

    state.rings = [];
    state.ringNextX = 180;

    seedHalfpipesInitial();
    seedRailsInitial();
    seedPuddlesInitial();
    seedRingsInitial();

    setVisibleRunnersForRound();

    // overlay
    hidePanel();
    state.phase = GAME.PHASE.COUNTDOWN;
    setOverlay("3", "READY");
  }

  // =========================================================
  // Stock / Rings / Speed
  // =========================================================
  function regenStock(r, dt) {
    r.stockTimer += dt;
    while (r.stockTimer >= CONFIG.stockRegenSec) {
      r.stockTimer -= CONFIG.stockRegenSec;
      if (r.stock < CONFIG.stockMax) r.stock += 1;
      else {
        r.stockTimer = Math.min(r.stockTimer, CONFIG.stockRegenSec * 0.35);
        break;
      }
    }
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
    if (!r.isPlayer && r.ai.cd > 0) {
      r.ai.cd -= dt;
      if (r.ai.cd < 0) r.ai.cd = 0;
    }
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
    return rimY + pipe.depth * (1 - Math.cos(2 * Math.PI * t)) * 0.5;
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

  function boostMultiplierNow(r) {
    const pipe = getActivePipeAtX(r.xw + r.w * 0.5);
    if (pipe && inMobBoostZone(pipe, r.xw + r.w * 0.5)) return CONFIG.mobBoostMul;
    return 1.0;
  }

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

  // =========================================================
  // Actions
  // =========================================================
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

  function applyBoost(r, power, duration, mul) {
    r.boostTimer = duration;
    r.boostPower = power * mul;
  }

  function tryBoost(r) {
    if (r.finished) return false;
    if (r.stock <= 0) return false;
    r.stock -= 1;
    applyBoost(r, CONFIG.boostSpeedAdd, CONFIG.boostDuration, boostMultiplierNow(r));
    return true;
  }

  function tryJumpBoost(r) {
    if (r.finished) return false;
    if (r.rings < CONFIG.ringsToJumpBoost) return false;
    r.rings -= CONFIG.ringsToJumpBoost;

    r.vy = -CONFIG.jumpBoostV;
    r.onGround = false;
    r.onRail = false;
    r.onPipe = false;
    r.jumpsUsed = 2;

    applyBoost(r, CONFIG.jumpBoostSpeedAdd, CONFIG.jumpBoostDuration, boostMultiplierNow(r));
    return true;
  }

  // =========================================================
  // World: Rail / Puddle / Halfpipe / Ring generation
  // =========================================================
  function railTargetH() {
    return Math.round(state.groundH * CONFIG.railHeightRatio);
  }

  function railDims() {
    const img = ASSETS.rail.img;
    const targetH = railTargetH();
    if (!img) return { w: 150, h: targetH };
    const scale = targetH / img.height;
    return {
      w: Math.max(1, Math.floor(img.width * scale)),
      h: Math.max(1, Math.floor(img.height * scale)),
    };
  }

  function isInsideAnyPipeSpan(x0, x1) {
    for (let i = 0; i < state.halfpipes.length; i++) {
      const p = state.halfpipes[i];
      if ((x1 > p.x) && (x0 < p.x + p.w)) return true;
    }
    return false;
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
      if (!isInsideAnyPipeSpan(x, x + 260)) addRail(x);
      else state.railNextX += 340;
      x = state.railNextX;
    }
  }

  function spawnRails(cameraX, leaderX) {
    const ahead = leaderX + CONFIG.railSpawnAhead;
    while (state.railNextX < ahead) {
      const x = state.railNextX;
      if (!isInsideAnyPipeSpan(x, x + 260)) addRail(x);
      else state.railNextX += randi(260, 420);
    }
    const behind = cameraX - CONFIG.railDespawnBehind;
    state.rails = state.rails.filter(r => r.x + r.w > behind);
  }

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
    for (let i = 0; i < 3; i++) {
      if (!isInsideAnyPipeSpan(x, x + 200)) addPuddle(x);
      else state.puddleNextX += 420;
      x = state.puddleNextX;
    }
  }

  function spawnPuddles(cameraX, leaderX) {
    const ahead = leaderX + CONFIG.puddleSpawnAhead;
    while (state.puddleNextX < ahead) {
      const x = state.puddleNextX;
      if (!isInsideAnyPipeSpan(x, x + 220)) addPuddle(x);
      else state.puddleNextX += randi(280, 520);
    }
    const behind = cameraX - CONFIG.puddleDespawnBehind;
    state.puddles = state.puddles.filter(p => p.x + p.w > behind);
  }

  function halfpipeDims(img) {
    const targetH = railTargetH(); // halfpipe height ≈ rail
    const scale = targetH / img.height;
    const w = Math.max(1, Math.floor(img.width * scale));
    const h = Math.max(1, Math.floor(img.height * scale));
    const lipY = Math.max(2, Math.floor(h * CONFIG.pipeLipRatio));
    const depth = Math.max(10, Math.floor(h * CONFIG.pipeDepthRatio));
    return { w, h, lipY, depth };
  }

  function addHalfpipe(atX, kind) {
    const img = (kind === "hpg") ? ASSETS.hpg.img : ASSETS.hpr.img;
    const d = halfpipeDims(img);

    // ON GROUND (like rail)
    const bottom = state.groundTop + 2;
    const y = bottom - d.h;

    state.halfpipes.push({
      kind, img,
      x: atX, y,
      w: d.w, h: d.h,
      lipY: d.lipY,
      depth: d.depth,
    });

    const gap = randi(CONFIG.halfpipeGapMin, CONFIG.halfpipeGapMax);
    state.halfpipeNextX = atX + d.w + gap;
  }

  function seedHalfpipesInitial() {
    let x = state.halfpipeNextX;
    addHalfpipe(x, Math.random() < 0.5 ? "hpr" : "hpg");
  }

  function spawnHalfpipes(cameraX, leaderX) {
    const ahead = leaderX + CONFIG.halfpipeSpawnAhead;
    while (state.halfpipeNextX < ahead) {
      addHalfpipe(state.halfpipeNextX, (Math.random() < 0.5) ? "hpr" : "hpg");
    }
    const behind = cameraX - CONFIG.halfpipeDespawnBehind;
    state.halfpipes = state.halfpipes.filter(p => p.x + p.w > behind);
  }

  function ringY() {
    return state.groundTop + Math.floor(state.groundH * CONFIG.ringYRatio);
  }

  function addRing(atX) {
    state.rings.push({ x: atX, y: ringY(), picked: false });
    const gap = randi(CONFIG.ringGapMin, CONFIG.ringGapMax);
    state.ringNextX = atX + gap;
  }

  function seedRingsInitial() {
    let x = state.ringNextX;
    for (let i = 0; i < 10; i++) {
      addRing(x);
      x = state.ringNextX;
    }
  }

  function spawnRings(cameraX, leaderX) {
    const ahead = leaderX + CONFIG.ringSpawnAhead;
    while (state.ringNextX < ahead) addRing(state.ringNextX);
    const behind = cameraX - CONFIG.ringDespawnBehind;
    state.rings = state.rings.filter(r => r.x > behind && (!r.picked || r.x > (leaderX - 2000)));
  }

  /* === PART 3 START === */
 // game.js (PART 3/3)
// Part2の末尾にこのPart3を追記してください。これで完成です。

  // ====== Render helpers ======
  function beginLogical() {
    const cw = canvas.width;
    const ch = canvas.height;

    // full-fit cropping (no black bars)
    const sx = cw / CONFIG.logicalW;
    const sy = ch / CONFIG.logicalH;
    const s = Math.max(sx, sy);

    const viewW = CONFIG.logicalW * s;
    const viewH = CONFIG.logicalH * s;
    const offsetX = Math.floor((cw - viewW) / 2);
    const offsetY = Math.floor((ch - viewH) / 2);

    ctx.setTransform(s, 0, 0, s, offsetX, offsetY);
    ctx.imageSmoothingEnabled = false;
  }

  function drawSky() {
    // blue-ish mood
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

    // base ground shade
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

    // ground top line
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

  // ====== Draw objects ======
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
    // puddle image may be added later; for now, simple patch
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

      // subtle MOB boost zone hint (no text)
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
    // ringtap.png を使う（存在しない場合は円で代替）
    const img = ASSETS.ring?.img || null;
    const list = state.rings || [];
    for (let i = 0; i < list.length; i++) {
      const rg = list[i];
      const sx = rg.x - state.cameraX;
      if (sx > CONFIG.logicalW + 200 || sx + rg.w < -200) continue;

      if (img) {
        ctx.drawImage(img, 0, 0, img.width, img.height, sx, rg.y, rg.w, rg.h);
      } else {
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
    // ゴール地点を強調（太い縦ライン＋フラッグ）
    const goalX = state.goalX || (CONFIG.GOAL_M * CONFIG.PX_PER_M);
    const sx = goalX - state.cameraX;

    if (sx < -40 || sx > CONFIG.logicalW + 40) return;

    ctx.save();
    // thick line
    ctx.globalAlpha = 0.95;
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.fillRect(sx - 3, state.groundTop - 160, 6, 220);

    // checkered band on ground
    ctx.globalAlpha = 0.9;
    const bandY = state.groundTop + Math.floor(state.groundH * 0.06);
    const bandH = 18;
    for (let i = 0; i < 16; i++) {
      ctx.fillStyle = (i % 2 === 0) ? "rgba(0,0,0,0.55)" : "rgba(255,255,255,0.55)";
      ctx.fillRect(sx - 64 + i * 8, bandY, 8, bandH);
    }

    // flag
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

    // shadow
    const shadowBaseY = (r.onRail || r.onPipe) ? (y + r.h + 8) : (state.groundTop + 6);
    const shadowAlpha = (r.onGround || r.onRail || r.onPipe) ? 0.26 : 0.14;

    ctx.save();
    ctx.globalAlpha = r.alpha ?? 1.0;

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

    if (plImg) ctx.drawImage(plImg, 0, 0, plImg.width, plImg.height, x, y, r.w, r.h);

    // speed effect
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

  // ====== UI / HUD ======
  function drawMiniMap() {
    // simple top minimap
    const pad = 10;
    const x = pad;
    const y = pad + 6;
    const w = CONFIG.logicalW - pad * 2;
    const h = 22;

    const goalX = state.goalX || (CONFIG.GOAL_M * CONFIG.PX_PER_M);
    const player = state.runners[state.playerIndex];

    ctx.save();
    ctx.globalAlpha = 0.92;

    // background
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    roundRect(ctx, x, y, w, h, 8);
    ctx.fill();

    // bar
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = "rgba(255,255,255,0.16)";
    roundRect(ctx, x + 6, y + 9, w - 12, 4, 4);
    ctx.fill();

    // goal marker
    ctx.globalAlpha = 0.95;
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.fillRect(x + w - 10, y + 6, 2, h - 12);

    // dots: player + visible runners
    const denom = Math.max(1, goalX);
    const list = (typeof getMinimapRunners === "function") ? getMinimapRunners() : state.runners;
    for (let i = 0; i < list.length; i++) {
      const r = list[i];
      const t = clamp(r.xw / denom, 0, 1);
      const px = x + 6 + (w - 12) * t;
      const py = y + 11;

      if (r.isPlayer) ctx.fillStyle = "rgba(120,220,255,0.95)";
      else ctx.fillStyle = "rgba(255,255,255,0.75)";
      ctx.fillRect(px - 1, py - 5, 2, 10);
    }

    // player label (small)
    ctx.globalAlpha = 0.85;
    ctx.font = "bold 10px system-ui";
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    const distM = Math.floor(player.xw / CONFIG.PX_PER_M);
    ctx.fillText(`${distM}m / ${CONFIG.GOAL_M}m`, x + 10, y + 18);

    ctx.restore();
  }

  function drawRankBox() {
    // top-right rank
    const player = state.runners[state.playerIndex];
    const rank = (typeof getPlayerRank === "function") ? getPlayerRank() : null;
    const total = state.runners.length;

    ctx.save();
    ctx.globalAlpha = 0.92;
    ctx.font = "bold 12px system-ui";

    const txt = (rank != null) ? `RANK ${rank}/${total}` : `RANK -/${total}`;
    const tw = ctx.measureText(txt).width;
    const bx = CONFIG.logicalW - 10 - (tw + 18);
    const by = 44; // below minimap

    ctx.fillStyle = "rgba(0,0,0,0.35)";
    roundRect(ctx, bx, by, tw + 18, 22, 8);
    ctx.fill();

    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.fillText(txt, bx + 9, by + 15);

    ctx.restore();
  }

  function drawHUDLogical() {
    // HTML HUD already exists; canvas HUD is just supplemental
    const player = state.runners[state.playerIndex];
    const speed = (typeof runnerSpeed === "function") ? runnerSpeed(player) : 0;
    const distM = Math.floor(player.xw / CONFIG.PX_PER_M);

    if (hudSpeed) hudSpeed.textContent = String(Math.round(speed));
    if (hudDist) hudDist.textContent = String(distM);

    ctx.save();
    ctx.font = "bold 12px system-ui";
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.shadowColor = "rgba(0,0,0,0.35)";
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 2;

    // race / time
    const raceName = state.raceName || "";
    const phaseText = (state.phase === GAME.PHASE.RUN) ? `${raceName}` : "READY";
    ctx.fillText(phaseText, 10, 46);
    ctx.fillText(`TIME ${formatTime(state.runTime)}`, 10, 62);

    // ring counter (player)
    const rings = player.rings ?? 0;
    ctx.fillText(`RING ${rings}/10`, 10, 78);

    ctx.restore();
  }

  function updateGaugeUI() {
    // boost pips
    for (let i = 0; i < pips.length; i++) {
      if (i < (state.stock || 0)) pips[i].classList.add("on");
      else pips[i].classList.remove("on");
    }

    // button states
    btnBoost?.classList.toggle("disabled", (state.stock || 0) <= 0);

    const player = state.runners[state.playerIndex];
    const canJumpBoost = (player && (player.rings || 0) >= 10);
    btnJumpBoost?.classList.toggle("disabled", !canJumpBoost);
  }

  function render() {
    // clear full canvas
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    beginLogical();

    drawSky();
    drawStage();

    // world objects
    drawPuddles();
    drawRings();
    drawHalfpipes();
    drawRails();
    drawGoalLine();

    // runners: ghosts first, player last
    for (let i = 0; i < state.runners.length; i++) {
      if (state.runners[i].isPlayer) continue;
      if (typeof isRunnerVisible === "function" && !isRunnerVisible(state.runners[i])) continue;
      drawRunner(state.runners[i]);
    }
    drawRunner(state.runners[state.playerIndex]);

    // overlays
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
    initRunners();

    state.cameraX = 0;
    state.runTime = 0;
    state.countdownLeft = CONFIG.countdownSec;

    // boost stock: initial 0 / max 5 / regen 5s (defined in Part1/2)
    // ensure UI sync
    updateGaugeUI();

    // goal
    state.goalX = CONFIG.GOAL_M * CONFIG.PX_PER_M;

    // clear / seed generators (defined in Part1/2)
    state.rails = [];
    state.railNextX = 220;

    state.puddles = [];
    state.puddleNextX = 260;

    state.halfpipes = [];
    state.halfpipeNextX = 700;

    state.rings = [];
    state.ringNextX = 260;

    if (typeof seedHalfpipesInitial === "function") seedHalfpipesInitial();
    if (typeof seedRailsInitial === "function") seedRailsInitial();
    if (typeof seedPuddlesInitial === "function") seedPuddlesInitial();
    if (typeof seedRingsInitial === "function") seedRingsInitial();

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
