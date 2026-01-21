// game.js PART 1 / 5  (FIXED2)
// VERSION: v1.2.1-fix2-loading-rank-result-pipe-boost
(() => {
"use strict";

const VERSION = "v1.2.1-fix2-loading-rank-result-pipe-boost";

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
const btnJumpBoost = document.getElementById("btnJumpBoost");
const btnNext = document.getElementById("btnNext"); // result -> next race

const hudSpeed = document.getElementById("hudSpeed");
const hudDist  = document.getElementById("hudDist");
const hudRank  = document.getElementById("hudRank"); // あるなら使う（無くてもOK）

/* =======================
   MOBILE LOCK
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
  JUMPBOOST_V: 1280,

  BASE_SPEED: 260,

  BOOST_ADD: 210,
  BOOST_TIME: 0.85,

  JUMPBOOST_ADD: 520,
  JUMPBOOST_TIME: 1.25,

  // ★ここを完全に固定（5秒/最大5/初期0）
  STOCK_MAX: 5,
  STOCK_REGEN: 5.0,
  STOCK_START: 0,

  RING_NEED: 10,

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
    onGround:true,onRail:false,onPipe:false,
    jumps:0,
    boostTimer:0,boostPower:0,
    slowTimer:0,rings:0,
    finished:false,finishTime:Infinity,

    // pipe info (for slope accel)
    pipeRef:null,
    pipeT:0,

    aiCd:rand(0.2,0.6)
  };
}

/* =======================
   INPUT
======================= */
const input={jump:false,boost:false,jumpBoost:false};
btnJump?.addEventListener("pointerdown",()=>input.jump=true);
btnBoost?.addEventListener("pointerdown",()=>input.boost=true);
btnJumpBoost?.addEventListener("pointerdown",()=>input.jumpBoost=true);

window.addEventListener("keydown",e=>{
  if(e.key===" ") input.jump=true;
  if(e.key==="b") input.boost=true;
  if(e.key==="n") input.jumpBoost=true;
});

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
    r.jumps=0;r.boostTimer=0;r.boostPower=0;r.slowTimer=0;
    r.rings=0;r.finished=false;r.finishTime=Infinity;
    r.pipeRef=null;r.pipeT=0;
  }

  state.stock=CONFIG.STOCK_START;
  state.stockTimer=0;

  state.countdown=3;
  state.phase="countdown";

  if(btnNext) btnNext.style.display="none";
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
  state.rankText=`RANK ${better+1}/${state.runners.length}`;
  if(hudRank) hudRank.textContent = state.rankText; // HTMLがあるなら同期
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

  // ★Loadingを必ず消す（今回の主原因）
  if(overlay) overlay.style.display="none";

  state.lastTime=performance.now();
}

/* === PART2 START === */
 // game.js PART 2 / 5  (FIXED2)
// WORLD / SPAWN / NON-OVERLAP / PLAYER-ONLY RINGS

