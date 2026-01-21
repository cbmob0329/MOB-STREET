// game.js  MOB STREET - 1P RUN (Race) + New Gimmicks
// VERSION: v7.0
// 5分割：PART 1 / 5
(() => {
"use strict";

const VERSION = "v7.0";

/* =======================
   DOM
======================= */
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d", { alpha: false });

const overlay = document.getElementById("overlay");
const overlayTitle = document.getElementById("overlayTitle");
const overlayMsg = document.getElementById("overlayMsg");

const btnJump = document.getElementById("btnJump");
const btnBoost = document.getElementById("btnBoost");
const btnJumpBoost = document.getElementById("btnJumpBoost"); // 今は無効（将来アイテム枠）

/* =======================
   MOBILE LOCK (no select/zoom)
======================= */
["dblclick","contextmenu","gesturestart","gesturechange","gestureend"].forEach(ev=>{
  document.addEventListener(ev, e => e.preventDefault(), { passive:false });
});
window.addEventListener("touchmove", e => e.preventDefault(), { passive:false });

/* =======================
   CONFIG
======================= */
const CONFIG = {
  LOGICAL_W: 360,
  LOGICAL_H: 640,

  PX_PER_M: 10,
  TRACK_M: 2000,                  // HA.png 1枚で端〜端 2000m
  TRACK_PX: 2000 * 10,

  PLAYER_SIZE: 48,

  GRAVITY: 2200,
  MAX_FALL_V: 1800,

  JUMP_V1: 860,
  JUMP_V2: 780,

  BASE_SPEED: 260,

  BOOST_ADD: 210,
  BOOST_TIME: 0.85,

  // ring 10 => small accel
  RING_NEED: 10,
  RING_BOOST_ADD: 110,
  RING_BOOST_TIME: 0.55,

  // player stock: 5s regen, max5, start0
  STOCK_MAX: 5,
  STOCK_REGEN: 5.0,
  STOCK_START: 0,

  // AI boost cooldown
  AI_BOOST_COOLDOWN: 5.0,

  // オブジェクト出現密度（少なめに寄せた）
  SPAWN: {
    RAIL_MIN: 520, RAIL_MAX: 820,
    PIPE_MIN: 1000, PIPE_MAX: 1500,
    PUD_MIN: 620, PUD_MAX: 980,

    // 新ギミック
    DOKAN_MIN: 780, DOKAN_MAX: 1300,
    TRUCK_MIN: 900, TRUCK_MAX: 1500,
    DAN_MIN: 1200, DAN_MAX: 1800,

    RING_MIN: 150, RING_MAX: 240
  },

  RACES: [
    { name:"EASY",   goal:  600, start:26, survive:16 },
    { name:"NORMAL", goal: 1000, start:16, survive: 6 },
    { name:"HARD",   goal: 1200, start: 8, survive: 1 }
  ]
};

const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));
const rand  = (a,b)=>a + Math.random()*(b-a);

/* =======================
   ASSETS
======================= */
const ASSETS = {
  pl1:"PL1.png.png",
  pl2:"PL2.png.png",
  board:"redsk.png",
  stage:"st.png",
  rail:"gardw.png",
  hpr:"hpr.png",
  hpg:"hpg.png",
  ring:"ringtap.png",

  // NEW
  bg:"HA.png",
  dokan:"dokan.png",
  truck:"or.png",
  dan:"dan.png"
};
const IMAGES = {};

function loadImage(src){
  return new Promise((res,rej)=>{
    const img = new Image();
    img.onload = ()=>res(img);
    img.onerror = ()=>rej(src);
    img.src = src;
  });
}
async function loadAssets(){
  for(const k in ASSETS){
    if(overlayTitle) overlayTitle.textContent = "Loading";
    if(overlayMsg) overlayMsg.textContent = ASSETS[k];
    IMAGES[k] = await loadImage(ASSETS[k]);
  }
}

/* =======================
   PLAY AREA FIT (JS only)
   canvas下端を操作UI上端に合わせる
======================= */
function fitCanvasToPlayArea(){
  let top = null;
  const rects = [];
  if(btnJump) rects.push(btnJump.getBoundingClientRect());
  if(btnBoost) rects.push(btnBoost.getBoundingClientRect());
  if(btnJumpBoost) rects.push(btnJumpBoost.getBoundingClientRect());

  for(const r of rects){
    if(r && r.top > 0){
      top = (top === null) ? r.top : Math.min(top, r.top);
    }
  }
  if(top === null) top = Math.floor(window.innerHeight * 0.65);

  const playH = Math.max(220, Math.floor(top - 6));
  canvas.style.width  = "100%";
  canvas.style.height = playH + "px";
  canvas.style.display = "block";
}

