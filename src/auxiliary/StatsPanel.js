// 生涯统计面板（src/auxiliary/ 解耦模块）：独立固定居中卡片，展示玩家生涯累计数据
// 仅通过 EventBus 实例与外部通信，不依赖任何 gameplay 类实例；setData 接收 plain data 对象
// toggleKey 默认 KeyP；Escape 由 UIStack 统一关闭栈顶；pausesGame=true 时主循环冻结 gameplay（C1-6 暂停门）
import { UIStack } from '../ui/UIStack.js';

export class StatsPanel {
  constructor(bus, opts = {}) {
    this.bus = bus;
    this.toggleKey = opts.toggleKey ?? 'KeyP';
    this.pausesGame = true;
    this.visible = false;
    this._stats = null;

    this.el = document.createElement('div');
    Object.assign(this.el.style, {
      position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
      width: '480px', maxHeight: '80vh', overflowY: 'auto', zIndex: '150',
      background: 'rgba(15,15,20,.95)', border: '2px solid #6a5a2a',
      borderRadius: '8px', padding: '16px', color: '#eee',
      fontFamily: 'Segoe UI, sans-serif', fontSize: '13px', display: 'none',
      flexDirection: 'column', userSelect: 'none'
    });

    this._title = document.createElement('div');
    this._title.textContent = '生涯统计';
    Object.assign(this._title.style, {
      fontSize: '20px', marginBottom: '12px', letterSpacing: '4px',
      color: '#d4c060', textShadow: '0 0 10px rgba(0,0,0,.9)', textAlign: 'center'
    });
    this.el.appendChild(this._title);

    this._body = document.createElement('div');
    Object.assign(this._body.style, { display: 'flex', flexDirection: 'column', gap: '2px' });
    this.el.appendChild(this._body);

    this._closeBtn = document.createElement('button');
    this._closeBtn.textContent = '×';
    this._closeBtn.type = 'button';
    Object.assign(this._closeBtn.style, {
      position: 'absolute', right: '6px', top: '6px', width: '30px', height: '30px',
      padding: '0', lineHeight: '1', fontSize: '18px', cursor: 'pointer',
      borderRadius: '4px', border: '2px solid #6a5a2a',
      background: 'rgba(20,20,25,.95)', color: '#eee'
    });
    this._closeBtn.addEventListener('click', () => this.hide());
    this.el.appendChild(this._closeBtn);

    document.body.appendChild(this.el);

    this._boundKey = (e) => this._onKey(e);
    document.addEventListener('keydown', this._boundKey);
  }

  _onKey(e) {
    if (e.code === this.toggleKey) { e.preventDefault(); this.toggle(); }
  }

  toggle() { this.visible ? this.hide() : this.show(); }

  show() {
    this.visible = true;
    this.el.style.display = 'flex';
    UIStack.push(this);
    this.render();
  }

  hide() {
    this.visible = false;
    this.el.style.display = 'none';
    UIStack.remove(this);
  }

  setData(stats) {
    this._stats = stats || null;
  }

  render() {
    const s = this._stats || {};
    const rows = [
      ['总击杀', s.totalKills ?? 0],
      ['总阵亡', s.totalDeaths ?? 0],
      ['总场次', s.totalMatches ?? 0],
      ['胜率', this._winRate(s)],
      ['最高波数', s.bestWave ?? 0],
      ['最高连击', s.bestCombo ?? 0],
      ['最高连杀', s.bestKillStreak ?? 0],
      ['游玩时长', this._fmtPlayTime(s.playTimeSec)],
      ['成就进度', this._achvProgress(s)]
    ];
    this._body.innerHTML = '';
    for (const [label, value] of rows) {
      const row = document.createElement('div');
      Object.assign(row.style, {
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '6px 8px', borderBottom: '1px solid rgba(120,100,40,.3)'
      });
      const k = document.createElement('span');
      k.textContent = label;
      Object.assign(k.style, { color: '#aaa' });
      const v = document.createElement('span');
      v.textContent = String(value);
      Object.assign(v.style, { color: '#f0e0a0', fontWeight: 'bold' });
      row.appendChild(k);
      row.appendChild(v);
      this._body.appendChild(row);
    }
  }

  _winRate(s) {
    const t = s.totalMatches ?? 0, w = s.wins ?? 0;
    if (!t) return '0%';
    return Math.round((w / t) * 100) + '%';
  }

  _achvProgress(s) {
    const a = s.achievementCount ?? 0, t = s.totalAchievements ?? 0;
    return a + '/' + t;
  }

  _fmtPlayTime(sec) {
    const total = Math.max(0, Math.floor(sec || 0));
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    return h + 'h ' + m + 'm';
  }

  destroy() {
    document.removeEventListener('keydown', this._boundKey);
    if (this.visible) this.hide();
    this.el.remove();
  }
}
