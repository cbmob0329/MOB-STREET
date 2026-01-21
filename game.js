// game.js (FULL) MOB STREET - 1P RUN
// VERSION: v6.4-or-dan (5 parts)
// PART 1 / 5  (boot/base/assets/ui-dom)

(() => {
"use strict";

const VERSION = "v6.4-or-dan";

/* =======================
   DOM
======================= */
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d", { alpha: false });

const overlay = document.getElementById("overlay");
const overlayTitle = document.getElementById("overlayTitle");
const overlayMsg = document.getElementById("overlayMsg");

const topSub = document.getElementById("topSub");
const topRight = document.getElementById("topRight");
const top8El = document.getElementById("top8");
const stockBar = document.getElementById("stockBar");

const btnJump = document.getElementById("btnJump");
const btnBoost = document.getElementById("btnBoost");
const btnJumpBoost = document.getElementById("btnJumpBoost");

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

  // obstacle spacing (reduced frequency)
  SPAWN: {
    RAIL_MIN: 520,  RAIL_MAX: 860,
    PIPE_MIN: 980,  PIPE_MAX: 1500,
    PUDDLE_MIN: 720, PUDDLE_MAX: 1100,
    RING_MIN: 180,  RING_MAX: 260,

    OR_MIN: 900, OR_MAX: 1400,
    DAN_MIN: 880, DAN_MAX: 1300
  },

  // new gimmicks tuning
  OR_KNOCKBACK_X: 18,
  OR_SLOW_TIME: 0.18,

  DAN_ACCEL: 70,         // 乗ってる間に加速
  DAN_FLAT_RATIO: 0.60,  // 中央フラット比率（左右はスロープ）
  DAN_SNAP_EPS: 10,      // 表面吸着しやすさ

  // pipes (larger esp horizontal)
  PIPE_H_RATIO: 0.62,
  PIPE_W_SCALE: 1.65,

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
  pl1:"PL1.png",
  pl2:"PL2.png",
  board:"redsk.png",
  stage:"st.png",
  rail:"gardw.png",
  hpr:"hpr.png",
  hpg:"hpg.png",
  ring:"ringtap.png",

  // new
  or:"or.png",
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
   PLAY AREA / CANVAS DPI
======================= */
function fitCanvasToPlayArea(){
  // CSSで play が controls 分避けているので基本はそのまま全高でOK
  // 念のため canvas を100%に固定
  canvas.style.width  = "100%";
  canvas.style.height = "100%";
  canvas.style.display = "block";
}
function resizeCanvas(){
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const r = canvas.getBoundingClientRect();
  canvas.width  = Math.max(1, Math.floor(r.width  * dpr));
  canvas.height = Math.max(1, Math.floor(r.height * dpr));
  ctx.setTransform(dpr,0,0,dpr,0,0);
}

/* =======================
   VERSION BADGE (control area)
   - ジャンプボタンに被らないよう右上固定
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
      badge.style.top = "10px";
      badge.style.zIndex = "99999";
      badge.style.padding = "6px 10px";
      badge.style.borderRadius = "10px";
      badge.style.font = "700 12px system-ui";
      badge.style.color = "rgba(255,255,255,0.92)";
      badge.style.background = "rgba(0,0,0,0.35)";
      badge.style.backdropFilter = "blur(6px)";
      badge.style.pointerEvents = "none";

      const cs = getComputedStyle(host);
      if(cs.position === "static"){
        host.style.position = "relative";
      }
      host.appendChild(badge);
    }
    badge.textContent = VERSION;
  }catch(e){
    console.warn("attachVersionBadge failed:", e);
  }
}

/* =======================
   RESULT MODAL (DOM inject)
   - 全員分順位表（スクロール）
======================= */
let resultModal = document.getElementById("resultModal");
if(!resultModal){
  resultModal = document.createElement("div");
  resultModal.id = "resultModal";
  resultModal.innerHTML = `
    <div class="card">
      <div class="title" id="rmTitle">RESULT</div>
      <div class="meta" id="rmMeta">--</div>
      <div class="list" id="rmList"></div>
      <div class="actions">
        <button id="rmRetry">RETRY</button>
        <button id="rmNext" class="primary">NEXT</button>
      </div>
    </div>
  `;
  document.body.appendChild(resultModal);
}
const rmTitle = document.getElementById("rmTitle");
const rmMeta  = document.getElementById("rmMeta");
const rmList  = document.getElementById("rmList");
const rmRetry = document.getElementById("rmRetry");
const rmNext  = document.getElementById("rmNext");

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

// ITEMは将来用（無効）
if(btnJumpBoost){
  btnJumpBoost.disabled = true;
  btnJumpBoost.style.opacity = "0.55";
}

/* =======================
   STATE skeleton (PART2で埋める)
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
  rankText:"RANK --/--"
};

// PART2以降で関数・world・ループを定義していく

function setTopSub(text){
  if(topSub) topSub.textContent = text;
}
function setTopRight(text){
  if(topRight) topRight.textContent = text;
}
function setStockUI(v){
  const pct = clamp(v / CONFIG.STOCK_MAX, 0, 1) * 100;
  if(stockBar) stockBar.style.setProperty("--w", pct + "%");
  if(stockBar) stockBar.style.setProperty("width", "100%");
  // 疑似バー（::before）に反映
  if(stockBar) stockBar.style.setProperty("--pct", pct + "%");
  if(stockBar) stockBar.style.setProperty("position","relative");
  stockBar.style.setProperty("--pct", pct + "%");
  stockBar.style.setProperty("--pct2", pct + "%");
  stockBar.style.setProperty("--pct3", pct + "%");
  stockBar.style.setProperty("--pct4", pct + "%");
  // CSSの::beforeは幅0%固定なので、後でJSで直接更新する（PART2）
}

/* PART2 START MARKER */
window.__MOB_PART1__ = true;

async function bootPart1(){
  try{
    state.phase = "loading";
    if(overlay) overlay.style.display = "flex";
    if(overlayTitle) overlayTitle.textContent = "Loading";
    if(overlayMsg) overlayMsg.textContent = "assets";

    fitCanvasToPlayArea();
    resizeCanvas();
    attachVersionBadge();

    await loadAssets();

    if(overlay) overlay.style.display = "none";

    // PART2で initRace/loop を開始する
    setTopSub("Ready");
    setTopRight("RANK --/--");
  }catch(e){
    if(overlay){
      overlay.style.display = "flex";
      if(overlayTitle) overlayTitle.textContent = "Error";
      if(overlayMsg) overlayMsg.textContent = String(e);
    }
    console.error(e);
  }
}

fitCanvasToPlayArea();
resizeCanvas();
attachVersionBadge();
window.addEventListener("resize", ()=>{
  fitCanvasToPlayArea();
  resizeCanvas();
  attachVersionBadge();
});

bootPart1();

})();
/* =========================
   PART 2 / 5
   WORLD / SPAWN / RUNNERS / RACE INIT
========================= */

