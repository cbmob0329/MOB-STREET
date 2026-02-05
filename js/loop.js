// js/loop.js  MOB STREET - 1P RUN  (INPUT / LOOP)
(() => {
  "use strict";

  const MOB = (window.MOB = window.MOB || {});
  const CONFIG = MOB.CONFIG;
  const ui = MOB.ui;

  MOB.input = {
    jump: false,
    boost: false,
    jumpBoost: false
  };

  const btnJump = document.getElementById("btnJump");
  const btnBoost = document.getElementById("btnBoost");
  const btnJB = document.getElementById("btnJumpBoost");

  // 表示名を変更＆無効化されてても復帰
  if (btnJB) {
    btnJB.disabled = false;
    btnJB.style.pointerEvents = "auto";
    btnJB.style.opacity = "1";
    btnJB.textContent = "JUMP BOOST";
  }

  btnJump?.addEventListener("touchstart", (e) => {
    e.preventDefault();
    MOB.input.jump = true;
  }, { passive:false });

  btnBoost?.addEventListener("touchstart", (e) => {
    e.preventDefault();
    MOB.input.boost = true;
  }, { passive:false });

  btnJB?.addEventListener("touchstart", (e) => {
    e.preventDefault();
    MOB.input.jumpBoost = true;
  }, { passive:false });

  // PC用（任意）
  window.addEventListener("keydown", (e) => {
    if (e.key === " ") MOB.input.jump = true;
    if (e.key === "b") MOB.input.boost = true;
    if (e.key === "n") MOB.input.jumpBoost = true;
  });

  let last = performance.now();

  function loop(now) {
    const dt = Math.min(0.033, (now - last) / 1000);
    last = now;

    if (MOB.state.phase === "countdown") {
      MOB.state.countdown -= dt;
      if (MOB.state.countdown <= 0) {
        MOB.state.phase = "run";
      }
    } else if (MOB.state.phase === "run") {
      MOB.updateRun(dt);
    }

    MOB.render();

    // UI更新（存在する場合だけ）
    try {
      MOB.updateRank?.();
      MOB.ui?.updateTop8?.();
      MOB.ui?.updateRank?.();
      MOB.ui?.updateStockBars?.();
    } catch (_) {}

    requestAnimationFrame(loop);
  }

  // CPUプロファイルを必ず作る（引数なし起動でもOKにする）
  function buildCpuProfiles(n) {
    const arr = [];
    // もし既存の関数があるならそれを使う
    if (typeof MOB.makeCpuProfiles === "function") return MOB.makeCpuProfiles(n);

    const clamp01 = (v) => Math.max(0, Math.min(1, v));
    const rr = (a, b) => a + Math.random() * (b - a);

    // 簡易ティア分け（S/A/B）。名前は最低限のフォールバック。
    const names = [];
    for (let i = 0; i < n; i++) names.push(`CPU-${i + 1}`);

    for (let i = 0; i < n; i++) {
      const tierRoll = i;
      let tier = "B";
      if (tierRoll < 2) tier = "S";
      else if (tierRoll < 6) tier = "A";

      let baseMul = 1.0, boostSkill = 0.4, gimmickSkill = 0.4;
      if (tier === "S") {
        baseMul = rr(1.03, 1.06);
        boostSkill = rr(0.80, 0.95);
        gimmickSkill = rr(0.75, 0.90);
      } else if (tier === "A") {
        baseMul = rr(1.00, 1.03);
        boostSkill = rr(0.55, 0.80);
        gimmickSkill = rr(0.55, 0.75);
      } else {
        baseMul = rr(0.96, 1.00);
        boostSkill = rr(0.15, 0.55);
        gimmickSkill = rr(0.20, 0.55);
      }

      arr.push({
        name: names[i],
        tier,
        baseMul,
        boostSkill: clamp01(boostSkill),
        gimmickSkill: clamp01(gimmickSkill)
      });
    }
    return arr;
  }

  MOB.boot = async function boot(cpuProfiles) {
    // cpuProfiles が無くても動く
    try {
      await MOB.loadAssets?.();

      const race = CONFIG.RACES[MOB.state.raceIndex] || CONFIG.RACES[0];
      const need = Math.max(0, (race?.start || 10) - 1);

      const profiles = Array.isArray(cpuProfiles) ? cpuProfiles : buildCpuProfiles(need);

      MOB.initRace(profiles);

      // ここでUI初期表示も更新
      try {
        MOB.ui?.updateTop8?.();
        MOB.ui?.updateRank?.();
        MOB.ui?.updateStockBars?.();
      } catch (_) {}

      last = performance.now();
      requestAnimationFrame(loop);
    } catch (e) {
      console.error(e);
      // overlayがあるなら出す（存在する場合だけ）
      const title = document.getElementById("overlayTitle");
      const msg = document.getElementById("overlayMsg");
      if (title) title.textContent = "Error";
      if (msg) msg.textContent = String(e);
    }
  };
})();
