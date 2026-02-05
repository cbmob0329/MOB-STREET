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
    r.onDan = false;  r.danRef = null;
    r.onOr = false;   r.orRef = null;
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

  // 上から着地のみ
  MOB.tryLandOnPlatform = function tryLandOnPlatform(r, idx, plat, topY, kind) {
    if (r.vy < 0) return false; // ジャンプ上昇中は絶対乗らない

    const prevBottom = r.prevY + r.h;
    const curBottom = r.y + r.h;

    if (prevBottom > topY + CONFIG.LAND_EPS) return false;

    const near = Math.abs(curBottom - topY) <= CONFIG.LAND_SNAP;
    const crossed = curBottom >= (topY - CONFIG.LAND_EPS);
    if (!(near || crossed)) return false;

    r.y = topY - r.h;
    r.vy = 0;
    r.onGround = true;
    r.jumps = 0;

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

  MOB.updateRun = function updateRun(dt) {
    const state = MOB.state;
    const world = MOB.world;
    const race = CONFIG.RACES[state.raceIndex] || CONFIG.RACES[0] || { name: "EASY", goal: 600, start: 10, survive: 5 };
    const player = state.runners[state.playerIndex];

    // camera
    state.cameraX = Math.max(0, player.x - Math.floor(CONFIG.LOGICAL_W * 0.18));
    MOB.spawnWorld(state.cameraX);
    MOB.cleanupWorld();

    // stock regen
    state.stockTimer += dt;
    if (state.stockTimer >= CONFIG.STOCK_REGEN) {
      state.stockTimer = 0;
      state.stock = Math.min(CONFIG.STOCK_MAX, state.stock + 1);
    }

    for (let idx = 0; idx < state.runners.length; idx++) {
      const r = state.runners[idx];
      if (r.finished) continue;

      r.prevY = r.y;

      // AI
      if (!r.isPlayer) {
        r.aiCd -= dt;
        r.aiBoostCd -= dt;

        if (r.aiCd <= 0) {
          r.aiCd = MOB.rand(0.25, 0.55);
          const jumpChance = (r.winRate > 0.30) ? 0.060 : 0.018;
          if (Math.random() < jumpChance) MOB.doJump(r);
        }
        if (r.aiBoostCd <= 0 && Math.random() < (r.winRate * 0.12)) {
          r.aiBoostCd = CONFIG.AI_BOOST_COOLDOWN;
          MOB.startBoost(r, CONFIG.BOOST_ADD, CONFIG.BOOST_TIME);
        }
      }

      // PLAYER
      if (r.isPlayer) {
        if (MOB.input.jump) {
          MOB.doJump(r);
          MOB.input.jump = false;
        }
        if (MOB.input.boost && state.stock > 0) {
          state.stock--;
          MOB.startBoost(r, CONFIG.BOOST_ADD, CONFIG.BOOST_TIME);
          MOB.input.boost = false;
        }
      }

      // SPEED
      let speed = CONFIG.BASE_SPEED;

      if (r.boostTimer > 0) {
        r.boostTimer -= dt;
        speed += r.boostPower;
      }
      if (r.slowTimer > 0) {
        r.slowTimer -= dt;
        speed *= 0.75;
      }

      // platform accel
      if (r.onOr) speed += CONFIG.TRACK_ACCEL_ADD;
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

      // puddle
      for (const p of world.puddles) {
        if (MOB.rectHit(r.x, r.y, r.w, r.h, p.x, p.y, p.w, p.h)) {
          r.slowTimer = 0.40;
        }
      }

      // ring (runner-specific)
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
    if (MOB.ui) MOB.ui.updateStockBar();

    // survive threshold => result
    if (state.finishedCount >= race.survive) {
      if (MOB.ui) MOB.ui.showResult();
    }
  };
})();
