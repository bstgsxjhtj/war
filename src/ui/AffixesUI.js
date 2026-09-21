import { AFFIX_TYPES } from '../gameplay/Affixes.js';
import { UIPanel } from './UIPanel.js';

export class AffixesUI extends UIPanel {
  constructor(affixes, player) {
    super({ id: 'affixes-panel', toggleKey: 'KeyI' });
    this.affixes = affixes;
    this.player = player;
  }

  render() {
    if (!this.player || !this.player.weapon) { this.el.innerHTML = '<h3>词条</h3>无武器'; return; }
    const w = this.player.weapon;
    const tierColors = ['#ccc', '#4af', '#fa4'];
    const tierNames = ['普通', '精良', '史诗'];
    let html = '<h3 style="color:#ffd070">词条 · ' + w.name + '</h3>';
    html += '<div style="margin-bottom:8px">当前武器词条槽：</div>';
    for (let i = 0; i < 2; i++) {
      const a = w.affixes[i];
      if (a) {
        const t = AFFIX_TYPES[a.type];
        html += `<div style="color:${tierColors[a.tier]};border:1px solid #444;padding:4px;margin:2px">[${i + 1}] ${a.type} ${tierNames[a.tier]} (${t.tiers[a.tier]})</div>`;
      } else {
        html += `<div style="color:#666;border:1px dashed #444;padding:4px;margin:2px">[${i + 1}] (空槽)</div>`;
      }
    }
    html += '<div style="margin-top:12px;margin-bottom:4px;color:#aaa">词条背包（' + this.affixes.inventory.length + '/20）：</div>';
    if (this.affixes.inventory.length === 0) {
      html += '<div style="color:#555">空</div>';
    } else {
      this.affixes.inventory.forEach((a) => {
        const t = AFFIX_TYPES[a.type];
        html += `<div style="color:${tierColors[a.tier]};border:1px solid #333;padding:2px;margin:1px;font-size:12px">${a.type} ${tierNames[a.tier]}</div>`;
      });
    }
    this.el.innerHTML = html;
  }
}
