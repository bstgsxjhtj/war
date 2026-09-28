// 统一存档：savegame_v1 + 版本迁移 + 旧键一次性迁移后删除（游戏进度唯一事实来源）
import { LS } from '../core/constants/storage-keys.js';

const LEGACY_GAME_KEYS = [LS.OLD_CAMPAIGN_CLEARED, LS.OLD_PROGRESSION, LS.OLD_SKILLTREE, LS.OLD_ACHIEVEMENTS, LS.OLD_AFFIXES, LS.OLD_DAILY, LS.OLD_SKINS];

export const CURRENT_VERSION = 2;

const MIGRATIONS = {
  1: (data) => ({
    ...data,
    version: 2,
    campaignCleared: data.campaignCleared ?? (data.campaignCompleted ? 10 : 0)
  })
};

export function migrate(data) {
  if (!data || typeof data !== 'object') return null;
  let result = { ...data };
  let v = result.version || 0;
  while (v < CURRENT_VERSION && MIGRATIONS[v]) {
    result = MIGRATIONS[v](result);
    v = result.version;
  }
  result.version = CURRENT_VERSION;
  return result;
}

export class SaveManager {
  constructor() {
    this._key = LS.SAVEGAME;
    this._data = this._load();
  }

  serialize(capture = {}) {
    return {
      version: CURRENT_VERSION,
      savedAt: Date.now(),
      mode: capture.mode ?? null,
      stage: capture.stage ?? 0,
      campaignCompleted: !!capture.campaignCompleted,
      campaignCleared: capture.campaignCleared ?? (capture.campaignCompleted ? 10 : 0),
      progressionFull: capture.progressionFull ?? null,
      score: capture.score ?? 0,
      kills: capture.kills ?? 0,
      bestGrade: capture.bestGrade ?? null,
      skillTree: capture.skillTree || null,
      affixSlots: capture.affixSlots ?? {},
      affixInventory: capture.affixInventory ?? [],
      skillPoints: capture.skillPoints ?? 0,
      achievements: capture.achievements ?? {},
      daily: capture.daily ?? null,
      skins: capture.skins ?? null,
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
    try { localStorage.removeItem(LS.SAVEGAME_BACKUP); } catch (e) { /* ignore */ }
    this._data = null;
  }

  _defaults() {
    return {
      version: CURRENT_VERSION, savedAt: null, mode: null, stage: 0,
      campaignCompleted: false, campaignCleared: 0,
      progressionFull: null, score: 0, kills: 0, bestGrade: null,
      skillTree: null, affixSlots: {}, affixInventory: [], skillPoints: 0,
      achievements: {}, daily: null, skins: null, playTime: 0
    };
  }

  _load() {
    try {
      const raw = localStorage.getItem(this._key);
      if (raw) {
        try {
          const d = JSON.parse(raw);
          if (d && typeof d === 'object') {
            const migrated = migrate(d);
            if (migrated) {
              const merged = { ...this._defaults(), ...migrated };
              this._mergeOldKeys(merged);
              return merged;
            }
          }
          return this._migrateOld();
        } catch (parseErr) {
          return this._recoverFromBackup();
        }
      }
      return this._migrateOld();
    } catch (e) { return null; }
  }

  _recoverFromBackup() {
    try {
      const backupRaw = localStorage.getItem(LS.SAVEGAME_BACKUP);
      if (backupRaw) {
        const d = JSON.parse(backupRaw);
        if (d && typeof d === 'object') {
          const migrated = migrate(d);
          if (migrated) {
            const merged = { ...this._defaults(), ...migrated };
            try { localStorage.setItem(this._key, JSON.stringify(merged)); } catch (e) { /* ignore */ }
            return merged;
          }
        }
      }
    } catch (e) { /* ignore */ }
    return null;
  }

  // 旧键一次性迁移：campaign_cleared/progression_v1/skilltree_v1/achievements/affixes/daily_challenge/weapon_skins → savegame_v1
  _migrateOld() {
    const out = this._defaults();
    let any = false;
    try {
      const cleared = JSON.parse(localStorage.getItem(LS.OLD_CAMPAIGN_CLEARED) || '0');
      if (Number.isFinite(cleared) && cleared > 0) { out.stage = Math.min(cleared, 9); out.campaignCompleted = cleared >= 10; out.campaignCleared = cleared; any = true; }
    } catch (e) { /* ignore */ }
    try {
      const p = JSON.parse(localStorage.getItem(LS.OLD_PROGRESSION));
      if (p && typeof p === 'object') {
        out.progressionFull = p;
        if (typeof p.score === 'number') { out.score = p.score; any = true; }
        if (typeof p.kills === 'number') { out.kills = p.kills; any = true; }
        if (p.bestGrade) { out.bestGrade = p.bestGrade; any = true; }
        any = true;
      }
    } catch (e) { /* ignore */ }
    try {
      const s = JSON.parse(localStorage.getItem(LS.OLD_SKILLTREE));
      if (s && typeof s === 'object') {
        if (typeof s.points === 'number') { out.skillPoints = s.points; any = true; }
        out.skillTree = { points: s.points || 0, skills: s.skills || {}, weaponLevel: s.weaponLevel || { 0: 1, 1: 1, 2: 1, 3: 1 }, skillOrder: s.skillOrder || ['power', 'vigor', 'agility', 'mastery'], weaponOrder: s.weaponOrder || [0, 1, 2, 3] };
        any = true;
      }
    } catch (e) { /* ignore */ }
    try {
      const ach = JSON.parse(localStorage.getItem(LS.OLD_ACHIEVEMENTS));
      if (ach && typeof ach === 'object') { out.achievements = ach; any = true; }
    } catch (e) { /* ignore */ }
    try {
      const afx = JSON.parse(localStorage.getItem(LS.OLD_AFFIXES));
      if (Array.isArray(afx)) { out.affixInventory = afx; any = true; }
    } catch (e) { /* ignore */ }
    try {
      const daily = JSON.parse(localStorage.getItem(LS.OLD_DAILY));
      if (daily && typeof daily === 'object') { out.daily = daily; any = true; }
    } catch (e) { /* ignore */ }
    try {
      const skins = JSON.parse(localStorage.getItem(LS.OLD_SKINS));
      if (skins && typeof skins === 'object') { out.skins = skins; any = true; }
    } catch (e) { /* ignore */ }
    if (any) {
      for (const k of LEGACY_GAME_KEYS) { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } }
      try { localStorage.setItem(this._key, JSON.stringify(out)); } catch (e) { /* ignore */ }
      return out;
    }
    return null;
  }