const world = {
  groundH: 170,
  groundTop: 0,

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
  const st=IMAGES.stage;
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

function overlapsAny(x,w,list,margin=20){
  for(const o of list){
    if(x < o.x + o.w + margin && x + w + margin > o.x) return true;
  }
  return false;
}

function addRail(x){
  const img=IMAGES.rail;
  const h=Math.floor(world.groundH*0.38);
  const w=img?Math.floor(img.width*(h/img.height)):140;

  if(overlapsAny(x,w,world.pipes,80)){
    world.nextRailX = x + w + 220;
    return;
  }

  world.rails.push({x,y:world.groundTop-h,w,h});
  world.nextRailX = x + w + rand(220, 460);
}

function addPipe(x){
  const img=(Math.random()<0.5)?IMAGES.hpr:IMAGES.hpg;
  if(!img) return;

  const h=Math.floor(world.groundH*0.38);
  const w=Math.floor(img.width*(h/img.height));

  if(overlapsAny(x,w,world.rails,80)){
    world.nextPipeX = x + w + 320;
    return;
  }

  world.pipes.push({x,y:world.groundTop-h,w,h,img});
  world.nextPipeX = x + w + rand(680, 880);
}

function addPuddle(x){
  const w=rand(46,92);
  const h=12;
  world.puddles.push({x,y:world.groundTop+world.groundH*0.22,w,h});
  world.nextPuddleX = x + w + rand(220, 400);
}

// ★リングはプレイヤー専用
function addRing(x){
  const s=22;
  world.rings.push({x,y:world.groundTop-s-26,w:s,h:s});
  world.nextRingX = x + rand(130, 220);
}

function spawnWorld(px){
  const ahead = px + 1000;
  const behind = px - 420;

  while(world.nextRingX < ahead) addRing(world.nextRingX);
  while(world.nextRailX < ahead) addRail(world.nextRailX);
  while(world.nextPipeX < ahead) addPipe(world.nextPipeX);
  while(world.nextPuddleX < ahead) addPuddle(world.nextPuddleX);

  world.rings   = world.rings.filter(o=>o.x+o.w>behind);
  world.rails   = world.rails.filter(o=>o.x+o.w>behind);
  world.pipes   = world.pipes.filter(o=>o.x+o.w>behind-200);
  world.puddles = world.puddles.filter(o=>o.x+o.w>behind);
}

function updateCountdown(dt){
  state.countdown -= dt;
  if(state.countdown <= 0){
    state.phase="run";
  }
}

/* === PART3 START === */
 // game.js PART 3 / 5  (FIXED2)
// PHYSICS / RAIL / PIPE SLOPE ACCEL / BOOST FIX

function regenStock(dt){
  state.stockTimer += dt;
  while(state.stockTimer >= CONFIG.STOCK_REGEN){
    state.stockTimer -= CONFIG.STOCK_REGEN;
    if(state.stock < CONFIG.STOCK_MAX) state.stock++;
  }
}

function applyBoost(r, add, t){
  r.boostPower = add;
  r.boostTimer = t;
}

function tryJump(r){
  if(r.onGround || r.onRail || r.onPipe){
    r.vy = -CONFIG.JUMP_V1;
    r.jumps = 1;
    r.onGround=r.onRail=r.onPipe=false;
    return;
  }
  if(r.jumps < 2){
    r.vy = -CONFIG.JUMP_V2;
    r.jumps = 2;
  }
}

/* ---- Rail ---- */
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
      r.onRail=true;
      r.onGround=false;
      r.jumps=0;
      return true;
    }
  }
  r.onRail=false;
  return false;
}

/* ---- Pipe ---- */
function pipeAt(cx){
  for(const p of world.pipes){
    if(cx >= p.x && cx <= p.x + p.w) return p;
  }
  return null;
}
function pipeSurfaceY(pipe, cx){
  const t = (cx - pipe.x) / pipe.w;
  const depth = pipe.h * 0.55;
  return pipe.y + pipe.h*0.2 + depth * Math.sin(Math.PI * t);
}

function updatePipe(r, prevY){
  const cx = r.x + r.w*0.5;
  const pipe = pipeAt(cx);
  r.pipeRef = pipe;
  r.pipeT = pipe ? clamp((cx - pipe.x)/pipe.w,0,1) : 0;

  if(!pipe) return false;

  // 端は床扱い
  if(cx < pipe.x + 8 || cx > pipe.x + pipe.w - 8){
    const top = pipe.y;
    const prevFoot = prevY + r.h;
    const foot = r.y + r.h;
    if(prevFoot <= top && foot >= top && r.vy >= 0){
      r.y = top - r.h;
      r.vy = 0;
      r.onPipe=false;
      r.onGround=true;
      r.jumps=0;
      return true;
    }
    return false;
  }

  const surface = pipeSurfaceY(pipe, cx);
  const prevFoot = prevY + r.h;
  const foot = r.y + r.h;

  if(prevFoot <= surface && foot >= surface && r.vy >= 0){
    r.y = surface - r.h;
    r.vy = 0;
    r.onPipe=true;
    r.onGround=false;
    r.jumps=0;
    return true;
  }
  if(r.onPipe){
    r.y = surface - r.h;
    r.vy = 0;
    return true;
  }
  return false;
}

