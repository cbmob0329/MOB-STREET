/* =========================================================
   MOB STREET - V1 (スマホ基準 / 最小構成)
   - 確実に起動する（永久Loading防止）
   - 画面(プレイ)と操作エリア(DOM)分離
   - PL1.png / PL2.png / redsk.png / st.png（任意）
   - BOOST：5秒に1個、最大5、開始0
   - バージョン：左上に常時「V1」、起動直後中央にも一瞬表示
========================================================= */

"use strict";

const BUILD = "V1";

/* =========================
   DOM
========================= */
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d", { alpha: true });

const elBoostGauge = document.getElementById("boostGauge");
const elBootToast = document.getElementById("bootToast");

const btnJump = document.getElementById("btnJump");
const btnBoost = document.getElementById("btnBoost");
const btnJumpBoost = document.getElementById("btnJumpBoost");

/* iOSでの選択・拡大をさらに抑制 */
function preventDefault(e){ if(e && e.cancelable) e.preventDefault(); }
["contextmenu","gesturestart","gesturechange","gestureend"].forEach(ev=>{
  window.addEventListener(ev, preventDefault, { passive:false });
});

/* =========================
   Canvas Resize (黒帯防止)
========================= */
let DPR = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
let VIEW_W = 360, VIEW_H = 640;

