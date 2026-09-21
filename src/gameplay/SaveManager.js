// 统一存档：savegame_v1 + 版本迁移 + 旧键合并（成就/设置/皮肤/音量保留各自键）
export class SaveManager {
  constructor() {
    this._key = 'savegame_v1';
    this._data = this._load();
  }

  serialize(capture = {}) {
    return {
      version: 1,
      savedAt: Date.now(),
      mode: capture.mode ?? null,
      stage: capture.stage ?? 0,
      score: capture.score ?? 0,
      kills: capture.kills ?? 0,
      bestGrade: capture.bestGrade ?? null,
      campaignCompleted: !!capture.campaignCompleted,
      skillTree: capture.skillTree || null,
      affixSlots: capture.affixSlots ?? {},
      skillPoints: capture.skillPoints ?? 0,
      playTime: capture.playTime ?? 0
    };
  }

  save(capture = {}) {
    this._data = this.serialize(capture);
    this._persist();
    return this._data;
  }

  load() { return this._data; }

  reset() {
    try { localStorage.removeItem(this._key); } catch (e) { /* ignore */ }
    this._data = null;
  }

  _defaults() {
    return { version: 1, savedAt: null, mode: null, stage: 0, score: 0, kills: 0, bestGrade: null, campaignCompleted: false, skillTree: null, affixSlots: {}, skillPoints: 0, playTime: 0 };
  }

  _load() {
    try {
      const raw = localStorage.getItem(this._key);
      if (raw) {
        const d = JSON.parse(raw);
        if (d && typeof d === 'object') {
          if (d.version === 1) return d;
          const merged = { ...this._defaults(), ...d, version: 1 };
          this._mergeOldKeys(merged);
          return merged;
        }
      }
      return this._migrateOld();
    } catch (e) { return null; }
  }

  // 旧键迁移：campaign_cleared→stage、progression_v1→score/kills/bestGrade、skilltree_v1→skillPoints
  _migrateOld() {
    const out = this._defaults();
    let any = false;
    try {
      const cleared = JSON.parse(localStorage.getItem('campaign_cleared') || '0');
      if (Number.isFinite(cleared) && cleared > 0) { out.stage = Math.min(cleared, 9); any = true; }
    } catch (e) { /* ignore */ }
    try {
      const p = JSON.parse(localStorage.getItem('progression_v1'));
      if (p && typeof p === 'object') {
        if (typeof p.score === 'number') { out.score = p.score; any = true; }
        if (typeof p.kills === 'number') { out.kills = p.kills; any = true; }
        if (p.bestGrade) { out.bestGrade = p.bestGrade; any = true; }
      }
    } catch (e) { /* ignore */ }
    try {
      const s = JSON.parse(localStorage.getItem('skilltree_v1'));
      if (s && typeof s === 'object') {
        if (typeof s.points === 'number') { out.skillPoints = s.points; any = true; }
        out.skillTree = { points: s.points || 0, skills: s.skills || {}, weaponLevel: s.weaponLevel || { 0: 1, 1: 1, 2: 1, 3: 1 }, skillOrder: s.skillOrder || ['power', 'vigor', 'agility', 'mastery'], weaponOrder: s.weaponOrder || [0, 1, 2, 3] };
        any = true;
      }
    } catch (e) { /* ignore */ }
    return any ? out : null;
  }

  _mergeOldKeys(merged) {
    const old = this._migrateOld();
    if (!old) return;
    if (typeof merged.stage !== 'number' || merged.stage <= 0) merged.stage = old.stage;
    if (!merged.score) merged.score = old.score;
    if (!merged.kills) merged.kills = old.kills;
    if (!merged.bestGrade) merged.bestGrade = old.bestGrade;
    if (!merged.skillPoints) merged.skillPoints = old.skillPoints;
  }

  _persist() {
    try { localStorage.setItem(this._key, JSON.stringify(this._data)); } catch (e) { /* ignore */ }
  }
}
