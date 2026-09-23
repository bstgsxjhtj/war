// 动态难度辅助：连续死亡自动降档，获胜逐步恢复
const LEVELS = ['easy', 'normal', 'hard'];

export class DifficultyAssist {
  constructor(aiManager, onNotify = () => {}, baseLevel = null) {
    this._mgr = aiManager;
    this._notify = onNotify;
    this._baseLevel = baseLevel || (LEVELS.indexOf(aiManager._level) >= 0 ? aiManager._level : 'normal');
    this._deaths = 0;
  }

  setBaseLevel(level) {
    if (LEVELS.indexOf(level) >= 0) this._baseLevel = level;
  }

  _currentLevel() {
    return LEVELS.indexOf(this._baseLevel);
  }

  _appliedLevel() {
    const assistOffset = Math.min(2, Math.floor(this._deaths / 2));
    return Math.max(0, this._currentLevel() - assistOffset);
  }

  onPlayerDeath() {
    this._deaths++;
    if (this._deaths > 0 && this._deaths % 2 === 0) {
      const before = this._mgr._level;
      this._mgr.setDifficulty(LEVELS[this._appliedLevel()]);
      if (this._mgr._level !== before) {
        const names = { easy: '简单', normal: '普通', hard: '困难' };
        this._notify('动态辅助：难度已调整为 ' + (names[this._mgr._level] || this._mgr._level));
      }
    }
  }

  onPlayerWin() {
    if (this._deaths > 0) {
      this._deaths -= 2;
      if (this._deaths < 0) this._deaths = 0;
      const before = this._mgr._level;
      this._mgr.setDifficulty(LEVELS[this._appliedLevel()]);
      if (this._mgr._level !== before) {
        const names = { easy: '简单', normal: '普通', hard: '困难' };
        this._notify('动态辅助：难度已恢复为 ' + (names[this._mgr._level] || this._mgr._level));
      }
    }
  }
}