// ===== RUNNER FACTORY =====
function createRunner(name, isPlayer, winRate){
  return {
    name, isPlayer, winRate,

    x:0, y:0, vy:0,
    w:CONFIG.PLAYER_SIZE,
    h:CONFIG.PLAYER_SIZE,

    onGround:true,
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

    aiCd: rand(0.25,0.55),
    aiBoostCd: rand(0, CONFIG.AI_BOOST_COOLDOWN)
  };
}

// ===== GHOST DATA =====
const NAMED_GHOSTS = [
  {name:"フレンチ",wr:0.60},
  {name:"レッド",wr:0.70},
  {name:"レッドブルー",wr:0.90},
  {name:"ブラック",wr:0.85},
  {name:"ホワイト",wr:0.75}
];
const LETTERS = "ABCDEFGHIJKLMNOPQRST".split("");

// ===== WORLD =====
const world = {
  groundY:0,
  groundH:0,

  rails:[],
  pipes:[],
  puddles:[],
  rings:[],
  ors:[],
  dans:[],

  occupied:[], // {x0,x1,type}

  nextRailX:0,
  nextPipeX:0,
  nextPuddleX:0,
  nextRingX:0,
  nextOrX:0,
  nextDanX:0
};

function resetGround(){
  world.groundH = 72;
  const lift = 56;
  world.groundY = (CONFIG.LOGICAL_H - world.groundH) - lift;
  world.groundY = Math.max(220, world.groundY);
}

