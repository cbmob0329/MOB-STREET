/* =========================
   MOB SKATE – Prototype v2 (split)
   必要画像：msst1.png / mobs.png / redsk.png / gardw.png / ringtap.png
   変更点：
   - キャラ縮小＆ボードに正しく乗る
   - ガードレール大型化＆上に乗れる／側面衝突で減速
   - 移動パラメータ調整でクリアまで約3倍の所要時間
   ========================= */

// ---------- 基本設定 ----------
const CANVAS_W = 540, CANVAS_H = 960;     // 9:16
const GROUND_Y_RATIO = 0.865;             // 赤ライン相当（必要時微調整）

// 速度・挙動
const GRAVITY = 0.7;
const JUMP_VY = -16;                      // v1より控えめ
const BASE_ACCEL = 0.02;                  // v1:0.06 → ゆっくり加速
const FRICTION = 0.008;
const MAX_SPEED = 9;                      // v1:13 → ゆっくり
const BRAKE_FORCE = 0.20;

// リング
const RING_BOOST_PER = 0.03;              // +3%
const RING_BOOST_DECAY = 0.012;           // 減衰やや緩く
const RING_SPAWN_INTERVAL = 140;          // ms
const RING_AROUND = 110;

// ゴール演出
const GOAL_ZOOM = 1.6;

// スコア式
function calcScore(sec, ring, bestCombo){
  return Math.floor(1000 + ring*10 + bestCombo*ring*2 - sec*5);
}
function calcRank(score){
  if(score >= 2000) return "S";
  if(score >= 1500) return "A";
  if(score >= 1100) return "B";
  return "C";
}

// ---------- キャンバス ----------
const cv = document.getElementById('game');
const cx = cv.getContext('2d');
cv.width = CANVAS_W; cv.height = CANVAS_H;

// ---------- HUD ----------
const chipTime = document.getElementById('chipTime');
const chipSpeed= document.getElementById('chipSpeed');
const chipRing = document.getElementById('chipRing');
const resultUI = document.getElementById('result');
const rsTime = document.getElementById('rsTime');
const rsRing = document.getElementById('rsRing');
const rsCombo = document.getElementById('rsCombo');
const rsScore = document.getElementById('rsScore');
const rsRank = document.getElementById('rsRank');
const tapHint = document.getElementById('tapHint');

// ---------- 入力 ----------
const input = { jump:false, brake:false, anyTap:false };
document.getElementById('btnJump').addEventListener('pointerdown', ()=>input.jump=true);
document.getElementById('btnJump').addEventListener('pointerup',   ()=>input.jump=false);
document.getElementById('btnBrake').addEventListener('pointerdown',()=>input.brake=true);
document.getElementById('btnBrake').addEventListener('pointerup',  ()=>input.brake=false);
addEventListener('pointerdown', e=>{
  input.anyTap = true;
  if(state.phase==='result'){ restart(); }
});
addEventListener('pointerup', ()=> input.anyTap=false);

// ---------- 画像読み込み ----------
function loadImage(src){
  return new Promise(res=>{
    const img = new Image(); img.src = src;
    img.onload = ()=>res(img);
    img.onerror = ()=>{ console.warn('画像の読み込みに失敗:',src); res(null); }
  });
}
const assets = { stage:null, mobs:null, board:null, rail:null, ring:null };

// ---------- ワールド ----------
const world = {
  x:0, y:0, zoom:1,
  groundY: Math.floor(CANVAS_H * GROUND_Y_RATIO),
  width: 4000,
  rails: [],
  rings: []
};

// プレイヤー見た目・判定サイズ
const PLAYER_W = 48;
const PLAYER_H = 72;
const BOARD_W  = 96;
const BOARD_H  = 24;
const SPRITE_W = 92;   // mobs.png の描画サイズ
const SPRITE_H = 92;
const SPRITE_OFF_X = -10; // 画像の見た目調整（足がボードに重なるように）
const SPRITE_OFF_Y = -18;

const player = {
  x: 100, y: 0, w: PLAYER_W, h: PLAYER_H,
  vy:0, speed:0, onGround:false, onRail:false,
  ringBoost:0, ringCount:0, combo:0, bestCombo:0,
  zooming:false, hopT:0, prevX:0
};

const state = {
  startedAt: performance.now(),
  phase: 'play',
  goalX: 3200
};

