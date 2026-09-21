// 存档面板：H 键开关 + 进度概览 + 立即保存 + 重置进度（无导出/导入）
export class SaveUI {
  constructor(bus, saveManager, captureFn, resetFn) {
    this.bus = bus;
    this.saveManager = saveManager;
    this.captureFn = captureFn || (() => ({}));
    this.resetFn = resetFn || (() => {});
    this._visible = false;
    this._panel = document.createElement('div');
    this._panel.id = 'save-panel';
    Object.assign(this._panel.style, {
      position: 'fixed', right: '16px', top: '16px', width: '280px', zIndex: 30,
      background: 'rgba(10,12,18,.92)', border: '1px solid #444', borderRadius: '8px',
      padding: '12px', color: '#ddd', fontFamily: 'Segoe UI, sans-serif', fontSize: '13px',
      display: 'none'
    });
    document.body.appendChild(this._panel);
    this._render();
    document.addEventListener('keydown', (e) => {
      if (e.code === 'KeyH') { e.preventDefault(); this.toggle(); }
      else if (e.code === 'Escape' && this._visible) this.toggle();
    });
  }

  toggle() {
    this._visible = !this._visible;
    this._panel.style.display = this._visible ? 'block' : 'none';
    if (this._visible) this._render();
  }

  _render() {
    const d = this.saveManager.load() || {};
    const stage = (d.mode === '战役' && typeof d.stage === 'number') ? d.stage + 1 : 1;
    const timeStr = d.savedAt ? new Date(d.savedAt).toLocaleTimeString() : '无';
    const playMin = Math.floor((d.playTime || 0) / 60);
    this._panel.innerHTML = `
      <div style="font-weight:bold;margin-bottom:8px;color:#ffd">存档</div>
      <div id="save-info" style="line-height:1.8">
        保存时间：${timeStr}<br>
        关卡：第 ${stage} 关 ｜ 积分：${d.score || 0} ｜ 技能点：${d.skillPoints || 0}<br>
        游玩时长：${playMin} 分
      </div>
      <div style="margin-top:10px;display:flex;gap:8px">
        <button id="save-now" style="flex:1;cursor:pointer">立即保存</button>
        <button id="save-reset" style="flex:1;cursor:pointer;color:#f66">重置进度</button>
      </div>
    `;
    this._panel.querySelector('#save-now').addEventListener('click', () => {
      this.saveManager.save(this.captureFn());
      this._render();
    });
    this._panel.querySelector('#save-reset').addEventListener('click', () => {
      if (window.confirm('确定重置所有进度？此操作不可恢复。')) {
        this.resetFn();
        this._render();
      }
    });
  }
}
