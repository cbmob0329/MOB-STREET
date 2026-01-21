/* =========================================================
   MOB STREET - 1P RUN
   game.js v7.1
   PART 1 / 5
   基盤 / 定数 / 状態 / 座標系 / 基本描画
========================================================= */

/* =========================
   VERSION
========================= */
const GAME_VERSION = "v7.1";

/* =========================
   CANVAS / VIEWPORT
========================= */
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

let VIEW_W = 0;
let VIEW_H = 0;
let DPR = window.devicePixelRatio || 1;

function resizeCanvas() {
  VIEW_W = window.innerWidth;
  VIEW_H = window.innerHeight;

  canvas.width = VIEW_W * DPR;
  canvas.height = VIEW_H * DPR;
  canvas.style.width = VIEW_W + "px";
  canvas.style.height = VIEW_H + "px";

  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
}
window.addEventListener("resize", resizeCanvas);
resizeCanvas();

/* =========================
   WORLD SCALE / GROUND
========================= */
/*
  重要：
  ・キャラが埋まる問題の根本対策
  ・UI領域とプレイ領域を完全分離
*/
const UI_SAFE_TOP = 90;
const UI_SAFE_BOTTOM = 180;

const WORLD = {
  gravity: 0.9,
  groundY: () => VIEW_H - UI_SAFE_BOTTOM,
  scrollX: 0
};

/* =========================
   GAME STATE
========================= */
const STATE = {
  BOOT: 0,
  COUNTDOWN: 1,
  RUN: 2,
  RESULT: 3
};

let gameState = STATE.BOOT;

/* =========================
   TIME
========================= */
let lastTime = 0;
let delta = 0;

/* =========================
   INPUT
========================= */
const INPUT = {
  jump: false,
  boost: false,
  jumpPressed: false,
  boostPressed: false
};

function resetInputFrame() {
  INPUT.jumpPressed = false;
  INPUT.boostPressed = false;
}

/* =========================
   PLAYER BASE PARAM
========================= */
const PLAYER_BASE = {
  width: 48,
  height: 48,
  jumpPower: 16,
  maxSpeed: 260,
  accel: 0.45
};

/* =========================
   PLAYER
========================= */
const player = {
  x: 120,
  y: 0,
  vy: 0,
  speed: 0,
  onGround: false,
  jumpCount: 0,
  ring: 0,
  boostStock: 0,
  ghost: false
};

/* =========================
   CPU RUNNERS
========================= */
const runners = []; // 初期化はPART2

/* =========================
   CAMERA
========================= */
const CAMERA = {
  x: 0,
  y: 0
};

/* =========================
   ASSETS
========================= */
const ASSETS = {};
const ASSET_LIST = [
  "PL1.png.png",
  "PL2.png.png",
  "gardw.png",
  "hpr.png",
  "hpg.png",
  "ringtap.png",
  "HA.png",
  "dokan.png",
  "or.png",
  "dan.png"
];

let assetsLoaded = 0;
let assetsReady = false;

function loadAssets() {
  ASSET_LIST.forEach(src => {
    const img = new Image();
    img.onload = () => {
      assetsLoaded++;
      if (assetsLoaded === ASSET_LIST.length) {
        assetsReady = true;
      }
    };
    img.src = src;
    ASSETS[src] = img;
  });
}
loadAssets();

/* =========================
   COUNTDOWN
========================= */
let countdown = 3;
let countdownTimer = 0;

/* =========================
   UI TEXT
========================= */
function drawVersion() {
  ctx.save();
  ctx.globalAlpha = 0.7;
  ctx.fillStyle = "#fff";
  ctx.font = "12px sans-serif";
  ctx.textAlign = "right";
  ctx.fillText(
    GAME_VERSION,
    VIEW_W - 12,
    VIEW_H - 12
  );
  ctx.restore();
}

/* =========================
   BACKGROUND (HA.png)
========================= */
const BG = {
  x: 0,
  speed: 0.25
};

function drawBackground() {
  const img = ASSETS["HA.png"];
  if (!img) return;

  const scale = VIEW_H / img.height;
  const w = img.width * scale;

  let x = -(WORLD.scrollX * BG.speed) % w;
  ctx.drawImage(img, x, 0, w, VIEW_H);
  ctx.drawImage(img, x + w, 0, w, VIEW_H);
}

/* =========================
   PLAYER PHYSICS
========================= */
function updatePlayer() {
  // gravity
  player.vy += WORLD.gravity;
  player.y += player.vy;

  const ground = WORLD.groundY() - PLAYER_BASE.height;
  if (player.y >= ground) {
    player.y = ground;
    player.vy = 0;
    player.onGround = true;
    player.jumpCount = 0;
  } else {
    player.onGround = false;
  }

  // speed
  if (player.speed < PLAYER_BASE.maxSpeed) {
    player.speed += PLAYER_BASE.accel;
  }

  WORLD.scrollX += player.speed;
}

/* =========================
   PLAYER JUMP
========================= */
function playerJump() {
  if (player.onGround || player.jumpCount < 2) {
    player.vy = -PLAYER_BASE.jumpPower;
    player.jumpCount++;
    player.onGround = false;
  }
}

/* =========================
   DRAW PLAYER
========================= */
function drawPlayer() {
  const img = ASSETS["PL1.png.png"];
  if (!img) return;

  ctx.drawImage(
    img,
    player.x,
    player.y,
    PLAYER_BASE.width,
    PLAYER_BASE.height
  );

  // label
  ctx.fillStyle = "#fff";
  ctx.font = "10px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("プレイヤー", player.x + PLAYER_BASE.width / 2, player.y - 6);
}