// ---------- 初期化 ----------
(async function init(){
  assets.stage = await loadImage('msst1.png');
  assets.mobs  = await loadImage('mobs.png');
  assets.board = await loadImage('redsk.png');
  assets.rail  = await loadImage('gardw.png');
  assets.ring  = await loadImage('ringtap.png');

  if(assets.stage){
    // ステージをキャンバス高に合わせて等比拡大描画する想定。
    const scaleY = CANVAS_H / assets.stage.height;
    const scaledW = Math.floor((assets.stage.width) * scaleY);
    world.width = scaledW;
    state.goalX = world.width - 200; // 右端手前
  }

  world.groundY = Math.floor(CANVAS_H * GROUND_Y_RATIO);

  // 大きめのガードレールを配置（障害物として成立）
  // 上に乗れる高さ・幅：w=420, h=36
  const gap = 620;
  for(let i=0;i<6;i++){
    const x = 520 + i*gap;
    world.rails.push({ x, y: world.groundY - 30, w: 420, h: 36 });
  }

  // プレイヤー初期位置
  player.y = world.groundY - player.h;

  loop();
})();

// ---------- ループ ----------
let last = performance.now();
let ringSpawnTimer = 0;
function loop(now = performance.now()){
  const dt = Math.min(32, now - last); last = now;
  update(dt);
  draw();
  requestAnimationFrame(loop);
}

// ---------- 更新 ----------
function update(dt){
  if(state.phase === 'play'){
    player.prevX = player.x;

    // 自動前進
    player.speed += BASE_ACCEL;
    if(input.brake) player.speed -= BRAKE_FORCE;
    player.speed = Math.max(0, Math.min(MAX_SPEED*(1+player.ringBoost), player.speed));

    // ジャンプ
    if(input.jump && player.onGround){
      player.vy = JUMP_VY;
      player.onGround = false;
    }

    // 重力＆摩擦
    player.vy += GRAVITY;
    if(player.onGround && !player.onRail){
      player.speed = Math.max(0, player.speed - FRICTION*player.speed);
    }

    // 移動
    player.x += player.speed;
    player.y += player.vy;

    // 地面
    const floorY = world.groundY - player.h;
    if(player.y >= floorY){
      player.y = floorY; player.vy = 0; player.onGround = true;
    }

    // レール処理
    player.onRail = false;
    for(const r of world.rails){
      // 上面着地（下向きに落ちてきた時だけ）
      const topY = r.y - player.h;
      const horizontallyOver = (player.x + player.w*0.5 > r.x) && (player.x - player.w*0.5 < r.x + r.w);
      const falling = player.vy >= 0;
      if(horizontallyOver && falling && player.y >= topY - 12 && player.y <= topY + 16){
        player.y = topY; player.vy = 0; player.onGround = true; player.onRail = true;
      }

      // 側面衝突（正面からぶつかったら減速＆押し戻し）
      const verticalOverlap = (player.y + player.h > r.y) && (player.y < r.y + r.h);
      const hitFromLeft = (player.prevX + player.w*0.5) <= r.x && (player.x + player.w*0.5) > r.x;
      if(verticalOverlap && hitFromLeft){
        player.x = r.x - player.w*0.5 - 1;
        player.speed *= 0.35; // 強めに減速
      }
    }

    // リング生成（レール上のみ）
    if(player.onRail){
      ringSpawnTimer += dt;
      if(ringSpawnTimer >= RING_SPAWN_INTERVAL){
        ringSpawnTimer = 0;
        spawnRingBurst();
      }
      tapHint.textContent = "リングをタップで加速！";
    }else{
      tapHint.textContent = "";
      ringSpawnTimer = Math.min(ringSpawnTimer, RING_SPAWN_INTERVAL);
    }

    // タップで近傍リング消費→ブースト
    if(input.anyTap){
      const idx = findNearestRingIndex(player.x, player.y, RING_AROUND);
      if(idx >= 0){
        world.rings.splice(idx,1);
        player.ringCount++;
        player.combo++;
        player.bestCombo = Math.max(player.bestCombo, player.combo);
        player.ringBoost += RING_BOOST_PER;
        input.anyTap = false; // 1入力で1個
      }
    }

    // ブースト減衰
    player.ringBoost = Math.max(0, player.ringBoost - RING_BOOST_DECAY*(dt/16.7));

    // ゴール
    if(player.x >= state.goalX){
      state.phase = 'goal';
      player.speed = 0;
      player.vy = 0;
      player.zooming = true;
    }
  }
  else if(state.phase === 'goal'){
    if(player.zooming){
      world.zoom = Math.min(GOAL_ZOOM, (world.zoom||1)+0.02);
      player.hopT += 0.15;
      if(player.onGround){
        player.y = (world.groundY - player.h) + Math.sin(player.hopT)*-10; // ピョンピョン
      }
      if(world.zoom >= GOAL_ZOOM){
        player.zooming = false;
        setTimeout(showResult, 400);
      }
    }
  }

  // HUD
  const sec = ( (state.phase==='play') ? (performance.now()-state.startedAt) : (state.resultTimeMs||0) ) / 1000;
  chipTime.textContent = `TIME ${sec.toFixed(2)}`;
  chipSpeed.textContent= `SPD ${Math.round(player.speed*6)}`;
  chipRing.textContent = `RING ${player.ringCount}  /  COMBO ${player.combo}`;
}

