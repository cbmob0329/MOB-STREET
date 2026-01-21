/* =========================================================
   MOB STREET - 1P RUN
   game.js v7.2 (FULL) 5-part split
   PART 1 / 5 : Boot / Canvas / Input / Robust Asset Loader
========================================================= */

"use strict";

/* =========================
   VERSION (操作エリアに表示)
========================= */
const GAME_VERSION = "v7.2";

/* =========================
   CANVAS / VIEWPORT
========================= */
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d", { alpha: true });

let DPR = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
let VIEW_W = 360;
let VIEW_H = 640;

function clamp(v, a, b){ return Math.max(a, Math.min(b, v)); }

function resizeCanvas(){
  // 画面上部HUDと下部操作エリアはHTML/CSS側で分離されている想定。
  // ここでは canvas が入っている親要素のサイズにフィットさせる。
  const parent = canvas.parentElement || document.body;
  const rect = parent.getBoundingClientRect();

  // iOS Safari対策：小数が入ると滲み・黒帯が出やすいので丸め
  const cssW = Math.floor(rect.width);
  const cssH = Math.floor(rect.height);

  DPR = Math.max(1, Math.min(3, window.devicePixelRatio || 1));

  canvas.style.width = cssW + "px";
  canvas.style.height = cssH + "px";

  canvas.width = Math.floor(cssW * DPR);
  canvas.height = Math.floor(cssH * DPR);

  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

  VIEW_W = cssW;
  VIEW_H = cssH;
}
window.addEventListener("resize", resizeCanvas, { passive:true });

/* =========================
   SAFE AREA / UI MARGINS
========================= */
const UI = {
  topMargin: 70,       // HUDが被らない領域（canvas内）
  bottomMargin: 0,     // canvas下はそもそも操作エリア外想定
  leftMargin: 0,
  rightMargin: 0,
  // 画面左上にTOP8を出すためのパネルサイズ（PART3で描画）
  top8PanelW: 132,
  top8PanelH: 190,
};

/* =========================
   INPUT LOCK (iOS 選択/拡大防止)
========================= */
function preventDefault(e){
  if(e && e.cancelable) e.preventDefault();
}
function lockTouchOn(el){
  if(!el) return;
  // iOSで長押し選択/ダブルタップズームを抑制（可能な範囲）
  el.style.webkitUserSelect = "none";
  el.style.userSelect = "none";
  el.style.webkitTouchCallout = "none";
  el.style.touchAction = "manipulation";
  el.addEventListener("contextmenu", (e)=>preventDefault(e));
  el.addEventListener("gesturestart", (e)=>preventDefault(e));
  el.addEventListener("gesturechange", (e)=>preventDefault(e));
  el.addEventListener("gestureend", (e)=>preventDefault(e));
}
lockTouchOn(document.body);
lockTouchOn(canvas);

/* ボタン類（存在すれば）もロック */
lockTouchOn(document.getElementById("btnJump"));
lockTouchOn(document.getElementById("btnBoost"));
lockTouchOn(document.getElementById("btnJumpBoost"));

/* =========================
   ASSET LOADER (永久Loading防止)
   - 失敗しても進む
   - 失敗したファイル名をLoadingに表示
========================= */
const ASSETS = {};
let assetsReady = false;

const ASSET_LIST = [
  // player / board
  "PL1.png.png",
  "PL2.png.png",
  "redsk.png",

  // stage
  "HA.png",
  "st.png",

  // gimmicks
  "gardw.png",
  "hpr.png",
  "hpg.png",
  "dokan.png",
  "or.png",
  "dan.png",

  // items
  "ringtap.png",
];

const LOAD_STATUS = {
  total: 0,
  done: 0,
  ok: [],
  ng: [],
  last: "",
  startedAt: 0,
  forced: false
};

function makePlaceholderImage(w=48, h=48, label="!"){
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const g = c.getContext("2d");
  g.fillStyle = "rgba(255,0,0,0.25)";
  g.fillRect(0,0,w,h);
  g.strokeStyle = "rgba(255,0,0,0.95)";
  g.lineWidth = 2;
  g.strokeRect(1,1,w-2,h-2);
  g.fillStyle = "#fff";
  g.font = "bold 16px sans-serif";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(label, w/2, h/2);
  const img = new Image();
  img.src = c.toDataURL("image/png");
  return img;
}

