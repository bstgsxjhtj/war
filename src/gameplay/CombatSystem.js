import * as THREE from 'three';
import { ParticleFX } from '../render/ParticleFX.js';
import { EV } from '../core/constants/events.js';

// 克制矩阵：attacker.weaponClass -> victim.weaponClass -> 倍率（导出供单测引用，构造时复用同一引用）
export const COUNTER_MATRIX = {
  HEAVY: { SHIELD: 1.8, SWORD: 1.2 },
  SPEAR: { SHIELD: 1.5, SWORD: 1.2 },
  SHIELD: { HEAVY: 1.3 },
  SWORD: { HEAVY: 1.2 }
};

// 战斗判定 + 池化特效 + hitstop + 克制矩阵 + AOE + 方向推力
export class CombatSystem {
  constructor(scene, bus, comboSys = null) {
    this.scene = scene;
    this.bus = bus;
    this._comboSys = comboSys;
    this.characters = [];
    this.arrows = [];
    this.hitstop = 0;
    this._lastAffixCrit = false;
    this._weatherEffects = null;
    this._tmpOrigin = new THREE.Vector3();
    this._tmpTo = new THREE.Vector3();
    this._tmpAim = new THREE.Vector3();
    this._arrowPool = [];

    // 克制矩阵：attacker.weaponClass -> victim.weaponClass -> 倍率
    this._counterMatrix = COUNTER_MATRIX;

    this._arrowGeo = new THREE.ConeGeometry(0.07, 0.7, 5);
    this._arrowMat = new THREE.MeshStandardMaterial({ color: 0xb98a4a, emissive: 0x2a1808, emissiveIntensity: 0.4 });

    this._partN = 14;
    this._partPoolSize = 40;
    this._partGeo = new THREE.BufferGeometry();
    this._partArr = new Float32Array(this._partN * this._partPoolSize * 3);
    this._partColArr = new Float32Array(this._partN * this._partPoolSize * 3);
    this._partGeo.setAttribute('position', new THREE.BufferAttribute(this._partArr, 3));
    this._partGeo.setAttribute('color', new THREE.BufferAttribute(this._partColArr, 3));
    this._partMat = new THREE.PointsMaterial({ size: 0.22, transparent: true, opacity: 1, depthWrite: false, vertexColors: true, map: ParticleFX.blood() });
    this._partPts = new THREE.Points(this._partGeo, this._partMat);
    this._partPts.visible = false;
    this.scene.add(this._partPts);
    this._partSlots = [];
    for (let i = 0; i < this._partPoolSize; i++) {
      this._partSlots.push({ active: false, vel: Array.from({ length: this._partN }, () => new THREE.Vector3()), life: 0, max: 0.5, offset: i * this._partN });
    }

    this._numCanvas = document.createElement('canvas');
    this._numCanvas.width = 128; this._numCanvas.height = 64;
    this._numCtx = this._numCanvas.getContext('2d');
    this._numTex = new THREE.CanvasTexture(this._numCanvas);
    this._numSprites = [];
    for (let i = 0; i < 16; i++) {
      const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: this._numTex, depthTest: false, transparent: true }));
      spr.visible = false; spr.scale.set(1.2, 0.6, 1); spr.renderOrder = 1000;
      this.scene.add(spr);
      this._numSprites.push({ spr, life: 0, vy: 0 });
    }
  }

  register(c) { this.characters.push(c); if (c.setBus) c.setBus(this.bus); }
  _releaseArrow(a) { if (a && a.mesh) this.scene.remove(a.mesh); }
  clear() {
    for (const a of this.arrows) this.scene.remove(a.mesh);
    this.arrows.length = 0;
    for (const s of this._partSlots) s.active = false;
    this._partPts.visible = false;
    for (const n of this._numSprites) n.spr.visible = false;
    this.characters.length = 0;
  }

  _counterMul(atkW, vicW) {
    const a = atkW?.weaponClass, v = vicW?.weaponClass;
    if (!a || !v) return 1;
    return this._counterMatrix[a]?.[v] ?? 1;
  }

  _emitHit(attacker, victim, damage, weaponName, color, combo = 0, heavy = false, now = 0, backstab = false, crit = false) {
    if (attacker && attacker.addRage) attacker.addRage(3);
    const counterMul = this._counterMul(attacker.weapon, victim.weapon);
    if (counterMul > 1.2) this.bus.emit(EV.COMBAT_COUNTER, { attacker, victim, mul: counterMul });
    this.bus.emit(EV.COMBAT_HIT, { attacker, victim, damage, weapon: weaponName, combo, heavy, backstab, crit });
    this._tmpOrigin.copy(victim.position).add(this._tmpTo.set(0, 1.6, 0));
    this.spawnHitFX(this._tmpOrigin.clone(), color);
    this.createDamageNumber(this._tmpOrigin.clone(), Math.round(damage), counterMul > 1.2, crit);
    const shakeMap = [0.16, 0.18, 0.32];
    this.bus.emit(EV.FX_SHAKE, { amount: Math.min(0.9, (shakeMap[combo] ?? 0.16) + (heavy ? 0.14 : 0)) });
    const hsMap = [0.04, 0.05, 0.11];
    this.hitstop = Math.min(0.14, this.hitstop + (hsMap[combo] ?? 0.04) + (heavy ? 0.04 : 0));
  }

  spawnHitFX(pos, color) {
    let slot = this._partSlots.find(s => !s.active);
    if (!slot) slot = this._partSlots.reduce((a, b) => b.life < a.life ? b : a);
    slot.active = true; slot.life = 0.5; slot.max = 0.5;
    this._partPts.visible = true;
    const col = new THREE.Color(color);
    for (let j = 0; j < this._partN; j++) {
      const idx = (slot.offset + j) * 3;
      this._partArr[idx] = pos.x; this._partArr[idx + 1] = pos.y; this._partArr[idx + 2] = pos.z;
      this._partColArr[idx] = col.r; this._partColArr[idx + 1] = col.g; this._partColArr[idx + 2] = col.b;
      const a = Math.random() * Math.PI * 2, b = (Math.random() - 0.5) * Math.PI, s = 3 + Math.random() * 4;
      slot.vel[j].set(Math.cos(a) * Math.cos(b) * s, Math.sin(b) * s + 2, Math.sin(a) * Math.cos(b) * s);
    }
    this._partGeo.attributes.position.needsUpdate = true;
    this._partGeo.attributes.color.needsUpdate = true;
  }

  createDamageNumber(pos, amount, countered = false, crit = false) {
    const slot = this._numSprites.find(n => !n.spr.visible);
    if (!slot) return;
    const c = crit ? '#ffd700' : (countered ? '#66ddff' : (amount >= 35 ? '#ff5533' : '#ffe070'));
    const ctx = this._numCtx;
    if (ctx) {
      ctx.clearRect(0, 0, 128, 64);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      if (crit) {
        ctx.font = 'bold 20px Segoe UI, sans-serif';
        ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(0,0,0,.85)';
        ctx.strokeText('暴击', 64, 12);
        ctx.fillStyle = c; ctx.fillText('暴击', 64, 12);
      }
      ctx.font = 'bold ' + (crit ? 50 : 44) + 'px Segoe UI, sans-serif';
      ctx.lineWidth = crit ? 7 : 6; ctx.strokeStyle = 'rgba(0,0,0,.85)';
      ctx.strokeText(amount, 64, crit ? 38 : 32);
      ctx.fillStyle = c; ctx.fillText(amount, 64, crit ? 38 : 32);
      this._numTex.needsUpdate = true;
    }
    slot.spr.position.copy(pos); slot.spr.visible = true;
    slot.spr.scale.set(crit ? 1.8 : 1.2, crit ? 0.9 : 0.6, 1);
    slot.life = 0.9; slot.vy = crit ? 2.4 : 1.8;
  }

  setAffixes(a) { this._affixes = a; }

  _affixApply(attacker, weapon, dmg) {
    this._lastAffixCrit = false;
    if (!this._affixes || !weapon) return dmg;
    let out = dmg * (1 + this._affixes.affixBonus(weapon, '锋锐') + this._affixes.synergyBonus(weapon, 'damage'));
    if (Math.random() < this._affixes.affixBonus(weapon, '暴怒') + this._affixes.synergyBonus(weapon, 'crit')) { out *= 2; this._lastAffixCrit = true; }
    return out;
  }

  _affixLeech(attacker, lost) {
    if (!attacker || !attacker.health || lost <= 0) return;
    let leech = attacker._runLifesteal || 0;
    if (attacker.killstreakBuffs) leech += attacker.killstreakBuffs().lifesteal;
    if (attacker._skill) leech += attacker._skill.branchLifesteal;
    if (this._affixes && attacker.weapon) {
      leech += this._affixes.affixBonus(attacker.weapon, '吸血') + this._affixes.synergyBonus(attacker.weapon, 'lifesteal');
    }
    if (leech > 0) attacker.health.hp = Math.min(attacker.health.maxHp, attacker.health.hp + lost * leech);
  }

  resolveMelee(attacker, weapon, combo, now = 0) {
    let baseDmg = weapon.comboDamage ? (weapon.comboDamage[combo] ?? weapon.damage) : weapon.damage;
    if (attacker._perfectBuff > 0) baseDmg *= 1.5;
    if (attacker._skill) baseDmg *= attacker._skill.totalMul(attacker.weaponIdx);
    if (attacker._runDmgMul) baseDmg *= attacker._runDmgMul;
    if (attacker.killstreakBuffs) baseDmg *= attacker.killstreakBuffs().dmgMul;
    if (attacker._skill && attacker._skill.branchDamageMul) baseDmg *= attacker._skill.branchDamageMul;
    let branchCrit = false;
    if (attacker._skill && Math.random() < (attacker._skill.branchCritChance || 0)) { baseDmg *= 2; branchCrit = true; }
    const knock = weapon.comboKnock ? (weapon.comboKnock[combo] ?? 1) : 1;
    const launch = weapon.comboLaunch ? weapon.comboLaunch[combo] : null;
    const heavy = combo === 2;
    for (const c of this.characters) {
      if (!c.alive || c.team === attacker.team) continue;
      const dx = c.position.x - attacker.position.x;
      const dz = c.position.z - attacker.position.z;
      const dy = 1.3;
      const dist = Math.sqrt(dx * dx + dz * dz + dy * dy);
      if (dist > weapon.range || dist < 0.01) continue;
      const horiz = Math.sqrt(dx * dx + dz * dz);
      if (horiz < 0.01) continue;
      const dot = (dx * attacker.forward.x + dz * attacker.forward.z) / horiz;
      const angle = Math.acos(THREE.MathUtils.clamp(dot, -1, 1));
      if (angle <= weapon.arc / 2) {
        const backDot = c.forward.x * attacker.forward.x + c.forward.z * attacker.forward.z;
        const isBackstab = backDot > 0.7;
        const counterMul = this._counterMul(attacker.weapon, c.weapon);
        const countered = counterMul > 1.2;
        const perfect = !!attacker._perfectRebound;
        if (perfect) attacker._perfectRebound = false;
        const comboMul = this._comboSys ? this._comboSys.onHit(countered, perfect, now) : 1;
        const dmg = this._affixApply(attacker, weapon, baseDmg * counterMul * (isBackstab ? 2 : 1) * comboMul);
        const lost = c.takeDamage(dmg, heavy || isBackstab, attacker, now);
        if (lost > 0) {
          this._emitHit(attacker, c, lost, weapon.name, 0xff3322, combo, heavy, now, isBackstab, branchCrit || this._lastAffixCrit);
          this._affixLeech(attacker, lost);
          c._curVel.addScaledVector(attacker.forward, knock * 2.5);
          if (launch) { if (launch.y) c.vy += launch.y; if (launch.rot) c._launchRot = launch.rot; }
        }
        if (!c.health.alive) this.bus.emit(EV.COMBAT_KILL, { victim: c, team: c.team, killer: attacker });
      }
    }
    // 下劈 AOE
    if (combo === 2 && weapon.comboLaunch && weapon.comboLaunch[2]?.aoe) {
      this.spawnAoE(attacker.position, weapon.comboLaunch[2].aoe, baseDmg * 0.5, attacker, now);
    }
  }

  spawnAoE(origin, radius, damage, attacker, now = 0) {
    for (const c of this.characters) {
      if (!c.alive || c.team === attacker.team) continue;
      const d = c.position.distanceTo(origin);
      if (d <= radius) {
        let dmg = this._affixApply(attacker, attacker.weapon, damage * (1 - d / radius));
        const lost = c.takeDamage(dmg, false, attacker, now);
        if (lost > 0) {
          if (this._comboSys) this._comboSys.onHit(false, false, now);
          this._emitHit(attacker, c, lost, '冲击', 0xaa8866, 0, false, now, false, this._lastAffixCrit);
          this._affixLeech(attacker, lost);
        }
        if (!c.health.alive) this.bus.emit(EV.COMBAT_KILL, { victim: c, team: c.team, killer: attacker });
      }
    }
    this.spawnHitFX(origin.clone().setY(0.5), 0xaa8866);
  }

  spawnArrow(attacker, weapon, charge) {
    const mesh = new THREE.Mesh(this._arrowGeo, this._arrowMat);
    mesh.castShadow = true;
    this._tmpOrigin.copy(attacker.position).add(this._tmpTo.set(0, 1.5, 0)).add(attacker.forward.clone().multiplyScalar(0.7));
    const vel = attacker.forward.clone().multiplyScalar(weapon.speedFor(charge));
    vel.y += 1.8;
    const weatherFx = this._weatherEffects || { bowAccuracy: 1.0 };
    const accuracy = weatherFx.bowAccuracy;
    if (accuracy < 1.0) {
      const spread = (1 - accuracy) * 0.3;
      vel.x += (Math.random() - 0.5) * spread * 10;
      vel.y += (Math.random() - 0.5) * spread * 10;
      vel.z += (Math.random() - 0.5) * spread * 10;
    }
    mesh.position.copy(this._tmpOrigin);
    this.scene.add(mesh);
    this.arrows.push({ mesh, pos: this._tmpOrigin.clone(), vel, team: attacker.team, damage: weapon.damageFor(charge), life: 3.5, attacker, charge });
  }

  spawnPierceArrow(attacker, weapon, charge, opts = {}) {
    const mesh = new THREE.Mesh(this._arrowGeo, this._arrowMat);
    mesh.castShadow = true;
    const origin = opts.origin || attacker.position;
    const dir = opts.dir || attacker.forward;
    this._tmpOrigin.copy(origin).add(this._tmpTo.set(0, 1.5, 0)).addScaledVector(dir, 0.7);
    const speed = opts.speed || (weapon ? weapon.speedFor(charge) * 1.2 : 45);
    const vel = dir.clone().multiplyScalar(speed);
    vel.y += 1.0;
    const damage = opts.damage ?? (weapon ? weapon.damageFor(charge) * 1.5 : 30);
    mesh.position.copy(this._tmpOrigin);
    this.scene.add(mesh);
    this.arrows.push({ mesh, pos: this._tmpOrigin.clone(), vel, team: attacker.team, damage, life: 4, attacker, charge, pierce: 3, hitSet: new Set() });
  }

  // 全向大招：360° 范围多段伤害
  ultimateMelee(attacker, arc, range, dmg, now = 0) {
    for (const c of this.characters) {
      if (!c.alive || c.team === attacker.team || c === attacker) continue;
      const dist = c.position.distanceTo(attacker.position);
      if (dist > range) continue;
      const total = this._affixApply(attacker, attacker.weapon, dmg);
      const lost = c.takeDamage(total, true, attacker, now);
      if (lost > 0) {
        this._emitHit(attacker, c, lost, '大招', 0xffaa22, 2, true, now, false, this._lastAffixCrit);
        this._affixLeech(attacker, lost);
        if (c._curVel) {
          this._tmpTo.copy(c.position).sub(attacker.position).setY(0).normalize();
          c._curVel.addScaledVector(this._tmpTo, 12);
        }
      }
      if (!c.health.alive) this.bus.emit(EV.COMBAT_KILL, { victim: c, team: c.team, killer: attacker });
    }
  }

  // 直线贯穿大招：沿 dir 的矩形走廊判定（宽 1.6）
  ultimateLine(origin, dir, length, dmg, attacker, now = 0) {
    const d = this._tmpTo.copy(dir).setY(0).normalize();
    for (const c of this.characters) {
      if (!c.alive || c.team === attacker.team || c === attacker) continue;
      const rx = c.position.x - origin.x;
      const rz = c.position.z - origin.z;
      const along = rx * d.x + rz * d.z;
      if (along < 0 || along > length) continue;
      const perp = Math.abs(rx * -d.z + rz * d.x);
      if (perp > 0.8) continue;
      const total = this._affixApply(attacker, attacker.weapon, dmg);
      const lost = c.takeDamage(total, true, attacker, now);
      if (lost > 0) {
        this._emitHit(attacker, c, lost, '大招', 0xffaa22, 2, true, now, false, this._lastAffixCrit);
        this._affixLeech(attacker, lost);
      }
      if (!c.health.alive) this.bus.emit(EV.COMBAT_KILL, { victim: c, team: c.team, killer: attacker });
    }
  }

  update(dt, terrain, now = 0) {
    for (let i = this.arrows.length - 1; i >= 0; i--) {
      const a = this.arrows[i];
      a.vel.y -= 9.5 * dt;
      a.pos.addScaledVector(a.vel, dt);
      a.life -= dt;
      a.mesh.position.copy(a.pos);
      this._tmpAim.copy(a.pos).add(a.vel);
      a.mesh.lookAt(this._tmpAim);
      let hit = false;
      if (a.life <= 0) hit = true;
      if (a.pos.y <= terrain.heightAt(a.pos.x, a.pos.z) - 0.2) { this.spawnHitFX(a.pos, 0xccaa66); hit = true; }
      for (const c of this.characters) {
        if (!c.alive || c.team === a.team) continue;
        const cap = c.capsule;
        if (a.pos.distanceTo(cap.center) < cap.radius + cap.halfHeight * 0.5) {
          const heavy = (a.charge ?? 0) >= 0.8;
          const lost = c.takeDamage(this._affixApply(a.attacker, a.attacker.weapon, a.damage), heavy, a.attacker, now);
          if (lost > 0) { this._emitHit(a.attacker, c, lost, '弓', 0xff5522, 0, heavy, now, false, this._lastAffixCrit); this._affixLeech(a.attacker, lost); }
          if (!c.health.alive) this.bus.emit(EV.COMBAT_KILL, { victim: c, team: c.team, killer: a.attacker });
          hit = true; break;
        }
      }
      if (hit) { this._releaseArrow(a); this.arrows.splice(i, 1); }
    }

    let anyActive = false;
    for (const s of this._partSlots) {
      if (!s.active) continue;
      anyActive = true;
      s.life -= dt;
      const pos = this._partGeo.attributes.position;
      for (let j = 0; j < this._partN; j++) {
        const idx = (s.offset + j) * 3;
        s.vel[j].y -= 9 * dt;
        pos.setXYZ(idx, pos.getX(idx) + s.vel[j].x * dt, pos.getY(idx) + s.vel[j].y * dt, pos.getZ(idx) + s.vel[j].z * dt);
      }
      if (s.life <= 0) s.active = false;
    }
    if (anyActive) { this._partGeo.attributes.position.needsUpdate = true; this._partMat.opacity = 1; }
    this._partPts.visible = anyActive;

    for (const n of this._numSprites) {
      if (!n.spr.visible) continue;
      n.life -= dt;
      n.spr.position.y += n.vy * dt;
      n.vy -= 1.5 * dt;
      n.spr.material.opacity = Math.max(0, n.life / 0.9);
      if (n.life <= 0) n.spr.visible = false;
    }
  }
}