/* ---- Speed (Pipe Slope) ---- */
function speedOf(r){
  let s = CONFIG.BASE_SPEED * (r.isPlayer ? 1 : (0.95 + r.winRate*0.1));
  if(r.boostTimer > 0) s += r.boostPower;
  if(r.onRail) s += 60;
  if(r.slowTimer > 0) s -= 70;

  // ★パイプの坂で増減（下り加速 / 上り減速）
  if(r.onPipe && r.pipeRef){
    const t = r.pipeT; // 0..1
    const slope = Math.cos(Math.PI * t); // 左(1)→中央(0)→右(-1)
    // 前進固定なので「左→中央は下り」「中央→右は上り」
    const delta = clamp(slope * 240, -160, 240);
    s += 90 + delta;
  }

  return Math.max(40, s);
}

function updatePhysics(r, dt){
  const prevY = r.y;

  r.vy += CONFIG.GRAVITY * dt;
  r.vy = Math.min(r.vy, CONFIG.MAX_FALL_V);
  r.y += r.vy * dt;

  r.onPipe=false;

  // pipe -> rail -> ground
  if(updatePipe(r, prevY)){}
  else if(updateRail(r, prevY)){}
  else{
    if(r.y + r.h >= world.groundTop){
      r.y = world.groundTop - r.h;
      r.vy = 0;
      r.onGround=true;
      r.jumps=0;
    }else{
      r.onGround=false;
    }
  }

  // puddle slow
  const cx = r.x + r.w*0.5;
  for(const p of world.puddles){
    if(cx > p.x && cx < p.x + p.w && r.onGround){
      r.slowTimer = 0.6;
    }
  }

  // rings: player only
  if(r.isPlayer){
    for(let i=world.rings.length-1;i>=0;i--){
      const ring=world.rings[i];
      if(cx > ring.x && cx < ring.x + ring.w){
        r.rings++;
        world.rings.splice(i,1);
        break;
      }
    }
  }

  if(r.boostTimer>0){
    r.boostTimer -= dt;
    if(r.boostTimer<=0){
      r.boostTimer=0;
      r.boostPower=0;
    }
  }
  if(r.slowTimer>0){
    r.slowTimer -= dt;
    if(r.slowTimer<0) r.slowTimer=0;
  }
}

function aiLogic(r, dt){
  if(r.isPlayer || r.finished) return;
  r.aiCd -= dt;
  if(r.aiCd>0) return;

  if((r.onGround||r.onRail||r.onPipe) && Math.random()<0.05) tryJump(r);
  if(Math.random() < 0.03 + r.winRate*0.06) applyBoost(r, CONFIG.BOOST_ADD, CONFIG.BOOST_TIME);

  r.aiCd = rand(0.25,0.6);
}

function updateRun(dt){
  regenStock(dt);

  const p = state.runners[state.playerIndex];

  if(input.jump){ input.jump=false; tryJump(p); }
  if(input.boost && state.stock>0){
    input.boost=false;
    state.stock--;
    applyBoost(p, CONFIG.BOOST_ADD, CONFIG.BOOST_TIME);
  }
  if(input.jumpBoost && p.rings>=CONFIG.RING_NEED){
    input.jumpBoost=false;
    p.rings -= CONFIG.RING_NEED;
    p.vy = -CONFIG.JUMPBOOST_V;
    applyBoost(p, CONFIG.JUMPBOOST_ADD, CONFIG.JUMPBOOST_TIME);
  }

  spawnWorld(p.x);

  for(const r of state.runners){
    updatePhysics(r, dt);
    aiLogic(r, dt);
    r.x += speedOf(r) * dt;

    if(!r.finished && r.x >= world.goalX){
      r.finished=true;
      r.finishTime=state.time;
      state.finishedCount++;
    }
  }

  updateRank();
  state.cameraX = p.x - CONFIG.LOGICAL_W*0.18;
  state.time += dt;

  // survive数に到達したら result 停止（次へボタン待ち）
  const race = CONFIG.RACES[state.raceIndex];
  if(state.finishedCount >= race.survive){
    state.phase="result";
    if(btnNext) btnNext.style.display="block";
  }
}