function loadAssets(){
  LOAD_STATUS.total = ASSET_LIST.length;
  LOAD_STATUS.done = 0;
  LOAD_STATUS.ok.length = 0;
  LOAD_STATUS.ng.length = 0;
  LOAD_STATUS.last = "";
  LOAD_STATUS.startedAt = performance.now();
  LOAD_STATUS.forced = false;

  const bust = `?v=${encodeURIComponent(GAME_VERSION)}&t=${Date.now()}`;

  return new Promise((resolve)=>{
    let resolved = false;

    // 失敗時でも「永久Loading」を防ぐための強制解除（10秒）
    const hardTimeout = setTimeout(()=>{
      if(resolved) return;
      resolved = true;
      LOAD_STATUS.forced = true;
      assetsReady = true;
      resolve();
    }, 10000);

    ASSET_LIST.forEach((name)=>{
      const img = new Image();
      img.crossOrigin = "anonymous";

      const finalize = (ok)=>{
        LOAD_STATUS.done++;
        LOAD_STATUS.last = name;
        if(ok) LOAD_STATUS.ok.push(name);
        else LOAD_STATUS.ng.push(name);

        if(LOAD_STATUS.done >= LOAD_STATUS.total && !resolved){
          clearTimeout(hardTimeout);
          resolved = true;
          assetsReady = true;
          resolve();
        }
      };

      img.onload = ()=> finalize(true);
      img.onerror = ()=>{
        // 読めない画像はプレースホルダーにして進める
        ASSETS[name] = makePlaceholderImage(48,48,"!");
        finalize(false);
      };

      img.src = name + bust;
      ASSETS[name] = img;
    });
  });
}

function drawLoading(){
  ctx.clearRect(0,0,VIEW_W,VIEW_H);

  // 青っぽい背景
  const g = ctx.createLinearGradient(0,0,0,VIEW_H);
  g.addColorStop(0, "#1f5fae");
  g.addColorStop(1, "#0e2b55");
  ctx.fillStyle = g;
  ctx.fillRect(0,0,VIEW_W,VIEW_H);

  const pct = LOAD_STATUS.total ? Math.floor((LOAD_STATUS.done/LOAD_STATUS.total)*100) : 0;

  ctx.fillStyle = "rgba(0,0,0,0.20)";
  ctx.fillRect(0,0,VIEW_W,VIEW_H);

  ctx.fillStyle = "#fff";
  ctx.textAlign = "center";
  ctx.font = "700 34px sans-serif";
  ctx.fillText("Loading...", VIEW_W/2, VIEW_H*0.45);

  ctx.font = "14px sans-serif";
  ctx.fillText("画像を読み込んでいます", VIEW_W/2, VIEW_H*0.45 + 28);

  ctx.font = "14px sans-serif";
  ctx.fillText(`${pct}%  (${LOAD_STATUS.done}/${LOAD_STATUS.total})`, VIEW_W/2, VIEW_H*0.45 + 54);

  ctx.font = "12px sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.fillText(LOAD_STATUS.last ? `... ${LOAD_STATUS.last}` : "", VIEW_W/2, VIEW_H*0.45 + 76);

  if(LOAD_STATUS.ng.length){
    ctx.fillStyle = "rgba(255,220,220,0.95)";
    ctx.font = "12px sans-serif";
    ctx.fillText(`FAILED: ${LOAD_STATUS.ng.join(", ")}`, VIEW_W/2, VIEW_H*0.45 + 102);
  }
  if(LOAD_STATUS.forced){
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.font = "12px sans-serif";
    ctx.fillText(`(強制起動: 読み込みが完了しない画像がある可能性)`, VIEW_W/2, VIEW_H*0.45 + 126);
  }
}

/* =========================
   BASIC UTILS
========================= */
function aabb(ax,ay,aw,ah, bx,by,bw,bh){
  return ax < bx+bw && ax+aw > bx && ay < by+bh && ay+ah > by;
}

/* =========================
   GAME STATE (PART2以降で本体を定義)
========================= */
let gameState = "loading"; // loading | countdown | race | result
let lastTS = 0;

/* =========================
   MAIN LOOP (骨組み)
========================= */
function loop(ts){
  const dt = Math.min(0.033, (ts - lastTS) / 1000 || 0);
  lastTS = ts;

  if(!assetsReady){
    drawLoading();
    requestAnimationFrame(loop);
    return;
  }

  // assetsReady になったら、PART2でinitGame()を呼ぶ
  if(gameState === "loading"){
    // PART2で定義される
    if(typeof initGame === "function"){
      initGame();
      gameState = "countdown";
    }else{
      // 念のため（PART2未結合検知）
      ctx.clearRect(0,0,VIEW_W,VIEW_H);
      ctx.fillStyle = "#000";
      ctx.fillRect(0,0,VIEW_W,VIEW_H);
      ctx.fillStyle = "#fff";
      ctx.textAlign = "center";
      ctx.font = "16px sans-serif";
      ctx.fillText("game.js が途中で切れています（PART2以降が必要）", VIEW_W/2, VIEW_H/2);
      requestAnimationFrame(loop);
      return;
    }
  }

  // PART2以降でupdate/renderを実装
  if(typeof updateGame === "function") updateGame(dt);
  if(typeof renderGame === "function") renderGame();

  requestAnimationFrame(loop);
}

/* =========================
   BOOT
========================= */
(function boot(){
  resizeCanvas();
  loadAssets().then(()=>{
    // assetsReady になったら loop 側で initGame() へ進む
  });
  requestAnimationFrame(loop);
})();
/* =========================================================
   PART 2 / 5
   Constants / Physics / World / Player Init
========================================================= */

