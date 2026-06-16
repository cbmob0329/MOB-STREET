'use strict';

(function () {
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');

  const timeText = document.getElementById('timeText');
  const speedText = document.getElementById('speedText');
  const rankText = document.getElementById('rankText');
  const miniPlayer = document.getElementById('miniPlayer');

  const accelBtn = document.getElementById('accelBtn');
  const jumpBtn = document.getElementById('jumpBtn');

  const IMG = {
    player: 'play/green.png',
    road: 'st/doro.png',
    bg: 'st/asa.png'
  };

  const images = {};
  let loaded = 0;
  let ready = false;

  const COURSE_LENGTH = 3000;

  const state = {
    time: 0,
    distance: 0,
    speed: 260,
    maxSpeed: 620,
    baseSpeed: 260,
    accelPower: 520,
    friction: 240,

    roadScroll: 0,
    bgProgress: 0,

    playerX: 0,
    playerY: 0,
    playerVy: 0,
    grounded: true,

    accel: false,
    jump: false
  };

  function loadImages() {
    const keys = Object.keys(IMG);

    keys.forEach((key) => {
      const img = new Image();
      img.onload = () => {
        loaded++;
        if (loaded >= keys.length) {
          ready = true;
          requestAnimationFrame(loop);
        }
      };
      img.onerror = () => {
        console.warn('画像が読み込めません:', IMG[key]);
        loaded++;
        if (loaded >= keys.length) {
          ready = true;
          requestAnimationFrame(loop);
        }
      };
      img.src = IMG[key];
      images[key] = img;
    });
  }

  function resize() {
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    canvas.width = Math.floor(window.innerWidth * dpr);
    canvas.height = Math.floor(window.innerHeight * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function setButtonHold(button, key) {
    button.addEventListener('touchstart', (e) => {
      e.preventDefault();
      state[key] = true;
    }, { passive: false });

    button.addEventListener('touchend', (e) => {
      e.preventDefault();
      state[key] = false;
    }, { passive: false });

    button.addEventListener('mousedown', () => {
      state[key] = true;
    });

    button.addEventListener('mouseup', () => {
      state[key] = false;
    });

    button.addEventListener('mouseleave', () => {
      state[key] = false;
    });
  }

  function setupInput() {
    setButtonHold(accelBtn, 'accel');

    jumpBtn.addEventListener('touchstart', (e) => {
      e.preventDefault();
      jump();
    }, { passive: false });

    jumpBtn.addEventListener('mousedown', jump);

    window.addEventListener('keydown', (e) => {
      if (e.code === 'ArrowRight' || e.code === 'Space') state.accel = true;
      if (e.code === 'ArrowUp') jump();
    });

    window.addEventListener('keyup', (e) => {
      if (e.code === 'ArrowRight' || e.code === 'Space') state.accel = false;
    });
  }

  function jump() {
    if (!state.grounded) return;
    state.grounded = false;
    state.playerVy = -680;
  }

  function update(dt) {
    state.time += dt;

    if (state.accel) {
      state.speed += state.accelPower * dt;
    } else {
      state.speed -= state.friction * dt;
    }

    if (state.speed < state.baseSpeed) state.speed = state.baseSpeed;
    if (state.speed > state.maxSpeed) state.speed = state.maxSpeed;

    state.distance += state.speed * dt;
    if (state.distance > COURSE_LENGTH) {
      state.distance = 0;
      state.time = 0;
    }

    state.roadScroll += state.speed * dt;

    state.bgProgress = state.distance / COURSE_LENGTH;

    const groundY = window.innerHeight * 0.73;

    state.playerVy += 1800 * dt;
    state.playerY += state.playerVy * dt;

    if (state.playerY >= groundY) {
      state.playerY = groundY;
      state.playerVy = 0;
      state.grounded = true;
    }

    state.playerX = window.innerWidth * 0.22;

    updateHud();
  }

  function updateHud() {
    timeText.textContent = state.time.toFixed(2);
    speedText.textContent = Math.floor(state.speed);
    rankText.textContent = calcRank() + '/8';

    const p = state.distance / COURSE_LENGTH;
    miniPlayer.style.left = `${10 + p * 80}%`;
  }

  function calcRank() {
    const p = state.distance / COURSE_LENGTH;
    if (p > 0.78) return 1;
    if (p > 0.58) return 2;
    if (p > 0.38) return 3;
    return 4;
  }

  function drawBackground(w, h) {
    const img = images.bg;

    ctx.fillStyle = '#7edcff';
    ctx.fillRect(0, 0, w, h);

    if (!img || !img.complete || img.naturalWidth <= 0) return;

    const zoom = 1.16;
    const drawH = h * 0.82 * zoom;
    const scale = drawH / img.naturalHeight;
    const drawW = img.naturalWidth * scale;

    const maxMove = Math.max(0, drawW - w);
    const x = -maxMove * state.bgProgress;
    const y = 0;

    ctx.drawImage(img, x, y, drawW, drawH);
  }

  function drawRoad(w, h) {
    const img = images.road;
    const roadY = h * 0.64;
    const roadH = h * 0.36;

    ctx.fillStyle = '#222';
    ctx.fillRect(0, roadY, w, roadH);

    if (!img || !img.complete || img.naturalWidth <= 0) return;

    const scale = roadH / img.naturalHeight;
    const tileW = img.naturalWidth * scale;
    const overlap = 8;
    const step = tileW - overlap;

    let x = -(state.roadScroll % step) - step;

    while (x < w + step) {
      ctx.drawImage(img, x, roadY, tileW, roadH);
      x += step;
    }
  }

  function drawPlayer(w, h) {
    const img = images.player;
    if (!img || !img.complete || img.naturalWidth <= 0) return;

    const size = Math.min(w, h) * 0.18;
    const bob = state.grounded ? Math.sin(state.time * 16) * 3 : 0;
    const angle = state.grounded ? Math.sin(state.time * 10) * 0.025 : state.playerVy * 0.00035;

    ctx.save();
    ctx.translate(state.playerX, state.playerY + bob);
    ctx.rotate(angle);
    ctx.drawImage(img, -size / 2, -size, size, size);
    ctx.restore();
  }

  function drawGoalGuide(w, h) {
    const p = state.distance / COURSE_LENGTH;
    if (p < 0.92) return;

    const x = w - ((p - 0.92) / 0.08) * w;
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillRect(x, h * 0.54, 8, h * 0.28);
  }

  function draw() {
    const w = window.innerWidth;
    const h = window.innerHeight;

    ctx.clearRect(0, 0, w, h);

    drawBackground(w, h);
    drawRoad(w, h);
    drawGoalGuide(w, h);
    drawPlayer(w, h);
  }

  let last = 0;

  function loop(now) {
    if (!ready) return;

    const dt = Math.min(0.033, (now - last) / 1000 || 0);
    last = now;

    update(dt);
    draw();

    requestAnimationFrame(loop);
  }

  window.addEventListener('resize', resize);

  resize();
  setupInput();
  loadImages();
})();
