// 段位/积分条常驻 UI；自 gameplay/Progression.js 抽出，纯移动不改行为
export class ProgressionUI {
  constructor(progression, bus) {
    this.prog = progression;
    this.bus = bus;
    this.el = document.createElement('div');
    this.el.id = 'progression-ui';
    Object.assign(this.el.style, {
      position: 'fixed', top: '8px', left: '50%', transform: 'translateX(-50%)',
      display: 'flex', gap: '8px', alignItems: 'center', zIndex: 12,
      fontFamily: 'Segoe UI, sans-serif', fontSize: '12px', pointerEvents: 'none',
      color: '#ddd', textShadow: '0 0 3px #000'
    });
    document.body.appendChild(this.el);
    this._render();
  }

  _render() {
    const s = this.prog.getStats();
    const bar = `<div style="width:80px;height:6px;background:rgba(0,0,0,.5);border-radius:3px;overflow:hidden"><div style="width:${s.progressPct}%;height:100%;background:${s.rankColor};transition:width .3s"></div></div>`;
    this.el.innerHTML = `<span style="color:${s.rankColor};font-weight:bold">${s.rank}</span>${bar}<span>${s.score}分</span><span style="color:#6f6">${s.wins}胜</span>`;
  }

  update(dt) { if (Math.random() < dt * 0.5) this._render(); }
  refresh() { this._render(); }
}
