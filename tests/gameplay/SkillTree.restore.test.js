import { SkillTree } from '../../src/gameplay/SkillTree.js';
import { describe, it, expect, beforeEach } from 'vitest';

describe('SkillTree.restore', () => {
  beforeEach(() => { localStorage.clear(); });

  it('恢复 points/skills/weaponLevel/skillOrder/weaponOrder', () => {
    const st = new SkillTree();
    st.points = 1;
    st.skills.power.level = 2;
    st.weaponLevel[0] = 3;
    const snap = st.serialize();

    const st2 = new SkillTree();
    st2.restore(snap);
    expect(st2.points).toBe(1);
    expect(st2.skills.power.level).toBe(2);
    expect(st2.weaponLevel[0]).toBe(3);
    expect(st2.skillOrder).toEqual(['power', 'vigor', 'agility', 'mastery']);
    expect(st2.weaponOrder).toEqual([0, 1, 2, 3]);
  });

  it('空 data 不破坏默认值', () => {
    const st = new SkillTree();
    st.restore({});
    expect(st.points).toBe(0);
    expect(st.skills.power.level).toBe(0);
    expect(st.weaponLevel[0]).toBe(1);
  });

  it('恢复技能等级不越界（钳制 max）', () => {
    const st = new SkillTree();
    st.restore({ points: 0, skills: { power: 99 } });
    expect(st.skills.power.level).toBe(3);
  });
});
