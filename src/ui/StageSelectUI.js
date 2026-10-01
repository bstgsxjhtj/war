import { UIStack } from './UIStack.js';
import { STAGES } from '../gameplay/CampaignMode.js';
import { MapGenerator } from '../world/MapGenerator.js';

const WEATHER_LABEL = { clear: '晴', rain: '雨', snow: '雪', storm: '雷暴' };
const OBJECTIVE_LABEL = {
  '全灭': '全灭敌人', '攻破城门': '攻破城门', 'Boss': '击败 Boss', '护送': '护送目标',
  '防御': '坚守阵地', '生存': '生存挑战', 'Boss限时': '限时击杀 Boss',
};
const DIFF_LABEL = { easy: '简单', normal: '普通', hard: '困难' };
const DIFF_ORDER = ['easy', 'normal', 'hard'];
const MAP_KEYS = Object.keys(MapGenerator.MAPS);

function difficultyStars(d) {
  const n = Math.round(d * 2);
  return '★'.repeat(Math.min(n, 5)) + '☆'.repeat(Math.max(0, 5 - n));
}

// 选关/地图面板：战役选关（10 关解锁进度）+ 自由对战（地图 + 难度选择）
export class StageSelectUI {
  constructor(opts = {}) {
    this.opts = opts;
    this.el = null;
    this._tab = 'campaign';
    this._selecting = false;
    this._campaignCards = [];
    this._diffBtns = new Map();
    this._build();
  }

  _build() {
    const overlay = document.createElement('div');
    overlay.id = 'stageSelectUI';
    Object.assign(overlay.style, {
      position: 'fixed', inset: '0', background: 'rgba(6,9,14,0.94)', display: 'none',
      alignItems: 'center', justifyContent: 'center', zIndex: '9300',
      fontFamily: 'Segoe UI, sans-serif', color: '#e0d8c8', overflow: 'auto',
    });

    const panel = document.createElement('div');
    Object.assign(panel.style, {
      background: '#161c26', border: '1px solid #3a4a60', borderRadius: '14px',
      padding: '24px 28px', width: '820px', maxWidth: '94vw', maxHeight: '90vh', overflow: 'auto',
      boxShadow: '0 16px 48px rgba(0,0,0,0.6)',
    });
    panel.addEventListener('click', (e) => e.stopPropagation());
    overlay.appendChild(panel);

    const title = document.createElement('div');
    Object.assign(title.style, { fontSize: '22px', fontWeight: '700', letterSpacing: '2px', textAlign: 'center', marginBottom: '4px' });
    title.textContent = '选关与地图';
    panel.appendChild(title);

    const subtitle = document.createElement('div');
    Object.assign(subtitle.style, { fontSize: '12px', opacity: '0.55', textAlign: 'center', marginBottom: '16px' });
    subtitle.textContent = '战役模式逐关解锁 · 自由对战可选地图与难度';
    panel.appendChild(subtitle);

    const tabRow = document.createElement('div');
    Object.assign(tabRow.style, { display: 'flex', gap: '8px', marginBottom: '16px', justifyContent: 'center' });
    const mkTab = (key, text) => {
      const t = document.createElement('button');
      t.dataset.tab = key;
      Object.assign(t.style, {
        fontFamily: 'inherit', cursor: 'pointer', borderRadius: '8px', padding: '8px 20px',
        fontSize: '14px', fontWeight: '600', border: '1px solid #3a4a60', background: 'rgba(30,40,55,0.9)',
        color: '#e0d8c8', transition: 'all 0.15s',
      });
      t.textContent = text;
      t.addEventListener('click', () => this._switchTab(key));
      tabRow.appendChild(t);
      return t;
    };
    this._tabCampaign = mkTab('campaign', '战役选关');
    this._tabFree = mkTab('free', '自由对战');
    panel.appendChild(tabRow);

    this._campaignSection = this._buildCampaignSection();
    panel.appendChild(this._campaignSection);
    this._freeSection = this._buildFreeSection();
    panel.appendChild(this._freeSection);

    const backBtn = document.createElement('button');
    backBtn.dataset.action = 'back';
    Object.assign(backBtn.style, {
      fontFamily: 'inherit', cursor: 'pointer', borderRadius: '8px', padding: '10px 24px',
      fontSize: '14px', color: '#fff', border: '1px solid rgba(255,255,255,0.12)', background: '#2a3a4a',
      marginTop: '18px', display: 'block', marginInline: 'auto',
    });
    backBtn.textContent = '返回主菜单';
    backBtn.addEventListener('click', () => this.hide());
    panel.appendChild(backBtn);

    overlay.addEventListener('click', () => this.hide());
    document.body.appendChild(overlay);
    this.el = overlay;
    this._switchTab('campaign');
  }

