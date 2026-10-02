import { CLASS_DEFS, CLASS_KEYS } from '../gameplay/ClassDefinition.js';

export class ClassSelectUI {
  constructor(onSelect) {
    this.onSelect = onSelect;
    this.el = null;
    this._build();
  }

  _build() {
    const overlay = document.createElement('div');
    overlay.id = 'classSelectUI';
    Object.assign(overlay.style, {
      position: 'fixed', top: '0', left: '0', width: '100vw', height: '100vh',
      background: 'rgba(6,9,14,0.94)', display: 'none',
      flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      zIndex: '9999', fontFamily: 'Segoe UI, sans-serif', color: '#e0d8c8',
    });

    const title = document.createElement('div');
    Object.assign(title.style, { fontSize: '28px', fontWeight: 'bold', marginBottom: '8px', letterSpacing: '2px' });
    title.textContent = '选择职业';
    overlay.appendChild(title);

    const subtitle = document.createElement('div');
    Object.assign(subtitle.style, { fontSize: '13px', opacity: '0.6', marginBottom: '32px' });
    subtitle.textContent = '不同职业拥有不同武器与属性，选择你的战斗风格';
    overlay.appendChild(subtitle);

    const cardRow = document.createElement('div');
    Object.assign(cardRow.style, { display: 'flex', gap: '20px', flexWrap: 'wrap', justifyContent: 'center' });

    for (const key of CLASS_KEYS) {
      const def = CLASS_DEFS[key];
      const card = document.createElement('div');
      Object.assign(card.style, {
        width: '220px', padding: '24px 20px', borderRadius: '12px',
        background: 'rgba(30,40,55,0.9)', border: '2px solid rgba(80,100,140,0.3)',
        cursor: 'pointer', transition: 'all 0.2s', textAlign: 'center',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px',
      });
      const hex = '#' + def.color.toString(16).padStart(6, '0');
      card.style.boxShadow = `inset 0 0 30px ${hex}22`;

      const icon = document.createElement('div');
      Object.assign(icon.style, { fontSize: '40px', color: hex, lineHeight: '1' });
      icon.textContent = def.icon;
      card.appendChild(icon);

      const name = document.createElement('div');
      Object.assign(name.style, { fontSize: '20px', fontWeight: 'bold', color: hex });
      name.textContent = def.name;
      card.appendChild(name);

      const desc = document.createElement('div');
      Object.assign(desc.style, { fontSize: '12px', opacity: '0.7', lineHeight: '1.5', minHeight: '36px' });
      desc.textContent = def.desc;
      card.appendChild(desc);

      const stats = document.createElement('div');
      Object.assign(stats.style, { fontSize: '11px', opacity: '0.6', lineHeight: '1.6', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '10px', width: '100%' });
      stats.innerHTML = `生命: ${def.stats.maxHp}<br>耐力: ${def.stats.maxStamina}<br>速度: ${def.stats.speed.toFixed(1)}<br>武器: ${def.weaponNames.join('、')}`;
      card.appendChild(stats);

      card.addEventListener('mouseenter', () => {
        card.style.borderColor = hex;
        card.style.transform = 'translateY(-4px)';
        card.style.boxShadow = `0 8px 24px ${hex}44, inset 0 0 30px ${hex}22`;
      });
      card.addEventListener('mouseleave', () => {
        card.style.borderColor = 'rgba(80,100,140,0.3)';
        card.style.transform = '';
        card.style.boxShadow = `inset 0 0 30px ${hex}22`;
      });
      card.addEventListener('click', () => {
        this.hide();
        if (this.onSelect) this.onSelect(key);
      });

      cardRow.appendChild(card);
    }
    overlay.appendChild(cardRow);

    const hint = document.createElement('div');
    Object.assign(hint.style, { fontSize: '12px', opacity: '0.4', marginTop: '28px' });
    hint.textContent = '点击卡片确认选择 · 游戏中按 C 切换职业 · Esc 返回';
    overlay.appendChild(hint);

    const backBtn = document.createElement('button');
    Object.assign(backBtn.style, { position: 'absolute', top: '24px', left: '24px', padding: '8px 20px', background: 'rgba(30,30,40,.8)', color: '#cde', border: '1px solid #456', borderRadius: '6px', cursor: 'pointer', fontFamily: 'inherit', fontSize: '13px' });
    backBtn.textContent = '← 返回';
    backBtn.addEventListener('click', () => { this.hide(); if (this.opts.onCancel) this.opts.onCancel(); else if (this.opts.onBack) this.opts.onBack(); });
    overlay.appendChild(backBtn);

    document.body.appendChild(overlay);
    this.el = overlay;
  }

  show() { if (this.el) { this.el.style.display = 'flex'; this._escHandler = (e) => { if (e.code === 'Escape') { this.hide(); if (this.opts.onCancel) this.opts.onCancel(); else if (this.opts.onBack) this.opts.onBack(); } }; window.addEventListener('keydown', this._escHandler); } }
  hide() { if (this.el) { this.el.style.display = 'none'; if (this._escHandler) { window.removeEventListener('keydown', this._escHandler); this._escHandler = null; } } }
  dispose() { if (this.el) { this.el.remove(); this.el = null; } }
}