/* =======================
   CANVAS DPI
======================= */
function resizeCanvas(){
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const r = canvas.getBoundingClientRect();
  canvas.width  = Math.max(1, Math.floor(r.width  * dpr));
  canvas.height = Math.max(1, Math.floor(r.height * dpr));
  ctx.setTransform(dpr,0,0,dpr,0,0);
}

/* =======================
   VERSION BADGE (control area)
======================= */
function attachVersionBadge(){
  try{
    const host =
      (btnJump && btnJump.closest(".controls")) ||
      (btnJump && btnJump.parentElement) ||
      document.body;

    let badge = document.getElementById("jsVersionBadge");
    if(!badge){
      badge = document.createElement("div");
      badge.id = "jsVersionBadge";
      badge.style.position = "absolute";
      badge.style.right = "10px";
      badge.style.bottom = "10px";
      badge.style.zIndex = "99999";
      badge.style.padding = "6px 10px";
      badge.style.borderRadius = "10px";
      badge.style.font = "700 12px system-ui";
      badge.style.color = "rgba(255,255,255,0.92)";
      badge.style.background = "rgba(0,0,0,0.35)";
      badge.style.backdropFilter = "blur(6px)";
      badge.style.pointerEvents = "none";

      const cs = getComputedStyle(host);
      if(cs.position === "static") host.style.position = "relative";
      host.appendChild(badge);
    }
    badge.textContent = VERSION;
  }catch(e){
    console.warn("attachVersionBadge failed:", e);
  }
}

/* =======================
   RESULT MODAL (DOM)
   全員分スクロール表示 + NEXT
======================= */
let resultModal = document.getElementById("jsResultModal");
let resultPanel, resultList, resultTitle, resultNext;

function ensureResultModal(){
  if(resultModal) return;

  resultModal = document.createElement("div");
  resultModal.id = "jsResultModal";
  resultModal.style.position = "fixed";
  resultModal.style.inset = "0";
  resultModal.style.zIndex = "999999";
  resultModal.style.display = "none";
  resultModal.style.background = "rgba(0,0,0,0.55)";
  resultModal.style.backdropFilter = "blur(6px)";
  resultModal.style.pointerEvents = "auto";

  resultPanel = document.createElement("div");
  resultPanel.style.position = "absolute";
  resultPanel.style.left = "50%";
  resultPanel.style.top = "50%";
  resultPanel.style.transform = "translate(-50%,-50%)";
  resultPanel.style.width = "min(92vw, 420px)";
  resultPanel.style.maxHeight = "min(78vh, 520px)";
  resultPanel.style.borderRadius = "16px";
  resultPanel.style.background = "rgba(10,10,14,0.92)";
  resultPanel.style.color = "#fff";
  resultPanel.style.border = "1px solid rgba(255,255,255,0.12)";
  resultPanel.style.display = "flex";
  resultPanel.style.flexDirection = "column";
  resultPanel.style.overflow = "hidden";

  resultTitle = document.createElement("div");
  resultTitle.style.padding = "14px 14px 10px";
  resultTitle.style.font = "800 16px system-ui";
  resultTitle.style.borderBottom = "1px solid rgba(255,255,255,0.10)";
  resultTitle.textContent = "RESULT";

  resultList = document.createElement("div");
  resultList.style.padding = "10px 12px";
  resultList.style.overflow = "auto";
  resultList.style.font = "13px system-ui";
  resultList.style.lineHeight = "1.55";

  const footer = document.createElement("div");
  footer.style.display = "flex";
  footer.style.gap = "10px";
  footer.style.padding = "12px";
  footer.style.borderTop = "1px solid rgba(255,255,255,0.10)";

  resultNext = document.createElement("button");
  resultNext.textContent = "NEXT RACE";
  resultNext.style.flex = "1";
  resultNext.style.padding = "12px 12px";
  resultNext.style.borderRadius = "12px";
  resultNext.style.border = "none";
  resultNext.style.font = "800 14px system-ui";
  resultNext.style.color = "#fff";
  resultNext.style.background = "rgba(255,255,255,0.16)";

  const closeBtn = document.createElement("button");
  closeBtn.textContent = "CLOSE";
  closeBtn.style.flex = "1";
  closeBtn.style.padding = "12px 12px";
  closeBtn.style.borderRadius = "12px";
  closeBtn.style.border = "none";
  closeBtn.style.font = "800 14px system-ui";
  closeBtn.style.color = "#fff";
  closeBtn.style.background = "rgba(255,255,255,0.08)";
  closeBtn.addEventListener("pointerdown", ()=>{ hideResult(); });

  footer.appendChild(resultNext);
  footer.appendChild(closeBtn);

  resultPanel.appendChild(resultTitle);
  resultPanel.appendChild(resultList);
  resultPanel.appendChild(footer);

  resultModal.appendChild(resultPanel);
  document.body.appendChild(resultModal);
}

