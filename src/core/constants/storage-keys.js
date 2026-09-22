// localStorage 键常量：登记表见 docs/engineering-context/05-conventions.md §2
export const LS = {
  SAVEGAME: 'savegame_v1',
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
  AUDIO_VOLUME: 'audio_volume',
  TUTORIAL_DONE: 'tutorial_done',
  SKILLTREE_PROFILE_PREFIX: 'skilltree_profile_'
};
