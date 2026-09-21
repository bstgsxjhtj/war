// 存档编排：快照采集/重置/启动恢复/定时与卸载存档（自 main_entry 拆出，只搬代码不改行为）
import { States } from '../core/GameState.js';

const LEGACY_KEYS = ['campaign_cleared', 'progression_v1', 'skilltree_v1', 'achievements', 'affixes', 'daily_challenge', 'weapon_skins', 'tutorial_done', 'settings', 'audio_volume'];

export class SaveOrchestrator {
  constructor(deps) {
    this.deps = deps;
    this.playTimeSec = 0;
  }

  capture() {
    const { campaign, progression, skills, getMode, getPlayer } = this.deps;
    const mode = getMode();
    const player = getPlayer();
    const slots = {};
    if (player && player.weapons) {
      for (const w of player.weapons) {
        if (w && w.affixes) slots[w.weaponClass] = w.affixes.map(a => a ? { type: a.type, tier: a.tier } : null);
      }
    }
    return {
      mode: mode.name,
      stage: campaign.stage,
      campaignCompleted: campaign.cleared >= campaign.maxStages,
      score: progression.score,
      kills: progression.kills,
      bestGrade: progression.getStats().bestGrade,
      affixSlots: slots,
      skillPoints: skills.points,
      skillTree: skills.serialize(),
      playTime: this.playTimeSec
    };
  }

  saveNow() {
    this.deps.saveManager.save(this.capture());
  }

  reset() {
    const { saveManager, progression, campaign, skills, affixes, daily, skins, achievements, hud, getPlayer } = this.deps;
    saveManager.reset();
    progression.reset();
    campaign.reset(); campaign.cleared = 0; campaign._saveCleared();
    skills.reset(); skills.points = 0; skills._save();
    affixes.inventory = []; affixes._save();
    daily._data = { date: '', challenges: [], progress: {}, claimed: false }; daily._save();
    skins._data = { unlocked: { default: true }, equipped: { 0: 'default', 1: 'default', 2: 'default', 3: 'default' } }; skins._save();
    achievements._data = {}; achievements._save();
    for (const k of LEGACY_KEYS) { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } }
    this.playTimeSec = 0;
    const player = getPlayer();
    if (player && player.weapons) for (const w of player.weapons) w.affixes = [null, null];
    hud.flash('进度已重置');
  }

  applyOnBoot() {
    const { saveManager, campaign, progression, skills } = this.deps;
    const _saved = saveManager.load();
    if (_saved) {
      if (_saved.mode === '战役' && typeof _saved.stage === 'number') campaign.stage = Math.min(_saved.stage, campaign.maxStages - 1);
      progression.restore(_saved);
      if (_saved.skillTree) { skills.restore(_saved.skillTree); } else if (typeof _saved.skillPoints === 'number') { skills.points = _saved.skillPoints; }
      this.playTimeSec = _saved.playTime || 0;
    }
  }

  tickPlayTime() {
    if (this.deps.state.current === States.PLAYING) this.playTimeSec++;
  }

  startTimers() {
    setInterval(() => this.tickPlayTime(), 1000);
    setInterval(() => { if (this.deps.state.current === States.PLAYING) this.saveNow(); }, 60000);
    window.addEventListener('beforeunload', () => { try { this.saveNow(); } catch (e) { /* ignore */ } });
  }
}
