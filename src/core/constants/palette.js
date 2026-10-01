// 中央色板常量：全仓颜色唯一事实来源；消除散落硬编码与配色冲突
// 用法：import { PALETTE } from '../core/constants/palette.js';
//       new THREE.Color(PALETTE.WATER.SHALLOW)

export const PALETTE = {
  // 场景：黄昏暖调
  SCENE: {
    FOG: 0x8a7458,
    BG: 0x8a7458,
    HEMI_SKY: 0xffd9a8,
    HEMI_GROUND: 0x5a4a36,
    SUN: 0xffc070,
    MOUNTAIN_FAR: 0x6a5238,
    MOUNTAIN_MID: 0x78685a,
    MOUNTAIN_NEAR: 0x8a7458,
    SKY_TOP: 0x6a5a48,
    SKY_BOTTOM: 0xc89058,
    SUN_BALL: 0xffe0a0,
  },

  // 水面：暖化（原冷蓝 0x6a9ab8/0x2a4a6a 与黄昏暖调冲突）
  WATER: {
    SHALLOW: 0x6a9a8a,
    DEEP: 0x2a4a3a,
    SKY: 0xc8a878,
    REFLECTOR: 0x8a7a68,
  },

  // 环境反射图：暖化（原冷蓝 #4a6a9a/#8aaacc 反射到金属盔甲造成色温不一）
  ENVMAP: {
    SKY_TOP: '#8a7458',
    SKY_BOTTOM: '#c89058',
    GROUND_TOP: '#5a4a3a',
    GROUND_BOTTOM: '#3a2a1a',
    SIDE_TOP: '#7a6a58',
    SIDE_BOTTOM: '#5a4a3a',
  },

  // 阵营色：蓝/红统一（Character/Environment 帐篷/旗帜共用）
  TEAM: {
    BLUE: { PRIMARY: 0x2f5fa8, ARMOR: 0x3a6fd0, HELM: 0x7a9fd0 },
    RED: { PRIMARY: 0xa83030, ARMOR: 0xd03a3a, HELM: 0x4a4a52 },
    NEUTRAL: 0x6a5a3a,
    SKIN: 0xc89060,
    TRIM: 0xd4b25a,
  },

  // 地形
  TERRAIN: {
    BASE: 0x6b5a3e,
    GRASS: 0x4f6b3a,
    DIRT: 0x7a6448,
    STONE: 0x807a70,
    SAND: 0xb8a878,
  },

  // 环境
  ENV: {
    TREE_TRUNK: 0x4a2f1a,
    TREE_LEAF: [0x355028, 0x3a4a20, 0x446030],
    ROCK: 0x6b6862,
    GRASS: [0x4a6030, 0x5a6a38, 0x3e5628],
    RUINS: 0x6a6258,
    LANDMARK: 0x8a8278,
    LANDMARK_TOP: 0x5a3a1a,
    CAMPFIRE: 0xff7030,
    CAMPFIRE_EMISSIVE: 0xff5020,
    SMOKE: [0x4a4a4a, 0x3a3a3a],
    BLOOD: 0x3a0808,
    GODRAYS: 0xffd090,
  },

  // 武器
  WEAPON: {
    TRIM: 0xd4b25a,
    BLADE_EMISSIVE: 0xffd070,
    BLADE_EMISSIVE_INTENSITY: 1.0,
  },
};
