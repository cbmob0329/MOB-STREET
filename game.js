// game.js PART 1 / 3
// FULL SPEC BASE (do not delete, do not slim)
// VERSION: v0.2.0-full
// このPART1の末尾に PART2 → PART3 を順番に追記して完成

(() => {
"use strict";

/* =====================
   VERSION
===================== */
const VERSION = "v0.2.0-full";

/* =====================
   DOM
===================== */
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d", { alpha: false });

const overlay = document.getElementById("overlay");
const overlayTitle = document.getElementById("overlayTitle");
const overlayMsg = document.getElementById("overlayMsg");

const btnJump = document.getElementById("btnJump");
const btnBoost = document.getElementById("btnBoost");
const btnJumpBoost = document.getElementById("btnJumpBoost");

const hudSpeed = document.getElementById("hudSpeed");
const hudDist = document.getElementById("hudDist");

/* =====================
   MOBILE LOCK
===================== */
["dblclick","contextmenu","gesturestart","gesturechange","gestureend"]
.forEach(ev=>{
  document.addEventListener(ev,e=>e.preventDefault(),{passive:false});
});
window.addEventListener("touchmove",e=>e.preventDefault(),{passive:false});

/* =====================
   CONFIG
===================== */
const CONFIG = {
  LOGICAL_W: 360,
  LOGICAL_H: 640,

  PX_PER_M: 10,

  PLAYER_SIZE: 48,

  GRAVITY: 2200,
  JUMP_V1: 860,
  JUMP_V2: 780,
  JUMPBOOST_V: 1280,
  MAX_FALL_V: 1800,

  BASE_SPEED: 260,

  BOOST_ADD: 210,
  BOOST_TIME: 0.85,

  JUMPBOOST_ADD: 520,
  JUMPBOOST_TIME: 1.25,

  STOCK_MAX: 5,
  STOCK_REGEN: 5.0,
  STOCK_START: 0,

  RING_NEED: 10,

  // RACES
  RACES: [
    { name:"EASY",   goal:600,  start:26, survive:16 },
    { name:"NORMAL", goal:1000, start:16, survive:6  },
    { name:"HARD",   goal:1200, start:8,  survive:1  }
  ]
};

/* =====================
   UTIL
===================== */
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const rand=(a,b)=>a+Math.random()*(b-a);

/* =====================
   ASSETS
===================== */
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
  return new Promise((res,rej)=>{
    const i=new Image();
    i.onload=()=>res(i);
    i.onerror=()=>rej(src);
    i.src=src;
  });
}
async function loadAssets(){
  for(const k in ASSETS){
    overlayTitle.textContent="Loading";
    overlayMsg.textContent=ASSETS[k];
    IMAGES[k]=await loadImage(ASSETS[k]);
  }
}

/* =====================
   STATE
===================== */
const state = {
  phase:"loading",
  raceIndex:0,
  time:0,
  lastTime:0,

  stock:CONFIG.STOCK_START,
  stockTimer:0,

  cameraX:0,

  runners:[],
  playerIndex:0
};

/* =====================
   RUNNER
===================== */
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

/* =====================
   INPUT
===================== */
const input={jump:false,boost:false,jumpBoost:false};

btnJump?.addEventListener("pointerdown",()=>input.jump=true);
btnBoost?.addEventListener("pointerdown",()=>input.boost=true);
btnJumpBoost?.addEventListener("pointerdown",()=>input.jumpBoost=true);

window.addEventListener("keydown",e=>{
  if(e.key===" ") input.jump=true;
  if(e.key==="b") input.boost=true;
  if(e.key==="n") input.jumpBoost=true;
});

/* === PART2 START === */
 // game.js PART 2 / 3
// FULL SPEC – WORLD / RACES / GHOSTS / PHYSICS CORE
// ※PART1末尾「/* === PART2 START === */」の直後に貼り付け

/* =====================
   WORLD
===================== */
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

function resetGround() {
  const st = IMAGES.stage;
  world.groundH = st ? Math.max(130, Math.min(210, st.height)) : 170;
  world.groundTop = CONFIG.LOGICAL_H - world.groundH;
}

/* =====================
   RACES / RUNNERS
===================== */
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
  const player = createRunner("YOU", true, 1.0);
  state.runners.push(player);
  state.playerIndex = 0;

  // named ghosts
  for(const g of NAMED_GHOSTS){
    state.runners.push(createRunner(g.name,false,g.wr));
  }
  // letter ghosts
  for(const l of LETTERS){
    state.runners.push(createRunner(l,false,0.30));
  }

  // trim to start count
  state.runners = state.runners.slice(0, race.start);

  // reset runner state
  for(const r of state.runners){
    r.x=0; r.vy=0; r.onGround=true; r.onRail=false; r.onPipe=false;
    r.jumps=0; r.boostTimer=0; r.boostPower=0; r.slowTimer=0;
    r.rings=0; r.finished=false; r.finishTime=Infinity;
    r.y = world.groundTop - r.h;
  }

  // reset world spawns
  world.rails=[]; world.puddles=[]; world.pipes=[]; world.rings=[];
  world.nextRailX=220; world.nextPuddleX=260; world.nextPipeX=700; world.nextRingX=260;
}