/* =========================
   MAIN LOOP
========================= */
function loop(t) {
  delta = t - lastTime;
  lastTime = t;

  ctx.clearRect(0, 0, VIEW_W, VIEW_H);

  if (!assetsReady) {
    ctx.fillStyle = "#fff";
    ctx.fillText("Loading...", VIEW_W / 2, VIEW_H / 2);
    requestAnimationFrame(loop);
    return;
  }

  drawBackground();

  switch (gameState) {
    case STATE.BOOT:
      gameState = STATE.COUNTDOWN;
      break;

    case STATE.COUNTDOWN:
      countdownTimer += delta;
      if (countdownTimer > 1000) {
        countdown--;
        countdownTimer = 0;
        if (countdown <= 0) gameState = STATE.RUN;
      }
      ctx.fillStyle = "#fff";
      ctx.font = "64px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(countdown, VIEW_W / 2, VIEW_H / 2);
      break;

    case STATE.RUN:
      updatePlayer();
      drawPlayer();
      break;

    case STATE.RESULT:
      break;
  }

  drawVersion();
  resetInputFrame();
  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);
/* =========================================================
   PART 2 / 5
   CPU生成 / 順位管理 / AI基礎（ジャンプ判断の土台）
========================================================= */

/* =========================
   CPU DEFINITIONS
========================= */
const CPU_PRESETS = [
  { name:"フレンチ", win:0.60 },
  { name:"レッド", win:0.70 },
  { name:"レッドブルー", win:0.90 },
  { name:"ブラック", win:0.85 },
  { name:"ホワイト", win:0.75 }
];

const CPU_LETTERS = "ABCDEFGHIJKLMNOPQRST".split(""); // 20人

/* =========================
   CREATE CPU
========================= */
function createCPU(name, winRate){
  return {
    name,
    winRate,

    x: 0,
    y: 0,
    vy: 0,

    speed: 0,
    onGround: false,
    jumpCount: 0,

    thinkTimer: Math.random() * 30,
    wantJump: false,

    finished: false,
    rank: 0
  };
}

/* =========================
   INIT RUNNERS
========================= */
function initRunners(){
  runners.length = 0;

  // 名前付きCPU
  CPU_PRESETS.forEach(c=>{
    runners.push(createCPU(c.name, c.win));
  });

  // その他CPU
  CPU_LETTERS.forEach(l=>{
    runners.push(createCPU(l, 0.30));
  });

  // 初期位置を少しずらす
  runners.forEach((r,i)=>{
    r.x = -i * 18;
    r.y = WORLD.groundY() - PLAYER_BASE.height;
  });
}
initRunners();

/* =========================
   CPU AI (BASE)
   ※ギミック認識はPART3以降
========================= */
function updateCPU(cpu){
  // gravity
  cpu.vy += WORLD.gravity;
  cpu.y += cpu.vy;

  const ground = WORLD.groundY() - PLAYER_BASE.height;
  if(cpu.y >= ground){
    cpu.y = ground;
    cpu.vy = 0;
    cpu.onGround = true;
    cpu.jumpCount = 0;
  }else{
    cpu.onGround = false;
  }

  // speed
  if(cpu.speed < PLAYER_BASE.maxSpeed * cpu.winRate){
    cpu.speed += PLAYER_BASE.accel * cpu.winRate;
  }

  // AI thinking
  cpu.thinkTimer -= 1;
  if(cpu.thinkTimer <= 0){
    cpu.thinkTimer = 20 + Math.random() * 40;

    // 勝率が高いほどジャンプ判断が多い
    cpu.wantJump = Math.random() < cpu.winRate;
  }

  // jump
  if(cpu.wantJump && cpu.onGround){
    cpu.vy = -PLAYER_BASE.jumpPower;
    cpu.jumpCount++;
    cpu.wantJump = false;
  }

  cpu.x += cpu.speed;
}

/* =========================
   UPDATE ALL RUNNERS
========================= */
function updateRunners(){
  runners.forEach(cpu=>{
    updateCPU(cpu);
  });
}

/* =========================
   DRAW CPUs
========================= */
function drawCPUs(){
  const img = ASSETS["PL1.png.png"];
  if(!img) return;

  runners.forEach(cpu=>{
    const sx = cpu.x - WORLD.scrollX + player.x;

    if(sx < -60 || sx > VIEW_W + 60) return;

    ctx.drawImage(
      img,
      sx,
      cpu.y,
      PLAYER_BASE.width,
      PLAYER_BASE.height
    );

    ctx.fillStyle = "#ddd";
    ctx.font = "9px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(cpu.name, sx + PLAYER_BASE.width/2, cpu.y - 4);
  });
}

/* =========================
   RANKING
========================= */
function updateRanking(){
  const all = [player, ...runners];
  all.sort((a,b)=>b.x - a.x);
  all.forEach((r,i)=>r.rank = i + 1);
}

/* =========================
   DRAW TOP8
========================= */
function drawTop8(){
  const all = [player, ...runners].slice().sort((a,b)=>a.rank - b.rank);
  const top = all.slice(0,8);

  ctx.save();
  ctx.globalAlpha = 0.75;
  ctx.fillStyle = "#000";
  ctx.fillRect(10, 10, 120, 140);

  ctx.fillStyle = "#fff";
  ctx.font = "11px sans-serif";
  ctx.fillText("TOP 8", 20, 26);

  top.forEach((r,i)=>{
    const name = r === player ? "YOU" : r.name;
    ctx.fillText(`${i+1}. ${name}`, 20, 44 + i*14);
  });

  ctx.restore();
}

/* =========================
   HOOK INTO MAIN LOOP
========================= */
// RUNフェーズ拡張
const _oldUpdatePlayer = updatePlayer;
updatePlayer = function(){
  _oldUpdatePlayer();
  updateRunners();
  updateRanking();
};

// 描画拡張
const _oldDrawPlayer = drawPlayer;
drawPlayer = function(){
  _oldDrawPlayer();
  drawCPUs();
  drawTop8();
};
/* =========================================================
   PART 3 / 5
   GIMMICKS + AI LOOKAHEAD + HA.png SAFE DRAW (CROP)
========================================================= */

