import { EV } from '../core/constants/events.js';

// 限时 buff 时长上限（与 gameplay 侧初始值一致）
const PERFECT_BUFF_DUR = 2;   // 完美闪避增益
const KILLSTREAK_DUR = 5;     // 连杀增益

// HUD：血条/耐力/连击/锁定/据点/模式/击杀横幅（地图信息统一由 MiniMap 承担）
export class HUD {
  constructor(bus) {
    this.bus = bus;
    this._unsubs = [];
    const on = (ev, fn) => this._unsubs.push(bus.on(ev, fn));
    this._endLocked = false;
    this._reducedMotion = false;
    this._killTimer = 0;
    this._hitVigTimer = 0;
    this._comboPulseTimer = 0;
    this._bossPhaseTimer = 0;
    this._execBannerTimer = 0;
    this._parryTimer = 0;
    this.el = document.createElement('div');
    Object.assign(this.el.style, { position: 'fixed', inset: '0', pointerEvents: 'none', zIndex: 10, fontFamily: 'Segoe UI, sans-serif' });
    this.el.innerHTML = `
      <div id="locklost" style="position:absolute;inset:0;background:rgba(0,0,0,.6);display:none;align-items:center;justify-content:center;color:#fff;font-size:22px;text-shadow:0 1px 3px #000;pointer-events:auto;cursor:pointer;">点击此处恢复操控</div>
      <div id="cross" style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:26px;height:26px;">
        <div style="position:absolute;top:12px;left:0;width:26px;height:2px;background:rgba(255,235,180,.9);box-shadow:0 0 4px #000;"></div>
        <div style="position:absolute;left:12px;top:0;width:2px;height:26px;background:rgba(255,235,180,.9);box-shadow:0 0 4px #000;"></div>
        <div id="comboRing" style="position:absolute;inset:-4px;border-radius:50%;border:2px solid transparent;"></div>
      </div>
      <div id="charge" style="position:absolute;top:56%;left:50%;transform:translateX(-50%);width:180px;height:8px;background:rgba(0,0,0,.5);border-radius:4px;overflow:hidden;display:none;border:1px solid #456;">
        <div id="chargeFill" style="width:0;height:100%;background:linear-gradient(90deg,#ffd070,#ff5533);"></div>
      </div>
      <div style="position:absolute;left:150px;bottom:24px;width:280px;">
        <div style="font-size:12px;color:#cfe;text-shadow:0 1px 2px #000;margin-bottom:4px;">生命</div>
        <div style="background:rgba(0,0,0,.5);border:1px solid #456;border-radius:6px;overflow:hidden;height:20px;box-shadow:inset 0 0 6px #000;">
          <div id="hp" style="width:100%;height:100%;background:linear-gradient(90deg,#d33,#f70);transition:width .12s;"></div>
        </div>
        <div style="font-size:11px;color:#aef;text-shadow:0 1px 2px #000;margin:4px 0 2px;">耐力</div>
        <div style="background:rgba(0,0,0,.5);border:1px solid #356;border-radius:6px;overflow:hidden;height:12px;">
          <div id="stam" style="width:100%;height:100%;background:linear-gradient(90deg,#3ad,#8ef);transition:width .1s;"></div>
        </div>
        <div style="font-size:11px;color:#fa8;text-shadow:0 1px 2px #000;margin:4px 0 2px;">怒气</div>
        <div style="background:rgba(0,0,0,.5);border:1px solid #642;border-radius:6px;overflow:hidden;height:12px;">
          <div id="rage" style="width:0;height:100%;background:linear-gradient(90deg,#a30,#fa4);transition:width .1s;"></div>
        </div>
      </div>
      <div id="score" style="position:absolute;top:18px;left:50%;transform:translateX(-50%);color:#eee;font-size:18px;text-shadow:0 1px 2px #000;">蓝方 0  |  0 红方</div>
      <div id="round" style="position:absolute;top:42px;left:50%;transform:translateX(-50%);color:#ffd070;font-size:13px;text-shadow:0 1px 2px #000;"></div>
      <div id="modeName" style="position:absolute;top:62px;left:50%;transform:translateX(-50%);color:#8cf;font-size:12px;text-shadow:0 1px 2px #000;">模式：死斗</div>
      <div id="dom" style="position:absolute;top:84px;left:50%;transform:translateX(-50%);display:none;color:#fff;font-size:12px;text-shadow:0 1px 2px #000;text-align:center;"></div>
      <div id="wforecast" style="position:absolute;top:106px;left:50%;transform:translateX(-50%);color:#8df;font-size:12px;text-shadow:0 1px 2px #000;display:none;"></div>
      <div id="weapon" style="position:absolute;right:24px;bottom:24px;color:#cde;font-size:14px;text-shadow:0 1px 2px #000;">[1] 刀  [2] 弓</div>
      <div id="keys" style="position:absolute;right:24px;bottom:48px;color:#bcd;font-size:11px;text-shadow:0 1px 2px #000;opacity:.6;text-align:right;line-height:1.6;">WASD · Shift冲刺 · Space跳<br>Q/双击 闪避 · LMB攻击 · RMB格挡/蓄力 · E处决 · F技能 · T终极 · Tab锁定 · 1-4武器 · M模式</div>
      <div id="hint" style="position:absolute;top:62%;left:50%;transform:translateX(-50%);color:#ffd;text-align:center;font-size:15px;text-shadow:0 1px 2px #000;max-width:80%;"></div>
      <div id="kill" style="position:absolute;top:30%;left:50%;transform:translateX(-50%);color:#ffd070;font-size:26px;font-weight:bold;text-shadow:0 2px 4px #000;opacity:0;transition:opacity .2s;"></div>
      <div id="buffbar" style="position:absolute;bottom:80px;left:50%;transform:translateX(-50%);display:flex;gap:8px;font-size:12px;text-shadow:0 1px 2px #000;display:none;"></div>
      <div id="bossbar" style="position:absolute;top:40px;left:50%;transform:translateX(-50%);display:none;flex-direction:column;align-items:center;gap:4px;"><div id="bossName" style="color:#ff8080;font-size:16px;font-weight:bold;text-shadow:0 2px 4px #000;"></div><div style="position:relative;width:300px;height:10px;background:rgba(0,0,0,0.5);border:1px solid #600;border-radius:5px;overflow:hidden;"><div id="bossFill" style="height:100%;width:100%;background:linear-gradient(90deg,#c33,#f66);transition:width .15s;"></div><div style="position:absolute;top:0;bottom:0;left:60%;width:2px;background:rgba(255,255,255,.45);"></div><div style="position:absolute;top:0;bottom:0;left:30%;width:2px;background:rgba(255,255,255,.45);"></div></div><div id="bossPips" style="color:#ffb0b0;font-size:11px;letter-spacing:3px;text-shadow:0 1px 2px #000;"></div></div>
      <div id="lowhp" style="position:fixed;inset:0;pointer-events:none;background:radial-gradient(ellipse at center,transparent 50%,rgba(180,0,0,0.25) 100%);display:none;animation:lowhp-pulse 1.2s ease-in-out infinite;"></div>
      <div id="hitvignette" style="position:fixed;inset:0;pointer-events:none;background:radial-gradient(ellipse at center,transparent 40%,rgba(200,0,0,0.55) 100%);opacity:0;"></div>
      <div id="combopulse" style="position:fixed;inset:0;pointer-events:none;background:radial-gradient(ellipse at center,rgba(255,235,150,0.3) 0%,transparent 60%);opacity:0;"></div>
      <div id="bossphase" style="position:absolute;top:22%;left:50%;transform:translateX(-50%);color:#ff5533;font-size:30px;font-weight:bold;text-shadow:0 2px 6px #000,0 0 12px rgba(255,40,40,.6);opacity:0;pointer-events:none;"></div>
      <div id="execute" style="position:absolute;top:34%;left:50%;transform:translateX(-50%);color:#ffd700;font-size:36px;font-weight:bold;text-shadow:0 2px 8px #000,0 0 16px rgba(255,215,0,.7);opacity:0;pointer-events:none;"></div>
      <div id="parryflash" style="position:absolute;top:28%;left:50%;transform:translateX(-50%);color:#ffe98a;font-size:32px;font-weight:bold;text-shadow:0 2px 8px #000,0 0 18px rgba(255,215,0,.9);opacity:0;pointer-events:none;"></div>
      <div id="parryglow" style="position:fixed;inset:0;pointer-events:none;background:radial-gradient(ellipse at center,rgba(255,240,180,0.35) 0%,transparent 55%);opacity:0;"></div>
      <style>@keyframes lowhp-pulse{0%,100%{opacity:0.5}50%{opacity:1}}</style>
    `;
    document.body.appendChild(this.el);
    this._locklost = this.el.querySelector('#locklost');
    this._hp = this.el.querySelector('#hp');
    this._stam = this.el.querySelector('#stam');
    this._rage = this.el.querySelector('#rage');
    this._postureBar = document.createElement('div');
    this._postureBar.style.cssText = 'position:absolute;left:20px;bottom:76px;width:180px;height:5px;background:rgba(0,0,0,0.5);border-radius:3px;overflow:hidden;display:none;z-index:5;';
    this.el.appendChild(this._postureBar);
    this._postureFill = document.createElement('div');
    this._postureFill.style.cssText = 'width:0%;height:100%;background:linear-gradient(90deg,#c88,#fa4);transition:width 0.1s;';
    this._postureBar.appendChild(this._postureFill);
    this._score = this.el.querySelector('#score');
    this._round = this.el.querySelector('#round');
    this._modeName = this.el.querySelector('#modeName');
    this._dom = this.el.querySelector('#dom');
    this._wforecast = this.el.querySelector('#wforecast');
    this._hint = this.el.querySelector('#hint');
    this._kill = this.el.querySelector('#kill');
    this._buffbar = this.el.querySelector('#buffbar');
    this._bossbar = this.el.querySelector('#bossbar');
    this._bossFill = this.el.querySelector('#bossFill');
    this._bossPips = this.el.querySelector('#bossPips');
    this._lowhp = this.el.querySelector('#lowhp');
    this._hitvignette = this.el.querySelector('#hitvignette');
    this._combopulse = this.el.querySelector('#combopulse');
    this._bossphase = this.el.querySelector('#bossphase');
    this._execute = this.el.querySelector('#execute');
    this._parryflash = this.el.querySelector('#parryflash');
    this._parryglow = this.el.querySelector('#parryglow');
    this._charge = this.el.querySelector('#charge');
    this._chargeFill = this.el.querySelector('#chargeFill');
    this._weapon = this.el.querySelector('#weapon');
    this._comboRing = this.el.querySelector('#comboRing');

    this._errEl = document.createElement('div');
    Object.assign(this._errEl.style, {
      position: 'fixed', top: '18px', right: '18px', zIndex: '15',
      fontFamily: 'Segoe UI, sans-serif', fontSize: '14px', color: '#f44',
      textShadow: '0 0 6px #000', display: 'none', opacity: '0',
      transition: 'opacity .3s', pointerEvents: 'none', fontWeight: 'bold'
    });
    this._errEl.innerHTML = '\u26A0 <span class="err-count">0</span>';
    document.body.appendChild(this._errEl);
    this._errCount = 0;
    this._errTimer = 0;
    this._errLog = [];

    this._errPanel = document.createElement('div');
    Object.assign(this._errPanel.style, {
      position: 'fixed', top: '50px', right: '18px', zIndex: '16',
      width: '360px', maxHeight: '60vh', overflowY: 'auto', display: 'none',
      background: 'rgba(15,15,25,.95)', color: '#fbb', fontFamily: 'monospace',
      fontSize: '11px', padding: '8px', borderRadius: '6px',
      border: '1px solid #633', boxShadow: '0 0 12px rgba(0,0,0,.6)', whiteSpace: 'pre-wrap'
    });
    document.body.appendChild(this._errPanel);

    on(EV.ENGINE_ERROR, ({ err, ts, frame }) => {
      this._errCount++;
      this._errLog.push({ msg: err && err.message ? err.message : String(err), ts, frame });
      if (this._errLog.length > 10) this._errLog.shift();
      this._errEl.querySelector('.err-count').textContent = this._errCount;
      this._errEl.style.display = 'block';
      this._errEl.style.opacity = '1';
      this._errTimer = 2;
    });

    this._onKeydown = (e) => {
      if (e.key === 'F3') {
        e.preventDefault();
        const show = this._errPanel.style.display === 'none';
        this._errPanel.style.display = show ? 'block' : 'none';
        if (show) this._renderErrLog();
      }
    };
    document.addEventListener('keydown', this._onKeydown);

    this._onLockClick = () => document.querySelector('#app')?.requestPointerLock();
    this._locklost.addEventListener('click', this._onLockClick);
    on(EV.UI_LOCKLOST, () => { this._locklost.style.display = 'flex'; });
    on(EV.UI_LOCKED, () => { this._locklost.style.display = 'none'; });
    on(EV.HUD_FLASH, ({ text } = {}) => { if (text) this.flash(text); });
    on(EV.HUD_MISS, () => this.flash('落空'));
    on(EV.COMBAT_HIT, ({ victim }) => {
      if (victim && victim.isLocal) {
        this._hp.style.background = 'linear-gradient(90deg,#f44,#fa3)';
        setTimeout(() => { this._hp.style.background = 'linear-gradient(90deg,#d33,#f70)'; }, 180);
        this.flashHitVignette();
      }
    });
    on(EV.COMBAT_KILL, ({ killer, victim }) => {
      if (killer && killer.isLocal) {
        if (killer.killstreak !== undefined) {
          killer._killstreak = (killer._killstreak || 0) + 1;
          killer._killstreakTimer = 5;
          this.flashKillstreak(killer._killstreak);
        } else this.flashKill('击杀！');
      }
    });

    this._challengeEl = document.createElement('div');
    this._challengeEl.id = 'daily-challenges';
    Object.assign(this._challengeEl.style, {
      position: 'fixed', left: '12px', top: '40%', transform: 'translateY(-50%)',
      zIndex: '11', fontFamily: 'Segoe UI, sans-serif', fontSize: '12px',
      color: '#ddd', textShadow: '0 0 3px #000', pointerEvents: 'none',
      lineHeight: '1.6'
    });
    document.body.appendChild(this._challengeEl);
    this._daily = null;
    on(EV.DAILY_UPDATE, (challenges) => {
      this._daily = challenges;
      this._renderChallenges();
    });

    this._counterEl = document.createElement('div');
    this._counterEl.id = 'counter-indicator';
    Object.assign(this._counterEl.style, {
      position: 'fixed', top: '35%', left: '50%', transform: 'translate(-50%,-50%)',
      fontSize: '28px', fontWeight: 'bold', fontFamily: 'Segoe UI, sans-serif',
      color: '#ffd700', textShadow: '0 0 10px rgba(255,215,0,.8)', zIndex: '13',
      pointerEvents: 'none', display: 'none', opacity: '0', transition: 'opacity 0.3s'
    });
    document.body.appendChild(this._counterEl);
    this._counterTimer = 0;

    this._comboEl = document.createElement('div');
    this._comboEl.id = 'combo';
    Object.assign(this._comboEl.style, {
      position: 'fixed', top: '30%', right: '8%', zIndex: '14',
      fontFamily: 'Segoe UI, sans-serif', fontSize: '40px', fontWeight: 'bold',
      color: '#fff', textShadow: '0 0 10px rgba(255,255,255,.6)',
      pointerEvents: 'none', display: 'none', opacity: '0',
      transition: 'opacity .2s, transform .2s'
    });
    document.body.appendChild(this._comboEl);
    this._comboTimer = 0;
    this._comboTier = 0;
    on(EV.COMBO_TIER, ({ tier, count }) => {
      this._comboTier = tier;
      this._comboEl.textContent = count + ' 连击';
      const colors = ['#fff', '#fff5c8', '#ffd700', '#ff4433'];
      this._comboEl.style.color = colors[tier] || '#fff';
      this._comboEl.style.display = 'block';
      this._comboEl.style.opacity = '1';
      this._comboEl.style.transform = 'scale(1.2)';
      setTimeout(() => { this._comboEl.style.transform = 'scale(1)'; }, 100);
      this._comboTimer = 2;
      this.flashComboPulse(tier);
    });
    on(EV.COMBO_BREAK, () => {
      this._comboEl.style.opacity = '0';
      this._comboTimer = 0.3;
    });
    on(EV.COMBO_FINISHER, () => {
      this._comboEl.textContent = '终结就绪';
      this._comboEl.style.color = '#ff4433';
      this._comboEl.style.display = 'block';
      this._comboEl.style.opacity = '1';
      this._comboTimer = 1.5;
    });
    on(EV.HUD_BOSSPHASE, ({ phase } = {}) => this.flashBossPhase(phase));
    on(EV.COMBAT_EXECUTE, ({ char } = {}) => { if (char && char.isLocal) this.flashExecute(); });
    on(EV.FX_PERFECTBLOCK, ({ char } = {}) => { if (char && char.isLocal) this.flashParry(); });

    this._skillEls = [];
    const skillColors = ['#dfe7ee', '#b98a4a', '#c9a44a', '#7a7a82'];
    for (let i = 0; i < 4; i++) {
      const el = document.createElement('div');
      el.id = 'skill-' + i;
      Object.assign(el.style, {
        position: 'fixed', bottom: '12px', right: (12 + i * 56) + 'px', zIndex: '14',
        width: '48px', height: '48px', borderRadius: '6px',
        border: '2px solid ' + skillColors[i], background: 'rgba(0,0,0,.4)',
        fontFamily: 'Segoe UI, sans-serif', fontSize: '11px', color: skillColors[i],
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        textAlign: 'center', pointerEvents: 'none', overflow: 'hidden'
      });
      el.textContent = '?';
      document.body.appendChild(el);
      const cd = document.createElement('div');
      Object.assign(cd.style, {
        position: 'absolute', inset: '0', background: 'rgba(0,0,0,.65)',
        display: 'none', alignItems: 'center', justifyContent: 'center',
        fontSize: '16px', fontWeight: 'bold', color: '#fff'
      });
      el.appendChild(cd);
      this._skillEls.push({ el, cd });
    }
    on(EV.SKILL_CAST, ({ weaponIdx, name }) => {
      const s = this._skillEls[weaponIdx];
      if (!s) return;
      s.el.textContent = name || '?';
      s.cd.style.display = 'flex';
      s.cd.textContent = '8';
    });
    on(EV.SKILL_REJECT, ({ weaponIdx }) => {
      const s = this._skillEls[weaponIdx];
      if (!s) return;
      s.el.style.transform = 'scale(1.15)';
      setTimeout(() => { s.el.style.transform = 'scale(1)'; }, 100);
    });

    on(EV.COMBAT_COUNTER, ({ attacker, victim, mul }) => {
      const isPlayerAttacker = attacker && attacker.isLocal;
      const isPlayerVictim = victim && victim.isLocal;
      if (isPlayerAttacker) {
        this._counterEl.textContent = '克制! x' + mul.toFixed(1);
        this._counterEl.style.color = '#4f4';
      } else if (isPlayerVictim) {
        this._counterEl.textContent = '被克制!';
        this._counterEl.style.color = '#f44';
      } else return;
      this._counterEl.style.display = 'block';
      this._counterEl.style.opacity = '1';
      this._counterTimer = 1.5;
    });
  }

