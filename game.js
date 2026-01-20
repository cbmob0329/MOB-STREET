// game.js PART 1 / 5
// FULL SPEC CORE
// VERSION: v1.1.0-full-1500
// ※このPART1の末尾に PART2 → PART5 を順に追記して完成

(() => {
"use strict";

/* =========================================================
   VERSION / CACHE CHECK
========================================================= */
const VERSION = "v1.1.0-full-1500";

/* =========================================================
   DOM
========================================================= */
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d", { alpha:false });

const overlay = document.getElementById("overlay");
const overlayTitle = document.getElementById("overlayTitle");
const overlayMsg = document.getElementById("overlayMsg");

const btnJump = document.getElementById("btnJump");
const btnBoost = document.getElementById("btnBoost");
const btnJumpBoost = document.getElementById("btnJumpBoost");

const hudSpeed = document.getElementById("hudSpeed");
const hudDist  = document.getElementById("hudDist");

/* =========================================================
   MOBILE HARD LOCK
   - disable select / zoom / long press
========================================================= */
["dblclick","contextmenu","gesturestart","gesturechange","gestureend"]
.forEach(ev=>{
  document.addEventListener(ev,e=>e.preventDefault(),{passive:false});
});
window.addEventListener("touchmove",e=>e.preventDefault(),{passive:false});

/* =========================================================
   CONFIG (GLOBAL / FIXED)
========================================================= */
const CONFIG = {
  LOGICAL_W: 360,
  LOGICAL_H: 640,

  PX_PER_M: 10,

  PLAYER_SIZE: 48,

  GRAVITY: 2200,
  MAX_FALL_V: 1800,

  JUMP_V1: 860,
  JUMP_V2: 780,
  JUMPBOOST_V: 1280,

  BASE_SPEED: 260,

  BOOST_ADD: 210,
  BOOST_TIME: 0.85,

  JUMPBOOST_ADD: 520,
  JUMPBOOST_TIME: 1.25,

  STOCK_MAX: 5,
  STOCK_REGEN: 5.0,
  STOCK_START: 0,

  RING_NEED: 10,

  // RACE FLOW (FIXED)
  RACES: [
    { name:"EASY",   goal:600,  start:26, survive:16 },
    { name:"NORMAL", goal:1000, start:16, survive:6  },
    { name:"HARD",   goal:1200, start:8,  survive:1  }
  ]
};

/* =========================================================
   UTIL
========================================================= */
const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));
const rand  = (a,b)=>a+Math.random()*(b-a);

/* =========================================================
   ASSETS
========================================================= */
const ASSETS = {
  pl1   : "PL1.png.png",
  pl2   : "PL2.png.png",
  board : "redsk.png",
  stage : "st.png",
  rail  : "gardw.png",
  hpr   : "hpr.png",
  hpg   : "hpg.png",
  ring  : "ringtap.png"
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
    overlayTitle.textContent = "Loading";
    overlayMsg.textContent = ASSETS[k];
    IMAGES[k] = await loadImage(ASSETS[k]);
  }
}