/* =========================
   WORLD CONSTANTS
========================= */
const GRAVITY = 2600;          // 重力
const JUMP_VEL = -900;         // 通常ジャンプ
const DOUBLE_JUMP_VEL = -820;  // 2段目
const MAX_FALL = 1800;

const BASE_SPEED = 260;
const MAX_SPEED = 720;

const GROUND_Y_RATIO = 0.78;   // ★ 地面の基準（重要）
let GROUND_Y = 0;

/* =========================
   BACKGROUND (HA.png)
   - 1枚完結
   - 黒帯を出さない
========================= */
const BG = {
  img: null,
  widthM: 2000,   // ゲーム内距離（m）
  scale: 1,
};

function setupBackground(){
  BG.img = ASSETS["HA.png"];
  // 高さ基準で拡大（左右黒帯防止）
  BG.scale = VIEW_H / BG.img.height;
}

/* =========================
   PLAYER
========================= */
const PLAYER = {
  x: 80,
  y: 0,
  w: 36,
  h: 36,
  vy: 0,
  onGround: false,
  canDouble: true,
  imgRun: null,
  imgJump: null,
  board: null,
};

function setupPlayer(){
  PLAYER.imgRun = ASSETS["PL1.png.png"];
  PLAYER.imgJump = ASSETS["PL2.png.png"];
  PLAYER.board = ASSETS["redsk.png"];

  // ★ 地面に必ず乗る初期位置
  PLAYER.y = GROUND_Y - PLAYER.h;
  PLAYER.vy = 0;
  PLAYER.onGround = true;
  PLAYER.canDouble = true;
}

/* =========================
   CAMERA
========================= */
const CAMERA = {
  x: 0,
};

/* =========================
   SPEED / DIST
========================= */
let speed = BASE_SPEED;
let dist = 0;

/* =========================
   INIT GAME (PART1から呼ばれる)
========================= */
function initGame(){
  // 地面Y確定
  GROUND_Y = Math.floor(VIEW_H * GROUND_Y_RATIO);

  setupBackground();
  setupPlayer();

  speed = BASE_SPEED;
  dist = 0;

  gameState = "countdown";
}

/* =========================
   PHYSICS UPDATE
========================= */
function updatePlayer(dt){
  // 重力
  PLAYER.vy += GRAVITY * dt;
  PLAYER.vy = Math.min(PLAYER.vy, MAX_FALL);
  PLAYER.y += PLAYER.vy * dt;

  // 地面判定
  if(PLAYER.y + PLAYER.h >= GROUND_Y){
    PLAYER.y = GROUND_Y - PLAYER.h;
    PLAYER.vy = 0;
    PLAYER.onGround = true;
    PLAYER.canDouble = true;
  }else{
    PLAYER.onGround = false;
  }
}

/* =========================
   INPUT (HTMLボタン想定)
========================= */
function doJump(){
  if(PLAYER.onGround){
    PLAYER.vy = JUMP_VEL;
    PLAYER.onGround = false;
  }else if(PLAYER.canDouble){
    PLAYER.vy = DOUBLE_JUMP_VEL;
    PLAYER.canDouble = false;
  }
}

/* =========================
   UPDATE GAME (骨組み)
========================= */
function updateGame(dt){
  if(gameState === "countdown") return;

  // 距離・スピード
  dist += speed * dt;
  speed = clamp(speed, BASE_SPEED, MAX_SPEED);

  updatePlayer(dt);

  // カメラ追従
  CAMERA.x = dist - 80;
  if(CAMERA.x < 0) CAMERA.x = 0;
}

/* =========================
   RENDER (骨組み)
========================= */
function renderGame(){
  ctx.clearRect(0,0,VIEW_W,VIEW_H);

  // --- 背景 ---
  const bgW = BG.img.width * BG.scale;
  const bgH = BG.img.height * BG.scale;
  ctx.drawImage(
    BG.img,
    0, 0, BG.img.width, BG.img.height,
    -CAMERA.x * (bgW / (BG.widthM)), 0,
    bgW, bgH
  );

  // --- 地面 ---
  ctx.fillStyle = "#7a6a4a";
  ctx.fillRect(0, GROUND_Y, VIEW_W, VIEW_H - GROUND_Y);

  // --- プレイヤー ---
  const img = PLAYER.onGround ? PLAYER.imgRun : PLAYER.imgJump;
  ctx.drawImage(img, PLAYER.x, PLAYER.y, PLAYER.w, PLAYER.h);
  ctx.drawImage(
    PLAYER.board,
    PLAYER.x - 4,
    PLAYER.y + PLAYER.h - 10,
    PLAYER.w + 8,
    14
  );

  // プレイヤーラベル
  ctx.fillStyle = "#fff";
  ctx.font = "12px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("プレイヤー", PLAYER.x + PLAYER.w/2, PLAYER.y - 6);
}
/* =========================================================
   PART 3 / 5
   Gimmicks Spawn / Collision / Halfpipe Slope
========================================================= */

