// game.js PART 1 / 5  (v6 FULL FIXED PART1)
// VERSION: v6
// Fixes: black side bars (cover scale in PART4), countdown dark overlay (lighter in PART4),
// race-to-race spawn reset (PART2 + initRace hook), pipe bigger (PART2), AI boost cooldown (PART3),
// player label (PART4)

(() => {
"use strict";

const VERSION = "v6";

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

  // プレイヤー：5秒 / 最大5 / 初期0
  STOCK_MAX: 5,
  STOCK_REGEN: 5.0,
  STOCK_START: 0,

  // AI：ブースト最短間隔（体感の不公平感を抑える）
  AI_BOOST_COOLDOWN: 5.0,

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
======================= */
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

    aiCd:rand(0.15,0.45),
    aiBoostCd:rand(0.0, CONFIG.AI_BOOST_COOLDOWN)
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
    r.aiBoostCd=rand(0.0, CONFIG.AI_BOOST_COOLDOWN);
  }

  state.stock=CONFIG.STOCK_START;
  state.stockTimer=0;

  state.countdown=3;
  state.phase="countdown";

  nextFixed.style.display="none";

  // ★ステージ切替時に必ずスポーン状態を初期化（PART2で定義）
  if(typeof resetWorldForRace === "function") resetWorldForRace();
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
   // game.js PART 2 / 5  (v6)
// WORLD / GROUND / SPAWN / PIPE SIZE FIX

/* =======================
   WORLD
======================= */
const world = {
  groundY: 0,
  groundH: 0,

  rails: [],
  pipes: [],
  puddles: [],
  rings: [],

  nextRailX: 220,
  nextPipeX: 700,
  nextPuddleX: 260,
  nextRingX: 220
};

/* =======================
   RESET WORLD PER RACE
======================= */
function resetWorldForRace(){
  world.rails.length = 0;
  world.pipes.length = 0;
  world.puddles.length = 0;
  world.rings.length = 0;

  world.nextRailX = 220;
  world.nextPipeX = 700;
  world.nextPuddleX = 260;
  world.nextRingX = 220;
}

/* =======================
   GROUND
======================= */
function resetGround(){
  // 画面サイズに対して常に安定する位置
  world.groundH = 72;
  world.groundY = CONFIG.LOGICAL_H - world.groundH;
}

/* =======================
   SPAWN CONTROLLER
======================= */
function spawnWorld(camX){
  // ---- RAIL ----
  if(camX + CONFIG.LOGICAL_W > world.nextRailX){
    addRail(world.nextRailX);
    world.nextRailX += rand(260,420);
  }

  // ---- PIPE ----
  if(camX + CONFIG.LOGICAL_W > world.nextPipeX){
    addPipe(world.nextPipeX);
    world.nextPipeX += rand(520,780);
  }

  // ---- PUDDLE ----
  if(camX + CONFIG.LOGICAL_W > world.nextPuddleX){
    addPuddle(world.nextPuddleX);
    world.nextPuddleX += rand(260,380);
  }

  // ---- RING ----
  if(camX + CONFIG.LOGICAL_W > world.nextRingX){
    addRing(world.nextRingX);
    world.nextRingX += rand(120,200);
  }
}

/* =======================
   ADD OBJECTS
======================= */
function addRail(x){
  const img = IMAGES.rail;
  const w = img.width;
  const h = img.height * 0.78; // 低めに
  world.rails.push({
    x, y: world.groundY - h,
    w, h
  });
}

function addPipe(x){
  const img = Math.random()<0.5 ? IMAGES.hpr : IMAGES.hpg;

  // ★ v6：サイズ拡大（高さも横も）
  const h = Math.floor(world.groundH * 0.48); // ←ここが重要
  const scale = h / img.height;
  const w = img.width * scale;

  world.pipes.push({
    x,
    y: world.groundY - h,
    w, h,
    img
  });
}

function addPuddle(x){
  world.puddles.push({
    x,
    y: world.groundY - 8,
    w: rand(32,48),
    h: 6
  });
}

function addRing(x){
  const air = Math.random() < 0.45;
  const y = air ? world.groundY - rand(70,120) : world.groundY - 28;
  world.rings.push({
    x,
    y,
    r: 8,
    taken: false
  });
}

/* =======================
   COLLISION HELPERS
======================= */
function rectHit(ax,ay,aw,ah,bx,by,bw,bh){
  return ax < bx+bw && ax+aw > bx && ay < by+bh && ay+ah > by;
}

/* === PART3 START === */
   // game.js PART 3 / 5  (v6)
// MOVE / JUMP / RAIL / PIPE (SLOPE FIX) / RING BOOST

/* =======================
   RUN UPDATE
======================= */
function updateRun(dt){
  const race = CONFIG.RACES[state.raceIndex];
  const player = state.runners[state.playerIndex];

  // カメラ
  state.cameraX = player.x - 80;
  if(state.cameraX < 0) state.cameraX = 0;

  spawnWorld(state.cameraX);

  // プレイヤーのストック回復（5秒）
  state.stockTimer += dt;
  if(state.stockTimer >= CONFIG.STOCK_REGEN){
    state.stockTimer = 0;
    state.stock = Math.min(CONFIG.STOCK_MAX, state.stock + 1);
  }

  for(const r of state.runners){
    if(r.finished) continue;

    // --------- AI ----------
    if(!r.isPlayer){
      r.aiCd -= dt;
      r.aiBoostCd -= dt;

      if(r.aiCd <= 0){
        r.aiCd = rand(0.25,0.55);

        if(Math.random() < 0.015){
          doJump(r);
        }
      }

      // AIブースト（★5秒クールダウン）
      if(r.aiBoostCd <= 0 && Math.random() < r.winRate * 0.12){
        r.aiBoostCd = CONFIG.AI_BOOST_COOLDOWN;
        startBoost(r, CONFIG.BOOST_ADD, CONFIG.BOOST_TIME);
      }
    }

    // --------- INPUT ----------
    if(r.isPlayer){
      if(input.jump){
        doJump(r);
        input.jump = false;
      }
      if(input.boost && state.stock > 0){
        state.stock--;
        startBoost(r, CONFIG.BOOST_ADD, CONFIG.BOOST_TIME);
        input.boost = false;
      }
    }

    // --------- PHYSICS ----------
    let speed = CONFIG.BASE_SPEED;

    if(r.boostTimer > 0){
      r.boostTimer -= dt;
      speed += r.boostPower;
    }

    if(r.slowTimer > 0){
      r.slowTimer -= dt;
      speed *= 0.75;
    }

    // ---- PIPE SLOPE ----
    if(r.onPipe && r.pipeRef){
      // 正規化された進行度 t (0-1)
      r.pipeT = clamp((r.x - r.pipeRef.x) / r.pipeRef.w, 0, 1);

      // 半円スロープ：sinカーブで上下
      const angle = Math.PI * r.pipeT;
      const lift = Math.sin(angle);

      // ★上がらない問題の修正点
      r.y = r.pipeRef.y + r.pipeRef.h - lift * r.pipeRef.h - r.h;
      speed += lift * 160; // 坂加速

      if(r.pipeT >= 1){
        r.onPipe = false;
        r.pipeRef = null;
        r.onGround = true;
      }
    }else{
      // 重力
      r.vy += CONFIG.GRAVITY * dt;
      r.vy = Math.min(r.vy, CONFIG.MAX_FALL_V);
      r.y += r.vy * dt;
    }

    r.x += speed * dt;

    // --------- GROUND ----------
    if(!r.onPipe){
      if(r.y + r.h >= world.groundY){
        r.y = world.groundY - r.h;
        r.vy = 0;
        r.onGround = true;
        r.jumps = 0;
      }else{
        r.onGround = false;
      }
    }

    // --------- RAIL ----------
    if(!r.onPipe){
      for(const rail of world.rails){
        if(rectHit(r.x,r.y,r.w,r.h, rail.x,rail.y,rail.w,rail.h)){
          if(r.vy >= 0 && r.y + r.h - r.vy*dt <= rail.y){
            r.y = rail.y - r.h;
            r.vy = 0;
            r.onGround = true;
            r.onRail = true;
            speed += 60;
          }
        }
      }
    }

    // --------- PIPE ENTER ----------
    if(!r.onPipe){
      for(const pipe of world.pipes){
        if(rectHit(r.x,r.y,r.w,r.h, pipe.x,pipe.y,pipe.w,pipe.h)){
          if(r.vy >= 0 && r.y + r.h - r.vy*dt <= pipe.y){
            r.onPipe = true;
            r.pipeRef = pipe;
            r.pipeT = 0;
            r.vy = 0;
            r.onGround = false;
          }
        }
      }
    }

    // --------- PUDDLE ----------
    for(const p of world.puddles){
      if(rectHit(r.x,r.y,r.w,r.h, p.x,p.y,p.w,p.h)){
        r.slowTimer = 0.4;
      }
    }

    // --------- RING ----------
    for(const ring of world.rings){
      if(!ring.taken){
        const dx = (r.x + r.w/2) - ring.x;
        const dy = (r.y + r.h/2) - ring.y;
        if(dx*dx + dy*dy < ring.r*ring.r*4){
          ring.taken = true;
          r.rings++;
          if(r.rings >= CONFIG.RING_NEED){
            r.rings = 0;
            startBoost(r, CONFIG.RING_BOOST_ADD, CONFIG.RING_BOOST_TIME);
          }
        }
      }
    }

    // --------- FINISH ----------
    if(!r.finished && r.x / CONFIG.PX_PER_M >= race.goal){
      r.finished = true;
      r.finishTime = state.time;
      state.finishedCount++;
    }
  }

  state.time += dt;
  updateRank();

  // ---- END CHECK ----
  if(state.finishedCount >= race.survive){
    state.phase = "result";
    nextFixed.style.display = "block";
  }
}

/* =======================
   ACTIONS
======================= */
function doJump(r){
  if(r.onGround){
    r.vy = -CONFIG.JUMP_V1;
    r.onGround = false;
    r.jumps = 1;
  }else if(r.jumps === 1){
    r.vy = -CONFIG.JUMP_V2;
    r.jumps = 2;
  }
}

function startBoost(r,power,time){
  r.boostPower = power;
  r.boostTimer = time;
}

/* === PART4 START === */
   // game.js PART 4 / 5  (v6)
// RENDER (COVER -> 黒帯消し) / COUNTDOWN暗転軽減 / PLAYER LABEL / RESULT CENTER

/* =======================
   DRAW BASE
======================= */
function beginDraw(){
  const cw = canvas.width;
  const ch = canvas.height;

  const sx = cw / CONFIG.LOGICAL_W;
  const sy = ch / CONFIG.LOGICAL_H;

  // ★黒帯を消す：画面を埋める（cover）
  const s = Math.max(sx, sy);
  const ox = (cw - CONFIG.LOGICAL_W * s) * 0.5;
  const oy = (ch - CONFIG.LOGICAL_H * s) * 0.5;

  ctx.setTransform(s,0,0,s,ox,oy);
  ctx.imageSmoothingEnabled = false;
}

/* =======================
   BG
======================= */
function drawSky(){
  const g = ctx.createLinearGradient(0,0,0,CONFIG.LOGICAL_H);
  g.addColorStop(0,"#2a6ccf");
  g.addColorStop(0.6,"#163d7a");
  g.addColorStop(1,"#071727");
  ctx.fillStyle = g;
  ctx.fillRect(0,0,CONFIG.LOGICAL_W,CONFIG.LOGICAL_H);
}

function drawStage(){
  // ground shade
  ctx.fillStyle = "rgba(0,0,0,0.20)";
  ctx.fillRect(0, world.groundY, CONFIG.LOGICAL_W, world.groundH);

  const img = IMAGES.stage;
  if(!img) return;

  // scale stage image to groundH
  const s = world.groundH / img.height;
  const w = Math.max(1, Math.floor(img.width * s));
  let x = -((state.cameraX % w + w) % w);

  for(; x < CONFIG.LOGICAL_W + w; x += w){
    ctx.drawImage(img, x, world.groundY, w, world.groundH);
  }
}

/* =======================
   OBJECTS
======================= */
function drawObjects(){
  // puddles
  ctx.fillStyle="rgba(120,190,255,0.55)";
  for(const p of world.puddles){
    const sx = p.x - state.cameraX;
    if(sx < -120 || sx > CONFIG.LOGICAL_W + 120) continue;
    ctx.fillRect(sx, p.y, p.w, p.h);
  }

  // rings
  const ringImg = IMAGES.ring;
  if(ringImg){
    for(const r of world.rings){
      if(r.taken) continue;
      const sx = r.x - state.cameraX;
      if(sx < -120 || sx > CONFIG.LOGICAL_W + 120) continue;
      ctx.drawImage(ringImg, sx - 10, r.y - 10, 20, 20);
    }
  }

  // pipes
  for(const p of world.pipes){
    const sx = p.x - state.cameraX;
    if(sx < -260 || sx > CONFIG.LOGICAL_W + 260) continue;
    ctx.drawImage(p.img, sx, p.y, p.w, p.h);
  }

  // rails
  const railImg = IMAGES.rail;
  if(railImg){
    for(const r of world.rails){
      const sx = r.x - state.cameraX;
      if(sx < -200 || sx > CONFIG.LOGICAL_W + 200) continue;
      ctx.drawImage(railImg, sx, r.y, r.w, r.h);
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
  if(sx < -120 || sx > CONFIG.LOGICAL_W + 120) return;

  // shadow
  ctx.fillStyle="rgba(0,0,0,0.25)";
  ctx.beginPath();
  ctx.ellipse(sx + r.w/2, world.groundY + 5, r.w*0.35, 5, 0, 0, Math.PI*2);
  ctx.fill();

  // board
  const board = IMAGES.board;
  if(board){
    ctx.drawImage(board, sx - r.w*0.05, r.y + r.h*0.65, r.w*1.1, r.h*0.45);
  }

  // body
  const body = (r.onGround || r.onRail || r.onPipe) ? IMAGES.pl1 : IMAGES.pl2;
  if(body) ctx.drawImage(body, sx, r.y, r.w, r.h);

  // label
  if(r.isPlayer){
    ctx.font="10px system-ui";
    ctx.textAlign="center";
    ctx.strokeStyle="rgba(0,0,0,0.85)";
    ctx.lineWidth=3;
    ctx.fillStyle="rgba(255,255,255,0.95)";
    ctx.strokeText("プレイヤー", sx + r.w/2, r.y - 6);
    ctx.fillText("プレイヤー", sx + r.w/2, r.y - 6);
    ctx.textAlign="left";
  }
}

/* =======================
   RESULT
======================= */
function drawResult(){
  ctx.fillStyle="rgba(0,0,0,0.85)";
  ctx.fillRect(0,0,CONFIG.LOGICAL_W,CONFIG.LOGICAL_H);

  ctx.fillStyle="#fff";
  ctx.textAlign="center";
  ctx.font="bold 28px system-ui";
  ctx.fillText(`RESULT - ${CONFIG.RACES[state.raceIndex].name}`, CONFIG.LOGICAL_W/2, 64);

  const list=[...state.runners].sort((a,b)=>a.finishTime-b.finishTime);

  ctx.font="18px system-ui";
  let y=120;
  for(let i=0;i<list.length && i<10;i++){
    const r=list[i];
    const t=isFinite(r.finishTime)?`${r.finishTime.toFixed(2)}s`:"--";
    ctx.fillStyle=r.isPlayer?"#00ffcc":"#ffffff";
    ctx.fillText(`${i+1}. ${r.name}   ${t}`, CONFIG.LOGICAL_W/2, y);
    y += 34;
  }
  ctx.textAlign="left";
}

/* =======================
   RENDER
======================= */
function render(){
  // ★残像完全防止（毎フレーム完全クリア）
  ctx.setTransform(1,0,0,1,0,0);
  ctx.globalCompositeOperation="source-over";
  ctx.fillStyle="#000";
  ctx.fillRect(0,0,canvas.width,canvas.height);

  beginDraw();

  drawSky();
  drawStage();
  drawObjects();

  // runners (named first for readability)
  for(const r of state.runners){
    if(!r.isPlayer && r.winRate > 0.30) drawRunner(r);
  }
  drawRunner(state.runners[state.playerIndex]);

  // version small (邪魔にならない位置)
  ctx.font="10px system-ui";
  ctx.fillStyle="rgba(255,255,255,0.55)";
  ctx.fillText(VERSION, 8, CONFIG.LOGICAL_H - 10);

  if(state.phase === "countdown"){
    // ★暗転を軽くする（黒い影が覆う問題）
    ctx.fillStyle="rgba(0,0,0,0.14)";
    ctx.fillRect(0,0,CONFIG.LOGICAL_W,CONFIG.LOGICAL_H);

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
   // game.js PART 5 / 5  (v6)
// LOOP / COUNTDOWN / NEXT / BOOT

function updateCountdown(dt){
  state.countdown -= dt;
  if(state.countdown <= 0){
    state.phase = "run";
  }
}

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
  // result: input is NEXT only
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

/* ---------- NEXT ---------- */
nextFixed.addEventListener("pointerdown", ()=>{
  nextFixed.style.display = "none";

  const nextIdx = (state.raceIndex < CONFIG.RACES.length - 1) ? (state.raceIndex + 1) : 0;

  initRace(nextIdx);
  resetWorldForRace();
  resetGround();

  // レース開始直後から湧くように
  spawnWorld(0);

  state.time = 0;
  state.countdown = 3;
  state.phase = "countdown";
});

/* ---------- boot ---------- */
async function boot(){
  try{
    await bootCore();

    initRace(0);
    resetWorldForRace();
    resetGround();
    spawnWorld(0);

    // 初期配置
    for(const r of state.runners){
      r.x = 0;
      r.y = world.groundY - r.h;
      r.vy = 0;
      r.onGround = true;
      r.onPipe = false;
      r.pipeRef = null;
      r.pipeT = 0;
    }

    state.time = 0;
    state.countdown = 3;
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
 
