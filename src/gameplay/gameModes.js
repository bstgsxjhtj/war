// 玩法模式注册表：M 键轮换环与统一菜单共用同一份顺序/构造逻辑
import { Deathmatch, Domination, SiegeMode } from './GameMode.js';
import { WaveMode } from './WaveMode.js';
import { BattlefieldMode } from './BattlefieldMode.js';
import { TrainingMode } from './TrainingMode.js';

// 轮换顺序（M 键按此顺序前进；菜单按此顺序展示）
export const MODE_ORDER = ['死斗', '据点', '攻城', '波次', '战场', '无尽', '战役', '训练场'];

export const MODE_DESC = {
  '死斗': '两队厮杀，先赢 2 局获胜',
  '据点': '争夺 3 个据点，占点得分',
  '攻城': '攻破敌方城门取胜',
  '波次': '守住 10 波敌人',
  '战场': '先波次防守，再转攻城破门',
  '无尽': '无限波次，挑战生存极限',
  '战役': '逐关推进，通关后可开启噩梦',
  '训练场': '4 个假人靶，无胜负，练习连招',
};

// 按模式名构建模式实例；campaign 为外部单例（战役/无尽共用）
export function createMode(name, { bus, campaign }) {
  switch (name) {
    case '据点': return new Domination(bus);
    case '攻城': return new SiegeMode(bus);
    case '波次': return new WaveMode(bus);
    case '战场': return new BattlefieldMode(bus);
    case '无尽': return new WaveMode(bus, true);
    case '战役': return campaign;
    case '训练场': return new TrainingMode(bus);
    default: return new Deathmatch(bus);
  }
}

export function nextModeName(current) {
  const i = MODE_ORDER.indexOf(current);
  return MODE_ORDER[(i < 0 ? 0 : i + 1) % MODE_ORDER.length];
}