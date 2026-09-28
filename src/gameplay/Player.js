import * as THREE from 'three';
import { Character } from './Character.js';
import { Sword } from './weapons/Sword.js';
import { Bow } from './weapons/Bow.js';
import { Spear } from './weapons/Spear.js';
import { SwordShield } from './weapons/SwordShield.js';
import { Warhammer } from './weapons/Warhammer.js';
import { EV } from '../core/constants/events.js';

// 本地玩家：Tab锁定 / 右键格挡(持刀) / 蓄力越肩(弓) / Q闪避
export class Player extends Character {
  constructor(camera, bus) {
    super({ team: 0, isLocal: true, speed: 8.5, maxHp: 160 });
    this.camera = camera;
    this.setBus(bus);
    this._keys = new Set();
    this._attackQueued = false;
    this._queueTime = 0;
    this._dodgeBuf = null; // 闪避输入缓冲 { dir, t }
    this._execBuf = 0;     // 处决输入缓冲（秒）
    this._bowRelease = false;
    this._lastDirKey = { code: null, time: 0 };
    this._blocking = false;
    this._weaponSkills = null;
    this._bindInput();
  }

  _bindInput() {
    this._handlers = [];
    const canvas = document.querySelector('#app');
    const onClick = () => { if (document.pointerLockElement !== canvas) canvas.requestPointerLock(); };
    const onLockChange = () => {
      this._locked = document.pointerLockElement === document.querySelector('#app');
      if (this._locked) this._bus.emit(EV.UI_LOCKED);
      else this._bus.emit(EV.UI_LOCKLOST);
    };
    const onMouseMove = (e) => {
      if (!this._locked) return;
      this.camera.look(e.movementX, e.movementY, 0.0025 * this.lookSensitivity);
    };
    const onMouseDown = (e) => {
      if (!this._locked) return;
      if (e.button === 0) { this._attackQueued = true; this._queueTime = 0; }
      if (e.button === 2) {
        if (this.weapon.type === 'projectile') { this.setCharging(true); this.camera.aimMode = true; }
        else { this._blocking = true; this.tryBlock(); } // 持刀格挡
      }
    };
    const onMouseUp = (e) => {
      if (e.button === 0) this._attackQueued = false;
      if (e.button === 2) {
        if (this.weapon.type === 'projectile') { this._bowRelease = true; this.camera.aimMode = false; }
        else if (this._blocking) { this._blocking = false; this.releaseBlock(); }
      }
    };
    const onContextMenu = (e) => e.preventDefault();
    const onKeyDown = (e) => {
      this._keys.add(e.code);
      if (e.code === 'Digit1' || e.code === 'Digit2' || e.code === 'Digit3' || e.code === 'Digit4') {
        const idx = parseInt(e.code.slice(-1)) - 1;
        if (idx < this.weapons.length) { this.switchWeapon(idx); this.setCharging(false); this.camera.aimMode = false; }
      }
      if (e.code === 'KeyQ') this.requestDodge(this.camera.forward());
      if (e.code === 'KeyF') this.trySkill(this._pendingCombat);
      if (e.code === 'KeyT') this.tryUltimate(this._pendingCombat);
      if (e.code === 'KeyE') this.requestExecute(this._pendingCombat);
      if (e.code === 'Tab') { e.preventDefault(); this._toggleLock(); }
      if (['KeyW', 'KeyA', 'KeyS', 'KeyD'].includes(e.code)) this._tryDodgeFromKey(e.code);
    };
    const onKeyUp = (e) => this._keys.delete(e.code);
    this._handlers = [
      [canvas, 'click', onClick],
      [document, 'pointerlockchange', onLockChange],
      [document, 'mousemove', onMouseMove],
      [document, 'mousedown', onMouseDown],
      [document, 'mouseup', onMouseUp],
      [document, 'contextmenu', onContextMenu],
      [window, 'keydown', onKeyDown],
      [window, 'keyup', onKeyUp]
    ];
    for (const [el, ev, fn] of this._handlers) el.addEventListener(ev, fn);
  }

  dispose() {
    for (const [el, ev, fn] of this._handlers || []) el.removeEventListener(ev, fn);
    this._handlers = [];
    super.dispose();
  }

  _toggleLock() {
    if (!this._pendingCombat) return;
    if (this.lockTarget && this.lockTarget.alive) {
      this.lockTarget.setLockMark(false);
      this.lockTarget = null;
      this.camera.lockTarget = null;
      return;
    }
    let best = null, minD = 25;
    for (const c of this._pendingCombat.characters) {
      if (!c.alive || c.team === this.team) continue;
      const d = c.position.distanceTo(this.position);
      if (d < minD) { minD = d; best = c; }
    }
    if (best) {
      this.lockTarget = best;
      best.setLockMark(true);
      this.camera.lockTarget = best;
    }
  }

