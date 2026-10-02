// @vitest-environment jsdom
// P2-A 接线测试：验证此前死代码 getter 在 Character/CombatSystem 消费点生效
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../src/render/TextureFactory.js', () => ({
  TextureFactory: {
    noise: () => ({ isTexture: true }),
    rough: () => ({ isTexture: true }), normal: () => ({ isTexture: true }), brick: () => ({ isTexture: true })
  }
}));

vi.mock('../../src/render/ParticleFX.js', () => ({
  ParticleFX: Object.assign(
    class { constructor() {} spawnBurst() {} spawn() {} update() {} },
    { blood: () => new (class { setAttribute() {} })() }
  )
}));

import { Character } from '../../src/gameplay/Character.js';
import { SkillTree } from '../../src/gameplay/SkillTree.js';
import { CombatSystem } from '../../src/gameplay/CombatSystem.js';

afterEach(() => vi.restoreAllMocks());

// ── Character 接线：Tier3/Keystone/Duo getter 消费 ──

describe('P2-A 接线：Character 被动闪避消费 tempest/phantom/colossus', () => {
  let c;
  beforeEach(() => {
    c = new Character({ team: 0, maxHp: 100 });
    c.setBus({ emit: vi.fn(), on: vi.fn() });
  });

  it('tempest+phantom 叠加闪避 0.30，random<chance 时免伤', () => {
    const sk = new SkillTree();
    sk.branches.tempest.level = 1;
    sk.branches.phantom.level = 1;
    c._skill = sk;
    vi.spyOn(Math, 'random').mockReturnValue(0);
    expect(c.takeDamage(30, false, null, 1)).toBe(0);
    expect(c.health.hp).toBe(100);
  });

  it('random≥chance 时正常受击', () => {
    const sk = new SkillTree();
    sk.branches.tempest.level = 1;
    sk.branches.phantom.level = 1;
    c._skill = sk;
    vi.spyOn(Math, 'random').mockReturnValue(1);
    expect(c.takeDamage(30, false, null, 1)).toBe(30);
  });

  it('colossus Keystone 禁闪避（即便 tempest+phantom 已点）', () => {
    const sk = new SkillTree();
    sk.branches.tempest.level = 1;
    sk.branches.phantom.level = 1;
    sk.branches.colossus.level = 1;
    c._skill = sk;
    vi.spyOn(Math, 'random').mockReturnValue(0);
    // colossus 禁闪避 + 40% 减伤：30×(1−0.40)=18（若闪避生效则 hp 不减）
    const lost = c.takeDamage(30, false, null, 1);
    expect(lost).toBeCloseTo(18);
    expect(c.health.hp).toBeLessThan(100);
  });
});

describe('P2-A 接线：Character 减伤消费 bastion/colossus/warden', () => {
  let c;
  beforeEach(() => {
    c = new Character({ team: 0, maxHp: 100 });
    c.setBus({ emit: vi.fn(), on: vi.fn() });
  });

  it('bastion+colossus+warden 叠加封顶 0.8（amount×0.2）', () => {
    const sk = new SkillTree();
    sk.branches.bastion.level = 1;
    sk.branches.colossus.level = 1;
    sk.branches.warden.level = 1;
    c._skill = sk;
    expect(c.takeDamage(100, false, null, 1)).toBeCloseTo(20);
  });

  it('bastion 单独 0.35 减伤', () => {
    const sk = new SkillTree();
    sk.branches.bastion.level = 1;
    c._skill = sk;
    expect(c.takeDamage(100, false, null, 1)).toBeCloseTo(65);
  });

  it('warden 单独 0.30 减伤', () => {
    const sk = new SkillTree();
    sk.branches.warden.level = 1;
    c._skill = sk;
    expect(c.takeDamage(100, false, null, 1)).toBeCloseTo(70);
  });
});

describe('P2-A 接线：Character 格挡穿透消费 _modPierce', () => {
  let c;
  beforeEach(() => {
    c = new Character({ team: 0, maxHp: 100 });
    c.setBus({ emit: vi.fn(), on: vi.fn() });
    c.forward.set(0, 0, 1);
    c._blocking = true;
  });

  it('无 _modPierce 正面格挡减伤至 30%', () => {
    const atk = { position: { x: 0, z: 2 }, weapon: { armorPierce: false }, _hurt: 0 };
    expect(c.takeDamage(100, false, atk, 1)).toBeCloseTo(30);
  });

  it('attacker._modPierce=true 绕过格挡全额受击', () => {
    const atk = { position: { x: 0, z: 2 }, weapon: { armorPierce: false }, _hurt: 0, _modPierce: true };
    expect(c.takeDamage(100, false, atk, 1)).toBe(100);
  });
});