/* =========================
   WORLD SCALE
========================= */
const PX_PER_M = 10; // 1m=10px（距離の見やすさ重視）

/* =========================
   GIMMICK LISTS
========================= */
const gimm = {
  guard: [],   // {x,y,w,h}
  half: [],    // {x,y,w,h,type} type:"blue"|"red"
  dokan: [],   // {x,y,w,h,air}
  truck: [],   // {x,y,w,h}
  dan: [],     // {x,y,w,h}
};

const OCC = []; // occupied ranges {x0,x1,type}

/* =========================
   OCCUPY
========================= */
function occFree(x0, x1){
  for(const o of OCC){
    if(!(x1 < o.x0 || x0 > o.x1)) return false;
  }
  return true;
}
function occAdd(x0, x1, type){
  OCC.push({x0,x1,type});
}

/* =========================
   SPAWN CONTROL (少なめ)
========================= */
let nextGuard = 420;
let nextHalf  = 760;
let nextDokan = 980;
let nextTruck = 1200;
let nextDan   = 1500;

function resetGimmicks(){
  gimm.guard.length = 0;
  gimm.half.length = 0;
  gimm.dokan.length = 0;
  gimm.truck.length = 0;
  gimm.dan.length = 0;
  OCC.length = 0;

  nextGuard = 420;
  nextHalf  = 760;
  nextDokan = 980;
  nextTruck = 1200;
  nextDan   = 1500;
}

/* =========================
   SPAWN
========================= */
function spawnGimmicks(){
  const cam = CAMERA.x;
  const ahead = cam + VIEW_W * 2.0;

  // ガード（低め・少なめ）
  while(nextGuard < ahead){
    const w = 190;
    const h = 30; // 低く
    const x = nextGuard;
    const y = GROUND_Y - h;

    if(occFree(x-40, x+w+40)){
      gimm.guard.push({x,y,w,h});
      occAdd(x-40, x+w+40, "guard");
    }
    nextGuard += 1200 + Math.random()*900;
  }

  // ハーフパイプ（横幅広め）
  while(nextHalf < ahead){
    const w = 520 + Math.random()*260;  // 520〜780（狭さ解消）
    const h = 120 + Math.random()*40;   // 少し高め
    const x = nextHalf;
    const y = GROUND_Y - h;

    if(occFree(x-60, x+w+60)){
      const type = (Math.random() < 0.5) ? "blue" : "red";
      gimm.half.push({x,y,w,h,type});
      occAdd(x-60, x+w+60, "half");
    }
    nextHalf += 1400 + Math.random()*900;
  }

  // 土管（地上/空中）
  while(nextDokan < ahead){
    const w = 92;
    const h = 92;
    const air = Math.random() < 0.35;
    const x = nextDokan;
    const y = air ? (GROUND_Y - 220 - Math.random()*160) : (GROUND_Y - h);

    if(occFree(x-60, x+w+60)){
      gimm.dokan.push({x,y,w,h,air});
      occAdd(x-60, x+w+60, "dokan");
    }
    nextDokan += 1100 + Math.random()*800;
  }

  // トラック（正面衝突）
  while(nextTruck < ahead){
    const w = 160;
    const h = 70;
    const x = nextTruck;
    const y = GROUND_Y - h;

    if(occFree(x-60, x+w+60)){
      gimm.truck.push({x,y,w,h});
      occAdd(x-60, x+w+60, "truck");
    }
    nextTruck += 1300 + Math.random()*900;
  }

  // dan（段：乗ると加速、両端スロープ＝必ず乗れる）
  while(nextDan < ahead){
    const w = 240;
    const h = 56;
    const x = nextDan;
    const y = GROUND_Y - h;

    if(occFree(x-60, x+w+60)){
      gimm.dan.push({x,y,w,h});
      occAdd(x-60, x+w+60, "dan");
    }
    nextDan += 1500 + Math.random()*900;
  }
}

/* =========================
   COLLISION HELPERS
========================= */
function entityBox(ent){
  return {x: ent.x + CAMERA.x, y: ent.y, w: ent.w, h: ent.h}; // worldX = screenX+camera
}

function landOn(ent, obj){
  // ent: {x,y,w,h,vy} screen space (x is screen)
  // obj: {x,y,w,h} world space
  const eWorldX = ent.x + CAMERA.x;
  const prevY = ent.y - ent.vy * (1/60);
  const feetPrev = prevY + ent.h;
  const feetNow  = ent.y + ent.h;

  const inX = (eWorldX + ent.w) > obj.x && eWorldX < (obj.x + obj.w);
  const cross = feetPrev <= obj.y && feetNow >= obj.y;
  return inX && cross && ent.vy >= 0;
}

function knockBack(){
  // 少し後ろに弾く
  dist = Math.max(0, dist - 18);
  speed = Math.max(BASE_SPEED, speed - 40);
}