/* =======================
   TOP8 UI (DOM)
   左上にリアルタイム順位（上位8）
======================= */
let top8Box = document.getElementById("jsTop8");
function ensureTop8(){
  if(top8Box) return;
  top8Box = document.createElement("div");
  top8Box.id = "jsTop8";
  top8Box.style.position = "fixed";
  top8Box.style.left = "10px";
  top8Box.style.top = "10px";
  top8Box.style.zIndex = "99999";
  top8Box.style.padding = "8px 10px";
  top8Box.style.borderRadius = "12px";
  top8Box.style.background = "rgba(0,0,0,0.28)";
  top8Box.style.backdropFilter = "blur(6px)";
  top8Box.style.color = "#fff";
  top8Box.style.font = "12px system-ui";
  top8Box.style.lineHeight = "1.35";
  top8Box.style.pointerEvents = "none";
  top8Box.textContent = "TOP 8";
  document.body.appendChild(top8Box);
}

/* =======================
   INPUT
======================= */
const input = { jump:false, boost:false };
btnJump?.addEventListener("pointerdown", ()=>{ input.jump = true; });
btnBoost?.addEventListener("pointerdown", ()=>{ input.boost = true; });

window.addEventListener("keydown", e=>{
  if(e.key === " ") input.jump = true;
  if(e.key === "b") input.boost = true;
});

// ジャンプブーストは一旦無効（将来アイテム）
if(btnJumpBoost){
  btnJumpBoost.style.opacity="0.45";
  btnJumpBoost.style.filter="grayscale(0.6)";
  btnJumpBoost.addEventListener("pointerdown", (e)=>{
    e.preventDefault(); e.stopPropagation();
  });
}

/* =======================
   STATE / RUNNER
======================= */
const state = {
  phase: "loading",
  raceIndex: 0,

  time: 0,
  lastTime: 0,

  stock: CONFIG.STOCK_START,
  stockTimer: 0,

  cameraX: 0,

  runners: [],
  playerIndex: 0,

  countdown: 3,
  finishedCount: 0
};

function createRunner(name, isPlayer, winRate){
  return {
    name, isPlayer, winRate,

    x: 0, y: 0, vy: 0,
    w: CONFIG.PLAYER_SIZE, h: CONFIG.PLAYER_SIZE,

    onGround: true,

    // ハーフパイプ
    onPipe: false,
    pipeRef: null,
    pipeT: 0,

    // dokan移動
    inDokan: false,
    dokanTimer: 0,
    dokanRef: null,

    jumps: 0,

    boostTimer: 0,
    boostPower: 0,

    slowTimer: 0,
    rings: 0,

    finished: false,
    finishTime: Infinity,

    aiCd: rand(0.20, 0.55),
    aiBoostCd: rand(0.0, CONFIG.AI_BOOST_COOLDOWN)
  };
}

/* =======================
   RACE / GHOSTS
======================= */
const NAMED_GHOSTS = [
  {name:"フレンチ",wr:0.60},
  {name:"レッド",wr:0.70},
  {name:"レッドブルー",wr:0.90},
  {name:"ブラック",wr:0.85},
  {name:"ホワイト",wr:0.75}
];
const LETTERS = "ABCDEFGHIJKLMNOPQRST".split("");

function initRace(idx){
  state.raceIndex = idx;
  state.runners.length = 0;
  state.finishedCount = 0;

  const player = createRunner("YOU", true, 1.0);
  state.runners.push(player);
  state.playerIndex = 0;

  for(const g of NAMED_GHOSTS) state.runners.push(createRunner(g.name, false, g.wr));
  for(const l of LETTERS) state.runners.push(createRunner(l, false, 0.30));

  const race = CONFIG.RACES[idx];
  state.runners = state.runners.slice(0, race.start);

  for(const r of state.runners){
    r.x=0; r.y=0; r.vy=0;
    r.onGround=true;

    r.onPipe=false; r.pipeRef=null; r.pipeT=0;
    r.inDokan=false; r.dokanTimer=0; r.dokanRef=null;

    r.jumps=0;
    r.boostTimer=0; r.boostPower=0;
    r.slowTimer=0; r.rings=0;
    r.finished=false; r.finishTime=Infinity;
    r.aiCd = rand(0.20,0.55);
    r.aiBoostCd = rand(0.0, CONFIG.AI_BOOST_COOLDOWN);
  }

  state.stock = CONFIG.STOCK_START;
  state.stockTimer = 0;

  state.time = 0;
  state.countdown = 3;
  state.phase = "countdown";

  hideResult(); // 次のレースで閉じる

  resetWorldForRace();
  resetGround();
  spawnWorld(0);

  for(const r of state.runners){
    r.x = 0;
    r.y = world.groundY - r.h;
    r.vy = 0;
    r.onGround = true;
  }
}