/* =========================
   INPUT (robust)
   既存HTMLに依存しすぎない形で追加
========================= */
(function bindInputs(){
  // 既存ボタンがある場合のみ拾う（無ければキー入力は維持）
  const jumpBtn = document.getElementById("btnJump") || document.getElementById("jump") || null;
  const boostBtn = document.getElementById("btnBoost") || document.getElementById("boost") || null;

  const onJump = (e)=>{ try{ e.preventDefault(); }catch(_){} INPUT.jumpPressed = true; INPUT.jump = true; };
  const onBoost = (e)=>{ try{ e.preventDefault(); }catch(_){} INPUT.boostPressed = true; INPUT.boost = true; };

  if(jumpBtn){
    jumpBtn.addEventListener("pointerdown", onJump, {passive:false});
    jumpBtn.addEventListener("touchstart", onJump, {passive:false});
  }
  if(boostBtn){
    boostBtn.addEventListener("pointerdown", onBoost, {passive:false});
    boostBtn.addEventListener("touchstart", onBoost, {passive:false});
  }

  window.addEventListener("keydown", (e)=>{
    if(e.code === "Space"){ INPUT.jumpPressed = true; INPUT.jump = true; }
    if(e.key === "b"){ INPUT.boostPressed = true; INPUT.boost = true; }
  });
})();

/* =========================
   HA.png SAFE DRAW (CROP)
   ※帯状崩れ対策：drawImageの切り出しで表示
========================= */
const TRACK_METERS = 2000;
const TRACK_PIXELS = TRACK_METERS * 10; // 1m=10px（現行基準）

drawBackground = function(){
  const img = ASSETS["HA.png"];
  if(!img || !img.width || !img.height) return;

  // カメラ：WORLD.scrollX を 0..TRACK_PIXELS にクランプ
  const cam = Math.max(0, Math.min(WORLD.scrollX, TRACK_PIXELS - 1));

  // cam(0..TRACK_PIXELS) を srcX(0..img.width) にマップ
  const viewRatio = VIEW_W / TRACK_PIXELS;            // 表示幅が全体の何割か
  const srcW = Math.max(1, Math.floor(img.width * viewRatio));
  const srcX = Math.max(0, Math.min(img.width - srcW, Math.floor(img.width * (cam / TRACK_PIXELS))));

  // 画像から横を切り出して画面にフィット
  ctx.drawImage(
    img,
    srcX, 0, srcW, img.height,
    0, 0, VIEW_W, VIEW_H
  );
};

/* =========================
   GIMMICKS DATA
========================= */
const GIMMICKS = {
  halfpipes: [],  // {x,w,variant}
  dokans: [],     // {x,y,w,h,air}
  trucks: [],     // {x,y,w,h}
  dans: [],       // {x,y,w,h}
};

const OCCUPY = []; // {x0,x1,type} 被り防止

function isFreeRange(x0, x1){
  for(const o of OCCUPY){
    if(!(x1 < o.x0 || x0 > o.x1)) return false;
  }
  return true;
}
function reserveRange(x0,x1,type){
  OCCUPY.push({x0,x1,type});
}

/* =========================
   SPAWN SETTINGS (少なめ)
========================= */
let nextHalfX = 700;
let nextDokanX = 850;
let nextTruckX = 950;
let nextDanX = 1200;

function spawnGimmicks(){
  const cam = WORLD.scrollX;
  const ahead = cam + VIEW_W * 1.8;

  // ハーフパイプ（横幅を広く）
  while(nextHalfX < ahead && nextHalfX < TRACK_PIXELS - 200){
    const hpr = ASSETS["hpr.png"];
    const hpg = ASSETS["hpg.png"];
    const img = (Math.random() < 0.5 ? hpr : hpg);

    // 横幅：以前より明確に広く
    const w = 360 + Math.floor(Math.random() * 220); // 360〜580px（狭さ解消）
    const x = nextHalfX;

    // 被りチェック（ガード/トラック/土管/danと同列被り禁止）
    if(isFreeRange(x-40, x+w+40)){
      GIMMICKS.halfpipes.push({x, w, imgKey: (img===hpr?"hpr.png":"hpg.png")});
      reserveRange(x-40, x+w+40, "halfpipe");
    }
    nextHalfX += 950 + Math.random()*650;
  }

  // 土管（地上/空中）
  while(nextDokanX < ahead && nextDokanX < TRACK_PIXELS - 200){
    const img = ASSETS["dokan.png"];
    if(!img || !img.width) { nextDokanX += 900; continue; }

    const w = 92;
    const h = 92;
    const air = Math.random() < 0.35;
    const x = nextDokanX;
    const y = air ? (WORLD.groundY() - 220 - Math.random()*140) : (WORLD.groundY() - h);

    if(isFreeRange(x-30, x+w+30)){
      GIMMICKS.dokans.push({x,y,w,h,air});
      reserveRange(x-30, x+w+30, "dokan");
    }
    nextDokanX += 900 + Math.random()*650;
  }

  // トラック（正面衝突で弾かれる）
  while(nextTruckX < ahead && nextTruckX < TRACK_PIXELS - 200){
    const img = ASSETS["or.png"];
    if(!img || !img.width) { nextTruckX += 1100; continue; }

    const w = 150;
    const h = 70;
    const x = nextTruckX;
    const y = WORLD.groundY() - h;

    if(isFreeRange(x-40, x+w+40)){
      GIMMICKS.trucks.push({x,y,w,h});
      reserveRange(x-40, x+w+40, "truck");
    }
    nextTruckX += 1100 + Math.random()*700;
  }

  // dan（必ず乗れる加速台：幅を大きめに）
  while(nextDanX < ahead && nextDanX < TRACK_PIXELS - 260){
    const img = ASSETS["dan.png"];
    if(!img || !img.width) { nextDanX += 1400; continue; }

    const w = 210;
    const h = 64;
    const x = nextDanX;
    const y = WORLD.groundY() - h;

    if(isFreeRange(x-40, x+w+40)){
      GIMMICKS.dans.push({x,y,w,h});
      reserveRange(x-40, x+w+40, "dan");
    }
    nextDanX += 1400 + Math.random()*800;
  }
}