/* =========================================================
   GLOBAL STATE
========================================================= */
const state = {
  phase: "loading",   // loading / countdown / run / result
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

/* =========================================================
   RUNNER FACTORY
========================================================= */
function createRunner(name,isPlayer,winRate){
  return {
    name,
    isPlayer,
    winRate,

    x:0,
    y:0,
    vy:0,

    w:CONFIG.PLAYER_SIZE,
    h:CONFIG.PLAYER_SIZE,

    onGround:true,
    onRail:false,
    onPipe:false,

    jumps:0,

    boostTimer:0,
    boostPower:0,

    slowTimer:0,
    rings:0,

    finished:false,
    finishTime:Infinity,

    aiCd:rand(0.2,0.6)
  };
}

/* =========================================================
   INPUT STATE
========================================================= */
const input = {
  jump:false,
  boost:false,
  jumpBoost:false
};

btnJump?.addEventListener("pointerdown",()=>input.jump=true);
btnBoost?.addEventListener("pointerdown",()=>input.boost=true);
btnJumpBoost?.addEventListener("pointerdown",()=>input.jumpBoost=true);

window.addEventListener("keydown",e=>{
  if(e.key===" ") input.jump=true;
  if(e.key==="b") input.boost=true;
  if(e.key==="n") input.jumpBoost=true;
});

/* =========================================================
   CANVAS RESIZE (FULL SCREEN)
========================================================= */
function resizeCanvas(){
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const rect = canvas.getBoundingClientRect();
  canvas.width  = rect.width  * dpr;
  canvas.height = rect.height * dpr;
  ctx.setTransform(dpr,0,0,dpr,0,0);
}
window.addEventListener("resize", resizeCanvas);

/* =========================================================
   BOOT (PARTIAL)
========================================================= */
async function bootCore(){
  state.phase = "loading";
  overlayTitle.textContent = "Loading";
  overlayMsg.textContent = "assets";

  resizeCanvas();
  await loadAssets();

  state.phase = "countdown";
  state.lastTime = performance.now();
}

/* === PART2 START === */
 // game.js PART 2 / 5
// FULL SPEC – RACE FLOW / WORLD / SPAWN
// ※PART1末尾「/* === PART2 START === */」の直後に貼り付け

/* =========================================================
   WORLD STATE
========================================================= */
const world = {
  groundH: 170,
  groundTop: 470,

  rails: [],
  puddles: [],
  pipes: [],
  rings: [],

  nextRailX: 220,
  nextPuddleX: 260,
  nextPipeX: 700,
  nextRingX: 260,

  goalX: 0
};

function resetGround(){
  const st = IMAGES.stage;
  world.groundH = st ? Math.max(130, Math.min(210, st.height)) : 170;
  world.groundTop = CONFIG.LOGICAL_H - world.groundH;
}

/* =========================================================
   RACE FLOW (26→16→8)
========================================================= */
const NAMED_GHOSTS = [
  { name:"フレンチ", wr:0.60 },
  { name:"レッド", wr:0.70 },
  { name:"レッドブルー", wr:0.90 },
  { name:"ブラック", wr:0.85 },
  { name:"ホワイト", wr:0.75 }
];
const LETTERS = "ABCDEFGHIJKLMNOPQRST".split("");

function initRace(raceIndex){
  state.raceIndex = raceIndex;
  const race = CONFIG.RACES[raceIndex];
  world.goalX = race.goal * CONFIG.PX_PER_M;

  state.runners.length = 0;
  state.finishedCount = 0;

  const player = createRunner("YOU", true, 1.0);
  state.runners.push(player);
  state.playerIndex = 0;

  for(const g of NAMED_GHOSTS){
    state.runners.push(createRunner(g.name, false, g.wr));
  }
  for(const l of LETTERS){
    state.runners.push(createRunner(l, false, 0.30));
  }

  // 開始人数に切り詰め
  state.runners = state.runners.slice(0, race.start);

  for(const r of state.runners){
    r.x = 0;
    r.vy = 0;
    r.onGround = true;
    r.onRail = false;
    r.onPipe = false;
    r.jumps = 0;
    r.boostTimer = 0;
    r.boostPower = 0;
    r.slowTimer = 0;
    r.rings = 0;
    r.finished = false;
    r.finishTime = Infinity;
    r.y = world.groundTop - r.h;
  }

  world.rails.length = 0;
  world.puddles.length = 0;
  world.pipes.length = 0;
  world.rings.length = 0;
  world.nextRailX = 220;
  world.nextPuddleX = 260;
  world.nextPipeX = 700;
  world.nextRingX = 260;

  state.stock = CONFIG.STOCK_START;
  state.stockTimer = 0;

  state.countdown = 3;
  state.phase = "countdown";
}

/* =========================================================
   SPAWN OBJECTS
========================================================= */
function addRail(x){
  const img = IMAGES.rail;
  const h = Math.floor(world.groundH * 0.43);
  const w = img ? Math.floor(img.width * (h / img.height)) : 140;
  world.rails.push({ x, y: world.groundTop - h, w, h });
  world.nextRailX = x + w + rand(160, 400);
}
function addPuddle(x){
  const w = rand(46, 92);
  const h = 12;
  world.puddles.push({ x, y: world.groundTop + world.groundH * 0.22, w, h });
  world.nextPuddleX = x + w + rand(160, 360);
}
function addRing(x){
  const s = 22;
  world.rings.push({ x, y: world.groundTop - s - 26, w: s, h: s });
  world.nextRingX = x + rand(90, 180);
}
function addPipe(x){
  const img = Math.random() < 0.5 ? IMAGES.hpr : IMAGES.hpg;
  if(!img) return;
  const h = Math.floor(world.groundH * 0.43);
  const w = Math.floor(img.width * (h / img.height));
  world.pipes.push({ x, y: world.groundTop - h, w, h, img });
  world.nextPipeX = x + w + rand(520, 680);
}
function spawnWorld(px){
  const ahead = px + 1000;
  const behind = px - 420;

  while(world.nextRingX < ahead) addRing(world.nextRingX);
  while(world.nextRailX < ahead) addRail(world.nextRailX);
  while(world.nextPuddleX < ahead) addPuddle(world.nextPuddleX);
  while(world.nextPipeX < ahead) addPipe(world.nextPipeX);

  world.rings   = world.rings.filter(o => o.x + o.w > behind);
  world.rails   = world.rails.filter(o => o.x + o.w > behind);
  world.puddles = world.puddles.filter(o => o.x + o.w > behind);
  world.pipes   = world.pipes.filter(o => o.x + o.w > behind - 200);
}

/* =========================================================
   COUNTDOWN TICK
========================================================= */
function updateCountdown(dt){
  state.countdown -= dt;
  if(state.countdown <= 0){
    state.phase = "run";
  }
}

/* === PART3 START === */
 // game.js PART 3 / 5
// FULL SPEC – PHYSICS / COLLISION / PIPE LOGIC
// ※PART2末尾「/* === PART3 START === */」の直後に貼り付け

/* =========================================================
   PHYSICS CORE
========================================================= */
function regenStock(dt){
  state.stockTimer += dt;
  while(state.stockTimer >= CONFIG.STOCK_REGEN){
    state.stockTimer -= CONFIG.STOCK_REGEN;
    if(state.stock < CONFIG.STOCK_MAX) state.stock++;
  }
}

function speedOf(r){
  let s = CONFIG.BASE_SPEED * (r.isPlayer ? 1 : (0.98 + r.winRate * 0.06));
  if(r.boostTimer > 0) s += r.boostPower;
  if(r.onRail) s += 55;
  if(r.onPipe) s += 120;
  if(r.slowTimer > 0) s -= 65;
  return Math.max(40, s);
}

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

/* =========================================================
   PIPE PHYSICS (CURVE FOLLOW)
========================================================= */
function pipeAt(cx){
  for(const p of world.pipes){
    if(cx >= p.x && cx <= p.x + p.w) return p;
  }
  return null;
}

function pipeSurfaceY(pipe, cx){
  const t = (cx - pipe.x) / pipe.w;
  const depth = pipe.h * 0.55;
  return pipe.y + pipe.h * 0.18 + depth * Math.sin(Math.PI * t);
}

function updatePipe(r, prevY){
  const cx = r.x + r.w * 0.5;
  const pipe = pipeAt(cx);
  if(!pipe) return false;

  const surface = pipeSurfaceY(pipe, cx);
  const footY = r.y + r.h;
  const prevFootY = prevY + r.h;

  // 上から乗った場合のみ吸着
  if(prevFootY <= surface && footY >= surface && r.vy >= 0){
    r.y = surface - r.h;
    r.vy = 0;
    r.onPipe = true;
    r.onGround = false;
    r.jumps = 0;
    return true;
  }

  if(r.onPipe){
    r.y = surface - r.h;
    r.vy = 0;
    return true;
  }
  return false;
}

/* =========================================================
   COLLISION / SLOW / RING
========================================================= */
function updatePhysics(r, dt){
  const prevY = r.y;

  r.vy += CONFIG.GRAVITY * dt;
  r.vy = Math.min(r.vy, CONFIG.MAX_FALL_V);
  r.y += r.vy * dt;

  r.onPipe = false;

  // pipe first
  updatePipe(r, prevY);

  // ground
  if(!r.onPipe){
    if(r.y + r.h >= world.groundTop){
      r.y = world.groundTop - r.h;
      r.vy = 0;
      r.onGround = true;
      r.jumps = 0;
    }else{
      r.onGround = false;
    }
  }

  // puddle slow
  const cx = r.x + r.w * 0.5;
  for(const p of world.puddles){
    if(cx > p.x && cx < p.x + p.w && r.onGround){
      r.slowTimer = 0.6;
    }
  }

  // ring pickup
  for(let i = world.rings.length - 1; i >= 0; i--){
    const ring = world.rings[i];
    if(cx > ring.x && cx < ring.x + ring.w){
      r.rings++;
      world.rings.splice(i,1);
      break;
    }
  }

  // timers
  if(r.boostTimer > 0){
    r.boostTimer -= dt;
    if(r.boostTimer <= 0){
      r.boostTimer = 0;
      r.boostPower = 0;
    }
  }
  if(r.slowTimer > 0){
    r.slowTimer -= dt;
    if(r.slowTimer < 0) r.slowTimer = 0;
  }
}

/* =========================================================
   AI LOGIC
========================================================= */
function aiLogic(r, dt){
  if(r.isPlayer || r.finished) return;

  r.aiCd -= dt;
  if(r.aiCd > 0) return;

  if((r.onGround || r.onPipe) && Math.random() < 0.05){
    tryJump(r);
  }
  if(Math.random() < 0.03 + r.winRate * 0.05){
    applyBoost(r, CONFIG.BOOST_ADD, CONFIG.BOOST_TIME);
  }
  r.aiCd = rand(0.25, 0.6);
}

/* =========================================================
   UPDATE STEP
========================================================= */
function updateRun(dt){
  regenStock(dt);

  const player = state.runners[state.playerIndex];

  if(input.jump){ input.jump = false; tryJump(player); }
  if(input.boost && state.stock > 0){
    input.boost = false;
    state.stock--;
    applyBoost(player, CONFIG.BOOST_ADD, CONFIG.BOOST_TIME);
  }
  if(input.jumpBoost && player.rings >= CONFIG.RING_NEED){
    input.jumpBoost = false;
    player.rings -= CONFIG.RING_NEED;
    player.vy = -CONFIG.JUMPBOOST_V;
    applyBoost(player, CONFIG.JUMPBOOST_ADD, CONFIG.JUMPBOOST_TIME);
  }

  spawnWorld(player.x);

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

  state.cameraX = player.x - CONFIG.LOGICAL_W * 0.18;
  state.time += dt;

  const race = CONFIG.RACES[state.raceIndex];
  if(state.finishedCount >= race.survive){
    if(state.raceIndex < CONFIG.RACES.length - 1){
      initRace(state.raceIndex + 1);
    }else{
      state.phase = "result";
    }
  }
}

/* === PART4 START === */
 // game.js PART 4 / 5
// FULL SPEC – RENDER / HUD / MINIMAP
// ※PART3末尾「/* === PART4 START === */」の直後に貼り付け

/* =========================================================
   RENDER SETUP
========================================================= */
function beginDraw(){
  const cw = canvas.width, ch = canvas.height;
  const sx = cw / CONFIG.LOGICAL_W;
  const sy = ch / CONFIG.LOGICAL_H;
  const s = Math.max(sx, sy); // 黒帯なし
  const ox = (cw - CONFIG.LOGICAL_W * s) * 0.5;
  const oy = (ch - CONFIG.LOGICAL_H * s) * 0.5;
  ctx.setTransform(s, 0, 0, s, ox, oy);
  ctx.imageSmoothingEnabled = false;
}

/* =========================================================
   BACKGROUND / STAGE
========================================================= */
function drawSky(){
  const g = ctx.createLinearGradient(0, 0, 0, CONFIG.LOGICAL_H);
  g.addColorStop(0, "#2a6ccf");
  g.addColorStop(0.6, "#163d7a");
  g.addColorStop(1, "#071727");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, CONFIG.LOGICAL_W, CONFIG.LOGICAL_H);
}