/* =======================
   RESULT modal show/hide
======================= */
function showResult(){
  ensureResultModal();
  resultModal.style.display = "block";
}
function hideResult(){
  if(!resultModal) return;
  resultModal.style.display = "none";
}

/* === PART 2 START === */
 // game.js  MOB STREET - 1P RUN
// VERSION: v7.0
// PART 2 / 5
// WORLD GENERATION (no overlap) + GIMMICKS SPAWN

/* =======================
   WORLD
======================= */
const world = {
  groundY: 0,
  groundH: 72,

  rails: [],
  pipes: [],
  puddles: [],
  rings: [],

  dokans: [],
  trucks: [],
  dans: [],

  occupied: [] // {x0,x1,type}
};

/* =======================
   GROUND
======================= */
function resetGround(){
  world.groundH = 72;
  // 操作UIに埋まらないよう少し上げる
  const lift = 56;
  world.groundY = (CONFIG.LOGICAL_H - world.groundH) - lift;
  world.groundY = Math.max(220, world.groundY);
}

/* =======================
   OCCUPIED RANGE
======================= */
function isFree(x0, x1){
  for(const o of world.occupied){
    if(!(x1 < o.x0 || x0 > o.x1)) return false;
  }
  return true;
}
function reserve(x0, x1, type){
  world.occupied.push({x0, x1, type});
}

/* =======================
   WORLD RESET
======================= */
function resetWorldForRace(){
  world.rails.length = 0;
  world.pipes.length = 0;
  world.puddles.length = 0;
  world.rings.length = 0;

  world.dokans.length = 0;
  world.trucks.length = 0;
  world.dans.length = 0;

  world.occupied.length = 0;
}

/* =======================
   SPAWN HELPERS
======================= */
function trySpawn(x, w, type, fn){
  const x0 = x - 20;
  const x1 = x + w + 20;
  if(!isFree(x0, x1)) return false;
  fn();
  reserve(x0, x1, type);
  return true;
}

/* =======================
   SPAWN WORLD
======================= */
let nextRailX = 420;
let nextPipeX = 800;
let nextPudX  = 520;
let nextRingX = 160;

let nextDokanX = 900;
let nextTruckX = 1000;
let nextDanX   = 1300;

function spawnWorld(cameraX){
  const maxX = cameraX + CONFIG.LOGICAL_W * 2;

  /* --- RAIL --- */
  while(nextRailX < maxX){
    const img = IMAGES.rail;
    const h = world.groundH * 0.45;
    const w = img.width * (h / img.height);

    const x = nextRailX;
    const y = world.groundY - h;

    trySpawn(x, w, "rail", ()=>{
      world.rails.push({x, y, w, h});
    });

    nextRailX += rand(CONFIG.SPAWN.RAIL_MIN, CONFIG.SPAWN.RAIL_MAX);
  }

  /* --- HALF PIPE (hpr / hpg) --- */
  while(nextPipeX < maxX){
    const img = (Math.random()<0.5) ? IMAGES.hpr : IMAGES.hpg;
    const h = world.groundH * 0.75;
    const w = h * 2.0; // 横を大きめに

    const x = nextPipeX;
    const y = world.groundY - h;

    trySpawn(x, w, "pipe", ()=>{
      world.pipes.push({
        x, y, w, h, img,
        cx: x + w/2,
        r: w/2
      });
    });

    nextPipeX += rand(CONFIG.SPAWN.PIPE_MIN, CONFIG.SPAWN.PIPE_MAX);
  }

  /* --- PUDDLE --- */
  while(nextPudX < maxX){
    const w = rand(36, 56);
    const h = 10;
    const x = nextPudX;
    const y = world.groundY - h;

    trySpawn(x, w, "pud", ()=>{
      world.puddles.push({x, y, w, h});
    });

    nextPudX += rand(CONFIG.SPAWN.PUD_MIN, CONFIG.SPAWN.PUD_MAX);
  }

  /* --- RING (ground & air) --- */
  while(nextRingX < maxX){
    const air = Math.random() < 0.35;
    const x = nextRingX;
    const y = air
      ? world.groundY - rand(80, 160)
      : world.groundY - 24;

    world.rings.push({x, y, taken:false});
    nextRingX += rand(CONFIG.SPAWN.RING_MIN, CONFIG.SPAWN.RING_MAX);
  }

  /* --- DOKAN --- */
  while(nextDokanX < maxX){
    const img = IMAGES.dokan;
    const h = world.groundH * 0.9;
    const w = img.width * (h / img.height);
    const air = Math.random() < 0.4;

    const x = nextDokanX;
    const y = air
      ? world.groundY - h - rand(60, 120)
      : world.groundY - h;

    trySpawn(x, w, "dokan", ()=>{
      world.dokans.push({x, y, w, h});
    });

    nextDokanX += rand(CONFIG.SPAWN.DOKAN_MIN, CONFIG.SPAWN.DOKAN_MAX);
  }

  /* --- TRUCK --- */
  while(nextTruckX < maxX){
    const img = IMAGES.truck;
    const h = world.groundH * 0.55;
    const w = img.width * (h / img.height);

    const x = nextTruckX;
    const y = world.groundY - h;

    trySpawn(x, w, "truck", ()=>{
      world.trucks.push({x, y, w, h});
    });

    nextTruckX += rand(CONFIG.SPAWN.TRUCK_MIN, CONFIG.SPAWN.TRUCK_MAX);
  }

  /* --- DAN (always rideable slope) --- */
  while(nextDanX < maxX){
    const img = IMAGES.dan;
    const h = world.groundH * 0.65;
    const w = img.width * (h / img.height);

    const x = nextDanX;
    const y = world.groundY - h;

    trySpawn(x, w, "dan", ()=>{
      world.dans.push({x, y, w, h});
    });

    nextDanX += rand(CONFIG.SPAWN.DAN_MIN, CONFIG.SPAWN.DAN_MAX);
  }
}