/* =========================
   COLLISION HELPERS
========================= */
function aabb(ax,ay,aw,ah,bx,by,bw,bh){
  return ax < bx+bw && ax+aw > bx && ay < by+bh && ay+ah > by;
}
function landOnTop(ent, obj){
  // “上に乗る”判定（簡易）
  const prevY = ent.y - ent.vy;
  const feetNow = ent.y + PLAYER_BASE.height;
  const feetPrev = prevY + PLAYER_BASE.height;

  const inX = (ent.x + PLAYER_BASE.width) > obj.x && ent.x < (obj.x + obj.w);
  const cross = feetPrev <= obj.y && feetNow >= obj.y;
  return inX && cross && ent.vy >= 0;
}

/* =========================
   PLAYER / CPU : APPLY GIMMICKS
========================= */
function applyGimmicksToEntity(ent, isPlayer){
  const ground = WORLD.groundY() - PLAYER_BASE.height;

  // トラック：上に乗れる／正面衝突はノックバック
  for(const t of GIMMICKS.trucks){
    if(aabb(ent.x, ent.y, PLAYER_BASE.width, PLAYER_BASE.height, t.x, t.y, t.w, t.h)){
      if(landOnTop(ent, t)){
        ent.y = t.y - PLAYER_BASE.height;
        ent.vy = 0;
        ent.onGround = true;
      }else{
        // 正面衝突ノックバック
        ent.x -= 34;
        if(isPlayer) ent.speed = Math.max(ent.speed - 12, 0);
      }
    }
  }

  // dan：上にいる間 加速（必ず乗れる設計）
  for(const d of GIMMICKS.dans){
    if(aabb(ent.x, ent.y, PLAYER_BASE.width, PLAYER_BASE.height, d.x, d.y, d.w, d.h)){
      if(landOnTop(ent, d)){
        ent.y = d.y - PLAYER_BASE.height;
        ent.vy = 0;
        ent.onGround = true;
        ent.speed = Math.min(ent.speed + 3.2, PLAYER_BASE.maxSpeed + 60);
      }
    }
  }

  // 土管：上に乗れる／成功侵入で加速＋半透明フラグ
  for(const p of GIMMICKS.dokans){
    const hit = aabb(ent.x, ent.y, PLAYER_BASE.width, PLAYER_BASE.height, p.x, p.y, p.w, p.h);
    if(!hit) continue;

    // 上に乗る
    if(landOnTop(ent, p)){
      ent.y = p.y - PLAYER_BASE.height;
      ent.vy = 0;
      ent.onGround = true;
      continue;
    }

    // “中に入る”成功条件：中心寄りで接触
    const center = ent.x + PLAYER_BASE.width/2;
    const ok = Math.abs(center - (p.x + p.w/2)) <= (p.w * 0.20);

    if(ok){
      // 侵入：一時的に加速（PART4で半透明描画）
      ent._inDokan = true;
      ent._dokanTimer = 0.70;
      ent.speed = Math.min(ent.speed + 10, PLAYER_BASE.maxSpeed + 120);
    }else{
      // 失敗：少し弾かれる
      ent.x -= 22;
      if(isPlayer) ent.speed = Math.max(ent.speed - 10, 0);
    }
  }

  // ハーフパイプ：中に入ったら坂で加速（簡易sin曲線）
  for(const hp of GIMMICKS.halfpipes){
    const x0 = hp.x;
    const x1 = hp.x + hp.w;
    const mid = (x0 + x1) * 0.5;
    const cx = ent.x + PLAYER_BASE.width/2;

    if(cx < x0 || cx > x1) continue;

    // パイプのYを計算（底を ground、両端も ground）
    const t = (cx - x0) / (hp.w);
    const depth = Math.sin(t * Math.PI); // 0..1..0
    const lift = depth * 70;             // 深さ（加速のためのカーブ量）
    const targetY = (ground) - lift;

    // 落下しているときにパイプ面に吸着
    if(ent.y >= targetY - 6 && ent.y <= targetY + 22){
      ent.y = targetY;
      ent.vy = 0;
      ent.onGround = true;
      // 坂加速：中央ほど加速
      ent.speed = Math.min(ent.speed + 2.2 + depth*2.4, PLAYER_BASE.maxSpeed + 120);
    }
  }
}

/* =========================
   AI LOOKAHEAD (avoid / use gimmicks)
   トラックで詰まない / dan・ハーフパイプ・土管を使う
========================= */
function aiDecide(cpu){
  const lookMin = 140;
  const lookMax = 240;
  const look = lookMin + cpu.winRate * (lookMax - lookMin);

  const frontX = cpu.x + look;

  // 危険：トラック正面（地上）を検出 → ジャンプ
  for(const t of GIMMICKS.trucks){
    if(t.x > cpu.x && t.x < frontX){
      const sameLane = Math.abs((WORLD.groundY() - PLAYER_BASE.height) - cpu.y) < 8;
      if(sameLane){
        return { jump:true };
      }
    }
  }

  // 利用：dan が近い → 乗る（早めジャンプは不要、地上維持）
  for(const d of GIMMICKS.dans){
    if(d.x > cpu.x && d.x < frontX){
      return { jump:false };
    }
  }

  // 利用：ハーフパイプが近い → 中央に乗るため軽くジャンプ（勝率高いほど）
  for(const hp of GIMMICKS.halfpipes){
    if(hp.x > cpu.x && hp.x < frontX){
      if(Math.random() < (0.15 + cpu.winRate*0.35)){
        return { jump:true };
      }
    }
  }

  // 土管：成功条件が厳しいので、勝率が高いCPUは狙う／低いCPUは避ける
  for(const p of GIMMICKS.dokans){
    if(p.x > cpu.x && p.x < frontX){
      if(cpu.winRate >= 0.7){
        // 狙う：中央に近い軌道を作りたい → ジャンプで調整
        if(Math.random() < 0.35) return { jump:true };
      }else{
        // 避ける：当たって弾かれるよりジャンプ
        return { jump:true };
      }
    }
  }

  // 既存のランダムジャンプ（軽く）
  if(cpu.onGround && Math.random() < (0.01 + cpu.winRate*0.03)){
    return { jump:true };
  }

  return { jump:false };
}

