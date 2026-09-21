// 存档编排：快照采集/重置/启动恢复/定时与卸载存档（自 main_entry 拆出，只搬代码不改行为）
import { States } from '../core/GameState.js';

const LEGACY_KEYS = ['campaign_cleared', 'progression_v1', 'skilltree_v1', 'achievements', 'affixes', 'daily_challenge', 'weapon_skins', 'tutorial_done', 'settings', 'audio_volume'];

export class SaveOrchestrator {
  constructor(deps) {
    this.deps = deps;
    this.playTimeSec = 0;
  }

  capture() {
    const { campaign, progression, skills, affixes, achievements, daily, skins, getMode, getPlayer } = this.deps;
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
      campaignCleared: campaign.cleared,
      progressionFull: progression.serialize(),
      score: progression.score,
      kills: progression.kills,
      bestGrade: progression.getStats().bestGrade,
      affixSlots: slots,
      affixInventory: affixes.serialize(),
      skillPoints: skills.points,
      skillTree: skills.serialize(),
      achievements: achievements.serialize(),
      daily: daily.serialize(),
      skins: skins.serialize(),
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
    campaign.reset(); campaign.cleared = 0;
    skills.reset(); skills.points = 0; skills._save();
    affixes.restore([]);
    daily.restore({ date: '', challenges: [], progress: {}, claimed: false });
    skins.restore({ unlocked: { default: true }, equipped: { 0: 'default', 1: 'default', 2: 'default', 3: 'default' } });
    achievements.restore({});
    for (const k of LEGACY_KEYS) { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } }
    this.playTimeSec = 0;
    const player = getPlayer();
    if (player && player.weapons) for (const w of player.weapons) w.affixes = [null, null];
    hud.flash('进度已重置');
  }

  applyOnBoot() {
    const { saveManager, campaign, progression, skills, affixes, achievements, daily, skins } = this.deps;
    const _saved = saveManager.load();
    if (_saved) {
      if (_saved.mode === '战役' && typeof _saved.stage === 'number') campaign.stage = Math.min(_saved.stage, campaign.maxStages - 1);
      if (typeof _saved.campaignCleared === 'number') campaign.cleared = _saved.campaignCleared;
      else if (_saved.campaignCompleted) campaign.cleared = campaign.maxStages;
      if (_saved.progressionFull) progression.restore(_saved.progressionFull);
      else progression.restore(_saved);
      if (_saved.skillTree) { skills.restore(_saved.skillTree); } else if (typeof _saved.skillPoints === 'number') { skills.points = _saved.skillPoints; }
      if (Array.isArray(_saved.affixInventory)) affixes.restore(_saved.affixInventory);
      if (_saved.achievements && typeof _saved.achievements === 'object') achievements.restore(_saved.achievements);
      if (_saved.daily && typeof _saved.daily === 'object') daily.restore(_saved.daily);
      if (_saved.skins && typeof _saved.skins === 'object') skins.restore(_saved.skins);
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
