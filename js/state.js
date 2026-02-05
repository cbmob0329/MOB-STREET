// js/state.js  MOB STREET - 1P RUN  (STATE / RUNNERS)
(() => {
  "use strict";

  const MOB = (window.MOB = window.MOB || {});
  const CONFIG = MOB.CONFIG;

  MOB.state = {
    raceIndex: 0,
    time: 0,
    phase: "idle",
    cameraX: 0,
    runners: [],
    playerIndex: 0,
    finishedCount: 0,
    countdown: 3
  };

  function makeRunner(isPlayer, profile) {
    const size = CONFIG.PLAYER_SIZE;
    const r = {
      isPlayer,
      name: profile?.name || (isPlayer ? "YOU" : "CPU"),
      // pos
      x: 0,
      y: 0,
      w: size,
      h: size,
      prevY: 0,
      // vel
      vy: 0,
      // flags
      onGround: false,
      onPipe: false, pipeRef: null,
      onDan: false,  danRef: null,
      onOr: false,   orRef: null,
      jumps: 0,
      // boosts
      boostPower: 0,
      boostTimer: 0,
      jbPower: 0,
      jbTimer: 0,
      // stocks (separate)
      stockBoost: CONFIG.BOOST_START,
      stockBoostT: 0,
      stockJB: CONFIG.JUMPBOOST_START,
      stockJBT: 0,
      // rings
      rings: 0,
      // AI
      baseMul: profile?.baseMul ?? 1.0,
      boostSkill: profile?.boostSkill ?? 0,
      gimmickSkill: profile?.gimmickSkill ?? 0,
      aiCd: 0,
      aiBoostCd: 0,
      // land info
      justLandedKind: "",
      justLandedT: 0,
      // finish
      finished: false,
      finishTime: 0
    };
    return r;
  }

  MOB.initRace = function initRace(cpuProfiles) {
    const race = CONFIG.RACES[MOB.state.raceIndex];
    MOB.state.time = 0;
    MOB.state.phase = "countdown";
    MOB.state.countdown = 3;
    MOB.state.cameraX = 0;
    MOB.state.runners.length = 0;
    MOB.state.finishedCount = 0;

    // world reset
    MOB.resetGround();
    MOB.resetWorldForRace();

    // player
    const player = makeRunner(true, { name: "YOU", baseMul: 1.0 });
    player.x = 0;
    player.y = MOB.world.groundY - player.h;
    player.onGround = true;
    player.stockBoost = CONFIG.BOOST_START;
    player.stockJB = CONFIG.JUMPBOOST_START;

    MOB.state.playerIndex = 0;
    MOB.state.runners.push(player);

    // CPUs
    for (let i = 0; i < race.start - 1; i++) {
      const prof = cpuProfiles[i];
      const cpu = makeRunner(false, prof);
      cpu.x = 0;
      cpu.y = MOB.world.groundY - cpu.h;
      cpu.onGround = true;
      cpu.stockBoost = CONFIG.BOOST_START;
      cpu.stockJB = CONFIG.JUMPBOOST_START;
      MOB.state.runners.push(cpu);
    }
  };

  MOB.updateRank = function updateRank() {
    const rs = MOB.state.runners;
    rs.sort((a, b) => {
      if (a.finished && b.finished) return a.finishTime - b.finishTime;
      if (a.finished) return -1;
      if (b.finished) return 1;
      return b.x - a.x;
    });
  };

})();