/* =====================
   SPAWN OBJECTS
===================== */
function addRail(x){
  const img=IMAGES.rail;
  const h=Math.floor(world.groundH*0.43);
  const w=img?Math.floor(img.width*(h/img.height)):140;
  world.rails.push({x,y:world.groundTop-h,w,h});
  world.nextRailX=x+w+rand(160,400);
}
function addPuddle(x){
  const w=rand(46,92), h=12;
  world.puddles.push({x,y:world.groundTop+world.groundH*0.22,w,h});
  world.nextPuddleX=x+w+rand(160,360);
}
function addRing(x){
  const s=22;
  world.rings.push({x,y:world.groundTop-s-26,w:s,h:s});
  world.nextRingX=x+rand(90,180);
}
function addPipe(x){
  const img=Math.random()<0.5?IMAGES.hpr:IMAGES.hpg;
  if(!img) return;
  const h=Math.floor(world.groundH*0.43);
  const w=Math.floor(img.width*(h/img.height));
  world.pipes.push({x,y:world.groundTop-h,w,h,img});
  world.nextPipeX=x+w+rand(520,680);
}
function spawnWorld(playerX){
  const ahead=playerX+1000, behind=playerX-420;
  while(world.nextRingX<ahead) addRing(world.nextRingX);
  while(world.nextRailX<ahead) addRail(world.nextRailX);
  while(world.nextPuddleX<ahead) addPuddle(world.nextPuddleX);
  while(world.nextPipeX<ahead) addPipe(world.nextPipeX);

  world.rings=world.rings.filter(o=>o.x+o.w>behind);
  world.rails=world.rails.filter(o=>o.x+o.w>behind);
  world.puddles=world.puddles.filter(o=>o.x+o.w>behind);
  world.pipes=world.pipes.filter(o=>o.x+o.w>behind-200);
}

/* =====================
   PHYSICS / SPEED
===================== */
function regenStock(dt){
  state.stockTimer+=dt;
  while(state.stockTimer>=CONFIG.STOCK_REGEN){
    state.stockTimer-=CONFIG.STOCK_REGEN;
    if(state.stock<CONFIG.STOCK_MAX) state.stock++;
  }
}
function speedOf(r){
  let s=CONFIG.BASE_SPEED*(r.isPlayer?1:(0.98+r.winRate*0.06));
  if(r.boostTimer>0) s+=r.boostPower;
  if(r.onRail) s+=55;
  if(r.slowTimer>0) s-=65;
  return Math.max(30,s);
}
function applyBoost(r,add,t){ r.boostPower=add; r.boostTimer=t; }
function tryJump(r){
  if(r.onGround||r.onRail||r.onPipe){ r.vy=-CONFIG.JUMP_V1; r.jumps=1; r.onGround=r.onRail=r.onPipe=false; return; }
  if(r.jumps<2){ r.vy=-CONFIG.JUMP_V2; r.jumps=2; }
}
function updatePhysics(r,dt){
  r.vy+=CONFIG.GRAVITY*dt; r.vy=Math.min(r.vy,CONFIG.MAX_FALL_V);
  r.y+=r.vy*dt;

  // ground
  if(r.y+r.h>=world.groundTop){
    r.y=world.groundTop-r.h; r.vy=0; r.onGround=true; r.jumps=0;
  } else r.onGround=false;

  if(r.boostTimer>0){ r.boostTimer-=dt; if(r.boostTimer<=0){ r.boostTimer=0; r.boostPower=0; } }
  if(r.slowTimer>0){ r.slowTimer-=dt; if(r.slowTimer<0) r.slowTimer=0; }
}

/* =====================
   UPDATE
===================== */
function update(dt){
  regenStock(dt);
  const player=state.runners[state.playerIndex];

  if(input.jump){ input.jump=false; tryJump(player); }
  if(input.boost && state.stock>0){ input.boost=false; state.stock--; applyBoost(player,CONFIG.BOOST_ADD,CONFIG.BOOST_TIME); }
  if(input.jumpBoost && player.rings>=CONFIG.RING_NEED){
    input.jumpBoost=false; player.rings-=CONFIG.RING_NEED;
    player.vy=-CONFIG.JUMPBOOST_V; applyBoost(player,CONFIG.JUMPBOOST_ADD,CONFIG.JUMPBOOST_TIME);
  }

  spawnWorld(player.x);

  for(const r of state.runners){
    updatePhysics(r,dt);
    r.x+=speedOf(r)*dt;
    if(!r.finished && r.x>=world.goalX){ r.finished=true; r.finishTime=state.time; }
  }

  state.cameraX=player.x-CONFIG.LOGICAL_W*0.18;
  state.time+=dt;
}