describe('P2-A 接线：canBeExecuted 消费 branchWarlordExec', () => {
  it('无 warlord 时 ratio 0.25 不可执行（阈值 0.20）', () => {
    const c = new Character({ team: 0, maxHp: 100 });
    c.setBus({ emit: vi.fn(), on: vi.fn() });
    c.health.hp = 25;
    expect(c.canBeExecuted).toBe(false);
  });

  it('warlord Lv1 阈值升至 0.30，ratio 0.25 可执行', () => {
    const c = new Character({ team: 0, maxHp: 100 });
    c.setBus({ emit: vi.fn(), on: vi.fn() });
    const sk = new SkillTree();
    sk.branches.warlord.level = 1;
    c._skill = sk;
    c.health.hp = 25;
    expect(c.canBeExecuted).toBe(true);
  });
});

describe('P2-A 接线：setSkill 消费 keystoneOverloadStamina', () => {
  it('overload Lv1 耐力上限减半', () => {
    const c = new Character({ team: 0, maxStamina: 100 });
    c.setBus({ emit: vi.fn(), on: vi.fn() });
    const sk = new SkillTree();
    sk.branches.overload.level = 1;
    c.setSkill(sk);
    expect(c.stamina.max).toBeCloseTo(50);
    expect(c.stamina.cur).toBeCloseTo(50);
  });

  it('无 overload 耐力不变', () => {
    const c = new Character({ team: 0, maxStamina: 100 });
    c.setBus({ emit: vi.fn(), on: vi.fn() });
    c.setSkill(new SkillTree());
    expect(c.stamina.max).toBe(100);
  });
});

// ── CombatSystem 接线 ──

function mockChar(team, x = 0, z = 0, opts = {}) {
  return {
    alive: true, team,
    position: { x, y: 0, z, distanceTo() { return 1; }, clone() { return { ...this, setY() { return this; } }; }, copy() { return this; } },
    forward: { x: 0, z: 1 },
    weapon: { weaponClass: 'SWORD', damage: 10, range: 5, arc: Math.PI, comboDamage: null, comboKnock: null, comboLaunch: null, affixes: [null, null], name: '剑' },
    health: { alive: true, hp: 100, maxHp: 100 },
    takeDamage: vi.fn(),
    _curVel: { addScaledVector: vi.fn() },
    vy: 0, _launchRot: 0, _hurt: 0,
    ...opts,
  };
}
function mkCS() {
  const cs = new CombatSystem({ add() {}, remove() {} }, { emit: vi.fn(), on: vi.fn() });
  vi.spyOn(cs, '_emitHit').mockImplementation(() => {});
  return cs;
}

describe('P2-A 接线：resolveMelee 消费 branchWarlordDmg + duoWarbringerDmg', () => {
  it('warlord+warbringer 伤害 ×1.70', () => {
    const cs = mkCS();
    const sk = new SkillTree();
    sk.branches.warlord.level = 1;
    sk.branches.warbringer.level = 1;
    const attacker = mockChar(0, 0, 0, { _skill: sk, weaponIdx: 0 });
    const victim = mockChar(1, 0, 2);
    victim.forward = { x: 0, z: -1 };
    cs.characters = [attacker, victim];
    vi.spyOn(Math, 'random').mockReturnValue(1);
    cs.resolveMelee(attacker, attacker.weapon, 0, 0);
    const dmg = victim.takeDamage.mock.calls[0][0];
    expect(dmg).toBeCloseTo(17);
  });

  it('无 warlord/warbringer 时基础伤害 10', () => {
    const cs = mkCS();
    const attacker = mockChar(0, 0, 0, { _skill: new SkillTree(), weaponIdx: 0 });
    const victim = mockChar(1, 0, 2);
    victim.forward = { x: 0, z: -1 };
    cs.characters = [attacker, victim];
    vi.spyOn(Math, 'random').mockReturnValue(1);
    cs.resolveMelee(attacker, attacker.weapon, 0, 0);
    const dmg = victim.takeDamage.mock.calls[0][0];
    expect(dmg).toBeCloseTo(10);
  });
});

describe('P2-A 接线：resolveMelee 消费 duoWarbringerCrit', () => {
  it('warbringer 暴击 ×2（含 +30% 伤害）', () => {
    const cs = mkCS();
    const sk = new SkillTree();
    sk.branches.warbringer.level = 1;
    const attacker = mockChar(0, 0, 0, { _skill: sk, weaponIdx: 0 });
    const victim = mockChar(1, 0, 2);
    victim.forward = { x: 0, z: -1 };
    cs.characters = [attacker, victim];
    vi.spyOn(Math, 'random').mockReturnValue(0);
    cs.resolveMelee(attacker, attacker.weapon, 0, 0);
    const dmg = victim.takeDamage.mock.calls[0][0];
    // 10 × (1+0.30) ×2(暴击) = 26
    expect(dmg).toBeCloseTo(26);
  });
});

