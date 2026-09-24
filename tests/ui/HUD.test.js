// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HUD } from '../../src/ui/HUD.js';
import { EV } from '../../src/core/constants/events.js';

beforeEach(() => {
  // jsdom canvas getContext 返回 null，mock 一个最小 2D 上下文
  HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
    clearRect() {}, beginPath() {}, arc() {}, fill() {}, moveTo() {}, lineTo() {}, closePath() {},
    set fillStyle(v) {}
  }));
  document.body.innerHTML = '';
});

function mkHud() {
  return new HUD({ on: vi.fn(() => () => {}), emit: vi.fn() });
}

describe('HUD', () => {
  it('setHealth 按比例写宽度', () => {
    const hud = mkHud();
    hud.setHealth({ health: { ratio: 0.5 } });
    expect(hud._hp.style.width).toBe('50%');
  });

  it('setHealth 负值夹紧为 0', () => {
    const hud = mkHud();
    hud.setHealth({ health: { ratio: -0.3 } });
    expect(hud._hp.style.width).toBe('0%');
  });

  it('setScore/setRound/setMode 写文案', () => {
    const hud = mkHud();
    hud.setScore(2, 3);
    expect(hud._score.textContent).toBe('蓝方 2  |  3 红方');
    hud.setRound(1, 0, 3);
    expect(hud._round.textContent).toContain('1 - 0');
    hud.setMode('死斗');
    expect(hud._modeName.textContent).toBe('模式：死斗');
    expect(hud._dom.style.display).toBe('none');
    hud.setMode('据点');
    expect(hud._dom.style.display).toBe('block');
  });

  it('setMode 带关卡信息', () => {
    const hud = mkHud();
    hud.setMode('战役', { name: '第一关', index: 0, total: 10 });
    expect(hud._modeName.textContent).toContain('第一关');
    expect(hud._modeName.textContent).toContain('1/10');
  });

  it('flash/clearHint/flashEnd 锁定语义', () => {
    const hud = mkHud();
    hud.flash('提示');
    expect(hud._hint.textContent).toBe('提示');
    hud.clearHint();
    expect(hud._hint.textContent).toBe('');
    hud.flashEnd('结局');
    hud.clearHint();
    expect(hud._hint.textContent).toBe('结局');
  });

  it('setSkillCooldowns 显示剩余秒数', () => {
    const hud = mkHud();
    const ws = { cdRemaining: (i) => (i === 0 ? 2.3 : 0) };
    hud.setSkillCooldowns(ws);
    expect(hud._skillEls[0].cd.style.display).toBe('flex');
    expect(hud._skillEls[0].cd.textContent).toBe('3');
    expect(hud._skillEls[1].cd.style.display).toBe('none');
  });

  it('setHealth 相同值不重复写 DOM（脏检查）', () => {
    const hud = mkHud();
    const c = { health: { ratio: 0.5 } };
    hud.setHealth(c);
    const base = hud._writeCount;
    hud.setHealth(c);
    hud.setHealth(c);
    expect(hud._writeCount).toBe(base);
    hud.setHealth({ health: { ratio: 0.6 } });
    expect(hud._writeCount).toBe(base + 1);
  });

  it('setWeatherForecast 显示和隐藏天气预告', () => {
    const hud = mkHud();
    hud.setWeatherForecast('10s 后 雨');
    expect(hud._wforecast.textContent).toBe('10s 后 雨');
    expect(hud._wforecast.style.display).toBe('block');
    hud.setWeatherForecast(null);
    expect(hud._wforecast.style.display).toBe('none');
  });

  it('setWave 显示波数和历史最高', () => {
    const hud = mkHud();
    hud.setWave(5, 10, false);
    expect(hud._round.textContent).toContain('第 5 波');
    expect(hud._round.textContent).toContain('最高 10 波');
    hud.setWave(3, 0, true);
    expect(hud._round.textContent).toBe('第 3 波');
  });

  it('updateBuffs 显示完美闪避 + 连杀 + 运行加成', () => {
    const hud = mkHud();
    hud.updateBuffs({
      _perfectBuff: 2,
      _killstreak: 5,
      killstreakBuffs: () => ({ dmgMul: 1.2, cdMul: 0.8, lifesteal: 0 }),
      _runDmgMul: 1.15,
      _runLifesteal: 0.1,
    });
    const txt = hud._buffbar.textContent;
    expect(txt).toContain('完美闪避');
    expect(txt).toContain('连杀');
    expect(txt).toContain('锋利');
    expect(txt).toContain('吸血');
  });

  it('updateBuffs 无 buff 时隐藏', () => {
    const hud = mkHud();
    hud.updateBuffs({
      _perfectBuff: 0,
      _killstreak: 0,
      killstreakBuffs: () => ({ dmgMul: 1, cdMul: 1, lifesteal: 0 }),
    });
    expect(hud._buffbar.style.display).toBe('none');
  });

  it('showBoss 显示 Boss 名和血条', () => {
    const hud = mkHud();
    hud.showBoss('战将');
    expect(hud._bossbar.style.display).toBe('flex');
    expect(hud._bossbar.textContent).toContain('战将');
  });

  it('setBossHP 按比例写宽度', () => {
    const hud = mkHud();
    hud.showBoss('战将');
    hud.setBossHP(0.5);
    expect(hud._bossFill.style.width).toBe('50%');
  });

  it('hideBoss 隐藏血条', () => {
    const hud = mkHud();
    hud.showBoss('战将');
    hud.hideBoss();
    expect(hud._bossbar.style.display).toBe('none');
  });

  it('setLowHP true 显示红色脉冲层', () => {
    const hud = mkHud();
    hud.setLowHP(true);
    expect(hud._lowhp.style.display).toBe('block');
  });

  it('setLowHP false 隐藏', () => {
    const hud = mkHud();
    hud.setLowHP(true);
    hud.setLowHP(false);
    expect(hud._lowhp.style.display).toBe('none');
  });
});