  setRefs(player, ais, camera) { this._player = player; this._ais = ais; this._camera = camera; }

  _write(el, prop, value) {
    if (!this._domCache) { this._domCache = new WeakMap(); this._writeCount = 0; }
    let m = this._domCache.get(el);
    if (!m) { m = {}; this._domCache.set(el, m); }
    if (m[prop] === value) return;
    m[prop] = value;
    this._writeCount++;
    if (prop === 'textContent') el.textContent = value;
    else if (prop === 'innerHTML') el.innerHTML = value;
    else el.style[prop] = value;
  }

  setHealth(c) { this._write(this._hp, 'width', `${Math.max(0, c.health.ratio) * 100}%`); }
  setStamina(s) {
    this._write(this._stam, 'width', `${Math.max(0, s.ratio) * 100}%`);
    this._write(this._stam, 'background', s.depleted ? 'linear-gradient(90deg,#36a,#a36)' : 'linear-gradient(90deg,#3ad,#8ef)');
  }
  setRage(c) {
    if (!this._rage) return;
    this._write(this._rage, 'width', `${Math.min(1, c.rage / 100) * 100}%`);
    this._write(this._rage, 'boxShadow', c.rage >= 100 ? '0 0 8px #fa4' : 'none');
  }
  setPosture(c) {
    if (!this._postureBar) return;
    if (!c || !c.alive) { this._postureBar.style.display = 'none'; return; }
    const p = c._posture || 0;
    const broken = (c._postureBroken || 0) > 0;
    this._postureBar.style.display = (p > 0 || broken) ? 'block' : 'none';
    this._postureFill.style.width = `${Math.min(1, p / 100) * 100}%`;
    this._postureFill.style.background = broken ? 'linear-gradient(90deg,#f00,#f44)' : (p > 70 ? 'linear-gradient(90deg,#f44,#fa0)' : 'linear-gradient(90deg,#c88,#fa4)');
  }
  flashKillstreak(n) { const msg = n >= 3 ? `${n}连杀！` : '击杀！'; this._kill.textContent = msg; this._kill.style.opacity = '1'; this._killTimer = 1.4; }
  // 单个 buff 标签：限时 buff 传 remain/max 时额外渲染倒计时条
  _buffChip(label, color, remain, max) {
    let bar = '';
    if (remain !== undefined && max > 0) {
      const p = Math.max(0, Math.min(1, remain / max)) * 100;
      bar = `<div style="width:100%;height:3px;margin-top:2px;background:rgba(0,0,0,.55);border-radius:2px;overflow:hidden;min-width:56px;"><div style="width:${p}%;height:100%;background:${color};"></div></div>`;
    }
    return `<div style="display:flex;flex-direction:column;align-items:center;"><span style="color:${color};">${label}</span>${bar}</div>`;
  }
  updateBuffs(player) {
    const parts = [];
    if (player._perfectBuff > 0) parts.push(this._buffChip('完美闪避 ×1.5', '#7df', player._perfectBuff, PERFECT_BUFF_DUR));
    if (player._killstreak >= 3 && player.killstreakBuffs) {
      const ks = player.killstreakBuffs();
      parts.push(this._buffChip(`连杀 ×${player._killstreak} (+${Math.round((ks.dmgMul - 1) * 100)}%)`, '#ffd070', player._killstreakTimer, KILLSTREAK_DUR));
    }
    if (player._runDmgMul && player._runDmgMul > 1) parts.push(this._buffChip(`锋利 +${Math.round((player._runDmgMul - 1) * 100)}%`, '#f88'));
    if (player._runLifesteal && player._runLifesteal > 0) parts.push(this._buffChip(`吸血 ${Math.round(player._runLifesteal * 100)}%`, '#f7a'));
    if (player._skill && player._skill.branches) {
      const b = player._skill.branches;
      if (b.berserk.level > 0) parts.push(this._buffChip('狂暴 +25%', '#f55'));
      if (b.guardian.level > 0) parts.push(this._buffChip('守护 -15%', '#5af'));
      if (b.regen.level > 0) parts.push(this._buffChip(`回复 +${player._skill.branchRegen}/s`, '#5f5'));
      if (b.lifesteal.level > 0) parts.push(this._buffChip('吸血 5%', '#f7a'));
      if (b.swift.level > 0) parts.push(this._buffChip('疾风 +10%', '#7df'));
      if (b.evade.level > 0) parts.push(this._buffChip('闪避 10%', '#a7f'));
      if (b.frenzy.level > 0) parts.push(this._buffChip('狂热 +15%', '#fa8'));
      if (b.critical.level > 0) parts.push(this._buffChip('暴击 15%', '#ffd'));
    }
    if (parts.length > 0) { this._write(this._buffbar, 'innerHTML', parts.join('')); this._write(this._buffbar, 'display', 'flex'); }
    else this._write(this._buffbar, 'display', 'none');
  }
  showBoss(name) {
    this._bossbar.querySelector('#bossName').textContent = name;
    this._bossbar.style.display = 'flex';
  }
  setBossHP(ratio) {
    this._bossFill.style.width = `${Math.max(0, Math.min(1, ratio)) * 100}%`;
  }
  setBossPhase(phase = 1, isMini = false) {
    const total = isMini ? 2 : 3;
    const p = Math.max(1, Math.min(total, phase));
    let s = '';
    for (let i = 0; i < total; i++) s += i < p ? '●' : '○';
    this._bossPips.textContent = s;
  }
  hideBoss() { this._bossbar.style.display = 'none'; }
  setLowHP(active) { this._lowhp.style.display = active ? 'block' : 'none'; this._lowhp.style.animation = (active && this._reducedMotion) ? 'none' : ''; }
  setReducedMotion(v) { this._reducedMotion = !!v; }
  flashHitVignette() { if (this._reducedMotion) { this._hitvignette.style.opacity = '0'; return; } this._hitVigTimer = 0.35; this._hitvignette.style.opacity = '0.6'; }
  flashComboPulse(tier = 0) { if (this._reducedMotion) { this._combopulse.style.opacity = '0'; return; } this._comboPulseTimer = 0.3; this._combopulse.style.opacity = String(Math.min(0.6, 0.25 + tier * 0.1)); }
  flashBossPhase(phase = 2) { this._bossPhaseTimer = 1.5; this._bossphase.textContent = phase >= 3 ? '⚔ Boss 狂暴！' : 'Boss 激怒！'; this._bossphase.style.opacity = '1'; }
  flashExecute() { this._execBannerTimer = 1.0; this._execute.textContent = '⚔ 处决！'; this._execute.style.opacity = '1'; }
  flashParry() { if (this._reducedMotion) { this._parryTimer = 0; this._parryflash.style.opacity = '0'; this._parryglow.style.opacity = '0'; return; } this._parryTimer = 0.8; this._parryflash.textContent = '🛡 弹反！'; this._parryflash.style.opacity = '1'; this._parryglow.style.opacity = '0.8'; }
  setScore(b, r) { this._score.textContent = `蓝方 ${b}  |  ${r} 红方`; }
  setRound(b, r, target) { this._round.textContent = `局比分 ${b} - ${r}（先到 ${target} 胜）`; }
  setWave(wave, best, endless, modifierInfo) {
    let txt = '第 ' + wave + ' 波' + (endless ? '' : ' / 10');
    if (best > 0) txt += '  ·  最高 ' + best + ' 波';
    if (modifierInfo && modifierInfo.current) txt += '  ·  当前：' + modifierInfo.current.name;
    if (modifierInfo && modifierInfo.next) txt += '  ·  下一：' + modifierInfo.next.name;
    this._round.textContent = txt;
  }
  setMode(name, stageInfo) {
    if (stageInfo) {
      this._modeName.textContent = '模式：' + name + ' · ' + stageInfo.name + ' (' + (stageInfo.index + 1) + '/' + stageInfo.total + ')';
    } else {
      this._modeName.textContent = '模式：' + name;
    }
    this._dom.style.display = name === '据点' ? 'block' : 'none';
  }
  setWeatherForecast(text) {
    if (text) { this._wforecast.textContent = text; this._wforecast.style.display = 'block'; }
    else { this._wforecast.style.display = 'none'; }
  }
  _renderChallenges() {
    if (!this._daily) { this._challengeEl.innerHTML = ''; return; }
    let html = '<div style="font-weight:bold;color:#ffd700;margin-bottom:4px">每日挑战</div>';
    for (const c of this._daily) {
      const icon = c.done ? '✓' : (c.progress > 0 ? '○' : '·');
      const color = c.done ? '#4f4' : (c.progress > 0 ? '#ffd700' : '#888');
      html += '<div style="color:' + color + '">' + icon + ' ' + c.desc + ' (' + c.progress + '/' + c.target + ')</div>';
    }
    this._challengeEl.innerHTML = html;
  }
  setDomination(mode) {
    if (!mode.points) return;
    const colors = ['#888', '#3af', '#f55'];
    const labels = mode.points.map((p, i) => `<span style="color:${colors[p.team + 1] || '#888'}">●${Math.floor(p.progress * 100)}%</span>`).join(' ');
    this._dom.innerHTML = `${labels} | 蓝方${mode.scoreB} 红方${mode.scoreR} / ${mode.targetScore}`;
  }
  setWeapon(idx, count) {
    const names = this._player ? this._player.weapons.map(w => w.name) : ['刀', '弓', '枪', '锤'];
    let html = '';
    for (let i = 0; i < count; i++) html += (i === idx ? `<b style="color:#ffd070;">[${i + 1}] ${names[i] || '武'}</b> ` : `[${i + 1}] ${names[i] || '武'} `);
    this._weapon.innerHTML = html;
  }
  setCharge(c) {
    if (c > 0.01) {
      this._write(this._charge, 'display', 'block');
      this._write(this._chargeFill, 'width', `${Math.min(1, c) * 100}%`);
      this._write(this._chargeFill, 'boxShadow', c >= 1 ? '0 0 10px #ff5533' : 'none');
    } else this._write(this._charge, 'display', 'none');
  }
  setCombo(c) {
    if (c.comboTimer > 0) {
      const p = c.comboTimer / c.comboWindow;
      const col = c.comboCount === 2 ? '#ff5533' : '#ffd070';
      this._comboRing.style.border = `2px solid ${col}`;
      this._comboRing.style.clipPath = `inset(0 ${(1 - p) * 100}% 0 0)`;
    } else this._comboRing.style.border = '2px solid transparent';
  }
  flashKill(msg) { this._kill.textContent = msg; this._kill.style.opacity = '1'; this._killTimer = 1.2; }
  _renderErrLog() {
    if (!this._errLog.length) { this._errPanel.textContent = '无错误记录'; return; }
    this._errPanel.innerHTML = '<div style="color:#f88;font-weight:bold;margin-bottom:4px">最近错误 (frame | msg)</div>' +
      this._errLog.map(e => `<div>#${e.frame} | ${e.msg}</div>`).join('');
  }

