// 存档面板：H 键开关 + 多档槽位列表 + 立即保存 + 重置进度（无导出/导入）；继承 UIPanel 复用面板共性
import { UIPanel } from './UIPanel.js';
import { SaveManager } from '../gameplay/SaveManager.js';

export class SaveUI extends UIPanel {
  constructor(bus, saveManager, captureFn, resetFn) {
    super({
      id: 'save-panel', toggleKey: 'KeyH', width: '300px',
      position: { right: '16px', top: '16px' },
      style: { zIndex: '30', border: '1px solid #444', background: 'rgba(10,12,18,.92)', padding: '12px', color: '#ddd' }
    });
    this.bus = bus;
    this.saveManager = saveManager;
    this.captureFn = captureFn || (() => ({}));
    this.resetFn = resetFn || (() => {});
    this.render();
  }

  get _activeSlot() { return this.saveManager.slot ?? 0; }

  _slotMeta(d) {
    if (!d) return '空槽位';
    const stage = (d.mode === '战役' && typeof d.stage === 'number') ? d.stage + 1 : 1;
    const timeStr = d.savedAt ? new Date(d.savedAt).toLocaleTimeString() : '无';
    const playMin = Math.floor((d.playTime || 0) / 60);
    return `第 ${stage} 关 ｜ 积分 ${d.score || 0} ｜ 技能点 ${d.skillPoints || 0} ｜ ${timeStr} ｜ ${playMin} 分`;
  }

  render() {
    const active = this._activeSlot;
    const slots = SaveManager.listSlots();
    const d = this.saveManager.load() || {};
    const stage = (d.mode === '战役' && typeof d.stage === 'number') ? d.stage + 1 : 1;
    const timeStr = d.savedAt ? new Date(d.savedAt).toLocaleTimeString() : '无';
    const playMin = Math.floor((d.playTime || 0) / 60);
    const rows = slots.map(({ slot, data }) => {
      const on = slot === active;
      return `
        <div class="save-slot" data-slot="${slot}" style="margin:4px 0;padding:6px;border:1px solid ${on ? '#8a7a4a' : '#333'};background:${on ? 'rgba(90,80,40,.25)' : 'transparent'};border-radius:3px">
          <div style="font-weight:bold;color:${on ? '#ffd' : '#bbb'}">槽位 ${slot + 1}${on ? ' · 使用中' : ''}</div>
          <div style="font-size:11px;color:#999;margin:3px 0 5px">${this._slotMeta(data)}</div>
          <button class="slot-write" data-slot="${slot}" style="cursor:pointer">写入当前进度</button>
          <button class="slot-del" data-slot="${slot}" style="cursor:pointer;color:#f66">清除</button>
        </div>`;
    }).join('');
    this.el.innerHTML = `
      <div style="font-weight:bold;margin-bottom:8px;color:#ffd">存档</div>
      <div id="save-slots">${rows}</div>
      <div id="save-info" style="line-height:1.8;margin-top:8px">
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
      if (window.confirm('确定重置当前槽位所有进度？此操作不可恢复。')) {
        this.resetFn();
        this.render();
      }
    });
    for (const btn of this.el.querySelectorAll('.slot-write')) {
      btn.addEventListener('click', () => this._writeSlot(parseInt(btn.dataset.slot, 10)));
    }
    for (const btn of this.el.querySelectorAll('.slot-del')) {
      btn.addEventListener('click', () => this._clearSlot(parseInt(btn.dataset.slot, 10)));
    }
  }

  // 写入某槽：切换活动槽 + 持久化当前进度快照
  _writeSlot(slot) {
    SaveManager.setActiveSlot(slot);
    this.saveManager.setSlot(slot);
    this.saveManager.save(this.captureFn());
    this.render();
  }

  // 清除某槽：活动槽走全量 reset（同步内存态），非活动槽仅删除该槽数据
  _clearSlot(slot) {
    if (!window.confirm(`确定清除槽位 ${slot + 1}？此操作不可恢复。`)) return;
    if (slot === this._activeSlot) this.resetFn();
    else new SaveManager(slot).reset();
    this.render();
  }
}