function resizeCanvas(){
  const parent = canvas.parentElement;
  const rect = parent.getBoundingClientRect();
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
   Assets (失敗しても進む)
========================= */
const ASSETS = {};
let assetsReady = false;

const ASSET_LIST = [
  "PL1.png",
  "PL2.png",
  "redsk.png",
  "st.png", // 任意（無くても動く）
];

const LOAD = {
  total: 0,
  done: 0,
  last: "",
  ng: [],
  forced: false
};

function makePlaceholder(w=48, h=48, label="!"){
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const g = c.getContext("2d");
  g.fillStyle = "rgba(255,0,0,0.25)";
  g.fillRect(0,0,w,h);
  g.strokeStyle = "rgba(255,0,0,0.9)";
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
  LOAD.total = ASSET_LIST.length;
  LOAD.done = 0;
  LOAD.last = "";
  LOAD.ng = [];
  LOAD.forced = false;

  const bust = `?v=${encodeURIComponent(BUILD)}&t=${Date.now()}`;

  return new Promise((resolve)=>{
    let resolved = false;

    const hardTimeout = setTimeout(()=>{
      if(resolved) return;
      resolved = true;
      LOAD.forced = true;
      assetsReady = true;
      resolve();
    }, 8000);

    ASSET_LIST.forEach((name)=>{
      const img = new Image();
      img.crossOrigin = "anonymous";

      const finalize = (ok)=>{
        LOAD.done++;
        LOAD.last = name;
        if(!ok) LOAD.ng.push(name);

        if(LOAD.done >= LOAD.total && !resolved){
          clearTimeout(hardTimeout);
          resolved = true;
          assetsReady = true;
          resolve();
        }
      };

      img.onload = ()=> finalize(true);
      img.onerror = ()=>{
        ASSETS[name] = makePlaceholder(48,48,"!");
        finalize(false);
      };

      img.src = name + bust;
      ASSETS[name] = img;
    });
  });
}

function drawLoading(){
  ctx.clearRect(0,0,VIEW_W,VIEW_H);

  // 青っぽい雰囲気
  const g = ctx.createLinearGradient(0,0,0,VIEW_H);
  g.addColorStop(0, "#1f5fae");
  g.addColorStop(1, "#0a2142");
  ctx.fillStyle = g;
  ctx.fillRect(0,0,VIEW_W,VIEW_H);

  ctx.fillStyle = "rgba(0,0,0,0.25)";
  ctx.fillRect(0,0,VIEW_W,VIEW_H);

  const pct = LOAD.total ? Math.floor((LOAD.done/LOAD.total)*100) : 0;

  ctx.fillStyle = "#fff";
  ctx.textAlign = "center";
  ctx.font = "800 30px sans-serif";
  ctx.fillText("Loading...", VIEW_W/2, VIEW_H*0.45);

  ctx.font = "14px sans-serif";
  ctx.fillText("画像を読み込んでいます", VIEW_W/2, VIEW_H*0.45 + 26);
  ctx.fillText(`${pct}% (${LOAD.done}/${LOAD.total})`, VIEW_W/2, VIEW_H*0.45 + 48);

  ctx.font = "12px sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.fillText(LOAD.last ? `... ${LOAD.last}` : "", VIEW_W/2, VIEW_H*0.45 + 70);

  if(LOAD.ng.length){
    ctx.fillStyle = "rgba(255,220,220,0.95)";
    ctx.fillText(`FAILED: ${LOAD.ng.join(", ")}`, VIEW_W/2, VIEW_H*0.45 + 92);
  }
  if(LOAD.forced){
    ctx.fillStyle = "rgba(255,255,255,0.95)";
    ctx.fillText("(強制起動: 読めない画像がある可能性)", VIEW_W/2, VIEW_H*0.45 + 114);
  }
}

/* =========================
   Game Config
========================= */
function clamp(v,a,b){ return Math.max(a, Math.min(b,v)); }

const WORLD = {
  groundRatio: 0.78,
  groundY: 0,
};

const PHYS = {
  gravity: 2600,
  jumpV: -900,
  doubleJumpV: -820,
  maxFall: 1800
};

const SPEED = {
  base: 260,
  max: 720
};

/* =========================
   Player (48x48目安)
========================= */
const player = {
  x: 86,            // もっと左に寄せるならここを小さく
  y: 0,
  w: 44,
  h: 44,
  vy: 0,
  onGround: false,
  canDouble: true,
  imgRun: null,
  imgJump: null,
  board: null,
};

let dist = 0;
let speed = SPEED.base;

/* =========================
   Boost System
========================= */
const boost = {
  stock: 0,
  max: 5,
  cooldown: 5.0, // 5秒で1つ
  t: 0,
  activeT: 0
};

function updateBoost(dt){
  // 回復（最初0）
  boost.t += dt;
  if(boost.t >= boost.cooldown){
    const n = Math.floor(boost.t / boost.cooldown);
    boost.t -= n * boost.cooldown;
    boost.stock = clamp(boost.stock + n, 0, boost.max);
  }

  // ブースト効果
  if(boost.activeT > 0){
    boost.activeT -= dt;
    speed = Math.min(SPEED.max, speed + 900*dt);
  }
  elBoostGauge.textContent = `${boost.stock} / ${boost.max}`;
}

function useBoost(){
  if(boost.stock <= 0) return;
  boost.stock--;
  boost.activeT = 0.45; // 体感：短く鋭い
}

/* =========================
   Input (DOM Buttons)
========================= */
function doJump(){
  if(!assetsReady) return;
  if(gameState !== "play") return;

  if(player.onGround){
    player.vy = PHYS.jumpV;
    player.onGround = false;
  }else if(player.canDouble){
    player.vy = PHYS.doubleJumpV;
    player.canDouble = false;
  }
}

btnJump.addEventListener("pointerdown", (e)=>{ preventDefault(e); doJump(); }, { passive:false });
btnBoost.addEventListener("pointerdown", (e)=>{ preventDefault(e); useBoost(); }, { passive:false });

// V1では無効（将来用）
btnJumpBoost.addEventListener("pointerdown", (e)=>{ preventDefault(e); }, { passive:false });

/* =========================
   Stage Render
========================= */
function drawBackground(){
  const g = ctx.createLinearGradient(0,0,0,VIEW_H);
  g.addColorStop(0, "#2b77d1");
  g.addColorStop(1, "#0a2142");
  ctx.fillStyle = g;
  ctx.fillRect(0,0,VIEW_W,VIEW_H);
}

function drawStage(){
  // 地面
  ctx.fillStyle = "#6f5e3f";
  ctx.fillRect(0, WORLD.groundY, VIEW_W, VIEW_H - WORLD.groundY);

  // st.png があるなら“床テクスチャ”として敷く（ループ）
  const st = ASSETS["st.png"];
  if(st && st.width && st.height){
    const tileH = 64;
    const scale = tileH / st.height;
    const tileW = Math.floor(st.width * scale);

    const y = WORLD.groundY - 10; // 少し食い込ませて境界を目立たせない
    const offset = -((dist * 0.9) % tileW);

    for(let x = offset; x < VIEW_W + tileW; x += tileW){
      ctx.drawImage(st, x, y, tileW, tileH);
    }
  }else{
    // 境界ライン
    ctx.fillStyle = "rgba(255,255,255,0.15)";
    ctx.fillRect(0, WORLD.groundY-2, VIEW_W, 2);
  }
}

/* =========================
   Player Render
========================= */
function drawPlayer(){
  const img = player.onGround ? player.imgRun : player.imgJump;

  // スケボー
  if(player.board && player.board.width){
    ctx.drawImage(
      player.board,
      player.x - 6,
      player.y + player.h - 12,
      player.w + 12,
      16
    );
  }

  // 本体
  if(img && img.width){
    ctx.drawImage(img, player.x, player.y, player.w, player.h);
  }else{
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.fillRect(player.x, player.y, player.w, player.h);
  }

  // プレイヤーラベル（小さく、でも見える）
  ctx.fillStyle = "#fff";
  ctx.font = "12px sans-serif";
  ctx.textAlign = "center";
  const labelY = Math.max(20, player.y - 8);
  ctx.fillText("プレイヤー", player.x + player.w/2, labelY);
}

/* =========================
   Physics Update
========================= */
function updatePlayer(dt){
  player.vy += PHYS.gravity * dt;
  player.vy = Math.min(player.vy, PHYS.maxFall);
  player.y += player.vy * dt;

  // 地面
  if(player.y + player.h >= WORLD.groundY){
    player.y = WORLD.groundY - player.h;
    player.vy = 0;
    player.onGround = true;
    player.canDouble = true;
  }else{
    player.onGround = false;
  }
}

/* =========================
   HUD V1 (見失わない表示はDOM側に固定)
   ここでは追加の“起動確認”として中央toastだけ出す
========================= */
function showBootToast(){
  elBootToast.textContent = BUILD;
  elBootToast.classList.remove("show");
  // 強制リフロー
  void elBootToast.offsetWidth;
  elBootToast.classList.add("show");
}

/* =========================
   Main Loop
========================= */
let gameState = "loading"; // loading | play
let lastTS = 0;

function initGame(){
  // 地面位置
  WORLD.groundY = Math.floor(VIEW_H * WORLD.groundRatio);

  // assets
  player.imgRun = ASSETS["PL1.png"];
  player.imgJump = ASSETS["PL2.png"];
  player.board = ASSETS["redsk.png"];

  // 初期位置（地面に埋まらない）
  player.y = WORLD.groundY - player.h;
  player.vy = 0;
  player.onGround = true;
  player.canDouble = true;

  // boost
  boost.stock = 0;
  boost.t = 0;
  boost.activeT = 0;

  dist = 0;
  speed = SPEED.base;

  gameState = "play";
  showBootToast();
}

function loop(ts){
  const dt = Math.min(0.033, (ts - lastTS) / 1000 || 0);
  lastTS = ts;

  if(!assetsReady){
    drawLoading();
    requestAnimationFrame(loop);
    return;
  }

  if(gameState === "loading"){
    initGame();
  }

  // update
  updateBoost(dt);

  // 進行（右へ走るだけ）
  dist += speed * dt;

  updatePlayer(dt);

  // render
  ctx.clearRect(0,0,VIEW_W,VIEW_H);
  drawBackground();
  drawStage();
  drawPlayer();

  requestAnimationFrame(loop);
}

/* =========================
   Boot
========================= */
(function boot(){
  resizeCanvas();
  loadAssets().then(()=>{ /* loop側でinitGame */ });
  requestAnimationFrame(loop);
})();
