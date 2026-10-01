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

describe('HUD 处决横幅', () => {
  it('flashExecute 显示横幅并设衰减', () => {
    const hud = mkHud();
    hud.flashExecute();
    expect(hud._execute.textContent).toContain('处决');
    expect(parseFloat(hud._execute.style.opacity)).toBeGreaterThan(0);
    expect(hud._execBannerTimer).toBeGreaterThan(0);
  });

  it('update 衰减后归零', () => {
    const hud = mkHud();
    hud.flashExecute();
    hud.update(hud._execBannerTimer);
    expect(hud._execBannerTimer).toBe(0);
    expect(parseFloat(hud._execute.style.opacity)).toBe(0);
  });

  it('COMBAT_EXECUTE 触发处决横幅（玩家为执行者）', () => {
    const hud = mkHud();
    const handler = hud.bus.on.mock.calls.find(c => c[0] === EV.COMBAT_EXECUTE)[1];
    handler({ char: { isLocal: true } });
    expect(hud._execBannerTimer).toBeGreaterThan(0);
  });

  it('COMBAT_EXECUTE 非玩家执行者不触发', () => {
    const hud = mkHud();
    const handler = hud.bus.on.mock.calls.find(c => c[0] === EV.COMBAT_EXECUTE)[1];
    handler({ char: { isLocal: false } });
    expect(hud._execBannerTimer).toBe(0);
  });
});

describe('HUD 精简与信息补全', () => {
  it('已移除与 MiniMap 重叠的内置雷达', () => {
    const hud = mkHud();
    expect(hud.el.querySelector('#radar')).toBeNull();
    expect(hud._radar).toBeUndefined();
  });

  it('updateBuffs 为限时 buff 绘制倒计时条', () => {
    const hud = mkHud();
    hud.updateBuffs({
      _perfectBuff: 1.5, // /2s = 75%
      _killstreak: 4,
      _killstreakTimer: 2, // /5s = 40%
      killstreakBuffs: () => ({ dmgMul: 1.25, cdMul: 1, lifesteal: 0 }),
    });
    const html = hud._buffbar.innerHTML;
    expect(html).toContain('75%');
    expect(html).toContain('40%');
  });

  it('updateBuffs 无常驻/限时 buff 时隐藏', () => {
    const hud = mkHud();
    hud.updateBuffs({ _perfectBuff: 0, _killstreak: 0, killstreakBuffs: () => ({ dmgMul: 1, cdMul: 1, lifesteal: 0 }) });
    expect(hud._buffbar.style.display).toBe('none');
  });

  it('setBossPhase 渲染阶段指示点（普通 Boss 三阶段）', () => {
    const hud = mkHud();
    hud.setBossPhase(2);
    expect(hud._bossPips.textContent).toBe('●●○');
  });

  it('setBossPhase 迷你 Boss 仅两阶段', () => {
    const hud = mkHud();
    hud.setBossPhase(1, true);
    expect(hud._bossPips.textContent).toBe('●○');
  });

  it('setBossPhase 阶段数夹紧到范围', () => {
    const hud = mkHud();
    hud.setBossPhase(9);
    expect(hud._bossPips.textContent).toBe('●●●');
  });
});

