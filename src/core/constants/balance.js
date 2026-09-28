// 平衡数值常量：武器/战斗/相机/处决；事件契约见 05-conventions.md §1
export const WEAPON_STATS = {
  SWORD: { name: '刀', damage: 24, range: 2.9, cooldown: 0.27 },
  SPEAR: { name: '枪', damage: 18, range: 4.2, cooldown: 0.4 },
  SWORD_SHIELD: { name: '剑盾', damage: 20, range: 2.6, cooldown: 0.32 },
  WARHAMMER: { name: '重锤', damage: 55, range: 2.4, cooldown: 1.2 },
  BOW: { name: '弓', damage: 30, range: 70, cooldown: 0.95 }
};

// 战斗反馈：屏幕震动/顿帧/背刺/暴击/处决阈值与伤害
export const COMBAT = {
  SHAKE_MAP: [0.16, 0.18, 0.32],
  SHAKE_MAX: 0.9,
  HEAVY_SHAKE_BONUS: 0.14,
  HITSTOP_MAP: [0.04, 0.05, 0.11],
  HITSTOP_MAX: 0.14,
  HEAVY_HITSTOP_BONUS: 0.04,
  BACKSTAB_ANGLE: 0.5,
  CRIT_MUL: 2,
  COUNTER_THRESHOLD: 1.2,
  DMG_MUL_MAX: 6.0,
  EXECUTE_HP_RATIO: 0.2,
  EXECUTE_DAMAGE: 9999,
  EXECUTE_RANGE: 3,
  ARROW_LIFE: 3.5,
  PIERCE_ARROW_LIFE: 4,
  PIERCE_ARROW_PIERCE: 3,
  BOW_SPREAD_FACTOR: 0.3
};

// 相机：FOV/距离/高度/震动衰减
export const CAMERA = {
  FOV_DEFAULT: 60,
  FOV_AIM: 48,
  FOV_PERFECT_DODGE: 52,
  FOV_PERFECT_BLOCK: 50,
  SHAKE_MAX: 0.9,
  SHAKE_DECAY: 0.86,
  SHAKE_LERP: 0.6,
  DIST_DEFAULT: 7,
  DIST_AIM: 3.5,
  HGT_DEFAULT: 3,
  HGT_AIM: 1.6,
  LERP_DIST: 0.15,
  LERP_HGT: 0.15,
  LERP_FOV: 0.12,
  PERFECT_DODGE_TIME_SCALE: 0.5,
  PITCH_MIN: 0.08,
  PITCH_MAX: 0.95,
  SENSITIVITY_DEFAULT: 0.0025
};

// 处决：血量阈值/伤害/范围/持续时间
export const EXECUTE = {
  HP_RATIO: COMBAT.EXECUTE_HP_RATIO,
  DAMAGE: COMBAT.EXECUTE_DAMAGE,
  RANGE: COMBAT.EXECUTE_RANGE,
  DURATION: 1.2
};

// 噩梦敌人词条：数值收敛（P0-1）
export const ENEMY_MODS = {
  SWIFT_SPEED_MUL: 1.2,
  IRONHIDE_DMG_TAKEN_MUL: 0.75,
  VAMPIRE_LIFESTEAL: 0.15,
  REFLECT_FRACTION: 0.10,
  LUCKY_CRIT_CHANCE: 0.15,
  LUCKY_CRIT_MUL: 2
};