  flash(msg) { this._endLocked = false; this._hint.textContent = msg; }
  flashEnd(msg) { this._endLocked = true; this._hint.textContent = msg; }
  clearHint() { if (!this._endLocked) this._hint.textContent = ''; }
  setSkillCooldowns(ws) {
    if (!ws) return;
    for (let i = 0; i < 4; i++) {
      const s = this._skillEls[i];
      if (!s) continue;
      const r = ws.cdRemaining(i);
      if (r > 0) { s.cd.style.display = 'flex'; s.cd.textContent = Math.ceil(r); }
      else { s.cd.style.display = 'none'; }
    }
  }

  update(dt) {
    if (this._errTimer > 0) {
      this._errTimer -= dt;
      if (this._errTimer < 0.5) this._errEl.style.opacity = (this._errTimer / 0.5).toString();
      if (this._errTimer <= 0) this._errEl.style.display = 'none';
    }
    if (this._killTimer > 0) { this._killTimer -= dt; if (this._killTimer <= 0) this._kill.style.opacity = '0'; }
    if (this._hitVigTimer > 0) {
      this._hitVigTimer -= dt;
      if (this._hitVigTimer <= 0) { this._hitVigTimer = 0; this._hitvignette.style.opacity = '0'; }
      else this._hitvignette.style.opacity = (0.6 * (this._hitVigTimer / 0.35)).toString();
    }
    if (this._comboPulseTimer > 0) {
      this._comboPulseTimer -= dt;
      if (this._comboPulseTimer <= 0) { this._comboPulseTimer = 0; this._combopulse.style.opacity = '0'; }
      else this._combopulse.style.opacity = (0.6 * (this._comboPulseTimer / 0.3)).toString();
    }
    if (this._bossPhaseTimer > 0) {
      this._bossPhaseTimer -= dt;
      if (this._bossPhaseTimer <= 0) { this._bossPhaseTimer = 0; this._bossphase.style.opacity = '0'; }
      else this._bossphase.style.opacity = (this._bossPhaseTimer / 1.5).toString();
    }
    if (this._execBannerTimer > 0) {
      this._execBannerTimer -= dt;
      if (this._execBannerTimer <= 0) { this._execBannerTimer = 0; this._execute.style.opacity = '0'; }
      else this._execute.style.opacity = this._execBannerTimer.toString();
    }
    if (this._parryTimer > 0) {
      this._parryTimer -= dt;
      if (this._parryTimer <= 0) { this._parryTimer = 0; this._parryflash.style.opacity = '0'; this._parryglow.style.opacity = '0'; }
      else { this._parryflash.style.opacity = this._parryTimer.toString(); this._parryglow.style.opacity = (this._parryTimer / 0.8).toString(); }
    }
    if (this._counterTimer > 0) {
      this._counterTimer -= dt;
      if (this._counterTimer < 0.5) this._counterEl.style.opacity = (this._counterTimer / 0.5).toString();
      if (this._counterTimer <= 0) { this._counterEl.style.display = 'none'; }
    }
    if (this._comboTimer > 0) {
      this._comboTimer -= dt;
      if (this._comboTimer < 0.5) this._comboEl.style.opacity = (this._comboTimer / 0.5).toString();
      if (this._comboTimer <= 0) this._comboEl.style.display = 'none';
    }
  }

  dispose() {
    for (const u of this._unsubs) u();
    this._unsubs = [];
    document.removeEventListener('keydown', this._onKeydown);
    if (this._locklost) this._locklost.removeEventListener('click', this._onLockClick);
  }
}
