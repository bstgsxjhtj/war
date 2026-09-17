const STAGES = [
  { name: '渡桥遭遇', mapKey: 'bridge', enemyCount: 3, objective: '全灭敌军', weather: 'clear' },
  { name: '山口伏击', mapKey: 'pass', enemyCount: 4, objective: '全灭敌军', weather: 'rain' },
  { name: '攻城战', mapKey: 'fortress', enemyCount: 5, objective: '攻破城门', weather: 'clear' },
  { name: '风雪遭遇', mapKey: 'field', enemyCount: 6, objective: '全灭敌军', weather: 'snow' },
  { name: '最终决战', mapKey: 'field', enemyCount: 8, objective: '击败Boss', weather: 'storm', isBoss: true }
];

export class CampaignMode {
  constructor(bus) {
    this.bus = bus;
    this.name = '战役';
    this.stage = 0;
    this.maxStages = STAGES.length;
    this.cleared = this._loadCleared();
  }

  _loadCleared() {
    try { return JSON.parse(localStorage.getItem('campaign_cleared') || '0'); } catch (e) { return 0; }
  }
  _saveCleared() {
    try { localStorage.setItem('campaign_cleared', JSON.stringify(this.cleared)); } catch (e) {}
  }

  get currentStage() { return STAGES[Math.min(this.stage, STAGES.length - 1)]; }
  get stageInfo() { return { ...this.currentStage, index: this.stage, total: this.maxStages, cleared: this.cleared }; }

  spawnLayout() {
    const s = this.currentStage;
    const layout = { blue: [{ x: -180, z: 0 }], red: [], weather: s.weather, mapKey: s.mapKey };
    for (let i = 0; i < s.enemyCount; i++) {
      const ang = (i / s.enemyCount) * Math.PI * 2;
      layout.red.push({ x: 180 * Math.cos(ang) * 0.8, z: 160 * Math.sin(ang) * 0.8 });
    }
    return layout;
  }

  checkWin(blueAlive, redAlive, siegeGate) {
    const s = this.currentStage;
    if (!blueAlive) return 'red';
    if (s.objective === '攻破城门' && siegeGate && siegeGate.broken) return 'blue';
    if (!redAlive) return 'blue';
    return null;
  }

  onStageClear() {
    this.cleared = Math.max(this.cleared, this.stage + 1);
    this._saveCleared();
    this.stage++;
    if (this.stage >= this.maxStages) { this.stage = 0; return 'campaign_complete'; }
    return 'next_stage';
  }

  reset() { this.stage = 0; }
  skipTo(stage) { this.stage = Math.min(stage, this.maxStages - 1); }
}