  _buildCampaignSection() {
    const section = document.createElement('div');
    const grid = document.createElement('div');
    Object.assign(grid.style, { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: '10px' });

    for (let i = 0; i < STAGES.length; i++) {
      const s = STAGES[i];
      const card = document.createElement('div');
      Object.assign(card.style, {
        borderRadius: '10px', padding: '12px', background: 'rgba(30,40,55,0.9)',
        border: '1px solid #3a4a60', cursor: 'pointer', transition: 'all 0.15s',
        display: 'flex', flexDirection: 'column', gap: '4px', position: 'relative',
      });
      const mapName = (MapGenerator.MAPS[s.mapKey] || {}).name || s.mapKey;
      const head = document.createElement('div');
      Object.assign(head.style, { fontSize: '13px', fontWeight: '700', color: '#ffd070' });
      head.textContent = `第${i + 1}关 · ${s.name}`;
      card.appendChild(head);
      const map = document.createElement('div');
      Object.assign(map.style, { fontSize: '11px', opacity: '0.7' });
      map.textContent = `${mapName} · ${WEATHER_LABEL[s.weather] || s.weather}`;
      card.appendChild(map);
      const obj = document.createElement('div');
      Object.assign(obj.style, { fontSize: '11px', opacity: '0.6' });
      obj.textContent = OBJECTIVE_LABEL[s.objective] || s.objective;
      card.appendChild(obj);
      const diff = document.createElement('div');
      Object.assign(diff.style, { fontSize: '10px', color: '#e0b050', letterSpacing: '1px' });
      diff.textContent = difficultyStars(s.difficulty);
      card.appendChild(diff);

      card.addEventListener('mouseenter', () => { if (!card.dataset.locked) { card.style.borderColor = '#e0b050'; card.style.transform = 'translateY(-2px)'; } });
      card.addEventListener('mouseleave', () => { card.style.borderColor = '#3a4a60'; card.style.transform = ''; });
      card.addEventListener('click', () => {
        if (card.dataset.locked === '1') return;
        this._selecting = true;
        this.hide();
        if (this.opts.onStageSelect) this.opts.onStageSelect(i);
      });

      grid.appendChild(card);
      this._campaignCards.push({ card, index: i });
    }
    section.appendChild(grid);
    return section;
  }