/* =========================
   HOOK CPU UPDATE: replace jump rule
========================= */
const _oldUpdateCPU = updateCPU;
updateCPU = function(cpu){
  // 先に通常更新（重力/速度）※中のjump処理は下で上書き
  // 一旦wantJumpを無効化して、aiDecideに一本化
  cpu.wantJump = false;

  // gravity/speed等は元関数を使うが、jumpだけはここで
  // 元関数のjumpが走る前に wantJump=false にしている
  _oldUpdateCPU(cpu);

  // 先読みAI（ギミック回避）
  const act = aiDecide(cpu);
  if(act.jump && cpu.onGround){
    cpu.vy = -PLAYER_BASE.jumpPower;
    cpu.jumpCount++;
    cpu.onGround = false;
  }

  // ギミック適用（トラック衝突回避の仕上げ）
  applyGimmicksToEntity(cpu, false);
};

/* =========================
   HOOK PLAYER UPDATE: apply gimmicks + input
========================= */
const _oldUpdatePlayer2 = updatePlayer;
updatePlayer = function(){
  // ギミック生成
  spawnGimmicks();

  // 入力→ジャンプ
  if(INPUT.jumpPressed){
    playerJump();
  }

  // 先に通常更新
  _oldUpdatePlayer2();

  // ギミック適用
  applyGimmicksToEntity(player, true);

  // 土管中：タイマー処理（半透明は描画で）
  if(player._inDokan){
    player._dokanTimer -= 1/60;
    if(player._dokanTimer <= 0){
      player._inDokan = false;
    }else{
      // 中移動中は加速継続
      player.speed = Math.min(player.speed + 0.9, PLAYER_BASE.maxSpeed + 140);
    }
  }
};

/* =========================
   HOOK PLAYER DRAW: dokan半透明（描画側）
========================= */
const _oldDrawPlayer2 = drawPlayer;
drawPlayer = function(){
  // CPU/Top8はPART2のdrawPlayerフック内で呼ばれる構造なので
  // ここは “プレイヤー本体描画” のみ差し替え
  const img = ASSETS["PL1.png.png"];
  if(!img) return;

  ctx.save();
  if(player._inDokan) ctx.globalAlpha = 0.45;
  ctx.drawImage(img, player.x, player.y, PLAYER_BASE.width, PLAYER_BASE.height);
  ctx.restore();

  // label
  ctx.fillStyle = "#fff";
  ctx.font = "10px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("プレイヤー", player.x + PLAYER_BASE.width / 2, player.y - 6);
};

/* =========================
   DRAW GIMMICKS
========================= */
function drawGimmicks(){
  const cam = WORLD.scrollX;

  // halfpipes
  for(const hp of GIMMICKS.halfpipes){
    const img = ASSETS[hp.imgKey];
    if(!img) continue;
    const sx = hp.x - cam + player.x;
    if(sx < -600 || sx > VIEW_W + 600) continue;

    // 高さは見た目優先で固定（狭く見えないよう少し高め）
    const h = 120;
    const y = WORLD.groundY() - h;
    ctx.drawImage(img, sx, y, hp.w, h);
  }

  // dokan
  const dokan = ASSETS["dokan.png"];
  if(dokan){
    for(const p of GIMMICKS.dokans){
      const sx = p.x - cam + player.x;
      if(sx < -200 || sx > VIEW_W + 200) continue;
      ctx.drawImage(dokan, sx, p.y, p.w, p.h);
    }
  }

  // truck
  const tr = ASSETS["or.png"];
  if(tr){
    for(const t of GIMMICKS.trucks){
      const sx = t.x - cam + player.x;
      if(sx < -240 || sx > VIEW_W + 240) continue;
      ctx.drawImage(tr, sx, t.y, t.w, t.h);
    }
  }

  // dan
  const dan = ASSETS["dan.png"];
  if(dan){
    for(const d of GIMMICKS.dans){
      const sx = d.x - cam + player.x;
      if(sx < -240 || sx > VIEW_W + 240) continue;
      ctx.drawImage(dan, sx, d.y, d.w, d.h);
    }
  }
}

/* =========================
   HOOK DRAW: insert gimmicks behind runners
========================= */
const _oldDrawCPUs = drawCPUs;
drawCPUs = function(){
  // 先にギミック（足場）を描く
  drawGimmicks();
  // CPU
  _oldDrawCPUs();
};
/* =========================================================
   PART 4 / 5
   RACE FLOW / FINISH / RESULT POPUP(全員) / GAME OVER
   + 描画フローを整理（ギミック→CPU→プレイヤー→TOP8）
========================================================= */

/* =========================
   RACE CONFIG
========================= */
const RACE_LIST = [
  { name:"EASY",   goalM:  600, start:26, survive:16 },
  { name:"NORMAL", goalM: 1000, start:16, survive: 6 },
  { name:"HARD",   goalM: 1200, start: 8, survive: 8 } // HARDは全員表示（6+銀金を想定しやすいが、今回は残ってる全員）
];

let raceIndex = 0;
let raceTimeSec = 0;

/* =========================
   WORLD X helper
========================= */
function worldX(ent){
  // playerはスクロール距離が実質の走行距離
  return (ent === player) ? WORLD.scrollX : ent.x;
}

/* =========================
   RESET / SETUP RACE
========================= */
function setupRace(idx, keepRunners){
  raceIndex = idx;
  raceTimeSec = 0;

  // gimmicks reset（走行距離が変わると生成がズレるのでリセット）
  GIMMICKS.halfpipes.length = 0;
  GIMMICKS.dokans.length = 0;
  GIMMICKS.trucks.length = 0;
  GIMMICKS.dans.length = 0;
  OCCUPY.length = 0;

  nextHalfX = 700;
  nextDokanX = 850;
  nextTruckX = 950;
  nextDanX = 1200;

  // player reset
  player.x = 120;
  player.y = WORLD.groundY() - PLAYER_BASE.height;
  player.vy = 0;
  player.speed = 0;
  player.onGround = true;
  player.jumpCount = 0;
  player.finished = false;
  player.finishTime = Infinity;

  // WORLD distance
  WORLD.scrollX = 0;

  // runners
  if(!keepRunners){
    initRunners();
  }

  const cfg = RACE_LIST[idx];
  // start人数に切る（keep時は既存をそのまま残す）
  if(runners.length + 1 > cfg.start){
    // 既に残っている数がstartより多い時だけ、後ろから落とす（念のため）
    runners.length = Math.max(0, cfg.start - 1);
  }

  runners.forEach((r,i)=>{
    r.x = -i * 18;
    r.y = WORLD.groundY() - PLAYER_BASE.height;
    r.vy = 0;
    r.speed = 0;
    r.onGround = true;
    r.jumpCount = 0;

    r.finished = false;
    r.finishTime = Infinity;
  });

  // countdown reset
  countdown = 3;
  countdownTimer = 0;
  gameState = STATE.COUNTDOWN;

  hideModal();
}

