// 新手引导：16 步 toast 教程（基础 8 步 + 进阶 8 步），动作/事件推进，仅首局出现
import { EV } from '../core/constants/events.js';
import { LS } from '../core/constants/storage-keys.js';
import { DEFAULT_BINDINGS, keyLabel } from '../core/input/KeyBindings.js';

const FADE = 0.3;
const STEP_TIMEOUT = 10;
const FINAL_HOLD = 2;

export class Tutorial {
  constructor(bus = null, kb = null) {
    this.bus = bus;
    this.kb = kb;
    this.steps = [
      { text: (t) => `① 移动：${t.bindLabel('forward')}${t.bindLabel('left')}${t.bindLabel('back')}${t.bindLabel('right')} 键`, actions: ['forward', 'back', 'left', 'right'] },
      { text: () => '② 攻击：鼠标左键（三段连击）', mouse: [0] },
      { text: () => '③ 格挡：鼠标右键（减伤，完美格挡弹刀）', mouse: [2] },
      { text: (t) => `④ 闪避：${t.bindLabel('dodge')} 键（无敌帧，躲技能）`, actions: ['dodge'] },
      { text: (t) => `⑤ 切换武器：${t.bindLabel('weapon1')}-${t.bindLabel('weapon4')} 数字键（不同手感）`, actions: ['weapon1', 'weapon2', 'weapon3', 'weapon4'] },
      { text: (t) => `⑥ 大招：${t.bindLabel('ultimate')} 键（怒气满时释放，武器专属）`, actions: ['ultimate'], event: EV.COMBAT_ULTIMATE },
      { text: (t) => `⑦ 处决：${t.bindLabel('execute')} 键（敌人残血时处决）`, actions: ['execute'] },
      { text: () => '⑧ 克制：青色伤害数字 = 你克制敌人', event: EV.COMBAT_COUNTER },
      { text: (t) => `⑨ 锁定：${t.bindLabel('lock')} 键锁定敌人（镜头跟随，专注单挑）`, actions: ['lock'] },
      { text: () => '⑩ 连击终结：三段连击第三击触发终结技（大范围伤害）', event: EV.COMBO_FINISHER },
      { text: (t) => `⑪ 技能树：${t.bindLabel('skilltree')} 键加点升级（11 分支，含职业专属）`, actions: ['skilltree'] },
      { text: (t) => `⑫ 词条：${t.bindLabel('affix')} 键管理装备词条（Boss 掉落）`, actions: ['affix'] },
      { text: () => '⑬ 职业：C 键随时切换职业（战士/法师/弓手，武器与技能各不相同）', keys: ['KeyC'] },
      { text: () => '⑭ Build：B 键查看当前职业/武器/天赋/局内升级', keys: ['KeyB'] },
      { text: (t) => `⑮ 战场模式：${t.bindLabel('mode')} 键轮换到「战场」（波次防守 → 攻城破门）`, actions: ['mode'] },
      { text: () => '⑯ Boss：精英有弱点（背刺/近战/打断/远程），Boss 有阶段跃迁（血条下提示弱点）', event: EV.HUD_BOSSPHASE },
    ];
    this.step = 0;
    this.active = true;
    this.final = false;
    this.phase = 'in';
    this.phaseT = FADE;
    this.el = document.createElement('div');
    Object.assign(this.el.style, {
      position: 'fixed', bottom: '90px', left: '50%', transform: 'translateX(-50%)',
      background: 'rgba(30,30,46,.95)', border: '1px solid #6b5', borderLeft: '4px solid #ffd070',
      borderRadius: '10px', padding: '10px 18px', color: '#eee', fontSize: '14px', zIndex: 50,
      fontFamily: 'Segoe UI, sans-serif', boxShadow: '0 4px 16px rgba(0,0,0,.5)', textAlign: 'center',
      maxWidth: '560px', opacity: '0', transition: 'none', pointerEvents: 'none',
    });
    document.body.appendChild(this.el);
    this._bind();
    this._render();
  }