function drawStage(){
  const y = world.groundTop;
  ctx.fillStyle = "rgba(0,0,0,0.25)";
  ctx.fillRect(0, y, CONFIG.LOGICAL_W, world.groundH);

  const img = IMAGES.stage;
  if(!img) return;

  const s = world.groundH / img.height;
  const w = Math.floor(img.width * s);
  let x = -((state.cameraX % w + w) % w);

  for(; x < CONFIG.LOGICAL_W + w; x += w){
    ctx.drawImage(img, x, y, w, world.groundH);
  }
}

/* =========================================================
   WORLD OBJECTS
========================================================= */
function drawObjects(){
  // puddles
  ctx.fillStyle = "rgba(120,190,255,0.55)";
  for(const p of world.puddles){
    const sx = p.x - state.cameraX;
    if(sx < -200 || sx > CONFIG.LOGICAL_W + 200) continue;
    ctx.fillRect(sx, p.y, p.w, p.h);
  }

  // rings
  const ring = IMAGES.ring;
  for(const r of world.rings){
    const sx = r.x - state.cameraX;
    if(sx < -200 || sx > CONFIG.LOGICAL_W + 200) continue;
    ring && ctx.drawImage(ring, sx, r.y, r.w, r.h);
  }

  // pipes
  for(const p of world.pipes){
    const sx = p.x - state.cameraX;
    if(sx < -300 || sx > CONFIG.LOGICAL_W + 300) continue;
    ctx.drawImage(p.img, sx, p.y, p.w, p.h);
  }

  // rails
  const rail = IMAGES.rail;
  for(const r of world.rails){
    const sx = r.x - state.cameraX;
    if(sx < -200 || sx > CONFIG.LOGICAL_W + 200) continue;
    rail && ctx.drawImage(rail, sx, r.y, r.w, r.h);
  }
}