// ---------- リング ----------
function spawnRingBurst(){
  const count = 4 + Math.floor(Math.random()*3); // 4〜6個
  for(let i=0;i<count;i++){
    const ang = -Math.PI/2 + (Math.random()-0.5)*1.1;
    const dist = 34 + Math.random()*70;
    world.rings.push({
      x: player.x + Math.cos(ang)*dist,
      y: player.y + player.h*0.45 + Math.sin(ang)*dist,
      t: performance.now()
    });
  }
}
function findNearestRingIndex(x,y, radius){
  let k = -1, best = radius*radius;
  for(let i=0;i<world.rings.length;i++){
    const r = world.rings[i];
    const dx = r.x-x, dy=r.y-y;
    const d2 = dx*dx+dy*dy;
    if(d2 < best){ best = d2; k=i; }
  }
  return k;
}

// ---------- 描画 ----------
function draw(){
  cx.setTransform(1,0,0,1,0,0);
  cx.clearRect(0,0,cv.width,cv.height);

  // カメラ（ズーム含む）
  const zoom = (state.phase==='goal') ? (world.zoom||1) : 1;
  const camX = Math.max(0, Math.min(player.x - CANVAS_W/2/zoom, world.width - CANVAS_W/zoom));
  cx.scale(zoom, 1*zoom);
  cx.translate(-camX, 0);

  // 背景
  if(assets.stage){
    // キャンバス高さ基準で横にフィットさせる
    const scaleY = CANVAS_H / assets.stage.height;
    const scaledW = Math.floor(assets.stage.width * scaleY);
    cx.drawImage(assets.stage, 0, 0, scaledW, CANVAS_H);
  }else{
    cx.fillStyle='#223'; cx.fillRect(0,0,world.width, CANVAS_H);
  }

  // レール
  for(const r of world.rails){
    if(assets.rail){
      cx.drawImage(assets.rail, r.x, r.y, r.w, r.h);
    }else{
      cx.fillStyle='#999'; cx.fillRect(r.x, r.y, r.w, r.h);
    }
  }

  // リング
  for(const r of world.rings){
    const life = Math.max(0, 1 - (performance.now()-r.t)/1600);
    if(life<=0) continue;
    const s = 26*(0.7+0.3*life);
    cx.globalAlpha = 0.6 + 0.4*life;
    if(assets.ring) cx.drawImage(assets.ring, r.x - s/2, r.y - s/2, s, s);
    else{ cx.fillStyle='gold'; cx.beginPath(); cx.arc(r.x, r.y, s/2, 0, Math.PI*2); cx.fill(); }
    cx.globalAlpha = 1;
  }

  // プレイヤー（ボード→本体）
  const px = player.x - player.w*0.5;
  const py = player.y;

  if(assets.board){
    const bx = px + (player.w - BOARD_W)/2;
    const by = py + player.h - BOARD_H + 2; // 足元ぴったり
    cx.drawImage(assets.board, bx, by, BOARD_W, BOARD_H);
  }else{
    cx.fillStyle='#c33'; cx.fillRect(px, py + player.h - BOARD_H, BOARD_W, BOARD_H);
  }

  if(assets.mobs){
    const mx = px + SPRITE_OFF_X;
    const my = py + SPRITE_OFF_Y;
    cx.drawImage(assets.mobs, mx, my, SPRITE_W, SPRITE_H);
  }else{
    cx.fillStyle='#4cf'; cx.fillRect(px, py, player.w, player.h);
  }
}

// ---------- リザルト ----------
function showResult(){
  state.phase = 'result';
  state.resultTimeMs = performance.now() - state.startedAt;
  const t = (state.resultTimeMs/1000);
  const score = calcScore(t, player.ringCount, player.bestCombo);
  const rank = calcRank(score);
  rsTime.textContent  = `Time: ${t.toFixed(2)} s`;
  rsRing.textContent  = `Rings: ${player.ringCount}`;
  rsCombo.textContent = `Best Combo: ${player.bestCombo}`;
  rsScore.textContent = `Score: ${score}`;
  rsRank.textContent  = rank;
  resultUI.style.display = 'grid';
}

// ---------- リスタート ----------
function restart(){
  resultUI.style.display = 'none';
  state.phase = 'play';
  world.zoom = 1;
  player.x = 100;
  player.y = world.groundY - player.h;
  player.vy = 0;
  player.speed = 0;
  player.ringBoost = 0;
  player.ringCount = 0;
  player.combo = 0;
  player.bestCombo = 0;
  world.rings.length = 0;
  state.startedAt = performance.now();
}