  _mergeOldKeys(merged) {
    const old = this._migrateOld();
    if (!old) return;
    if (typeof merged.stage !== 'number' || merged.stage <= 0) merged.stage = old.stage;
    if (!merged.score) merged.score = old.score;
    if (!merged.kills) merged.kills = old.kills;
    if (!merged.bestGrade) merged.bestGrade = old.bestGrade;
    if (!merged.skillPoints) merged.skillPoints = old.skillPoints;
    if (!merged.progressionFull && old.progressionFull) merged.progressionFull = old.progressionFull;
    if (Object.keys(merged.achievements).length === 0 && old.achievements) merged.achievements = old.achievements;
    if (merged.affixInventory.length === 0 && old.affixInventory) merged.affixInventory = old.affixInventory;
    if (!merged.daily && old.daily) merged.daily = old.daily;
    if (!merged.skins && old.skins) merged.skins = old.skins;
  }

  _persist() {
    try {
      const prev = localStorage.getItem(this._key);
      if (prev) {
        try { JSON.parse(prev); localStorage.setItem(LS.SAVEGAME_BACKUP, prev); } catch (e) { /* skip invalid prev */ }
      }
    } catch (e) { /* ignore */ }
    try { localStorage.setItem(this._key, JSON.stringify(this._data)); } catch (e) { /* ignore */ }
  }
}
