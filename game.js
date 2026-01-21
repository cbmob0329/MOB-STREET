(() => {
  "use strict";

  // =========================
  // MOB STREET - 1P RUN V3.1
  // - png.png を一切使用しない（PL1.png / PL2.png）
  // - 地面Yを安定化（操作エリアと分離）
  // - ガードレールは必ず出る（一定間隔）
  // =========================

  const VERSION = "V3.1";

  // ---- Asset names (NO png.png) ----
  const ASSET_LIST = {
    PL1: "PL1.png",
    PL2: "PL2.png",
    REDSK: "redsk.png",
    STAGE: "st.png",
    GARD: "gardw.png",
  };

  // ---- Canvas / ctx ----
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d", { alpha: true });

  // ---- HUD elements ----
  const elVer = document.getElementById("verBadge");
  const elBoostCount = document.getElementById("boostCount");
  const elBoostMax = document.getElementById("boostMax");
  const elMsg = document.getElementById("msg");

  elVer.textContent = VERSION;

  // ---- Controls ----
  const btnJump = document.getElementById("btnJump");
  const btnBoost = document.getElementById("btnBoost");
  const btnJumpBoost = document.getElementById("btnJumpBoost");

  // Prevent iOS selection/zoom/scroll on buttons area
  const preventTouch = (e) => { e.preventDefault(); };
  [btnJump, btnBoost, btnJumpBoost, canvas].forEach(el => {
    el.addEventListener("touchstart", preventTouch, { passive: false });
    el.addEventListener("touchmove", preventTouch, { passive: false });
    el.addEventListener("touchend", preventTouch, { passive: false });
  });

  // ---- Game constants ----
  const BOOST_MAX = 5;
  const BOOST_REGEN_SEC = 5.0;
  const BASE_SPEED = 190;            // baseline
  const BOOST_SPEED_ADD = 160;       // one boost push
  const BOOST_DUR = 0.9;             // seconds
  const GRAVITY = 2200;              // px/s^2
  const JUMP_VY = 860;               // px/s
  const DOUBLE_JUMP_VY = 760;        // px/s
  const PLAYER_X_RATIO = 0.28;       // more left
  const SPRITE_TARGET = 48;          // approx 48x48 composition target

  // ---- World layout ----
  // We keep a stable "world ground line" inside the play area.
  // Ground Y is computed from canvas height, leaving a safe margin so player never sinks into UI.
  function computeGroundY() {
    // 18% from bottom of play area -> stable across devices
    // (tuned so st.png ground looks correct and player stays visible)
    return Math.round(canvas.height * 0.74);
  }

  // ---- Game state ----
  const state = {
    assets: {},
    assetsReady: false,

    tPrev: 0,
    time: 0,

    groundY: 0,

    // Player physics
    px: 0,
    py: 0,
    vy: 0,
    onGround: true,
    canDouble: true,

    // Speed
    speed: BASE_SPEED,
    boostStock: 0,
    boostTimer: 0,
    regenTimer: 0,

    // Stage tiling
    stageScroll: 0,

    // Obstacles / gimmicks (V3.1 uses guardrail only, stable)
    guards: [],

    // Spawn pacing
    nextGuardDist: 260,     // meters-ish (uses dist units)
    dist: 0,

    // Simple start fade (to avoid black overlay issue)
    startFade: 0,

    // Debug message
    lastWarn: "",
  };

  // ---- Helpers ----
  function showMsg(txt) {
    if (!txt) {
      elMsg.style.display = "none";
      elMsg.textContent = "";
      return;
    }
    elMsg.style.display = "block";
    elMsg.textContent = txt;
  }

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  // Convert "game distance" like your previous dist metric
  // We keep dist increasing roughly with speed.
  function advanceDistance(dt) {
    // scale factor so speed ~190 gives decent progression
    const k = 0.08;
    state.dist += state.speed * dt * k;
  }

  // ---- Asset loader (robust) ----
  function loadImage(src) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve({ ok: true, img, src });
      img.onerror = () => resolve({ ok: false, img: null, src });
      // cache-bust a little to avoid stale images on Pages
      img.src = src + "?v=" + encodeURIComponent(VERSION);
    });
  }

  async function loadAssets() {
    const entries = Object.entries(ASSET_LIST);
    const results = await Promise.all(entries.map(([k, v]) => loadImage(v)));
    const missing = [];
    results.forEach((r, i) => {
      const key = entries[i][0];
      if (r.ok) state.assets[key] = r.img;
      else missing.push(entries[i][1]);
    });

    state.assetsReady = true;

    if (missing.length) {
      showMsg(
        "画像が見つからない: " + missing.join(", ") +
        "\n（ファイル名が一致しているか確認）"
      );
    } else {
      showMsg("");
    }
  }

  // ---- Resize: make canvas match playArea exactly ----
  function resizeCanvas() {
    const playArea = document.getElementById("playArea");
    const rect = playArea.getBoundingClientRect();

    // device pixel ratio for crispness
    const dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));

    canvas.width = Math.floor(rect.width * dpr);
    canvas.height = Math.floor(rect.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Update world ground
    state.groundY = computeGroundY();

    // Reposition player safely
    state.px = Math.round((rect.width) * PLAYER_X_RATIO);
    // py is sprite base line (feet) -> set on ground
    state.py = state.groundY;
  }

  window.addEventListener("resize", resizeCanvas);

  // ---- Drawing helpers ----
  function drawBg() {
    // CSS gradient already, but we clear with transparent to keep it
    ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
  }

  function drawStage(dt) {
    const img = state.assets.STAGE;
    if (!img) return;

    // Tile horizontally
    const cw = canvas.clientWidth;
    const ch = canvas.clientHeight;

    // stage baseline: align stage bottom to groundY with a small offset
    const scale = 1; // draw at native px-to-css scale
    const iw = img.width * scale;
    const ih = img.height * scale;

    // Set stage Y so that its "ground line" feels consistent.
    // We anchor the bottom of stage near groundY + 58px (tuned for your st.png look).
    const stageY = Math.round(state.groundY - ih * 0.55);

    state.stageScroll = (state.stageScroll + state.speed * dt * 0.35) % iw;

    // Draw multiple tiles
    const startX = -state.stageScroll;
    for (let x = startX; x < cw + iw; x += iw) {
      ctx.drawImage(img, x, stageY, iw, ih);
    }
  }

  function drawGuard(guard) {
    const img = state.assets.GARD;
    if (!img) return;
    // guard placed slightly above ground so you "jump onto it"
    const y = Math.round(state.groundY - guard.h);
    ctx.drawImage(img, guard.x, y, guard.w, guard.h);
  }

  function drawPlayer() {
    const plImg = state.onGround ? state.assets.PL1 : state.assets.PL2;
    const skImg = state.assets.REDSK;

    const cw = canvas.clientWidth;

    // If missing images, draw fallback box so player never "disappears"
    const want = SPRITE_TARGET;
    const px = Math.round(state.px);
    const baseY = Math.round(state.py);

    // Determine sizes
    let plW = want, plH = want;
    let skW = want, skH = want;

    if (plImg) {
      const s = want / Math.max(plImg.width, plImg.height);
      plW = Math.round(plImg.width * s);
      plH = Math.round(plImg.height * s);
    }
    if (skImg) {
      const s = want / Math.max(skImg.width, skImg.height);
      skW = Math.round(skImg.width * s);
      skH = Math.round(skImg.height * s);
    }

    // Compose: skateboard slightly lower, player above it (riding)
    const skX = px - Math.round(skW * 0.52);
    const skY = baseY - Math.round(skH * 0.30);

    const plX = px - Math.round(plW * 0.55);
    const plY = skY - Math.round(plH * 0.78);

    if (skImg) ctx.drawImage(skImg, skX, skY, skW, skH);
    else {
      ctx.fillStyle = "rgba(255,80,80,0.85)";
      ctx.fillRect(skX, skY, skW, skH);
    }

    if (plImg) ctx.drawImage(plImg, plX, plY, plW, plH);
    else {
      ctx.fillStyle = "rgba(255,255,255,0.6)";
      ctx.fillRect(plX, plY, plW, plH);
    }

    // small label above head
    ctx.font = "12px sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.strokeStyle = "rgba(0,0,0,0.45)";
    ctx.lineWidth = 4;
    const label = "プレイヤー";
    const lx = px - 22;
    const ly = plY - 8;
    ctx.strokeText(label, lx, ly);
    ctx.fillText(label, lx, ly);
  }

  // ---- Collision: player feet line vs guard top ----
  function updateGuards(dt) {
    // Move existing guards left
    for (const g of state.guards) {
      g.x -= state.speed * dt * 0.35;
    }
    // Remove offscreen
    state.guards = state.guards.filter(g => g.x + g.w > -50);

    // Spawn by distance (guaranteed)
    if (state.dist >= state.nextGuardDist) {
      spawnGuard();
      // Next spawn: not too frequent
      state.nextGuardDist += 220 + Math.random() * 220;
    }
  }

  function spawnGuard() {
    const img = state.assets.GARD;
    const cw = canvas.clientWidth;

    // If image missing, still spawn with fallback size to keep logic stable
    const baseW = img ? img.width : 160;
    const baseH = img ? img.height : 60;

    // Scale guard lower (user wanted lower)
    const targetH = Math.round(SPRITE_TARGET * 0.85);
    const s = targetH / baseH;

    const w = Math.round(baseW * s);
    const h = Math.round(baseH * s);

    state.guards.push({
      x: cw + 30,
      w, h,
      // ride boost
      rideBoost: 40,
    });
  }

  function resolveRide(dt) {
    // Determine if player is on top of a guard (simple AABB with feet line)
    const playerFeetY = state.py;
    const playerX = state.px;

    let riding = null;
    for (const g of state.guards) {
      const topY = state.groundY - g.h;
      const withinX = (playerX > g.x + 4) && (playerX < g.x + g.w - 4);
      const nearTop = Math.abs(playerFeetY - topY) <= 8;
      // if player descending and hits top, snap
      if (withinX && (playerFeetY >= topY - 10) && (playerFeetY <= topY + 10) && state.vy >= 0) {
        riding = { g, topY };
        break;
      }
      // also keep riding if already snapped
      if (withinX && nearTop && state.vy === 0) {
        riding = { g, topY };
        break;
      }
    }

    if (riding) {
      // Snap onto guard top
      state.py = riding.topY;
      state.vy = 0;
      state.onGround = true;
      state.canDouble = true;

      // Slight speed-up while riding
      state.speed = Math.max(state.speed, BASE_SPEED + riding.g.rideBoost);
    } else {
      // If below ground, snap to ground
      if (state.py > state.groundY) {
        state.py = state.groundY;
        state.vy = 0;
        state.onGround = true;
        state.canDouble = true;
      }
    }
  }

  // ---- Input ----
  function doJump() {
    if (!state.assetsReady) return;

    if (state.onGround) {
      state.vy = -JUMP_VY;
      state.onGround = false;
      state.canDouble = true;
      return;
    }
    if (state.canDouble) {
      state.vy = -DOUBLE_JUMP_VY;
      state.canDouble = false;
    }
  }

  function doBoost() {
    if (!state.assetsReady) return;
    if (state.boostStock <= 0) return;

    state.boostStock -= 1;
    state.boostTimer = BOOST_DUR;
    updateHud();
  }

  btnJump.addEventListener("click", doJump);
  btnBoost.addEventListener("click", doBoost);

  // keyboard (PC)
  window.addEventListener("keydown", (e) => {
    if (e.code === "Space") { e.preventDefault(); doJump(); }
    if (e.code === "KeyB") { e.preventDefault(); doBoost(); }
  });

  // ---- Update HUD ----
  function updateHud() {
    elBoostCount.textContent = String(state.boostStock);
    elBoostMax.textContent = String(BOOST_MAX);
  }

  // ---- Main update loop ----
  function tick(ts) {
    const t = ts * 0.001;
    const dt = Math.min(0.033, state.tPrev ? (t - state.tPrev) : 0.016);
    state.tPrev = t;
    state.time += dt;

    // regen boost
    if (state.assetsReady) {
      state.regenTimer += dt;
      while (state.regenTimer >= BOOST_REGEN_SEC) {
        state.regenTimer -= BOOST_REGEN_SEC;
        if (state.boostStock < BOOST_MAX) state.boostStock += 1;
        updateHud();
      }
    }

    // boost effect
    if (state.boostTimer > 0) {
      state.boostTimer -= dt;
      state.speed = BASE_SPEED + BOOST_SPEED_ADD;
      if (state.boostTimer <= 0) {
        state.boostTimer = 0;
        // Return to base (do not stick forever)
        state.speed = BASE_SPEED;
      }
    } else {
      // If riding guard, resolveRide can raise speed slightly; otherwise base
      if (state.speed < BASE_SPEED) state.speed = BASE_SPEED;
      if (state.speed > BASE_SPEED + 80) {
        // cap small ride effects when not boosting
        state.speed = BASE_SPEED + 80;
      }
    }

    // physics
    state.vy += GRAVITY * dt;
    state.py += state.vy * dt;

    // If passed below ground, snap
    if (state.py >= state.groundY) {
      state.py = state.groundY;
      state.vy = 0;
      state.onGround = true;
      state.canDouble = true;
    }

    // distance & spawns
    advanceDistance(dt);
    updateGuards(dt);

    // ride resolution (must happen after moving)
    resolveRide(dt);

    // --- draw ---
    drawBg();
    drawStage(dt);

    // draw guards
    for (const g of state.guards) drawGuard(g);

    // draw player (never disappears: fallback box)
    drawPlayer();

    // start fade (keep it minimal, no black screen)
    if (state.startFade < 0.2) state.startFade += dt;
    // no overlay

    requestAnimationFrame(tick);
  }

  // ---- Init ----
  async function init() {
    resizeCanvas();
    updateHud();
    showMsg("Loading... 画像を読み込んでいます");

    await loadAssets();

    // Set player at ground
    state.py = state.groundY;
    state.vy = 0;
    state.onGround = true;

    // Start with 0 boost as requested
    state.boostStock = 0;
    updateHud();

    // Ensure at least one guard appears early so "出ない" にならない
    state.nextGuardDist = 80;

    showMsg(state.assets.PL1 ? "" : "PL1.png が読み込めていません（ファイル名確認）");
    requestAnimationFrame(tick);
  }

  init();
})();
