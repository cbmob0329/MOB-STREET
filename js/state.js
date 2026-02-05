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

      x: 0, y: 0,
      w: size, h: size,
      prevY: 0,

      vy: 0,

      onGround: false,

      onPipe: false, pipeRef: null,
      onDan: false,  danRef: null,
      onOr: false,   orRef: null,

      jumps: 0,

      boostPower: 0,
      boostTimer: 0,

      jbPower: 0,
      jbTimer: 0,

      stockBoost: CONFIG.BOOST_START,
      stockBoostT: 0,

      stockJB: CONFIG.JUMPBOOST_START,
      stockJBT: 0,

      rings: 0,

      baseMul: profile?.baseMul ?? 1.0,
      boostSkill: profile?.boostSkill ?? 0,
      gimmickSkill: profile?.gimmickSkill ?? 0,

      aiCd: MOB.rand ? MOB.rand(0.20, 0.55) : 0.35,
      aiBoostCd: MOB.rand ? MOB.rand(0.0, CONFIG.AI_BOOST_COOLDOWN) : 0,

      justLandedKind: "",
      justLandedT: 0,

      finished: false,
      finishTime: Infinity
    };
    return r;
  }

  MOB.initRace = function initRace(cpuProfiles) {
    const race = CONFIG.RACES[MOB.state.raceIndex] || CONFIG.RACES[0];
    const startCount = race?.start || 10;

    MOB.state.time = 0;
    MOB.state.phase = "countdown";
    MOB.state.countdown = 3;
    MOB.state.cameraX = 0;
    MOB.state.runners.length = 0;
    MOB.state.finishedCount = 0;

    // world reset（存在する関数だけ呼ぶ）
    MOB.resetGround?.();
    MOB.resetWorldForRace?.();

    // player
    const player = makeRunner(true, { name: "YOU", baseMul: 1.0, boostSkill: 1.0, gimmickSkill: 1.0 });
    player.x = 0;
    player.y = (MOB.world?.groundY ?? 520) - player.h;
    player.onGround = true;

    MOB.state.playerIndex = 0;
    MOB.state.runners.push(player);

    const arr = Array.isArray(cpuProfiles) ? cpuProfiles : [];
    const needCpu = Math.max(0, startCount - 1);

    for (let i = 0; i < needCpu; i++) {
      const prof = arr[i] || {
        name: `CPU-${i + 1}`,
        baseMul: 1.0,
        boostSkill: 0.4,
        gimmickSkill: 0.4
      };
      const cpu = makeRunner(false, prof);
      cpu.x = 0;
      cpu.y = (MOB.world?.groundY ?? 520) - cpu.h;
      cpu.onGround = true;
      MOB.state.runners.push(cpu);
    }
  };

  // （既に別ファイルにあるなら、ここは呼ばれるだけでOK）
})();
