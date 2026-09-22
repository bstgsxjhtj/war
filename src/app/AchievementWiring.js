import { EV } from '../core/constants/events.js';

// 成就事件接线：10 个触发源 check + 解锁奖励分发 + 词条掉落提示
export function wireAchievements(bus, { achievements, getSkills, getAffixes, getSkins, hud, audio }) {
  bus.on(EV.COMBAT_KILL, (p) => { if (p && p.killer && p.killer.isLocal) achievements.check(EV.COMBAT_KILL, p); });
  bus.on(EV.COMBO_TIER, (p) => achievements.check(EV.COMBO_TIER, p));
  bus.on(EV.SKILL_CAST, (p) => { achievements.check(EV.SKILL_CAST, p); audio.playSound('ultimate'); });
  bus.on(EV.CAMPAIGN_CLEAR, (p) => achievements.check(EV.CAMPAIGN_CLEAR, p));
  bus.on(EV.CAMPAIGN_PERFECT, (p) => achievements.check(EV.CAMPAIGN_PERFECT, p));
  bus.on(EV.COMBAT_BACKSTAB, (p) => achievements.check(EV.COMBAT_BACKSTAB, p));
  bus.on(EV.COMBAT_PERFECTBLOCK, (p) => achievements.check(EV.COMBAT_PERFECTBLOCK, p));
  bus.on(EV.COMBAT_DODGE, (p) => achievements.check(EV.COMBAT_DODGE, p));
  bus.on(EV.COMBAT_CAVALRYKILL, (p) => achievements.check(EV.COMBAT_CAVALRYKILL, p));
  bus.on(EV.DAILY_COMPLETED, (p) => achievements.check(EV.DAILY_COMPLETED, p));
  bus.on(EV.ACHIEVEMENT_UNLOCK, ({ name, reward }) => {
    const skills = getSkills(), affixes = getAffixes(), skins = getSkins();
    if (reward.skillPoint) skills.addPoint(reward.skillPoint);
    if (reward.affix) affixes.grant(reward.affix[0], reward.affix[1]);
    if (reward.skin && skins) skins.unlock(reward.skin);
    hud.flash('成就解锁：' + name);
    audio.playSound('achievement');
  });
  bus.on(EV.AFFIX_DROP, ({ type }) => hud.flash('词条掉落：' + type));
}
