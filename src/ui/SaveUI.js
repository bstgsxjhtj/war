// 存档面板：H 键开关 + 进度概览 + 立即保存 + 重置进度（无导出/导入）；继承 UIPanel 复用面板共性
import { UIPanel } from './UIPanel.js';

export class SaveUI extends UIPanel {
  constructor(bus, saveManager, captureFn, resetFn) {
    super({
      id: 'save-panel', toggleKey: 'KeyH', width: '280px',
      position: { right: '16px', top: '16px' },
      style: { zIndex: '30', border: '1px solid #444', background: 'rgba(10,12,18,.92)', padding: '12px', color: '#ddd' }
    });
    this.bus = bus;
    this.saveManager = saveManager;
    this.captureFn = captureFn || (() => ({}));
    this.resetFn = resetFn || (() => {});
    this.render();
  }

  render() {
    const d = this.saveManager.load() || {};
    const stage = (d.mode === '战役' && typeof d.stage === 'number') ? d.stage + 1 : 1;
    const timeStr = d.savedAt ? new Date(d.savedAt).toLocaleTimeString() : '无';
    const playMin = Math.floor((d.playTime || 0) / 60);
    this.el.innerHTML = `
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
    this.el.querySelector('#save-now').addEventListener('click', () => {
      this.saveManager.save(this.captureFn());
      this.render();
    });
    this.el.querySelector('#save-reset').addEventListener('click', () => {
      if (window.confirm('确定重置所有进度？此操作不可恢复。')) {
        this.resetFn();
        this.render();
      }
    });
  }
}