describe('HUD 受击 vignette', () => {
  it('flashHitVignette 点亮红色 vignette 并设衰减计时', () => {
    const hud = mkHud();
    hud.flashHitVignette();
    expect(parseFloat(hud._hitvignette.style.opacity)).toBeGreaterThan(0);
    expect(hud._hitVigTimer).toBeGreaterThan(0);
  });

  it('update 在衰减时长后把 opacity 归零', () => {
    const hud = mkHud();
    hud.flashHitVignette();
    const dur = hud._hitVigTimer;
    hud.update(dur);
    expect(hud._hitVigTimer).toBe(0);
    expect(parseFloat(hud._hitvignette.style.opacity)).toBe(0);
  });

  it('COMBAT_HIT victim.isLocal 触发 vignette', () => {
    const hud = mkHud();
    const handler = hud.bus.on.mock.calls.find(c => c[0] === EV.COMBAT_HIT)[1];
    handler({ victim: { isLocal: true } });
    expect(hud._hitVigTimer).toBeGreaterThan(0);
    expect(parseFloat(hud._hitvignette.style.opacity)).toBeGreaterThan(0);
  });

  it('COMBAT_HIT 非 isLocal 不触发 vignette', () => {
    const hud = mkHud();
    const handler = hud.bus.on.mock.calls.find(c => c[0] === EV.COMBAT_HIT)[1];
    handler({ victim: { isLocal: false } });
    expect(hud._hitVigTimer).toBe(0);
  });
});

describe('HUD 连击脉冲', () => {
  it('flashComboPulse 点亮金色脉冲并设衰减', () => {
    const hud = mkHud();
    hud.flashComboPulse(2);
    expect(parseFloat(hud._combopulse.style.opacity)).toBeGreaterThan(0);
    expect(hud._comboPulseTimer).toBeGreaterThan(0);
  });

  it('update 衰减后归零', () => {
    const hud = mkHud();
    hud.flashComboPulse(1);
    hud.update(hud._comboPulseTimer);
    expect(hud._comboPulseTimer).toBe(0);
    expect(parseFloat(hud._combopulse.style.opacity)).toBe(0);
  });

  it('COMBO_TIER 触发脉冲', () => {
    const hud = mkHud();
    const handler = hud.bus.on.mock.calls.find(c => c[0] === EV.COMBO_TIER)[1];
    handler({ tier: 2, count: 5 });
    expect(hud._comboPulseTimer).toBeGreaterThan(0);
    expect(parseFloat(hud._combopulse.style.opacity)).toBeGreaterThan(0);
  });
});

describe('HUD Boss 阶段横幅', () => {
  it('flashBossPhase 显示横幅并设衰减', () => {
    const hud = mkHud();
    hud.flashBossPhase(2);
    expect(parseFloat(hud._bossphase.style.opacity)).toBeGreaterThan(0);
    expect(hud._bossPhaseTimer).toBeGreaterThan(0);
  });

  it('update 衰减后归零', () => {
    const hud = mkHud();
    hud.flashBossPhase(3);
    hud.update(hud._bossPhaseTimer);
    expect(hud._bossPhaseTimer).toBe(0);
    expect(parseFloat(hud._bossphase.style.opacity)).toBe(0);
  });

  it('HUD_BOSSPHASE 触发横幅', () => {
    const hud = mkHud();
    const handler = hud.bus.on.mock.calls.find(c => c[0] === EV.HUD_BOSSPHASE)[1];
    handler({ phase: 3 });
    expect(hud._bossPhaseTimer).toBeGreaterThan(0);
  });
});
