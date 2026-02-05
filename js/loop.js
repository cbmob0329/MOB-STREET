// js/loop.js  MOB STREET - 1P RUN  (INPUT / LOOP)
(() => {
  "use strict";

  const MOB = (window.MOB = window.MOB || {});
  const ui = MOB.ui;

  MOB.input = {
    jump: false,
    boost: false,
    jumpBoost: false
  };

  const btnJump = document.getElementById("btnJump");
  const btnBoost = document.getElementById("btnBoost");
  const btnJB = document.getElementById("btnJumpBoost");

  // 表示名を変更
  if (btnJB) {
    btnJB.disabled = false;
    btnJB.textContent = "JUMP BOOST";
  }

  btnJump?.addEventListener("touchstart", e => {
    e.preventDefault();
    MOB.input.jump = true;
  }, { passive:false });

  btnBoost?.addEventListener("touchstart", e => {
    e.preventDefault();
    MOB.input.boost = true;
  }, { passive:false });

  btnJB?.addEventListener("touchstart", e => {
    e.preventDefault();
    MOB.input.jumpBoost = true;
  }, { passive:false });

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
    requestAnimationFrame(loop);
  }

  MOB.boot = async function boot(cpuProfiles) {
    await MOB.loadAssets();
    MOB.initRace(cpuProfiles);
    requestAnimationFrame(loop);
  };
})();
