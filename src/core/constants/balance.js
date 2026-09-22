// 平衡数值常量：武器伤害/射程/冷却/前摇；事件契约见 05-conventions.md §1
export const WEAPON_STATS = {
  SWORD: { name: '刀', damage: 24, range: 2.9, cooldown: 0.27, windup: 0.06 },
  SPEAR: { name: '枪', damage: 18, range: 4.2, cooldown: 0.4, windup: 0.1 },
  SWORD_SHIELD: { name: '剑盾', damage: 20, range: 2.6, cooldown: 0.32, windup: 0.06 },
  WARHAMMER: { name: '重锤', damage: 55, range: 2.4, cooldown: 1.2, windup: 0.18 },
  BOW: { name: '弓', damage: 30, range: 70, cooldown: 0.95, windup: 0.15 }
};
