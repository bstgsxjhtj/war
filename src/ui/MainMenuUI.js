import { UIStack } from './UIStack.js';

// 主菜单/标题屏：启动时首个展示的面板（开始新游戏/继续战役/快速对战/设置）
// closable=false：Escape 被吞掉但不关闭标题屏（避免误关后无路可走）
export class MainMenuUI {
  constructor(opts = {}) {
    this.opts = opts;
    this.closable = false;
    this.pausesGame = true; // 战役一#7：标题屏打开时冻结 gameplay（从结算屏/GameMenu 回主菜单时暂停后台对战）
    this.el = null;
    this._continueBtn = null;
    this._build();
  }

  _build() {
    const overlay = document.createElement('div');
    overlay.id = 'mainMenuUI';
    Object.assign(overlay.style, {
      position: 'fixed', top: '0', left: '0', width: '100vw', height: '100vh',
      background: 'radial-gradient(ellipse at center, rgba(22,30,42,0.96), rgba(6,9,14,0.99))',
      display: 'none', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      zIndex: '9500', fontFamily: 'Segoe UI, sans-serif', color: '#e0d8c8',
    });

    const title = document.createElement('div');
    Object.assign(title.style, { fontSize: '52px', fontWeight: '900', letterSpacing: '8px', marginBottom: '8px', textShadow: '0 4px 24px rgba(0,0,0,0.85)' });
    title.textContent = 'Q版战场';
    overlay.appendChild(title);

    const subtitle = document.createElement('div');
    Object.assign(subtitle.style, { fontSize: '14px', opacity: '0.5', marginBottom: '44px', letterSpacing: '3px' });
    subtitle.textContent = '即时战术 · 多模式对战';
    overlay.appendChild(subtitle);

    const col = document.createElement('div');
    Object.assign(col.style, { display: 'flex', flexDirection: 'column', gap: '14px', width: '340px' });

    const mk = (action, text, bg) => {
      const b = document.createElement('button');
      b.dataset.action = action;
      Object.assign(b.style, {
        fontFamily: 'inherit', cursor: 'pointer', borderRadius: '10px',
        padding: '15px 20px', fontSize: '18px', fontWeight: '600', color: '#fff',
        border: '1px solid rgba(255,255,255,0.12)', background: bg,
        transition: 'transform .15s, box-shadow .15s, filter .15s',
      });
      b.textContent = text;
      b.addEventListener('mouseenter', () => { if (b.disabled) return; b.style.transform = 'translateY(-2px)'; b.style.boxShadow = '0 6px 20px rgba(0,0,0,0.45)'; b.style.filter = 'brightness(1.15)'; });
      b.addEventListener('mouseleave', () => { b.style.transform = ''; b.style.boxShadow = ''; b.style.filter = ''; });
      return b;
    };

    const newBtn = mk('new', '开始新游戏', '#3a5a3a');
    const conBtn = mk('continue', '继续战役', '#365070');
    const stageBtn = mk('stageselect', '选关/地图', '#4a4a3a');
    const setBtn = mk('settings', '设置', '#3a3a4a');

    newBtn.addEventListener('click', () => { this.hide(); if (this.opts.onNewGame) this.opts.onNewGame(); });
    conBtn.addEventListener('click', () => { if (conBtn.disabled) return; this.hide(); if (this.opts.onContinue) this.opts.onContinue(); });
    stageBtn.addEventListener('click', () => { this.hide(); if (this.opts.onStageSelect) this.opts.onStageSelect(); });
    setBtn.addEventListener('click', () => { if (this.opts.onOpenSettings) this.opts.onOpenSettings(); });

    col.append(newBtn, conBtn, stageBtn, setBtn);
    overlay.appendChild(col);
    this._continueBtn = conBtn;

    // P1-3 次级入口：成就/词条/存档（不隐藏标题屏，面板叠于其上）
    const subRow = document.createElement('div');
    Object.assign(subRow.style, { display: 'flex', gap: '10px', marginTop: '20px', justifyContent: 'center' });
    const mkSub = (action, text) => {
      const b = document.createElement('button');
      b.dataset.action = action;
      Object.assign(b.style, {
        fontFamily: 'inherit', cursor: 'pointer', borderRadius: '6px', padding: '6px 14px',
        fontSize: '12px', color: '#e0d8c8', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(30,35,45,0.8)',
        transition: 'filter .15s',
      });
      b.textContent = text;
      b.addEventListener('mouseenter', () => { b.style.filter = 'brightness(1.3)'; });
      b.addEventListener('mouseleave', () => { b.style.filter = ''; });
      return b;
    };
    const achBtn = mkSub('achievements', '成就');
    const afxBtn = mkSub('affixes', '词条');
    const savBtn = mkSub('save', '存档');
    const tutBtn = mkSub('tutorial', '操典');
    achBtn.addEventListener('click', () => { if (this.opts.onOpenAchievements) this.opts.onOpenAchievements(); });
    afxBtn.addEventListener('click', () => { if (this.opts.onOpenAffixes) this.opts.onOpenAffixes(); });
    savBtn.addEventListener('click', () => { if (this.opts.onOpenSave) this.opts.onOpenSave(); });
    tutBtn.addEventListener('click', () => { window.open('/tutorial.html', '_blank'); });
    subRow.append(achBtn, afxBtn, savBtn, tutBtn);
    overlay.appendChild(subRow);

    const hint = document.createElement('div');
    Object.assign(hint.style, { fontSize: '11px', opacity: '0.35', marginTop: '36px', textAlign: 'center' });
    hint.textContent = '选择后进入职业选择 · 游戏中 Esc 打开菜单';
    overlay.appendChild(hint);

    document.body.appendChild(overlay);
    this.el = overlay;
  }

  refresh() {
    const hasSave = this.opts.hasSave ? this.opts.hasSave() : false;
    const b = this._continueBtn;
    if (!b) return;
    b.disabled = !hasSave;
    b.style.opacity = hasSave ? '1' : '0.4';
    b.style.cursor = hasSave ? 'pointer' : 'not-allowed';
    if (hasSave) {
      const stage = this.opts.getCampaignStage ? this.opts.getCampaignStage() : 0;
      const cleared = this.opts.getCampaignCleared ? this.opts.getCampaignCleared() : 0;
      const tag = stage > 0 ? `（第${stage + 1}关）` : (cleared > 0 ? `（已通关${cleared}关）` : '');
      b.textContent = '继续战役' + tag;
    } else {
      b.textContent = '继续战役（无存档）';
    }
  }

  show() {
    this.refresh();
    this.el.style.display = 'flex';
    UIStack.push(this);
  }

  hide() {
    this.el.style.display = 'none';
    UIStack.remove(this);
  }

  dispose() {
    this.hide();
    if (this.el) { this.el.remove(); this.el = null; }
  }
}
