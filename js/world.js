// js/world.js  MOB STREET - 1P RUN  (WORLD / SPAWN / CLEANUP)
(() => {
  "use strict";

  const MOB = (window.MOB = window.MOB || {});
  const CONFIG = MOB.CONFIG;

  MOB.world = {
    groundY: 0,
    groundH: 0,

    rails: [],
    pipes: [],
    puddles: [],
    rings: [],
    ors: [],
    dans: [],

    nextRailX: 280,
    nextPipeX: 980,
    nextPuddleX: 560,
    nextRingX: 220,
    nextOrX: 980,
    nextDanX: 860
  };

  MOB.resetWorldForRace = function resetWorldForRace() {
    const w = MOB.world;
    w.rails.length = 0;
    w.pipes.length = 0;
    w.puddles.length = 0;
    w.rings.length = 0;
    w.ors.length = 0;
    w.dans.length = 0;

    w.nextRailX = 280;
    w.nextPipeX = 980;
    w.nextPuddleX = 560;
    w.nextRingX = 220;
    w.nextOrX = 980;
    w.nextDanX = 860;
  };

  MOB.resetGround = function resetGround() {
    const w = MOB.world;
    w.groundH = 72;
    const lift = 56;
    w.groundY = (CONFIG.LOGICAL_H - w.groundH) - lift;
    w.groundY = Math.max(240, w.groundY);
  };

  function isTooClose(x) {
    const min = CONFIG.SPAWN.NO_OVERLAP_X;
    const w = MOB.world;
    const check = (arr) => arr.some(o => Math.abs(o.x - x) < min);
    return check(w.rails) || check(w.pipes) || check(w.puddles) || check(w.ors) || check(w.dans);
  }

  MOB.spawnWorld = function spawnWorld(camX) {
    const w = MOB.world;
    const edge = camX + CONFIG.LOGICAL_W;

    if (edge > w.nextRailX) {
      const x = w.nextRailX;
      if (!isTooClose(x)) MOB.addRail(x);
      w.nextRailX += MOB.rand(CONFIG.SPAWN.RAIL_MIN, CONFIG.SPAWN.RAIL_MAX);
    }
    if (edge > w.nextPipeX) {
      const x = w.nextPipeX;
      if (!isTooClose(x)) MOB.addPipe(x);
      w.nextPipeX += MOB.rand(CONFIG.SPAWN.PIPE_MIN, CONFIG.SPAWN.PIPE_MAX);
    }
    if (edge > w.nextPuddleX) {
      const x = w.nextPuddleX;
      if (!isTooClose(x)) MOB.addPuddle(x);
      w.nextPuddleX += MOB.rand(CONFIG.SPAWN.PUDDLE_MIN, CONFIG.SPAWN.PUDDLE_MAX);
    }
    if (edge > w.nextOrX) {
      const x = w.nextOrX;
      if (!isTooClose(x)) MOB.addOr(x);
      w.nextOrX += MOB.rand(CONFIG.SPAWN.OR_MIN, CONFIG.SPAWN.OR_MAX);
    }
    if (edge > w.nextDanX) {
      const x = w.nextDanX;
      if (!isTooClose(x)) MOB.addDan(x);
      w.nextDanX += MOB.rand(CONFIG.SPAWN.DAN_MIN, CONFIG.SPAWN.DAN_MAX);
    }
    if (edge > w.nextRingX) {
      MOB.addRing(w.nextRingX);
      w.nextRingX += MOB.rand(CONFIG.SPAWN.RING_MIN, CONFIG.SPAWN.RING_MAX);
    }
  };

  // ===== OBJECT ADD =====
  MOB.addRail = function addRail(x) {
    const img = MOB.IMAGES.rail;
    const w = MOB.world;
    if (!img) return;

    const h = Math.floor(w.groundH * 0.58);
    const scale = h / img.height;
    const ww = Math.floor(img.width * scale * 2.20);

    w.rails.push({ x, y: w.groundY - h, w: ww, h });
  };

  MOB.addPipe = function addPipe(x) {
    const w = MOB.world;
    const img = Math.random() < 0.5 ? MOB.IMAGES.hpr : MOB.IMAGES.hpg;
    if (!img) return;

    const h = Math.floor(w.groundH * 0.80);
    const scale = h / img.height;
    const ww = Math.floor(img.width * scale * 1.65);

    const topY = w.groundY - h;
    w.pipes.push({ x, y: topY, w: ww, h, img });
  };

  MOB.addPuddle = function addPuddle(x) {
    const w = MOB.world;
    w.puddles.push({
      x,
      y: w.groundY - 8,
      w: MOB.rand(34, 54),
      h: 6
    });
  };

  MOB.addRing = function addRing(x) {
    const w = MOB.world;
    const air = Math.random() < 0.55;
    const y = air ? w.groundY - MOB.rand(78, 150) : w.groundY - 28;

    w.rings.push({
      x, y,
      r: 8,
      takenBy: new Set()
    });
  };

  MOB.addOr = function addOr(x) {
    const w = MOB.world;
    const img = MOB.IMAGES.or;
    if (!img) return;

    const h = Math.floor(w.groundH * 0.78);
    const scale = h / img.height;
    const ww = Math.floor(img.width * scale * 1.55);

    const topY = w.groundY - h;
    w.ors.push({ x, y: topY, w: ww, h, img });
  };

  MOB.addDan = function addDan(x) {
    const w = MOB.world;
    const img = MOB.IMAGES.dan;
    if (!img) return;

    const h = Math.floor(w.groundH * 0.78);
    const scale = h / img.height;
    const ww = Math.floor(img.width * scale * 1.22);

    const slopeW = ww * 0.22;
    const topY = w.groundY - h;

    w.dans.push({ x, y: topY, w: ww, h, img, slopeW });
  };

  // ===== CLEANUP (offscreen only + not referenced) =====
  function anyRunnerRef(obj) {
    const state = MOB.state;
    for (const r of state.runners) {
      if (r.pipeRef === obj) return true;
      if (r.danRef === obj) return true;
      if (r.orRef === obj) return true;
    }
    return false;
  }

  function cleanupArray(arr) {
    const state = MOB.state;
    const leftLimit = state.cameraX - CONFIG.CLEANUP_MARGIN;
    return arr.filter(o => {
      const offLeft = (o.x + o.w) < leftLimit;
      if (!offLeft) return true;
      return anyRunnerRef(o);
    });
  }

  MOB.cleanupWorld = function cleanupWorld() {
    const w = MOB.world;
    const state = MOB.state;
    const leftLimit = state.cameraX - CONFIG.CLEANUP_MARGIN;

    // rails are never referenced
    w.rails = w.rails.filter(o => (o.x + o.w) >= leftLimit);

    // referenced platforms
    w.pipes = cleanupArray(w.pipes);
    w.dans = cleanupArray(w.dans);
    w.ors = cleanupArray(w.ors);

    // simple objects
    w.puddles = w.puddles.filter(p => (p.x + p.w) >= leftLimit);
    w.rings = w.rings.filter(r => (r.x + 40) >= leftLimit);
  };
})();
