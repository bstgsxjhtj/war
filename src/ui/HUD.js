import { EV } from '../core/constants/events.js';
// HUD：雷达/血条/耐力/连击/锁定/据点/模式/击杀横幅
export class HUD {
  constructor(bus) {
    this.bus = bus;
    this._endLocked = false;
    this._killTimer = 0;
    this._radarAcc = 0;
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
      <canvas id="radar" width="120" height="120" style="position:absolute;top:18px;left:18px;border:1px solid rgba(255,255,255,.3);border-radius:50%;background:rgba(0,0,0,.35);"></canvas>
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
      <div id="keys" style="position:absolute;right:24px;bottom:48px;color:#bcd;font-size:11px;text-shadow:0 1px 2px #000;opacity:.6;text-align:right;line-height:1.6;">WASD · Shift冲刺 · Space跳<br>Q/双击 闪避 · LMB攻击 · RMB格挡/蓄力 · Tab锁定 · 1-4武器 · M模式</div>
      <div id="hint" style="position:absolute;top:62%;left:50%;transform:translateX(-50%);color:#ffd;text-align:center;font-size:15px;text-shadow:0 1px 2px #000;max-width:80%;"></div>
      <div id="kill" style="position:absolute;top:30%;left:50%;transform:translateX(-50%);color:#ffd070;font-size:26px;font-weight:bold;text-shadow:0 2px 4px #000;opacity:0;transition:opacity .2s;"></div>
      <div id="buffbar" style="position:absolute;bottom:80px;left:50%;transform:translateX(-50%);display:flex;gap:8px;font-size:12px;text-shadow:0 1px 2px #000;display:none;"></div>
    `;
    document.body.appendChild(this.el);
    this._locklost = this.el.querySelector('#locklost');
    this._hp = this.el.querySelector('#hp');
    this._stam = this.el.querySelector('#stam');
    this._rage = this.el.querySelector('#rage');
    this._score = this.el.querySelector('#score');
    this._round = this.el.querySelector('#round');
    this._modeName = this.el.querySelector('#modeName');
    this._dom = this.el.querySelector('#dom');
    this._wforecast = this.el.querySelector('#wforecast');
    this._hint = this.el.querySelector('#hint');
    this._kill = this.el.querySelector('#kill');
    this._buffbar = this.el.querySelector('#buffbar');
    this._charge = this.el.querySelector('#charge');
    this._chargeFill = this.el.querySelector('#chargeFill');
    this._weapon = this.el.querySelector('#weapon');
    this._comboRing = this.el.querySelector('#comboRing');
    this._radar = this.el.querySelector('#radar');
    this._radarCtx = this._radar.getContext('2d');

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

    bus.on(EV.ENGINE_ERROR, ({ err, ts, frame }) => {
      this._errCount++;
      this._errLog.push({ msg: err && err.message ? err.message : String(err), ts, frame });
      if (this._errLog.length > 10) this._errLog.shift();
      this._errEl.querySelector('.err-count').textContent = this._errCount;
      this._errEl.style.display = 'block';
      this._errEl.style.opacity = '1';
      this._errTimer = 2;
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'F3') {
        e.preventDefault();
        const show = this._errPanel.style.display === 'none';
        this._errPanel.style.display = show ? 'block' : 'none';
        if (show) this._renderErrLog();
      }
    });

    this._locklost.addEventListener('click', () => document.querySelector('#app')?.requestPointerLock());
    bus.on(EV.UI_LOCKLOST, () => { this._locklost.style.display = 'flex'; });
    bus.on(EV.UI_LOCKED, () => { this._locklost.style.display = 'none'; });
    bus.on(EV.HUD_FLASH, ({ text } = {}) => { if (text) this.flash(text); });
    bus.on(EV.HUD_MISS, () => this.flash('落空'));
    bus.on(EV.COMBAT_HIT, ({ victim }) => {
      if (victim && victim.isLocal) {
        this._hp.style.background = 'linear-gradient(90deg,#f44,#fa3)';
        setTimeout(() => { this._hp.style.background = 'linear-gradient(90deg,#d33,#f70)'; }, 180);
      }
    });
    bus.on(EV.COMBAT_KILL, ({ killer, victim }) => {
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
    bus.on(EV.DAILY_UPDATE, (challenges) => {
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
    bus.on(EV.COMBO_TIER, ({ tier, count }) => {
      this._comboTier = tier;
      this._comboEl.textContent = count + ' 连击';
      const colors = ['#fff', '#fff5c8', '#ffd700', '#ff4433'];
      this._comboEl.style.color = colors[tier] || '#fff';
      this._comboEl.style.display = 'block';
      this._comboEl.style.opacity = '1';
      this._comboEl.style.transform = 'scale(1.2)';
      setTimeout(() => { this._comboEl.style.transform = 'scale(1)'; }, 100);
      this._comboTimer = 2;
    });
    bus.on(EV.COMBO_BREAK, () => {
      this._comboEl.style.opacity = '0';
      this._comboTimer = 0.3;
    });
    bus.on(EV.COMBO_FINISHER, () => {
      this._comboEl.textContent = '终结就绪';
      this._comboEl.style.color = '#ff4433';
      this._comboEl.style.display = 'block';
      this._comboEl.style.opacity = '1';
      this._comboTimer = 1.5;
    });

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
    bus.on(EV.SKILL_CAST, ({ weaponIdx, name }) => {
      const s = this._skillEls[weaponIdx];
      if (!s) return;
      s.el.textContent = name || '?';
      s.cd.style.display = 'flex';
      s.cd.textContent = '8';
    });
    bus.on(EV.SKILL_REJECT, ({ weaponIdx }) => {
      const s = this._skillEls[weaponIdx];
      if (!s) return;
      s.el.style.transform = 'scale(1.15)';
      setTimeout(() => { s.el.style.transform = 'scale(1)'; }, 100);
    });

    bus.on(EV.COMBAT_COUNTER, ({ attacker, victim, mul }) => {
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
  flashKillstreak(n) { const msg = n >= 3 ? `${n}连杀！` : '击杀！'; this._kill.textContent = msg; this._kill.style.opacity = '1'; this._killTimer = 1.4; }
  updateBuffs(player) {
    const parts = [];
    if (player._perfectBuff > 0) parts.push('<span style="color:#7df;">完美闪避 ×1.5</span>');
    if (player._killstreak >= 3 && player.killstreakBuffs) {
      const ks = player.killstreakBuffs();
      parts.push(`<span style="color:#ffd070;">连杀 ×${player._killstreak} (+${Math.round((ks.dmgMul - 1) * 100)}%)</span>`);
    }
    if (player._runDmgMul && player._runDmgMul > 1) parts.push(`<span style="color:#f88;">锋利 +${Math.round((player._runDmgMul - 1) * 100)}%</span>`);
    if (player._runLifesteal && player._runLifesteal > 0) parts.push(`<span style="color:#f7a;">吸血 ${Math.round(player._runLifesteal * 100)}%</span>`);
    if (parts.length > 0) { this._buffbar.innerHTML = parts.join(''); this._buffbar.style.display = 'flex'; }
    else { this._buffbar.style.display = 'none'; }
  }
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
    this._radarAcc += dt;
    if (this._player && this._ais && this._radarAcc >= 0.033) {
      this._radarAcc = 0;
      this._drawRadar();
    }
  }
  _drawRadar() {
    const ctx = this._radarCtx;
    const W = 120, R = 58, cx = 60, cy = 60, scale = 1.8;
    ctx.clearRect(0, 0, W, W);
    ctx.fillStyle = 'rgba(20,30,20,.5)'; ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#5af'; ctx.beginPath(); ctx.moveTo(cx, cy - 5); ctx.lineTo(cx - 4, cy + 4); ctx.lineTo(cx + 4, cy + 4); ctx.closePath(); ctx.fill();
    const yaw = this._camera.yaw;
    for (const a of this._ais) {
      if (!a.alive) continue;
      const dx = a.position.x - this._player.position.x;
      const dz = a.position.z - this._player.position.z;
      const rx = dx * Math.cos(yaw) - dz * Math.sin(yaw);
      const rz = dx * Math.sin(yaw) + dz * Math.cos(yaw);
      let px = cx + rx * scale, py = cy - rz * scale;
      const d = Math.hypot(px - cx, py - cy);
      if (d > R - 4) { const k = (R - 4) / d; px = cx + (px - cx) * k; py = cy + (py - cy) * k; }
      ctx.fillStyle = '#f55'; ctx.beginPath(); ctx.arc(px, py, 3, 0, Math.PI * 2); ctx.fill();
    }
  }
}