/* =========================================================
   RUNNERS
========================================================= */
function drawRunner(r){
  let sx;
  if(r.isPlayer){
    sx = Math.floor(CONFIG.LOGICAL_W * 0.18);
  }else{
    const p = state.runners[state.playerIndex];
    sx = Math.floor(CONFIG.LOGICAL_W * 0.18 + (r.x - p.x));
  }
  if(sx < -120 || sx > CONFIG.LOGICAL_W + 120) return;

  // shadow
  ctx.fillStyle = "rgba(0,0,0,0.25)";
  ctx.beginPath();
  ctx.ellipse(sx + r.w/2, world.groundTop + 6, r.w*0.35, 6, 0, 0, Math.PI*2);
  ctx.fill();

  // board
  const board = IMAGES.board;
  board && ctx.drawImage(
    board,
    sx - r.w*0.05,
    r.y + r.h*0.65,
    r.w*1.1,
    r.h*0.45
  );

  // body
  const body = (r.onGround || r.onPipe) ? IMAGES.pl1 : IMAGES.pl2;
  body && ctx.drawImage(body, sx, r.y, r.w, r.h);
}

/* =========================================================
   HUD / MINIMAP
========================================================= */
function drawHUD(){
  const p = state.runners[state.playerIndex];
  const speed = Math.floor(speedOf(p));
  const dist = Math.floor(p.x / CONFIG.PX_PER_M);

  hudSpeed.textContent = speed;
  hudDist.textContent  = dist;

  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.font = "12px system-ui";
  ctx.fillText(`RING ${p.rings}/${CONFIG.RING_NEED}`, 10, 22);
  ctx.fillText(`RACE ${CONFIG.RACES[state.raceIndex].name}`, 10, 38);
  ctx.fillText(VERSION, 10, CONFIG.LOGICAL_H - 10);

  drawMinimap();
}

