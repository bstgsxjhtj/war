import { EV } from '../core/constants/events.js';
import { UIStack } from './UIStack.js';
import { WEAPON_MODS } from '../gameplay/SkillTree.js';
// 技能树 UI v3：拖拽排序 + localStorage 持久化 + 渐变+图标+进度圆点+Tab+悬停预览+升级动画+重置
export class SkillTreeUI {
  constructor(bus, skill, kb = null) {
    this.bus = bus;
    this.skill = skill;
    this.kb = kb;
    this.open = false;
    this.pausesGame = true; // 战役一#6：技能树打开时冻结 gameplay
    this._tab = 'skill';
    this._resetUsed = false;
    this._dragIdx = -1;
    this.el = document.createElement('div');
    Object.assign(this.el.style, {
      position: 'fixed', inset: '0', background: 'radial-gradient(circle at 50% 30%, rgba(40,30,60,.9), rgba(8,8,16,.96))',
      display: 'none', alignItems: 'center', justifyContent: 'center', zIndex: 100,
      fontFamily: 'Segoe UI, sans-serif', backdropFilter: 'blur(6px)',
      transition: 'opacity .25s', opacity: '0'
    });
    this._icons = { power: '\uD83D\uDCAA', vigor: '\u2764\uFE0F', agility: '\u26A1', mastery: '\u2694\uFE0F', 0: '\uD83D\uDDE1\uFE0F', 1: '\uD83C\uDF9A', 2: '\uD83D\uDD74\uFE0F', 3: '\uD83D\uDD28' };
    this._branchIcons = { berserk: '\uD83D\uDD25', guardian: '\uD83D\uDEE1\uFE0F', regen: '\uD83D\uDC9A', lifesteal: '\uD83E\uDE78', swift: '\uD83D\uDCA8', evade: '\uD83D\uDC7B', frenzy: '\u2694\uFE0F', critical: '\uD83C\uDFAF' };
    this._branchMap = { power: ['berserk', 'guardian'], vigor: ['regen', 'lifesteal'], agility: ['swift', 'evade'], mastery: ['frenzy', 'critical'] };
    this.el.innerHTML = [
      '<div id="sk-panel" style="background:linear-gradient(145deg,#1a1a2e,#0f0f1a);border:1px solid #4a3a6a;border-radius:16px;padding:28px;width:620px;max-height:88vh;overflow-y:auto;color:#eee;box-shadow:0 12px 48px rgba(0,0,0,.6),0 0 0 1px rgba(255,255,255,.04) inset;">',
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">',
      '<div style="font-size:22px;font-weight:800;background:linear-gradient(90deg,#ffd070,#fa8);-webkit-background-clip:text;-webkit-text-fill-color:transparent;">\u6280\u80fd\u6811</div>',
      '<div id="sk-pts-box" style="background:rgba(255,208,112,.12);border:1px solid #ffd07044;border-radius:20px;padding:4px 14px;">',
      '<span style="font-size:12px;color:#ffd070;">\u6280\u80fd\u70b9</span> <b id="sk-pts" style="font-size:20px;color:#ffd070;">0</b></div></div>',
      '<div style="font-size:11px;color:#888;margin-bottom:10px;text-align:center;">\u62d6\u62fd\u5361\u7247\u91cd\u6392\u987a\u5e8f \u00b7 \u914d\u7f6e\u81ea\u52a8\u4fdd\u5b58</div>',
      '<div style="display:flex;gap:8px;margin-bottom:18px;border-bottom:1px solid #2a2a3a;padding-bottom:12px;">',
      '<button id="sk-tab-skill" class="sk-tab" style="flex:1;padding:8px;background:#2a2a3a;border:1px solid #3a3a4a;border-radius:8px;color:#eee;cursor:pointer;font-size:13px;font-family:inherit;">\u6280\u80fd</button>',
      '<button id="sk-tab-weapon" class="sk-tab" style="flex:1;padding:8px;background:#2a2a3a;border:1px solid #3a3a4a;border-radius:8px;color:#eee;cursor:pointer;font-size:13px;font-family:inherit;">\u6b66\u5668\u5347\u7ea7</button>',
      '</div>',
      '<div id="sk-list" style="display:grid;grid-template-columns:1fr 1fr;gap:12px;"></div>',
      '<div style="display:flex;gap:10px;margin-top:20px;">',
      '<button id="sk-reset" style="flex:1;padding:10px;background:#3a2a2a;border:1px solid #a44;border-radius:8px;color:#faa;cursor:pointer;font-size:13px;font-family:inherit;">\u91cd\u7f6e\uff081\u6b21/\u5c40\uff09</button>',
      '<button id="sk-close" style="flex:2;padding:10px;background:linear-gradient(90deg,#3a5a4a,#2a4a3a);border:1px solid #4a8;border-radius:8px;color:#fff;cursor:pointer;font-size:14px;font-family:inherit;font-weight:600;">\u5173\u95ed (K / Esc)</button>',
      '</div></div>'
    ].join('');
    document.body.appendChild(this.el);
    this._ptsEl = this.el.querySelector('#sk-pts');
    this._listEl = this.el.querySelector('#sk-list');
    this._tabBtnS = this.el.querySelector('#sk-tab-skill');
    this._tabBtnW = this.el.querySelector('#sk-tab-weapon');
    this._tabBtnS.addEventListener('click', () => { this._tab = 'skill'; this._render(); });
    this._tabBtnW.addEventListener('click', () => { this._tab = 'weapon'; this._render(); });
    this.el.querySelector('#sk-close').addEventListener('click', () => this.hide());
    this.el.querySelector('#sk-reset').addEventListener('click', () => this._reset());
    this.el.addEventListener('click', (e) => { if (e.target === this.el) this.hide(); });
    this._keyHandler = (e) => {
      if (e.code === 'Escape') { e.preventDefault(); this.hide(); return; }
      if (e.code === (this.kb ? this.kb.get('skilltree') : 'KeyK')) { e.preventDefault(); this.toggle(); }
    };
    window.addEventListener('keydown', this._keyHandler);
  }

