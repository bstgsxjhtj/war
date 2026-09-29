// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UpgradePicker } from '../../src/ui/UpgradePicker.js';
import { RunBuffs } from '../../src/gameplay/RunBuffs.js';

describe('UpgradePicker 3 选 1 升级（P2-7 e2e）', () => {
  let picker, runBuffs, player, bus, audio, onPick;
  beforeEach(() => {
    document.body.innerHTML = '';
    runBuffs = new RunBuffs(2);
    player = { health: { maxHp: 100, hp: 50 }, speed: 5, stamina: { max: 100, cur: 50 } };
    bus = { emit: vi.fn() };
    audio = { playSound: vi.fn() };
    onPick = vi.fn();
    picker = new UpgradePicker(runBuffs, player, bus, audio);
  });

  it('show 渲染 3 张升级卡片并显示重选按钮（剩 2）', () => {
    picker.show(onPick);
    expect(picker.visible).toBe(true);
    const cards = picker.el.querySelectorAll('.upgrade-card');
    expect(cards.length).toBe(3);
    expect(picker.el.querySelector('#upgrade-reroll')).not.toBeNull();
  });

  it('点击卡片应用升级、播放 buffSelect 音效、隐藏面板、触发回调', () => {
    picker.show(onPick);
    const cards = picker.el.querySelectorAll('.upgrade-card');
    const firstId = cards[0].getAttribute('data-id');
    const before = player.health.maxHp;
    cards[0].click();
    expect(audio.playSound).toHaveBeenCalledWith('buffSelect');
    expect(picker.visible).toBe(false);
    expect(onPick).toHaveBeenCalledTimes(1);
    expect(bus.emit).toHaveBeenCalledWith('hud.flash', expect.objectContaining({ text: expect.stringContaining('已获得') }));
    expect(runBuffs.picked).toContain(firstId);
  });

  it('重选按钮消耗 reroll 并重新渲染 3 张卡片', () => {
    picker.show(onPick);
    expect(runBuffs.rerollsLeft).toBe(2);
    const firstIds = Array.from(picker.el.querySelectorAll('.upgrade-card')).map(c => c.getAttribute('data-id'));
    picker.el.querySelector('#upgrade-reroll').click();
    expect(runBuffs.rerollsLeft).toBe(1);
    const newCards = picker.el.querySelectorAll('.upgrade-card');
    expect(newCards.length).toBe(3);
    expect(picker.visible).toBe(true);
    expect(onPick).not.toHaveBeenCalled();
  });

  it('重选用完后显示"本局重选已用完"且无重选按钮', () => {
    runBuffs.rerollsLeft = 0;
    picker.show(onPick);
    expect(picker.el.querySelector('#upgrade-reroll')).toBeNull();
    expect(picker.el.textContent).toContain('已用完');
  });

  it('选完一张卡片后 hide 清空回调，不重复触发', () => {
    picker.show(onPick);
    picker.el.querySelector('.upgrade-card').click();
    expect(onPick).toHaveBeenCalledTimes(1);
    picker.show(onPick);
    picker.hide();
    expect(onPick).toHaveBeenCalledTimes(1);
  });
});
