import { Sword } from './weapons/Sword.js';
import { Bow } from './weapons/Bow.js';
import { Spear } from './weapons/Spear.js';
import { SwordShield } from './weapons/SwordShield.js';
import { Warhammer } from './weapons/Warhammer.js';
import { Staff } from './weapons/Staff.js';
import { MageDagger } from './weapons/MageDagger.js';
import { HuntDagger } from './weapons/HuntDagger.js';

export const CLASS_DEFS = {
  warrior: {
    name: '战士',
    desc: '高血量坦克，格挡减伤，重武器控场',
    stats: { speed: 7.5, sprintMul: 1.6, maxHp: 200, maxStamina: 130 },
    weaponNames: ['剑盾', '枪', '锤'],
    weapons: () => [new SwordShield(), new Spear(), new Warhammer()],
    color: 0xcc4422,
    icon: '⚔',
  },
  mage: {
    name: '法师',
    desc: '远程法术爆发，AoE清场，脆皮高伤',
    stats: { speed: 9.0, sprintMul: 1.5, maxHp: 100, maxStamina: 80 },
    weaponNames: ['法杖', '秘法匕首'],
    weapons: () => [new Staff(), new MageDagger()],
    color: 0x4488ff,
    icon: '✦',
  },
  archer: {
    name: '弓箭手',
    desc: '高机动风筝流，蓄力远程，猎手匕首应急',
    stats: { speed: 9.5, sprintMul: 1.8, maxHp: 140, maxStamina: 110 },
    weaponNames: ['弓', '猎手匕首'],
    weapons: () => [new Bow(), new HuntDagger()],
    color: 0x44cc44,
    icon: '➹',
  },
};

export const CLASS_KEYS = ['warrior', 'mage', 'archer'];

export const AI_CLASS_CONFIG = {
  warrior: { maxHp: 120, speed: 7.0, sprintMul: 1.6, maxStamina: 100, weapons: () => [new SwordShield(), new Spear(), new Warhammer()] },
  mage: { maxHp: 60, speed: 8.5, sprintMul: 1.5, maxStamina: 60, weapons: () => [new Staff(), new MageDagger()] },
  archer: { maxHp: 80, speed: 9.0, sprintMul: 1.8, maxStamina: 80, weapons: () => [new Bow(), new HuntDagger()] },
};

export function randomAIClass() {
  return CLASS_KEYS[Math.floor(Math.random() * CLASS_KEYS.length)];
}