function resetWorld(){
  world.rails.length = 0;
  world.pipes.length = 0;
  world.puddles.length = 0;
  world.rings.length = 0;
  world.ors.length = 0;
  world.dans.length = 0;
  world.occupied.length = 0;

  world.nextRailX = 240;
  world.nextPipeX = 820;
  world.nextPuddleX = 360;
  world.nextRingX = 240;
  world.nextOrX = 900;
  world.nextDanX = 880;
}

// ===== OCCUPIED RANGE =====
function reserve(x0, x1, type){
  world.occupied.push({x0,x1,type});
}
function isFree(x0, x1){
  for(const o of world.occupied){
    if(!(x1 < o.x0 || x0 > o.x1)) return false;
  }
  return true;
}
function findFreeX(x, w){
  let t = 0;
  while(!isFree(x, x+w) && t < 12){
    x += w + 40;
    t++;
  }
  return x;
}

// ===== ADD OBJECTS =====
function addRail(x){
  const img = IMAGES.rail;
  if(!img) return;
  const h = Math.floor(world.groundH * 0.62);
  const s = h / img.height;
  const w = Math.floor(img.width * s);

  x = findFreeX(x, w);
  world.rails.push({x, y:world.groundY-h, w, h});
  reserve(x, x+w, "rail");
}

function addPipe(x){
  const img = Math.random()<0.5 ? IMAGES.hpr : IMAGES.hpg;
  if(!img) return;
  const h = Math.floor(world.groundH * CONFIG.PIPE_H_RATIO);
  const s = h / img.height;
  const w = Math.floor(img.width * s * CONFIG.PIPE_W_SCALE);

  x = findFreeX(x, w);
  world.pipes.push({x, y:world.groundY-h, w, h, img});
  reserve(x, x+w, "pipe");
}

function addPuddle(x){
  const w = rand(36,56);
  x = findFreeX(x, w);
  world.puddles.push({x, y:world.groundY-6, w, h:6});
  reserve(x, x+w, "puddle");
}

function addRing(x){
  const air = Math.random()<0.5;
  const y = air ? world.groundY - rand(80,140) : world.groundY - 28;
  world.rings.push({x, y, r:8, taken:false});
}

function addOr(x){
  const img = IMAGES.or;
  if(!img) return;
  const h = Math.floor(world.groundH * 0.6);
  const s = h / img.height;
  const w = Math.floor(img.width * s);

  x = findFreeX(x, w);
  world.ors.push({x, y:world.groundY-h, w, h});
  reserve(x, x+w, "or");
}

function addDan(x){
  const img = IMAGES.dan;
  if(!img) return;
  const h = Math.floor(world.groundH * 0.55);
  const s = h / img.height;
  const w = Math.floor(img.width * s * 1.4);

  x = findFreeX(x, w);
  world.dans.push({x, y:world.groundY-h, w, h});
  reserve(x, x+w, "dan");
}

// ===== SPAWN WORLD =====
function spawnWorld(camX){
  const edge = camX + CONFIG.LOGICAL_W;

  if(edge > world.nextRailX){
    addRail(world.nextRailX);
    world.nextRailX += rand(CONFIG.SPAWN.RAIL_MIN, CONFIG.SPAWN.RAIL_MAX);
  }
  if(edge > world.nextPipeX){
    addPipe(world.nextPipeX);
    world.nextPipeX += rand(CONFIG.SPAWN.PIPE_MIN, CONFIG.SPAWN.PIPE_MAX);
  }
  if(edge > world.nextPuddleX){
    addPuddle(world.nextPuddleX);
    world.nextPuddleX += rand(CONFIG.SPAWN.PUDDLE_MIN, CONFIG.SPAWN.PUDDLE_MAX);
  }
  if(edge > world.nextRingX){
    addRing(world.nextRingX);
    world.nextRingX += rand(CONFIG.SPAWN.RING_MIN, CONFIG.SPAWN.RING_MAX);
  }
  if(edge > world.nextOrX){
    addOr(world.nextOrX);
    world.nextOrX += rand(CONFIG.SPAWN.OR_MIN, CONFIG.SPAWN.OR_MAX);
  }
  if(edge > world.nextDanX){
    addDan(world.nextDanX);
    world.nextDanX += rand(CONFIG.SPAWN.DAN_MIN, CONFIG.SPAWN.DAN_MAX);
  }
}