  toggle() { this.open ? this.hide() : this.show(); }
  show() { this.el.style.display = 'flex'; requestAnimationFrame(() => this.el.style.opacity = '1'); this.open = true; UIStack.push(this); this._render(); this.bus.emit(EV.UI_LOCKLOST); }
  hide() { this.el.style.opacity = '0'; setTimeout(() => { this.el.style.display = 'none'; }, 250); this.open = false; UIStack.remove(this); }

  _dots(level, max) {
    let s = '';
    for (let i = 0; i < max; i++) s += i < level ? '\u25CF' : '\u25CB';
    return s;
  }

  _bindDrag(el, idx) {
    el.draggable = true;
    el.addEventListener('dragstart', (e) => { this._dragIdx = idx; e.dataTransfer.effectAllowed = 'move'; el.style.opacity = '0.4'; });
    el.addEventListener('dragend', () => { el.style.opacity = '1'; this._listEl.querySelectorAll('.sk-card').forEach(c => c.style.borderTopColor = c.dataset.border || ''); });
    el.addEventListener('dragover', (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; el.style.borderTop = '2px solid #ffd070'; });
    el.addEventListener('dragleave', () => { el.style.borderTop = '1px solid ' + (el.dataset.border || '#3a3a4a'); });
    el.addEventListener('drop', (e) => {
      e.preventDefault();
      const from = this._dragIdx, to = idx;
      if (from < 0 || from === to) return;
      if (this._tab === 'skill') this.skill.reorderSkill(from, to);
      else this.skill.reorderWeapon(from, to);
      this._render();
    });
  }