  _buildFreeSection() {
    const section = document.createElement('div');

    const diffLabel = document.createElement('div');
    Object.assign(diffLabel.style, { fontSize: '13px', fontWeight: '600', marginBottom: '8px', opacity: '0.85' });
    diffLabel.textContent = '难度';
    section.appendChild(diffLabel);

    const diffRow = document.createElement('div');
    Object.assign(diffRow.style, { display: 'flex', gap: '8px', marginBottom: '18px' });
    for (const key of DIFF_ORDER) {
      const b = document.createElement('button');
      b.dataset.diff = key;
      Object.assign(b.style, {
        fontFamily: 'inherit', cursor: 'pointer', borderRadius: '8px', padding: '8px 18px',
        fontSize: '14px', fontWeight: '600', border: '1px solid #3a4a60', background: 'rgba(30,40,55,0.9)',
        color: '#e0d8c8', transition: 'all 0.15s',
      });
      b.textContent = DIFF_LABEL[key];
      b.addEventListener('click', () => { if (this.opts.onDifficultyChange) this.opts.onDifficultyChange(key); this._refreshDiff(); });
      diffRow.appendChild(b);
      this._diffBtns.set(key, b);
    }
    section.appendChild(diffRow);

    const mapLabel = document.createElement('div');
    Object.assign(mapLabel.style, { fontSize: '13px', fontWeight: '600', marginBottom: '8px', opacity: '0.85' });
    const modeName = this.opts.getModeName ? this.opts.getModeName() : '';
    mapLabel.textContent = `地图（当前模式：${modeName || '波次'}）`;
    section.appendChild(mapLabel);

    const grid = document.createElement('div');
    Object.assign(grid.style, { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '10px' });
    for (const key of MAP_KEYS) {
      const def = MapGenerator.MAPS[key];
      const card = document.createElement('div');
      Object.assign(card.style, {
        borderRadius: '10px', padding: '14px 12px', background: 'rgba(30,40,55,0.9)',
        border: '1px solid #3a4a60', cursor: 'pointer', transition: 'all 0.15s', textAlign: 'center',
      });
      const name = document.createElement('div');
      Object.assign(name.style, { fontSize: '15px', fontWeight: '700' });
      name.textContent = def.name;
      card.appendChild(name);
      const size = document.createElement('div');
      Object.assign(size.style, { fontSize: '10px', opacity: '0.5', marginTop: '4px' });
      size.textContent = `${def.size[0]}×${def.size[1]}`;
      card.appendChild(size);
      card.addEventListener('mouseenter', () => { card.style.borderColor = '#e0b050'; card.style.transform = 'translateY(-2px)'; });
      card.addEventListener('mouseleave', () => { card.style.borderColor = '#3a4a60'; card.style.transform = ''; });
      card.addEventListener('click', () => {
        this._selecting = true;
        this.hide();
        if (this.opts.onMapSelect) this.opts.onMapSelect(key);
      });
      grid.appendChild(card);
    }
    section.appendChild(grid);
    return section;
  }

  _switchTab(tab) {
    this._tab = tab;
    const isCampaign = tab === 'campaign';
    this._campaignSection.style.display = isCampaign ? 'block' : 'none';
    this._freeSection.style.display = isCampaign ? 'none' : 'block';
    this._tabCampaign.style.borderColor = isCampaign ? '#e0b050' : '#3a4a60';
    this._tabCampaign.style.background = isCampaign ? 'rgba(60,50,25,0.95)' : 'rgba(30,40,55,0.9)';
    this._tabCampaign.style.color = isCampaign ? '#ffd070' : '#e0d8c8';
    this._tabFree.style.borderColor = !isCampaign ? '#e0b050' : '#3a4a60';
    this._tabFree.style.background = !isCampaign ? 'rgba(60,50,25,0.95)' : 'rgba(30,40,55,0.9)';
    this._tabFree.style.color = !isCampaign ? '#ffd070' : '#e0d8c8';
    if (isCampaign) this.refresh();
    else this._refreshDiff();
  }

  _refreshDiff() {
    const cur = this.opts.getDifficulty ? this.opts.getDifficulty() : 'normal';
    for (const [key, b] of this._diffBtns) {
      const active = key === cur;
      b.style.borderColor = active ? '#e0b050' : '#3a4a60';
      b.style.background = active ? 'rgba(60,50,25,0.95)' : 'rgba(30,40,55,0.9)';
      b.style.color = active ? '#ffd070' : '#e0d8c8';
    }
  }

  refresh() {
    const cleared = this.opts.getCleared ? this.opts.getCleared() : 0;
    for (const { card, index } of this._campaignCards) {
      const unlocked = index <= cleared;
      card.dataset.locked = unlocked ? '0' : '1';
      card.style.opacity = unlocked ? '1' : '0.4';
      card.style.cursor = unlocked ? 'pointer' : 'not-allowed';
    }
  }

  show() {
    this._selecting = false;
    this._switchTab(this._tab);
    this.el.style.display = 'flex';
    UIStack.push(this);
  }

  hide() {
    this.el.style.display = 'none';
    UIStack.remove(this);
    if (!this._selecting && this.opts.onBack) this.opts.onBack();
    this._selecting = false;
  }

  dispose() {
    this.hide();
    if (this.el) { this.el.remove(); this.el = null; }
  }
}
