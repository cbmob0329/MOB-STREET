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

  MOB.createRunner = function createRunner(name, isPlayer) {
    return {
      name,
      isPlayer,

      // CPU params (player uses defaults)
      tier: isPlayer ? "P" : "B",
      baseMul: 1.0,
      boostSkill: 0.0,
      gimmickSkill: 0.0,

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

      // AI internal timers/state
      aiCd: MOB.rand(0.20, 0.55),
      aiBoostCd: MOB.rand(0.0, CONFIG.AI_BOOST_COOLDOWN),

      prevY: 0,

      // context flags for smarter decisions
      justLandedKind: "",
      justLandedT: 0,
      justSlowedT: 0
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

    r.justLandedKind = "";
    r.justLandedT = 0;
    r.justSlowedT = 0;
  };

  MOB.safeRaceIndex = function safeRaceIndex(idx) {
    const n = Array.isArray(CONFIG.RACES) ? CONFIG.RACES.length : 0;
    if (n <= 0) return 0;
    if (!Number.isFinite(idx)) return 0;
    return MOB.clamp(Math.floor(idx), 0, n - 1);
  };

  // ===== CPU NAMES (確定) =====
  MOB.CPU_S = [
    "KAGE-0",
    "NEON-REX"
  ];
  MOB.CPU_A = [
    "RUSH-FOX",
    "PIPE-MASTER",
    "TRACK-LORD"
  ];
  MOB.CPU_B = [
    "ALLEY",
    "BRICK",
    "NOISE",
    "LAMP",
    "WAVE",
    "DUST",
    "SIGN",
    "CHAIN",
    "CURB",
    "SPARK",
    "FENCE",
    "RUST",
    "DRIFT",
    "GLASS",
    "SHADOW",
    "SMOKE",
    "TUNNEL",
    "ECHO",
    "PATCH",
    "STATIC"
  ];

  function rangeRand(a, b) { return a + Math.random() * (b - a); }

  MOB.makeCpuProfile = function makeCpuProfile(tier) {
    // 数値レンジ（確定案）
    if (tier === "S") {
      return {
        tier: "S",
        baseMul: rangeRand(1.03, 1.06),
        boostSkill: rangeRand(0.80, 0.95),
        gimmickSkill: rangeRand(0.75, 0.90),
      };
    }
    if (tier === "A") {
      return {
        tier: "A",
        baseMul: rangeRand(1.00, 1.03),
        boostSkill: rangeRand(0.55, 0.80),
        gimmickSkill: rangeRand(0.55, 0.75),
      };
    }
    return {
      tier: "B",
      baseMul: rangeRand(0.96, 1.00),
      boostSkill: rangeRand(0.15, 0.55),
      gimmickSkill: rangeRand(0.20, 0.55),
    };
  };

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

    const player = MOB.createRunner("YOU", true);
    // player fixed (no CPU params used)
    player.tier = "P";
    player.baseMul = 1.0;
    player.boostSkill = 1.0;
    player.gimmickSkill = 1.0;

    state.runners.push(player);
    state.playerIndex = 0;

    // build CPU pool by rank order
    const cpuPool = [];
    for (const n of MOB.CPU_S) cpuPool.push({ name: n, tier: "S" });
    for (const n of MOB.CPU_A) cpuPool.push({ name: n, tier: "A" });
    for (const n of MOB.CPU_B) cpuPool.push({ name: n, tier: "B" });

    const race = CONFIG.RACES[ri] || CONFIG.RACES[0] || { name: "EASY", goal: 600, start: 10, survive: 5 };
    const needCpu = Math.max(0, race.start - 1);

    for (let i = 0; i < needCpu; i++) {
      const spec = cpuPool[i] || { name: `CPU-${i + 1}`, tier: "B" };
      const r = MOB.createRunner(spec.name, false);
      const prof = MOB.makeCpuProfile(spec.tier);
      r.tier = prof.tier;
      r.baseMul = prof.baseMul;
      r.boostSkill = prof.boostSkill;
      r.gimmickSkill = prof.gimmickSkill;
      state.runners.push(r);
    }

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