  _tryDodgeFromKey(code) {
    const now = performance.now();
    if (this._lastDirKey.code === code && now - this._lastDirKey.time < 400) {
      const dir = this._dirFromKey(code);
      if (dir) { this.requestDodge(dir); this._lastDirKey.code = null; return; }
    }
    this._lastDirKey = { code, time: now };
  }

  _dirFromKey(code) {
    const f = this.camera.forward();
    const r = this.camera.right();
    if (code === 'KeyW') return f;
    if (code === 'KeyS') return f.clone().negate();
    if (code === 'KeyA') return r.clone().negate();
    if (code === 'KeyD') return r;
    return null;
  }

  setWeaponSkills(ws) { this._weaponSkills = ws; }

  trySkill(combat) {
    if (!combat || !this.alive || !this._weaponSkills) return;
    const idx = this.weaponIdx;
    if (!this._weaponSkills.canCast(idx)) { this._bus?.emit(EV.SKILL_REJECT, { weaponIdx: idx }); return; }
    const now = performance.now() / 1000;
    const ok = this.weapon.skill(this, combat, now);
    if (ok) {
      const cdMul = 1 - (this._affixes?.affixBonus(this.weapon, '迅捷') || 0); this._weaponSkills.trigger(idx, cdMul);
      this._bus?.emit(EV.SKILL_CAST, { weaponIdx: idx, name: this.weapon.skillName });
    }
  }

  _lunge(dist) {
    this.position.add(this.forward.clone().multiplyScalar(dist));
    this._iFrame = Math.max(this._iFrame, 0.25);
  }

  // 输入缓冲：动作暂时无法执行时保留 0.25s，条件满足后自动补发
  requestDodge(dir) {
    if (this.tryDodge(dir)) return true;
    if (this.alive) this._dodgeBuf = { dir: dir.clone(), t: 0.25 };
    return false;
  }

  requestExecute(combat) {
    this._tryExecute(combat);
    if (this._executing <= 0 && this.alive) this._execBuf = 0.25;
  }

  _tryExecute(combat) {
    if (!combat || !this.alive || this._executing > 0) return;
    for (const c of combat.characters) {
      if (!c.alive || c.team === this.team) continue;
      const d = c.position.distanceTo(this.position);
      if (d < 1.5 && c.canBeExecuted) {
        const backDot = c.forward.x * this.forward.x + c.forward.z * this.forward.z;
        if (backDot > 0.3) { this.startExecute(c); this.camera.setKillCam(c); break; }
      }
    }
  }

  update(dt, terrain, combat, now) {
    this._pendingCombat = combat;
    if (!this.alive) { this.camera.follow(this.position); return; }
    if (this.lockTarget && (!this.lockTarget.alive || this.lockTarget.position.distanceTo(this.position) > 15)) {
      this.lockTarget.setLockMark(false); this.lockTarget = null; this.camera.lockTarget = null;
    }

    // 锁定时朝向目标，否则相机yaw
    if (this.lockTarget) {
      this.setLook(Math.atan2(this.lockTarget.position.x - this.position.x, this.lockTarget.position.z - this.position.z));
    } else {
      this.setLook(this.camera.yaw);
    }
    const f = (this._keys.has('KeyW') ? 1 : 0) - (this._keys.has('KeyS') ? 1 : 0);
    const r = (this._keys.has('KeyD') ? 1 : 0) - (this._keys.has('KeyA') ? 1 : 0);
    this.setMove(f, r);
    const sprinting = this._keys.has('ShiftLeft') || this._keys.has('ShiftRight');
    if (sprinting && this.stamina.cur > 0) this.setSprint(true);
    else { this.setSprint(false); }
    if (sprinting) this.stamina.consume(18 * dt);
    if (this._keys.has('Space')) this.jump();

    if (this._attackQueued) {
      this._queueTime += dt;
      if (this._queueTime > 0.25) this._attackQueued = false;
      else if (this.tryAttack(combat, 1)) this._attackQueued = false;
    }

    if (this._dodgeBuf) {
      this._dodgeBuf.t -= dt;
      if (this._dodgeBuf.t <= 0 || this.tryDodge(this._dodgeBuf.dir)) this._dodgeBuf = null;
    }
    if (this._execBuf > 0) {
      this._execBuf -= dt;
      this._tryExecute(combat);
      if (this._executing > 0 || this._execBuf <= 0) this._execBuf = 0;
    }

    const isBow = this.weapon.type === 'projectile';
    if (isBow && this._bowRelease) {
      const ch = this.charge;
      this.setCharging(false);
      this.tryAttack(combat, ch);
      this._bowRelease = false;
    }

    if (this._weaponSkills) this._weaponSkills.update(dt);
    super.update(dt, terrain, combat, now);
    this.camera.follow(this.position);
  }
}
