// game.js  (FULL)  MOB STREET - 1P RUN
// VERSION: v6.4-or-dan (FULL)
// - iOSでもcanvasが確実に表示されるようfit/resize順を安定化
// - PL1.png / PL2.png 対応
// - or.png / dan.png ギミック追加
// - 被り抑制 / 出現頻度控えめ
// - リング10個で小加速（空中リングあり）
// - 上位8位リアルタイム表示（左上DOM）
// - リザルト中央ポップアップ（全員分） + NEXT/RETRY
// - ITEM(5個消費)は無効（後でアイテム用）
// - 操作エリアにバージョン表示（JSで注入）

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

const btnJump = document.getElementById("btnJump");
const btnBoost = document.getElementById("btnBoost");
const btnItem = document.getElementById("btnJumpBoost"); // 今は無効

/* =======================
   MOBILE LOCK (no select/zoom)
======================= */
(function lockMobile(){
  const prevent = (e)=>{ e.preventDefault(); };
  ["dblclick","contextmenu","gesturestart","gesturechange","gestureend"].forEach(ev=>{
    document.addEventListener(ev, prevent, { passive:false });
  });
  // 画面全体のスクロールを止める（操作エリア外スクロール誤爆防止）
  window.addEventListener("touchmove", prevent, { passive:false });
  // iOSのテキスト選択を抑止
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

  // ring 10 => small accel (boostの半分くらい)
  RING_NEED: 10,
  RING_BOOST_ADD: 110,
  RING_BOOST_TIME: 0.55,

  // player stock: 5s regen, max5, start0
  STOCK_MAX: 5,
  STOCK_REGEN: 5.0,
  STOCK_START: 0,

  // AI boost cooldown
  AI_BOOST_COOLDOWN: 5.0,

  // ギミック頻度（控えめ）
  SPAWN: {
    RAIL_MIN: 420,
    RAIL_MAX: 720,
    PIPE_MIN: 900,
    PIPE_MAX: 1400,
    PUDDLE_MIN: 520,
    PUDDLE_MAX: 820,
    RING_MIN: 170,
    RING_MAX: 260,
    OR_MIN: 900,
    OR_MAX: 1500,
    DAN_MIN: 820,
    DAN_MAX: 1300,
    // 同じ距離帯に重ねない（最小間隔）
    NO_OVERLAP_X: 260
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
    img.onerror = ()=>rej(new Error("Failed to load: " + src));
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
   UI (DOM overlays)
======================= */
function ensureTop8Panel(){
  let el = document.getElementById("jsTop8");
  if(!el){
    el = document.createElement("div");
    el.id = "jsTop8";
    el.style.position = "fixed";
    el.style.left = "10px";
    el.style.top = "64px";
    el.style.zIndex = "99998";
    el.style.width = "190px";
    el.style.maxHeight = "220px";
    el.style.overflow = "hidden";
    el.style.padding = "8px 10px";
    el.style.borderRadius = "12px";
    el.style.background = "rgba(0,0,0,0.28)";
    el.style.backdropFilter = "blur(6px)";
    el.style.color = "rgba(255,255,255,0.92)";
    el.style.font = "12px system-ui";
    el.style.lineHeight = "1.35";
    el.style.pointerEvents = "none";
    el.style.whiteSpace = "pre";
    document.body.appendChild(el);
  }
  return el;
}
const top8Panel = ensureTop8Panel();

function ensureResultModal(){
  let modal = document.getElementById("jsResultModal");
  if(modal) return modal;

  modal = document.createElement("div");
  modal.id = "jsResultModal";
  modal.style.position = "fixed";
  modal.style.left = "0";
  modal.style.top = "0";
  modal.style.right = "0";
  modal.style.bottom = "0";
  modal.style.zIndex = "99999";
  modal.style.display = "none";
  modal.style.alignItems = "center";
  modal.style.justifyContent = "center";
  modal.style.background = "rgba(0,0,0,0.45)";
  modal.style.backdropFilter = "blur(6px)";
  modal.style.pointerEvents = "auto";

  const card = document.createElement("div");
  card.style.width = "min(92vw, 420px)";
  card.style.maxHeight = "min(74vh, 560px)";
  card.style.display = "flex";
  card.style.flexDirection = "column";
  card.style.borderRadius = "16px";
  card.style.background = "rgba(10,12,18,0.92)";
  card.style.border = "1px solid rgba(255,255,255,0.10)";
  card.style.boxShadow = "0 20px 60px rgba(0,0,0,0.55)";
  card.style.overflow = "hidden";

  const head = document.createElement("div");
  head.style.padding = "14px 14px 10px";
  head.style.borderBottom = "1px solid rgba(255,255,255,0.10)";
  head.innerHTML = `
    <div id="rmTitle" style="font:800 16px system-ui;color:#fff;">RESULT</div>
    <div id="rmMeta" style="margin-top:4px;font:600 12px system-ui;color:rgba(255,255,255,0.70);"></div>
  `;

  const list = document.createElement("div");
  list.id = "rmList";
  list.style.padding = "10px 12px";
  list.style.overflow = "auto";
  list.style.flex = "1";
  list.style.display = "block";

  const style = document.createElement("style");
  style.textContent = `
    #rmList .item{
      display:flex;justify-content:space-between;gap:12px;
      padding:7px 8px;border-radius:10px;
      font:600 13px system-ui;color:rgba(255,255,255,0.90);
    }
    #rmList .item:nth-child(odd){ background:rgba(255,255,255,0.05); }
    #rmList .item.me{ background:rgba(0,255,204,0.13); color:#00ffd7; }
    #rmBtns{ display:flex; gap:10px; padding:12px; border-top:1px solid rgba(255,255,255,0.10); }
    #rmBtns button{
      flex:1; padding:12px 10px; border:0; border-radius:12px;
      font:800 14px system-ui; color:#fff;
      background:rgba(255,255,255,0.12);
    }
    #rmBtns button.primary{ background:rgba(0,0,0,0.55); border:1px solid rgba(255,255,255,0.18); }
  `;
  document.head.appendChild(style);

  const btns = document.createElement("div");
  btns.id = "rmBtns";
  btns.innerHTML = `
    <button id="rmRetry">RETRY</button>
    <button id="rmNext" class="primary">NEXT RACE</button>
  `;

  card.appendChild(head);
  card.appendChild(list);
  card.appendChild(btns);
  modal.appendChild(card);
  document.body.appendChild(modal);

  return modal;
}
const resultModal = ensureResultModal();
const rmTitle = document.getElementById("rmTitle");
const rmMeta  = document.getElementById("rmMeta");
const rmList  = document.getElementById("rmList");
const rmRetry = document.getElementById("rmRetry");
const rmNext  = document.getElementById("rmNext");

/* ===== Version badge in control area ===== */
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
      badge.style.right = "12px";
      badge.style.bottom = "12px";
      badge.style.zIndex = "99999";
      badge.style.padding = "6px 10px";
      badge.style.borderRadius = "10px";
      badge.style.font = "800 12px system-ui";
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
    // ignore
  }
}

/* =======================
   PLAY AREA FIT (stable)
   - レイアウト確定後に測る
   - 操作エリアとプレイ画面を必ず分離
======================= */
function fitCanvasToPlayArea(){
  // controls top を拾う
  let top = null;
  const rects = [];
  if(btnJump) rects.push(btnJump.getBoundingClientRect());
  if(btnBoost) rects.push(btnBoost.getBoundingClientRect());
  if(btnItem) rects.push(btnItem.getBoundingClientRect());

  for(const r of rects){
    if(r && r.top > 0){
      top = (top === null) ? r.top : Math.min(top, r.top);
    }
  }
  if(top === null){
    top = Math.floor(window.innerHeight * 0.65);
  }

  // セーフエリア考慮（ざっくり）
  const safePad = 6;
  const playH = Math.max(260, Math.floor(top - safePad));

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
  // ここが 0 にならないように safeguard
  const w = Math.max(1, Math.floor(r.width));
  const h = Math.max(1, Math.floor(r.height));
  canvas.width  = Math.max(1, Math.floor(w * dpr));
  canvas.height = Math.max(1, Math.floor(h * dpr));
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

// ITEM無効
if(btnItem){
  btnItem.style.opacity="0.35";
  btnItem.style.filter="grayscale(0.7)";
  btnItem.style.pointerEvents="none";
}

/* =======================
   STOCK BAR (DOM)
======================= */
function ensureStockBarFill(){
  const bar = document.querySelector(".stockBar, #stockBar, .boostBar") || null;
  if(!bar) return null;

  let fill = document.getElementById("stockFill");
  if(!fill){
    fill = document.createElement("div");
    fill.id = "stockFill";
    fill.style.position = "absolute";
    fill.style.left = "0";
    fill.style.top = "0";
    fill.style.bottom = "0";
    fill.style.width = "0%";
    fill.style.borderRadius = "999px";
    fill.style.background = "rgba(0,255,204,0.90)";
    bar.style.position = "relative";
    bar.appendChild(fill);
  }
  return fill;
}
let stockFill = null;
function updateStockBar(){
  if(!stockFill) return;
  const pct = clamp(state.stock / CONFIG.STOCK_MAX, 0, 1) * 100;
  stockFill.style.width = pct.toFixed(1) + "%";
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
  rankText:"",

  top8Text:""
};

function createRunner(name,isPlayer,winRate){
  return {
    name, isPlayer, winRate,

    x:0, y:0, vy:0,
    w:CONFIG.PLAYER_SIZE, h:CONFIG.PLAYER_SIZE,

    onGround:true,
    onPipe:false,
    pipeRef:null,
    pipeT:0,

    onDan:false,
    danRef:null,

    onOr:false,
    orRef:null,

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

function resetRunner(r){
  r.x=0; r.y=0; r.vy=0;
  r.onGround=true;
  r.onPipe=false; r.pipeRef=null; r.pipeT=0;
  r.onDan=false; r.danRef=null;
  r.onOr=false;  r.orRef=null;

  r.jumps=0;
  r.boostTimer=0; r.boostPower=0;
  r.slowTimer=0; r.rings=0;
  r.finished=false; r.finishTime=Infinity;
  r.aiCd = rand(0.20,0.55);
  r.aiBoostCd = rand(0.0, CONFIG.AI_BOOST_COOLDOWN);
}

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

  for(const r of state.runners) resetRunner(r);

  state.stock = CONFIG.STOCK_START;
  state.stockTimer = 0;

  state.countdown = 3;
  state.phase = "countdown";
  hideResult();

  resetWorldForRace();
  resetGround();

  // 初期スポーン
  spawnWorld(0);

  // 地面に置く
  for(const r of state.runners){
    r.x = 0;
    r.y = world.groundY - r.h;
    r.vy = 0;
    r.onGround = true;
  }

  state.time = 0;
  updateRank();
  updateTop8();
  updateStockBar();
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

function updateTop8(){
  // リアルタイム上位8だけ表示（被りにくい）
  const list = [...state.runners].slice().sort((a,b)=>b.x - a.x);
  let out = "";
  const max = Math.min(8, list.length);
  for(let i=0;i<max;i++){
    const r = list[i];
    const tag = r.isPlayer ? "（YOU）" : "";
    out += `${i+1}. ${r.name}${tag}\n`;
  }
  state.top8Text = out.trim();
  if(top8Panel) top8Panel.textContent = state.top8Text;
}

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

  nextRailX: 280,
  nextPipeX: 900,
  nextPuddleX: 520,
  nextRingX: 220,
  nextOrX: 900,
  nextDanX: 820
};

function resetWorldForRace(){
  world.rails.length = 0;
  world.pipes.length = 0;
  world.puddles.length = 0;
  world.rings.length = 0;
  world.ors.length = 0;
  world.dans.length = 0;

  world.nextRailX = 280;
  world.nextPipeX = 900;
  world.nextPuddleX = 520;
  world.nextRingX = 220;
  world.nextOrX = 900;
  world.nextDanX = 820;
}

function resetGround(){
  // 安定：少し上げて「埋まる」回避
  world.groundH = 72;
  const lift = 56;
  world.groundY = (CONFIG.LOGICAL_H - world.groundH) - lift;
  world.groundY = Math.max(240, world.groundY);
}

/* =======================
   SPAWN helpers
======================= */
function isTooClose(x){
  const min = CONFIG.SPAWN.NO_OVERLAP_X;
  const check = (arr)=>arr.some(o=>Math.abs(o.x - x) < min);
  return check(world.rails) || check(world.pipes) || check(world.puddles) || check(world.ors) || check(world.dans);
}

function spawnWorld(camX){
  const edge = camX + CONFIG.LOGICAL_W;

  if(edge > world.nextRailX){
    const x = world.nextRailX;
    if(!isTooClose(x)) addRail(x);
    world.nextRailX += rand(CONFIG.SPAWN.RAIL_MIN, CONFIG.SPAWN.RAIL_MAX);
  }
  if(edge > world.nextPipeX){
    const x = world.nextPipeX;
    if(!isTooClose(x)) addPipe(x);
    world.nextPipeX += rand(CONFIG.SPAWN.PIPE_MIN, CONFIG.SPAWN.PIPE_MAX);
  }
  if(edge > world.nextPuddleX){
    const x = world.nextPuddleX;
    if(!isTooClose(x)) addPuddle(x);
    world.nextPuddleX += rand(CONFIG.SPAWN.PUDDLE_MIN, CONFIG.SPAWN.PUDDLE_MAX);
  }
  if(edge > world.nextOrX){
    const x = world.nextOrX;
    if(!isTooClose(x)) addOr(x);
    world.nextOrX += rand(CONFIG.SPAWN.OR_MIN, CONFIG.SPAWN.OR_MAX);
  }
  if(edge > world.nextDanX){
    const x = world.nextDanX;
    if(!isTooClose(x)) addDan(x);
    world.nextDanX += rand(CONFIG.SPAWN.DAN_MIN, CONFIG.SPAWN.DAN_MAX);
  }

  // リングは頻度高め（ただし軽い）
  if(edge > world.nextRingX){
    addRing(world.nextRingX);
    world.nextRingX += rand(CONFIG.SPAWN.RING_MIN, CONFIG.SPAWN.RING_MAX);
  }
}

/* =======================
   OBJECT ADD
======================= */
function addRail(x){
  const img = IMAGES.rail;
  if(!img) return;

  // ガードは少し低め
  const h = Math.floor(world.groundH * 0.55);
  const scale = h / img.height;
  const w = Math.floor(img.width * scale);

  world.rails.push({
    x,
    y: world.groundY - h,
    w, h
  });
}

function addPipe(x){
  const img = Math.random() < 0.5 ? IMAGES.hpr : IMAGES.hpg;
  if(!img) return;

  // 横を少し大きく（ユーザー要望）
  const h = Math.floor(world.groundH * 0.62);
  const scale = h / img.height;
  const w = Math.floor(img.width * scale * 1.38);

  world.pipes.push({
    x,
    y: world.groundY - h,
    w, h, img
  });
}

function addPuddle(x){
  world.puddles.push({
    x,
    y: world.groundY - 8,
    w: rand(34, 54),
    h: 6
  });
}

function addRing(x){
  // 空中リングあり
  const air = Math.random() < 0.55;
  const y = air ? world.groundY - rand(78, 150) : world.groundY - 28;

  world.rings.push({
    x,
    y,
    r: 8,
    takenBy: new Set() // ランナーごとに取得（見た目はプレイヤー基準で消える）
  });
}

function addOr(x){
  const img = IMAGES.or;
  if(!img) return;

  const h = Math.floor(world.groundH * 0.60);
  const scale = h / img.height;
  const w = Math.floor(img.width * scale);

  world.ors.push({
    x,
    y: world.groundY - h,
    w, h,
    img
  });
}

function addDan(x){
  const img = IMAGES.dan;
  if(!img) return;

  // danは少し大きめ＆スロープで必ず乗れる
  const h = Math.floor(world.groundH * 0.70);
  const scale = h / img.height;
  const w = Math.floor(img.width * scale * 1.12);

  // 形状用：左右スロープ比率
  const slopeW = w * 0.22;        // 左右22%ずつスロープ
  const topY   = world.groundY - h;

  world.dans.push({
    x,
    y: topY,
    w, h,
    img,
    slopeW
  });
}

/* =======================
   COLLISION
======================= */
function rectHit(ax,ay,aw,ah,bx,by,bw,bh){
  return ax < bx + bw && ax + aw > bx &&
         ay < by + bh && ay + ah > by;
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

/* =======================
   RUN UPDATE
======================= */
function updateRun(dt){
  const race = CONFIG.RACES[state.raceIndex];
  const player = state.runners[state.playerIndex];

  // カメラ：プレイヤー左寄せ
  state.cameraX = Math.max(0, player.x - Math.floor(CONFIG.LOGICAL_W * 0.18));
  spawnWorld(state.cameraX);

  // プレイヤーStock回復：5秒/1、最大5、初期0
  state.stockTimer += dt;
  if(state.stockTimer >= CONFIG.STOCK_REGEN){
    state.stockTimer = 0;
    state.stock = Math.min(CONFIG.STOCK_MAX, state.stock + 1);
  }

  for(let idx=0; idx<state.runners.length; idx++){
    const r = state.runners[idx];
    if(r.finished) continue;

    /* --- AI --- */
    if(!r.isPlayer){
      r.aiCd -= dt;
      r.aiBoostCd -= dt;

      if(r.aiCd <= 0){
        r.aiCd = rand(0.25, 0.55);

        // 名前持ちはジャンプを少し増やす（ギミックに絡む）
        const jumpChance = (r.winRate > 0.30) ? 0.060 : 0.018;
        if(Math.random() < jumpChance) doJump(r);
      }

      if(r.aiBoostCd <= 0 && Math.random() < (r.winRate * 0.12)){
        r.aiBoostCd = CONFIG.AI_BOOST_COOLDOWN;
        startBoost(r, CONFIG.BOOST_ADD, CONFIG.BOOST_TIME);
      }
    }

    /* --- PLAYER INPUT --- */
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

    /* --- SPEED --- */
    let speed = CONFIG.BASE_SPEED;

    if(r.boostTimer > 0){
      r.boostTimer -= dt;
      speed += r.boostPower;
    }
    if(r.slowTimer > 0){
      r.slowTimer -= dt;
      speed *= 0.75;
    }

    // danに乗っている間は少し加速
    if(r.onDan){
      speed += 70;
    }

    /* --- PLATFORM STATES RESET --- */
    // パイプ/ダン/orの上は「yを上書きする」ので、
    // いったん落下処理に入る前にフラグで分岐する
    const wasOnPipe = r.onPipe;
    const wasOnDan  = r.onDan;
    const wasOnOr   = r.onOr;

    /* --- PIPE SLOPE --- */
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
    }

    /* --- DAN SLOPE (必ず乗れる) --- */
    if(r.onDan && r.danRef){
      const d = r.danRef;
      const cx = r.x + r.w * 0.5;
      const t = clamp((cx - d.x) / d.w, 0, 1);

      // 左スロープ → 上 → 右スロープ（線形）
      let topY = d.y; // 上面のY
      if(t < (d.slopeW / d.w)){
        // 左：地面から上へ
        const tt = t / (d.slopeW / d.w);
        topY = (world.groundY - (d.h * tt));
      }else if(t > (1 - (d.slopeW / d.w))){
        // 右：上から地面へ
        const tt = (t - (1 - (d.slopeW / d.w))) / (d.slopeW / d.w);
        topY = (world.groundY - (d.h * (1 - tt)));
      }else{
        // 中央：上面
        topY = d.y;
      }

      r.y = topY - r.h;
      r.vy = 0;
      r.onGround = true;
      r.jumps = 0;

      // 抜けたら地面へ
      if(cx >= d.x + d.w){
        r.onDan = false;
        r.danRef = null;
        r.y = world.groundY - r.h;
      }
    }

    /* --- OR PLATFORM --- */
    if(r.onOr && r.orRef){
      const o = r.orRef;
      // 上に乗ってる間は固定
      r.y = o.y - r.h;
      r.vy = 0;
      r.onGround = true;
      r.jumps = 0;

      // 抜けたら地面
      if(r.x + r.w*0.5 >= o.x + o.w){
        r.onOr = false;
        r.orRef = null;
        r.y = world.groundY - r.h;
      }
    }

    /* --- GRAVITY (platformで上書きされない時だけ) --- */
    if(!r.onPipe && !r.onDan && !r.onOr){
      r.vy += CONFIG.GRAVITY * dt;
      r.vy = Math.min(r.vy, CONFIG.MAX_FALL_V);
      r.y += r.vy * dt;
    }

    /* --- MOVE X --- */
    r.x += speed * dt;

    /* --- GROUND --- */
    if(!r.onPipe && !r.onDan && !r.onOr){
      if(r.y + r.h >= world.groundY){
        r.y = world.groundY - r.h;
        r.vy = 0;
        r.onGround = true;
        r.jumps = 0;
      }else{
        r.onGround = false;
      }
    }

    /* --- RAIL (上から着地のみ) --- */
    if(!r.onPipe && !r.onDan && !r.onOr){
      for(const rail of world.rails){
        if(rectHit(r.x, r.y, r.w, r.h, rail.x, rail.y, rail.w, rail.h)){
          if(r.vy >= 0 && (r.y + r.h - r.vy * dt) <= rail.y + 2){
            r.y = rail.y - r.h;
            r.vy = 0;
            r.onGround = true;
            r.jumps = 0;
            // 乗ると少し加速
            r.boostPower = Math.max(r.boostPower, 60);
            r.boostTimer = Math.max(r.boostTimer, 0.15);
          }
        }
      }
    }

    /* --- PIPE ENTER (上からのみ) --- */
    if(!r.onPipe && !r.onDan && !r.onOr){
      for(const pipe of world.pipes){
        if(rectHit(r.x, r.y, r.w, r.h, pipe.x, pipe.y, pipe.w, pipe.h)){
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

    /* --- DAN ENTER (スロープで必ず乗れる) --- */
    if(!r.onPipe && !r.onDan && !r.onOr){
      for(const d of world.dans){
        // danの範囲に入ったら、強制的に「上に乗る判定」
        // （地面走行でも確実に乗る）
        const cx = r.x + r.w*0.5;
        if(cx >= d.x && cx <= d.x + d.w){
          // danの上に向かう：yが地面より下に潜っている場合も吸い上げ
          r.onDan = true;
          r.danRef = d;
          r.onGround = true;
          r.vy = 0;
          r.jumps = 0;
          break;
        }
      }
    }

    /* --- OR ENTER / BUMPBACK --- */
    // orは「上から着地なら乗る」＋「正面衝突なら少し弾く」
    if(!r.onPipe && !r.onDan && !r.onOr){
      for(const o of world.ors){
        if(rectHit(r.x, r.y, r.w, r.h, o.x, o.y, o.w, o.h)){
          const prevBottom = (r.y + r.h - r.vy * dt);
          const landing = (r.vy >= 0 && prevBottom <= o.y + 2);
          if(landing){
            r.onOr = true;
            r.orRef = o;
            r.y = o.y - r.h;
            r.vy = 0;
            r.onGround = true;
            r.jumps = 0;
          }else{
            // 正面衝突：少し後ろに弾く（プレイヤーにもAIにも）
            r.x = Math.max(0, r.x - 22);
            // ほんの少し減速感
            r.slowTimer = Math.max(r.slowTimer, 0.22);
          }
        }
      }
    }

    /* --- PUDDLE --- */
    for(const p of world.puddles){
      if(rectHit(r.x, r.y, r.w, r.h, p.x, p.y, p.w, p.h)){
        r.slowTimer = 0.40;
      }
    }

    /* --- RING (ランナー別取得) --- */
    for(const ring of world.rings){
      // 自分（プレイヤー）が取ったら見えなくなるため takenBy を使う
      if(ring.takenBy.has(idx)) continue;

      const dx = (r.x + r.w/2) - ring.x;
      const dy = (r.y + r.h/2) - ring.y;
      if(dx*dx + dy*dy < ring.r * ring.r * 4){
        ring.takenBy.add(idx);
        r.rings++;

        if(r.rings >= CONFIG.RING_NEED){
          r.rings = 0;
          startBoost(r, CONFIG.RING_BOOST_ADD, CONFIG.RING_BOOST_TIME);
        }
      }
    }

    /* --- FINISH --- */
    if(!r.finished && (r.x / CONFIG.PX_PER_M) >= race.goal){
      r.finished = true;
      r.finishTime = state.time;
      state.finishedCount++;
    }
  }

  state.time += dt;
  updateRank();
  updateTop8();
  updateStockBar();

  // 生存数到達でリザルト（あなたのルールのまま）
  if(state.finishedCount >= race.survive){
    showResult();
  }
}

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
    updateTop8();
    updateStockBar();
    return;
  }
  if(state.phase === "run"){
    updateRun(dt);
    return;
  }
  // result: stop simulation
}

/* =======================
   DRAW: COVER + BOTTOM ALIGN
   - 左右黒帯なし（cover）
   - 下端は必ず表示（bottom-align）
======================= */
function beginDraw(){
  const cw = canvas.width;
  const ch = canvas.height;

  const sx = cw / CONFIG.LOGICAL_W;
  const sy = ch / CONFIG.LOGICAL_H;
  const s = Math.max(sx, sy);

  const drawW = CONFIG.LOGICAL_W * s;
  const drawH = CONFIG.LOGICAL_H * s;

  const ox = (cw - drawW) * 0.5;
  const oy = (ch - drawH); // bottom-align

  ctx.setTransform(1,0,0,1,0,0);
  ctx.fillStyle = "#163d7a";
  ctx.fillRect(0,0,cw,ch);

  ctx.setTransform(s, 0, 0, s, ox, oy);
  ctx.imageSmoothingEnabled = false;
}

function drawSky(){
  const g = ctx.createLinearGradient(0, 0, 0, CONFIG.LOGICAL_H);
  g.addColorStop(0, "#2a6ccf");
  g.addColorStop(0.6, "#163d7a");
  g.addColorStop(1, "#071727");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, CONFIG.LOGICAL_W, CONFIG.LOGICAL_H);
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

function drawObjects(){
  // 水たまり
  ctx.fillStyle = "rgba(120,190,255,0.5)";
  for(const p of world.puddles){
    const sx = p.x - state.cameraX;
    if(sx < -120 || sx > CONFIG.LOGICAL_W + 120) continue;
    ctx.fillRect(sx, p.y, p.w, p.h);
  }

  // リング（プレイヤーが取ったものは消える）
  const ringImg = IMAGES.ring;
  if(ringImg){
    const pi = state.playerIndex;
    for(const r of world.rings){
      if(r.takenBy.has(pi)) continue;
      const sx = r.x - state.cameraX;
      if(sx < -80 || sx > CONFIG.LOGICAL_W + 80) continue;
      ctx.drawImage(ringImg, sx - 10, r.y - 10, 20, 20);
    }
  }

  // dan
  const danImg = IMAGES.dan;
  if(danImg){
    for(const d of world.dans){
      const sx = d.x - state.cameraX;
      if(sx < -260 || sx > CONFIG.LOGICAL_W + 260) continue;
      ctx.drawImage(d.img, sx, d.y, d.w, d.h);
    }
  }

  // or
  const orImg = IMAGES.or;
  if(orImg){
    for(const o of world.ors){
      const sx = o.x - state.cameraX;
      if(sx < -220 || sx > CONFIG.LOGICAL_W + 220) continue;
      ctx.drawImage(o.img, sx, o.y, o.w, o.h);
    }
  }

  // ハーフパイプ
  for(const p of world.pipes){
    const sx = p.x - state.cameraX;
    if(sx < -260 || sx > CONFIG.LOGICAL_W + 260) continue;
    ctx.drawImage(p.img, sx, p.y, p.w, p.h);
  }

  // ガードレール
  const railImg = IMAGES.rail;
  if(railImg){
    for(const r of world.rails){
      const sx = r.x - state.cameraX;
      if(sx < -200 || sx > CONFIG.LOGICAL_W + 200) continue;
      ctx.drawImage(railImg, sx, r.y, r.w, r.h);
    }
  }
}

function screenXOf(r){
  if(r.isPlayer) return Math.floor(CONFIG.LOGICAL_W * 0.18);
  const p = state.runners[state.playerIndex];
  return Math.floor(CONFIG.LOGICAL_W * 0.18 + (r.x - p.x));
}

function drawRunner(r){
  const sx = screenXOf(r);
  if(sx < -120 || sx > CONFIG.LOGICAL_W + 120) return;

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
  const body = (r.onGround || r.onPipe || r.onDan || r.onOr) ? IMAGES.pl1 : IMAGES.pl2;
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

function drawCountdown(){
  ctx.fillStyle = "rgba(0,0,0,0.12)";
  ctx.fillRect(0,0,CONFIG.LOGICAL_W,CONFIG.LOGICAL_H);
  ctx.fillStyle = "#fff";
  ctx.font = "bold 64px system-ui";
  ctx.textAlign = "center";
  ctx.fillText(String(Math.ceil(state.countdown)), CONFIG.LOGICAL_W/2, CONFIG.LOGICAL_H/2);
  ctx.textAlign = "left";
}

function render(){
  beginDraw();
  drawSky();
  drawStage();
  drawObjects();

  // キャラは最前面（名前持ち→プレイヤー）
  for(const r of state.runners){
    if(!r.isPlayer && r.winRate > 0.30) drawRunner(r);
  }
  drawRunner(state.runners[state.playerIndex]);

  if(state.phase === "countdown") drawCountdown();
}

/* =======================
   RESULT MODAL
======================= */
function hideResult(){
  if(resultModal) resultModal.style.display = "none";
}
function showResult(){
  if(state.phase === "result") return;
  state.phase = "result";
  updateRank();
  updateTop8();
  updateStockBar();

  const race = CONFIG.RACES[state.raceIndex];
  const list = [...state.runners].sort((a,b)=>a.finishTime - b.finishTime);

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

rmRetry?.addEventListener("pointerdown", ()=>{
  hideResult();
  initRace(state.raceIndex);
});
rmNext?.addEventListener("pointerdown", ()=>{
  hideResult();
  const nextIdx = (state.raceIndex < CONFIG.RACES.length - 1) ? (state.raceIndex + 1) : 0;
  initRace(nextIdx);
});

/* =======================
   LOOP
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
   BOOT (重要：fit/resizeは「レイアウト確定後」に必ず再実行)
======================= */
async function boot(){
  try{
    state.phase="loading";
    if(overlay) overlay.style.display = "block";
    if(overlayTitle) overlayTitle.textContent="Loading";
    if(overlayMsg) overlayMsg.textContent="assets";

    // 先にassets
    await loadAssets();

    // ★ここが安定化の本体：レイアウト確定後に2段階でfit
    // 1) いまのDOMでfit
    fitCanvasToPlayArea();
    resizeCanvas();
    attachVersionBadge();
    stockFill = ensureStockBarFill();

    // 2) 次フレームでもう一度（iOSのレイアウト遅延対策）
    await new Promise(res=>requestAnimationFrame(()=>res()));
    fitCanvasToPlayArea();
    resizeCanvas();
    attachVersionBadge();
    stockFill = ensureStockBarFill();

    if(overlay) overlay.style.display="none";

    initRace(0);

    state.lastTime = performance.now();
    state.phase = "countdown";
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

window.addEventListener("resize", ()=>{
  // 走行中でも描画領域が壊れないよう随時追従
  fitCanvasToPlayArea();
  resizeCanvas();
  attachVersionBadge();
  stockFill = ensureStockBarFill();
});

/* =======================
   START
======================= */
attachVersionBadge();
boot();

})(); 
