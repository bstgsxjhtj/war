import { CLASS_DEFS } from '../gameplay/ClassDefinition.js';
import { RunBuffs, RARITY_COLOR } from '../gameplay/RunBuffs.js';

export class BuildReviewUI {
  constructor(getState) {
    this._getState = getState;
    this.el = null;
    this._build();
  }

  _build() {
    const overlay = document.createElement('div');
    overlay.id = 'buildReviewUI';
    Object.assign(overlay.style, {
      position: 'fixed', top: '0', left: '0', width: '100vw', height: '100vh',
      background: 'rgba(8,12,18,0.88)', display: 'none',
      flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      zIndex: '9998', fontFamily: 'sans-serif', color: '#e0d8c8',
    });
    document.body.appendChild(overlay);
    this.el = overlay;
  }

  _render() {
    const st = this._getState();
    if (!st) return;
    const { selectedClass, player, skills, runBuffs } = st;
    const cls = CLASS_DEFS[selectedClass] || CLASS_DEFS.warrior;
    const hex = '#' + cls.color.toString(16).padStart(6, '0');

    let html = '<div style="font-size:24px;font-weight:bold;margin-bottom:6px;letter-spacing:2px;">Build 路径回顾</div>';
    html += '<div style="font-size:12px;opacity:0.5;margin-bottom:24px;">按 B 关闭</div>';

    html += '<div style="display:flex;gap:24px;max-width:680px;flex-wrap:wrap;justify-content:center;">';

    html += '<div style="width:300px;background:rgba(20,28,40,0.85);border-radius:12px;padding:20px;border:1px solid rgba(80,100,140,0.3);">';
    html += '<div style="font-size:11px;color:' + hex + ';letter-spacing:2px;margin-bottom:8px;">职业</div>';
    html += '<div style="font-size:20px;font-weight:bold;color:' + hex + ';">' + cls.icon + ' ' + cls.name + '</div>';
    html += '<div style="font-size:12px;opacity:0.6;margin-top:6px;">' + cls.desc + '</div>';
    html += '<div style="font-size:11px;opacity:0.5;margin-top:10px;border-top:1px solid rgba(255,255,255,0.1);padding-top:10px;">';
    html += 'HP ' + (cls.stats.maxHp) + ' · 耐力 ' + cls.stats.maxStamina + ' · 速度 ' + cls.stats.speed.toFixed(1);
    html += '</div></div>';

    if (player && player.weapons) {
      html += '<div style="width:300px;background:rgba(20,28,40,0.85);border-radius:12px;padding:20px;border:1px solid rgba(80,100,140,0.3);">';
      html += '<div style="font-size:11px;color:#d4b25a;letter-spacing:2px;margin-bottom:8px;">武器</div>';
      player.weapons.forEach((w, i) => {
        const isCur = player.weaponIdx === i;
        html += '<div style="font-size:14px;margin-bottom:6px;' + (isCur ? 'color:#ffd24a;font-weight:bold;' : 'opacity:0.7;') + '">' + (isCur ? '▶ ' : '  ') + (w.name || w.weaponClass) + '</div>';
      });
      html += '</div>';
    }

    if (skills) {
      const taken = Object.entries(skills.branches).filter(([k, b]) => b.level > 0);
      const baseLvls = Object.entries(skills.skills).filter(([k, s]) => s.level > 0);
      html += '<div style="width:300px;background:rgba(20,28,40,0.85);border-radius:12px;padding:20px;border:1px solid rgba(80,100,140,0.3);">';
      html += '<div style="font-size:11px;color:#5aa0ff;letter-spacing:2px;margin-bottom:8px;">天赋树</div>';
      if (baseLvls.length === 0 && taken.length === 0) {
        html += '<div style="font-size:13px;opacity:0.4;">尚未加点</div>';
      } else {
        baseLvls.forEach(([k, s]) => {
          html += '<div style="font-size:13px;opacity:0.7;margin-bottom:4px;">' + s.name + ' Lv.' + s.level + '</div>';
        });
        taken.forEach(([k, b]) => {
          const clsColor = b.reqClass ? '#' + CLASS_DEFS[b.reqClass].color.toString(16).padStart(6, '0') : '#5aa0ff';
          html += '<div style="font-size:13px;color:' + clsColor + ';margin-bottom:4px;">★ ' + b.name + ' · ' + b.desc + '</div>';
        });
      }
      if (skills.points > 0) {
        html += '<div style="font-size:12px;color:#ffd24a;margin-top:8px;">待分配点数：' + skills.points + '</div>';
      }
      html += '</div>';
    }

    if (runBuffs && runBuffs.picked.length > 0) {
      html += '<div style="width:300px;background:rgba(20,28,40,0.85);border-radius:12px;padding:20px;border:1px solid rgba(80,100,140,0.3);">';
      html += '<div style="font-size:11px;color:#ffd24a;letter-spacing:2px;margin-bottom:8px;">局内升级 (' + runBuffs.picked.length + ')</div>';
      runBuffs.picked.forEach(id => {
        const u = RunBuffs.UPGRADES.find(x => x.id === id);
        if (u) {
          const c = RARITY_COLOR[u.rarity] || '#9a9a9a';
          html += '<div style="font-size:13px;margin-bottom:4px;"><span style="color:' + c + ';font-size:10px;text-transform:uppercase;">' + u.rarity + '</span> <span style="opacity:0.85;">' + u.name + '</span></div>';
        }
      });
      if (runBuffs.rerollsLeft > 0) {
        html += '<div style="font-size:11px;opacity:0.4;margin-top:8px;">剩余重选：' + runBuffs.rerollsLeft + '</div>';
      }
      html += '</div>';
    }

    html += '</div>';
    this.el.innerHTML = html;
  }

  show() { this._render(); if (this.el) this.el.style.display = 'flex'; }
  hide() { if (this.el) this.el.style.display = 'none'; }
  get visible() { return this.el && this.el.style.display !== 'none'; }
  dispose() { if (this.el) { this.el.remove(); this.el = null; } }
}