describe('HUD 完美格挡闪屏', () => {
  it('flashParry 显示金色弹反横幅与全屏金闪并设衰减', () => {
    const hud = mkHud();
    hud.flashParry();
    expect(hud._parryflash.textContent).toContain('弹反');
    expect(parseFloat(hud._parryflash.style.opacity)).toBeGreaterThan(0);
    expect(parseFloat(hud._parryglow.style.opacity)).toBeGreaterThan(0);
    expect(hud._parryTimer).toBeGreaterThan(0);
  });

  it('update 衰减后横幅与金闪归零', () => {
    const hud = mkHud();
    hud.flashParry();
    hud.update(hud._parryTimer);
    expect(hud._parryTimer).toBe(0);
    expect(parseFloat(hud._parryflash.style.opacity)).toBe(0);
    expect(parseFloat(hud._parryglow.style.opacity)).toBe(0);
  });

  it('FX_PERFECTBLOCK 玩家触发 flashParry', () => {
    const hud = mkHud();
    const handler = hud.bus.on.mock.calls.find(c => c[0] === EV.FX_PERFECTBLOCK)[1];
    handler({ char: { isLocal: true } });
    expect(hud._parryTimer).toBeGreaterThan(0);
  });

  it('FX_PERFECTBLOCK 非玩家不触发', () => {
    const hud = mkHud();
    const handler = hud.bus.on.mock.calls.find(c => c[0] === EV.FX_PERFECTBLOCK)[1];
    handler({ char: { isLocal: false } });
    expect(hud._parryTimer).toBe(0);
  });
});

describe('HUD 减少动效', () => {
  it('开启后命中暗角与连击脉冲不再闪烁', () => {
    const hud = mkHud();
    hud.setReducedMotion(true);
    hud.flashHitVignette();
    hud.flashComboPulse(3);
    expect(hud._hitVigTimer).toBe(0);
    expect(hud._comboPulseTimer).toBe(0);
    expect(hud._hitvignette.style.opacity).toBe('0');
    expect(hud._combopulse.style.opacity).toBe('0');
  });

  it('开启后弹反闪光不再触发', () => {
    const hud = mkHud();
    hud.setReducedMotion(true);
    hud.flashParry();
    expect(hud._parryTimer).toBe(0);
    expect(hud._parryglow.style.opacity).toBe('0');
  });

  it('开启后低血量不再脉冲动画', () => {
    const hud = mkHud();
    hud.setReducedMotion(true);
    hud.setLowHP(true);
    expect(hud._lowhp.style.display).toBe('block');
    expect(hud._lowhp.style.animation).toBe('none');
  });

  it('关闭时保持原有闪烁行为', () => {
    const hud = mkHud();
    hud.flashHitVignette();
    expect(hud._hitvignette.style.opacity).toBe('0.6');
  });
});

describe('HUD F4 性能面板', () => {
  it('默认关闭且面板不可见', () => {
    const hud = mkHud();
    expect(hud._perfVisible).toBe(false);
    expect(hud._perfEl.style.display).toBe('none');
  });

  it('togglePerf 切换可见性', () => {
    const hud = mkHud();
    hud.togglePerf();
    expect(hud._perfVisible).toBe(true);
    expect(hud._perfEl.style.display).toBe('block');
    hud.togglePerf();
    expect(hud._perfVisible).toBe(false);
    expect(hud._perfEl.style.display).toBe('none');
    expect(hud._perfEl.textContent).toBe('');
  });

  it('关闭时 updatePerf 仅采样 FPS 不写 DOM', () => {
    const hud = mkHud();
    hud.updatePerf(1 / 60, { calls: 100, triangles: 5000, quality: 'high', enemies: 5 });
    expect(hud._perfFps).toBeGreaterThan(0);
    expect(hud._perfEl.textContent).toBe('');
  });

  it('开启并跨过节流后刷新 FPS/drawcall/档位 文案', () => {
    const hud = mkHud();
    hud.togglePerf();
    hud.updatePerf(1 / 60, { calls: 120, triangles: 8000, quality: 'mid', enemies: 3 });
    hud.updatePerf(1 / 60, { calls: 120, triangles: 8000, quality: 'mid', enemies: 3 });
    const txt = hud._perfEl.textContent;
    expect(txt).toContain('FPS');
    expect(txt).toContain('Draw 120');
    expect(txt).toContain('档位 中');
    expect(txt).toContain('单位 3');
  });

  it('F4 键触发 togglePerf', () => {
    const hud = mkHud();
    const ev = new KeyboardEvent('keydown', { key: 'F4' });
    document.dispatchEvent(ev);
    expect(hud._perfVisible).toBe(true);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'F4' }));
    expect(hud._perfVisible).toBe(false);
  });
});
