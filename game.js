// game.js v6.2  PART 1 / 5
// VERSION: v6.2
// Fix:
// - cover描画で縦が切れて「地面/キャラが見えない」問題 → contain + 余白を空色で塗る（黒帯なし）
// - canvasが操作UIに食い込む問題は維持して解決
// NOTE: PART4で描画（contain+塗り）を実装します

(() => {
"use strict";

const VERSION = "v6.2";

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
const btnJumpBoost = document.getElementById("btnJumpBoost"); // 将来アイテム枠（今は無効）

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

  // player stock: 5s regen, max5, start0（ロジック）
  STOCK_MAX: 5,
  STOCK_REGEN: 5.0,
  STOCK_START: 0,

  // AI boost cooldown (per ghost)
  AI_BOOST_COOLDOWN: 5.0,

  RACES: [
    { name:"EASY",   goal: 600,  start:26, survive:16 },
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
  ring:"ringtap.png"
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
   canvas下端を操作UI上端に合わせる（埋まり問題の対策）
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

  if(top === null){
    top = Math.floor(window.innerHeight * 0.65);
  }

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
   INPUT
======================= */
const input = { jump:false, boost:false };

btnJump?.addEventListener("pointerdown", ()=>{ input.jump = true; });
btnBoost?.addEventListener("pointerdown", ()=>{ input.boost = true; });

window.addEventListener("keydown", e=>{
  if(e.key===" ") input.jump=true;
  if(e.key==="b") input.boost=true;
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
   FIXED NEXT BUTTON (JS only)
======================= */
let nextFixed = document.getElementById("jsNextFixed");
if(!nextFixed){
  nextFixed = document.createElement("button");
  nextFixed.id = "jsNextFixed";
  nextFixed.textContent = "NEXT RACE";
  nextFixed.style.position="fixed";
  nextFixed.style.left="50%";
  nextFixed.style.bottom="220px";
  nextFixed.style.transform="translateX(-50%)";
  nextFixed.style.zIndex="99999";
  nextFixed.style.pointerEvents="auto";
  nextFixed.style.padding="12px 18px";
  nextFixed.style.borderRadius="14px";
  nextFixed.style.border="none";
  nextFixed.style.font="bold 14px system-ui";
  nextFixed.style.color="#fff";
  nextFixed.style.background="rgba(0,0,0,0.55)";
  nextFixed.style.backdropFilter="blur(6px)";
  nextFixed.style.display="none";
  document.body.appendChild(nextFixed);
}

/* =======================
   STATE / RUNNER
======================= */
const state = {
  phase:"loading",
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

function createRunner(name,isPlayer,winRate){
  return {
    name, isPlayer, winRate,

    x:0, y:0, vy:0,
    w:CONFIG.PLAYER_SIZE, h:CONFIG.PLAYER_SIZE,

    onGround:true,
    onRail:false,
    onPipe:false,

    pipeRef:null,
    pipeT:0,

    jumps:0,

    boostTimer:0,
    boostPower:0,

    slowTimer:0,
    rings:0,

    finished:false,
    finishTime:Infinity,

    aiCd: rand(0.20,0.55),
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

  for(const g of NAMED_GHOSTS) state.runners.push(createRunner(g.name,false,g.wr));
  for(const l of LETTERS) state.runners.push(createRunner(l,false,0.30));

  const race = CONFIG.RACES[idx];
  state.runners = state.runners.slice(0, race.start);

  for(const r of state.runners){
    r.x=0; r.y=0; r.vy=0;
    r.onGround=true; r.onRail=false; r.onPipe=false;
    r.pipeRef=null; r.pipeT=0;
    r.jumps=0;
    r.boostTimer=0; r.boostPower=0;
    r.slowTimer=0; r.rings=0;
    r.finished=false; r.finishTime=Infinity;
    r.aiCd = rand(0.20,0.55);
    r.aiBoostCd = rand(0.0, CONFIG.AI_BOOST_COOLDOWN);
  }

  state.stock = CONFIG.STOCK_START;
  state.stockTimer = 0;

  state.countdown = 3;
  state.phase = "countdown";
  nextFixed.style.display = "none";

  if(typeof resetWorldForRace === "function") resetWorldForRace();
}

function updateRank(){
  const p = state.runners[state.playerIndex];
  let better = 0;
  for(const r of state.runners){
    if(r!==p && r.x > p.x) better++;
  }
  state.rank = better + 1;
  state.rankText = `RANK ${state.rank}/${state.runners.length}`;
}

/* =======================
   BOOT CORE
======================= */
async function bootCore(){
  state.phase="loading";
  if(overlayTitle) overlayTitle.textContent="Loading";
  if(overlayMsg) overlayMsg.textContent="assets";

  fitCanvasToPlayArea();
  resizeCanvas();

  await loadAssets();

  if(overlay) overlay.style.display="none";
  state.lastTime = performance.now();
}

fitCanvasToPlayArea();
resizeCanvas();

window.addEventListener("resize", ()=>{
  fitCanvasToPlayArea();
  resizeCanvas();
});

/* === PART2 START === */
   // game.js v6.2  PART 2 / 5
// WORLD / GROUND / SPAWN / OBJECT SIZE NORMALIZE
// - ここは v6.1 と同等（埋まり問題の本丸は PART4 の描画 contain にあります）
// - ただし「次ステージ以降で出ない」を防ぐため resetWorldForRace を必ず使う前提

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
   RESET WORLD (per race)
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
  // 安定した地面高さ（UI埋まりの原因ではない）
  world.groundH = 72;
  world.groundY = CONFIG.LOGICAL_H - world.groundH;
}

/* =======================
   SPAWN CONTROLLER
======================= */
function spawnWorld(camX){
  const edge = camX + CONFIG.LOGICAL_W;

  // ガードレール
  if(edge > world.nextRailX){
    addRail(world.nextRailX);
    world.nextRailX += rand(260, 420);
  }

  // ハーフパイプ
  if(edge > world.nextPipeX){
    addPipe(world.nextPipeX);
    world.nextPipeX += rand(520, 780);
  }

  // 水たまり（減速）
  if(edge > world.nextPuddleX){
    addPuddle(world.nextPuddleX);
    world.nextPuddleX += rand(260, 380);
  }

  // リング（空中含む）
  if(edge > world.nextRingX){
    addRing(world.nextRingX);
    world.nextRingX += rand(120, 200);
  }
}

/* =======================
   ADD OBJECTS
======================= */

// ---- ガードレール（正規化） ----
function addRail(x){
  const img = IMAGES.rail;
  if(!img) return;

  // 地面高さ基準で固定（巨大化しない）
  const h = Math.floor(world.groundH * 0.62);
  const scale = h / img.height;
  const w = Math.floor(img.width * scale);

  world.rails.push({
    x,
    y: world.groundY - h,
    w,
    h
  });
}

// ---- ハーフパイプ（正規化・少し大きめ） ----
function addPipe(x){
  const img = Math.random() < 0.5 ? IMAGES.hpr : IMAGES.hpg;
  if(!img) return;

  // この画面サイズ用に少し大きめ
  const h = Math.floor(world.groundH * 0.60);        // 高さ
  const scale = h / img.height;
  const w = Math.floor(img.width * scale * 1.22);    // 横を大きめ

  world.pipes.push({
    x,
    y: world.groundY - h,
    w,
    h,
    img
  });
}

// ---- 水たまり（踏むと少し減速） ----
function addPuddle(x){
  world.puddles.push({
    x,
    y: world.groundY - 8,
    w: rand(32, 48),
    h: 6
  });
}

// ---- リング（空中にも出る） ----
function addRing(x){
  const air = Math.random() < 0.50;
  const y = air
    ? world.groundY - rand(75, 135)
    : world.groundY - 28;

  world.rings.push({
    x,
    y,
    r: 8,
    taken: false
  });
}

/* =======================
   COLLISION HELPER
======================= */
function rectHit(ax,ay,aw,ah,bx,by,bw,bh){
  return ax < bx + bw && ax + aw > bx &&
         ay < by + bh && ay + ah > by;
}

/* === PART3 START === */
   // game.js v6.2  PART 3 / 5
// RUN / JUMP / RAIL / PIPE (SLOPE) / RING EFFECT
// - ハーフパイプは必ず上がる（sinカーブ）
// - レールは着地判定を厳密化
// - リング10個で小加速
// - プレイヤーのブースト回復は5秒/1、AIも同条件

/* =======================
   RUN UPDATE
======================= */
function updateRun(dt){
  const race = CONFIG.RACES[state.raceIndex];
  const player = state.runners[state.playerIndex];

  // カメラ：常にプレイヤー左寄せ
  state.cameraX = Math.max(0, player.x - Math.floor(CONFIG.LOGICAL_W * 0.18));

  spawnWorld(state.cameraX);

  // プレイヤーのブースト回復（5秒で1）
  state.stockTimer += dt;
  if(state.stockTimer >= CONFIG.STOCK_REGEN){
    state.stockTimer = 0;
    state.stock = Math.min(CONFIG.STOCK_MAX, state.stock + 1);
  }

  for(const r of state.runners){
    if(r.finished) continue;

    /* ---------- AI ---------- */
    if(!r.isPlayer){
      r.aiCd -= dt;
      r.aiBoostCd -= dt;

      if(r.aiCd <= 0){
        r.aiCd = rand(0.25, 0.55);
        if(Math.random() < 0.015) doJump(r);
      }

      // AIブースト（5秒CD）
      if(r.aiBoostCd <= 0 && Math.random() < r.winRate * 0.12){
        r.aiBoostCd = CONFIG.AI_BOOST_COOLDOWN;
        startBoost(r, CONFIG.BOOST_ADD, CONFIG.BOOST_TIME);
      }
    }

    /* ---------- PLAYER INPUT ---------- */
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

    /* ---------- SPEED ---------- */
    let speed = CONFIG.BASE_SPEED;

    if(r.boostTimer > 0){
      r.boostTimer -= dt;
      speed += r.boostPower;
    }

    if(r.slowTimer > 0){
      r.slowTimer -= dt;
      speed *= 0.75;
    }

    /* ---------- PIPE SLOPE ---------- */
    if(r.onPipe && r.pipeRef){
      // 0→1 の進行度
      r.pipeT = clamp((r.x - r.pipeRef.x) / r.pipeRef.w, 0, 1);

      // 半円カーブ（必ず上がる）
      const angle = Math.PI * r.pipeT;
      const lift = Math.sin(angle);

      // 位置更新（下端基準）
      r.y = r.pipeRef.y + r.pipeRef.h - lift * r.pipeRef.h - r.h;

      // 坂加速
      speed += lift * 160;

      // 抜け
      if(r.pipeT >= 1){
        r.onPipe = false;
        r.pipeRef = null;
        r.onGround = true;
        r.vy = 0;
      }
    }else{
      // 重力
      r.vy += CONFIG.GRAVITY * dt;
      r.vy = Math.min(r.vy, CONFIG.MAX_FALL_V);
      r.y += r.vy * dt;
    }

    // 水平方向
    r.x += speed * dt;

    /* ---------- GROUND ---------- */
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

    /* ---------- RAIL ---------- */
    if(!r.onPipe){
      for(const rail of world.rails){
        if(rectHit(r.x, r.y, r.w, r.h, rail.x, rail.y, rail.w, rail.h)){
          // 上からの着地のみ許可
          if(r.vy >= 0 && (r.y + r.h - r.vy * dt) <= rail.y + 2){
            r.y = rail.y - r.h;
            r.vy = 0;
            r.onGround = true;
            speed += 60;
          }
        }
      }
    }

    /* ---------- PIPE ENTER ---------- */
    if(!r.onPipe){
      for(const pipe of world.pipes){
        if(rectHit(r.x, r.y, r.w, r.h, pipe.x, pipe.y, pipe.w, pipe.h)){
          // 上からのみ侵入
          if(r.vy >= 0 && (r.y + r.h - r.vy * dt) <= pipe.y + 2){
            r.onPipe = true;
            r.pipeRef = pipe;
            r.pipeT = 0;
            r.vy = 0;
            r.onGround = false;
          }
        }
      }
    }

    /* ---------- PUDDLE ---------- */
    for(const p of world.puddles){
      if(rectHit(r.x, r.y, r.w, r.h, p.x, p.y, p.w, p.h)){
        r.slowTimer = 0.4;
      }
    }

    /* ---------- RING ---------- */
    for(const ring of world.rings){
      if(!ring.taken){
        const dx = (r.x + r.w/2) - ring.x;
        const dy = (r.y + r.h/2) - ring.y;
        if(dx*dx + dy*dy < ring.r * ring.r * 4){
          ring.taken = true;
          r.rings++;
          if(r.rings >= CONFIG.RING_NEED){
            r.rings = 0;
            startBoost(r, CONFIG.RING_BOOST_ADD, CONFIG.RING_BOOST_TIME);
          }
        }
      }
    }

    /* ---------- FINISH ---------- */
    if(!r.finished && r.x / CONFIG.PX_PER_M >= race.goal){
      r.finished = true;
      r.finishTime = state.time;
      state.finishedCount++;
    }
  }

  state.time += dt;
  updateRank();

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

function startBoost(r, power, time){
  r.boostPower = power;
  r.boostTimer = time;
}

/* === PART4 START === */
   // game.js v6.2  PART 4 / 5
// RENDER (CONTAIN) / NO CROP / HUD SAFE
// - cover をやめて contain（縦切れ防止）
// - 余白は空色で塗る（黒帯にならない）
// - 地面・キャラが必ず画面内に入る
// - HUD が被らない位置に固定

/* =======================
   DRAW BASE (CONTAIN)
======================= */
function beginDraw(){
  const cw = canvas.width;
  const ch = canvas.height;

  const sx = cw / CONFIG.LOGICAL_W;
  const sy = ch / CONFIG.LOGICAL_H;

  // ★contain（必ず全体が入る）
  const s = Math.min(sx, sy);

  const drawW = CONFIG.LOGICAL_W * s;
  const drawH = CONFIG.LOGICAL_H * s;

  const ox = (cw - drawW) * 0.5;
  const oy = (ch - drawH) * 0.5;

  // 余白を空色で塗る（黒帯防止）
  ctx.setTransform(1,0,0,1,0,0);
  ctx.fillStyle = "#163d7a";
  ctx.fillRect(0,0,cw,ch);

  ctx.setTransform(s, 0, 0, s, ox, oy);
  ctx.imageSmoothingEnabled = false;
}

/* =======================
   BACKGROUND
======================= */
function drawSky(){
  const g = ctx.createLinearGradient(0, 0, 0, CONFIG.LOGICAL_H);
  g.addColorStop(0, "#2a6ccf");
  g.addColorStop(0.6, "#163d7a");
  g.addColorStop(1, "#071727");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, CONFIG.LOGICAL_W, CONFIG.LOGICAL_H);
}

/* =======================
   STAGE / GROUND
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
   OBJECTS
======================= */
function drawObjects(){
  // 水たまり
  ctx.fillStyle = "rgba(120,190,255,0.5)";
  for(const p of world.puddles){
    const sx = p.x - state.cameraX;
    if(sx < -80 || sx > CONFIG.LOGICAL_W + 80) continue;
    ctx.fillRect(sx, p.y, p.w, p.h);
  }

  // リング
  const ringImg = IMAGES.ring;
  if(ringImg){
    for(const r of world.rings){
      if(r.taken) continue;
      const sx = r.x - state.cameraX;
      if(sx < -60 || sx > CONFIG.LOGICAL_W + 60) continue;
      ctx.drawImage(ringImg, sx - 10, r.y - 10, 20, 20);
    }
  }

  // ハーフパイプ
  for(const p of world.pipes){
    const sx = p.x - state.cameraX;
    if(sx < -200 || sx > CONFIG.LOGICAL_W + 200) continue;
    ctx.drawImage(p.img, sx, p.y, p.w, p.h);
  }

  // ガードレール
  const railImg = IMAGES.rail;
  if(railImg){
    for(const r of world.rails){
      const sx = r.x - state.cameraX;
      if(sx < -160 || sx > CONFIG.LOGICAL_W + 160) continue;
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
  if(sx < -80 || sx > CONFIG.LOGICAL_W + 80) return;

  // 影
  ctx.fillStyle = "rgba(0,0,0,0.25)";
  ctx.beginPath();
  ctx.ellipse(sx + r.w/2, world.groundY + 5, r.w*0.35, 5, 0, 0, Math.PI*2);
  ctx.fill();

  // ボード
  const board = IMAGES.board;
  if(board){
    ctx.drawImage(board, sx - r.w*0.05, r.y + r.h*0.65, r.w*1.1, r.h*0.45);
  }

  // 本体
  const body = (r.onGround || r.onRail || r.onPipe) ? IMAGES.pl1 : IMAGES.pl2;
  if(body){
    ctx.drawImage(body, sx, r.y, r.w, r.h);
  }

  // プレイヤーラベル
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
   HUD (SAFE AREA)
======================= */
function drawHUD(){
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.fillRect(0, 0, CONFIG.LOGICAL_W, 44);

  ctx.fillStyle = "#fff";
  ctx.font = "12px system-ui";
  ctx.fillText(`MOB STREET - 1P RUN`, 8, 16);

  ctx.fillText(`SPD ${Math.floor(CONFIG.BASE_SPEED)}`, 150, 16);
  ctx.fillText(`DIST ${Math.floor(state.runners[state.playerIndex].x / CONFIG.PX_PER_M)}`, 230, 16);
  ctx.fillText(state.rankText, 8, 34);

  ctx.font = "10px system-ui";
  ctx.fillStyle = "rgba(255,255,255,0.6)";
  ctx.fillText(VERSION, CONFIG.LOGICAL_W - 46, CONFIG.LOGICAL_H - 6);
}

/* =======================
   RESULT
======================= */
function drawResult(){
  ctx.fillStyle = "rgba(0,0,0,0.85)";
  ctx.fillRect(0, 0, CONFIG.LOGICAL_W, CONFIG.LOGICAL_H);

  ctx.fillStyle = "#fff";
  ctx.textAlign = "center";
  ctx.font = "bold 26px system-ui";
  ctx.fillText(`RESULT`, CONFIG.LOGICAL_W/2, 64);

  const list = [...state.runners].sort((a,b)=>a.finishTime-b.finishTime);

  ctx.font = "16px system-ui";
  let y = 120;
  for(let i=0; i<list.length && i<10; i++){
    const r = list[i];
    const t = isFinite(r.finishTime) ? `${r.finishTime.toFixed(2)}s` : "--";
    ctx.fillStyle = r.isPlayer ? "#00ffcc" : "#fff";
    ctx.fillText(`${i+1}. ${r.name}  ${t}`, CONFIG.LOGICAL_W/2, y);
    y += 26;
  }
  ctx.textAlign = "left";
}

/* =======================
   MAIN RENDER
======================= */
function render(){
  beginDraw();

  drawSky();
  drawStage();
  drawObjects();

  // キャラは必ず最前面
  for(const r of state.runners){
    if(!r.isPlayer && r.winRate > 0.30) drawRunner(r);
  }
  drawRunner(state.runners[state.playerIndex]);

  drawHUD();

  if(state.phase === "countdown"){
    ctx.fillStyle = "rgba(0,0,0,0.15)";
    ctx.fillRect(0,0,CONFIG.LOGICAL_W,CONFIG.LOGICAL_H);
    ctx.fillStyle = "#fff";
    ctx.font = "bold 64px system-ui";
    ctx.textAlign = "center";
    ctx.fillText(Math.ceil(state.countdown), CONFIG.LOGICAL_W/2, CONFIG.LOGICAL_H/2);
    ctx.textAlign = "left";
  }

  if(state.phase === "result"){
    drawResult();
  }
}

/* === PART5 START === */
   // game.js v6.2  PART 5 / 5
// LOOP / COUNTDOWN / NEXT / BOOT
// - 安定したメインループ
// - カウントダウン → レース開始
// - RESULT 表示後に NEXT RACE で進行
// - v6.2（contain描画）前提

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
   UPDATE
======================= */
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
  // result中は描画のみ（NEXT待ち）
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
   NEXT RACE
======================= */
nextFixed.addEventListener("pointerdown", ()=>{
  nextFixed.style.display = "none";

  const nextIdx =
    (state.raceIndex < CONFIG.RACES.length - 1)
      ? state.raceIndex + 1
      : 0;

  initRace(nextIdx);
  resetWorldForRace();
  resetGround();

  // 先頭から障害物が出るように一度スポーン
  spawnWorld(0);

  // ランナー初期化
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
});

/* =======================
   BOOT
======================= */
async function boot(){
  try{
    await bootCore();

    // 初期レース
    initRace(0);
    resetWorldForRace();
    resetGround();
    spawnWorld(0);

    for(const r of state.runners){
      r.x = 0;
      r.y = world.groundY - r.h;
      r.vy = 0;
      r.onGround = true;
    }

    state.time = 0;
    state.countdown = 3;
    state.phase = "countdown";

    state.lastTime = performance.now();
    requestAnimationFrame(loop);
  }catch(e){
    if(overlay){
      overlay.style.display = "block";
      if(overlayTitle) overlayTitle.textContent = "Error";
      if(overlayMsg) overlayMsg.textContent = String(e);
    }
    console.error(e);
  }
}

boot();
})();
   
   
 