// ===== RACE INIT =====
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

  resetWorld();
  resetGround();

  for(const r of state.runners){
    r.x = 0;
    r.y = world.groundY - r.h;
    r.vy = 0;
    r.onGround = true;
    r.onPipe = false;
    r.pipeRef = null;
    r.pipeT = 0;
  }

  state.stock = CONFIG.STOCK_START;
  state.stockTimer = 0;
  state.countdown = 3;
  state.phase = "countdown";

  spawnWorld(0);
  setTopSub(`RACE ${race.name}`);
  setTopRight(`RANK --/${state.runners.length}`);
}

// ===== RANK =====
function updateRank(){
  const p = state.runners[state.playerIndex];
  let better = 0;
  for(const r of state.runners){
    if(r!==p && r.x > p.x) better++;
  }
  state.rank = better + 1;
  state.rankText = `RANK ${state.rank}/${state.runners.length}`;
  setTopRight(state.rankText);
}

/* PART 3 START MARKER */
window.__MOB_PART2__ = true;
/* =========================
   PART 3 / 5
   PHYSICS / COLLISION / GIMMICKS
========================= */

// ===== UTILS =====
function rectHit(ax,ay,aw,ah,bx,by,bw,bh){
  return ax < bx + bw && ax + aw > bx &&
         ay < by + bh && ay + ah > by;
}

// ===== ACTIONS =====
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