/* =========================
   FINISH CHECK
========================= */
function checkFinishRace(){
  const cfg = RACE_LIST[raceIndex];
  const goalPx = cfg.goalM * 10; // 1m=10px

  // finish flags
  if(!player.finished && worldX(player) >= goalPx){
    player.finished = true;
    player.finishTime = raceTimeSec;
  }
  runners.forEach(r=>{
    if(!r.finished && worldX(r) >= goalPx){
      r.finished = true;
      r.finishTime = raceTimeSec + (Math.random()*0.15); // 同着崩し
    }
  });

  // 全員ゴールしたらリザルトへ
  const all = [player, ...runners];
  const allFinished = all.every(r=>r.finished);
  if(allFinished){
    showResultAndEliminate();
  }
}

/* =========================
   RESULT MODAL (DOM) - 全員分スクロール
========================= */
let modalRoot = null;
let modalTitle = null;
let modalBody = null;
let modalBtnNext = null;
let modalBtnClose = null;

function ensureModal(){
  if(modalRoot) return;

  modalRoot = document.createElement("div");
  modalRoot.style.position = "fixed";
  modalRoot.style.left = "0";
  modalRoot.style.top = "0";
  modalRoot.style.width = "100vw";
  modalRoot.style.height = "100vh";
  modalRoot.style.zIndex = "999999";
  modalRoot.style.display = "none";
  modalRoot.style.background = "rgba(0,0,0,0.55)";
  modalRoot.style.backdropFilter = "blur(6px)";

  const panel = document.createElement("div");
  panel.style.position = "absolute";
  panel.style.left = "50%";
  panel.style.top = "50%";
  panel.style.transform = "translate(-50%,-50%)";
  panel.style.width = "min(92vw, 420px)";
  panel.style.maxHeight = "min(80vh, 560px)";
  panel.style.background = "rgba(10,10,14,0.92)";
  panel.style.border = "1px solid rgba(255,255,255,0.12)";
  panel.style.borderRadius = "16px";
  panel.style.overflow = "hidden";
  panel.style.display = "flex";
  panel.style.flexDirection = "column";

  modalTitle = document.createElement("div");
  modalTitle.style.padding = "14px 14px 10px";
  modalTitle.style.color = "#fff";
  modalTitle.style.font = "800 16px system-ui";
  modalTitle.style.borderBottom = "1px solid rgba(255,255,255,0.10)";
  modalTitle.textContent = "RESULT";

  modalBody = document.createElement("div");
  modalBody.style.padding = "10px 12px";
  modalBody.style.overflow = "auto";
  modalBody.style.color = "#fff";
  modalBody.style.font = "13px system-ui";
  modalBody.style.lineHeight = "1.55";

  const footer = document.createElement("div");
  footer.style.display = "flex";
  footer.style.gap = "10px";
  footer.style.padding = "12px";
  footer.style.borderTop = "1px solid rgba(255,255,255,0.10)";

  modalBtnNext = document.createElement("button");
  modalBtnNext.textContent = "次のレースへ";
  modalBtnNext.style.flex = "1";
  modalBtnNext.style.padding = "12px 12px";
  modalBtnNext.style.borderRadius = "12px";
  modalBtnNext.style.border = "none";
  modalBtnNext.style.font = "800 14px system-ui";
  modalBtnNext.style.color = "#fff";
  modalBtnNext.style.background = "rgba(255,255,255,0.18)";

  modalBtnClose = document.createElement("button");
  modalBtnClose.textContent = "閉じる";
  modalBtnClose.style.flex = "1";
  modalBtnClose.style.padding = "12px 12px";
  modalBtnClose.style.borderRadius = "12px";
  modalBtnClose.style.border = "none";
  modalBtnClose.style.font = "800 14px system-ui";
  modalBtnClose.style.color = "#fff";
  modalBtnClose.style.background = "rgba(255,255,255,0.10)";

  modalBtnClose.addEventListener("pointerdown", ()=>hideModal());

  footer.appendChild(modalBtnNext);
  footer.appendChild(modalBtnClose);

  panel.appendChild(modalTitle);
  panel.appendChild(modalBody);
  panel.appendChild(footer);

  modalRoot.appendChild(panel);
  document.body.appendChild(modalRoot);
}

function showModal(){
  ensureModal();
  modalRoot.style.display = "block";
}
function hideModal(){
  if(!modalRoot) return;
  modalRoot.style.display = "none";
}