  _render() {
    this._ptsEl.textContent = this.skill.points;
    this._tabBtnS.style.background = this._tab === 'skill' ? 'linear-gradient(90deg,#4a3a6a,#3a2a5a)' : '#2a2a3a';
    this._tabBtnS.style.borderColor = this._tab === 'skill' ? '#7a6a9a' : '#3a3a4a';
    this._tabBtnW.style.background = this._tab === 'weapon' ? 'linear-gradient(90deg,#6a4a2a,#5a3a2a)' : '#2a2a3a';
    this._tabBtnW.style.borderColor = this._tab === 'weapon' ? '#aa7a4a' : '#3a3a4a';
    const pts = this.skill.points;
    if (this._tab === 'skill') {
      this._listEl.style.gridTemplateColumns = '1fr 1fr';
      const order = this.skill.skillOrder;
      let html = '';
      for (let oi = 0; oi < order.length; oi++) {
        const key = order[oi];
        const s = this.skill.skills[key];
        const lv = s.level, max = s.max, maxed = lv >= max;
        const cost = s.cost, can = !maxed && pts >= cost;
        const border = maxed ? '#4ade80' : (can ? '#ffd070' : '#3a3a4a');
        const bg = maxed ? 'rgba(74,222,128,.08)' : (can ? 'rgba(255,208,112,.06)' : 'rgba(58,58,74,.15)');
        const cursor = can ? 'pointer' : 'default';
        const glow = can ? '0 0 12px rgba(255,208,112,.3)' : 'none';
        const next = maxed ? '' : '<div style="font-size:10px;color:#8ac;margin-top:4px;">\u4e0b\u7ea7\uff1a' + this._nextDesc(key) + '</div>';
        const costTxt = maxed ? '\u5df2\u6ee1\u7ea7' : ('\u6d88\u8017 ' + cost + ' \u70b9');
        const costClr = maxed ? '#4ade80' : (can ? '#ffd070' : '#666');
        html += '<div class="sk-card" data-sk="' + key + '" data-idx="' + oi + '" data-border="' + border + '" style="background:' + bg + ';border:1px solid ' + border + ';border-radius:10px;padding:14px;cursor:' + cursor + ';box-shadow:' + glow + ';transition:all .15s;position:relative;overflow:hidden;">'
          + '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">'
          + '<span style="font-size:24px;">' + (this._icons[key] || '\u2753') + '</span>'
          + '<div style="flex:1;"><div style="font-size:14px;font-weight:700;">' + s.name + '</div>'
          + '<div style="font-size:16px;color:#ffd070;letter-spacing:2px;">' + this._dots(lv, max) + '</div></div>'
          + '<span style="font-size:11px;color:#888;">Lv' + lv + '/' + max + '</span></div>'
          + '<div style="font-size:11px;color:#bcd;">' + s.desc + '</div>'
          + next
          + '<div style="font-size:11px;margin-top:6px;color:' + costClr + ';font-weight:600;">' + costTxt + '</div>'
          + '</div>';
      }
      html += '<div style="grid-column:1/-1;margin-top:8px;border-top:1px solid #2a2a3a;padding-top:12px;">';
      html += '<div style="font-size:13px;color:#ffd070;font-weight:600;margin-bottom:8px;">\u5206\u652f\u4e13\u7cbe\uff08\u57fa\u7840\u6280\u80fd Lv2 \u89e3\u9501\uff09</div>';
      html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">';
      for (const sk of order) {
        const baseLevel = this.skill.skills[sk].level;
        for (const bk of this._branchMap[sk]) {
          const b = this.skill.branches[bk];
          const taken = b.level > 0;
          const exclTaken = this.skill.branches[b.excl] && this.skill.branches[b.excl].level > 0;
          const locked = baseLevel < 2 || (exclTaken && !taken);
          const can = !taken && !locked && pts >= b.cost;
          const border = taken ? '#4ade80' : (can ? '#fa8' : (locked ? '#444' : '#3a3a4a'));
          const bg = taken ? 'rgba(74,222,128,.08)' : (can ? 'rgba(250,136,.06)' : 'rgba(30,30,40,.3)');
          const opacity = locked ? '0.4' : '1';
          const cursor = can ? 'pointer' : 'default';
          const glow = can ? '0 0 10px rgba(250,136,.25)' : 'none';
          const status = taken ? '\u5df2\u9009\u62e9' : (locked ? '\u672a\u89e3\u9501' : '\u6d88\u8017 ' + b.cost + ' \u70b9');
          const statusClr = taken ? '#4ade80' : (locked ? '#666' : '#fa8');
          html += '<div class="sk-card" data-branch="' + bk + '" data-border="' + border + '" style="background:' + bg + ';border:1px solid ' + border + ';border-radius:8px;padding:10px;cursor:' + cursor + ';box-shadow:' + glow + ';opacity:' + opacity + ';transition:all .15s;">'
            + '<div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;">'
            + '<span style="font-size:18px;">' + (this._branchIcons[bk] || '\u2753') + '</span>'
            + '<div style="flex:1;font-size:12px;font-weight:700;">' + b.name + '</div></div>'
            + '<div style="font-size:10px;color:#bcd;margin-bottom:4px;">' + b.desc + '</div>'
            + '<div style="font-size:10px;color:' + statusClr + ';font-weight:600;">' + status + '</div>'
            + '</div>';
        }
      }
      html += '</div></div>';
      this._listEl.innerHTML = html;
      this._listEl.querySelectorAll('[data-sk]').forEach(el => {
        this._bindDrag(el, parseInt(el.dataset.idx));
        el.addEventListener('mouseenter', () => { if (pts >= this.skill.skills[el.dataset.sk].cost && this.skill.skills[el.dataset.sk].level < this.skill.skills[el.dataset.sk].max) el.style.transform = 'translateY(-2px)'; });
        el.addEventListener('mouseleave', () => el.style.transform = 'none');
        el.addEventListener('click', () => { if (this.skill.upgrade(el.dataset.sk)) this._flash(el); this._render(); });
      });
      this._listEl.querySelectorAll('[data-branch]').forEach(el => {
        el.addEventListener('click', () => { if (this.skill.upgradeBranch(el.dataset.branch)) this._flash(el); this._render(); });
      });
    } else {
      this._listEl.style.gridTemplateColumns = '1fr 1fr';
      const order = this.skill.weaponOrder;
      let html = '';
      for (let oi = 0; oi < order.length; oi++) {
        const i = order[oi];
        const lv = this.skill.weaponLevel[i], maxed = lv >= 3;
        const can = !maxed && pts >= 2;
        const border = maxed ? '#4ade80' : (can ? '#fa8' : '#3a3a4a');
        const bg = maxed ? 'rgba(74,222,128,.08)' : (can ? 'rgba(250,136,.06)' : 'rgba(58,58,74,.15)');
        const cursor = can ? 'pointer' : 'default';
        const glow = can ? '0 0 12px rgba(250,136,.3)' : 'none';
        const costTxt = maxed ? '\u5df2\u6ee1\u7ea7' : '\u6d88\u8017 2 \u70b9';
        const costClr = maxed ? '#4ade80' : (can ? '#fa8' : '#666');
        const next = maxed ? '' : '<div style="font-size:10px;color:#8ac;margin-top:4px;">\u4e0b\u7ea7\uff1a+' + (lv * 25 + 25) + '%</div>';
        // P2-B 武器形态改造：Lv3 满级后二选一形态（range/pierce/knock）
        const modKey = this.skill.getWeaponMod(i);
        const modInfo = modKey ? WEAPON_MODS.find(m => m.key === modKey) : null;
        let modHtml = '';
        if (maxed) {
          modHtml = modInfo
            ? '<div style="font-size:10px;color:#4ade80;margin-top:6px;">\u5f62\u6001\uff1a' + modInfo.name + '</div>'
            : '<div style="display:flex;gap:4px;margin-top:6px;justify-content:center;flex-wrap:wrap;">' + WEAPON_MODS.map(m => '<button class="sk-mod" data-wpmod="' + i + '" data-mod="' + m.key + '" title="' + m.desc + '" style="padding:3px 7px;background:#2a3a4a;border:1px solid #4a6a8a;border-radius:5px;color:#9cf;font-size:10px;cursor:pointer;font-family:inherit;">' + m.name + '</button>').join('') + '</div>';
        }
        html += '<div class="sk-card" data-wp="' + i + '" data-idx="' + oi + '" data-border="' + border + '" style="background:' + bg + ';border:1px solid ' + border + ';border-radius:10px;padding:14px;cursor:' + cursor + ';box-shadow:' + glow + ';transition:all .15s;text-align:center;">'
          + '<div style="font-size:28px;margin-bottom:6px;">' + (this._icons[i] || '\u2753') + '</div>'
          + '<div style="font-size:14px;font-weight:700;">' + this.skill.weaponNames[i] + '</div>'
          + '<div style="font-size:16px;color:#ffd070;letter-spacing:2px;margin-top:4px;">' + this._dots(lv, 3) + '</div>'
          + '<div style="font-size:11px;color:#bcd;margin-top:4px;">+' + ((lv - 1) * 25) + '% \u4f24\u5bb3</div>'
          + next
          + '<div style="font-size:11px;margin-top:6px;color:' + costClr + ';font-weight:600;">' + costTxt + '</div>'
          + modHtml
          + '</div>';
      }
      this._listEl.innerHTML = html;
      this._listEl.querySelectorAll('[data-wp]').forEach(el => {
        this._bindDrag(el, parseInt(el.dataset.idx));
        el.addEventListener('mouseenter', () => { if (pts >= 2 && this.skill.weaponLevel[parseInt(el.dataset.wp)] < 3) el.style.transform = 'translateY(-2px)'; });
        el.addEventListener('mouseleave', () => el.style.transform = 'none');
        el.addEventListener('click', () => { if (this.skill.upgradeWeapon(parseInt(el.dataset.wp))) this._flash(el); this._render(); });
      });
      // P2-B 武器形态改造：选择形态（点击不冒泡到卡片升级）
      this._listEl.querySelectorAll('.sk-mod').forEach(el => {
        el.addEventListener('click', (e) => {
          e.stopPropagation();
          if (this.skill.upgradeWeaponMod(parseInt(el.dataset.wpmod), el.dataset.mod)) {
            this.bus.emit(EV.HUD_FLASH, { text: '\u6b66\u5668\u5f62\u6001\u5df2\u6539\u9020' });
            this._render();
          }
        });
      });
    }
    const resetBtn = this.el.querySelector('#sk-reset');
    if (this._resetUsed) { resetBtn.style.opacity = '0.4'; resetBtn.style.cursor = 'not-allowed'; }
    this._renderProfiles();
  }

