// game.js : MOB STREET - 1P RUN (V3)
// V3 changes:
// - Guard rail draw keeps aspect ratio (no stretching)
// - Guard rails are "short and frequent" (A)
// - While riding guard rail: small speed-up
// - Boost: single tap gives temporary burst, then returns (prevents "forever fast")

(() => {
  "use strict";

  // =========================
  // VERSION
  // =========================
  const VERSION = "V3";

  // =========================
  // DOM
  // =========================
  const canvas = document.getElementById("gameCanvas");
  const ctx = canvas.getContext("2d", { alpha: true });

  const elLoading = document.getElementById("loading");
  const elBoostText = document.getElementById("boostText");
  const elBadgeVersion = document.getElementById("badgeVersion");
  const elCenterBadge = document.getElementById("centerBadge");

  const btnJump = document.getElementById("btnJump");
  const btnBoost = document.getElementById("btnBoost");
  const btnJumpBoost = document.getElementById("btnJumpBoost");

  elBadgeVersion.textContent = VERSION;
  elCenterBadge.textContent = VERSION;

  // Prevent iOS long-press selection / double-tap zoom
  const preventDefault = (e) => { e.preventDefault(); };
  ["gesturestart","gesturechange","gestureend"].forEach(ev => {
    document.addEventListener(ev, preventDefault, { passive: false });
  });

  // =========================
  // ASSETS
  // =========================
  const ASSET_LIST = [
    "PL1.png.png",
    "PL2.png.png",
    "redsk.png",
    "st.png",
    "gardw.png"
  ];

  const assets = {};
  let assetsReady = false;

  function loadImage(src) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve({ ok: true, img });
      img.onerror = () => resolve({ ok: false, img: null });
      img.src = src;
    });
  }

  async function loadAssets() {
    const results = await Promise.all(ASSET_LIST.map(loadImage));
    for (let i = 0; i < ASSET_LIST.length; i++) {
      assets[ASSET_LIST[i]] = results[i].img;
    }
    assetsReady = true;
    elLoading.style.display = "none";
  }

  // =========================
  // RESIZE / CANVAS
  // =========================
  const DPR_CAP = 2; // keep stable on phones
  function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, DPR_CAP);
    canvas.width = Math.max(1, Math.floor(rect.width * dpr));
    canvas.height = Math.max(1, Math.floor(rect.height * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  window.addEventListener("resize", resizeCanvas);

  // =========================
  // GAME CONFIG
  // =========================
  const GRAVITY = 2400; // px/s^2
  const JUMP_V0 = 820;  // px/s
  const BASE_SPEED = 190; // px/s (feel similar to your screenshots)

  const BOOST_MAX = 5;
  const BOOST_REGEN_SEC = 5.0;

  // Boost burst (temporary)
  const BOOST_BURST_ADD = 230;   // px/s added initially
  const BOOST_BURST_TIME = 0.55; // seconds of strong boost
  const BOOST_DECAY_TIME = 0.70; // seconds to return to normal after burst

  // Ground tuning
  function getGroundY() {
    // Keep the ground above the control area visually stable.
    // Using ~ 78% of canvas height works well for tall mobile view.
    return Math.floor(canvas.clientHeight * 0.78);
  }

  // Player rendering sizes (approx 48x48 composite)
  const PLAYER_DRAW = { w: 44, h: 44 };
  const BOARD_DRAW = { w: 34, h: 18 };

  // =========================
  // WORLD STATE
  // =========================
  const state = {
    t: 0,
    lastTs: 0,
    running: true,

    // player kinematics
    player: {
      x: 120, // screen x (fixed)
      y: 0,   // screen y
      vy: 0,
      onGround: true,
      onGuard: false,
      spriteJump: false,
    },

    // scrolling
    worldX: 0,     // how far progressed in px-units
    speed: BASE_SPEED,

    // boost
    boost: {
      stock: 0,
      regenTimer: 0,
      burstTimer: 0,
      decayTimer: 0,
      activeAdd: 0
    },

    // guard rails list (world coords)
    guards: [],
    nextGuardX: 0,

    // visuals
    showCenterBadgeTimer: 1.3, // show big V3 briefly
  };

  // =========================
  // GUARD RAIL (V3)
  // =========================
  // A: short & frequent
  // Keep aspect ratio: set a target height, compute width.
  const GUARD = {
    targetH: 18,         // lower guard (as requested previously)
    minGap: 220,         // px
    maxGap: 520,         // px
    speedMul: 1.08,      // small speed-up while riding
    sideBounce: 70,      // bounce-back strength on front collision
  };

  function getGuardDrawSize() {
    const img = assets["gardw.png"];
    if (img && img.naturalWidth > 0 && img.naturalHeight > 0) {
      const h = GUARD.targetH;
      const w = Math.round(h * (img.naturalWidth / img.naturalHeight));
      return { w, h };
    }
    // fallback if image missing
    return { w: 90, h: GUARD.targetH };
  }

  function spawnFirstGuards() {
    const start = state.worldX + canvas.clientWidth + 160;
    state.nextGuardX = start;
    state.guards.length = 0;
    // spawn 3 ahead for safety
    for (let i = 0; i < 3; i++) spawnNextGuard();
  }

  function spawnNextGuard() {
    const { w, h } = getGuardDrawSize();
    const gx = state.nextGuardX;
    const groundY = getGroundY();
    const gy = groundY - h + 1; // sit on ground
    state.guards.push({
      x: gx,
      y: gy,
      w,
      h,
      // top surface for riding
      top: gy,
      left: gx,
      right: gx + w
    });

    const gap = rand(GUARD.minGap, GUARD.maxGap);
    state.nextGuardX = gx + w + gap;
  }

  function cleanupAndEnsureGuards() {
    const camLeft = state.worldX - 200;
    const camRight = state.worldX + canvas.clientWidth + 600;

    // remove old
    state.guards = state.guards.filter(g => g.x + g.w > camLeft);

    // ensure ahead
    while (state.nextGuardX < camRight) spawnNextGuard();
  }

  // =========================
  // INPUT
  // =========================
  function doJump() {
    const p = state.player;

    // allow jump if on ground or on guard
    if (p.onGround || p.onGuard) {
      p.vy = -JUMP_V0;
      p.onGround = false;
      p.onGuard = false;
      p.spriteJump = true;
    }
  }

  function doBoost() {
    const b = state.boost;
    if (b.stock <= 0) return;

    b.stock -= 1;
    b.burstTimer = BOOST_BURST_TIME;
    b.decayTimer = 0;
    b.activeAdd = BOOST_BURST_ADD;
    updateHud();
  }

  function bindButton(btn, fn) {
    // Touch + mouse safe
    const onDown = (e) => { e.preventDefault(); fn(); };
    btn.addEventListener("touchstart", onDown, { passive: false });
    btn.addEventListener("mousedown", onDown);
  }

  bindButton(btnJump, doJump);
  bindButton(btnBoost, doBoost);

  // Keyboard (PC)
  window.addEventListener("keydown", (e) => {
    if (e.code === "Space") { e.preventDefault(); doJump(); }
    if (e.key === "b" || e.key === "B") { doBoost(); }
  });

  // =========================
  // HUD
  // =========================
  function updateHud() {
    elBoostText.textContent = `${state.boost.stock} / ${BOOST_MAX}`;
  }

  // =========================
  // PHYSICS / COLLISION
  // =========================
  function playerAABB(p) {
    // approximate hitbox around composite
    const w = 30;
    const h = 34;
    const x = p.x - w * 0.5;
    const y = p.y - h;
    return { x, y, w, h, left: x, right: x + w, top: y, bottom: y + h };
  }

  function resolveCollisions(dt) {
    const p = state.player;
    const groundY = getGroundY();

    p.onGuard = false;

    // Ground
    if (p.y >= groundY) {
      p.y = groundY;
      p.vy = 0;
      p.onGround = true;
      p.spriteJump = false;
    } else {
      p.onGround = false;
    }

    // Guard rails
    const aabb = playerAABB(p);
    const prevBottom = aabb.bottom - p.vy * dt; // approx previous bottom

    const camX = state.worldX;
    for (const g of state.guards) {
      // convert world -> screen
      const sx = g.x - camX;
      const sy = g.y;

      const gLeft = sx;
      const gRight = sx + g.w;
      const gTop = sy;
      const gBottom = sy + g.h;

      // broad phase near player
      if (gRight < aabb.left - 60 || gLeft > aabb.right + 60) continue;

      // landing on top (falling)
      const isFalling = p.vy >= 0;
      const overlapsX = (aabb.right > gLeft + 4) && (aabb.left < gRight - 4);

      if (isFalling && overlapsX) {
        const nowBottom = aabb.bottom;
        const wasAbove = prevBottom <= gTop + 6;
        const penetrated = nowBottom >= gTop;

        if (wasAbove && penetrated && nowBottom <= gBottom + 22) {
          // land
          p.y = gTop + aabb.h; // because aabb.y = p.y - h
          p.vy = 0;
          p.onGuard = true;
          p.onGround = false;
          p.spriteJump = false;
        }
      }

      // side collision if not on top and moving into it
      // If player is at similar height to collide
      const overlapsY = (aabb.bottom > gTop + 4) && (aabb.top < gBottom - 4);
      if (!p.onGuard && overlapsY) {
        // front hit
        if (aabb.right > gLeft && aabb.left < gLeft && p.vy > -300) {
          // push back slightly in world space
          state.worldX = Math.max(0, state.worldX - GUARD.sideBounce * dt);
        }
      }
    }
  }

  // =========================
  // UPDATE
  // =========================
  function update(dt) {
    const p = state.player;
    const b = state.boost;

    // show center badge briefly
    if (state.showCenterBadgeTimer > 0) {
      state.showCenterBadgeTimer -= dt;
      if (state.showCenterBadgeTimer <= 0) elCenterBadge.style.display = "none";
    }

    // boost regen
    b.regenTimer += dt;
    while (b.regenTimer >= BOOST_REGEN_SEC) {
      b.regenTimer -= BOOST_REGEN_SEC;
      if (b.stock < BOOST_MAX) b.stock += 1;
      updateHud();
    }

    // boost burst behavior (temporary, then return)
    if (b.burstTimer > 0) {
      b.burstTimer -= dt;
      if (b.burstTimer <= 0) {
        b.burstTimer = 0;
        b.decayTimer = BOOST_DECAY_TIME;
      }
    } else if (b.decayTimer > 0) {
      b.decayTimer -= dt;
      if (b.decayTimer <= 0) {
        b.decayTimer = 0;
        b.activeAdd = 0;
      } else {
        // linear decay
        const k = b.decayTimer / BOOST_DECAY_TIME;
        b.activeAdd = BOOST_BURST_ADD * k;
      }
    }

    // gravity
    p.vy += GRAVITY * dt;
    p.y += p.vy * dt;

    // collisions set onGuard/onGround
    resolveCollisions(dt);

    // speed (guard rail small speedup)
    const guardMul = p.onGuard ? GUARD.speedMul : 1.0;
    const target = BASE_SPEED * guardMul + b.activeAdd;

    // smooth approach to target (also prevents "forever fast")
    const accel = 1100; // px/s^2
    if (state.speed < target) state.speed = Math.min(target, state.speed + accel * dt);
    else state.speed = Math.max(target, state.speed - accel * dt);

    // scroll
    state.worldX += state.speed * dt;

    // guards
    cleanupAndEnsureGuards();
  }

  // =========================
  // RENDER
  // =========================
  function drawBackground() {
    // canvas already has CSS gradient; keep it clean here.
    // (No fill required, but we clear to avoid trails.)
    ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
  }

  function drawGround() {
    const groundY = getGroundY();
    const tile = assets["st.png"];
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;

    if (tile && tile.naturalWidth > 0) {
      // repeat tile horizontally
      const tileH = 90; // draw height
      const tileW = Math.round(tileH * (tile.naturalWidth / tile.naturalHeight));
      const offset = -(state.worldX % tileW);
      for (let x = offset; x < w + tileW; x += tileW) {
        ctx.drawImage(tile, x, groundY - tileH + 16, tileW, tileH);
      }
    } else {
      // fallback ground
      ctx.fillStyle = "rgba(0,0,0,0.25)";
      ctx.fillRect(0, groundY, w, h - groundY);
      ctx.fillStyle = "rgba(255,255,255,0.12)";
      ctx.fillRect(0, groundY - 4, w, 4);
    }
  }

  function drawGuards() {
    const img = assets["gardw.png"];
    const camX = state.worldX;

    for (const g of state.guards) {
      const sx = g.x - camX;
      const sy = g.y;

      if (sx + g.w < -80 || sx > canvas.clientWidth + 80) continue;

      if (img && img.naturalWidth > 0) {
        // V3: keep aspect ratio because g.w is derived from g.h
        ctx.drawImage(img, sx, sy, g.w, g.h);
      } else {
        // fallback
        ctx.fillStyle = "rgba(255,0,0,0.35)";
        ctx.fillRect(sx, sy, g.w, g.h);
        ctx.strokeStyle = "rgba(255,255,255,0.35)";
        ctx.strokeRect(sx, sy, g.w, g.h);
      }
    }
  }

  function drawPlayer() {
    const p = state.player;

    const pl = p.spriteJump ? assets["PL2.png.png"] : assets["PL1.png.png"];
    const board = assets["redsk.png"];

    const drawX = p.x;
    const drawY = p.y;

    // board under
    if (board && board.naturalWidth > 0) {
      const bx = drawX - BOARD_DRAW.w * 0.55;
      const by = drawY - 16;
      ctx.drawImage(board, bx, by, BOARD_DRAW.w, BOARD_DRAW.h);
    } else {
      ctx.fillStyle = "rgba(255,0,0,0.25)";
      ctx.fillRect(drawX - 18, drawY - 16, 36, 10);
    }

    // player sprite (slightly above board)
    if (pl && pl.naturalWidth > 0) {
      const px = drawX - PLAYER_DRAW.w * 0.52;
      const py = drawY - PLAYER_DRAW.h - 6;
      ctx.drawImage(pl, px, py, PLAYER_DRAW.w, PLAYER_DRAW.h);
    } else {
      ctx.fillStyle = "rgba(255,255,255,0.35)";
      ctx.fillRect(drawX - 16, drawY - 40, 32, 34);
    }

    // "プレイヤー" label above head (small)
    ctx.font = "12px system-ui, -apple-system, Hiragino Sans, Noto Sans JP, sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.95)";
    ctx.strokeStyle = "rgba(0,0,0,0.45)";
    ctx.lineWidth = 3;
    const label = "プレイヤー";
    const tx = drawX - ctx.measureText(label).width * 0.5;
    const ty = drawY - 52;
    ctx.strokeText(label, tx, ty);
    ctx.fillText(label, tx, ty);
  }

  function render() {
    drawBackground();
    drawGuards();
    drawGround();
    drawPlayer();
  }

  // =========================
  // LOOP
  // =========================
  function tick(ts) {
    if (!state.lastTs) state.lastTs = ts;
    const dt = Math.min(0.033, (ts - state.lastTs) / 1000);
    state.lastTs = ts;

    if (assetsReady) {
      update(dt);
      render();
    }

    requestAnimationFrame(tick);
  }

  // =========================
  // UTILS
  // =========================
  function rand(a, b) { return a + Math.random() * (b - a); }

  // =========================
  // START
  // =========================
  function init() {
    resizeCanvas();
    updateHud();

    // init player position
    state.player.y = getGroundY();

    // guards
    spawnFirstGuards();

    // touch scroll prevention inside app
    document.body.addEventListener("touchmove", (e) => e.preventDefault(), { passive: false });

    loadAssets().then(() => {
      // ensure sizes computed with loaded image
      spawnFirstGuards();
    });

    requestAnimationFrame(tick);
  }

  init();
})();