/* =========================
   RESULT + ELIMINATION
   ・上位survive人だけ残す
   ・プレイヤーが落ちたら即GAME OVER
========================= */
function showResultAndEliminate(){
  const cfg = RACE_LIST[raceIndex];

  const all = [player, ...runners];
  all.sort((a,b)=>a.finishTime - b.finishTime);

  // rank付与
  all.forEach((r,i)=>r.rank = i+1);

  // survive list
  const survivors = all.slice(0, cfg.survive);
  const playerSurvive = survivors.includes(player);

  // リザルト表示（全員）
  ensureModal();
  modalTitle.textContent = `RESULT - ${cfg.name}（上位${cfg.survive}通過）`;

  let html = "";
  html += `<div style="margin-bottom:10px;opacity:.9">Goal: ${cfg.goalM}m</div>`;
  all.forEach(r=>{
    const name = (r===player) ? "YOU" : r.name;
    const time = (isFinite(r.finishTime) ? r.finishTime.toFixed(2)+"s" : "--");
    const pass = survivors.includes(r) ? "✅" : "❌";
    const style = (r===player)
      ? "color:#00ffd0;font-weight:800;"
      : (survivors.includes(r) ? "font-weight:700;" : "opacity:.72;");

    html += `<div style="padding:4px 0;${style}">
      ${r.rank}. ${name} - ${time} ${pass}
    </div>`;
  });
  modalBody.innerHTML = html;

  // 次へ
  modalBtnNext.onclick = ()=>{
    hideModal();
    if(!playerSurvive){
      showGameOver();
      return;
    }

    // 次レースへ：survivorsからplayer以外を runners に残す
    const next = raceIndex + 1;
    if(next >= RACE_LIST.length){
      // 全レース終了：最終結果のまま停止
      gameState = STATE.RESULT;
      showModal();
      modalTitle.textContent = `FINAL RESULT`;
      return;
    }

    // survivors からプレイヤー以外を抽出して runners を再構成
    const nextRunners = survivors.filter(r=>r!==player).map(r=>{
      // cpuデータを引き継ぐ
      const cpu = createCPU(r.name, r.winRate ?? 0.30);
      cpu.winRate = r.winRate ?? cpu.winRate;
      return cpu;
    });

    runners.length = 0;
    nextRunners.forEach(r=>runners.push(r));

    // 次レース開始（keepRunners=true）
    setupRace(next, true);
  };

  gameState = STATE.RESULT;
  showModal();
}

/* =========================
   GAME OVER
========================= */
function showGameOver(){
  ensureModal();
  modalTitle.textContent = "GAME OVER";
  modalBody.innerHTML = `<div style="padding:8px 0;line-height:1.6">
    あなたは脱落しました。<br>
    もう一度最初から挑戦しますか？
  </div>`;
  modalBtnNext.textContent = "最初から";
  modalBtnNext.onclick = ()=>{
    modalBtnNext.textContent = "次のレースへ";
    setupRace(0, false);
  };
  showModal();
}

/* =========================
   RENDER ORDER FIX
   ギミック→CPU→プレイヤー→TOP8
========================= */
function drawPlayerSprite(){
  const img = ASSETS["PL1.png.png"];
  if(!img) return;
  ctx.save();
  if(player._inDokan) ctx.globalAlpha = 0.45;
  ctx.drawImage(img, player.x, player.y, PLAYER_BASE.width, PLAYER_BASE.height);
  ctx.restore();

  ctx.fillStyle = "#fff";
  ctx.font = "10px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("プレイヤー", player.x + PLAYER_BASE.width/2, player.y - 6);
}

function renderRunScene(){
  // 背景
  drawBackground();

  // ギミック（プレイヤー基準スクロール）
  drawGimmicks();

  // CPU
  // CPUは worldX 基準で画面に出す（スクロールに追従）
  const img = ASSETS["PL1.png.png"];
  if(img){
    for(const cpu of runners){
      const sx = cpu.x - WORLD.scrollX + player.x;
      if(sx < -80 || sx > VIEW_W + 80) continue;

      ctx.save();
      if(cpu._inDokan) ctx.globalAlpha = 0.45;
      ctx.drawImage(img, sx, cpu.y, PLAYER_BASE.width, PLAYER_BASE.height);
      ctx.restore();

      ctx.fillStyle = "#ddd";
      ctx.font = "9px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(cpu.name, sx + PLAYER_BASE.width/2, cpu.y - 4);
    }
  }

  // プレイヤー
  drawPlayerSprite();

  // TOP8（Canvas）
  drawTop8();

  // 右下 version（ボタン被り回避：右下固定のまま、UI下端なのでOK）
  drawVersion();
}

/* =========================
   LOOP REPLACE
   （既存loopは次フレームからこの定義が使われます）
========================= */
loop = function(t){
  delta = t - lastTime;
  lastTime = t;

  // clear
  ctx.clearRect(0, 0, VIEW_W, VIEW_H);

  if (!assetsReady) {
    ctx.fillStyle = "#fff";
    ctx.font = "16px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Loading...", VIEW_W / 2, VIEW_H / 2);
    requestAnimationFrame(loop);
    return;
  }

  switch (gameState) {
    case STATE.BOOT:
      setupRace(0, false);
      break;

    case STATE.COUNTDOWN:
      drawBackground();
      countdownTimer += delta;
      if (countdownTimer > 1000) {
        countdown--;
        countdownTimer = 0;
        if (countdown <= 0) gameState = STATE.RUN;
      }
      ctx.fillStyle = "#fff";
      ctx.font = "64px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(Math.max(1, countdown), VIEW_W / 2, VIEW_H / 2);
      drawVersion();
      break;

    case STATE.RUN:
      // time
      raceTimeSec += (delta / 1000);

      // 生成・更新
      spawnGimmicks();
      updatePlayer();   // ここでギミック適用もされる
      updateRunners();  // CPU側はupdateCPU内でギミック回避と適用済み
      updateRanking();

      // ゴール判定
      checkFinishRace();

      // 端制御（2000m背景の外に行かない）
      const maxScroll = Math.max(0, TRACK_PIXELS - VIEW_W);
      WORLD.scrollX = Math.max(0, Math.min(WORLD.scrollX, maxScroll));

      // 描画
      renderRunScene();

      // 入力1フレーム消費
      resetInputFrame();
      INPUT.jump = false;
      INPUT.boost = false;
      break;

    case STATE.RESULT:
      // 背景だけは描いておく（後ろが真っ黒にならない）
      drawBackground();
      drawVersion();
      break;
  }

  requestAnimationFrame(loop);
};

// すでに回っているRAFはそのまま次フレームから新loopが使われる
/* =========================================================
   PART 5 / 5
   RINGS / GUARDRAIL / WATER / HARD追加CPU / 微調整
========================================================= */