/* === PART 3 START === */
 // game.js  MOB STREET - 1P RUN
// VERSION: v7.0
// PART 3 / 5
// PHYSICS & BEHAVIOR
// run / jump / rail / half-pipe / dokan / truck / dan

/* =======================
   UPDATE RUN (MAIN)
======================= */
function updateRun(dt){
  state.time += dt;

  // カメラはプレイヤー基準
  const player = state.runners[state.playerIndex];
  state.cameraX = Math.max(0, player.x - CONFIG.LOGICAL_W * 0.18);

  spawnWorld(state.cameraX);

  // ストック回復（プレイヤー）
  state.stockTimer += dt;
  if(state.stockTimer >= CONFIG.STOCK_REGEN){
    state.stockTimer = 0;
    state.stock = Math.min(CONFIG.STOCK_MAX, state.stock + 1);
  }

  // 各ランナー更新
  for(const r of state.runners){
    if(r.finished) continue;
    updateRunner(r, dt);
  }

  updateRank();
  checkFinish();
}

/* =======================
   UPDATE RUNNER
======================= */
function updateRunner(r, dt){
  /* ---- AI INPUT ---- */
  let doJump = false;
  let doBoost = false;

  if(!r.isPlayer){
    r.aiCd -= dt;
    if(r.aiCd <= 0){
      r.aiCd = rand(0.25, 0.6);
      if(Math.random() < r.winRate) doJump = true;
    }
    r.aiBoostCd -= dt;
    if(r.aiBoostCd <= 0){
      r.aiBoostCd = CONFIG.AI_BOOST_COOLDOWN;
      if(Math.random() < r.winRate) doBoost = true;
    }
  }else{
    doJump = input.jump;
    doBoost = input.boost && state.stock > 0;
  }

  /* ---- SPEED ---- */
  let speed = CONFIG.BASE_SPEED;

  if(r.boostTimer > 0){
    r.boostTimer -= dt;
    speed += r.boostPower;
  }

  if(r.slowTimer > 0){
    r.slowTimer -= dt;
    speed *= 0.7;
  }

  /* ---- MOVE X ---- */
  r.x += speed * dt;

  /* ---- GRAVITY ---- */
  r.vy += CONFIG.GRAVITY * dt;
  r.vy = Math.min(CONFIG.MAX_FALL_V, r.vy);
  r.y += r.vy * dt;

  /* ---- JUMP ---- */
  if(doJump && (r.onGround || r.onPipe)){
    r.vy = -CONFIG.JUMP_V1;
    r.onGround = false;
    r.onPipe = false;
  }

  /* ---- BOOST ---- */
  if(doBoost){
    r.boostTimer = CONFIG.BOOST_TIME;
    r.boostPower = CONFIG.BOOST_ADD;
    if(r.isPlayer){
      state.stock--;
    }
  }

  /* ---- COLLISIONS ---- */
  r.onGround = false;

  // 地面
  if(r.y + r.h >= world.groundY){
    r.y = world.groundY - r.h;
    r.vy = 0;
    r.onGround = true;
  }

  /* ---- WATER PUDDLE ---- */
  for(const p of world.puddles){
    if(hitRect(r, p)){
      r.slowTimer = 0.35;
    }
  }

  /* ---- RING ---- */
  for(const ring of world.rings){
    if(!ring.taken && hitPoint(r, ring.x, ring.y)){
      ring.taken = true;
      r.rings++;
      if(r.rings >= CONFIG.RING_NEED){
        r.rings = 0;
        r.boostTimer = CONFIG.RING_BOOST_TIME;
        r.boostPower = CONFIG.RING_BOOST_ADD;
      }
    }
  }

  /* ---- GUARD RAIL ---- */
  for(const g of world.rails){
    if(hitTop(r, g)){
      r.y = g.y - r.h;
      r.vy = 0;
      r.onGround = true;
    }
  }

  /* ---- HALF PIPE ---- */
  r.onPipe = false;
  for(const p of world.pipes){
    if(r.x + r.w/2 >= p.x && r.x + r.w/2 <= p.x + p.w){
      const dx = (r.x + r.w/2) - p.cx;
      const nx = clamp(dx / p.r, -1, 1);
      const curveY = Math.sin(nx * Math.PI * 0.5) * p.h;
      const py = p.y + p.h - curveY - r.h;

      if(r.y + r.h >= py - 4 && r.y + r.h <= py + 20){
        r.y = py;
        r.vy = -nx * 420 * dt;
        r.onPipe = true;
      }
    }
  }

  /* ---- DOKAN ---- */
  for(const d of world.dokans){
    // 入口判定
    if(!r.inDokan && hitRect(r, d)){
      if(Math.abs((r.x + r.w/2) - (d.x + d.w/2)) < d.w*0.25){
        // 成功
        r.inDokan = true;
        r.dokanTimer = 0.7;
        r.dokanRef = d;
      }else{
        // 失敗ノックバック
        r.x -= 24;
      }
    }
  }
  if(r.inDokan){
    r.dokanTimer -= dt;
    r.x += speed * 1.2 * dt;
    if(r.dokanTimer <= 0){
      r.inDokan = false;
      r.dokanRef = null;
    }
  }

  /* ---- TRUCK ---- */
  for(const t of world.trucks){
    if(hitTop(r, t)){
      r.y = t.y - r.h;
      r.vy = 0;
      r.onGround = true;
    }else if(hitRect(r, t)){
      r.x -= 30;
    }
  }

  /* ---- DAN ---- */
  for(const d of world.dans){
    if(hitTop(r, d)){
      r.y = d.y - r.h;
      r.vy = 0;
      r.onGround = true;
      r.boostTimer = Math.max(r.boostTimer, 0.25);
      r.boostPower = Math.max(r.boostPower, 90);
    }
  }

  // リセット入力
  if(r.isPlayer){
    input.jump = false;
    input.boost = false;
  }
}

