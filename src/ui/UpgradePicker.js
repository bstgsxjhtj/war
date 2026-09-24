export class UpgradePicker {
  constructor(runBuffs, player, bus) {
    this.runBuffs = runBuffs;
    this.player = player;
    this.bus = bus;
    this._callback = null;
    this.el = document.createElement('div');
    this.el.id = 'upgrade-picker';
    this.el.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.82);display:none;align-items:center;justify-content:center;z-index:95;font-family:system-ui,sans-serif;';
    document.body.appendChild(this.el);
  }

  get visible() { return this.el.style.display !== 'none'; }

  show(onPick) {
    this._callback = onPick;
    const picks = this.runBuffs.roll3();
    this.el.innerHTML = '<div style="color:#e0d090;font-size:26px;margin-bottom:20px;text-shadow:0 2px 8px rgba(0,0,0,0.8);">选择升级</div><div style="display:flex;gap:18px;">' +
      picks.map(p => '<div class="upgrade-card" data-id="' + p.id + '" style="width:190px;height:240px;background:linear-gradient(135deg,#1a2a3a,#2a3a5a);border:2px solid #4a6a8a;border-radius:12px;display:flex;flex-direction:column;align-items:center;justify-content:center;cursor:pointer;transition:transform 0.15s,border-color 0.15s;"><div style="font-size:22px;color:#e0d090;margin-bottom:12px;">' + p.name + '</div><div style="font-size:13px;color:#a0b0c0;text-align:center;padding:0 12px;">' + p.desc + '</div></div>').join('') +
      '</div>';
    this.el.style.display = 'flex';
    try { document.exitPointerLock(); } catch (e) {}
    const cards = this.el.querySelectorAll('.upgrade-card');
    cards.forEach(card => {
      card.addEventListener('mouseenter', () => { card.style.transform = 'scale(1.06)'; card.style.borderColor = '#e0d090'; });
      card.addEventListener('mouseleave', () => { card.style.transform = 'scale(1)'; card.style.borderColor = '#4a6a8a'; });
      card.addEventListener('click', () => {
        const id = card.getAttribute('data-id');
        const picked = picks.find(p => p.id === id);
        this.runBuffs.apply(this.player, id);
        this.hide();
        if (this.bus) this.bus.emit('hud.flash', { text: '已获得：' + picked.name });
        if (this._callback) { const cb = this._callback; this._callback = null; cb(); }
      });
    });
  }

  hide() {
    this.el.style.display = 'none';
    this._callback = null;
  }
}
