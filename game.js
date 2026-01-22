// =========================
// MOB STREET - 1P RUN
// v6.4.1 (PART 1/5)
// - Config / Assets / UI inject
// =========================
(() => {
"use strict";

const VERSION = "v6.4.1";

/* =======================
   DOM
======================= */
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d", { alpha:false });

const overlay = document.getElementById("overlay");
const overlayTitle = document.getElementById("overlayTitle");
const overlayMsg = document.getElementById("overlayMsg");

const btnJump  = document.getElementById("btnJump");
const btnBoost = document.getElementById("btnBoost");
const btnItem  = document.getElementById("btnJumpBoost"); // 今は無効

/* =======================
   MOBILE LOCK
======================= */
(function lockMobile(){
  const prevent = e => e.preventDefault();
  ["dblclick","contextmenu","gesturestart","gesturechange","gestureend"]
    .forEach(ev=>document.addEventListener(ev, prevent, {passive:false}));
  window.addEventListener("touchmove", prevent, {passive:false});
  document.documentElement.style.webkitUserSelect = "none";
  document.documentElement.style.userSelect = "none";
})();

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

  // ring
  RING_NEED: 10,
  RING_BOOST_ADD: 110,
  RING_BOOST_TIME: 0.55,

  // stock
  STOCK_MAX: 5,
  STOCK_REGEN: 5.0,
  STOCK_START: 0,

  // AI
  AI_BOOST_COOLDOWN: 5.0,

  // spawn（サイズ調整は PART2）
  SPAWN: {
    NO_OVERLAP_X: 260,
    RAIL_MIN: 420, RAIL_MAX: 720,
    PIPE_MIN: 900, PIPE_MAX: 1400,
    PUDDLE_MIN: 520, PUDDLE_MAX: 820,
    RING_MIN: 170, RING_MAX: 260,
    OR_MIN: 900, OR_MAX: 1500,
    DAN_MIN: 820, DAN_MAX: 1300
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
  pl1:"PL1.png",
  pl2:"PL2.png",
  board:"redsk.png",
  stage:"st.png",
  rail:"gardw.png",
  hpr:"hpr.png",
  hpg:"hpg.png",
  ring:"ringtap.png",
  or:"or.png",
  dan:"dan.png"
};
const IMAGES = {};

function loadImage(src){
  return new Promise((res,rej)=>{
    const img = new Image();
    img.onload = ()=>res(img);
    img.onerror = ()=>rej(new Error("Failed to load: "+src));
    img.src = src;
  });
}
async function loadAssets(){
  for(const k in ASSETS){
    overlayTitle && (overlayTitle.textContent="Loading");
    overlayMsg   && (overlayMsg.textContent=ASSETS[k]);
    IMAGES[k] = await loadImage(ASSETS[k]);
  }
}

/* =======================
   UI: Version badge (JS only)
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
      badge.style.position="absolute";
      badge.style.right="12px";
      badge.style.bottom="12px";
      badge.style.zIndex="99999";
      badge.style.padding="6px 10px";
      badge.style.borderRadius="10px";
      badge.style.font="800 12px system-ui";
      badge.style.color="rgba(255,255,255,0.92)";
      badge.style.background="rgba(0,0,0,0.35)";
      badge.style.backdropFilter="blur(6px)";
      badge.style.pointerEvents="none";
      const cs = getComputedStyle(host);
      if(cs.position==="static") host.style.position="relative";
      host.appendChild(badge);
    }
    badge.textContent = VERSION;
  }catch(_){}
}

/* =======================
   PLAY AREA FIT (stable)
======================= */
function fitCanvasToPlayArea(){
  let top=null;
  const rects=[];
  btnJump && rects.push(btnJump.getBoundingClientRect());
  btnBoost&& rects.push(btnBoost.getBoundingClientRect());
  btnItem && rects.push(btnItem.getBoundingClientRect());
  for(const r of rects){
    if(r && r.top>0) top = (top===null)? r.top : Math.min(top, r.top);
  }
  if(top===null) top = Math.floor(window.innerHeight*0.65);
  const playH = Math.max(260, Math.floor(top-6));
  canvas.style.width="100%";
  canvas.style.height=playH+"px";
  canvas.style.display="block";
}

function resizeCanvas(){
  const dpr = Math.min(2, window.devicePixelRatio||1);
  const r = canvas.getBoundingClientRect();
  const w = Math.max(1, Math.floor(r.width));
  const h = Math.max(1, Math.floor(r.height));
  canvas.width  = Math.max(1, Math.floor(w*dpr));
  canvas.height = Math.max(1, Math.floor(h*dpr));
  ctx.setTransform(dpr,0,0,dpr,0,0);
}

/* =======================
   INPUT
======================= */
const input = { jump:false, boost:false };
btnJump && btnJump.addEventListener("pointerdown", ()=>input.jump=true);
btnBoost&& btnBoost.addEventListener("pointerdown", ()=>input.boost=true);
window.addEventListener("keydown", e=>{
  if(e.key===" ") input.jump=true;
  if(e.key==="b") input.boost=true;
});
// ITEM disabled
if(btnItem){
  btnItem.style.opacity="0.35";
  btnItem.style.filter="grayscale(0.7)";
  btnItem.style.pointerEvents="none";
}

/* =======================
   STATE (skeleton)
======================= */
const state = {
  phase:"loading",
  raceIndex:0,
  time:0, lastTime:0,
  stock:CONFIG.STOCK_START, stockTimer:0,
  cameraX:0,
  runners:[], playerIndex:0,
  countdown:3, finishedCount:0,
  rank:1, rankText:"",
  top8Text:""
};

// ----- expose to next parts -----
window.__MOB__ = {
  VERSION, CONFIG, ASSETS, IMAGES,
  canvas, ctx,
  overlay, overlayTitle, overlayMsg,
  btnJump, btnBoost, btnItem,
  input, state,
  clamp, rand,
  loadAssets, attachVersionBadge,
  fitCanvasToPlayArea, resizeCanvas
};
})();
// =========================
// MOB STREET - 1P RUN
// v6.4.1 (PART 2/5)
// - World / Spawn / Add objects (SIZE TUNING)
// =========================
(() => {
"use strict";
const M = window.__MOB__;
if(!M) throw new Error("PART1 not loaded");

const { CONFIG, IMAGES, rand, clamp, state } = M;

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

  ors: [],
  dans: [],

  nextRailX: 320,
  nextPipeX: 900,
  nextPuddleX: 620,
  nextRingX: 220,
  nextOrX: 980,
  nextDanX: 860
};

function resetWorldForRace(){
  world.rails.length = 0;
  world.pipes.length = 0;
  world.puddles.length = 0;
  world.rings.length = 0;
  world.ors.length = 0;
  world.dans.length = 0;

  world.nextRailX = 320;
  world.nextPipeX = 900;
  world.nextPuddleX = 620;
  world.nextRingX = 220;
  world.nextOrX = 980;
  world.nextDanX = 860;
}

function resetGround(){
  world.groundH = 72;
  const lift = 56;
  world.groundY = (CONFIG.LOGICAL_H - world.groundH) - lift;
  world.groundY = Math.max(240, world.groundY);
}

/* =======================
   SPAWN HELPERS
======================= */
function isTooClose(x){
  const min = CONFIG.SPAWN.NO_OVERLAP_X;
  const check = (arr)=>arr.some(o=>Math.abs(o.x - x) < min);
  return check(world.rails) || check(world.pipes) || check(world.puddles) || check(world.ors) || check(world.dans);
}

function spawnWorld(camX){
  const edge = camX + CONFIG.LOGICAL_W;

  // ガードレール（少なめ）
  if(edge > world.nextRailX){
    const x = world.nextRailX;
    if(!isTooClose(x)) addRail(x);
    world.nextRailX += rand(CONFIG.SPAWN.RAIL_MIN, CONFIG.SPAWN.RAIL_MAX);
  }

  // ハーフパイプ（少なめ）
  if(edge > world.nextPipeX){
    const x = world.nextPipeX;
    if(!isTooClose(x)) addPipe(x);
    world.nextPipeX += rand(CONFIG.SPAWN.PIPE_MIN, CONFIG.SPAWN.PIPE_MAX);
  }

  // 水たまり（少なめ）
  if(edge > world.nextPuddleX){
    const x = world.nextPuddleX;
    if(!isTooClose(x)) addPuddle(x);
    world.nextPuddleX += rand(CONFIG.SPAWN.PUDDLE_MIN, CONFIG.SPAWN.PUDDLE_MAX);
  }

  // トラック or（少なめ）
  if(edge > world.nextOrX){
    const x = world.nextOrX;
    if(!isTooClose(x)) addOr(x);
    world.nextOrX += rand(CONFIG.SPAWN.OR_MIN, CONFIG.SPAWN.OR_MAX);
  }

  // dan（少なめ）
  if(edge > world.nextDanX){
    const x = world.nextDanX;
    if(!isTooClose(x)) addDan(x);
    world.nextDanX += rand(CONFIG.SPAWN.DAN_MIN, CONFIG.SPAWN.DAN_MAX);
  }

  // リング（頻度はやや高め。空中あり）
  if(edge > world.nextRingX){
    addRing(world.nextRingX);
    world.nextRingX += rand(CONFIG.SPAWN.RING_MIN, CONFIG.SPAWN.RING_MAX);
  }
}

/* =======================
   ADD OBJECTS (SIZE TUNING)
======================= */

// 1) ガードレール：短すぎ → 横を強制的に伸ばす（高さは低め維持）
function addRail(x){
  const img = IMAGES.rail;
  if(!img) return;

  const h = Math.floor(world.groundH * 0.55);     // 低め
  const scale = h / img.height;
  let w = Math.floor(img.width * scale);

  // ★横を伸ばす（ここが改善点）
  const railLenMul = 1.9; // 推奨（長いと感じたら 1.7、もっとなら 2.2）
  w = Math.floor(w * railLenMul);

  world.rails.push({
    x,
    y: world.groundY - h,
    w, h
  });
}

// 2) ハーフパイプ：小さすぎ → 高さ少しUP + 横かなりUP
function addPipe(x){
  const img = Math.random() < 0.5 ? IMAGES.hpr : IMAGES.hpg;
  if(!img) return;

  // ★高さも少し上げる
  const h = Math.floor(world.groundH * 0.78);
  const scale = h / img.height;
  let w = Math.floor(img.width * scale);

  // ★横を大きく（特に横）
  const pipeWideMul = 1.75; // 推奨
  w = Math.floor(w * pipeWideMul);

  world.pipes.push({
    x,
    y: world.groundY - h,
    w, h, img
  });
}

// 3) 水たまり：少し減速（サイズは控えめ）
function addPuddle(x){
  world.puddles.push({
    x,
    y: world.groundY - 8,
    w: rand(34, 54),
    h: 6
  });
}

// 4) リング：空中にも出る。見た目はプレイヤー取得で消す（takenBy set）
function addRing(x){
  const air = Math.random() < 0.55;
  const y = air ? world.groundY - rand(78, 150) : world.groundY - 28;

  world.rings.push({
    x,
    y,
    r: 8,
    takenBy: new Set()
  });
}

// 5) トラック or：小さすぎ → 横を大きく。弾きは削除予定（PART3で判定統一）
function addOr(x){
  const img = IMAGES.or;
  if(!img) return;

  const h = Math.floor(world.groundH * 0.60);
  const scale = h / img.height;
  let w = Math.floor(img.width * scale);

  // ★横をかなり伸ばす（トラック感）
  const orWideMul = 2.05;  // 推奨（もっと欲しければ 2.2）
  w = Math.floor(w * orWideMul);

  world.ors.push({
    x,
    y: world.groundY - h,
    w, h,
    img
  });
}

// 6) dan：存在感UP（横/高さを少しだけ上げる）
function addDan(x){
  const img = IMAGES.dan;
  if(!img) return;

  const h = Math.floor(world.groundH * 0.78); // 少しだけUP
  const scale = h / img.height;
  let w = Math.floor(img.width * scale);

  // danは「必ず乗れる」ので、横を少しだけ大きく
  w = Math.floor(w * 1.18);

  const slopeW = w * 0.22; // 左右スロープ
  const topY   = world.groundY - h;

  world.dans.push({
    x,
    y: topY,
    w, h,
    img,
    slopeW
  });
}

// ---- expose to next parts ----
M.world = world;
M.resetWorldForRace = resetWorldForRace;
M.resetGround = resetGround;
M.spawnWorld = spawnWorld;

})();
// =========================
// MOB STREET - 1P RUN
// v6.4.1 (PART 3/5)
// - Runner / Race init / Physics + Collisions
// - IMPORTANT: or == rail (NO bounce)
// =========================
(() => {
"use strict";
const M = window.__MOB__;
if(!M || !M.world) throw new Error("PART1/2 not loaded");

const { CONFIG, state, input, rand, clamp } = M;
const world = M.world;

/* =======================
   RUNNER
======================= */
function createRunner(name,isPlayer,winRate){
  return {
    name, isPlayer, winRate,
    x:0, y:0, vy:0,
    w:CONFIG.PLAYER_SIZE, h:CONFIG.PLAYER_SIZE,
    onGround:true,

    // pipe
    onPipe:false,
    pipeRef:null,
    pipeT:0,

    // dan
    onDan:false,
    danRef:null,

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

const NAMED_GHOSTS = [
  {name:"フレンチ",wr:0.60},
  {name:"レッド",wr:0.70},
  {name:"レッドブルー",wr:0.90},
  {name:"ブラック",wr:0.85},
  {name:"ホワイト",wr:0.75}
];
const LETTERS = "ABCDEFGHIJKLMNOPQRST".split("");

function resetRunnersForRace(idx){
  const race = CONFIG.RACES[idx];
  state.runners.length = 0;

  // player
  state.runners.push(createRunner("YOU", true, 1.0));
  state.playerIndex = 0;

  // named ghosts
  for(const g of NAMED_GHOSTS) state.runners.push(createRunner(g.name,false,g.wr));
  // letters
  for(const l of LETTERS) state.runners.push(createRunner(l,false,0.30));

  // cut to start size
  state.runners = state.runners.slice(0, race.start);

  // init positions
  for(const r of state.runners){
    r.x=0;
    r.vy=0;
    r.onPipe=false; r.pipeRef=null; r.pipeT=0;
    r.onDan=false;  r.danRef=null;
    r.onGround=true;
    r.jumps=0;
    r.boostTimer=0; r.boostPower=0;
    r.slowTimer=0;
    r.rings=0;
    r.finished=false; r.finishTime=Infinity;
    r.aiCd = rand(0.20,0.55);
    r.aiBoostCd = rand(0.0, CONFIG.AI_BOOST_COOLDOWN);
    r.y = world.groundY - r.h;
  }
}

function initRace(idx){
  state.raceIndex = idx;
  state.time = 0;
  state.finishedCount = 0;
  state.stock = CONFIG.STOCK_START;
  state.stockTimer = 0;
  state.countdown = 3;
  state.phase = "countdown";

  M.resetWorldForRace();
  M.resetGround();
  resetRunnersForRace(idx);

  // first spawn chunk
  M.spawnWorld(0);

  // ensure on ground
  for(const r of state.runners){
    r.y = world.groundY - r.h;
    r.vy = 0;
    r.onGround = true;
  }
}

M.initRace = initRace;

/* =======================
   HELPERS
======================= */
function rectHit(ax,ay,aw,ah,bx,by,bw,bh){
  return ax < bx + bw && ax + aw > bx &&
         ay < by + bh && ay + ah > by;
}

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

/* =======================
   DAN SURFACE (slopes)
   - center top is flat
   - left/right are slopes so "絶対乗れる"
======================= */
function resolveDanSurface(r, dan){
  // r.x is world; compute runner center on X
  const cx = r.x + r.w * 0.5;
  const left = dan.x;
  const right = dan.x + dan.w;

  if(cx < left || cx > right) return null;

  // normalized t in [0,1]
  const t = clamp((cx - left) / dan.w, 0, 1);
  const slopeW = dan.slopeW;

  // yTop at center region
  const topY = dan.y;

  // left slope
  if(cx < left + slopeW){
    const k = (cx - left) / slopeW; // 0..1
    // from groundY (at left edge) up to topY (at slopeW)
    const y = (world.groundY) * (1 - k) + topY * k;
    return y;
  }
  // right slope
  if(cx > right - slopeW){
    const k = (right - cx) / slopeW; // 0..1
    const y = (world.groundY) * (1 - k) + topY * k;
    return y;
  }
  // flat top
  return topY;
}

/* =======================
   UPDATE RANK / TOP8
======================= */
function updateRankAndTop8(){
  const p = state.runners[state.playerIndex];
  let better = 0;
  for(const r of state.runners){
    if(r!==p && r.x > p.x) better++;
  }
  state.rank = better + 1;
  state.rankText = `RANK ${state.rank}/${state.runners.length}`;

  // full rank list text (for result) & top8 display
  const sorted = [...state.runners].sort((a,b)=>b.x-a.x);
  const top8 = sorted.slice(0,8);
  state.top8Text = top8.map((r,i)=>{
    const tag = r.isPlayer ? "YOU" : r.name;
    return `${i+1}.${tag}`;
  }).join("  ");
}

M.updateRankAndTop8 = updateRankAndTop8;

/* =======================
   UPDATE RUN (physics + collisions)
======================= */
function updateRun(dt){
  const race = CONFIG.RACES[state.raceIndex];
  const player = state.runners[state.playerIndex];

  // camera: player left-ish
  state.cameraX = Math.max(0, player.x - Math.floor(CONFIG.LOGICAL_W * 0.18));
  M.spawnWorld(state.cameraX);

  // stock regen
  state.stockTimer += dt;
  if(state.stockTimer >= CONFIG.STOCK_REGEN){
    state.stockTimer = 0;
    state.stock = Math.min(CONFIG.STOCK_MAX, state.stock + 1);
  }

  for(const r of state.runners){
    if(r.finished) continue;

    // AI decisions
    if(!r.isPlayer){
      r.aiCd -= dt;
      r.aiBoostCd -= dt;

      if(r.aiCd <= 0){
        r.aiCd = rand(0.25,0.55);

        // named ghosts jump more (to use rails/pipes/dan)
        const jumpChance = (r.winRate > 0.30) ? 0.070 : 0.018;
        if(Math.random() < jumpChance) doJump(r);
      }

      if(r.aiBoostCd <= 0 && Math.random() < r.winRate * 0.14){
        r.aiBoostCd = CONFIG.AI_BOOST_COOLDOWN;
        startBoost(r, CONFIG.BOOST_ADD, CONFIG.BOOST_TIME);
      }
    }

    // Player input
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

    // speed base
    let speed = CONFIG.BASE_SPEED;

    if(r.boostTimer > 0){
      r.boostTimer -= dt;
      speed += r.boostPower;
    }
    if(r.slowTimer > 0){
      r.slowTimer -= dt;
      speed *= 0.75;
    }

    // if on dan: slight accel
    if(r.onDan && r.danRef){
      speed += 80;
    }

    // pipe movement
    if(r.onPipe && r.pipeRef){
      r.pipeT = clamp((r.x - r.pipeRef.x) / r.pipeRef.w, 0, 1);
      const angle = Math.PI * r.pipeT;
      const lift = Math.sin(angle);

      // y along curve
      r.y = r.pipeRef.y + r.pipeRef.h - lift * r.pipeRef.h - r.h;

      // accel on slope
      speed += lift * 180;

      // leave at end
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

    // move X
    r.x += speed * dt;

    // ground resolve (if not on pipe)
    if(!r.onPipe){
      if(r.y + r.h >= world.groundY){
        r.y = world.groundY - r.h;
        r.vy = 0;
        r.onGround = true;
        r.jumps = 0;
        r.onDan = false;
        r.danRef = null;
      }else{
        r.onGround = false;
      }
    }

    // DAN: "always ride" with slopes (even without jump)
    if(!r.onPipe){
      let onAnyDan = false;
      for(const dan of world.dans){
        // broad phase
        if(r.x + r.w < dan.x || r.x > dan.x + dan.w) continue;

        const yTop = resolveDanSurface(r, dan);
        if(yTop === null) continue;

        // if runner is below/near surface, snap to it
        if(r.y + r.h >= yTop && r.y + r.h <= yTop + 18){
          r.y = yTop - r.h;
          r.vy = 0;
          r.onGround = true;
          r.jumps = 0;

          r.onDan = true;
          r.danRef = dan;
          onAnyDan = true;
        }
      }
      if(!onAnyDan){
        r.onDan = false;
        r.danRef = null;
      }
    }

    // RAIL: land from above only
    if(!r.onPipe){
      for(const rail of world.rails){
        if(rectHit(r.x, r.y, r.w, r.h, rail.x, rail.y, rail.w, rail.h)){
          // from above
          if(r.vy >= 0 && (r.y + r.h - r.vy * dt) <= rail.y + 2){
            r.y = rail.y - r.h;
            r.vy = 0;
            r.onGround = true;
            r.jumps = 0;

            // tiny accel
            r.boostPower = Math.max(r.boostPower, 60);
            r.boostTimer = Math.max(r.boostTimer, 0.18);
          }
        }
      }
    }

    // OR (track): IMPORTANT -> same as rail (NO bounce)
    if(!r.onPipe){
      for(const tr of world.ors){
        if(rectHit(r.x, r.y, r.w, r.h, tr.x, tr.y, tr.w, tr.h)){
          if(r.vy >= 0 && (r.y + r.h - r.vy * dt) <= tr.y + 2){
            r.y = tr.y - r.h;
            r.vy = 0;
            r.onGround = true;
            r.jumps = 0;

            // treat like rail: light accel
            r.boostPower = Math.max(r.boostPower, 55);
            r.boostTimer = Math.max(r.boostTimer, 0.16);
          }
        }
      }
    }

    // PIPE ENTER: land from above only
    if(!r.onPipe){
      for(const pipe of world.pipes){
        if(rectHit(r.x, r.y, r.w, r.h, pipe.x, pipe.y, pipe.w, pipe.h)){
          if(r.vy >= 0 && (r.y + r.h - r.vy * dt) <= pipe.y + 2){
            r.onPipe = true;
            r.pipeRef = pipe;
            r.pipeT = clamp((r.x - pipe.x)/pipe.w, 0, 1);
            r.vy = 0;
            r.onGround = false;
            r.onDan = false;
            r.danRef = null;
          }
        }
      }
    }

    // PUDDLE slow
    for(const p of world.puddles){
      if(rectHit(r.x, r.y, r.w, r.h, p.x, p.y, p.w, p.h)){
        r.slowTimer = 0.45;
      }
    }

    // RING: per-runner (not shared disappearance)
    for(const ring of world.rings){
      if(ring.takenBy.has(r.name)) continue;

      const dx = (r.x + r.w/2) - ring.x;
      const dy = (r.y + r.h/2) - ring.y;
      if(dx*dx + dy*dy < ring.r * ring.r * 4){
        ring.takenBy.add(r.name);
        r.rings++;
        if(r.rings >= CONFIG.RING_NEED){
          r.rings = 0;
          startBoost(r, CONFIG.RING_BOOST_ADD, CONFIG.RING_BOOST_TIME);
        }
      }
    }

    // FINISH
    if(!r.finished && (r.x / CONFIG.PX_PER_M) >= race.goal){
      r.finished = true;
      r.finishTime = state.time;
      state.finishedCount++;
    }
  }

  state.time += dt;
  updateRankAndTop8();

  // result when enough finishers reached survive threshold OR all finished
  const survive = CONFIG.RACES[state.raceIndex].survive;
  const allFinished = state.finishedCount >= state.runners.length;
  const enough = state.finishedCount >= survive;
  if(enough || allFinished){
    state.phase = "result";
  }
}

M.updateRun = updateRun;

/* =======================
   COUNTDOWN
======================= */
function updateCountdown(dt){
  state.countdown -= dt;
  if(state.countdown <= 0){
    state.phase = "run";
  }
}
M.updateCountdown = updateCountdown;

/* =======================
   UPDATE
======================= */
function update(dt){
  if(state.phase === "countdown"){
    updateCountdown(dt);
    updateRankAndTop8();
    return;
  }
  if(state.phase === "run"){
    updateRun(dt);
    return;
  }
}
M.update = update;

})();
// =========================
// MOB STREET - 1P RUN
// v6.4.1 (PART 4/5)
// - DRAW (stage / objects / runners / HUD / result)
// =========================
(() => {
"use strict";
const M = window.__MOB__;
if(!M || !M.world) throw new Error("PART1-3 not loaded");

const { CONFIG, IMAGES, state } = M;
const world = M.world;
const canvas = M.canvas;
const ctx = M.ctx;

/* =======================
   DRAW SETUP
======================= */
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

/* =======================
   SKY / STAGE
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
  // puddle
  ctx.fillStyle = "rgba(120,190,255,0.5)";
  for(const p of world.puddles){
    const sx = p.x - state.cameraX;
    if(sx < -80 || sx > CONFIG.LOGICAL_W + 80) continue;
    ctx.fillRect(sx, p.y, p.w, p.h);
  }

  // ring
  const ringImg = IMAGES.ring;
  if(ringImg){
    for(const r of world.rings){
      const sx = r.x - state.cameraX;
      if(sx < -60 || sx > CONFIG.LOGICAL_W + 60) continue;
      ctx.drawImage(ringImg, sx - 10, r.y - 10, 20, 20);
    }
  }

  // pipes
  for(const p of world.pipes){
    const sx = p.x - state.cameraX;
    if(sx < -240 || sx > CONFIG.LOGICAL_W + 240) continue;
    ctx.drawImage(p.img, sx, p.y, p.w, p.h);
  }

  // dan
  const danImg = IMAGES.dan;
  if(danImg){
    for(const d of world.dans){
      const sx = d.x - state.cameraX;
      if(sx < -240 || sx > CONFIG.LOGICAL_W + 240) continue;
      ctx.drawImage(d.img, sx, d.y, d.w, d.h);
    }
  }

  // rail
  const railImg = IMAGES.rail;
  if(railImg){
    for(const r of world.rails){
      const sx = r.x - state.cameraX;
      if(sx < -200 || sx > CONFIG.LOGICAL_W + 200) continue;
      ctx.drawImage(railImg, sx, r.y, r.w, r.h);
    }
  }

  // or (track)
  const orImg = IMAGES.or;
  if(orImg){
    for(const o of world.ors){
      const sx = o.x - state.cameraX;
      if(sx < -260 || sx > CONFIG.LOGICAL_W + 260) continue;
      ctx.drawImage(orImg, sx, o.y, o.w, o.h);
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
  if(IMAGES.board){
    ctx.drawImage(IMAGES.board, sx - r.w*0.05, r.y + r.h*0.65, r.w*1.1, r.h*0.45);
  }

  // body
  const body = (r.onGround || r.onPipe || r.onDan) ? IMAGES.pl1 : IMAGES.pl2;
  if(body){
    ctx.drawImage(body, sx, r.y, r.w, r.h);
  }

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
   HUD
======================= */
function drawHUD(){
  // 右上：順位
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.fillRect(CONFIG.LOGICAL_W - 140, 6, 134, 40);
  ctx.fillStyle = "#fff";
  ctx.font = "12px system-ui";
  ctx.fillText(state.rankText, CONFIG.LOGICAL_W - 132, 22);

  // 左上：Top8
  if(state.top8Text){
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.fillRect(6, 6, CONFIG.LOGICAL_W - 160, 40);
    ctx.fillStyle = "#fff";
    ctx.font = "12px system-ui";
    ctx.fillText(state.top8Text, 14, 22);
  }
}

/* =======================
   COUNTDOWN / RESULT
======================= */
function drawCountdown(){
  ctx.fillStyle = "rgba(0,0,0,0.25)";
  ctx.fillRect(0,0,CONFIG.LOGICAL_W,CONFIG.LOGICAL_H);
  ctx.fillStyle = "#fff";
  ctx.font = "bold 64px system-ui";
  ctx.textAlign = "center";
  ctx.fillText(Math.ceil(state.countdown), CONFIG.LOGICAL_W/2, CONFIG.LOGICAL_H/2);
  ctx.textAlign = "left";
}

function drawResult(){
  ctx.fillStyle = "rgba(0,0,0,0.85)";
  ctx.fillRect(0,0,CONFIG.LOGICAL_W,CONFIG.LOGICAL_H);

  ctx.fillStyle = "#fff";
  ctx.textAlign = "center";
  ctx.font = "bold 26px system-ui";
  ctx.fillText(`RESULT - ${CONFIG.RACES[state.raceIndex].name}`, CONFIG.LOGICAL_W/2, 64);

  const list = [...state.runners].sort((a,b)=>a.finishTime-b.finishTime);
  ctx.font = "16px system-ui";

  let y = 120;
  for(let i=0; i<list.length; i++){
    const r = list[i];
    const t = isFinite(r.finishTime) ? `${r.finishTime.toFixed(2)}s` : "--";
    ctx.fillStyle = r.isPlayer ? "#00ffcc" : "#fff";
    ctx.fillText(`${i+1}. ${r.name}  ${t}`, CONFIG.LOGICAL_W/2, y);
    y += 26;
    if(y > CONFIG.LOGICAL_H - 40) break;
  }
  ctx.textAlign = "left";
}

/* =======================
   RENDER
======================= */
function render(){
  beginDraw();
  drawSky();
  drawStage();
  drawObjects();

  // runners front
  for(const r of state.runners){
    if(!r.isPlayer && r.winRate > 0.30) drawRunner(r);
  }
  drawRunner(state.runners[state.playerIndex]);

  drawHUD();

  if(state.phase === "countdown") drawCountdown();
  if(state.phase === "result") drawResult();
}

M.render = render;

})();
// =========================
// MOB STREET - 1P RUN
// v6.4.1 (PART 5/5)
// - LOOP / BOOT / RESIZE / NEXT / VERSION BADGE
// =========================
(() => {
"use strict";
const M = window.__MOB__;
if(!M) throw new Error("PART1-4 not loaded");

const { state } = M;
const canvas = M.canvas;
const ctx = M.ctx;

/* =======================
   VERSION BADGE (JS only)
======================= */
function attachVersionBadge(){
  try{
    const jump = document.getElementById("btnJump");
    const host =
      (jump && jump.closest(".controls")) ||
      (jump && jump.parentElement) ||
      document.body;

    let badge = document.getElementById("jsVersionBadge");
    if(!badge){
      badge = document.createElement("div");
      badge.id = "jsVersionBadge";
      badge.style.position = "absolute";
      badge.style.left = "10px";
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
    badge.textContent = M.VERSION || "v6.4.1";
  }catch(e){}
}

/* =======================
   CANVAS FIT / DPI
======================= */
function fitCanvasToPlayArea(){
  let top = null;
  const btns = [
    document.getElementById("btnJump"),
    document.getElementById("btnBoost"),
    document.getElementById("btnJumpBoost")
  ];
  for(const b of btns){
    if(b){
      const r = b.getBoundingClientRect();
      if(r && r.top > 0) top = (top==null)? r.top : Math.min(top, r.top);
    }
  }
  if(top == null) top = Math.floor(window.innerHeight * 0.65);
  const playH = Math.max(220, Math.floor(top - 6));
  canvas.style.width = "100%";
  canvas.style.height = playH + "px";
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
   NEXT BUTTON (JS only)
======================= */
let nextBtn = document.getElementById("jsNextFixed");
if(!nextBtn){
  nextBtn = document.createElement("button");
  nextBtn.id = "jsNextFixed";
  nextBtn.textContent = "NEXT RACE";
  nextBtn.style.position="fixed";
  nextBtn.style.left="50%";
  nextBtn.style.bottom="220px";
  nextBtn.style.transform="translateX(-50%)";
  nextBtn.style.zIndex="99999";
  nextBtn.style.padding="12px 18px";
  nextBtn.style.borderRadius="14px";
  nextBtn.style.border="none";
  nextBtn.style.font="bold 14px system-ui";
  nextBtn.style.color="#fff";
  nextBtn.style.background="rgba(0,0,0,0.55)";
  nextBtn.style.backdropFilter="blur(6px)";
  nextBtn.style.display="none";
  document.body.appendChild(nextBtn);
}
nextBtn.addEventListener("pointerdown", ()=>{
  nextBtn.style.display = "none";
  const next =
    (state.raceIndex < M.CONFIG.RACES.length - 1)
      ? state.raceIndex + 1
      : 0;
  M.initRace(next);
});

/* =======================
   LOOP
======================= */
let lastTime = 0;
function loop(t){
  const dt = Math.min((t - lastTime) / 1000, 0.033);
  lastTime = t;

  if(state.phase !== "loading"){
    M.update(dt);
  }
  M.render();

  // 結果表示中は NEXT を出す
  if(state.phase === "result"){
    nextBtn.style.display = "block";
  }

  requestAnimationFrame(loop);
}

/* =======================
   BOOT
======================= */
async function boot(){
  fitCanvasToPlayArea();
  resizeCanvas();
  attachVersionBadge();

  // アセットはPART1でロード済み前提
  M.initRace(0);
  lastTime = performance.now();
  state.phase = "countdown";
  requestAnimationFrame(loop);
}

/* =======================
   EVENTS
======================= */
window.addEventListener("resize", ()=>{
  fitCanvasToPlayArea();
  resizeCanvas();
  attachVersionBadge();
});

// mobile lock (再保険)
["dblclick","contextmenu","gesturestart","gesturechange","gestureend"]
  .forEach(ev=>document.addEventListener(ev,e=>e.preventDefault(),{passive:false}));
window.addEventListener("touchmove", e=>e.preventDefault(), {passive:false});

/* =======================
   START
======================= */
boot();

})();