/* =======================
   COLLISION HELPERS
======================= */
function hitRect(a,b){
  return (
    a.x < b.x + b.w &&
    a.x + a.w > b.x &&
    a.y < b.y + b.h &&
    a.y + a.h > b.y
  );
}
function hitTop(a,b){
  return (
    a.x + a.w > b.x &&
    a.x < b.x + b.w &&
    a.y + a.h <= b.y + 10 &&
    a.y + a.h >= b.y - 10 &&
    a.vy >= 0
  );
}
function hitPoint(r, px, py){
  return (
    px >= r.x && px <= r.x + r.w &&
    py >= r.y && py <= r.y + r.h
  );
}

/* =======================
   FINISH & RANK
======================= */
function checkFinish(){
  const race = CONFIG.RACES[state.raceIndex];
  const goalX = race.goal * CONFIG.PX_PER_M;

  for(const r of state.runners){
    if(!r.finished && r.x >= goalX){
      r.finished = true;
      r.finishTime = state.time;
      state.finishedCount++;
    }
  }

  if(state.finishedCount === state.runners.length){
    buildResult();
    showResult();
    state.phase = "result";
  }
}

function updateRank(){
  const list = [...state.runners].sort((a,b)=>b.x - a.x);
  const top = list.slice(0,8);

  ensureTop8();
  let html = "<b>TOP 8</b><br>";
  top.forEach((r,i)=>{
    html += `${i+1}. ${r.isPlayer ? "<b>YOU</b>" : r.name}<br>`;
  });
  top8Box.innerHTML = html;
}

function buildResult(){
  ensureResultModal();
  const list = [...state.runners].sort((a,b)=>a.finishTime - b.finishTime);

  resultTitle.textContent =
    `RESULT - ${CONFIG.RACES[state.raceIndex].name}`;

  let html = "";
  list.forEach((r,i)=>{
    const t = isFinite(r.finishTime) ? r.finishTime.toFixed(2)+"s" : "--";
    html += `<div style="padding:4px 0;${r.isPlayer?"color:#00ffd0;font-weight:700;":""}">
      ${i+1}. ${r.isPlayer?"YOU":r.name} - ${t}
    </div>`;
  });
  resultList.innerHTML = html;

  resultNext.onclick = ()=>{
    const next = state.raceIndex + 1;
    if(next < CONFIG.RACES.length){
      initRace(next);
    }else{
      initRace(0);
    }
  };
}

/* === PART 4 START === */
 // game.js  MOB STREET - 1P RUN
