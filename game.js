// game.js PART 1 / 5  (v5)
// VERSION: v5
(() => {
"use strict";

const VERSION = "v5";

/* =======================
   DOM
======================= */
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d",{alpha:false});

const overlay = document.getElementById("overlay");
const overlayTitle = document.getElementById("overlayTitle");
const overlayMsg = document.getElementById("overlayMsg");

const btnJump = document.getElementById("btnJump");
const btnBoost = document.getElementById("btnBoost");
const btnJumpBoost = document.getElementById("btnJumpBoost"); // いったん無効
const btnNext = document.getElementById("btnNext"); // あっても使わない（固定NEXTを使う）

const hudSpeed = document.getElementById("hudSpeed");
const hudDist  = document.getElementById("hudDist");

/* =======================
   MOBILE LOCK (no select/zoom)
======================= */
["dblclick","contextmenu","gesturestart","gesturechange","gestureend"]
.forEach(ev=>document.addEventListener(ev,e=>e.preventDefault(),{passive:false}));
window.addEventListener("touchmove",e=>e.preventDefault(),{passive:false});

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

  // リング10個で小加速（ブースト半分くらい）
  RING_NEED: 10,
  RING_BOOST_ADD: 110,
  RING_BOOST_TIME: 0.55,

  // 5秒 / 最大5 / 初期0
  STOCK_MAX: 5,
  STOCK_REGEN: 5.0,
  STOCK_START: 0,

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
const IMAGES={};

function loadImage(src){
  return new Promise((res,rej)=>{
    const i=new Image();
    i.onload=()=>res(i);
    i.onerror=()=>rej(src);
    i.src=src;
  });
}
async function loadAssets(){
  for(const k in ASSETS){
    if(overlayTitle) overlayTitle.textContent="Loading";
    if(overlayMsg) overlayMsg.textContent=ASSETS[k];
    IMAGES[k]=await loadImage(ASSETS[k]);
  }
}

/* =======================
   FIXED NEXT (JS only)
   - Result後に必ず見えるボタン
======================= */
function px(v){ return `${v}px`; }

let nextFixed = document.getElementById("jsNextFixed");
if(!nextFixed){
  nextFixed = document.createElement("button");
  nextFixed.id = "jsNextFixed";
  nextFixed.textContent = "NEXT RACE";
  nextFixed.style.position = "fixed";
  nextFixed.style.left = "50%";
  nextFixed.style.bottom = "220px";
  nextFixed.style.transform = "translateX(-50%)";
  nextFixed.style.zIndex = "99999";
  nextFixed.style.pointerEvents = "auto";
  nextFixed.style.padding = "12px 18px";
  nextFixed.style.borderRadius = "14px";
  nextFixed.style.border = "none";
  nextFixed.style.font = "bold 14px system-ui";
  nextFixed.style.color = "#fff";
  nextFixed.style.background = "rgba(0,0,0,0.55)";
  nextFixed.style.backdropFilter = "blur(6px)";
  nextFixed.style.display = "none";
  document.body.appendChild(nextFixed);
}

/* =======================
   STATE
======================= */
const state={
  phase:"loading", // loading / countdown / run / result
  raceIndex:0,
  time:0,
  lastTime:0,

  stock:CONFIG.STOCK_START,
  stockTimer:0,

  cameraX:0,

  runners:[],
  playerIndex:0,

  countdown:3,
  finishedCount:0,

  rank:1,
  rankText:""
};

/* =======================
   RUNNER
======================= */
function createRunner(name,isPlayer,winRate){
  return{
    name,isPlayer,winRate,
    x:0,y:0,vy:0,
    w:CONFIG.PLAYER_SIZE,h:CONFIG.PLAYER_SIZE,

    onGround:true,
    onRail:false,
    onPipe:false,

    wasOnPipe:false,
    pipeRef:null,
    pipeT:0,

    jumps:0,
    boostTimer:0,
    boostPower:0,

    slowTimer:0,
    rings:0,

    finished:false,
    finishTime:Infinity,

    aiCd:rand(0.15,0.45)
  };
}

/* =======================
   INPUT
======================= */
const input={jump:false,boost:false};
btnJump?.addEventListener("pointerdown",()=>input.jump=true);
btnBoost?.addEventListener("pointerdown",()=>input.boost=true);

window.addEventListener("keydown",e=>{
  if(e.key===" ") input.jump=true;
  if(e.key==="b") input.boost=true;
});

/* ジャンプブーストは一旦無効（将来アイテム枠） */
if(btnJumpBoost){
  btnJumpBoost.style.opacity = "0.45";
  btnJumpBoost.style.filter = "grayscale(0.6)";
  btnJumpBoost.addEventListener("pointerdown",(e)=>{
    e.preventDefault();
    e.stopPropagation();
  });
}

/* =======================
   CANVAS RESIZE
======================= */
function resizeCanvas(){
  const dpr=Math.min(2,window.devicePixelRatio||1);
  const r=canvas.getBoundingClientRect();
  canvas.width=r.width*dpr;
  canvas.height=r.height*dpr;
  ctx.setTransform(dpr,0,0,dpr,0,0);
}
window.addEventListener("resize",resizeCanvas);

/* =======================
   RACE INIT
======================= */
const NAMED_GHOSTS=[
  {name:"フレンチ",wr:0.60},
  {name:"レッド",wr:0.70},
  {name:"レッドブルー",wr:0.90},
  {name:"ブラック",wr:0.85},
  {name:"ホワイト",wr:0.75}
];
const LETTERS="ABCDEFGHIJKLMNOPQRST".split("");

function initRace(idx){
  state.raceIndex=idx;
  state.runners.length=0;
  state.finishedCount=0;

  const player=createRunner("YOU",true,1.0);
  state.runners.push(player);
  state.playerIndex=0;

  for(const g of NAMED_GHOSTS) state.runners.push(createRunner(g.name,false,g.wr));
  for(const l of LETTERS) state.runners.push(createRunner(l,false,0.30));

  const race=CONFIG.RACES[idx];
  state.runners=state.runners.slice(0,race.start);

  for(const r of state.runners){
    r.x=0;r.y=0;r.vy=0;
    r.onGround=true;r.onRail=false;r.onPipe=false;
    r.wasOnPipe=false;r.pipeRef=null;r.pipeT=0;
    r.jumps=0;r.boostTimer=0;r.boostPower=0;r.slowTimer=0;
    r.rings=0;r.finished=false;r.finishTime=Infinity;
    r.aiCd=rand(0.15,0.45);
  }

  state.stock=CONFIG.STOCK_START;
  state.stockTimer=0;

  state.countdown=3;
  state.phase="countdown";

  nextFixed.style.display="none";
}

/* =======================
   RANK
======================= */
function updateRank(){
  const p=state.runners[state.playerIndex];
  let better=0;
  for(const r of state.runners){
    if(r!==p && r.x>p.x) better++;
  }
  state.rank=better+1;
  state.rankText=`RANK ${state.rank}/${state.runners.length}`;
}

/* =======================
   BOOT CORE
======================= */
async function bootCore(){
  state.phase="loading";
  if(overlayTitle) overlayTitle.textContent="Loading";
  if(overlayMsg) overlayMsg.textContent="assets";
  resizeCanvas();
  await loadAssets();

  if(overlay) overlay.style.display="none";
  state.lastTime=performance.now();
}

/* === PART2 START === */
 // game.js PART 2 / 5  (v5)
// WORLD / SPAWN / GROUND (地面位置を“元の基準”に戻す)

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
  nextRingX: 220,

  goalX: 0
};

function resetGround(){
  const st = IMAGES.stage;
  world.groundH = st ? Math.max(130, Math.min(210, st.height)) : 170;

  // ★元の基準：地面は画面下基準（安全域で上げない）
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
  const h = Math.floor(world.groundH * 0.34); // 低め
  const w = img ? Math.floor(img.width * (h / img.height)) : 140;

  // pipeと被らない
  if(overlapsAny(x,w,world.pipes,120)){
    world.nextRailX = x + w + 280;
    return;
  }

  world.rails.push({
    x,
    y: world.groundTop - h,
    w,
    h
  });

  world.nextRailX = x + w + rand(260,520);
}

/* ---------- pipe ---------- */
function addPipe(x){
  const img = Math.random()<0.5 ? IMAGES.hpr : IMAGES.hpg;
  if(!img) return;

  const h = Math.floor(world.groundH * 0.34); // ガードレール同程度
  const w = Math.floor(img.width * (h / img.height));

  // railと被らない
  if(overlapsAny(x,w,world.rails,120)){
    world.nextPipeX = x + w + 380;
    return;
  }

  world.pipes.push({
    x,
    y: world.groundTop - h, // 地面の上
    w,
    h,
    img
  });

  world.nextPipeX = x + w + rand(720,920);
}

/* ---------- puddle ---------- */
function addPuddle(x){
  const w = rand(48,96);
  const h = 12;
  world.puddles.push({
    x,
    y: world.groundTop + world.groundH * 0.20,
    w,
    h
  });
  world.nextPuddleX = x + w + rand(220,380);
}

/* ---------- ring (ground + air) ---------- */
function addRing(x){
  const s = 22;

  // 地上 or 空中
  const air = Math.random() < 0.45;
  const y = air
    ? (world.groundTop - s - rand(80, 170))  // 空中
    : (world.groundTop - s - rand(18, 36));  // 地上付近

  world.rings.push({
    x,
    y,
    w: s,
    h: s
  });

  world.nextRingX = x + rand(120,220);
}

/* ---------- spawn ---------- */
function spawnWorld(px){
  const ahead = px + 1050;
  const behind = px - 460;

  while(world.nextRingX < ahead)   addRing(world.nextRingX);
  while(world.nextRailX < ahead)   addRail(world.nextRailX);
  while(world.nextPipeX < ahead)   addPipe(world.nextPipeX);
  while(world.nextPuddleX < ahead) addPuddle(world.nextPuddleX);

  world.rings   = world.rings.filter(o=>o.x+o.w>behind);
  world.rails   = world.rails.filter(o=>o.x+o.w>behind);
  world.pipes   = world.pipes.filter(o=>o.x+o.w>behind-220);
  world.puddles = world.puddles.filter(o=>o.x+o.w>behind);
}

/* ---------- countdown ---------- */
function updateCountdown(dt){
  state.countdown -= dt;
  if(state.countdown <= 0){
    state.phase = "run";
  }
}

/* === PART3 START === */
 // game.js PART 3 / 5  (v5)
// PHYSICS / PIPE CLIMB / RING SMALL BOOST / AI

/* ---------- stock ---------- */
function regenStock(dt){
  state.stockTimer += dt;
  while(state.stockTimer >= CONFIG.STOCK_REGEN){
    state.stockTimer -= CONFIG.STOCK_REGEN;
    if(state.stock < CONFIG.STOCK_MAX) state.stock++;
  }
}

/* ---------- boost/jump ---------- */
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

/* ---------- rail collision ---------- */
function updateRail(r, prevY){
  const cx = r.x + r.w*0.5;
  for(const rail of world.rails){
    if(cx < rail.x || cx > rail.x + rail.w) continue;

    const top = rail.y;
    const prevFoot = prevY + r.h;
    const foot = r.y + r.h;

    if(prevFoot <= top && foot >= top && r.vy >= 0){
      r.y = top - r.h;
      r.vy = 0;
      r.onRail = true;
      r.onGround = false;
      r.jumps = 0;
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
  const depth = pipe.h * 0.56;
  return pipe.y + pipe.h*0.18 + depth * Math.sin(Math.PI * t);
}

/* ---------- pipe collision (climb & stick) ---------- */
function updatePipe(r, prevY){
  const cx = r.x + r.w*0.5;
  const pipe = pipeAt(cx);

  r.pipeRef = pipe;
  r.pipeT = pipe ? clamp((cx - pipe.x)/pipe.w, 0, 1) : 0;

  if(!pipe){
    r.onPipe = false;
    return false;
  }

  // edges are flat (rideable)
  if(cx < pipe.x + 10 || cx > pipe.x + pipe.w - 10){
    const top = pipe.y;
    const prevFoot = prevY + r.h;
    const foot = r.y + r.h;

    if(prevFoot <= top && foot >= top && r.vy >= 0){
      r.y = top - r.h;
      r.vy = 0;
      r.onPipe = false;
      r.onGround = true;
      r.jumps = 0;
      return true;
    }

    if(r.wasOnPipe && r.vy >= -220){
      r.y = top - r.h;
      r.vy = 0;
      r.onPipe = false;
      r.onGround = true;
      r.jumps = 0;
      return true;
    }
    return false;
  }

  // stable two-foot sampling
  const t1 = clamp((r.x + r.w*0.25 - pipe.x) / pipe.w, 0, 1);
  const t2 = clamp((r.x + r.w*0.75 - pipe.x) / pipe.w, 0, 1);
  const s1 = pipeSurfaceY(pipe, t1);
  const s2 = pipeSurfaceY(pipe, t2);
  const surface = Math.min(s1, s2);

  const prevFoot = prevY + r.h;
  const foot = r.y + r.h;

  if(prevFoot <= surface && foot >= surface && r.vy >= 0){
    r.y = surface - r.h;
    r.vy = 0;
    r.onPipe = true;
    r.onGround = false;
    r.jumps = 0;
    return true;
  }

  // stick to pipe if previously on it
  if(r.wasOnPipe){
    const maxGap = 22;
    if(foot <= surface + maxGap){
      r.y = surface - r.h;
      r.vy = 0;
      r.onPipe = true;
      r.onGround = false;
      r.jumps = 0;
      return true;
    }
  }

  return false;
}

/* ---------- speed ---------- */
function speedOf(r){
  let s = CONFIG.BASE_SPEED * (r.isPlayer ? 1 : (0.95 + r.winRate*0.1));
  if(r.boostTimer > 0) s += r.boostPower;
  if(r.onRail) s += 65;
  if(r.slowTimer > 0) s -= 70;

  if(r.onPipe && r.pipeRef){
    const t = r.pipeT;
    const slope = Math.cos(Math.PI * t);
    const delta = clamp(slope * 270, -95, 270);
    s += 140 + delta;
    if(t > 0.55) s = Math.max(s, 180); // 登り最低保証
  }

  return Math.max(60, s);
}

/* ---------- physics ---------- */
function updatePhysics(r, dt){
  const prevY = r.y;
  r.wasOnPipe = r.onPipe;

  // gravity
  r.vy += CONFIG.GRAVITY * dt;
  r.vy = Math.min(r.vy, CONFIG.MAX_FALL_V);
  r.y += r.vy * dt;

  // reset contact each frame
  r.onPipe = false;

  // pipe -> rail -> ground
  if(updatePipe(r, prevY)){
    // ok
  }else if(updateRail(r, prevY)){
    // ok
  }else{
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
  const cx = r.x + r.w*0.5;
  for(const p of world.puddles){
    if(cx > p.x && cx < p.x + p.w && r.onGround){
      r.slowTimer = 0.6;
    }
  }

  // ring pick (player only) -> 10個で小加速
  if(r.isPlayer){
    for(let i=world.rings.length-1;i>=0;i--){
      const ring = world.rings[i];
      // 簡易当たり判定（横中心）
      if(cx > ring.x && cx < ring.x + ring.w){
        r.rings++;
        world.rings.splice(i,1);

        if(r.rings >= CONFIG.RING_NEED){
          r.rings -= CONFIG.RING_NEED;
          applyBoost(r, CONFIG.RING_BOOST_ADD, CONFIG.RING_BOOST_TIME);
        }
        break;
      }
    }
  }

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

/* ---------- AI ---------- */
function aiLogic(r, dt){
  if(r.isPlayer || r.finished) return;

  r.aiCd -= dt;
  if(r.aiCd > 0) return;

  const named = r.winRate > 0.30; // named 5 = >0.3
  const cx = r.x + r.w*0.5;

  // 近くのレール/パイプ
  let nearRail=false, nearPipe=false;
  for(const rail of world.rails){
    if(rail.x > cx && rail.x - cx < 180){ nearRail=true; break; }
  }
  for(const pipe of world.pipes){
    if(pipe.x > cx && pipe.x - cx < 210){ nearPipe=true; break; }
  }

  // namedは積極的に使う
  const jumpChance = named
    ? (nearRail||nearPipe ? 0.60 : 0.10)
    : (nearRail||nearPipe ? 0.18 : 0.05);

  if((r.onGround||r.onRail||r.onPipe) && Math.random() < jumpChance){
    tryJump(r);
  }

  // boost（namedは多め）
  const boostChance = named ? (0.06 + r.winRate*0.08) : 0.03;
  if(Math.random() < boostChance){
    applyBoost(r, CONFIG.BOOST_ADD, CONFIG.BOOST_TIME);
  }

  r.aiCd = rand(named ? 0.18 : 0.28, named ? 0.45 : 0.65);
}

/* ---------- update run ---------- */
function updateRun(dt){
  regenStock(dt);

  const p = state.runners[state.playerIndex];

  if(input.jump){ input.jump=false; tryJump(p); }
  if(input.boost && state.stock>0){
    input.boost=false;
    state.stock--;
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

  state.cameraX = p.x - CONFIG.LOGICAL_W * 0.18;
  state.time += dt;

  const race = CONFIG.RACES[state.raceIndex];
  if(state.finishedCount >= race.survive){
    state.phase = "result";
    nextFixed.style.display = "block";
    if(btnNext) btnNext.style.display = "none";
  }
}

/* === PART4 START === */
   // game.js PART 4 / 5  (v5)
// RENDER / PLAYER LABEL / RESULT CENTER BIG

/* ---------- draw base ---------- */
function beginDraw(){
  const cw = canvas.width;
  const ch = canvas.height;
  const sx = cw / CONFIG.LOGICAL_W;
  const sy = ch / CONFIG.LOGICAL_H;

  // 以前と同じ感覚に戻す：単純にフィット
  const s = Math.min(sx, sy);
  const ox = (cw - CONFIG.LOGICAL_W * s) * 0.5;
  const oy = (ch - CONFIG.LOGICAL_H * s) * 0.5;

  ctx.setTransform(s,0,0,s,ox,oy);
  ctx.imageSmoothingEnabled = false;
}

/* ---------- background ---------- */
function drawSky(){
  const g = ctx.createLinearGradient(0,0,0,CONFIG.LOGICAL_H);
  g.addColorStop(0,"#2a6ccf");
  g.addColorStop(0.6,"#163d7a");
  g.addColorStop(1,"#071727");
  ctx.fillStyle = g;
  ctx.fillRect(0,0,CONFIG.LOGICAL_W,CONFIG.LOGICAL_H);
}

function drawStage(){
  const y = world.groundTop;

  ctx.fillStyle = "rgba(0,0,0,0.25)";
  ctx.fillRect(0,y,CONFIG.LOGICAL_W,world.groundH);

  const img = IMAGES.stage;
  if(!img) return;

  const s = world.groundH / img.height;
  const w = Math.floor(img.width * s);
  let x = -((state.cameraX % w + w) % w);
  for(; x < CONFIG.LOGICAL_W + w; x += w){
    ctx.drawImage(img, x, y, w, world.groundH);
  }
}

/* ---------- objects ---------- */
function drawObjects(){
  // puddle
  ctx.fillStyle="rgba(120,190,255,0.55)";
  for(const p of world.puddles){
    const sx=p.x-state.cameraX;
    if(sx<-200||sx>CONFIG.LOGICAL_W+200) continue;
    ctx.fillRect(sx,p.y,p.w,p.h);
  }

  // rings
  const ring=IMAGES.ring;
  for(const r of world.rings){
    const sx=r.x-state.cameraX;
    if(sx<-200||sx>CONFIG.LOGICAL_W+200) continue;
    ring && ctx.drawImage(ring,sx,r.y,r.w,r.h);
  }

  // pipes
  for(const p of world.pipes){
    const sx=p.x-state.cameraX;
    if(sx<-300||sx>CONFIG.LOGICAL_W+300) continue;
    ctx.drawImage(p.img,sx,p.y,p.w,p.h);
  }

  // rails
  const rail=IMAGES.rail;
  for(const r of world.rails){
    const sx=r.x-state.cameraX;
    if(sx<-200||sx>CONFIG.LOGICAL_W+200) continue;
    rail && ctx.drawImage(rail,sx,r.y,r.w,r.h);
  }
}

/* ---------- runner ---------- */
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
  ctx.fillStyle="rgba(0,0,0,0.25)";
  ctx.beginPath();
  ctx.ellipse(
    sx + r.w/2,
    world.groundTop + 6,
    r.w * 0.35,
    6,
    0,0,Math.PI*2
  );
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
  const body = (r.onGround||r.onRail||r.onPipe) ? IMAGES.pl1 : IMAGES.pl2;
  body && ctx.drawImage(body, sx, r.y, r.w, r.h);

  // ★プレイヤー識別ラベル
  if(r.isPlayer){
    ctx.font = "10px system-ui";
    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(255,255,255,0.95)";
    ctx.strokeStyle = "rgba(0,0,0,0.8)";
    ctx.lineWidth = 3;
    ctx.strokeText("プレイヤー", sx + r.w/2, r.y - 6);
    ctx.fillText("プレイヤー", sx + r.w/2, r.y - 6);
    ctx.textAlign = "left";
  }
}

/* ---------- result ---------- */
function drawResult(){
  ctx.fillStyle="rgba(0,0,0,0.85)";
  ctx.fillRect(0,0,CONFIG.LOGICAL_W,CONFIG.LOGICAL_H);

  ctx.fillStyle="#fff";
  ctx.textAlign="center";
  ctx.font="bold 26px system-ui";
  ctx.fillText(
    `RESULT - ${CONFIG.RACES[state.raceIndex].name}`,
    CONFIG.LOGICAL_W/2,
    56
  );

  const list=[...state.runners].sort((a,b)=>a.finishTime-b.finishTime);

  ctx.font="16px system-ui";
  let y=110;
  for(let i=0;i<list.length;i++){
    if(i>=12) break;
    const r=list[i];
    ctx.fillStyle=r.isPlayer?"#00ffcc":"#ffffff";
    const t=isFinite(r.finishTime)?`${r.finishTime.toFixed(2)}s`:"--";
    ctx.fillText(
      `${i+1}. ${r.name}   ${t}`,
      CONFIG.LOGICAL_W/2,
      y
    );
    y+=28;
  }

  ctx.textAlign="left";
}

/* ---------- render ---------- */
function render(){
  // 残像完全防止
  ctx.setTransform(1,0,0,1,0,0);
  ctx.globalCompositeOperation="source-over";
  ctx.fillStyle="#000";
  ctx.fillRect(0,0,canvas.width,canvas.height);

  beginDraw();
  drawSky();
  drawStage();
  drawObjects();

  for(const r of state.runners){
    if(!r.isPlayer && r.winRate>0.3) drawRunner(r);
  }
  drawRunner(state.runners[state.playerIndex]);

  if(state.phase==="countdown"){
    ctx.fillStyle="rgba(0,0,0,0.6)";
    ctx.fillRect(0,0,CONFIG.LOGICAL_W,CONFIG.LOGICAL_H);
    ctx.fillStyle="#fff";
    ctx.font="bold 64px system-ui";
    ctx.textAlign="center";
    ctx.fillText(
      Math.ceil(state.countdown),
      CONFIG.LOGICAL_W/2,
      CONFIG.LOGICAL_H/2
    );
    ctx.textAlign="left";
  }

  if(state.phase==="result"){
    drawResult();
  }
}

/* === PART5 START === */
   // game.js PART 5 / 5  (v5)
// LOOP / NEXT RACE / BOOT

function update(dt){
  if(state.phase === "countdown"){
    updateCountdown(dt);
    updateRank();
    return;
  }
  if(state.phase === "run"){
    updateRun(dt);
    return;
  }
  // result
  if(state.phase === "result"){
    // ここでは描画のみ（入力はNEXTのみ）
  }
}

function loop(t){
  const dt = Math.min((t - state.lastTime) / 1000, 0.033);
  state.lastTime = t;

  if(state.phase !== "loading"){
    update(dt);
  }
  render();
  requestAnimationFrame(loop);
}

/* ---------- NEXT (固定ボタン) ---------- */
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
  state.phase = "countdown";
});

/* ---------- boot ---------- */
async function boot(){
  try{
    await bootCore();
    initRace(0);
    resetGround();
    setGoal();
    updateRank();
    state.phase = "countdown";
    state.lastTime = performance.now();
    requestAnimationFrame(loop);
  }catch(e){
    if(overlay){
      overlay.style.display="block";
      if(overlayTitle) overlayTitle.textContent="Error";
      if(overlayMsg) overlayMsg.textContent=String(e);
    }
    console.error(e);
  }
}

boot();
})();
   
 