/* === PART3 START === */
 // game.js PART 3 / 3
// FULL SPEC – RENDER / LOOP / BOOT
// ※PART2末尾「/* === PART3 START === */」の直後に貼り付け

/* =====================
   RENDER
===================== */
function beginDraw(){
  const cw=canvas.width, ch=canvas.height;
  const sx=cw/CONFIG.LOGICAL_W, sy=ch/CONFIG.LOGICAL_H;
  const s=Math.max(sx,sy); // フル表示（黒帯なし）
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
  const img=IMAGES.stage; if(!img) return;
  const s=world.groundH/img.height;
  const w=Math.floor(img.width*s), h=world.groundH;
  let x=-(state.cameraX%w+w)%w;
  for(;x<CONFIG.LOGICAL_W+w;x+=w) ctx.drawImage(img,x,y,w,h);
}

function drawObjects(){
  // puddles
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
    ring&&ctx.drawImage(ring,sx,r.y,r.w,r.h);
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
    rail&&ctx.drawImage(rail,sx,r.y,r.w,r.h);
  }
}

function drawGoal(){
  const sx=world.goalX-state.cameraX;
  if(sx<-20||sx>CONFIG.LOGICAL_W+20) return;
  ctx.fillStyle="rgba(255,255,255,0.9)";
  ctx.fillRect(sx-2,world.groundTop-160,4,220);
}

function drawRunner(r){
  let sx;
  if(r.isPlayer){
    sx=Math.floor(CONFIG.LOGICAL_W*0.18);
  }else{
    const p=state.runners[state.playerIndex];
    sx=Math.floor(CONFIG.LOGICAL_W*0.18+(r.x-p.x));
  }
  if(sx<-120||sx>CONFIG.LOGICAL_W+120) return;

  // shadow
  ctx.fillStyle="rgba(0,0,0,0.25)";
  ctx.beginPath();
  ctx.ellipse(sx+r.w/2,world.groundTop+6,r.w*0.35,6,0,0,Math.PI*2);
  ctx.fill();

  // board
  const board=IMAGES.board;
  board&&ctx.drawImage(board,sx-r.w*0.05,r.y+r.h*0.65,r.w*1.1,r.h*0.45);

  // body
  const body=(r.onGround||r.onRail||r.onPipe)?IMAGES.pl1:IMAGES.pl2;
  body&&ctx.drawImage(body,sx,r.y,r.w,r.h);
}

function drawHUD(){
  const p=state.runners[state.playerIndex];
  const speed=Math.floor(speedOf(p));
  const dist=Math.floor(p.x/CONFIG.PX_PER_M);
  hudSpeed.textContent=speed;
  hudDist.textContent=dist;
  ctx.fillStyle="rgba(255,255,255,0.9)";
  ctx.font="12px system-ui";
  ctx.fillText(`RING ${p.rings}/${CONFIG.RING_NEED}`,10,22);
  ctx.fillText(VERSION,10,CONFIG.LOGICAL_H-10);
}

function render(){
  ctx.setTransform(1,0,0,1,0,0);
  ctx.fillStyle="#000";
  ctx.fillRect(0,0,canvas.width,canvas.height);
  beginDraw();
  drawSky();
  drawStage();
  drawObjects();
  drawGoal();
  // ghosts（表示は名前付きのみ）
  for(const r of state.runners){ if(!r.isPlayer && r.winRate>0.3) drawRunner(r); }
  drawRunner(state.runners[state.playerIndex]);
  drawHUD();
}

/* =====================
   LOOP / BOOT
===================== */
function loop(t){
  const dt=Math.min((t-state.lastTime)/1000,0.033);
  state.lastTime=t;
  if(state.phase==="run") update(dt);
  render();
  requestAnimationFrame(loop);
}

async function boot(){
  try{
    state.phase="loading";
    overlayTitle.textContent="Loading";
    overlayMsg.textContent="images...";
    await loadAssets();
    resetGround();
    initRace(0); // EASY
    state.phase="run";
    state.lastTime=performance.now();
    requestAnimationFrame(loop);
  }catch(e){
    overlayTitle.textContent="Error";
    overlayMsg.textContent=String(e);
    console.error(e);
  }
}

boot();
})();