/* =========================
   HALFPIPE SURFACE
   - 端は地面（乗れる）
   - 中は曲線
========================= */
function halfpipeSurfaceY(hp, worldCenterX){
  const x0 = hp.x;
  const x1 = hp.x + hp.w;
  const t = clamp((worldCenterX - x0) / (hp.w), 0, 1); // 0..1
  // 0..1..0 の形
  const depth = Math.sin(t * Math.PI);
  // 中央が一番深い（上に吸着させるため y は上がるほど小さいので “持ち上げ”）
  const lift = depth * (hp.h * 0.70);
  return (GROUND_Y - PLAYER.h) - lift;
}

/* =========================
   APPLY GIMMICKS to PLAYER
========================= */
function applyGimmicksPlayer(dt){
  const p = PLAYER;
  const pWorldX = p.x + CAMERA.x;

  // ガード：上に乗ると微加速
  for(const g of gimm.guard){
    if(aabb(pWorldX, p.y, p.w, p.h, g.x, g.y, g.w, g.h)){
      if(landOn(p, g)){
        p.y = g.y - p.h;
        p.vy = 0;
        p.onGround = true;
        speed = Math.min(MAX_SPEED, speed + 18);
      }
    }
  }

  // dan：必ず乗れる（スロープ扱い）
  for(const d of gimm.dan){
    // スロープ領域を少し広げる
    const pad = 24;
    if(aabb(pWorldX, p.y, p.w, p.h, d.x - pad, d.y, d.w + pad*2, d.h)){
      // 乗せる
      if(p.y + p.h >= d.y && p.vy >= 0){
        p.y = d.y - p.h;
        p.vy = 0;
        p.onGround = true;
        speed = Math.min(MAX_SPEED, speed + 26);
      }
    }
  }

  // トラック：上に乗れる／正面衝突ノックバック
  for(const t of gimm.truck){
    if(aabb(pWorldX, p.y, p.w, p.h, t.x, t.y, t.w, t.h)){
      if(landOn(p, t)){
        p.y = t.y - p.h;
        p.vy = 0;
        p.onGround = true;
      }else{
        knockBack();
      }
    }
  }

  // 土管：上に乗れる／中に入れば加速（半透明はPART5で描画へ）
  for(const dk of gimm.dokan){
    if(aabb(pWorldX, p.y, p.w, p.h, dk.x, dk.y, dk.w, dk.h)){
      if(landOn(p, dk)){
        p.y = dk.y - p.h;
        p.vy = 0;
        p.onGround = true;
      }else{
        const center = pWorldX + p.w/2;
        const ok = Math.abs(center - (dk.x + dk.w/2)) <= (dk.w * 0.22);
        if(ok){
          p._inDokan = true;
          p._dokanT = 0.70;
          speed = Math.min(MAX_SPEED, speed + 90);
        }else{
          knockBack();
        }
      }
    }
  }

  // ハーフパイプ：吸着して落ちない＋中央ほど加速
  for(const hp of gimm.half){
    const cx = pWorldX + p.w/2;
    if(cx < hp.x || cx > hp.x + hp.w) continue;

    const surfY = halfpipeSurfaceY(hp, cx);
    // 近い場合に面へ吸着
    if(p.y >= surfY - 10 && p.y <= surfY + 28){
      p.y = surfY;
      p.vy = 0;
      p.onGround = true;

      // depth（中央ほど加速）
      const t = clamp((cx - hp.x) / hp.w, 0, 1);
      const depth = Math.sin(t * Math.PI);
      speed = Math.min(MAX_SPEED, speed + 18 + depth*28);
    }
  }

  // 土管中処理
  if(p._inDokan){
    p._dokanT -= dt;
    if(p._dokanT <= 0){
      p._inDokan = false;
    }else{
      speed = Math.min(MAX_SPEED, speed + 60 * dt);
    }
  }
}