// ===== UPDATE RUN =====
function updateRun(dt){
  const race = CONFIG.RACES[state.raceIndex];
  const player = state.runners[state.playerIndex];

  // camera
  state.cameraX = Math.max(0, player.x - Math.floor(CONFIG.LOGICAL_W * 0.18));
  spawnWorld(state.cameraX);

  // player stock regen
  state.stockTimer += dt;
  if(state.stockTimer >= CONFIG.STOCK_REGEN){
    state.stockTimer = 0;
    state.stock = Math.min(CONFIG.STOCK_MAX, state.stock + 1);
  }

  for(const r of state.runners){
    if(r.finished) continue;

    /* ===== AI ===== */
    if(!r.isPlayer){
      r.aiCd -= dt;
      r.aiBoostCd -= dt;

      if(r.aiCd <= 0){
        r.aiCd = rand(0.25, 0.55);
        const jumpChance = (r.winRate > 0.30) ? 0.055 : 0.015;
        if(Math.random() < jumpChance) doJump(r);
      }
      if(r.aiBoostCd <= 0 && Math.random() < r.winRate * 0.12){
        r.aiBoostCd = CONFIG.AI_BOOST_COOLDOWN;
        startBoost(r, CONFIG.BOOST_ADD, CONFIG.BOOST_TIME);
      }
    }

    /* ===== INPUT ===== */
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

    /* ===== SPEED ===== */
    let speed = CONFIG.BASE_SPEED;

    if(r.boostTimer > 0){
      r.boostTimer -= dt;
      speed += r.boostPower;
    }
    if(r.slowTimer > 0){
      r.slowTimer -= dt;
      speed *= 0.75;
    }

    /* ===== PIPE (half pipe) ===== */
    if(r.onPipe && r.pipeRef){
      r.pipeT = clamp((r.x - r.pipeRef.x) / r.pipeRef.w, 0, 1);
      const angle = Math.PI * r.pipeT;
      const lift = Math.sin(angle);

      r.y = r.pipeRef.y + r.pipeRef.h - lift * r.pipeRef.h - r.h;
      speed += lift * 160;

      if(r.pipeT >= 1){
        r.onPipe = false;
        r.pipeRef = null;
        r.onGround = true;
        r.vy = 0;
        r.jumps = 0;
        r.y = world.groundY - r.h;
      }
    }else{
      // gravity
      r.vy += CONFIG.GRAVITY * dt;
      r.vy = Math.min(r.vy, CONFIG.MAX_FALL_V);
      r.y += r.vy * dt;
    }

    /* ===== MOVE X ===== */
    r.x += speed * dt;

    /* ===== GROUND ===== */
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

    /* ===== RAIL ===== */
    if(!r.onPipe){
      for(const rail of world.rails){
        if(rectHit(r.x, r.y, r.w, r.h, rail.x, rail.y, rail.w, rail.h)){
          if(r.vy >= 0 && (r.y + r.h - r.vy*dt) <= rail.y + 2){
            r.y = rail.y - r.h;
            r.vy = 0;
            r.onGround = true;
            r.boostPower = Math.max(r.boostPower, 60);
            r.boostTimer = Math.max(r.boostTimer, 0.15);
          }
        }
      }
    }

    /* ===== PIPE ENTER ===== */
    if(!r.onPipe){
      for(const pipe of world.pipes){
        if(rectHit(r.x, r.y, r.w, r.h, pipe.x, pipe.y, pipe.w, pipe.h)){
          if(r.vy >= 0 && (r.y + r.h - r.vy*dt) <= pipe.y + 2){
            r.onPipe = true;
            r.pipeRef = pipe;
            r.pipeT = 0;
            r.vy = 0;
            r.onGround = false;
          }
        }
      }
    }

    /* ===== OR GIMMICK ===== */
    for(const o of world.ors){
      if(rectHit(r.x, r.y, r.w, r.h, o.x, o.y, o.w, o.h)){
        // 上から着地
        if(r.vy >= 0 && (r.y + r.h - r.vy*dt) <= o.y + 2){
          r.y = o.y - r.h;
          r.vy = 0;
          r.onGround = true;
        }else{
          // 正面衝突 → ノックバック
          r.x -= CONFIG.OR_KNOCKBACK_X;
          r.slowTimer = Math.max(r.slowTimer, CONFIG.OR_SLOW_TIME);
        }
      }
    }

    /* ===== DAN GIMMICK (always ride) ===== */
    let onDan = false;
    for(const d of world.dans){
      if(r.x + r.w > d.x && r.x < d.x + d.w){
        const rel = (r.x + r.w/2 - d.x) / d.w;
        if(rel >= 0 && rel <= 1){
          const flat = CONFIG.DAN_FLAT_RATIO;
          let surfY = d.y + d.h - r.h;

          if(rel < (1-flat)/2){
            const t = rel / ((1-flat)/2);
            surfY = d.y + d.h - r.h - t * d.h;
          }else if(rel > (1+flat)/2){
            const t = (rel - (1+flat)/2) / ((1-flat)/2);
            surfY = d.y + d.h - r.h - (1-t) * d.h;
          }

          if(r.y + r.h >= surfY - CONFIG.DAN_SNAP_EPS){
            r.y = surfY;
            r.vy = 0;
            r.onGround = true;
            onDan = true;
            speed += CONFIG.DAN_ACCEL;
          }
        }
      }
    }

    /* ===== PUDDLE ===== */
    for(const p of world.puddles){
      if(rectHit(r.x, r.y, r.w, r.h, p.x, p.y, p.w, p.h)){
        r.slowTimer = 0.4;
      }
    }

    /* ===== RING ===== */
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

    /* ===== FINISH ===== */
    if(!r.finished && (r.x / CONFIG.PX_PER_M) >= race.goal){
      r.finished = true;
      r.finishTime = state.time;
      state.finishedCount++;
    }
  }

  state.time += dt;
  updateRank();

  if(state.finishedCount >= race.survive){
    showResult();
  }
}

/* PART 4 START MARKER */
window.__MOB_PART3__ = true;
/* =========================
   PART 4 / 5
   RENDER / DRAW / TOP8
========================= */