function drawMinimap(){
  const mapW = 200;
  const mapH = 6;
  const x = (CONFIG.LOGICAL_W - mapW) / 2;
  const y = 10;

  ctx.fillStyle = "rgba(0,0,0,0.5)";
  ctx.fillRect(x, y, mapW, mapH);

  const race = CONFIG.RACES[state.raceIndex];
  for(const r of state.runners){
    const t = Math.min(1, r.x / (race.goal * CONFIG.PX_PER_M));
    const px = x + mapW * t;
    ctx.fillStyle = r.isPlayer ? "#00ffcc" : "#ffffff";
    ctx.fillRect(px - 1, y - 2, 2, mapH + 4);
  }
}

/* =========================================================
   RENDER DISPATCH
========================================================= */
function render(){
  ctx.setTransform(1,0,0,1,0,0);
  ctx.fillStyle = "#000";
  ctx.fillRect(0,0,canvas.width,canvas.height);

  beginDraw();
  drawSky();
  drawStage();
  drawObjects();

  for(const r of state.runners){
    if(!r.isPlayer && r.winRate > 0.3) drawRunner(r);
  }
  drawRunner(state.runners[state.playerIndex]);

  drawHUD();

  if(state.phase === "countdown"){
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillRect(0,0,CONFIG.LOGICAL_W,CONFIG.LOGICAL_H);
    ctx.fillStyle = "#fff";
    ctx.font = "bold 64px system-ui";
    ctx.textAlign = "center";
    ctx.fillText(Math.ceil(state.countdown), CONFIG.LOGICAL_W/2, CONFIG.LOGICAL_H/2);
    ctx.textAlign = "left";
  }
}