/* =========================
   DRAW GIMMICKS
========================= */
function drawGimmicks(){
  const cam = CAMERA.x;

  // guard
  const imgGuard = ASSETS["gardw.png"];
  for(const g of gimm.guard){
    const sx = g.x - cam;
    if(sx < -400 || sx > VIEW_W + 400) continue;
    if(imgGuard && imgGuard.width){
      ctx.drawImage(imgGuard, sx, g.y, g.w, g.h);
    }else{
      ctx.fillStyle = "rgba(255,255,255,0.2)";
      ctx.fillRect(sx, g.y, g.w, g.h);
    }
  }

  // half
  const imgBlue = ASSETS["hpr.png"];
  const imgRed  = ASSETS["hpg.png"];
  for(const hp of gimm.half){
    const sx = hp.x - cam;
    if(sx < -900 || sx > VIEW_W + 900) continue;
    const img = (hp.type === "blue") ? imgBlue : imgRed;
    if(img && img.width){
      ctx.drawImage(img, sx, hp.y, hp.w, hp.h);
    }else{
      ctx.fillStyle = "rgba(120,180,255,0.25)";
      ctx.fillRect(sx, hp.y, hp.w, hp.h);
    }
  }

  // dokan
  const imgDk = ASSETS["dokan.png"];
  for(const dk of gimm.dokan){
    const sx = dk.x - cam;
    if(sx < -300 || sx > VIEW_W + 300) continue;
    if(imgDk && imgDk.width){
      ctx.drawImage(imgDk, sx, dk.y, dk.w, dk.h);
    }else{
      ctx.fillStyle = "rgba(255,255,255,0.18)";
      ctx.fillRect(sx, dk.y, dk.w, dk.h);
    }
  }

  // truck
  const imgTr = ASSETS["or.png"];
  for(const t of gimm.truck){
    const sx = t.x - cam;
    if(sx < -400 || sx > VIEW_W + 400) continue;
    if(imgTr && imgTr.width){
      ctx.drawImage(imgTr, sx, t.y, t.w, t.h);
    }else{
      ctx.fillStyle = "rgba(255,180,100,0.25)";
      ctx.fillRect(sx, t.y, t.w, t.h);
    }
  }

  // dan
  const imgDan = ASSETS["dan.png"];
  for(const d of gimm.dan){
    const sx = d.x - cam;
    if(sx < -400 || sx > VIEW_W + 400) continue;
    if(imgDan && imgDan.width){
      ctx.drawImage(imgDan, sx, d.y, d.w, d.h);
    }else{
      ctx.fillStyle = "rgba(180,255,180,0.22)";
      ctx.fillRect(sx, d.y, d.w, d.h);
    }
  }
}

/* =========================
   HOOK UPDATE/RENDER
   PART2のupdateGame/renderGameに統合
========================= */
const _updateGame_p2 = updateGame;
updateGame = function(dt){
  if(gameState === "countdown") return;

  // 生成
  spawnGimmicks();

  // 元処理
  _updateGame_p2(dt);

  // ギミック反映
  applyGimmicksPlayer(dt);
};

const _renderGame_p2 = renderGame;
renderGame = function(){
  // 元描画（背景/地面/プレイヤー）
  _renderGame_p2();

  // ギミック描画を前に入れたいので、ここでは再描画順を調整する
  // → いったん全消去して順番通り描き直す（軽量）
  ctx.clearRect(0,0,VIEW_W,VIEW_H);

  // 背景
  const bgW = BG.img.width * BG.scale;
  const bgH = BG.img.height * BG.scale;
  // 2000m幅を 0..BG.img.width にマップ（黒帯防止：必ず描画）
  const camM = (CAMERA.x / PX_PER_M);
  const srcW = Math.max(1, Math.floor(BG.img.width * (VIEW_W / (BG.widthM * PX_PER_M))));
  const srcX = clamp(Math.floor(BG.img.width * (camM / BG.widthM)), 0, BG.img.width - srcW);

  ctx.drawImage(BG.img, srcX, 0, srcW, BG.img.height, 0, 0, VIEW_W, VIEW_H);

  // 地面
  ctx.fillStyle = "#6f5e3f";
  ctx.fillRect(0, GROUND_Y, VIEW_W, VIEW_H - GROUND_Y);

  // ギミック
  drawGimmicks();

  // プレイヤー（スケボー込み）
  const img = PLAYER.onGround ? PLAYER.imgRun : PLAYER.imgJump;
  if(PLAYER._inDokan) ctx.globalAlpha = 0.45;
  ctx.drawImage(img, PLAYER.x, PLAYER.y, PLAYER.w, PLAYER.h);
  ctx.globalAlpha = 1;
  ctx.drawImage(PLAYER.board, PLAYER.x - 4, PLAYER.y + PLAYER.h - 10, PLAYER.w + 8, 14);

  // ラベル
  ctx.fillStyle = "#fff";
  ctx.font = "12px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("プレイヤー", PLAYER.x + PLAYER.w/2, PLAYER.y - 6);
};
/* =========================================================
   PART 4 / 5
   CPU / Ranking / Race Flow
========================================================= */

/* =========================
   RACE CONFIG
========================= */
const RACES = [
  { name:"EASY",   goal:600,  start:26, pass:16 },
  { name:"NORMAL", goal:1000, start:16, pass:6  },
  { name:"HARD",   goal:1200, start:8,  pass:8  },
];
let raceIdx = 0;

/* =========================
   CPU PRESETS
========================= */
const CPU_NAMED = [
  { name:"フレンチ", win:0.60 },
  { name:"レッド",   win:0.70 },
  { name:"レッドブルー", win:0.90 },
  { name:"ブラック", win:0.85 },
  { name:"ホワイト", win:0.75 },
];
const CPU_OTHERS = "ABCDEFGHIJKLMNOPQRST".split("").map(n=>({name:n, win:0.30}));

/* =========================
   CPU ENTITY
========================= */
function makeCPU(cfg){
  return {
    name: cfg.name,
    win: cfg.win,
    x: -Math.random()*120,
    y: GROUND_Y - PLAYER.h,
    w: PLAYER.w,
    h: PLAYER.h,
    vy: 0,
    onGround: true,
    canDouble: true,
    finished:false,
    rank:0,
    ring:0,
  };
}

let CPUS = [];

