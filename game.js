// =========================
// MOB STREET V2.1
// =========================

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight - 120;
}
window.addEventListener("resize", resize);
resize();

// -------------------------
// Assets
// -------------------------
const IMG = {};
const ASSETS = {
  bg: "HA.png",
  player: "PL1.png",
  guard: "gardw.png",
  pipe: "hpg.png"
};

let loaded = 0;
const need = Object.keys(ASSETS).length;

for (const k in ASSETS) {
  IMG[k] = new Image();
  IMG[k].src = ASSETS[k];
  IMG[k].onload = () => loaded++;
}

// -------------------------
// World
// -------------------------
const GROUND_Y = canvas.height - 40; // UI直上
const BASE_SPEED = 3 * 1.5; // B = 1.5倍

const player = {
  x: 120,
  y: GROUND_Y,
  vy: 0,
  onGround: true,
  jumpCount: 0
};

let speed = BASE_SPEED;
let boostStock = 0;
let boostTimer = 0;

// -------------------------
// Input
// -------------------------
document.getElementById("btnJump").onclick = jump;
document.getElementById("btnBoost").onclick = boost;

function jump() {
  if (player.jumpCount < 2) {
    player.vy = -9;
    player.onGround = false;
    player.jumpCount++;
  }
}

function boost() {
  if (boostTimer <= 0) {
    boostTimer = 40;
    speed = BASE_SPEED * 1.5;
  }
}

// -------------------------
// Objects
// -------------------------
const guards = [];
const pipes = [];

function spawnGuard(x) {
  guards.push({ x, y: GROUND_Y - 20 });
}
function spawnPipe(x) {
  pipes.push({ x, y: GROUND_Y });
}

for (let i = 1; i <= 5; i++) {
  spawnGuard(600 * i);
}
spawnPipe(1800);

// -------------------------
// Loop
// -------------------------
function update() {
  // gravity
  player.vy += 0.5;
  player.y += player.vy;

  if (player.y >= GROUND_Y) {
    player.y = GROUND_Y;
    player.vy = 0;
    player.onGround = true;
    player.jumpCount = 0;
  }

  if (boostTimer > 0) {
    boostTimer--;
    if (boostTimer === 0) speed = BASE_SPEED;
  }

  for (const g of guards) {
    g.x -= speed;
    if (
      player.x + 20 > g.x &&
      player.x < g.x + 120 &&
      player.y <= g.y
    ) {
      speed = BASE_SPEED * 1.1; // 乗ると微加速
    }
  }

  for (const p of pipes) {
    p.x -= speed;
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // BG
  if (IMG.bg.complete) {
    ctx.drawImage(
      IMG.bg,
      0,
      0,
      canvas.width,
      GROUND_Y
    );
  }

  // Ground
  ctx.fillStyle = "#2b2b2b";
  ctx.fillRect(0, GROUND_Y, canvas.width, canvas.height - GROUND_Y);

  // Player
  if (IMG.player.complete) {
    ctx.drawImage(
      IMG.player,
      player.x - 16,
      player.y - 32,
      32,
      32
    );
  }

  // Guards
  for (const g of guards) {
    if (IMG.guard.complete) {
      ctx.drawImage(IMG.guard, g.x, g.y, 120, 20);
    }
  }

  // Pipes
  for (const p of pipes) {
    if (IMG.pipe.complete) {
      ctx.drawImage(IMG.pipe, p.x, p.y - 30, 160, 30);
    }
  }
}

function loop() {
  if (loaded === need) {
    update();
    draw();
  }
  requestAnimationFrame(loop);
}
loop();