  _bind() {
    this._onKey = (e) => this._match({ k: 'key', code: e.code });
    this._onMouse = (e) => this._match({ k: 'mouse', btn: e.button });
    window.addEventListener('keydown', this._onKey);
    window.addEventListener('mousedown', this._onMouse);
    if (this.bus) {
      this._offUlt = this.bus.on(EV.COMBAT_ULTIMATE, () => this._match({ k: 'event', name: EV.COMBAT_ULTIMATE }));
      this._offCnt = this.bus.on(EV.COMBAT_COUNTER, () => this._match({ k: 'event', name: EV.COMBAT_COUNTER }));
      this._offFin = this.bus.on(EV.COMBO_FINISHER, () => this._match({ k: 'event', name: EV.COMBO_FINISHER }));
      this._offBoss = this.bus.on(EV.HUD_BOSSPHASE, () => this._match({ k: 'event', name: EV.HUD_BOSSPHASE }));
    }
  }

  bindCode(action) { return this.kb ? this.kb.get(action) : DEFAULT_BINDINGS[action]; }
  bindLabel(action) { return this.keyLabel(this.bindCode(action)); }
  keyLabel(code) { return keyLabel(code); }

  _match(a) {
    if (!this.active) return;
    const s = this.steps[this.step];
    let hit = false;
    if (a.k === 'key') {
      if (s.keys && s.keys.includes(a.code)) hit = true;
      if (!hit && s.actions) {
        for (const act of s.actions) { if (this.bindCode(act) === a.code) { hit = true; break; } }
      }
    }
    if (a.k === 'mouse' && s.mouse && s.mouse.includes(a.btn)) hit = true;
    if (a.k === 'event' && s.event === a.name) hit = true;
    if (hit) this._advance();
  }

  _advance() {
    this.step++;
    if (this.step >= this.steps.length) { this._finish(); return; }
    this.phase = 'in';
    this.phaseT = FADE;
    this._render();
  }

  _finish() {
    this.active = false;
    this.final = true;
    this.phase = 'hold';
    this.phaseT = FINAL_HOLD;
    this.el.style.opacity = '1';
    try { localStorage.setItem(LS.TUTORIAL_DONE, '1'); } catch (e) {}
    this._renderFinal();
  }

  _render() {
    const step = this.steps[this.step];
    const progress = `${this.step + 1}/${this.steps.length}`;
    const msg = typeof step.text === 'function' ? step.text(this) : (step.msg || '');
    this.el.innerHTML = `<div style="color:#ffd070;font-weight:600;margin-bottom:3px;">新手引导（${progress}）</div><div>${msg}</div>`;
  }

  _renderFinal() {
    const lock = this.bindLabel('lock');
    const dodge = this.bindLabel('dodge');
    const exec = this.bindLabel('execute');
    const sk = this.bindLabel('skilltree');
    const md = this.bindLabel('mode');
    const wt = this.bindLabel('weather');
    const st = this.bindLabel('settings');
    this.el.innerHTML = `<div style="color:#4ade80;font-weight:600;">✓ 引导完成！${lock} 锁定 · ${dodge} 闪避 · ${exec} 处决 · C 职业 · B Build · ${sk} 技能树 · ${md} 模式 · ${wt} 天气 · ${st} 设置</div>`;
  }

  update(dt) {
    if (!this.active && !this.final) return;
    this.phaseT -= dt;
    if (this.phase === 'in') {
      const op = Math.max(0, Math.min(1, 1 - this.phaseT / FADE));
      this.el.style.opacity = String(op);
      if (this.phaseT <= 0) { this.phase = 'hold'; this.phaseT = this.final ? FINAL_HOLD : STEP_TIMEOUT; this.el.style.opacity = '1'; }
    } else if (this.phase === 'hold') {
      this.el.style.opacity = '1';
      if (this.phaseT <= 0) {
        if (this.final) { this.el.style.display = 'none'; }
        else this._advance();
      }
    }
  }

  destroy() {
    window.removeEventListener('keydown', this._onKey);
    window.removeEventListener('mousedown', this._onMouse);
    if (this._offUlt) this._offUlt();
    if (this._offCnt) this._offCnt();
    if (this._offFin) this._offFin();
    if (this._offBoss) this._offBoss();
    if (this.el.parentNode) this.el.parentNode.removeChild(this.el);
  }
}
