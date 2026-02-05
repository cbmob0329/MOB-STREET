// js/loop.js  MOB STREET - 1P RUN  (INPUT / LOOP)  FIX: stuck-at-0m
(() => {
  "use strict";

  const MOB = (window.MOB = window.MOB || {});
  const CONFIG = MOB.CONFIG;

  MOB.input = MOB.input || { jump:false, boost:false, jumpBoost:false };

  const btnJump = document.getElementById("btnJump");
  const btnBoost = document.getElementById("btnBoost");
  const btnJB   = document.getElementById("btnJumpBoost");

  // アイテムボタン → ジャンプブースト（有効化）
  if (btnJB) {
    btnJB.disabled = false;
    btnJB.style.pointerEvents = "auto";
    btnJB.style.opacity = "1";
    btnJB.textContent = "JUMP BOOST";
  }

  const onTouch = (fn) => (e) => { e.preventDefault(); fn(); };

  btnJump?.addEventListener("touchstart", onTouch(() => (MOB.input.jump = true)), { passive:false });
  btnBoost?.addEventListener("touchstart", onTouch(() => (MOB.input.boost = true)), { passive:false });
  btnJB?.addEventListener("touchstart",   onTouch(() => (MOB.input.jumpBoost = true)), { passive:false });

  // PC用
  window.addEventListener("keydown", (e) => {
    if (e.key === " ") MOB.input.jump = true;
    if (e.key === "b") MOB.input.boost = true;
    if (e.key === "n") MOB.input.jumpBoost = true;
  });

  // 「Loading...」表示を消す（存在する要素だけ）
  function clearLoadingText() {
    const el =
      document.getElementById("statusText") ||
      document.getElementById("loadingText") ||
      document.querySelector(".loadingText") ||
      null;
    if (el) el.textContent = "";
  }

  // CPUプロファイルを必ず作る（引数なし起動でもOK）
  function buildCpuProfiles(n) {
    const rr = (a, b) => a + Math.random() * (b - a);
    const clamp01 = (v) => Math.max(0, Math.min(1, v));
    const arr = [];
    for (let i = 0; i < n; i++) {
      let tier = "B";
      if (i < 2) tier = "S";
      else if (i < 6) tier = "A";

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
        name: `CPU-${i + 1}`,
        tier,
        baseMul,
        boostSkill: clamp01(boostSkill),
        gimmickSkill: clamp01(gimmickSkill)
      });
    }
    return arr;
  }

  let last = performance.now();

  function loop(now) {
    const dt = Math.min(0.033, (now - last) / 1000);
    last = now;

    // ★ここが修正点：phaseに関係なく「run更新」を回す
    // （result等の停止条件があるなら、その時だけ止める）
    if (MOB.state && MOB.state.phase !== "result") {
      MOB.updateRun?.(dt);
    }

    MOB.render?.();

    // UI更新（存在する場合だけ）
    try {
      MOB.ui?.updateTop8?.();
      MOB.ui?.updateRank?.();
      MOB.ui?.updateStockBars?.();
    } catch (_) {}

    requestAnimationFrame(loop);
  }

  MOB.boot = async function boot(cpuProfiles) {
    try {
      clearLoadingText();

      await MOB.loadAssets?.();

      const race = CONFIG.RACES?.[MOB.state?.raceIndex ?? 0] || CONFIG.RACES?.[0];
      const need = Math.max(0, (race?.start || 10) - 1);
      const profiles = Array.isArray(cpuProfiles) ? cpuProfiles : buildCpuProfiles(need);

      MOB.initRace?.(profiles);

      // ★強制で走行状態に（0m固定を潰す）
      if (MOB.state) MOB.state.phase = "run";

      // 初期UI
      try {
        MOB.ui?.updateTop8?.();
        MOB.ui?.updateRank?.();
        MOB.ui?.updateStockBars?.();
      } catch (_) {}

      last = performance.now();
      requestAnimationFrame(loop);
    } catch (e) {
      console.error(e);
      const title = document.getElementById("overlayTitle");
      const msg   = document.getElementById("overlayMsg");
      if (title) title.textContent = "Error";
      if (msg) msg.textContent = String(e);
    }
  };
})();