/* === PART4 START === */
 // game.js PART 4 / 5  (FIXED2)
// RENDER / HUD / MINIMAP / RESULT (FIT ALL)

function beginDraw(){
  const cw=canvas.width, ch=canvas.height;
  const sx=cw/CONFIG.LOGICAL_W;
  const sy=ch/CONFIG.LOGICAL_H;
  const s=Math.max(sx,sy);
  const ox=(cw-CONFIG.LOGICAL_W*s)*0.5;
  const oy=(ch-CONFIG.LOGICAL_H*s)*0.5;
  ctx.setTransform(s,0,0,s,ox,oy);
  ctx.imageSmoothingEnabled=false;
}

function drawSky(){
  const g=ctx.createLinearGradient(0,0,0,CONFIG.LOGICAL_H);
  g.addColorStop(0,"#2a6ccf");
  g.addColorStop(0.6,"#163d7a");
  g.addColorStop(1,"#071727");
  ctx.fillStyle=g;
  ctx.fillRect(0,0,CONFIG.LOGICAL_W,CONFIG.LOGICAL_H);
}

function drawStage(){
  const y=world.groundTop;
  ctx.fillStyle="rgba(0,0,0,0.25)";
  ctx.fillRect(0,y,CONFIG.LOGICAL_W,world.groundH);

  const img=IMAGES.stage;
  if(!img) return;

  const s=world.groundH/img.height;
  const w=Math.floor(img.width*s);
  let x=-((state.cameraX%w+w)%w);
  for(; x<CONFIG.LOGICAL_W+w; x+=w){
    ctx.drawImage(img,x,y,w,world.groundH);
  }
}

function drawObjects(){
  ctx.fillStyle="rgba(120,190,255,0.55)";
  for(const p of world.puddles){
    const sx=p.x-state.cameraX;
    if(sx<-200||sx>CONFIG.LOGICAL_W+200) continue;
    ctx.fillRect(sx,p.y,p.w,p.h);
  }

  const ring=IMAGES.ring;
  for(const r of world.rings){
    const sx=r.x-state.cameraX;
    if(sx<-200||sx>CONFIG.LOGICAL_W+200) continue;
    ring && ctx.drawImage(ring,sx,r.y,r.w,r.h);
  }

  for(const p of world.pipes){
    const sx=p.x-state.cameraX;
    if(sx<-300||sx>CONFIG.LOGICAL_W+300) continue;
    ctx.drawImage(p.img,sx,p.y,p.w,p.h);
  }

  const rail=IMAGES.rail;
  for(const r of world.rails){
    const sx=r.x-state.cameraX;
    if(sx<-200||sx>CONFIG.LOGICAL_W+200) continue;
    rail && ctx.drawImage(rail,sx,r.y,r.w,r.h);
  }
}

function drawRunner(r){
  let sx;
  if(r.isPlayer){
    sx=Math.floor(CONFIG.LOGICAL_W*0.18);
  }else{
    const p=state.runners[state.playerIndex];
    sx=Math.floor(CONFIG.LOGICAL_W*0.18 + (r.x-p.x));
  }
  if(sx<-120||sx>CONFIG.LOGICAL_W+120) return;

  ctx.fillStyle="rgba(0,0,0,0.25)";
  ctx.beginPath();
  ctx.ellipse(sx+r.w/2,world.groundTop+6,r.w*0.35,6,0,0,Math.PI*2);
  ctx.fill();

  const board=IMAGES.board;
  board && ctx.drawImage(board, sx-r.w*0.05, r.y+r.h*0.65, r.w*1.1, r.h*0.45);

  const body=(r.onGround||r.onRail||r.onPipe)?IMAGES.pl1:IMAGES.pl2;
  body && ctx.drawImage(body, sx, r.y, r.w, r.h);
}

function drawMinimap(){
  const mapW=220, mapH=6;
  const x=(CONFIG.LOGICAL_W-mapW)/2;
  const y=10;

  ctx.fillStyle="rgba(0,0,0,0.5)";
  ctx.fillRect(x,y,mapW,mapH);

  for(const r of state.runners){
    const t=clamp(r.x/world.goalX,0,1);
    const px=x+mapW*t;
    ctx.fillStyle=r.isPlayer?"#00ffcc":"#ffffff";
    ctx.fillRect(px-1,y-2,2,mapH+4);
  }
}

