// js/state.js  MOB STREET - 1P RUN  (STATE / RUNNERS / RACE)
(() => {
  "use strict";

  const MOB = (window.MOB = window.MOB || {});
  const CONFIG = MOB.CONFIG;

  MOB.input = { jump: false, boost: false };

  MOB.state = {
    phase: "loading",
    raceIndex: 0,

    time: 0,
    lastTime: 0,

    stock: CONFIG.STOCK_START,
    stockTimer: 0,

    cameraX: 0,

    runners: [],
    playerIndex: 0,

    countdown: 3,
    finishedCount: 0,

    rank: 1,
    rankText: "",
    top8Text: ""
  };

  MOB.createRunner = function createRunner(name, isPlayer, winRate) {
    return {
      name, isPlayer, winRate,

      x: 0, y: 0, vy: 0,
      w: CONFIG.PLAYER_SIZE, h: CONFIG.PLAYER_SIZE,

      onGround: true,

      onPipe: false,
      pipeRef: null,

      onDan: false,
      danRef: null,

      onOr: false,
      orRef: null,

      jumps: 0,

      boostTimer: 0,
      boostPower: 0,

      slowTimer: 0,
      rings: 0,

      finished: false,
      finishTime: Infinity,

      aiCd: MOB.rand(0.20, 0.55),
      aiBoostCd: MOB.rand(0.0, CONFIG.AI_BOOST_COOLDOWN),

      prevY: 0
    };
  };

  MOB.resetRunner = function resetRunner(r) {
    r.x = 0; r.y = 0; r.vy = 0;
    r.onGround = true;

    r.onPipe = false; r.pipeRef = null;
    r.onDan  = false; r.danRef  = null;
    r.onOr   = false; r.orRef   = null;

    r.jumps = 0;
    r.boostTimer = 0; r.boostPower = 0;
    r.slowTimer = 0; r.rings = 0;

    r.finished = false;
    r.finishTime = Infinity;

    r.aiCd = MOB.rand(0.20, 0.55);
    r.aiBoostCd = MOB.rand(0.0, CONFIG.AI_BOOST_COOLDOWN);
    r.prevY = 0;
  };

  MOB.safeRaceIndex = function safeRaceIndex(idx) {
    const n = Array.isArray(CONFIG.RACES) ? CONFIG.RACES.length : 0;
    if (n <= 0) return 0;
    if (!Number.isFinite(idx)) return 0;
    return MOB.clamp(Math.floor(idx), 0, n - 1);
  };

  MOB.NAMED_GHOSTS = [
    { name: "フレンチ", wr: 0.60 },
    { name: "レッド", wr: 0.70 },
    { name: "レッドブルー", wr: 0.90 },
    { name: "ブラック", wr: 0.85 },
    { name: "ホワイト", wr: 0.75 }
  ];
  MOB.LETTERS = "ABCDEFGHIJKLMNOPQRST".split("");

  MOB.updateRank = function updateRank() {
    const state = MOB.state;
    const p = state.runners[state.playerIndex];
    let better = 0;
    for (const r of state.runners) {
      if (r !== p && r.x > p.x) better++;
    }
    state.rank = better + 1;
    state.rankText = `RANK ${state.rank}/${state.runners.length}`;
  };

  MOB.updateTop8 = function updateTop8() {
    const state = MOB.state;
    const list = [...state.runners].slice().sort((a, b) => b.x - a.x);
    let out = "";
    const max = Math.min(8, list.length);
    for (let i = 0; i < max; i++) {
      const r = list[i];
      const tag = r.isPlayer ? "（YOU）" : "";
      out += `${i + 1}. ${r.name}${tag}\n`;
    }
    state.top8Text = out.trim();
    if (MOB.ui && MOB.ui.top8Panel) MOB.ui.top8Panel.textContent = state.top8Text;
  };

  MOB.initRace = function initRace(idx) {
    const state = MOB.state;

    const ri = MOB.safeRaceIndex(idx);
    state.raceIndex = ri;

    state.runners.length = 0;
    state.finishedCount = 0;

    const player = MOB.createRunner("YOU", true, 1.0);
    state.runners.push(player);
    state.playerIndex = 0;

    for (const g of MOB.NAMED_GHOSTS) state.runners.push(MOB.createRunner(g.name, false, g.wr));
    for (const l of MOB.LETTERS) state.runners.push(MOB.createRunner(l, false, 0.30));

    const race = CONFIG.RACES[ri] || CONFIG.RACES[0] || { name: "EASY", goal: 600, start: 10, survive: 5 };
    state.runners = state.runners.slice(0, race.start);

    for (const r of state.runners) MOB.resetRunner(r);

    state.stock = CONFIG.STOCK_START;
    state.stockTimer = 0;

    state.countdown = 3;
    state.phase = "brief";

    if (MOB.ui) {
      MOB.ui.hideResult();
      MOB.ui.showBrief();
      MOB.ui.updateStockBar();
    }

    // world reset
    MOB.resetWorldForRace();
    MOB.resetGround();
    MOB.spawnWorld(0);

    for (const r of state.runners) {
      r.x = 0;
      r.y = MOB.world.groundY - r.h;
      r.vy = 0;
      r.onGround = true;
    }

    state.time = 0;
    MOB.updateRank();
    MOB.updateTop8();
    if (MOB.ui) MOB.ui.updateStockBar();
  };
})();