/* ===== DRAW BASE (cover + bottom align) ===== */
function beginDraw(){
  const cw = canvas.width;
  const ch = canvas.height;

  const sx = cw / CONFIG.LOGICAL_W;
  const sy = ch / CONFIG.LOGICAL_H;
  const s  = Math.max(sx, sy); // cover

  const drawW = CONFIG.LOGICAL_W * s;
  const drawH = CONFIG.LOGICAL_H * s;

  const ox = (cw - drawW) * 0.5;
  const oy = (ch - drawH); // bottom-align

  ctx.setTransform(1,0,0,1,0,0);
  ctx.fillStyle = "#163d7a";
  ctx.fillRect(0,0,cw,ch);

  ctx.setTransform(s,0,0,s,ox,oy);
  ctx.imageSmoothingEnabled = false;
}

/* ===== BACKGROUND ===== */
function drawSky(){
  const g = ctx.createLinearGradient(0, 0, 0, CONFIG.LOGICAL_H);
  g.addColorStop(0, "#2a6ccf");
  g.addColorStop(0.6, "#163d7a");
  g.addColorStop(1, "#071727");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, CONFIG.LOGICAL_W, CONFIG.LOGICAL_H);
}

/* ===== STAGE ===== */
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

/* ===== OBJECTS ===== */
function drawObjects(){
  // puddles
  ctx.fillStyle = "rgba(120,190,255,0.5)";
  for(const p of world.puddles){
    const sx = p.x - state.cameraX;
    if(sx < -80 || sx > CONFIG.LOGICAL_W + 80) continue;
    ctx.fillRect(sx, p.y, p.w, p.h);
  }

  // rings
  const ringImg = IMAGES.ring;
  if(ringImg){
    for(const r of world.rings){
      if(r.taken) continue;
      const sx = r.x - state.cameraX;
      if(sx < -60 || sx > CONFIG.LOGICAL_W + 60) continue;
      ctx.drawImage(ringImg, sx - 10, r.y - 10, 20, 20);
    }
  }

  // OR
  const orImg = IMAGES.or;
  if(orImg){
    for(const o of world.ors){
      const sx = o.x - state.cameraX;
      if(sx < -200 || sx > CONFIG.LOGICAL_W + 200) continue;
      ctx.drawImage(orImg, sx, o.y, o.w, o.h);
    }
  }

  // DAN
  const danImg = IMAGES.dan;
  if(danImg){
    for(const d of world.dans){
      const sx = d.x - state.cameraX;
      if(sx < -220 || sx > CONFIG.LOGICAL_W + 220) continue;
      ctx.drawImage(danImg, sx, d.y, d.w, d.h);
    }
  }

  // pipes
  for(const p of world.pipes){
    const sx = p.x - state.cameraX;
    if(sx < -240 || sx > CONFIG.LOGICAL_W + 240) continue;
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

/* ===== RUNNERS ===== */
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

  // body
  const body = (r.onGround || r.onPipe) ? IMAGES.pl1 : IMAGES.pl2;
  if(body){
    ctx.drawImage(body, sx, r.y, r.w, r.h);
  }

  // label
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

/* ===== TOP8 (DOM) ===== */
function updateTop8(){
  if(!top8El) return;
  const list = [...state.runners]
    .slice()
    .sort((a,b)=>b.x - a.x)
    .slice(0,8);

  let html = `<div class="h">TOP 8</div>`;
  list.forEach((r,i)=>{
    const me = r.isPlayer ? " me" : "";
    const d = Math.floor(r.x / CONFIG.PX_PER_M);
    html += `<div class="row${me}"><span>${i+1}. ${r.name}</span><span>${d}m</span></div>`;
  });
  top8El.innerHTML = html;
}

/* ===== COUNTDOWN DRAW ===== */
function drawCountdown(){
  ctx.fillStyle = "rgba(0,0,0,0.15)";
  ctx.fillRect(0,0,CONFIG.LOGICAL_W,CONFIG.LOGICAL_H);
  ctx.fillStyle = "#fff";
  ctx.font = "bold 64px system-ui";
  ctx.textAlign = "center";
  ctx.fillText(Math.ceil(state.countdown), CONFIG.LOGICAL_W/2, CONFIG.LOGICAL_H/2);
  ctx.textAlign = "left";
}

/* ===== RENDER ===== */
function render(){
  beginDraw();

  drawSky();
  drawStage();
  drawObjects();

  for(const r of state.runners){
    if(!r.isPlayer && r.winRate > 0.30) drawRunner(r);
  }
  drawRunner(state.runners[state.playerIndex]);

  if(state.phase === "countdown") drawCountdown();
}

/* ===== UPDATE (hook TOP8 & stock UI) ===== */
const _update = update;
update = function(dt){
  _update(dt);
  updateTop8();
  // stock bar
  const pct = clamp(state.stock / CONFIG.STOCK_MAX, 0, 1) * 100;
  if(stockBar){
    stockBar.style.setProperty("--pct", pct + "%");
    stockBar.querySelector?.("::before");
    stockBar.style.setProperty("--w", pct + "%");
    stockBar.style.setProperty("background", "rgba(255,255,255,0.12)");
    stockBar.style.setProperty("position","relative");
    stockBar.style.setProperty("--pct", pct + "%");
    stockBar.style.setProperty("--pct2", pct + "%");
    stockBar.style.setProperty("--pct3", pct + "%");
    stockBar.style.setProperty("--pct4", pct + "%");
    stockBar.style.setProperty("--pct5", pct + "%");
    stockBar.style.setProperty("--pct6", pct + "%");
    stockBar.style.setProperty("--pct7", pct + "%");
    stockBar.style.setProperty("--pct8", pct + "%");
    stockBar.style.setProperty("--pct9", pct + "%");
    stockBar.style.setProperty("--pct10", pct + "%");
    stockBar.style.setProperty("--pct11", pct + "%");
    stockBar.style.setProperty("--pct12", pct + "%");
    stockBar.style.setProperty("--pct13", pct + "%");
    stockBar.style.setProperty("--pct14", pct + "%");
    stockBar.style.setProperty("--pct15", pct + "%");
    stockBar.style.setProperty("--pct16", pct + "%");
    stockBar.style.setProperty("--pct17", pct + "%");
    stockBar.style.setProperty("--pct18", pct + "%");
    stockBar.style.setProperty("--pct19", pct + "%");
    stockBar.style.setProperty("--pct20", pct + "%");
    stockBar.style.setProperty("--pct21", pct + "%");
    stockBar.style.setProperty("--pct22", pct + "%");
    stockBar.style.setProperty("--pct23", pct + "%");
    stockBar.style.setProperty("--pct24", pct + "%");
    stockBar.style.setProperty("--pct25", pct + "%");
    stockBar.style.setProperty("--pct26", pct + "%");
    stockBar.style.setProperty("--pct27", pct + "%");
    stockBar.style.setProperty("--pct28", pct + "%");
    stockBar.style.setProperty("--pct29", pct + "%");
    stockBar.style.setProperty("--pct30", pct + "%");
    stockBar.style.setProperty("--pct31", pct + "%");
    stockBar.style.setProperty("--pct32", pct + "%");
    stockBar.style.setProperty("--pct33", pct + "%");
    stockBar.style.setProperty("--pct34", pct + "%");
    stockBar.style.setProperty("--pct35", pct + "%");
    stockBar.style.setProperty("--pct36", pct + "%");
    stockBar.style.setProperty("--pct37", pct + "%");
    stockBar.style.setProperty("--pct38", pct + "%");
    stockBar.style.setProperty("--pct39", pct + "%");
    stockBar.style.setProperty("--pct40", pct + "%");
    stockBar.style.setProperty("--pct41", pct + "%");
    stockBar.style.setProperty("--pct42", pct + "%");
    stockBar.style.setProperty("--pct43", pct + "%");
    stockBar.style.setProperty("--pct44", pct + "%");
    stockBar.style.setProperty("--pct45", pct + "%");
    stockBar.style.setProperty("--pct46", pct + "%");
    stockBar.style.setProperty("--pct47", pct + "%");
    stockBar.style.setProperty("--pct48", pct + "%");
    stockBar.style.setProperty("--pct49", pct + "%");
    stockBar.style.setProperty("--pct50", pct + "%");
  }
}

/* PART 5 START MARKER */
window.__MOB_PART4__ = true;
/* =========================
   PART 5 / 5
   LOOP / COUNTDOWN / RESULT MODAL / STOCK BAR FIX / BOOT
========================= */

/* ===== STOCK BAR FIX (DOM fill) ===== */
let stockFill = document.getElementById("stockFill");
if(!stockFill && stockBar){
  stockFill = document.createElement("div");
  stockFill.id = "stockFill";
  stockFill.style.position = "absolute";
  stockFill.style.left = "0";
  stockFill.style.top = "0";
  stockFill.style.bottom = "0";
  stockFill.style.width = "0%";
  stockFill.style.borderRadius = "999px";
  stockFill.style.background = "rgba(0,255,204,0.9)";
  stockBar.style.position = "relative";
  stockBar.appendChild(stockFill);
}
function updateStockBar(){
  if(!stockFill) return;
  const pct = clamp(state.stock / CONFIG.STOCK_MAX, 0, 1) * 100;
  stockFill.style.width = pct.toFixed(1) + "%";
}

/* ===== COUNTDOWN ===== */
function updateCountdown(dt){
  state.countdown -= dt;
  if(state.countdown <= 0){
    state.phase = "run";
  }
}

/* ===== RESULT MODAL ===== */
function hideResult(){
  if(resultModal) resultModal.style.display = "none";
}
function showResult(){
  // 二重呼び出し防止
  if(state.phase === "result") return;

  state.phase = "result";
  updateRank();
  updateTop8();
  updateStockBar();

  const race = CONFIG.RACES[state.raceIndex];
  const list = [...state.runners].sort((a,b)=>a.finishTime - b.finishTime);

  // 自分の順位
  const me = state.runners[state.playerIndex];
  let myRank = list.findIndex(r=>r===me) + 1;
  if(myRank <= 0) myRank = state.rank;

  if(rmTitle) rmTitle.textContent = `RESULT - ${race.name}`;
  if(rmMeta) rmMeta.textContent = `GOAL ${race.goal}m  /  YOUR RANK ${myRank}/${state.runners.length}`;

  if(rmList){
    let html = "";
    for(let i=0;i<list.length;i++){
      const r = list[i];
      const t = isFinite(r.finishTime) ? `${r.finishTime.toFixed(2)}s` : "--";
      const cls = r.isPlayer ? "item me" : "item";
      html += `<div class="${cls}"><span>${i+1}. ${r.name}</span><span>${t}</span></div>`;
    }
    rmList.innerHTML = html;
    rmList.scrollTop = 0;
  }

  if(resultModal) resultModal.style.display = "flex";
}

/* ===== BUTTONS ===== */
rmRetry?.addEventListener("pointerdown", ()=>{
  hideResult();
  initRace(state.raceIndex);
});
rmNext?.addEventListener("pointerdown", ()=>{
  hideResult();
  const nextIdx = (state.raceIndex < CONFIG.RACES.length - 1) ? (state.raceIndex + 1) : 0;
  initRace(nextIdx);
});

/* ===== UPDATE (override cleanly) ===== */
const __updateCore = update;
update = function(dt){
  if(state.phase === "countdown"){
    updateCountdown(dt);
    updateRank();
  }else if(state.phase === "run"){
    updateRun(dt);
  }else{
    // result: stop simulation
  }

  // UI updates
  updateTop8();
  updateStockBar();

  const me = state.runners[state.playerIndex];
  const dist = me ? Math.floor(me.x / CONFIG.PX_PER_M) : 0;
  const race = CONFIG.RACES[state.raceIndex];
  setTopSub(`RACE ${race.name}  /  ${dist}m / ${race.goal}m`);
};

/* ===== LOOP ===== */
function loop(t){
  const dt = Math.min((t - state.lastTime) / 1000, 0.033);
  state.lastTime = t;

  if(state.phase !== "loading"){
    update(dt);
  }
  render();

  requestAnimationFrame(loop);
}

/* ===== BOOT START (after assets loaded in PART1) ===== */
function startWhenReady(){
  // assets loaded?
  if(!IMAGES.stage || !IMAGES.pl1 || !IMAGES.board){
    setTimeout(startWhenReady, 50);
    return;
  }
  initRace(0);
  state.lastTime = performance.now();
  state.phase = "countdown";
  requestAnimationFrame(loop);
}
startWhenReady();

/* END */
window.__MOB_PART5__ = true;
