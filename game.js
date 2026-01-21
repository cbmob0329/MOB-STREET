(() => {
  'use strict';

  // =========================
  // V2 - stable baseline
  // =========================
  const VERSION = 'V2';

  // --- DOM
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d', { alpha: true });

  const elLoading = document.getElementById('loading');
  const elCenterBadge = document.getElementById('centerBadge');
  const elBoostTxt = document.getElementById('boostTxt');
  const elBoostMaxTxt = document.getElementById('boostMaxTxt');
  const elPlayerTag = document.getElementById('playerTag');

  const btnJump = document.getElementById('btnJump');
  const btnBoost = document.getElementById('btnBoost');

  // --- Assets (V2: png.png は使わない)
  const ASSET_LIST = [
    'PL1.png',
    'PL2.png',
    'redsk.png',
    'st.png',
    'gardw.png',
    'ringtap.png',
    'hpr.png',
    'hpg.png',
    'HA.png',
    'dokan.png',
    'or.png',
    'dan.png'
  ];

  const IMG = Object.create(null);

  function loadImage(src) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve({ ok: true, img, src });
      img.onerror = () => resolve({ ok: false, img: null, src });
      // cache bust for GH Pages slow propagation cases:
      img.src = src + (src.includes('?') ? '&' : '?') + 'v=' + Date.now();
    });
  }

  async function loadAssets() {
    const results = await Promise.all(ASSET_LIST.map(loadImage));
    for (const r of results) {
      if (r.ok) IMG[r.src.split('?')[0]] = r.img;
      // missing images are allowed; we’ll draw placeholders instead
    }
  }

  // --- Resize: canvas fits play area exactly (no black side bars)
  let viewW = 720, viewH = 900;
  function resizeCanvasToCSS() {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
    viewW = Math.max(2, Math.floor(rect.width * dpr));
    viewH = Math.max(2, Math.floor(rect.height * dpr));
    canvas.width = viewW;
    canvas.height = viewH;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = false;
  }

  window.addEventListener('resize', () => resizeCanvasToCSS(), { passive: true });

  // =========================
  // Game constants (V2)
  // =========================
  const BOOST_MAX = 5;
  const BOOST_REGEN_SEC = 5;
  const BASE_SPEED = 190;           // matches your stable feel
  const BOOST_SPEED_ADD = 160;      // boost burst
  const BOOST_DURATION = 0.75;      // seconds (NOT permanent)
  const GRAVITY = 2200;             // px/s^2
  const JUMP_VY = 920;              // px/s

  // Ground placement (play area only)
  function groundY() {
    // ground band area: keep character safely above control area
    return Math.floor(viewH * 0.72);
  }

  // =========================
  // Entities
  // =========================
  const player = {
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    onGround: true,
    jumping: false,
  };

  // Boost state
  let boostStock = 0;
  let boostTimer = 0;      // remaining boost time
  let regenTimer = 0;

  // World scroll (meters-ish)
  let dist = 0; // for future
  let speed = 0;

  // Obstacles (V2: simple guardrail spawn only)
  const guardrails = [];
  let nextGuardAt = 180; // meters-ish spacing

  // Utility
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  // =========================
  // Input
  // =========================
  function doJump() {
    if (!player.onGround) return;
    player.onGround = false;
    player.vy = -JUMP_VY;
  }

  function doBoost() {
    if (boostStock <= 0) return;
    boostStock--;
    boostTimer = BOOST_DURATION;
    updateHUD();
  }

  btnJump.addEventListener('pointerdown', (e) => { e.preventDefault(); doJump(); }, { passive: false });
  btnBoost.addEventListener('pointerdown', (e) => { e.preventDefault(); doBoost(); }, { passive: false });

  // Keyboard (PC)
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space') { e.preventDefault(); doJump(); }
    if (e.code === 'KeyB') { e.preventDefault(); doBoost(); }
  }, { passive: false });

  // Prevent iOS selection / double-tap zoom
  document.addEventListener('gesturestart', (e) => e.preventDefault(), { passive: false });

  // =========================
  // Spawning
  // =========================
  function spawnGuardrail() {
    // Guardrail sits on ground; rideable platform
    const gy = groundY();
    const img = IMG['gardw.png'] || null;
    const w = img ? img.width : 240;
    const h = img ? img.height : 70;

    guardrails.push({
      x: viewW + 40,
      y: gy - h + 6,
      w, h,
      img,
      speedAdd: 40,     // V2: “少し加速”は入れず、安定優先（V3で追加）
      active: true
    });
  }

  function updateSpawns() {
    // spawn by distance
    if (dist >= nextGuardAt) {
      spawnGuardrail();
      // spacing: not too frequent
      nextGuardAt += 260 + Math.random() * 240;
    }
  }

  // =========================
  // Physics / Update
  // =========================
  let lastT = performance.now();

  function update(dt) {
    // Regen boost
    regenTimer += dt;
    if (regenTimer >= BOOST_REGEN_SEC) {
      const n = Math.floor(regenTimer / BOOST_REGEN_SEC);
      regenTimer -= n * BOOST_REGEN_SEC;
      boostStock = clamp(boostStock + n, 0, BOOST_MAX);
      updateHUD();
    }

    // Speed
    const boostNow = boostTimer > 0 ? 1 : 0;
    boostTimer = Math.max(0, boostTimer - dt);

    speed = BASE_SPEED + (boostNow ? BOOST_SPEED_ADD : 0);

    // Move world
    dist += speed * dt * 0.1; // scale to “meter-ish”
    updateSpawns();

    // Player base position (left side)
    player.x = Math.floor(viewW * 0.20);

    // Gravity
    player.vy += GRAVITY * dt;
    player.y += player.vy * dt;

    const gy = groundY();
    // Default ground collision
    if (player.y >= gy) {
      player.y = gy;
      player.vy = 0;
      player.onGround = true;
    } else {
      player.onGround = false;
    }

    // Move obstacles left
    for (const g of guardrails) {
      g.x -= speed * dt;
      if (g.x + g.w < -80) g.active = false;
    }

    // Platform collision (stand on top)
    // If player falls onto guardrail top, land on it
    for (const g of guardrails) {
      if (!g.active) continue;
      const px = player.x;
      const py = player.y;
      const top = g.y;
      const left = g.x;
      const right = g.x + g.w;

      // standing check: player near top and within x-range
      if (player.vy >= 0 && px >= left + 8 && px <= right - 8) {
        // player's "feet" point is (x, y)
        const nextY = py;
        if (nextY >= top && nextY <= top + 22) {
          player.y = top;
          player.vy = 0;
          player.onGround = true;
        }
      }
    }

    // Cleanup
    for (let i = guardrails.length - 1; i >= 0; i--) {
      if (!guardrails[i].active) guardrails.splice(i, 1);
    }

    // Player tag follows player
    elPlayerTag.style.left = Math.max(10, Math.min(window.innerWidth - 120, (player.x / viewW) * window.innerWidth - 16)) + 'px';
    elPlayerTag.style.top = Math.max(60, (player.y / viewH) * (document.getElementById('playWrap').clientHeight) - 56) + 'px';
  }

  // =========================
  // Render
  // =========================
  function drawBackground() {
    // If HA.png exists, draw it as a single stage background (not loop)
    const bg = IMG['HA.png'];
    if (bg) {
      // cover
      const cw = viewW, ch = viewH;
      const iw = bg.width, ih = bg.height;
      const s = Math.max(cw / iw, ch / ih);
      const dw = iw * s, dh = ih * s;
      const dx = (cw - dw) * 0.5;
      const dy = (ch - dh) * 0.5;
      ctx.drawImage(bg, dx, dy, dw, dh);
      return;
    }
    // fallback gradient already from CSS; draw nothing
  }

  function drawGround() {
    const st = IMG['st.png'];
    const gy = groundY();

    if (st) {
      // tile horizontally
      const tileH = st.height;
      const tileY = gy - tileH + 6;
      const tileW = st.width;

      // compute a scroll offset from dist
      const scroll = Math.floor((dist * 6) % tileW);
      for (let x = -scroll; x < viewW + tileW; x += tileW) {
        ctx.drawImage(st, x, tileY);
      }
    } else {
      // placeholder
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(0, gy - 40, viewW, 120);
    }
  }

  function drawGuardrails() {
    for (const g of guardrails) {
      if (g.img) {
        ctx.drawImage(g.img, Math.floor(g.x), Math.floor(g.y));
      } else {
        ctx.fillStyle = 'rgba(255,255,255,0.6)';
        ctx.fillRect(Math.floor(g.x), Math.floor(g.y), g.w, g.h);
      }
    }
  }

  function drawPlayer() {
    const pl = player.onGround ? IMG['PL1.png'] : (IMG['PL2.png'] || IMG['PL1.png']);
    const sk = IMG['redsk.png'];

    // desired size: around 48x48 combined (approx)
    const target = Math.floor(Math.min(viewW, viewH) * 0.085); // ~48 on typical phone
    const cx = player.x;
    const cy = player.y;

    // skateboard
    if (sk) {
      const sw = target;
      const sh = Math.floor(target * (sk.height / sk.width));
      ctx.drawImage(sk, Math.floor(cx - sw * 0.45), Math.floor(cy - sh * 0.35), sw, sh);
    } else {
      ctx.fillStyle = 'rgba(255,0,0,0.8)';
      ctx.fillRect(Math.floor(cx - 18), Math.floor(cy - 12), 36, 10);
    }

    // player body (slightly above board)
    if (pl) {
      const pw = target;
      const ph = Math.floor(target * (pl.height / pl.width));
      ctx.drawImage(pl, Math.floor(cx - pw * 0.55), Math.floor(cy - ph * 0.95), pw, ph);
    } else {
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.fillRect(Math.floor(cx - 14), Math.floor(cy - 44), 28, 32);
    }
  }

  function render() {
    ctx.clearRect(0, 0, viewW, viewH);
    drawBackground();
    drawGround();
    drawGuardrails();
    drawPlayer();
  }

  // =========================
  // HUD
  // =========================
  function updateHUD() {
    elBoostTxt.textContent = String(boostStock);
    elBoostMaxTxt.textContent = String(BOOST_MAX);
  }

  function hideCenterBadgeSoon() {
    setTimeout(() => {
      if (elCenterBadge) elCenterBadge.style.display = 'none';
    }, 900);
  }

  // =========================
  // Loop
  // =========================
  function loop(t) {
    const dt = clamp((t - lastT) / 1000, 0, 1 / 20);
    lastT = t;

    update(dt);
    render();

    requestAnimationFrame(loop);
  }

  // =========================
  // Boot
  // =========================
  async function boot() {
    // set visible version
    document.getElementById('verPill').textContent = VERSION;
    if (elCenterBadge) elCenterBadge.textContent = VERSION;

    resizeCanvasToCSS();
    await loadAssets();

    // Initialize player
    player.y = groundY();
    player.vy = 0;
    player.onGround = true;

    // V2: boost start 0/5
    boostStock = 0;
    regenTimer = 0;
    boostTimer = 0;
    updateHUD();

    // Start spawning baseline
    dist = 0;
    nextGuardAt = 180;

    // Hide loading
    elLoading.style.display = 'none';
    hideCenterBadgeSoon();

    lastT = performance.now();
    requestAnimationFrame(loop);
  }

  boot();
})();