describe('P2-A 接线：_affixLeech 消费 branchDruidLifesteal', () => {
  it('druid Lv1 吸血 8%', () => {
    const cs = mkCS();
    const sk = new SkillTree();
    sk.branches.druid.level = 1;
    const attacker = { health: { hp: 50, maxHp: 100 }, _skill: sk };
    cs._affixLeech(attacker, 100);
    expect(attacker.health.hp).toBeCloseTo(58);
  });

  it('无 druid 无吸血', () => {
    const cs = mkCS();
    const attacker = { health: { hp: 50, maxHp: 100 }, _skill: new SkillTree() };
    cs._affixLeech(attacker, 100);
    expect(attacker.health.hp).toBe(50);
  });
});

describe('P2-A 接线：resolveMelee 武器形态改造消费', () => {
  it('pierce mod 设 _modPierce=true', () => {
    const cs = mkCS();
    const sk = new SkillTree();
    sk.weaponMods[0] = 'pierce';
    const attacker = mockChar(0, 0, 0, { _skill: sk, weaponIdx: 0 });
    cs.characters = [attacker];
    cs.resolveMelee(attacker, attacker.weapon, 0, 0);
    expect(attacker._modPierce).toBe(true);
  });

  it('range mod 不设 _modPierce', () => {
    const cs = mkCS();
    const sk = new SkillTree();
    sk.weaponMods[0] = 'range';
    const attacker = mockChar(0, 0, 0, { _skill: sk, weaponIdx: 0 });
    cs.characters = [attacker];
    cs.resolveMelee(attacker, attacker.weapon, 0, 0);
    expect(attacker._modPierce).toBe(false);
  });

  it('range mod 扩展攻击范围命中远距目标', () => {
    const cs = mkCS();
    const sk = new SkillTree();
    sk.weaponMods[0] = 'range';
    const attacker = mockChar(0, 0, 0, { _skill: sk, weaponIdx: 0 });
    const victim = mockChar(1, 0, 5.5);
    victim.forward = { x: 0, z: -1 };
    cs.characters = [attacker, victim];
    vi.spyOn(Math, 'random').mockReturnValue(1);
    cs.resolveMelee(attacker, attacker.weapon, 0, 0);
    expect(victim.takeDamage).toHaveBeenCalled();
  });

  it('无 range mod 时远距目标不被命中', () => {
    const cs = mkCS();
    const attacker = mockChar(0, 0, 0, { _skill: new SkillTree(), weaponIdx: 0 });
    const victim = mockChar(1, 0, 5.5);
    victim.forward = { x: 0, z: -1 };
    cs.characters = [attacker, victim];
    vi.spyOn(Math, 'random').mockReturnValue(1);
    cs.resolveMelee(attacker, attacker.weapon, 0, 0);
    expect(victim.takeDamage).not.toHaveBeenCalled();
  });

  it('knock mod 击退 ×1.5', () => {
    const cs = mkCS();
    const sk = new SkillTree();
    sk.weaponMods[0] = 'knock';
    const attacker = mockChar(0, 0, 0, { _skill: sk, weaponIdx: 0 });
    const victim = mockChar(1, 0, 2);
    victim.forward = { x: 0, z: -1 };
    victim.takeDamage = vi.fn(() => 10);
    cs.characters = [attacker, victim];
    vi.spyOn(Math, 'random').mockReturnValue(1);
    cs.resolveMelee(attacker, attacker.weapon, 0, 0);
    const mag = victim._curVel.addScaledVector.mock.calls[0][1];
    expect(mag).toBeCloseTo(3.75);
  });

  it('无 knock mod 击退基准 2.5', () => {
    const cs = mkCS();
    const attacker = mockChar(0, 0, 0, { _skill: new SkillTree(), weaponIdx: 0 });
    const victim = mockChar(1, 0, 2);
    victim.forward = { x: 0, z: -1 };
    victim.takeDamage = vi.fn(() => 10);
    cs.characters = [attacker, victim];
    vi.spyOn(Math, 'random').mockReturnValue(1);
    cs.resolveMelee(attacker, attacker.weapon, 0, 0);
    const mag = victim._curVel.addScaledVector.mock.calls[0][1];
    expect(mag).toBeCloseTo(2.5);
  });
});
