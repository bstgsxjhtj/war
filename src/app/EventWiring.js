import { COUNTER_MATRIX } from '../gameplay/CombatSystem.js';
import { killerLabel } from '../ui/DeathFeedback.js';
import { EV } from '../core/constants/events.js';

// 纯事件接线：17 个无 mutable-local 依赖的 bus.on 处理器下沉到此处。
// 依赖均通过 deps 注入（稳定实例 + 载荷数据），便于单测与将来全量下沉。
// 余下 7 个引用 player/ais/enemies/_colorblind 等 mutable let 绑定或位于条件块（net）的处理器仍留在 main_entry.js。
export function wireCoreHandlers(bus, deps) {
  const { audio, hitStop, hitDirection, weaponTrail, daily, progression, progressUI,
    deathFeedback, assist, aiManager, camera, dodgeGhosts, match, weather } = deps;

  bus.on(EV.FX_PERFECTBLOCK, () => {
    if (daily.track('perfect')) bus.emit(EV.DAILY_UPDATE, daily.challenges);
    bus.emit(EV.COMBAT_PERFECTBLOCK, {});
    audio.playSound('perfectblock');
    hitStop.trigger(0.15, 0.3);
    bus.emit(EV.FX_SHAKE, { amount: 0.6 });
  });
  bus.on(EV.FX_BLOCK, () => { audio.playSound('block'); });
  bus.on(EV.FX_PERFECTDODGE, () => {
    if (daily.track('dodge')) bus.emit(EV.DAILY_UPDATE, daily.challenges);
    bus.emit(EV.COMBAT_DODGE, {});
    audio.playSound('dodge');
    hitStop.trigger(0.4, 0.5);
  });
  bus.on(EV.COMBAT_HIT, ({ attacker, victim, damage, combo, heavy, backstab, crit }) => {
    if (victim && victim.isLocal && attacker) {
      const angle = Math.atan2(attacker.position.x - victim.position.x, attacker.position.z - victim.position.z);
      hitDirection.show(angle, camera.yaw || 0);
      camera.addShake(0.18);
    }
    if (attacker && attacker.isLocal) {
      hitStop.trigger(heavy ? 0.12 : 0.06, 0.05);
      weaponTrail.activate(attacker._weaponMesh);
      match.playerDamage += damage || 0;
    }
    if (victim && victim.isLocal) match.playerTaken += damage || 0;
    if (backstab) { daily.track('backstab'); if (attacker && attacker.isLocal) bus.emit(EV.COMBAT_BACKSTAB, { attacker, victim }); }
    bus.emit(EV.DAILY_UPDATE, daily.challenges);
    const _wc = attacker?.weapon?.weaponClass;
    audio.playSound('swing', { weaponClass: _wc });
    audio.playSound('hit', { heavy, combo, weaponClass: _wc });
    if (crit) audio.playSound('crit');
  });
  bus.on(EV.COMBAT_KILL, ({ victim, killer }) => {
    if (killer && killer.isLocal) {
      progression.recordKill();
      if (victim && victim._isBoss) { hitStop.trigger(0.3, 0.15); bus.emit(EV.FX_SHAKE, { amount: 1.0 }); }
      else { hitStop.trigger(0.15, 0.2); bus.emit(EV.FX_SHAKE, { amount: 0.5 }); }
    }
    if (victim && victim.isLocal) progression.recordDeath();
    progressUI.refresh();
    audio.playSound('ultimate');
  });
  bus.on(EV.COMBAT_KILL, ({ victim }) => {
    if (!(victim && victim.isLocal && !victim.alive)) return;
    assist.onPlayerDeath();
    // 死亡时释放 Tab 锁定：清除目标标记与相机锁定引用，避免回合间歇/复活后
    // camera.follow 仍朝向旧 lockTarget 自动旋转，抢夺鼠标转向
    if (victim.lockTarget) { victim.lockTarget.setLockMark(false); victim.lockTarget = null; }
    camera.lockTarget = null;
  });
  bus.on(EV.COMBAT_EXECUTE, ({ char } = {}) => {
    if (char && char.isLocal) { audio.playSound('execute'); hitStop.trigger(0.18, 0.1); bus.emit(EV.FX_SHAKE, { amount: 0.4 }); }
  });
  bus.on(EV.COMBAT_KILL, ({ victim, killer }) => {
    if (!(victim && victim.isLocal) || !killer) return;
    const angle = Math.atan2(killer.position.x - victim.position.x, killer.position.z - victim.position.z);
    const mul = COUNTER_MATRIX[killer.weapon?.weaponClass]?.[victim.weapon?.weaponClass] ?? 1;
    deathFeedback.show({ label: killerLabel(killer), countered: mul > 1.2, angle, camYaw: camera.yaw || 0 });
  });
  bus.on(EV.SETTINGS_DIFFICULTY, ({ difficulty }) => assist.setBaseLevel(difficulty));
  bus.on(EV.SETTINGS_DIFFICULTY, ({ difficulty }) => { if (aiManager) aiManager.setDifficulty(difficulty); });
  bus.on(EV.SETTINGS_SHAKE_INTENSITY, ({ shakeIntensity }) => { camera.setShakeIntensity(shakeIntensity); });
  bus.on(EV.HUD_BOSSPHASE, ({ phase }) => { audio.playSound('bossRoar'); audio.playSound('bgmIntensity', { intensity: 2 }); if (weather) weather.setMode(phase >= 3 ? 'night' : 'storm'); });
  bus.on(EV.FX_BOSSROAR, () => audio.playSound('bossRoar'));
  bus.on(EV.FX_DODGE, (p) => { if (p && p.char && p.char.isLocal) dodgeGhosts.begin(p.char); });
  bus.on(EV.COMBAT_ULTIMATE, () => audio.playSound('ultimate'));
  bus.on(EV.COMBAT_COUNTER, () => audio.playSound('counter'));
  bus.on(EV.COMBO_TIER, (p) => audio.playSound('comboTier', { tier: p.tier || 0 }));
}