// VERSION: v7.0
// PART 4 / 5
// RENDERING (HA background, gimmicks, transparency)

/* =======================
   DRAW BASE (CONTAIN)
======================= */
function beginDraw(){
  const cw = canvas.width;
  const ch = canvas.height;

  const sx = cw / CONFIG.LOGICAL_W;
  const sy = ch / CONFIG.LOGICAL_H;
  const s  = Math.min(sx, sy);

  const dw = CONFIG.LOGICAL_W * s;
  const dh = CONFIG.LOGICAL_H * s;
  const ox = (cw - dw) * 0.5;
  const oy = (ch - dh) * 0.5;

  ctx.setTransform(1,0,0,1,0,0);
  ctx.fillStyle = "#163d7a";
  ctx.fillRect(0,0,cw,ch);

  ctx.setTransform(s,0,0,s,ox,oy);
  ctx.imageSmoothingEnabled = false;
}

/* =======================
   BACKGROUND (HA.png)
   2000m fixed, no loop
======================= */
function drawBackground(){
  const img = IMAGES.bg;
  if(!img) return;

  const worldW = CONFIG.TRACK_PX;
  const scale  = CONFIG.LOGICAL_H / img.height;
  const drawW  = img.width * scale;

  // 2000m分を1枚で収めるため横スケール調整
  const sx = worldW / drawW;

  const camX = clamp(state.cameraX, 0, worldW - CONFIG.LOGICAL_W);
  const dx = -camX * sx;

  ctx.save();
  ctx.translate(dx, 0);
  ctx.scale(sx, 1);
  ctx.drawImage(img, 0, 0, img.width, img.height, 0, 0, drawW, CONFIG.LOGICAL_H);
  ctx.restore();
}

/* =======================
   STAGE (ground)
======================= */
function drawStage(){
  const img = IMAGES.stage;
  if(!img) return;

  const h = world.groundH;
  const y = world.groundY;
  const s = h / img.height;
  const w = Math.floor(img.width * s);

  let x = -((state.cameraX % w + w) % w);
  for(; x < CONFIG.LOGICAL_W + w; x += w){
    ctx.drawImage(img, x, y, w, h);
  }
}

/* =======================
   GIMMICKS
======================= */
function drawGimmicks(){
  // puddle
  ctx.fillStyle = "rgba(120,190,255,0.45)";
  for(const p of world.puddles){
    const sx = p.x - state.cameraX;
    if(sx < -80 || sx > CONFIG.LOGICAL_W + 80) continue;
    ctx.fillRect(sx, p.y, p.w, p.h);
  }

  // rings
  const ring = IMAGES.ring;
  if(ring){
    for(const r of world.rings){
      if(r.taken) continue;
      const sx = r.x - state.cameraX;
      if(sx < -60 || sx > CONFIG.LOGICAL_W + 60) continue;
      ctx.drawImage(ring, sx-10, r.y-10, 20, 20);
    }
  }

  // rails
  const rail = IMAGES.rail;
  if(rail){
    for(const g of world.rails){
      const sx = g.x - state.cameraX;
      if(sx < -160 || sx > CONFIG.LOGICAL_W + 160) continue;
      ctx.drawImage(rail, sx, g.y, g.w, g.h);
    }
  }

  // half pipes
  for(const p of world.pipes){
    const sx = p.x - state.cameraX;
    if(sx < -200 || sx > CONFIG.LOGICAL_W + 200) continue;
    ctx.drawImage(p.img, sx, p.y, p.w, p.h);
  }

  // dokan
  const dokan = IMAGES.dokan;
  if(dokan){
    for(const d of world.dokans){
      const sx = d.x - state.cameraX;
      if(sx < -200 || sx > CONFIG.LOGICAL_W + 200) continue;
      ctx.drawImage(dokan, sx, d.y, d.w, d.h);
    }
  }

  // truck
  const truck = IMAGES.truck;
  if(truck){
    for(const t of world.trucks){
      const sx = t.x - state.cameraX;
      if(sx < -200 || sx > CONFIG.LOGICAL_W + 200) continue;
      ctx.drawImage(truck, sx, t.y, t.w, t.h);
    }
  }

  // dan
  const dan = IMAGES.dan;
  if(dan){
    for(const d of world.dans){
      const sx = d.x - state.cameraX;
      if(sx < -200 || sx > CONFIG.LOGICAL_W + 200) continue;
      ctx.drawImage(dan, sx, d.y, d.w, d.h);
    }
  }
}

/* =======================
   RUNNERS
======================= */
function screenXOf(r){
  if(r.isPlayer) return Math.floor(CONFIG.LOGICAL_W * 0.18);
  const p = state.runners[state.playerIndex];
  return Math.floor(CONFIG.LOGICAL_W * 0.18 + (r.x - p.x));
}