  _renderProfiles() {
    const profEl = this.el.querySelector('#sk-profiles');
    const actEl = this.el.querySelector('#sk-profile-actions');
    if (!profEl || !actEl) return;
    const names = ['\u69fd1', '\u69fd2', '\u69fd3'];
    let html = '';
    for (const n of names) {
      const has = this.skill.hasProfile(n);
      const bg = has ? 'rgba(74,222,128,.1)' : 'rgba(58,58,74,.15)';
      const border = has ? '#4ade80' : '#3a3a4a';
      const clr = has ? '#4ade80' : '#888';
      html += '<div class="sk-prof" data-prof="' + n + '" style="background:' + bg + ';border:1px solid ' + border + ';border-radius:6px;padding:8px;text-align:center;cursor:pointer;color:' + clr + ';font-size:12px;">' + n + (has ? ' \u2713' : '') + '</div>';
    }
    profEl.innerHTML = html;
    profEl.querySelectorAll('[data-prof]').forEach(el => {
      el.addEventListener('click', () => { this._activeProf = el.dataset.prof; this._renderProfiles(); });
    });
    if (!this._activeProf) this._activeProf = '\u69fd1';
    const active = this._activeProf;
    const hasActive = this.skill.hasProfile(active);
    let actHtml = '';
    actHtml += '<button id="sk-prof-save" style="flex:1;padding:8px;background:#3a4a5a;border:1px solid #4a8;border-radius:6px;color:#aef;cursor:pointer;font-size:12px;font-family:inherit;">\u4fdd\u5b58\u5230' + active + '</button>';
    actHtml += '<button id="sk-prof-load" style="flex:1;padding:8px;background:#3a5a4a;border:1px solid #4a8;border-radius:6px;color:#afa;cursor:pointer;font-size:12px;font-family:inherit;"' + (hasActive ? '' : ' disabled') + '>\u52a0\u8f7d' + active + '</button>';
    actHtml += '<button id="sk-prof-del" style="flex:1;padding:8px;background:#5a3a3a;border:1px solid #a44;border-radius:6px;color:#faa;cursor:pointer;font-size:12px;font-family:inherit;"' + (hasActive ? '' : ' disabled') + '>\u5220\u9664' + active + '</button>';
    actEl.innerHTML = actHtml;
    const saveBtn = actEl.querySelector('#sk-prof-save');
    const loadBtn = actEl.querySelector('#sk-prof-load');
    const delBtn = actEl.querySelector('#sk-prof-del');
    if (saveBtn) saveBtn.addEventListener('click', () => { this.skill.saveProfile(active); this.bus.emit(EV.HUD_FLASH, { text: '\u5df2\u4fdd\u5b58\u5230 ' + active }); this._render(); });
    if (loadBtn) loadBtn.addEventListener('click', () => { if (this.skill.loadProfile(active)) { this.bus.emit(EV.HUD_FLASH, { text: '\u5df2\u52a0\u8f7d ' + active }); this._render(); } });
    if (delBtn) delBtn.addEventListener('click', () => { this.skill.deleteProfile(active); this.bus.emit(EV.HUD_FLASH, { text: '\u5df2\u5220\u9664 ' + active }); this._render(); });
    profEl.querySelectorAll('[data-prof]').forEach(el => {
      if (el.dataset.prof === active) { el.style.outline = '2px solid #ffd070'; el.style.outlineOffset = '-2px'; }
    });
  }

  _nextDesc(key) {
    const map = { power: '+10% \u4f24\u5bb3', vigor: '+20 \u8840\u91cf', agility: '+20 \u8010\u529b +0.05s iFrame', mastery: '+15% \u5f53\u524d\u6b66\u5668' };
    return map[key] || '';
  }

  _flash(el) {
    el.style.transition = 'none';
    el.style.boxShadow = '0 0 24px rgba(255,208,112,.8)';
    requestAnimationFrame(() => { el.style.transition = 'all .4s'; el.style.boxShadow = '0 0 12px rgba(255,208,112,.3)'; });
  }

  _reset() {
    if (this._resetUsed) return;
    this._resetUsed = true;
    this.skill.reset();
    this.bus.emit(EV.HUD_FLASH, { text: '\u6280\u80fd\u70b9\u5df2\u8fd4\u8fd8' });
    this._render();
  }
}