/* =========================
   RINGS (個別取得・共有消失しない)
========================= */
const RINGS = []; // {x,y,r}

let nextRingX = 420;

function spawnRings(){
  const cam = WORLD.scrollX;
  const ahead = cam + VIEW_W * 1.6;

  while(nextRingX < ahead && nextRingX < TRACK_PIXELS - 200){
    const air = Math.random() < 0.45;
    const x = nextRingX;
    const y = air
      ? (WORLD.groundY() - 120 - Math.random()*160)
      : (WORLD.groundY() - 42);

    RINGS.push({x,y,r:14});
    nextRingX += 160 + Math.random()*140;
  }
}

function drawRings(){
  const img = ASSETS["ringtap.png"];
  if(!img) return;

  for(const ring of RINGS){
    const sx = ring.x - WORLD.scrollX + player.x;
    if(sx < -40 || sx > VIEW_W + 40) continue;
    ctx.drawImage(img, sx-ring.r, ring.y-ring.r, ring.r*2, ring.r*2);
  }
}

function applyRings(ent){
  for(const ring of RINGS){
    const hit =
      (ent.x + PLAYER_BASE.width/2) > (ring.x-ring.r) &&
      (ent.x + PLAYER_BASE.width/2) < (ring.x+ring.r) &&
      (ent.y + PLAYER_BASE.height/2) > (ring.y-ring.r) &&
      (ent.y + PLAYER_BASE.height/2) < (ring.y+ring.r);

    if(hit){
      // 個別取得：ringは消さない
      ent.ring = (ent.ring||0) + 1;
      if(ent.ring >= 10){
        ent.ring = 0;
        // ブーストの半分程度
        ent.speed = Math.min(ent.speed + 6, PLAYER_BASE.maxSpeed + 80);
      }
    }
  }
}

/* =========================
   GUARD RAIL（低め・少なめ・被り防止）
========================= */
const GUARDS = [];
let nextGuardX = 780;

function spawnGuards(){
  const ahead = WORLD.scrollX + VIEW_W * 1.6;
  while(nextGuardX < ahead && nextGuardX < TRACK_PIXELS - 200){
    const w = 180;
    const h = 36; // 低め
    const x = nextGuardX;
    const y = WORLD.groundY() - h;

    if(isFreeRange(x-30, x+w+30)){
      GUARDS.push({x,y,w,h});
      reserveRange(x-30, x+w+30, "guard");
    }
    nextGuardX += 1200 + Math.random()*800;
  }
}

function drawGuards(){
  const img = ASSETS["gardw.png"];
  if(!img) return;
  for(const g of GUARDS){
    const sx = g.x - WORLD.scrollX + player.x;
    if(sx < -200 || sx > VIEW_W + 200) continue;
    ctx.drawImage(img, sx, g.y, g.w, g.h);
  }
}

function applyGuards(ent){
  for(const g of GUARDS){
    if(aabb(ent.x, ent.y, PLAYER_BASE.width, PLAYER_BASE.height, g.x, g.y, g.w, g.h)){
      if(landOnTop(ent, g)){
        ent.y = g.y - PLAYER_BASE.height;
        ent.vy = 0;
        ent.onGround = true;
        ent.speed = Math.min(ent.speed + 1.4, PLAYER_BASE.maxSpeed + 40);
      }
    }
  }
}

/* =========================
   WATER（踏むと少し減速）
========================= */
const WATERS = [];
let nextWaterX = 980;

function spawnWaters(){
  const ahead = WORLD.scrollX + VIEW_W * 1.6;
  while(nextWaterX < ahead && nextWaterX < TRACK_PIXELS - 200){
    const w = 120;
    const h = 18;
    const x = nextWaterX;
    const y = WORLD.groundY() - h;

    if(isFreeRange(x-30, x+w+30)){
      WATERS.push({x,y,w,h});
      reserveRange(x-30, x+w+30, "water");
    }
    nextWaterX += 1500 + Math.random()*900;
  }
}

function drawWaters(){
  ctx.save();
  ctx.fillStyle = "rgba(80,140,255,0.45)";
  for(const w of WATERS){
    const sx = w.x - WORLD.scrollX + player.x;
    if(sx < -200 || sx > VIEW_W + 200) continue;
    ctx.fillRect(sx, w.y, w.w, w.h);
  }
  ctx.restore();
}

function applyWaters(ent){
  for(const w of WATERS){
    if(aabb(ent.x, ent.y, PLAYER_BASE.width, PLAYER_BASE.height, w.x, w.y, w.w, w.h)){
      ent.speed = Math.max(ent.speed - 1.6, 0);
    }
  }
}

/* =========================
   HARD追加CPU（銀・金）
========================= */
function addHardBosses(){
  runners.push(createCPU("シルバー", 0.95));
  runners.push(createCPU("ゴールド", 0.95));
}

/* =========================
   HOOK: setupRace 拡張
========================= */
const _setupRace = setupRace;
setupRace = function(idx, keep){
  _setupRace(idx, keep);

  // HARD開始時に追加
  if(RACE_LIST[idx].name === "HARD"){
    addHardBosses();
  }

  // ring reset
  RINGS.length = 0;
  nextRingX = 420;

  // guard/water reset
  GUARDS.length = 0;
  WATERS.length = 0;
  nextGuardX = 780;
  nextWaterX = 980;
};

/* =========================
   HOOK: updatePlayer / updateCPU
========================= */
const _updatePlayerFinal = updatePlayer;
updatePlayer = function(){
  spawnRings();
  spawnGuards();
  spawnWaters();

  _updatePlayerFinal();

  applyRings(player);
  applyGuards(player);
  applyWaters(player);
};

const _updateCPUFinal = updateCPU;
updateCPU = function(cpu){
  _updateCPUFinal(cpu);
  applyRings(cpu);
  applyGuards(cpu);
  applyWaters(cpu);
};

/* =========================
   DRAW ADDITIONS
========================= */
const _drawGimmicksFinal = drawGimmicks;
drawGimmicks = function(){
  _drawGimmicksFinal();
  drawRings();
  drawGuards();
  drawWaters();
};
