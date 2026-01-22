// game.js  (FULL)  MOB STREET - 1P RUN
// VERSION: v6.6-track-pipe-profile (FULL)
//
// FIXES:
// - or(トラック) : 大型化 + 乗ってる間の加速を強化（ガードレール同様に乗れる床）
// - pipe(ハーフパイプ): 画像上面ライン(非透過)をスキャンして“絵に沿って”走る + 乗ってる間の加速
// - dan: 乗ってるのに途中で消える見た目問題を解消（矩形カリング）
// - オブジェ削除: 画面から見えなくなってから削除（pruneWorld）
// - ジャンプ時: pipe/dan/orの床状態を確実に解除（挙動の破綻防止）
// - iOS: fit/resize 2段階を維持

(() => {
"use strict";

const VERSION = "v6.6-track-pipe-profile";

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
  window.addEventListener("touchmove", prevent, { passive:false });
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

  // ギミック頻度（控えめ）
  SPAWN: {
    RAIL_MIN: 520,
    RAIL_MAX: 860,
    PIPE_MIN: 1100,
    PIPE_MAX: 1700,
    PUDDLE_MIN: 680,
    PUDDLE_MAX: 980,
    RING_MIN: 170,
    RING_MAX: 260,
    OR_MIN: 1150,
    OR_MAX: 1850,
    DAN_MIN: 980,
    DAN_MAX: 1550,
    // サイズアップに合わせて被り最小間隔を増やす
    NO_OVERLAP_X: 420
  },

  // 画面外オブジェ削除の安全マージン
  PRUNE_BEHIND: 520, // cameraX よりこれ以上後ろなら削除OK

  // トラック/パイプ 加速
  OR_SPEED_ADD: 160,     // トラック上の加速（強め）
  PIPE_BASE_ADD: 110,    // パイプ上の常時加速
  PIPE_SLOPE_ADD: 220,   // 勾配（上り下り）に応じた加速

  // dan加速（既に良いが少し上げる）
  DAN_SPEED_ADD: 120,

  // プロファイル抽出用
  PROFILE_ALPHA_TH: 12,   // 透明判定しきい値
  PROFILE_SMOOTH: 2       // 近傍平均で滑らかに
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
const IMG_META = new Map(); // img -> { surfaceY: number[] }  (y in image coords)

function loadImage(src){
  return new Promise((res,rej)=>{
    const img = new Image();
    img.onload = ()=>res(img);
    img.onerror = ()=>rej(new Error("Failed to load: " + src));
    img.src = src;
  });
}

/* =======================
   PROFILE: 画像上面スキャン
   - 同一画像は1回だけ作る
   - 各x列で「最初の非透過ピクセルY」を surface として保存
======================= */
function buildSurfaceProfile(img){
  if(IMG_META.has(img)) return IMG_META.get(img);

  const w = img.width|0;
  const h = img.height|0;

  const oc = document.createElement("canvas");
  oc.width = w; oc.height = h;
  const octx = oc.getContext("2d", { willReadFrequently: true });
  octx.clearRect(0,0,w,h);
  octx.drawImage(img, 0, 0);

  let data;
  try{
    data = octx.getImageData(0,0,w,h).data;
  }catch(e){
    // もし何かで読めない場合はフォールバック（従来sinに近い）
    const surfaceY = new Array(w).fill(Math.floor(h*0.5));
    const meta = { surfaceY, fallback:true };
    IMG_META.set(img, meta);
    return meta;
  }

  const th = CONFIG.PROFILE_ALPHA_TH;
  const surfaceY = new Array(w);

  for(let x=0;x<w;x++){
    let yFound = h-1;
    for(let y=0;y<h;y++){
      const a = data[(y*w + x)*4 + 3];
      if(a > th){
        yFound = y;
        break;
      }
    }
    surfaceY[x] = yFound;
  }

  // 簡易スムージング（ギザつき抑制）
  const k = CONFIG.PROFILE_SMOOTH|0;
  if(k > 0){
    const sm = surfaceY.slice();
    for(let x=0;x<w;x++){
      let sum=0, cnt=0;
      for(let dx=-k; dx<=k; dx++){
        const xx = clamp(x+dx, 0, w-1);
        sum += surfaceY[xx];
        cnt++;
      }
      sm[x] = sum / cnt;
    }
    for(let x=0;x<w;x++) surfaceY[x] = sm[x];
  }

  const meta = { surfaceY, fallback:false };
  IMG_META.set(img, meta);
  return meta;
}

async function loadAssets(){
  for(const k in ASSETS){
    if(overlayTitle) overlayTitle.textContent = "Loading";
    if(overlayMsg) overlayMsg.textContent = ASSETS[k];
    IMAGES[k] = await loadImage(ASSETS[k]);
  }

  // 重要：パイプ用プロファイルを先に作っておく（プレイ中の初回負荷を避ける）
  if(IMAGES.hpr) buildSurfaceProfile(IMAGES.hpr);
  if(IMAGES.hpg) buildSurfaceProfile(IMAGES.hpg);
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
======================= */
function fitCanvasToPlayArea(){
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

  r.onPipe=false; r.pipeRef=null;
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

  spawnWorld(0);

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

  nextRailX: 320,
  nextPipeX: 1100,
  nextPuddleX: 680,
  nextRingX: 220,
  nextOrX: 1150,
  nextDanX: 980
};

function resetWorldForRace(){
  world.rails.length = 0;
  world.pipes.length = 0;
  world.puddles.length = 0;
  world.rings.length = 0;
  world.ors.length = 0;
  world.dans.length = 0;

  world.nextRailX = 320;
  world.nextPipeX = 1100;
  world.nextPuddleX = 680;
  world.nextRingX = 220;
  world.nextOrX = 1150;
  world.nextDanX = 980;
}

function resetGround(){
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

  const h = Math.floor(world.groundH * 0.62);
  const scale = h / img.height;

  const segW = Math.floor(img.width * scale);
  const segments = 3;
  const w = segW * segments;

  world.rails.push({
    x,
    y: world.groundY - h,
    w, h,
    segW, segments
  });
}

function addPipe(x){
  const img = Math.random() < 0.5 ? IMAGES.hpr : IMAGES.hpg;
  if(!img) return;

  const h = Math.floor(world.groundH * 0.66);
  const scale = h / img.height;

  const w = Math.floor(img.width * scale * 1.85);

  const meta = buildSurfaceProfile(img);

  world.pipes.push({
    x,
    y: world.groundY - h,
    w, h,
    img,
    scale,            // ワールド→画像変換に使用
    meta              // surfaceY
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
  const air = Math.random() < 0.55;
  const y = air ? world.groundY - rand(78, 150) : world.groundY - 28;

  world.rings.push({
    x, y, r: 8,
    takenBy: new Set()
  });
}

function addOr(x){
  const img = IMAGES.or;
  if(!img) return;

  // 大型化（もっと大きく）
  const h = Math.floor(world.groundH * 0.82);
  const scale = h / img.height;
  const w = Math.floor(img.width * scale * 1.75);

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

  const h = Math.floor(world.groundH * 0.78);
  const scale = h / img.height;
  const w = Math.floor(img.width * scale * 1.60);

  const slopeW = w * 0.22;
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
function detachPlatforms(r){
  if(r.onPipe){ r.onPipe=false; r.pipeRef=null; }
  if(r.onDan ){ r.onDan=false;  r.danRef=null; }
  if(r.onOr  ){ r.onOr=false;   r.orRef=null; }
}

function doJump(r){
  // 床扱い中にジャンプしたら確実に解除（挙動破綻防止）
  if(r.onPipe || r.onDan || r.onOr){
    detachPlatforms(r);
  }

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
   WORLD PRUNE (画面外削除)
   - “見えなくなってから”削除
   - 誰かが乗ってるpipe/or/danは絶対に削除しない
======================= */
function pruneWorld(camX){
  const limit = camX - CONFIG.PRUNE_BEHIND;

  // 乗ってる参照を集める
  const ridingPipes = new Set();
  const ridingOrs   = new Set();
  const ridingDans  = new Set();
  for(const r of state.runners){
    if(r.onPipe && r.pipeRef) ridingPipes.add(r.pipeRef);
    if(r.onOr   && r.orRef)   ridingOrs.add(r.orRef);
    if(r.onDan  && r.danRef)  ridingDans.add(r.danRef);
  }

  world.puddles = world.puddles.filter(o => (o.x + o.w) >= limit);
  world.rings   = world.rings.filter(o => (o.x + 20) >= limit);

  world.rails = world.rails.filter(o => (o.x + o.w) >= limit);

  world.pipes = world.pipes.filter(o => {
    if(ridingPipes.has(o)) return true;
    return (o.x + o.w) >= limit;
  });

  world.ors = world.ors.filter(o => {
    if(ridingOrs.has(o)) return true;
    return (o.x + o.w) >= limit;
  });

  world.dans = world.dans.filter(o => {
    if(ridingDans.has(o)) return true;
    return (o.x + o.w) >= limit;
  });
}

/* =======================
   PIPE SURFACE: 絵に沿うY
======================= */
function pipeSurfaceY(pipe, worldX){
  // pipe内のローカルX（0..w）
  const lx = clamp(worldX - pipe.x, 0, pipe.w-1);

  // 画像側のXへ
  const imgX = clamp(Math.floor(lx / pipe.scale), 0, pipe.img.width - 1);

  // フォールバックの場合は従来っぽいカーブ
  if(pipe.meta && pipe.meta.fallback){
    const t = clamp(lx / pipe.w, 0, 1);
    const lift = Math.sin(Math.PI * t);
    const y = (pipe.y + pipe.h) - lift * pipe.h;
    return y;
  }

  const sy = pipe.meta.surfaceY[imgX]; // 画像上面Y
  const y = pipe.y + (sy * pipe.scale); // ワールドYへ
  return y;
}

// 勾配（スロープ）っぽい量：隣の差分でざっくり
function pipeSlope(pipe, worldX){
  const x1 = worldX;
  const x2 = worldX + 6; // ちょい先
  const y1 = pipeSurfaceY(pipe, x1);
  const y2 = pipeSurfaceY(pipe, x2);
  // 上り( yが小さい方向 ) なら正、下りなら負になるように
  return clamp((y1 - y2) / 6, -1.2, 1.2);
}

/* =======================
   RUN UPDATE
======================= */
function updateRun(dt){
  const race = CONFIG.RACES[state.raceIndex];
  const player = state.runners[state.playerIndex];

  state.cameraX = Math.max(0, player.x - Math.floor(CONFIG.LOGICAL_W * 0.18));
  spawnWorld(state.cameraX);

  // 画面外オブジェ整理（重さ対策）
  pruneWorld(state.cameraX);

  state.stockTimer += dt;
  if(state.stockTimer >= CONFIG.STOCK_REGEN){
    state.stockTimer = 0;
    state.stock = Math.min(CONFIG.STOCK_MAX, state.stock + 1);
  }

  for(let idx=0; idx<state.runners.length; idx++){
    const r = state.runners[idx];
    if(r.finished) continue;

    // AI
    if(!r.isPlayer){
      r.aiCd -= dt;
      r.aiBoostCd -= dt;

      if(r.aiCd <= 0){
        r.aiCd = rand(0.25, 0.55);
        const jumpChance = (r.winRate > 0.30) ? 0.060 : 0.018;
        if(Math.random() < jumpChance) doJump(r);
      }

      if(r.aiBoostCd <= 0 && Math.random() < (r.winRate * 0.12)){
        r.aiBoostCd = CONFIG.AI_BOOST_COOLDOWN;
        startBoost(r, CONFIG.BOOST_ADD, CONFIG.BOOST_TIME);
      }
    }

    // PLAYER INPUT
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

    // SPEED
    let speed = CONFIG.BASE_SPEED;

    if(r.boostTimer > 0){
      r.boostTimer -= dt;
      speed += r.boostPower;
    }
    if(r.slowTimer > 0){
      r.slowTimer -= dt;
      speed *= 0.75;
    }

    // dan加速
    if(r.onDan) speed += CONFIG.DAN_SPEED_ADD;

    // or加速（強め）
    if(r.onOr) speed += CONFIG.OR_SPEED_ADD;

    // pipe加速（常時 + 勾配）
    if(r.onPipe && r.pipeRef){
      speed += CONFIG.PIPE_BASE_ADD;
      const s = pipeSlope(r.pipeRef, r.x + r.w*0.5);
      speed += s * CONFIG.PIPE_SLOPE_ADD;
    }

    // --- PIPE FOLLOW (絵に沿ってY) ---
    if(r.onPipe && r.pipeRef){
      const pipe = r.pipeRef;

      const cx = r.x + r.w*0.5;
      const surface = pipeSurfaceY(pipe, cx);

      // 画像上面に沿って走る
      r.y = surface - r.h;
      r.vy = 0;
      r.onGround = true;
      r.jumps = 0;

      // パイプ外へ出たら地面へ
      if(cx >= pipe.x + pipe.w){
        r.onPipe = false;
        r.pipeRef = null;
        r.y = world.groundY - r.h;
      }
    }

    // --- DAN SLOPE ---
    if(r.onDan && r.danRef){
      const d = r.danRef;
      const cx = r.x + r.w * 0.5;
      const t = clamp((cx - d.x) / d.w, 0, 1);

      let topY = d.y;
      const sratio = (d.slopeW / d.w);

      if(t < sratio){
        const tt = t / sratio;
        topY = (world.groundY - (d.h * tt));
      }else if(t > (1 - sratio)){
        const tt = (t - (1 - sratio)) / sratio;
        topY = (world.groundY - (d.h * (1 - tt)));
      }else{
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

    // --- OR PLATFORM ---
    if(r.onOr && r.orRef){
      const o = r.orRef;
      r.y = o.y - r.h;
      r.vy = 0;
      r.onGround = true;
      r.jumps = 0;

      if(r.x + r.w*0.5 >= o.x + o.w){
        r.onOr = false;
        r.orRef = null;
        r.y = world.groundY - r.h;
      }
    }

    // GRAVITY（床処理以外）
    if(!r.onPipe && !r.onDan && !r.onOr){
      r.vy += CONFIG.GRAVITY * dt;
      r.vy = Math.min(r.vy, CONFIG.MAX_FALL_V);
      r.y += r.vy * dt;
    }

    // MOVE X
    r.x += speed * dt;

    // GROUND
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

    // RAIL (上から着地のみ)
    if(!r.onPipe && !r.onDan && !r.onOr){
      for(const rail of world.rails){
        if(rectHit(r.x, r.y, r.w, r.h, rail.x, rail.y, rail.w, rail.h)){
          if(r.vy >= 0 && (r.y + r.h - r.vy * dt) <= rail.y + 2){
            r.y = rail.y - r.h;
            r.vy = 0;
            r.onGround = true;
            r.jumps = 0;
            r.boostPower = Math.max(r.boostPower, 60);
            r.boostTimer = Math.max(r.boostTimer, 0.15);
          }
        }
      }
    }

    // PIPE ENTER (上からのみ)
    if(!r.onPipe && !r.onDan && !r.onOr){
      for(const pipe of world.pipes){
        if(rectHit(r.x, r.y, r.w, r.h, pipe.x, pipe.y, pipe.w, pipe.h)){
          if(r.vy >= 0 && (r.y + r.h - r.vy * dt) <= pipe.y + 2){
            r.onPipe = true;
            r.pipeRef = pipe;
            r.vy = 0;
            r.onGround = true;
            r.jumps = 0;
            break;
          }
        }
      }
    }

    // DAN ENTER（範囲入ったら確実に乗る）
    if(!r.onPipe && !r.onDan && !r.onOr){
      for(const d of world.dans){
        const cx = r.x + r.w*0.5;
        if(cx >= d.x && cx <= d.x + d.w){
          r.onDan = true;
          r.danRef = d;
          r.onGround = true;
          r.vy = 0;
          r.jumps = 0;
          break;
        }
      }
    }

    // OR ENTER（上から着地なら乗る）
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
          }
        }
      }
    }

    // PUDDLE
    for(const p of world.puddles){
      if(rectHit(r.x, r.y, r.w, r.h, p.x, p.y, p.w, p.h)){
        r.slowTimer = 0.40;
      }
    }

    // RING (runner別取得)
    for(const ring of world.rings){
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

    // FINISH
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
}

/* =======================
   DRAW: COVER + BOTTOM ALIGN
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
  const oy = (ch - drawH);

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

function cullByRect(x,w, margin){
  // 左端が右に行きすぎ or 右端が左に行きすぎ でカリング
  const left = x - state.cameraX;
  const right = left + w;
  return (right < -margin) || (left > CONFIG.LOGICAL_W + margin);
}

function drawObjects(){
  // puddle
  ctx.fillStyle = "rgba(120,190,255,0.5)";
  for(const p of world.puddles){
    if(cullByRect(p.x, p.w, 140)) continue;
    const sx = p.x - state.cameraX;
    ctx.fillRect(sx, p.y, p.w, p.h);
  }

  // ring（プレイヤーが取ったものは消える）
  const ringImg = IMAGES.ring;
  if(ringImg){
    const pi = state.playerIndex;
    for(const r of world.rings){
      if(r.takenBy.has(pi)) continue;
      if(cullByRect(r.x-10, 20, 120)) continue;
      const sx = r.x - state.cameraX;
      ctx.drawImage(ringImg, sx - 10, r.y - 10, 20, 20);
    }
  }

  // dan（矩形カリング）
  for(const d of world.dans){
    if(cullByRect(d.x, d.w, 220)) continue;
    const sx = d.x - state.cameraX;
    ctx.drawImage(d.img, sx, d.y, d.w, d.h);
  }

  // or（矩形カリング）
  for(const o of world.ors){
    if(cullByRect(o.x, o.w, 220)) continue;
    const sx = o.x - state.cameraX;
    ctx.drawImage(o.img, sx, o.y, o.w, o.h);
  }

  // pipes（矩形カリング）
  for(const p of world.pipes){
    if(cullByRect(p.x, p.w, 260)) continue;
    const sx = p.x - state.cameraX;
    ctx.drawImage(p.img, sx, p.y, p.w, p.h);
  }

  // rails（連結描画 + 矩形カリング）
  const railImg = IMAGES.rail;
  if(railImg){
    for(const r of world.rails){
      if(cullByRect(r.x, r.w, 220)) continue;
      const sx = r.x - state.cameraX;
      for(let i=0;i<r.segments;i++){
        const dx = sx + i * r.segW;
        ctx.drawImage(railImg, dx, r.y, r.segW, r.h);
      }
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
  if(sx < -140 || sx > CONFIG.LOGICAL_W + 140) return;

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
  const body = (r.onGround || r.onPipe || r.onDan || r.onOr) ? IMAGES.pl1 : IMAGES.pl2;
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
   BOOT (iOS安定化：fit/resizeを2段階)
======================= */
async function boot(){
  try{
    state.phase="loading";
    if(overlay) overlay.style.display = "block";
    if(overlayTitle) overlayTitle.textContent="Loading";
    if(overlayMsg) overlayMsg.textContent="assets";

    await loadAssets();

    fitCanvasToPlayArea();
    resizeCanvas();
    attachVersionBadge();
    stockFill = ensureStockBarFill();

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
