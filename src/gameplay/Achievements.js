import { EV } from '../core/constants/events.js';

export const ACHIEVEMENTS = [
  { id: 'kill_1', cat: '战斗', name: '初战告捷', target: 1, event: 'combat.kill', reward: { skillPoint: 1 } },
  { id: 'kill_50', cat: '战斗', name: '五十人斩', target: 50, event: 'combat.kill', reward: { skillPoint: 1, affix: ['锋锐', 1] } },
  { id: 'kill_100', cat: '战斗', name: '百人斩', target: 100, event: 'combat.kill', reward: { skillPoint: 2, affix: ['锋锐', 2] } },
  { id: 'kill_500', cat: '战斗', name: '五百人斩', target: 500, event: 'combat.kill', reward: { skillPoint: 2, affix: ['暴怒', 2] } },
  { id: 'kill_1000', cat: '战斗', name: '千人斩', target: 1000, event: 'combat.kill', reward: { skillPoint: 3, affix: ['吸血', 2] } },
  { id: 'combo_10', cat: '连击', name: '连击新星', target: 1, event: 'combo.tier', reward: { affix: ['锋锐', 1] } },
  { id: 'combo_20', cat: '连击', name: '连击大师', target: 2, event: 'combo.tier', reward: { affix: ['暴怒', 2] } },
  { id: 'combo_50', cat: '连击', name: '连击之王', target: 3, event: 'combo.tier', reward: { affix: ['迅捷', 2] } },
  { id: 'campaign_clear', cat: '战役', name: '通关战役', target: 1, event: 'campaign.clear', reward: { skin: 'obsidian', affix: ['坚韧', 2] } },
  { id: 'campaign_perfect', cat: '战役', name: '全关无伤', target: 1, event: 'campaign.perfect', reward: { skin: 'dragon', affix: ['锋锐', 2] } },
  { id: 'nightmare_clear', cat: '特殊', name: '噩梦征服者', target: 1, event: 'campaign.nightmare_clear', reward: { forceSkin: 'legend', affix: ['幸运', 3], skillPoint: 3 } },
  { id: 'daily_10', cat: '每日', name: '每日初心', target: 10, event: 'daily.completed', reward: { skillPoint: 1 } },
  { id: 'daily_30', cat: '每日', name: '每日达人', target: 30, event: 'daily.completed', reward: { skillPoint: 2 } },
  { id: 'backstab_10', cat: '特殊', name: '背刺者', target: 10, event: 'combat.backstab', reward: { affix: ['吸血', 1] } },
  { id: 'perfect_block_20', cat: '特殊', name: '完美防御', target: 20, event: 'combat.perfectblock', reward: { affix: ['坚韧', 1] } },
  { id: 'cavalry_kill_5', cat: '特殊', name: '骑马杀', target: 5, event: 'combat.cavalrykill', reward: { affix: ['幸运', 1] } },
  { id: 'dodge_50', cat: '特殊', name: '闪避大师', target: 50, event: 'combat.dodge', reward: { affix: ['迅捷', 1] } },
  { id: 'skill_100', cat: '技能', name: '技能初试', target: 100, event: 'skill.cast', reward: { affix: ['锋锐', 2] } },
  { id: 'skill_all', cat: '技能', name: '全武器大师', target: 4, event: 'skill.cast', reward: { affix: ['暴怒', 2] } },
];

export class Achievements {
  constructor(bus = null) { this._data = {}; this._bus = bus; }
  check(event, payload = {}) {
    for (const a of ACHIEVEMENTS) {
      if (a.event !== event) continue;
      const d = this._data[a.id] || { progress: 0, unlocked: false };
      if (d.unlocked) continue;
      d.progress += 1;
      if (d.progress >= a.target) {
        d.unlocked = true;
        if (this._bus) this._bus.emit(EV.ACHIEVEMENT_UNLOCK, { id: a.id, name: a.name, reward: a.reward });
      }
      this._data[a.id] = d;
    }
  }
  progress(id) { return this._data[id] ? this._data[id].progress : 0; }
  isUnlocked(id) { return !!(this._data[id] && this._data[id].unlocked); }
  allByCat(cat) { return ACHIEVEMENTS.filter(a => a.cat === cat).map(a => ({ ...a, progress: this.progress(a.id), unlocked: this.isUnlocked(a.id) })); }
  serialize() { return JSON.parse(JSON.stringify(this._data)); }
  restore(data = {}) { this._data = (data && typeof data === 'object') ? JSON.parse(JSON.stringify(data)) : {}; }
}