/* =========================
   INIT CPUS
========================= */
function initCPUs(){
  CPUS.length = 0;
  CPU_NAMED.forEach(c=>CPUS.push(makeCPU(c)));
  CPU_OTHERS.forEach(c=>CPUS.push(makeCPU(c)));
}

/* =========================
   CPU AI
========================= */
function cpuJump(cpu){
  if(cpu.onGround){
    cpu.vy = JUMP_VEL;
    cpu.onGround = false;
  }else if(cpu.canDouble){
    cpu.vy = DOUBLE_JUMP_VEL;
    cpu.canDouble = false;
  }
}

function cpuThink(cpu){
  const look = 160 + cpu.win*200;
  const cx = cpu.x + CAMERA.x + look;

  // トラック回避（必須）
  for(const t of gimm.truck){
    if(t.x > cpu.x + CAMERA.x && t.x < cx){
      cpuJump(cpu);
      return;
    }
  }

  // ハーフパイプ積極利用（強CPUほど）
  for(const hp of gimm.half){
    if(hp.x > cpu.x + CAMERA.x && hp.x < cx){
      if(Math.random() < cpu.win) cpuJump(cpu);
      return;
    }
  }

  // 土管狙い（高win）
  for(const dk of gimm.dokan){
    if(dk.x > cpu.x + CAMERA.x && dk.x < cx){
      if(cpu.win >= 0.7) cpuJump(cpu);
      return;
    }
  }

  // 低確率ランダムジャンプ
  if(Math.random() < 0.01 + cpu.win*0.02){
    cpuJump(cpu);
  }
}

/* =========================
   UPDATE CPU
========================= */
function updateCPU(cpu, dt){
  cpuThink(cpu);

  cpu.vy += GRAVITY * dt;
  cpu.vy = Math.min(cpu.vy, MAX_FALL);
  cpu.y += cpu.vy * dt;

  // 地面
  if(cpu.y + cpu.h >= GROUND_Y){
    cpu.y = GROUND_Y - cpu.h;
    cpu.vy = 0;
    cpu.onGround = true;
    cpu.canDouble = true;
  }else{
    cpu.onGround = false;
  }

  // 前進
  cpu.x += (speed * (0.8 + cpu.win*0.4)) * dt;

  // ギミック適用（PART3の関数を流用）
  applyGimmicksPlayer({
    x: cpu.x - CAMERA.x,
    y: cpu.y,
    w: cpu.w,
    h: cpu.h,
    vy: cpu.vy,
    onGround: cpu.onGround,
    canDouble: cpu.canDouble,
    _inDokan: cpu._inDokan,
    _dokanT: cpu._dokanT
  }, dt);
}

/* =========================
   RANKING
========================= */
function updateRanking(){
  const all = [{isPlayer:true, x:dist}, ...CPUS.map(c=>({cpu:c, x:c.x}))];
  all.sort((a,b)=>b.x - a.x);
  all.forEach((r,i)=>{
    if(r.isPlayer) PLAYER.rank = i+1;
    else r.cpu.rank = i+1;
  });
}

/* =========================
   DRAW RANK (ALL)
========================= */
function drawRanking(){
  const pad = 10;
  const w = 160;
  let y = UI.topMargin + 8;

  ctx.fillStyle = "rgba(0,0,0,0.45)";
  ctx.fillRect(pad, y, w, VIEW_H - y - 20);

  ctx.fillStyle = "#fff";
  ctx.font = "12px sans-serif";
  ctx.fillText(`順位 (${RACES[raceIdx].name})`, pad+8, y+16);

  let line = 0;
  const all = [{name:"YOU", rank:PLAYER.rank}, ...CPUS.map(c=>({name:c.name, rank:c.rank}))];
  all.sort((a,b)=>a.rank - b.rank);

  for(const r of all){
    const ty = y + 36 + line*14;
    if(ty > VIEW_H - 20) break;
    ctx.fillText(`${r.rank}. ${r.name}`, pad+8, ty);
    line++;
  }
}

/* =========================
   GOAL / RESULT
========================= */
function checkGoal(){
  const goalPx = RACES[raceIdx].goal * PX_PER_M;
  if(dist >= goalPx){
    finishRace();
  }
}

function finishRace(){
  gameState = "result";
}

/* =========================
   RESULT SCREEN
========================= */
function renderResult(){
  ctx.fillStyle = "rgba(0,0,0,0.7)";
  ctx.fillRect(0,0,VIEW_W,VIEW_H);

  ctx.fillStyle = "#fff";
  ctx.font = "bold 28px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("RESULT", VIEW_W/2, VIEW_H*0.2);

  const all = [{name:"YOU", rank:PLAYER.rank}, ...CPUS.map(c=>({name:c.name, rank:c.rank}))];
  all.sort((a,b)=>a.rank - b.rank);

  ctx.font = "14px sans-serif";
  let y = VIEW_H*0.3;
  for(const r of all){
    ctx.fillText(`${r.rank}. ${r.name}`, VIEW_W/2, y);
    y += 18;
  }

  ctx.font = "16px sans-serif";
  ctx.fillText("タップで次へ", VIEW_W/2, VIEW_H*0.85);
}

