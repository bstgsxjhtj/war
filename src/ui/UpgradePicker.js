export class UpgradePicker {
  constructor(runBuffs, player, bus, audio = null) {
    this.runBuffs = runBuffs;
    this.player = player;
    this.bus = bus;
    this.audio = audio;
    this._callback = null;
    this._picks = [];
    this.el = document.createElement('div');
    this.el.id = 'upgrade-picker';
    this.el.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.82);display:none;align-items:center;justify-content:center;z-index:95;font-family:system-ui,sans-serif;';
    document.body.appendChild(this.el);
  }

  get visible() { return this.el.style.display !== 'none'; }

  show(onPick) {
    this._callback = onPick;
    this._picks = this.runBuffs.roll3();
    this._render();
    this.el.style.display = 'flex';
    try { document.exitPointerLock(); } catch (e) {}
  }

  _render() {
    const picks = this._picks;
    const rerolls = this.runBuffs.rerollsLeft || 0;
    const rerollBtn = rerolls > 0
      ? `<button id="upgrade-reroll" style="margin-top:18px;padding:8px 22px;background:#3a4a6a;border:1px solid #6a8aaa;border-radius:8px;color:#cde;font-family:inherit;font-size:14px;cursor:pointer;">重选（剩 ${rerolls}）</button>`
      : `<div style="margin-top:18px;font-size:12px;color:#888;">本局重选已用完</div>`;
    this.el.innerHTML = '<div style="color:#e0d090;font-size:26px;margin-bottom:20px;text-shadow:0 2px 8px rgba(0,0,0,0.8);">选择升级</div><div style="display:flex;gap:18px;">' +
      picks.map(p => '<div class="upgrade-card" data-id="' + p.id + '" style="width:190px;height:240px;background:linear-gradient(135deg,#1a2a3a,#2a3a5a);border:2px solid #4a6a8a;border-radius:12px;display:flex;flex-direction:column;align-items:center;justify-content:center;cursor:pointer;transition:transform 0.15s,border-color 0.15s;"><div style="font-size:22px;color:#e0d090;margin-bottom:12px;">' + p.name + '</div><div style="font-size:13px;color:#a0b0c0;text-align:center;padding:0 12px;">' + p.desc + '</div></div>').join('') +
      '</div>' + rerollBtn;
    const cards = this.el.querySelectorAll('.upgrade-card');
    cards.forEach(card => {
      card.addEventListener('mouseenter', () => { card.style.transform = 'scale(1.06)'; card.style.borderColor = '#e0d090'; });
      card.addEventListener('mouseleave', () => { card.style.transform = 'scale(1)'; card.style.borderColor = '#4a6a8a'; });
      card.addEventListener('click', () => {
        const id = card.getAttribute('data-id');
        const picked = picks.find(p => p.id === id);
        this.runBuffs.apply(this.player, id);
        this.audio?.playSound('buffSelect');
        this.hide();
        if (this.bus) this.bus.emit('hud.flash', { text: '已获得：' + picked.name });
        if (this._callback) { const cb = this._callback; this._callback = null; cb(); }
      });
    });
    const rerollEl = this.el.querySelector('#upgrade-reroll');
    if (rerollEl) {
      rerollEl.addEventListener('mouseenter', () => { rerollEl.style.background = '#4a5a7a'; });
      rerollEl.addEventListener('mouseleave', () => { rerollEl.style.background = '#3a4a6a'; });
      rerollEl.addEventListener('click', () => {
        const next = this.runBuffs.reroll();
        if (next) { this._picks = next; this._render(); }
      });
    }
  }

  hide() {
    this.el.style.display = 'none';
    this._callback = null;
  }
}