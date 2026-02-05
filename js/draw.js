// js/draw.js  MOB STREET - 1P RUN  (RENDER / DRAW)
(() => {
  "use strict";

  const MOB = (window.MOB = window.MOB || {});
  const CONFIG = MOB.CONFIG;

  MOB.beginDraw = function beginDraw(ctx, canvas) {
    const cw = canvas.width;
    const ch = canvas.height;

    const sx = cw / CONFIG.LOGICAL_W;
    const sy = ch / CONFIG.LOGICAL_H;
    const s = Math.max(sx, sy);

    const drawW = CONFIG.LOGICAL_W * s;
    const drawH = CONFIG.LOGICAL_H * s;

    const ox = (cw - drawW) * 0.5;
    const oy = (ch - drawH); // bottom-align

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = "#163d7a";
    ctx.fillRect(0, 0, cw, ch);

    ctx.setTransform(s, 0, 0, s, ox, oy);
    ctx.imageSmoothingEnabled = false;
  };

  MOB.drawSky = function drawSky(ctx) {
    const g = ctx.createLinearGradient(0, 0, 0, CONFIG.LOGICAL_H);
    g.addColorStop(0, "#2a6ccf");
    g.addColorStop(0.6, "#163d7a");
    g.addColorStop(1, "#071727");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, CONFIG.LOGICAL_W, CONFIG.LOGICAL_H);
  };

  MOB.drawStage = function drawStage(ctx) {
    const img = MOB.IMAGES.stage;
    const world = MOB.world;
    if (!img) return;

    const h = world.groundH;
    const y = world.groundY;

    const s = h / img.height;
    const w = Math.floor(img.width * s);

    let x = -((MOB.state.cameraX % w + w) % w);
    for (; x < CONFIG.LOGICAL_W + w; x += w) {
      ctx.drawImage(img, x, y, w, h);
    }
  };

  MOB.drawObjects = function drawObjects(ctx) {
    const state = MOB.state;
    const world = MOB.world;

    // goal line
    const race = CONFIG.RACES[state.raceIndex] || CONFIG.RACES[0] || { goal: 600 };
    const goalX = race.goal * CONFIG.PX_PER_M;
    const gx = goalX - state.cameraX;
    if (gx > -40 && gx < CONFIG.LOGICAL_W + 40) {
      ctx.fillStyle = "rgba(255,255,255,0.92)";
      ctx.fillRect(gx - 2, 0, 4, world.groundY + world.groundH);

      const step = 12;
      for (let y = 0; y < world.groundY; y += step) {
        ctx.fillStyle = ((y / step) | 0) % 2 ? "rgba(0,0,0,0.75)" : "rgba(255,255,255,0.92)";
        ctx.fillRect(gx - 10, y, 8, step);
      }
      ctx.fillStyle = "rgba(255,255,255,0.92)";
      ctx.fillRect(gx - 10, 0, 20, 6);
    }

    // puddle
    ctx.fillStyle = "rgba(120,190,255,0.5)";
    for (const p of world.puddles) {
      const sx = p.x - state.cameraX;
      if (sx < -120 || sx > CONFIG.LOGICAL_W + 120) continue;
      ctx.fillRect(sx, p.y, p.w, p.h);
    }

    // rings (player taken -> hidden)
    const ringImg = MOB.IMAGES.ring;
    if (ringImg) {
      const pi = state.playerIndex;
      for (const r of world.rings) {
        if (r.takenBy.has(pi)) continue;
        const sx = r.x - state.cameraX;
        if (sx < -80 || sx > CONFIG.LOGICAL_W + 80) continue;
        ctx.drawImage(ringImg, sx - 10, r.y - 10, 20, 20);
      }
    }

    // dan
    if (MOB.IMAGES.dan) {
      for (const d of world.dans) {
        const sx = d.x - state.cameraX;
        if ((sx + d.w) < -260 || sx > CONFIG.LOGICAL_W + 260) continue;
        ctx.drawImage(d.img, sx, d.y, d.w, d.h);
      }
    }

    // track(or)
    if (MOB.IMAGES.or) {
      for (const o of world.ors) {
        const sx = o.x - state.cameraX;
        if ((sx + o.w) < -220 || sx > CONFIG.LOGICAL_W + 220) continue;
        ctx.drawImage(o.img, sx, o.y, o.w, o.h);
      }
    }

    // pipes
    for (const p of world.pipes) {
      const sx = p.x - state.cameraX;
      const m = 260;
      if ((sx + p.w) < -m || sx > CONFIG.LOGICAL_W + m) continue;
      ctx.drawImage(p.img, sx, p.y, p.w, p.h);
    }

    // rails
    if (MOB.IMAGES.rail) {
      for (const r of world.rails) {
        const sx = r.x - state.cameraX;
        const m = 240;
        if ((sx + r.w) < -m || sx > CONFIG.LOGICAL_W + m) continue;
        ctx.drawImage(MOB.IMAGES.rail, sx, r.y, r.w, r.h);
      }
    }
  };

  MOB.screenXOf = function screenXOf(r) {
    const state = MOB.state;
    if (r.isPlayer) return Math.floor(CONFIG.LOGICAL_W * 0.18);
    const p = state.runners[state.playerIndex];
    return Math.floor(CONFIG.LOGICAL_W * 0.18 + (r.x - p.x));
  };

  MOB.drawRunner = function drawRunner(ctx, r) {
    const world = MOB.world;
    const sx = MOB.screenXOf(r);
    if (sx < -120 || sx > CONFIG.LOGICAL_W + 120) return;

    // shadow
    ctx.fillStyle = "rgba(0,0,0,0.25)";
    ctx.beginPath();
    ctx.ellipse(sx + r.w / 2, world.groundY + 5, r.w * 0.35, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    // ghost alpha
    const a = r.isPlayer ? 1 : 0.55;
    ctx.save();
    ctx.globalAlpha = a;

    // board
    if (MOB.IMAGES.board) {
      ctx.drawImage(MOB.IMAGES.board, sx - r.w * 0.05, r.y + r.h * 0.65, r.w * 1.1, r.h * 0.45);
    }

    // body
    const body = (r.onGround || r.onPipe || r.onDan || r.onOr) ? MOB.IMAGES.pl1 : MOB.IMAGES.pl2;
    if (body) {
      ctx.drawImage(body, sx, r.y, r.w, r.h);
    }

    ctx.restore();

    // player label
    if (r.isPlayer) {
      ctx.font = "10px system-ui";
      ctx.textAlign = "center";
      ctx.lineWidth = 3;
      ctx.strokeStyle = "rgba(0,0,0,0.9)";
      ctx.fillStyle = "#fff";
      ctx.strokeText("プレイヤー", sx + r.w / 2, r.y - 6);
      ctx.fillText("プレイヤー", sx + r.w / 2, r.y - 6);
      ctx.textAlign = "left";
    }
  };

  MOB.drawCountdown = function drawCountdown(ctx) {
    ctx.fillStyle = "rgba(0,0,0,0.12)";
    ctx.fillRect(0, 0, CONFIG.LOGICAL_W, CONFIG.LOGICAL_H);
    ctx.fillStyle = "#fff";
    ctx.font = "bold 64px system-ui";
    ctx.textAlign = "center";
    ctx.fillText(String(Math.ceil(MOB.state.countdown)), CONFIG.LOGICAL_W / 2, CONFIG.LOGICAL_H / 2);
    ctx.textAlign = "left";
  };

  MOB.render = function render() {
    const ui = MOB.ui;
    const ctx = ui.ctx;
    const canvas = ui.canvas;

    MOB.beginDraw(ctx, canvas);
    MOB.drawSky(ctx);
    MOB.drawStage(ctx);
    MOB.drawObjects(ctx);

    // named ghosts -> player
    for (const r of MOB.state.runners) {
      if (!r.isPlayer && r.winRate > 0.30) MOB.drawRunner(ctx, r);
    }
    MOB.drawRunner(ctx, MOB.state.runners[MOB.state.playerIndex]);

    if (MOB.state.phase === "countdown") MOB.drawCountdown(ctx);
  };
})();