/* =========================
   ADVANCE RACE
========================= */
function nextRace(){
  const pass = RACES[raceIdx].pass;

  if(PLAYER.rank > pass){
    alert("GAME OVER");
    location.reload();
    return;
  }

  // 生き残りCPU
  CPUS = CPUS.filter(c=>c.rank <= pass);

  raceIdx++;
  if(raceIdx >= RACES.length){
    alert("ALL CLEAR!");
    location.reload();
    return;
  }

  // リセット
  dist = 0;
  speed = BASE_SPEED;
  CAMERA.x = 0;
  resetGimmicks();
  gameState = "countdown";
}

/* =========================
   HOOK update/render
========================= */
const _updateGame_p3 = updateGame;
updateGame = function(dt){
  if(gameState === "countdown") return;
  if(gameState === "result") return;

  _updateGame_p3(dt);

  CPUS.forEach(c=>updateCPU(c, dt));
  updateRanking();
  checkGoal();
};

const _renderGame_p3 = renderGame;
renderGame = function(){
  if(gameState === "result"){
    renderResult();
    return;
  }

  _renderGame_p3();
  drawRanking();
};

/* =========================
   INPUT: RESULT TAP
========================= */
canvas.addEventListener("pointerdown", ()=>{
  if(gameState === "result"){
    nextRace();
  }
});
/* =========================================================
   PART 5 / 5
   Rings / UI polish / Version / Safety
========================================================= */

/* =========================
   RINGS
========================= */
const RINGS = [];
let nextRing = 360;

function spawnRings(){
  const ahead = CAMERA.x + VIEW_W * 2.0;
  while(nextRing < ahead){
    const air = Math.random() < 0.45;
    const x = nextRing;
    const y = air
      ? GROUND_Y - 120 - Math.random()*160
      : GROUND_Y - 34;

    RINGS.push({x,y,r:14});
    nextRing += 180 + Math.random()*160;
  }
}

function applyRingToEntity(ent){
  for(const ring of RINGS){
    const cx = (ent.x + CAMERA.x) + ent.w/2;
    const cy = ent.y + ent.h/2;
    if(
      cx > ring.x-ring.r && cx < ring.x+ring.r &&
      cy > ring.y-ring.r && cy < ring.y+ring.r
    ){
      ent.ring = (ent.ring||0) + 1;
      if(ent.ring >= 10){
        ent.ring = 0;
        speed = Math.min(MAX_SPEED, speed + 120); // ブースト半分くらい
      }
    }
  }
}

function drawRings(){
  const img = ASSETS["ringtap.png"];
  for(const ring of RINGS){
    const sx = ring.x - CAMERA.x;
    if(sx < -40 || sx > VIEW_W+40) continue;
    if(img && img.width){
      ctx.drawImage(img, sx-ring.r, ring.y-ring.r, ring.r*2, ring.r*2);
    }else{
      ctx.fillStyle = "rgba(255,255,0,0.6)";
      ctx.beginPath();
      ctx.arc(sx, ring.y, ring.r, 0, Math.PI*2);
      ctx.fill();
    }
  }
}

/* =========================
   UI : VERSION (操作エリアと被らない)
========================= */
function drawVersion(){
  ctx.fillStyle = "rgba(0,0,0,0.5)";
  ctx.fillRect(VIEW_W-72, VIEW_H-26, 64, 20);
  ctx.fillStyle = "#fff";
  ctx.font = "11px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(GAME_VERSION, VIEW_W-40, VIEW_H-12);
}

/* =========================
   UI : PLAYER LABEL SAFE
========================= */
function drawPlayerLabel(){
  const y = Math.max(PLAYER.y - 8, UI.topMargin + 10);
  ctx.fillStyle = "#fff";
  ctx.font = "12px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("プレイヤー", PLAYER.x + PLAYER.w/2, y);
}

/* =========================
   HOOK UPDATE / RENDER
========================= */
const _updateGame_p4 = updateGame;
updateGame = function(dt){
  if(gameState === "countdown") return;
  if(gameState === "result") return;

  spawnRings();

  _updateGame_p4(dt);

  // プレイヤー
  applyRingToEntity(PLAYER);

  // CPU
  CPUS.forEach(c=>applyRingToEntity(c));
};

const _renderGame_p4 = renderGame;
renderGame = function(){
  if(gameState === "result"){
    _renderGame_p4();
    return;
  }

  // 元描画（背景・地面・ギミック・プレイヤー）
  _renderGame_p4();

  // リング
  drawRings();

  // ラベル上書き（被り防止）
  drawPlayerLabel();

  // バージョン
  drawVersion();
};

/* =========================
   SAFETY
========================= */
// NaN防止
setInterval(()=>{
  if(!Number.isFinite(dist)) dist = 0;
  if(!Number.isFinite(speed)) speed = BASE_SPEED;
}, 1000);
