(() => {
  "use strict";

  // ====== Canvas / DPR ======
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d", { alpha: false });

  const VIRTUAL_W = 720;
  const VIRTUAL_H = 1280;

  function resizeCanvasToDPR() {
    const dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
    canvas.width = Math.round(VIRTUAL_W * dpr);
    canvas.height = Math.round(VIRTUAL_H * dpr);
    canvas.style.width = `${VIRTUAL_W}px`;
    canvas.style.height = `${VIRTUAL_H}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); // draw in virtual pixels
    ctx.imageSmoothingEnabled = false;      // ドット絵想定
  }

  // ====== Assets ======
  const assets = {
    pl1: loadImage("PL1.png"),
    pl2: loadImage("PL2.png"),
    sk: loadImage("redsk.png"),
    st: loadImage("st.png"),
  };

  function loadImage(src) {
    const img = new Image();
    img.src = src;
    img.decoding = "async";
    return img;
  }

  // ====== UI ======
  const btnJump = document.getElementById("btnJump");
  const btnBoost = document.getElementById("btnBoost");
  const btnJumpBoost = document.getElementById("btnJumpBoost");
  const boostPips = [...document.querySelectorAll("#boostPips .pip")];
  const boostTimerEl = document.getElementById("boostTimer");

  // iOS Safariのダブルタップズーム等を抑止
  document.addEventListener("gesturestart", (e) => e.preventDefault(), { passive: false });

  // ====== Game State ======
  const world = {
    t: 0,
    dt: 0,
    lastTs: 0,

    // 地面（ステージ画像の上を走る：ここは当たり判定ラインのみ先に決める）
    groundY: 980, // 画像に合わせて後で調整しやすい値
    gravity: 2600,

    // スクロール
    scrollX: 0,

    // 速度
    baseSpeed: 420, // px/sec
    speed: 420,
    boostActive: false,
    boostTimeLeft: 0,

    // ブーストストック
    boostStock: 0,
    boostMax: 3,
    stockInterval: 3.0,
    stockTimer: 3.0,

    // プレイヤー
    player: {
      x: 180,
      y: 0,
      vy: 0,
      onGround: false,
      jumpVel: -1050,
      width: 0,
      height: 0,
      scale: 1.0,
      // スケボー描画オフセット
      boardYOffset: 18,
    },

    // 判定用：プレイヤーの「足元」
    feetOffset: 10,
  };

  // ====== Input handlers ======
  function onJump() {
    if (!world.player.onGround) return;
    world.player.vy = world.player.jumpVel;
    world.player.onGround = false;
  }

  function useBoostOne() {
    if (world.boostStock <= 0) return false;
    world.boostStock -= 1;
    startBoost(1.55, 0.65); // 強さ, 秒数
    return true;
  }

  function useJumpBoostAll() {
    if (world.boostStock < world.boostMax) return false; // 3つ満タンのみ
    world.boostStock = 0;
    // ジャンプしながら超ブースト（地上でも空中でも可）
    if (world.player.onGround) onJump();
    startBoost(2.35, 1.15); // 強さ, 秒数
    // 追加で上方向に少し強化（空中の伸び）
    world.player.vy = Math.min(world.player.vy, world.player.jumpVel * 1.15);
    return true;
  }

  function startBoost(mult, duration) {
    world.boostActive = true;
    world.boostTimeLeft = Math.max(world.boostTimeLeft, duration);
    // boostは加算的に上書きせず「最大倍率」を採用
    world.boostMult = Math.max(world.boostMult || 1, mult);
  }

  btnJump.addEventListener("pointerdown", (e) => { e.preventDefault(); onJump(); }, { passive: false });
  btnBoost.addEventListener("pointerdown", (e) => { e.preventDefault(); useBoostOne(); }, { passive: false });
  btnJumpBoost.addEventListener("pointerdown", (e) => { e.preventDefault(); useJumpBoostAll(); }, { passive: false });

  // ====== Main Loop ======
  function tick(ts) {
    if (!world.lastTs) world.lastTs = ts;
    world.dt = Math.min(1 / 30, (ts - world.lastTs) / 1000);
    world.lastTs = ts;
    world.t += world.dt;

    update(world.dt);
    render();

    requestAnimationFrame(tick);
  }

  function update(dt) {
    // ブーストストック（3秒で+1、最大3）
    world.stockTimer -= dt;
    if (world.stockTimer <= 0) {
      const add = Math.floor((-world.stockTimer) / world.stockInterval) + 1;
      world.boostStock = Math.min(world.boostMax, world.boostStock + add);
      world.stockTimer += add * world.stockInterval;
    }

    // ブースト
    if (world.boostActive) {
      world.boostTimeLeft -= dt;
      if (world.boostTimeLeft <= 0) {
        world.boostActive = false;
        world.boostTimeLeft = 0;
        world.boostMult = 1;
      }
    } else {
      world.boostMult = 1;
    }

    world.speed = world.baseSpeed * (world.boostMult || 1);

    // スクロール更新
    world.scrollX += world.speed * dt;

    // プレイヤー物理
    const p = world.player;
    p.vy += world.gravity * dt;
    p.y += p.vy * dt;

    // 地面判定
    const footY = p.y + getPlayerDrawH() - world.feetOffset;
    if (footY >= world.groundY) {
      // 地面に着地
      const desiredY = world.groundY - (getPlayerDrawH() - world.feetOffset);
      p.y = desiredY;
      p.vy = 0;
      p.onGround = true;
    } else {
      p.onGround = false;
    }

    updateHUD();
  }

  function updateHUD() {
    // pips
    for (let i = 0; i < boostPips.length; i++) {
      boostPips[i].classList.toggle("on", i < world.boostStock);
    }

    // timer text
    const next = Math.max(0, world.stockTimer);
    if (world.boostStock >= world.boostMax) {
      boostTimerEl.textContent = "MAX";
    } else {
      boostTimerEl.textContent = `+1 in ${next.toFixed(1)}s`;
    }

    // ボタン活性（視覚的に）
    btnBoost.disabled = world.boostStock <= 0;
    btnJumpBoost.disabled = world.boostStock < world.boostMax;
    btnBoost.style.opacity = btnBoost.disabled ? "0.55" : "1";
    btnJumpBoost.style.opacity = btnJumpBoost.disabled ? "0.55" : "1";
  }

  // ====== Render ======
  function render() {
    // クリア（背景無し）
    ctx.clearRect(0, 0, VIRTUAL_W, VIRTUAL_H);

    // ステージ（st.png）を横にループ表示
    drawStageLoop();

    // プレイヤー（板→キャラ）
    drawPlayer();

    // デバッグ線（必要なら true）
    const debug = false;
    if (debug) {
      ctx.save();
      ctx.globalAlpha = 0.7;
      ctx.beginPath();
      ctx.moveTo(0, world.groundY);
      ctx.lineTo(VIRTUAL_W, world.groundY);
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawStageLoop() {
    const img = assets.st;
    if (!img.complete || img.naturalWidth === 0) {
      // ロード中の代替
      ctx.save();
      ctx.fillStyle = "#0b111a";
      ctx.fillRect(0, 0, VIRTUAL_W, VIRTUAL_H);
      ctx.fillStyle = "rgba(255,255,255,0.75)";
      ctx.font = "700 22px system-ui";
      ctx.fillText("Loading st.png ...", 24, 48);
      ctx.restore();
      return;
    }

    // 表示サイズ（縦画面：下側に床として配置。画像比率は維持）
    const targetW = VIRTUAL_W;
    const scale = targetW / img.naturalWidth;
    const drawW = img.naturalWidth * scale;
    const drawH = img.naturalHeight * scale;

    // 画像のどの高さをgroundYに合わせるか：基本は「画像の上辺が地面」ではなく、
    // 画像の“走れるライン”に合わせたいので、ここは簡易的に画像の上端を少し上に置く。
    // 必要なら stageTopY を微調整して、st.pngの床ラインに合わせてください。
    const stageTopY = world.groundY - 140; // ここを調整すると「st.pngのどこを走るか」合わせやすい

    // ループ
    const loopW = drawW; // targetWと同じ
    const offset = -((world.scrollX % loopW + loopW) % loopW);

    // 横に3枚敷けば確実に埋まる
    for (let i = -1; i <= 1; i++) {
      ctx.drawImage(img, offset + i * loopW, stageTopY, drawW, drawH);
    }
  }

  function drawPlayer() {
    const p = world.player;
    const plImg = (p.onGround ? assets.pl1 : assets.pl2);
    const skImg = assets.sk;

    const plReady = plImg.complete && plImg.naturalWidth > 0;
    const skReady = skImg.complete && skImg.naturalWidth > 0;

    const plW = getPlayerDrawW();
    const plH = getPlayerDrawH();

    // キャラの基準位置
    const px = p.x;
    const py = p.y;

    // スケボー（足元）
    if (skReady) {
      const skScale = 0.9; // 板の大きさ調整
      const skW = skImg.naturalWidth * skScale;
      const skH = skImg.naturalHeight * skScale;

      // キャラの足元近辺に配置
      const skX = px + (plW * 0.5) - (skW * 0.5);
      const skY = py + plH - skH + p.boardYOffset;

      ctx.drawImage(skImg, skX, skY, skW, skH);
    }

    // キャラ
    if (plReady) {
      ctx.drawImage(plImg, px, py, plW, plH);
    } else {
      // 代替表示
      ctx.save();
      ctx.fillStyle = "rgba(255,255,255,0.75)";
      ctx.fillRect(px, py, plW, plH);
      ctx.fillStyle = "#000";
      ctx.font = "700 18px system-ui";
      ctx.fillText("Loading PL*.png", px + 10, py + 30);
      ctx.restore();
    }
  }

  function getPlayerDrawW() {
    // 画像基準が不明なので、縦画面で自然に見える幅を固定
    return 160;
  }
  function getPlayerDrawH() {
    return 200;
  }

  // ====== Boot ======
  function boot() {
    resizeCanvasToDPR();

    // 初期位置（地面に合わせて立たせる）
    const p = world.player;
    p.y = world.groundY - (getPlayerDrawH() - world.feetOffset);
    p.vy = 0;
    p.onGround = true;

    // 初期ブースト設定
    world.boostMult = 1;
    world.stockTimer = world.stockInterval;

    // 縦画面での見た目安定（CSS上は縮むが内部は仮想解像度）
    // 画面回転に追従（必要なら）
    window.addEventListener("resize", () => {
      // 仮想解像度は固定、DPRのみ再設定
      resizeCanvasToDPR();
    });

    updateHUD();
    requestAnimationFrame(tick);
  }

  // 画像読み込み失敗時もゲームは起動する（代替描画あり）
  boot();
})();
