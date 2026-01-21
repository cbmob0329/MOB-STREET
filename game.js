// game.js PART 1 / 5  (MOB STREET)
// VERSION: v1.3.0-hud-clean-ring-bonus-ai-nextbtn
// 変更:
// - HUD被り/見切れ対策：JS固定HUDを「最小情報」に一本化（セーフエリア対応）
// - ジャンプブースト（5消費）は一旦無効（将来のアイテム枠）
// - リング10個で小加速（ブーストの約半分）※自動発動、リング10消費
// - リングは空中にも出現
// - 名前ありCPUはレール/パイプを積極的に使う
// - リザルト後の「次へ」固定ボタンをJSで確実に表示
(() => {
"use strict";

const VERSION = "v1.3.0-hud-clean-ring-bonus-ai-nextbtn";

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
const btnJumpBoost = document.getElementById("btnJumpBoost"); // ← 一旦無効
const btnNext = document.getElementById("btnNext"); // 既存があっても使わない（見つからない問題回避）

const hudSpeed = document.getElementById("hudSpeed");
const hudDist  = document.getElementById("hudDist");

/* =======================
   MOBILE LOCK
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

  PLAYER_SIZE: 48,

  GRAVITY: 2200,
  MAX_FALL_V: 1800,

  JUMP_V1: 860,
  JUMP_V2: 780,

  BASE_SPEED: 260,

  BOOST_ADD: 210,
  BOOST_TIME: 0.85,

  // ★リング10で小加速（ブーストの半分くらい）
  RING_NEED: 10,
  RING_BONUS_ADD: 105,      // BOOST_ADD * 0.5
  RING_BONUS_TIME: 0.60,    // 少しだけ

  // ★固定：5秒 / 最大5 / 初期0
  STOCK_MAX: 5,
  STOCK_REGEN: 5.0,
  STOCK_START: 0,

  // リング空中スポーン
  RING_GROUND_Y_OFFSET: 26,
  RING_AIR_Y_OFFSET: 120,   // 地面から上の高さ（おおよそ）

  RACES: [
    { name:"EASY",   goal:600,  start:26, survive:16 },
    { name:"NORMAL", goal:1000, start:16, survive:6  },
    { name:"HARD",   goal:1200, start:8,  survive:1  }
  ]
};

/* =======================
   UTIL
======================= */
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const rand=(a,b)=>a+Math.random()*(b-a);

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
  ring:"ringtap.png"
};
const IMAGES = {};

function loadImage(src){
  return new Promise((res, rej)=>{
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = () => rej(src);
    i.src = src;
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
   FIXED HUD (CLEAN)
======================= */
let hudFixed = document.getElementById("jsHudFixed");
if(!hudFixed){
  hudFixed = document.createElement("div");
  hudFixed.id = "jsHudFixed";
  hudFixed.style.position = "fixed";
  hudFixed.style.left = "10px";
  hudFixed.style.top = "calc(env(safe-area-inset-top, 0px) + 8px)";
  hudFixed.style.zIndex = "99999";
  hudFixed.style.pointerEvents = "none";
  hudFixed.style.font = "12px system-ui";
  hudFixed.style.color = "rgba(255,255,255,0.96)";
  hudFixed.style.textShadow = "0 1px 2px rgba(0,0,0,0.85)";
  hudFixed.style.whiteSpace = "pre";
  hudFixed.style.padding = "8px 10px";
  hudFixed.style.borderRadius = "10px";
  hudFixed.style.background = "rgba(0,0,0,0.28)";
  hudFixed.style.maxWidth = "calc(100vw - 20px)";
  document.body.appendChild(hudFixed);
}

/* =======================
   FIXED NEXT BUTTON (RESULT)
======================= */
let nextFixed = document.getElementById("jsNextFixed");
if(!nextFixed){
  nextFixed = document.createElement("button");
  nextFixed.id = "jsNextFixed";
  nextFixed.textContent = "次のレースへ";
  nextFixed.style.position = "fixed";
  nextFixed.style.left = "50%";
  nextFixed.style.transform = "translateX(-50%)";
  nextFixed.style.bottom = "calc(env(safe-area-inset-bottom, 0px) + 16px)";
  nextFixed.style.zIndex = "100000";
  nextFixed.style.padding = "14px 18px";
  nextFixed.style.borderRadius = "14px";
  nextFixed.style.border = "0";
  nextFixed.style.font = "bold 16px system-ui";
  nextFixed.style.background = "rgba(255,255,255,0.92)";
  nextFixed.style.color = "#111";
  nextFixed.style.boxShadow = "0 8px 24px rgba(0,0,0,0.35)";
  nextFixed.style.display = "none";
  document.body.appendChild(nextFixed);
}

/* =======================
   DISABLE JUMP BOOST (TEMP)
======================= */
if(btnJumpBoost){
  btnJumpBoost.style.opacity = "0.35";
  btnJumpBoost.style.pointerEvents = "none";
}

/* =======================
   STATE
======================= */
const state = {
  phase: "loading", // loading / countdown / run / result
  raceIndex: 0,
  time: 0,
  lastTime: 0,

  stock: CONFIG.STOCK_START,
  stockTimer: 0,

  cameraX: 0,

  runners: [],
  playerIndex: 0,

  countdown: 3,
  finishedCount: 0,

  rank: 1,
  rankText: ""
};

/* =======================
   RUNNER
======================= */
function createRunner(name, isPlayer, winRate, isNamed=false){
  return {
    name, isPlayer, winRate, isNamed,

    x: 0, y: 0, vy: 0,
    w: CONFIG.PLAYER_SIZE, h: CONFIG.PLAYER_SIZE,

    onGround: true,
    onRail: false,
    onPipe: false,

    wasOnPipe: false,
    pipeRef: null,
    pipeT: 0,

    jumps: 0,

    boostTimer: 0,
    boostPower: 0,

    slowTimer: 0,
    rings: 0,

    finished: false,
    finishTime: Infinity,

    aiCd: rand(0.2, 0.6)
  };
}

/* =======================
   INPUT
======================= */
const input = { jump:false, boost:false };

btnJump?.addEventListener("pointerdown", ()=> input.jump = true);
btnBoost?.addEventListener("pointerdown", ()=> input.boost = true);

window.addEventListener("keydown", e=>{
  if(e.key === " ") input.jump = true;
  if(e.key === "b") input.boost = true;
});

/* =======================
   CANVAS RESIZE
======================= */
function resizeCanvas(){
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const r = canvas.getBoundingClientRect();
  canvas.width  = r.width * dpr;
  canvas.height = r.height * dpr;
  ctx.setTransform(dpr,0,0,dpr,0,0);
}
window.addEventListener("resize", resizeCanvas);

/* =======================
   RACE INIT
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
  state.time = 0;

  // player
  state.runners.push(createRunner("YOU", true, 1.0, false));
  state.playerIndex = 0;

  // named 5
  for(const g of NAMED_GHOSTS){
    state.runners.push(createRunner(g.name, false, g.wr, true));
  }
  // others
  for(const l of LETTERS){
    state.runners.push(createRunner(l, false, 0.30, false));
  }

  const race = CONFIG.RACES[idx];
  state.runners = state.runners.slice(0, race.start);

  for(const r of state.runners){
    r.x=0; r.y=0; r.vy=0;
    r.onGround=true; r.onRail=false; r.onPipe=false;
    r.wasOnPipe=false; r.pipeRef=null; r.pipeT=0;
    r.jumps=0; r.boostTimer=0; r.boostPower=0;
    r.slowTimer=0; r.rings=0;
    r.finished=false; r.finishTime=Infinity;
    r.aiCd = rand(0.2,0.6);
  }

  state.stock = CONFIG.STOCK_START;
  state.stockTimer = 0;

  state.countdown = 3;
  state.phase = "countdown";

  nextFixed.style.display = "none";
}

/* =======================
   HUD TEXT (CLEAN)
======================= */
function updateRank(){
  const p = state.runners[state.playerIndex];
  let better = 0;
  for(const r of state.runners){
    if(r!==p && r.x > p.x) better++;
  }
  state.rank = better + 1;
  state.rankText = `RANK ${state.rank}/${state.runners.length}`;
}
function updateFixedHud(){
  const p = state.runners[state.playerIndex];
  const dist = Math.floor(p.x / CONFIG.PX_PER_M);
  const spd = Math.floor(speedOf(p));
  const raceName = CONFIG.RACES[state.raceIndex].name;

  hudFixed.textContent =
`${VERSION}
${raceName}  DIST ${dist}m  SPD ${spd}
${state.rankText}
BOOST ${state.stock}/${CONFIG.STOCK_MAX}  (regen ${CONFIG.STOCK_REGEN}s)
RING ${p.rings}/${CONFIG.RING_NEED}`;
}

/* =======================
   BOOT CORE
======================= */
async function bootCore(){
  state.phase = "loading";
  if(overlayTitle) overlayTitle.textContent = "Loading";
  if(overlayMsg) overlayMsg.textContent = "assets";
  resizeCanvas();
  await loadAssets();

  // overlay消す
  if(overlay) overlay.style.display = "none";
  state.lastTime = performance.now();
}

/* === PART2 START === */
 // game.js PART 2 / 5  (MOB STREET v1.3.0)
// WORLD / SPAWN / RING AIR / NON-OVERLAP

const world = {
  groundH: 170,
  groundTop: 0,

  rails: [],
  pipes: [],
  puddles: [],
  rings: [],

  nextRailX: 220,
  nextPipeX: 700,
  nextPuddleX: 260,
  nextRingX: 260,

  goalX: 0
};

function resetGround(){
  const st = IMAGES.stage;
  world.groundH = st ? Math.max(130, Math.min(210, st.height)) : 170;
  world.groundTop = CONFIG.LOGICAL_H - world.groundH;

  for(const r of state.runners){
    r.y = world.groundTop - r.h;
  }
}

function setGoal(){
  const race = CONFIG.RACES[state.raceIndex];
  world.goalX = race.goal * CONFIG.PX_PER_M;
}

/* ---------- overlap ---------- */
function overlapsAny(x,w,list,margin=40){
  for(const o of list){
    if(x < o.x + o.w + margin && x + w + margin > o.x){
      return true;
    }
  }
  return false;
}

/* ---------- rail ---------- */
function addRail(x){
  const img = IMAGES.rail;
  const h = Math.floor(world.groundH * 0.38);
  const w = img ? Math.floor(img.width * (h / img.height)) : 140;

  // pipeと被らない
  if(overlapsAny(x,w,world.pipes,110)){
    world.nextRailX = x + w + 260;
    return;
  }

  world.rails.push({
    x,
    y: world.groundTop - h,
    w,
    h
  });

  world.nextRailX = x + w + rand(260,480);
}

/* ---------- pipe ---------- */
function addPipe(x){
  const img = Math.random() < 0.5 ? IMAGES.hpr : IMAGES.hpg;
  if(!img) return;

  const h = Math.floor(world.groundH * 0.38);
  const w = Math.floor(img.width * (h / img.height));

  // railと被らない
  if(overlapsAny(x,w,world.rails,110)){
    world.nextPipeX = x + w + 360;
    return;
  }

  world.pipes.push({
    x,
    y: world.groundTop - h,
    w,
    h,
    img
  });

  world.nextPipeX = x + w + rand(720,900);
}

/* ---------- puddle ---------- */
function addPuddle(x){
  const w = rand(48,96);
  const h = 12;
  world.puddles.push({
    x,
    y: world.groundTop + world.groundH * 0.22,
    w,
    h
  });
  world.nextPuddleX = x + w + rand(220,380);
}

/* ---------- ring (ground or air) ---------- */
function addRing(x){
  const s = 22;

  // 空中リングを混ぜる（約45%）
  const isAir = Math.random() < 0.45;

  const y = isAir
    ? (world.groundTop - s - CONFIG.RING_AIR_Y_OFFSET - rand(0, 30))
    : (world.groundTop - s - CONFIG.RING_GROUND_Y_OFFSET);

  // pipe/railの上で見えなくならないよう少し後ろに逃がす
  const safeX = x + rand(-10, 10);

  world.rings.push({
    x: safeX,
    y,
    w: s,
    h: s
  });

  world.nextRingX = x + rand(120,200);
}

/* ---------- spawn ---------- */
function spawnWorld(px){
  const ahead = px + 1000;
  const behind = px - 420;

  while(world.nextRingX < ahead)   addRing(world.nextRingX);
  while(world.nextRailX < ahead)   addRail(world.nextRailX);
  while(world.nextPipeX < ahead)   addPipe(world.nextPipeX);
  while(world.nextPuddleX < ahead) addPuddle(world.nextPuddleX);

  world.rings   = world.rings.filter(o=>o.x+o.w>behind);
  world.rails   = world.rails.filter(o=>o.x+o.w>behind);
  world.pipes   = world.pipes.filter(o=>o.x+o.w>behind-200);
  world.puddles = world.puddles.filter(o=>o.x+o.w>behind);
}

/* ---------- countdown ---------- */
function updateCountdown(dt){
  state.countdown -= dt;
  if(state.countdown <= 0){
    state.phase = "run";
  }
  updateRank();
  updateFixedHud();
}

/* === PART3 START === */
 // game.js PART 3 / 5  (MOB STREET v1.3.0)
// PHYSICS / PIPE CLIMB STABLE / RING BONUS / NAMED AI ENHANCE

/* ---------- stock regen ---------- */
function regenStock(dt){
  state.stockTimer += dt;
  while(state.stockTimer >= CONFIG.STOCK_REGEN){
    state.stockTimer -= CONFIG.STOCK_REGEN;
    if(state.stock < CONFIG.STOCK_MAX) state.stock++;
  }
}

/* ---------- boost helpers ---------- */
function applyBoost(r, add, t){
  r.boostPower = add;
  r.boostTimer = t;
}
function tryJump(r){
  if(r.onGround || r.onRail || r.onPipe){
    r.vy = -CONFIG.JUMP_V1;
    r.jumps = 1;
    r.onGround = r.onRail = r.onPipe = false;
    return;
  }
  if(r.jumps < 2){
    r.vy = -CONFIG.JUMP_V2;
    r.jumps = 2;
  }
}

/* ---------- rail ---------- */
function updateRail(r, prevY){
  const cx = r.x + r.w*0.5;
  for(const rail of world.rails){
    if(cx < rail.x || cx > rail.x + rail.w) continue;
    const top = rail.y;
    const prevFoot = prevY + r.h;
    const foot = r.y + r.h;
    if(prevFoot <= top && foot >= top && r.vy >= 0){
      r.y = top - r.h; r.vy = 0;
      r.onRail = true; r.onGround = false; r.jumps = 0;
      return true;
    }
  }
  r.onRail = false;
  return false;
}

/* ---------- pipe helpers ---------- */
function pipeAt(cx){
  for(const p of world.pipes){
    if(cx >= p.x && cx <= p.x + p.w) return p;
  }
  return null;
}
function pipeSurfaceY(pipe, t){
  const depth = pipe.h * 0.55;
  return pipe.y + pipe.h*0.2 + depth * Math.sin(Math.PI * t);
}

/* ---------- pipe collision (stable climb) ---------- */
function updatePipe(r, prevY){
  const cx = r.x + r.w*0.5;
  const pipe = pipeAt(cx);
  r.pipeRef = pipe;
  r.pipeT = pipe ? clamp((cx - pipe.x)/pipe.w, 0, 1) : 0;

  if(!pipe){ r.onPipe = false; return false; }

  // ends act as floor + snap
  if(cx < pipe.x + 10 || cx > pipe.x + pipe.w - 10){
    const top = pipe.y;
    const prevFoot = prevY + r.h;
    const foot = r.y + r.h;
    if(prevFoot <= top && foot >= top && r.vy >= 0){
      r.y = top - r.h; r.vy = 0;
      r.onPipe = false; r.onGround = true; r.jumps = 0;
      return true;
    }
    if(r.wasOnPipe && r.vy >= -200){
      r.y = top - r.h; r.vy = 0;
      r.onPipe = false; r.onGround = true; r.jumps = 0;
      return true;
    }
    return false;
  }

  // two-point foot test for stability
  const t1 = clamp((r.x + r.w*0.25 - pipe.x)/pipe.w, 0, 1);
  const t2 = clamp((r.x + r.w*0.75 - pipe.x)/pipe.w, 0, 1);
  const s1 = pipeSurfaceY(pipe, t1);
  const s2 = pipeSurfaceY(pipe, t2);
  const surface = Math.min(s1, s2);

  const prevFoot = prevY + r.h;
  const foot = r.y + r.h;

  if(prevFoot <= surface && foot >= surface && r.vy >= 0){
    r.y = surface - r.h; r.vy = 0;
    r.onPipe = true; r.onGround = false; r.jumps = 0;
    return true;
  }

  // sticky reattach
  if(r.wasOnPipe){
    const maxGap = 18;
    if(foot <= surface + maxGap){
      r.y = surface - r.h; r.vy = 0;
      r.onPipe = true; r.onGround = false; r.jumps = 0;
      return true;
    }
  }
  return false;
}

/* ---------- speed ---------- */
function speedOf(r){
  let s = CONFIG.BASE_SPEED * (r.isPlayer ? 1 : (0.95 + r.winRate*0.1));
  if(r.boostTimer > 0) s += r.boostPower;
  if(r.onRail) s += 60;
  if(r.slowTimer > 0) s -= 70;

  // pipe slope: accelerate to center, climb without stalling
  if(r.onPipe && r.pipeRef){
    const t = r.pipeT;                // 0..1
    const slope = Math.cos(Math.PI*t);// + to center, - to exit
    const delta = clamp(slope * 260, -90, 260);
    s += 140 + delta;
    if(t > 0.55) s = Math.max(s, 170); // ensure climb
  }
  return Math.max(60, s);
}

/* ---------- physics ---------- */
function updatePhysics(r, dt){
  const prevY = r.y;
  r.wasOnPipe = r.onPipe;

  r.vy += CONFIG.GRAVITY * dt;
  r.vy = Math.min(r.vy, CONFIG.MAX_FALL_V);
  r.y += r.vy * dt;

  r.onPipe = false;

  if(updatePipe(r, prevY)){
    // handled
  }else if(updateRail(r, prevY)){
    // handled
  }else{
    if(r.y + r.h >= world.groundTop){
      r.y = world.groundTop - r.h; r.vy = 0;
      r.onGround = true; r.jumps = 0;
    }else{
      r.onGround = false;
    }
  }

  // puddle slow
  const cx = r.x + r.w*0.5;
  for(const p of world.puddles){
    if(cx > p.x && cx < p.x + p.w && r.onGround){
      r.slowTimer = 0.6;
    }
  }

  // rings (player only): 10 -> small boost
  if(r.isPlayer){
    for(let i=world.rings.length-1;i>=0;i--){
      const ring = world.rings[i];
      if(cx > ring.x && cx < ring.x + ring.w && r.y < ring.y + ring.h){
        r.rings++;
        world.rings.splice(i,1);
        if(r.rings >= CONFIG.RING_NEED){
          r.rings -= CONFIG.RING_NEED;
          applyBoost(r, CONFIG.RING_BONUS_ADD, CONFIG.RING_BONUS_TIME);
        }
        break;
      }
    }
  }

  if(r.boostTimer > 0){
    r.boostTimer -= dt;
    if(r.boostTimer <= 0){ r.boostTimer = 0; r.boostPower = 0; }
  }
  if(r.slowTimer > 0){
    r.slowTimer -= dt;
    if(r.slowTimer < 0) r.slowTimer = 0;
  }
}

/* ---------- AI ---------- */
function aiLogic(r, dt){
  if(r.isPlayer || r.finished) return;
  r.aiCd -= dt; if(r.aiCd > 0) return;

  const ahead = r.x + 36;
  const nearPipe = world.pipes.some(p => ahead >= p.x-24 && ahead <= p.x+24);
  const nearRail = world.rails.some(g => ahead >= g.x-24 && ahead <= g.x+24);

  // named ghosts use rails/pipes more
  if(r.isNamed){
    if((r.onGround || r.onRail || r.onPipe) && (nearPipe || nearRail)){
      if(Math.random() < 0.75) tryJump(r);
    }
    if(Math.random() < 0.06 + r.winRate*0.08){
      applyBoost(r, CONFIG.BOOST_ADD, CONFIG.BOOST_TIME);
    }
  }else{
    if((r.onGround||r.onRail||r.onPipe) && Math.random() < 0.05){
      tryJump(r);
    }
    if(Math.random() < 0.03 + r.winRate*0.06){
      applyBoost(r, CONFIG.BOOST_ADD, CONFIG.BOOST_TIME);
    }
  }
  r.aiCd = rand(0.22, 0.6);
}

/* ---------- update run ---------- */
function updateRun(dt){
  regenStock(dt);

  const p = state.runners[state.playerIndex];
  if(input.jump){ input.jump=false; tryJump(p); }
  if(input.boost && state.stock>0){
    input.boost=false; state.stock--;
    applyBoost(p, CONFIG.BOOST_ADD, CONFIG.BOOST_TIME);
  }

  spawnWorld(p.x);

  for(const r of state.runners){
    updatePhysics(r, dt);
    aiLogic(r, dt);
    r.x += speedOf(r) * dt;
    if(!r.finished && r.x >= world.goalX){
      r.finished = true;
      r.finishTime = state.time;
      state.finishedCount++;
    }
  }

  updateRank();
  updateFixedHud();

  state.cameraX = p.x - CONFIG.LOGICAL_W*0.18;
  state.time += dt;

  const race = CONFIG.RACES[state.raceIndex];
  if(state.finishedCount >= race.survive){
    state.phase = "result";
    nextFixed.style.display = "block";
  }
}

/* === PART4 START === */
 // game.js PART 4 / 5  (MOB STREET v1.3.0)
// DRAW / HUD整理 / RESULT表示

/* ---------- draw helpers ---------- */
function drawStage(){
  const st = IMAGES.stage;
  if(!st) return;

  const y = world.groundTop;
  const w = st.width;
  const h = st.height;

  const startX = Math.floor((state.cameraX) / w) * w;
  for(let x = startX; x < state.cameraX + CONFIG.LOGICAL_W + w; x += w){
    ctx.drawImage(st, x - state.cameraX, y, w, h);
  }
}

function drawRails(){
  const img = IMAGES.rail;
  if(!img) return;
  for(const g of world.rails){
    ctx.drawImage(img, g.x - state.cameraX, g.y, g.w, g.h);
  }
}

function drawPipes(){
  for(const p of world.pipes){
    ctx.drawImage(p.img, p.x - state.cameraX, p.y, p.w, p.h);
  }
}

function drawPuddles(){
  ctx.fillStyle = "rgba(120,160,255,0.6)";
  for(const p of world.puddles){
    ctx.fillRect(p.x - state.cameraX, p.y, p.w, p.h);
  }
}

function drawRings(){
  const img = IMAGES.ring;
  if(!img) return;
  for(const r of world.rings){
    ctx.drawImage(img, r.x - state.cameraX, r.y, r.w, r.h);
  }
}

function drawRunner(r){
  const img = r.isPlayer
    ? (r.onGround || r.onRail || r.onPipe ? IMAGES.pl1 : IMAGES.pl2)
    : IMAGES.pl1;

  const bx = r.x - state.cameraX;
  const by = r.y;

  ctx.drawImage(IMAGES.board, bx, by + r.h - 16, r.w, 16);
  ctx.drawImage(img, bx, by, r.w, r.h);
}

/* ---------- result view ---------- */
function drawResult(){
  ctx.fillStyle = "rgba(0,0,0,0.6)";
  ctx.fillRect(0,0,CONFIG.LOGICAL_W,CONFIG.LOGICAL_H);

  const sorted = [...state.runners].sort((a,b)=>a.finishTime-b.finishTime);

  ctx.fillStyle = "#fff";
  ctx.font = "bold 18px system-ui";
  ctx.fillText("RESULT", 20, 40);

  ctx.font = "14px system-ui";
  let y = 70;
  for(let i=0;i<sorted.length;i++){
    const r = sorted[i];
    const t = r.finishTime<Infinity ? r.finishTime.toFixed(2) : "--";
    ctx.fillText(`${i+1}. ${r.name}  ${t}`, 20, y);
    y += 18;
    if(y > CONFIG.LOGICAL_H - 40) break;
  }
}

/* ---------- draw ---------- */
function draw(){
  ctx.clearRect(0,0,CONFIG.LOGICAL_W,CONFIG.LOGICAL_H);

  drawStage();
  drawPuddles();
  drawRails();
  drawPipes();
  drawRings();

  for(const r of state.runners){
    drawRunner(r);
  }

  if(state.phase === "countdown"){
    ctx.fillStyle="#fff";
    ctx.font="bold 64px system-ui";
    ctx.textAlign="center";
    ctx.fillText(Math.ceil(state.countdown), CONFIG.LOGICAL_W/2, CONFIG.LOGICAL_H/2);
    ctx.textAlign="left";
  }

  if(state.phase === "result"){
    drawResult();
  }
}

/* === PART5 START === */
 // game.js PART 5 / 5  (MOB STREET v1.3.0)
// LOOP / UPDATE / NEXT BUTTON / BOOT

function update(dt){
  if(state.phase === "countdown"){
    updateCountdown(dt);
    return;
  }
  if(state.phase === "run"){
    updateRun(dt);
    return;
  }
  if(state.phase === "result"){
    updateFixedHud();
    return;
  }
}

function loop(ts){
  const dt = Math.min((ts - state.lastTime) / 1000, 0.033);
  state.lastTime = ts;

  update(dt);
  draw();

  requestAnimationFrame(loop);
}

/* ---------- NEXT button ---------- */
nextFixed.addEventListener("pointerdown", ()=>{
  nextFixed.style.display = "none";

  if(state.raceIndex < CONFIG.RACES.length - 1){
    initRace(state.raceIndex + 1);
  }else{
    initRace(0);
  }

  resetGround();
  setGoal();
  updateRank();
  updateFixedHud();
});

/* ---------- BOOT ---------- */
async function boot(){
  try{
    await bootCore();

    initRace(0);
    resetGround();
    setGoal();
    updateRank();
    updateFixedHud();

    state.phase = "countdown";
    state.lastTime = performance.now();
    requestAnimationFrame(loop);
  }catch(err){
    console.error(err);
    if(overlay){
      overlay.style.display = "block";
      if(overlayTitle) overlayTitle.textContent = "Error";
      if(overlayMsg) overlayMsg.textContent = String(err);
    }
  }
}

boot();
})();