function drawHUD(){
  const p=state.runners[state.playerIndex];
  hudSpeed.textContent = Math.floor(speedOf(p));
  hudDist.textContent  = Math.floor(p.x/CONFIG.PX_PER_M);

  ctx.fillStyle="rgba(255,255,255,0.95)";
  ctx.font="12px system-ui";
  ctx.fillText(state.rankText, CONFIG.LOGICAL_W-92, 22);
  ctx.fillText(`RING ${p.rings}/${CONFIG.RING_NEED}`, 10, 22);
  ctx.fillText(`RACE ${CONFIG.RACES[state.raceIndex].name}`, 10, 38);
  ctx.fillText(VERSION, 10, CONFIG.LOGICAL_H-10);

  drawMinimap();
}

function drawResult(){
  ctx.fillStyle="rgba(0,0,0,0.78)";
  ctx.fillRect(0,0,CONFIG.LOGICAL_W,CONFIG.LOGICAL_H);

  ctx.fillStyle="#fff";
  ctx.font="18px system-ui";
  ctx.fillText(`RESULT - ${CONFIG.RACES[state.raceIndex].name}`, 12, 28);

  const list=[...state.runners].sort((a,b)=>a.finishTime-b.finishTime);

  // ★2カラムで全員入れる（スマホでも切れない）
  const colW = (CONFIG.LOGICAL_W - 24) / 2;
  const startY = 48;
  const rowH = 14;
  ctx.font="12px system-ui";

  for(let i=0;i<list.length;i++){
    const col = (i < 18) ? 0 : 1;
    const row = (i < 18) ? i : (i - 18);
    const x = 12 + colW*col;
    const y = startY + rowH*row;

    const r=list[i];
    const t=isFinite(r.finishTime)?r.finishTime.toFixed(2):"--";
    const name=r.name;
    if(r.isPlayer) ctx.fillStyle="#00ffcc";
    else ctx.fillStyle="#ffffff";
    ctx.fillText(`${i+1}. ${name} ${t}`, x, y);
  }

  if(btnNext) btnNext.style.display="block";
}

function render(){
  ctx.setTransform(1,0,0,1,0,0);
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

  drawHUD();

  if(state.phase==="countdown"){
    ctx.fillStyle="rgba(0,0,0,0.6)";
    ctx.fillRect(0,0,CONFIG.LOGICAL_W,CONFIG.LOGICAL_H);
    ctx.fillStyle="#fff";
    ctx.font="bold 64px system-ui";
    ctx.textAlign="center";
    ctx.fillText(Math.ceil(state.countdown),CONFIG.LOGICAL_W/2,CONFIG.LOGICAL_H/2);
    ctx.textAlign="left";
  }

  if(state.phase==="result"){
    drawResult();
  }
}

/* === PART5 START === */
 // game.js PART 5 / 5  (FIXED2)
// LOOP / NEXT BUTTON / BOOT

function update(dt){
  if(state.phase==="countdown"){
    updateCountdown(dt);
    return;
  }
  if(state.phase==="run"){
    updateRun(dt);
    return;
  }
  // result: wait user press
}

function loop(t){
  const dt = Math.min((t - state.lastTime)/1000, 0.033);
  state.lastTime = t;

  if(state.phase!=="loading") update(dt);
  render();

  requestAnimationFrame(loop);
}

btnNext && btnNext.addEventListener("pointerdown", ()=>{
  btnNext.style.display="none";

  if(state.raceIndex < CONFIG.RACES.length - 1){
    initRace(state.raceIndex + 1);
    resetGround();
    setGoal();
    state.phase="countdown";
  }else{
    // 全レース終了 → 最初へ
    initRace(0);
    resetGround();
    setGoal();
    state.phase="countdown";
  }
});

async function boot(){
  try{
    await bootCore();
    initRace(0);
    resetGround();
    setGoal();
    updateRank(); // countdown中も表示
    state.phase="countdown";
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
