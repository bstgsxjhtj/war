import { UIStack } from './UIStack.js';
import { MODE_ORDER, MODE_DESC } from '../gameplay/gameModes.js';

// 统一游戏菜单：玩法模式选择 + 职业/设置/重开/返回（Esc 开关）
export class GameMenu {
  constructor(opts = {}) {
    this.opts = opts;
    this.open = false;
    this._modeBtns = new Map();
    this._build();
  }

  _build() {
    const el = document.createElement('div');
    el.id = 'gameMenu';
    Object.assign(el.style, {
      position: 'fixed', inset: '0', background: 'rgba(6,9,14,.9)', display: 'none',
      alignItems: 'center', justifyContent: 'center', zIndex: '9000',
      fontFamily: 'Segoe UI, sans-serif', color: '#e0d8c8', overflow: 'auto',
    });

    const panel = document.createElement('div');
    Object.assign(panel.style, {
      background: '#161c26', border: '1px solid #3a4a60', borderRadius: '14px',
      padding: '28px 32px', width: '620px', maxWidth: '92vw',
      boxShadow: '0 16px 48px rgba(0,0,0,.6)',
    });
    panel.addEventListener('click', (e) => e.stopPropagation());
    el.appendChild(panel);

    const title = document.createElement('div');
    Object.assign(title.style, { fontSize: '24px', fontWeight: '700', letterSpacing: '2px', textAlign: 'center' });
    title.textContent = '游戏菜单';
    panel.appendChild(title);

    const subtitle = document.createElement('div');
    Object.assign(subtitle.style, { fontSize: '12px', opacity: '0.55', textAlign: 'center', margin: '6px 0 20px' });
    subtitle.textContent = '选择玩法模式并开始 · 也可在游戏中随时按 Esc 打开';
    panel.appendChild(subtitle);

    // 玩法模式
    const modeLabel = document.createElement('div');
    Object.assign(modeLabel.style, { fontSize: '13px', fontWeight: '600', marginBottom: '10px', opacity: '0.85' });
    modeLabel.textContent = '玩法模式';
    panel.appendChild(modeLabel);

    const grid = document.createElement('div');
    Object.assign(grid.style, { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px', marginBottom: '22px' });
    for (const name of MODE_ORDER) {
      const btn = document.createElement('button');
      btn.dataset.mode = name;
      Object.assign(btn.style, {
        fontFamily: 'inherit', textAlign: 'left', cursor: 'pointer', borderRadius: '10px',
        padding: '10px 12px', background: 'rgba(30,40,55,.9)', color: '#e0d8c8',
        border: '1px solid #3a4a60', transition: 'all .15s',
      });
      const nameEl = document.createElement('div');
      Object.assign(nameEl.style, { fontSize: '15px', fontWeight: '700' });
      nameEl.textContent = name;
      const descEl = document.createElement('div');
      Object.assign(descEl.style, { fontSize: '11px', opacity: '0.6', marginTop: '4px', lineHeight: '1.4' });
      descEl.textContent = MODE_DESC[name] || '';
      btn.appendChild(nameEl);
      btn.appendChild(descEl);
      btn.addEventListener('click', () => { if (this.opts.onSelectMode) this.opts.onSelectMode(name); });
      grid.appendChild(btn);
      this._modeBtns.set(name, btn);
    }
    panel.appendChild(grid);

    // 其他操作
    const row = document.createElement('div');
    Object.assign(row.style, { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', borderTop: '1px solid #2c3a4c', paddingTop: '18px' });
    const mkBtn = (action, text, bg) => {
      const b = document.createElement('button');
      b.dataset.action = action;
      Object.assign(b.style, { fontFamily: 'inherit', cursor: 'pointer', borderRadius: '8px', padding: '10px', fontSize: '14px', color: '#fff', border: '1px solid rgba(255,255,255,.12)', background: bg });
      b.textContent = text;
      return b;
    };
    const classBtn = mkBtn('class', '切换职业 (C)', '#365070');
    const settingsBtn = mkBtn('settings', '设置', '#3a3a4a');
    const restartBtn = mkBtn('restart', '重开本局 (R)', '#4a5a3a');
    const resumeBtn = mkBtn('resume', '返回游戏 (Esc)', '#2a4a3a');
    classBtn.addEventListener('click', () => { if (this.opts.onSelectClass) this.opts.onSelectClass(); });
    settingsBtn.addEventListener('click', () => { if (this.opts.onOpenSettings) this.opts.onOpenSettings(); });
    restartBtn.addEventListener('click', () => { if (this.opts.onRestart) this.opts.onRestart(); });
    resumeBtn.addEventListener('click', () => { if (this.opts.onResume) this.opts.onResume(); });
    row.append(classBtn, settingsBtn, restartBtn, resumeBtn);
    panel.appendChild(row);

    const hint = document.createElement('div');
    Object.assign(hint.style, { fontSize: '11px', opacity: '0.4', marginTop: '16px', textAlign: 'center' });
    hint.textContent = 'M 键可在对局结束后直接轮换模式 · 点击画面重新锁定鼠标';
    panel.appendChild(hint);

    el.addEventListener('click', () => { if (this.opts.onResume) this.opts.onResume(); });
    document.body.appendChild(el);
    this.el = el;
  }

  // 高亮当前模式
  refresh() {
    const cur = this.opts.getModeName ? this.opts.getModeName() : null;
    for (const [name, btn] of this._modeBtns) {
      const active = name === cur;
      btn.style.borderColor = active ? '#e0b050' : '#3a4a60';
      btn.style.background = active ? 'rgba(60,50,25,.95)' : 'rgba(30,40,55,.9)';
      btn.style.color = active ? '#ffd070' : '#e0d8c8';
    }
  }

  show() {
    this.refresh();
    this.el.style.display = 'flex';
    this.open = true;
    UIStack.push(this);
  }

  hide() {
    this.el.style.display = 'none';
    this.open = false;
    UIStack.remove(this);
  }

  toggle() { this.open ? this.hide() : this.show(); }

  dispose() { this.hide(); if (this.el) { this.el.remove(); this.el = null; } }
}