function drawRunner(r){
  const sx = screenXOf(r);
  if(sx < -80 || sx > CONFIG.LOGICAL_W + 80) return;

  // shadow
  ctx.fillStyle = "rgba(0,0,0,0.25)";
  ctx.beginPath();
  ctx.ellipse(sx + r.w/2, world.groundY + 5, r.w*0.35, 5, 0, 0, Math.PI*2);
  ctx.fill();

  // board
  const board = IMAGES.board;
  if(board){
    ctx.drawImage(board, sx - r.w*0.05, r.y + r.h*0.65, r.w*1.1, r.h*0.45);
  }

  // body (half transparent in dokan)
  ctx.save();
  if(r.inDokan) ctx.globalAlpha = 0.45;
  const body = (r.onGround || r.onPipe) ? IMAGES.pl1 : IMAGES.pl2;
  if(body){
    ctx.drawImage(body, sx, r.y, r.w, r.h);
  }
  ctx.restore();

  // player label
  if(r.isPlayer){
    ctx.font = "10px system-ui";
    ctx.textAlign = "center";
    ctx.lineWidth = 3;
    ctx.strokeStyle = "rgba(0,0,0,0.9)";
    ctx.fillStyle = "#fff";
    ctx.strokeText("プレイヤー", sx + r.w/2, r.y - 6);
    ctx.fillText("プレイヤー", sx + r.w/2, r.y - 6);
    ctx.textAlign = "left";
  }
}

/* =======================
   MAIN RENDER
======================= */
function render(){
  beginDraw();

  drawBackground();
  drawStage();
  drawGimmicks();

  // runners
  for(const r of state.runners){
    if(!r.isPlayer && r.winRate > 0.30) drawRunner(r);
  }
  drawRunner(state.runners[state.playerIndex]);

  // countdown overlay
  if(state.phase === "countdown"){
    ctx.fillStyle = "rgba(0,0,0,0.15)";
    ctx.fillRect(0,0,CONFIG.LOGICAL_W,CONFIG.LOGICAL_H);
    ctx.fillStyle = "#fff";
    ctx.font = "bold 64px system-ui";
    ctx.textAlign = "center";
    ctx.fillText(Math.ceil(state.countdown), CONFIG.LOGICAL_W/2, CONFIG.LOGICAL_H/2);
    ctx.textAlign = "left";
  }
}

/* === PART 5 START === */
 // game.js  MOB STREET - 1P RUN
// VERSION: v7.0
// PART 5 / 5
// LOOP / COUNTDOWN / BOOT / RESIZE / START

/* =======================
   COUNTDOWN
======================= */
function updateCountdown(dt){
  state.countdown -= dt;
  if(state.countdown <= 0){
    state.phase = "run";
  }
}

/* =======================
   UPDATE (phase)
======================= */
function update(dt){
  if(state.phase === "countdown"){
    updateCountdown(dt);
    return;
  }
  if(state.phase === "run"){
    updateRun(dt);
    return;
  }
  // result: DOM modalのみ
}

/* =======================
   MAIN LOOP
======================= */
function loop(t){
  const dt = Math.min((t - state.lastTime) / 1000, 0.033);
  state.lastTime = t;

  if(state.phase !== "loading"){
    update(dt);
  }
  render();

  requestAnimationFrame(loop);
}

/* =======================
   INIT SPAWN CLOCKS
======================= */
function resetSpawnClocks(){
  nextRailX  = 420;
  nextPipeX  = 800;
  nextPudX   = 520;
  nextRingX  = 160;

  nextDokanX = 900;
  nextTruckX = 1000;
  nextDanX   = 1300;
}

/* =======================
   BOOT CORE
======================= */
async function boot(){
  try{
    ensureResultModal();
    ensureTop8();

    fitCanvasToPlayArea();
    resizeCanvas();
    attachVersionBadge();

    state.phase = "loading";
    if(overlay) overlay.style.display = "block";
    if(overlayTitle) overlayTitle.textContent = "Loading";
    if(overlayMsg) overlayMsg.textContent = "assets";

    await loadAssets();

    if(overlay) overlay.style.display = "none";

    // spawn clock reset
    resetSpawnClocks();

    // start race1
    initRace(0);

    state.lastTime = performance.now();
    requestAnimationFrame(loop);
  }catch(e){
    console.error(e);
    if(overlay){
      overlay.style.display = "block";
      if(overlayTitle) overlayTitle.textContent = "Error";
      if(overlayMsg) overlayMsg.textContent = String(e);
    }
  }
}

/* =======================
   RESIZE
======================= */
window.addEventListener("resize", ()=>{
  fitCanvasToPlayArea();
  resizeCanvas();
  attachVersionBadge();
});

/* =======================
   START
======================= */
boot();

/* =======================
   CLOSE IIFE
======================= */
})();
