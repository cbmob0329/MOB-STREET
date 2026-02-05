// js/physics.js  MOB STREET - 1P RUN  (PHYSICS / UPDATE RUN)
(() => {
  "use strict";

  const MOB = (window.MOB = window.MOB || {});
  const CONFIG = MOB.CONFIG;

  MOB.rectHit = function rectHit(ax, ay, aw, ah, bx, by, bw, bh) {
    return ax < bx + bw && ax + aw > bx &&
           ay < by + bh && ay + ah > by;
  };

  MOB.clearPlatforms = function clearPlatforms(r) {
    r.onPipe = false; r.pipeRef = null;
    r.onDan  = false; r.danRef  = null;
    r.onOr   = false; r.orRef   = null;
  };

  MOB.doJump = function doJump(r) {
    // ジャンプ開始＝platformから離れる（吸い付き防止の肝）
    MOB.clearPlatforms(r);

    if (r.onGround) {
      r.vy = -CONFIG.JUMP_V1;
      r.onGround = false;
      r.jumps = 1;
    } else if (r.jumps === 1) {
      r.vy = -CONFIG.JUMP_V2;
      r.jumps = 2;
    }
  };

  MOB.startBoost = function startBoost(r, power, time) {
    r.boostPower = power;
    r.boostTimer = time;
  };

  // ★ジャンプブースト：低空ジャンプ＋加速（通常ブーストと別枠）
  MOB.startJumpBoost = function startJumpBoost(r) {
    // 仕様：地上発動のみ（低空ジャンプの爽快感を安定させる）
    if (!r.onGround) return;

    MOB.clearPlatforms(r);

    r.vy = -CONFIG.JUMPBOOST_V;
    r.onGround = false;

    // 仕様：特技ジャンプ後は2段ジャンプ不可（強すぎ抑制）
    // ※後で「可」にしたいならここを外す
    r.jumps = 2;

    r.jbPower = CONFIG.JUMPBOOST_ADD;
    r.jbTimer = CONFIG.JUMPBOOST_TIME;
  };

  MOB.danTopY = function danTopY(dan, xCenter) {
    const w = MOB.world;
    const t = MOB.clamp((xCenter - dan.x) / dan.w, 0, 1);
    const sw = (dan.slopeW / dan.w);

    if (t < sw) {
      const tt = t / sw;
      return (w.groundY - (dan.h * tt));
    } else if (t > (1 - sw)) {
      const tt = (t - (1 - sw)) / sw;
      return (w.groundY - (dan.h * (1 - tt)));
    }
    return dan.y;
  };

  MOB.pipeTopY = function pipeTopY(pipe, xCenter) {
    const t = MOB.clamp((xCenter - pipe.x) / pipe.w, 0, 1);

    const L = CONFIG.PIPE_PROFILE.LEFT;
    const F = CONFIG.PIPE_PROFILE.FLAT;
    const R = 1 - (L + F);

    const depth = pipe.h * CONFIG.PIPE_PROFILE.DEPTH_RATIO;
    const topY = pipe.y;
    const bottomY = pipe.y + depth;

    let y;
    let slopeAbs01 = 0;

    if (t < L) {
      const tt = t / L;
      y = topY + (bottomY - topY) * tt;
      slopeAbs01 = 1;
    } else if (t < L + F) {
      y = bottomY;
      slopeAbs01 = 0;
    } else {
      const tt = (t - (L + F)) / R;
      y = bottomY + (topY - bottomY) * tt;
      slopeAbs01 = 1;
    }

    y = MOB.clamp(y, topY, bottomY);
    return { yTop: y, slopeAbs01 };
  };

  // 上から着地のみ（吸い付き対策）
  MOB.tryLandOnPlatform = function tryLandOnPlatform(r, idx, plat, topY, kind) {
    if (r.vy < 0) return false; // ジャンプ上昇中は絶対乗らない

    const prevBottom = r.prevY + r.h;
    const curBottom  = r.y + r.h;

    if (prevBottom > topY + CONFIG.LAND_EPS) return false;

    const near = Math.abs(curBottom - topY) <= CONFIG.LAND_SNAP;
    const crossed = curBottom >= (topY - CONFIG.LAND_EPS);
    if (!(near || crossed)) return false;

    r.y = topY - r.h;
    r.vy = 0;
    r.onGround = true;
    r.jumps = 0;

    r.justLandedKind = kind;
    r.justLandedT = 0.22;

    if (kind === "rail") {
      r.boostPower = Math.max(r.boostPower, 60);
      r.boostTimer = Math.max(r.boostTimer, 0.15);
    } else if (kind === "or") {
      r.onOr = true; r.orRef = plat;
    } else if (kind === "dan") {
      r.onDan = true; r.danRef = plat;
    } else if (kind === "pipe") {
      r.onPipe = true; r.pipeRef = plat;
    }
    return true;
  };

  // ===== CPU: 次のplatformを見てジャンプする（既存） =====
  function pickNextPlatform(world, x, maxAhead) {
    let best = null;
    let bestDx = Infinity;

    const consider = (kind, arr) => {
      for (const o of arr) {
        const dx = o.x - x;
        if (dx <= 0 || dx > maxAhead) continue;
        if (dx < bestDx) {
          bestDx = dx;
          best = { kind, obj: o, dx };
        }
      }
    };

    consider("rail", world.rails);
    consider("or", world.ors);
    consider("dan", world.dans);
    consider("pipe", world.pipes);

    return best;
  }

  function platformTopAt(r, kind, obj) {
    const cx = r.x + r.w * 0.5;
    if (kind === "rail") return obj.y;
    if (kind === "or")   return obj.y;
    if (kind === "dan")  return MOB.danTopY(obj, cx);
    if (kind === "pipe") return MOB.pipeTopY(obj, cx).yTop;
    return obj.y;
  }

  // ===== ストック回復（通常ブースト / ジャンプブースト別）=====
  function regenStocks(r, dt) {
    // normal boost
    if (r.stockBoost < CONFIG.STOCK_MAX) {
      r.stockBoostT += dt;
      if (r.stockBoostT >= CONFIG.BOOST_REGEN) {
        r.stockBoostT = 0;
        r.stockBoost = Math.min(CONFIG.STOCK_MAX, r.stockBoost + 1);
      }
    } else {
      r.stockBoostT = 0;
    }

    // jump boost (2秒遅い)
    if (r.stockJB < CONFIG.STOCK_MAX) {
      r.stockJBT += dt;
      if (r.stockJBT >= CONFIG.JUMPBOOST_REGEN) {
        r.stockJBT = 0;
        r.stockJB = Math.min(CONFIG.STOCK_MAX, r.stockJB + 1);
      }
    } else {
      r.stockJBT = 0;
    }
  }

  MOB.updateRun = function updateRun(dt) {
    const state = MOB.state;
    const world = MOB.world;
    const race = CONFIG.RACES[state.raceIndex] || CONFIG.RACES[0] || { name: "EASY", goal: 600, start: 10, survive: 5 };
    const player = state.runners[state.playerIndex];

    // camera
    state.cameraX = Math.max(0, player.x - Math.floor(CONFIG.LOGICAL_W * 0.18));
    MOB.spawnWorld(state.cameraX);
    MOB.cleanupWorld();

    // leader for rubber band (CPU only)
    let leaderX = 0;
    for (const rr of state.runners) leaderX = Math.max(leaderX, rr.x);

    const remainingMFor = (x) => Math.max(0, race.goal - (x / CONFIG.PX_PER_M));

    for (let idx = 0; idx < state.runners.length; idx++) {
      const r = state.runners[idx];
      if (r.finished) continue;

      r.prevY = r.y;

      if (r.justLandedT > 0) r.justLandedT -= dt; else r.justLandedKind = "";

      // regen (player/cpu共通)
      regenStocks(r, dt);

      // ===== AI decisions (CPU) =====
      if (!r.isPlayer) {
        r.aiCd -= dt;
        r.aiBoostCd -= dt;

        // ギミック狙いジャンプ
        if (r.onGround && !r.onPipe && !r.onDan && !r.onOr) {
          const next = pickNextPlatform(world, r.x, 180);
          if (next) {
            const topY = platformTopAt(r, next.kind, next.obj);
            const heightGain = Math.max(0, world.groundY - topY);
            const dx = next.obj.x - (r.x + r.w * 0.5);
            const inWindow = (dx > 34 && dx < 70);
            const needHeight = heightGain > 10;
            const p = MOB.clamp((r.gimmickSkill || 0) * (needHeight ? 1.0 : 0.65), 0, 1);
            if (inWindow && Math.random() < p) MOB.doJump(r);
          }
        }

        // small random jump
        if (r.aiCd <= 0) {
          r.aiCd = MOB.rand(0.25, 0.55);
          const base = 0.010;
          const extra = (r.gimmickSkill || 0) * 0.020;
          if (Math.random() < (base + extra)) MOB.doJump(r);
        }

        const remain = remainingMFor(r.x);
        const nearGoal = (remain <= 120); // ゴール前補正禁止ゾーン

        // ===== CPU normal boost =====
        if (!nearGoal && r.aiBoostCd <= 0 && r.boostTimer <= 0 && r.stockBoost > 0) {
          let want = 0;

          if (r.justLandedT > 0) {
            if (r.justLandedKind === "pipe") want = Math.max(want, 0.95);
            if (r.justLandedKind === "or")   want = Math.max(want, 0.80);
            if (r.justLandedKind === "dan")  want = Math.max(want, 0.65);
          }

          if (r.onPipe) want = Math.max(want, 0.85);
          if (r.onOr)   want = Math.max(want, 0.60);
          if (r.onDan)  want = Math.max(want, 0.45);

          const gapM = Math.max(0, (leaderX - r.x) / CONFIG.PX_PER_M);
          if (gapM > 25) want = Math.max(want, 0.55);

          const skill = MOB.clamp(r.boostSkill || 0, 0, 1);
          const prob = MOB.clamp(want * skill * 0.55, 0, 0.60);

          if (Math.random() < prob) {
            r.aiBoostCd = CONFIG.AI_BOOST_COOLDOWN;
            r.stockBoost--;
            MOB.startBoost(r, CONFIG.BOOST_ADD, CONFIG.BOOST_TIME);
          }
        }

        // ===== CPU jump boost =====
        // “爽快感”担当：平地でも使う。通常ブーストより頻度は控えめ。
        if (!nearGoal && r.stockJB > 0 && r.jbTimer <= 0 && r.onGround) {
          const skill = MOB.clamp(r.boostSkill || 0, 0, 1);
          const gapM = Math.max(0, (leaderX - r.x) / CONFIG.PX_PER_M);

          let wantJB = 0.06 + skill * 0.12; // base
          if (gapM > 18) wantJB += 0.10;    // 置いていかれた時

          // 直前にギミックがある時は少し抑える（狙いジャンプの邪魔をしにくい）
          const next = pickNextPlatform(world, r.x, 140);
          if (next && next.dx < 80) wantJB *= 0.55;

          // 連打感を抑える（自然さ）
          if (r.boostTimer > 0) wantJB *= 0.65;

          if (Math.random() < MOB.clamp(wantJB, 0, 0.30)) {
            r.stockJB--;
            MOB.startJumpBoost(r);
          }
        }
      }

      // ===== PLAYER controls =====
      if (r.isPlayer) {
        if (MOB.input.jump) {
          MOB.doJump(r);
          MOB.input.jump = false;
        }
        if (MOB.input.boost && r.stockBoost > 0) {
          r.stockBoost--;
          MOB.startBoost(r, CONFIG.BOOST_ADD, CONFIG.BOOST_TIME);
          MOB.input.boost = false;
        }
        if (MOB.input.jumpBoost && r.stockJB > 0) {
          r.stockJB--;
          MOB.startJumpBoost(r);
          MOB.input.jumpBoost = false;
        }
      }

      // ===== SPEED (baseMul + rubber band for CPU) =====
      let baseSpeed = CONFIG.BASE_SPEED;
      if (!r.isPlayer) {
        baseSpeed *= (r.baseMul || 1.0);

        const remain = remainingMFor(r.x);
        if (remain > 120) {
          const gapM = Math.max(0, (leaderX - r.x) / CONFIG.PX_PER_M);
          const rubber = MOB.clamp(gapM / 120, 0, 1) * 0.04; // max +4%
          baseSpeed *= (1 + rubber);
        }
      }

      let speed = baseSpeed;

      // normal boost
      if (r.boostTimer > 0) {
        r.boostTimer -= dt;
        speed += r.boostPower;
      }

      // jump boost (separate)
      if (r.jbTimer > 0) {
        r.jbTimer -= dt;
        speed += r.jbPower;
      }

      // platform accel
      if (r.onOr)  speed += CONFIG.TRACK_ACCEL_ADD;
      if (r.onDan) speed += CONFIG.DAN_ACCEL_ADD;

      let addPipeAccel = 0;
      const cx = r.x + r.w * 0.5;

      // PLATFORM FOLLOW
      if (r.onOr && r.orRef) {
        const o = r.orRef;
        if (cx < o.x - CONFIG.MIN_STAY_MARGIN || cx > o.x + o.w + CONFIG.MIN_STAY_MARGIN) {
          r.onOr = false; r.orRef = null;
        } else {
          r.y = o.y - r.h;
          r.vy = 0;
          r.onGround = true;
          r.jumps = 0;
        }
      }

      if (r.onDan && r.danRef) {
        const d = r.danRef;
        if (cx < d.x - CONFIG.MIN_STAY_MARGIN || cx > d.x + d.w + CONFIG.MIN_STAY_MARGIN) {
          r.onDan = false; r.danRef = null;
        } else {
          const topY = MOB.danTopY(d, cx);
          r.y = topY - r.h;
          r.vy = 0;
          r.onGround = true;
          r.jumps = 0;
        }
      }

      if (r.onPipe && r.pipeRef) {
        const p = r.pipeRef;
        if (cx < p.x - CONFIG.MIN_STAY_MARGIN || cx > p.x + p.w + CONFIG.MIN_STAY_MARGIN) {
          r.onPipe = false; r.pipeRef = null;
        } else {
          const pf = MOB.pipeTopY(p, cx);
          r.y = pf.yTop - r.h;
          r.vy = 0;
          r.onGround = true;
          r.jumps = 0;

          addPipeAccel = CONFIG.PIPE_PROFILE.BASE_ON_PIPE_ADD + pf.slopeAbs01 * CONFIG.PIPE_PROFILE.SLOPE_ADD;
        }
      }

      speed += addPipeAccel;

      // GRAVITY (only if not riding)
      if (!r.onPipe && !r.onDan && !r.onOr) {
        r.vy += CONFIG.GRAVITY * dt;
        r.vy = Math.min(r.vy, CONFIG.MAX_FALL_V);
        r.y += r.vy * dt;
      }

      // MOVE X
      r.x += speed * dt;

      // GROUND
      if (!r.onPipe && !r.onDan && !r.onOr) {
        if (r.y + r.h >= world.groundY) {
          r.y = world.groundY - r.h;
          r.vy = 0;
          r.onGround = true;
          // 特技ジャンプ後に自然復帰
          r.jumps = 0;
        } else {
          r.onGround = false;
        }
      }

      // PLATFORM LANDING (上から着地のみ)
      if (!r.onPipe && !r.onDan && !r.onOr) {
        // rail
        for (const rail of world.rails) {
          if (MOB.rectHit(r.x, r.y, r.w, r.h, rail.x, rail.y, rail.w, rail.h)) {
            if (MOB.tryLandOnPlatform(r, idx, rail, rail.y, "rail")) break;
          }
        }
        // or
        if (!r.onOr) {
          for (const o of world.ors) {
            if (MOB.rectHit(r.x, r.y, r.w, r.h, o.x, o.y, o.w, o.h)) {
              if (MOB.tryLandOnPlatform(r, idx, o, o.y, "or")) break;
            }
          }
        }
        // dan
        if (!r.onDan) {
          for (const d of world.dans) {
            if (MOB.rectHit(r.x, r.y, r.w, r.h, d.x, d.y, d.w, d.h)) {
              const topY = MOB.danTopY(d, r.x + r.w * 0.5);
              if (MOB.tryLandOnPlatform(r, idx, d, topY, "dan")) break;
            }
          }
        }
        // pipe
        if (!r.onPipe) {
          for (const p of world.pipes) {
            if (MOB.rectHit(r.x, r.y, r.w, r.h, p.x, p.y, p.w, p.h)) {
              const pf = MOB.pipeTopY(p, r.x + r.w * 0.5);
              if (MOB.tryLandOnPlatform(r, idx, p, pf.yTop, "pipe")) break;
            }
          }
        }
      }

      // ring
      for (const ring of world.rings) {
        if (ring.takenBy.has(idx)) continue;

        const dx = (r.x + r.w / 2) - ring.x;
        const dy = (r.y + r.h / 2) - ring.y;
        if (dx * dx + dy * dy < ring.r * ring.r * 4) {
          ring.takenBy.add(idx);
          r.rings++;

          if (r.rings >= CONFIG.RING_NEED) {
            r.rings = 0;
            MOB.startBoost(r, CONFIG.RING_BOOST_ADD, CONFIG.RING_BOOST_TIME);
          }
        }
      }

      // finish
      if (!r.finished && (r.x / CONFIG.PX_PER_M) >= race.goal) {
        r.finished = true;
        r.finishTime = state.time;
        state.finishedCount++;
      }
    }

    state.time += dt;

    MOB.updateRank();
    MOB.updateTop8();
    if (MOB.ui) MOB.ui.updateStockBars();

    // survive threshold => result
    if (state.finishedCount >= race.survive) {
      if (MOB.ui) MOB.ui.showResult();
    }
  };
})();
