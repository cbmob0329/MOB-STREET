// js/config.js  MOB STREET - 1P RUN  (CONFIG / ASSETS / UTILS)
(() => {
  "use strict";

  const MOB = (window.MOB = window.MOB || {});

  MOB.VERSION = "v6.7-brief-goal-ghost";

  MOB.CONFIG = {
    LOGICAL_W: 360,
    LOGICAL_H: 640,

    PX_PER_M: 10,
    PLAYER_SIZE: 48,

    GRAVITY: 2200,
    MAX_FALL_V: 1800,

    JUMP_V1: 860,
    JUMP_V2: 780,

    BASE_SPEED: 260,

    BOOST_ADD: 210,
    BOOST_TIME: 0.85,

    // ring 10 => small accel
    RING_NEED: 10,
    RING_BOOST_ADD: 110,
    RING_BOOST_TIME: 0.55,

    // player stock
    STOCK_MAX: 5,
    STOCK_REGEN: 5.0,
    STOCK_START: 0,

    // AI boost
    AI_BOOST_COOLDOWN: 5.0,

    // Platform landing snap settings (吸い付き防止用)
    LAND_EPS: 2,         // "上から着地" 判定の許容
    LAND_SNAP: 10,       // 上面に近い時だけ吸着（ワープ感抑制）
    MIN_STAY_MARGIN: 6,  // platform滞在判定の余裕

    // Spawn tuning（控えめ）
    SPAWN: {
      RAIL_MIN: 440,
      RAIL_MAX: 780,

      PIPE_MIN: 980,
      PIPE_MAX: 1500,

      PUDDLE_MIN: 560,
      PUDDLE_MAX: 880,

      RING_MIN: 170,
      RING_MAX: 260,

      OR_MIN: 980,      // track
      OR_MAX: 1600,

      DAN_MIN: 860,
      DAN_MAX: 1400,

      NO_OVERLAP_X: 280
    },

    // Halfpipe profile: left -> bottom -> right
    PIPE_PROFILE: {
      LEFT: 0.28,
      FLAT: 0.18,
      // RIGHT = 1 - (LEFT+FLAT)
      DEPTH_RATIO: 0.92,
      BASE_ON_PIPE_ADD: 110, // constant accel while on pipe
      SLOPE_ADD: 240         // additional accel on slopes
    },

    // Track accel
    TRACK_ACCEL_ADD: 190,

    // dan accel
    DAN_ACCEL_ADD: 95,

    // Cleanup margins (visual safety)
    CLEANUP_MARGIN: 140,

    RACES: [
      { name: "EASY",   goal:  600, start: 26, survive: 16 },
      { name: "NORMAL", goal: 1000, start: 16, survive:  6 },
      { name: "HARD",   goal: 1200, start:  8, survive:  1 }
    ]
  };

  MOB.clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  MOB.rand  = (a, b) => a + Math.random() * (b - a);

  MOB.ASSETS = {
    pl1: "PL1.png",
    pl2: "PL2.png",
    board: "redsk.png",
    stage: "st.png",
    rail: "gardw.png",
    hpr: "hpr.png",
    hpg: "hpg.png",
    ring: "ringtap.png",
    or: "or.png",   // TRACK
    dan: "dan.png"
  };

  MOB.IMAGES = {};

  MOB.loadImage = function loadImage(src) {
    return new Promise((res, rej) => {
      const img = new Image();
      img.onload = () => res(img);
      img.onerror = () => rej(new Error("Failed to load: " + src));
      img.src = src;
    });
  };

  MOB.loadAssets = async function loadAssets(onProgress) {
    const ASSETS = MOB.ASSETS;
    const IMAGES = MOB.IMAGES;
    for (const k in ASSETS) {
      if (typeof onProgress === "function") onProgress(ASSETS[k]);
      IMAGES[k] = await MOB.loadImage(ASSETS[k]);
    }
  };
})();
