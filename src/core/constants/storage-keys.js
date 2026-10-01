// localStorage 键常量：登记表见 docs/engineering-context/05-conventions.md §2
export const LS = {
  // 演示多档：每档独立键 savegame_v2_slot_{N}，键模板由 SaveManager.slotKey 生成
  SAVEGAME_SLOT_PREFIX: 'savegame_v2_slot_',
  SAVEGAME_SLOT_BACKUP_PREFIX: 'savegame_v2_slot_bak_',
  SAVE_SLOT_ACTIVE: 'savegame_active_slot',
  SAVE_SLOT_COUNT: 3,
  // 遗留单槽键（v2 数据，仅作为槽 0 的一次性迁移源读取后保留不删）
  SAVEGAME: 'savegame_v1',
  SAVEGAME_BACKUP: 'savegame_v1_bak',
  // 旧键（仅 SaveManager 启动迁移时读取后删除）
  OLD_CAMPAIGN_CLEARED: 'campaign_cleared',
  OLD_PROGRESSION: 'progression_v1',
  OLD_SKILLTREE: 'skilltree_v1',
  OLD_ACHIEVEMENTS: 'achievements',
  OLD_AFFIXES: 'affixes',
  OLD_DAILY: 'daily_challenge',
  OLD_SKINS: 'weapon_skins',
  // 独立保留
  SETTINGS: 'settings',
  KEYBINDINGS: 'keybindings',
  AUDIO_VOLUME: 'audio_volume',
  TUTORIAL_DONE: 'tutorial_done',
  SKILLTREE_PROFILE_PREFIX: 'skilltree_profile_',
  WAVE_BEST: 'wave_best'
};
