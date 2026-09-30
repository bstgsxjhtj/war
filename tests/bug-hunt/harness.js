// Bug-hunt harness: paste this entire script into browser_evaluate once per
// session. It installs window.__hunt with state-injection, invariant-assertion,
// snapshot, and console-capture helpers. The divergent test generator then
// calls __hunt.<method> in sequence to drive scenarios.
//
// Designed for the deployed site at http://106.13.61.192/ — uses only
// window.__game (player/combat/match/state/ais) which the build exposes.
//
// IMPORTANT: do NOT wrap in an IIFE — browser_evaluate auto-wraps.

window.__hunt = window.__hunt || (function () {
  const g = () => window.__game;
  const p = () => g().player;
  const c = () => g().combat;
  const m = () => g().match;
  const s = () => g().state;
  const cam = () => p().camera;
  const fin = (v) => typeof v === 'number' && Number.isFinite(v);
  const clamp01 = (v) => Math.max(0, Math.min(1, v));

  // bundle hash extraction (avoid stale-console false positives)
  const bundleHash = () => {
    const sc = document.querySelector('script[src*="assets/index-"]');
    if (!sc) return '';
    const m2 = /index-([A-Za-z0-9_-]+)\.js/.exec(sc.getAttribute('src') || '');
    return m2 ? m2[1] : '';
  };

  // --- state injection ---
  const inj = {
    killPlayer(src) {
      const pl = p();
      if (!pl || !pl.alive) return { ok: false, reason: 'no-alive-player' };
      pl.health.cur = 1;
      try { pl.takeDamage(9999, true, src || { weapon: { weaponClass: 'TEST' }, position: { x: 0, y: 0, z: 0 } }, performance.now() / 1000); }
      catch (e) { return { ok: false, reason: 'takeDamage-threw: ' + e.message }; }
      return { ok: true };
    },
    forceRestart() { try { m().restart(); return { ok: true }; } catch (e) { return { ok: false, reason: e.message }; } },
    forceStartRound() { try { m().startRound(); return { ok: true }; } catch (e) { return { ok: false, reason: e.message }; } },
    forceState(st) { try { s().transit(st); return { ok: true }; } catch (e) { return { ok: false, reason: e.message }; } },
    switchWeapon(i) { try { p().switchWeapon(i); return { ok: true }; } catch (e) { return { ok: false, reason: e.message }; } },
    setHP(v) { p().health.cur = v; return { ok: true }; },
    setStamina(v) { if (p().stamina) p().stamina.cur = v; return { ok: true }; },
    injectNaNPos() { try { p().position.set(NaN, NaN, NaN); return { ok: true }; } catch (e) { return { ok: false, reason: e.message }; } },
    injectInfPos() { try { p().position.set(Infinity, Infinity, Infinity); return { ok: false, reason: 'not-run' }; } catch (e) { return { ok: false, reason: e.message }; } },
    doAttack() { const pl = p(); try { pl.weapon._perform(pl, c(), { charge: 1, now: 0, combo: 0, dmg: pl.weapon.damageFor ? pl.weapon.damageFor(1) : 10 }); return { ok: true }; } catch (e) { return { ok: false, reason: e.message }; } },
    doSkill() { const pl = p(); try { return { ok: !!pl.weapon.skill(pl, c(), performance.now() / 1000) }; } catch (e) { return { ok: false, reason: e.message }; } },
    spawnEnemyAt(x, z) { try { g()._testSpawnRed && g()._testSpawnRed(x, z); return { ok: true }; } catch (e) { return { ok: false, reason: e.message }; } },
  };

  // --- invariants: returns {ok, violations:[{name, detail}]} ---
  const inv = {
    playerPosFinite() { const pos = p().position; return fin(pos.x) && fin(pos.y) && fin(pos.z); },
    playerHpNonNeg() { return p().health.cur >= 0; },
    playerHpBounded() { return p().health.cur <= p().health.maxHp + 0.01; },
    weaponIdxInRange() { return p().weaponIdx >= 0 && p().weaponIdx < p().weapons.length; },
    hasWeapons() { return p().weapons && p().weapons.length > 0; },
    weaponMeshExistsWhenAlive() { return !p().alive || !!p()._weaponMesh; },
    cameraLockNullWhenDead() { const dead = !p().alive; const lt = cam().lockTarget; return !dead || lt === null || lt === undefined; },
    killCamTimerNonNeg() { const t = cam()._killTimer; return typeof t !== 'number' || t >= 0; },
    stateValid() { const st = s().current; return ['playing', 'roundEnd', 'ended', 'intro'].indexOf(st) >= 0; },
    enemiesFinite() { const ais = g().ais || []; for (let i = 0; i < ais.length; i++) { const a = ais[i]; if (a && a.position && (!fin(a.position.x) || !fin(a.position.z))) return false; } return true; },
    arrowsFinite() { const ar = c().arrows || []; for (let i = 0; i < ar.length; i++) { const a = ar[i]; if (a && a.pos && (!fin(a.pos.x) || !fin(a.pos.z))) return false; } return true; },
  };

  const NAMES = ['playerPosFinite', 'playerHpNonNeg', 'playerHpBounded', 'weaponIdxInRange', 'hasWeapons', 'weaponMeshExistsWhenAlive', 'cameraLockNullWhenDead', 'killCamTimerNonNeg', 'stateValid', 'enemiesFinite', 'arrowsFinite'];

  function assertInvariants() {
    const v = [];
    for (const n of NAMES) {
      try { if (!inv[n]()) v.push({ name: n, detail: 'FAILED' }); }
      catch (e) { v.push({ name: n, detail: 'THREW: ' + e.message }); }
    }
    return { ok: v.length === 0, violations: v };
  }

  function snapshot() {
    const pl = p(); const cm = cam();
    return {
      bundle: bundleHash(),
      state: s().current,
      alive: pl.alive,
      hp: pl.health.cur, maxHp: pl.health.maxHp,
      stam: pl.stamina ? pl.stamina.cur : null,
      pos: [pl.position.x.toFixed(2), pl.position.y.toFixed(2), pl.position.z.toFixed(2)],
      weaponIdx: pl.weaponIdx, weaponNames: pl.weapons.map(function (w) { return w.name; }),
      currentWeapon: pl.weapon ? pl.weapon.name : null,
      attacking: !!pl._attacking,
      camLockTarget: cm.lockTarget === null ? 'null' : (cm.lockTarget ? 'object' : String(cm.lockTarget)),
      camKillCam: cm._killCamTarget === null ? 'null' : (cm._killCamTarget ? 'object' : String(cm._killCamTarget)),
      camKillTimer: cm._killTimer,
      camYaw: cm.yaw.toFixed(3),
      arrows: (c().arrows || []).length,
      enemies: (g().ais || []).length,
      roundR: m().roundR, roundB: m().roundB, target: m().targetWins,
    };
  }

  // scenario wrapper: runs fn, catches errors, asserts invariants, returns report
  function runScenario(name, fn) {
    const before = snapshot();
    let injectErr = null, fnErr = null;
    try { const r = fn(); if (r && r.ok === false) injectErr = r.reason || 'injection-failed'; }
    catch (e) { fnErr = e.message + ' | ' + (e.stack || '').slice(0, 120); }
    const after = snapshot();
    const invResult = assertInvariants();
    return {
      scenario: name,
      ok: !fnErr && !injectErr && invResult.ok,
      injectErr: injectErr,
      fnErr: fnErr,
      invariantViolations: invResult.violations,
      before: before,
      after: after,
    };
  }

  return {
    ver: '0.1',
    bundle: bundleHash,
    inject: inj,
    invariants: inv,
    assertInvariants: assertInvariants,
    snapshot: snapshot,
    runScenario: runScenario,
    _names: NAMES,
  };
})();