/* === PART5 START === */
 // game.js PART 5 / 5
// FULL SPEC – LOOP / RESULT / BOOT (FINAL)
// ※PART4末尾「/* === PART5 START === */」の直後に貼り付け

/* =========================================================
   RESULT SCREEN
========================================================= */
function drawResult(){
  ctx.fillStyle = "rgba(0,0,0,0.75)";
  ctx.fillRect(0,0,CONFIG.LOGICAL_W,CONFIG.LOGICAL_H);

  ctx.fillStyle = "#fff";
  ctx.font = "20px system-ui";
  ctx.fillText("RESULT", 20, 36);

  const list = [...state.runners].sort((a,b)=>a.finishTime-b.finishTime);
  ctx.font = "14px system-ui";
  let y = 64;
  for(let i=0;i<list.length;i++){
    const r = list[i];
    const t = isFinite(r.finishTime) ? r.finishTime.toFixed(2) : "--";
    ctx.fillText(`${i+1}. ${r.name}  ${t}`, 20, y);
    y += 18;
    if(y > CONFIG.LOGICAL_H - 20) break;
  }
}

/* =========================================================
   UPDATE DISPATCH
========================================================= */
function update(dt){
  if(state.phase === "countdown"){
    updateCountdown(dt);
    return;
  }
  if(state.phase === "run"){
    updateRun(dt);
    return;
  }
}

/* =========================================================
   MAIN LOOP
========================================================= */
function loop(t){
  const dt = Math.min((t - state.lastTime) / 1000, 0.033);
  state.lastTime = t;

  if(state.phase !== "loading"){
    update(dt);
  }

  render();
  if(state.phase === "result"){
    beginDraw();
    drawResult();
  }

  requestAnimationFrame(loop);
}

/* =========================================================
   BOOT
========================================================= */
async function boot(){
  try{
    await bootCore();
    resetGround();
    initRace(0); // EASY
    state.phase = "countdown";
    state.lastTime = performance.now();
    requestAnimationFrame(loop);
  }catch(e){
    overlayTitle.textContent = "Error";
    overlayMsg.textContent = String(e);
    console.error(e);
  }
}

boot();
})();
