import * as THREE from 'three';
import { ParticleFX } from '../render/ParticleFX.js';

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
    this._weatherEffects = null;
    this._tmpOrigin = new THREE.Vector3();
    this._tmpTo = new THREE.Vector3();

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

  _emitHit(attacker, victim, damage, weaponName, color, combo = 0, heavy = false, now = 0, backstab = false) {
    const counterMul = this._counterMul(attacker.weapon, victim.weapon);
    if (counterMul > 1.2) this.bus.emit('combat.counter', { attacker, victim, mul: counterMul });
    this.bus.emit('combat.hit', { attacker, victim, damage, weapon: weaponName, combo, heavy, backstab });
    this._tmpOrigin.copy(victim.position).add(this._tmpTo.set(0, 1.6, 0));
    this.spawnHitFX(this._tmpOrigin.clone(), color);
    this.createDamageNumber(this._tmpOrigin.clone(), Math.round(damage));
    const shakeMap = [0.16, 0.18, 0.32];
    this.bus.emit('fx.shake', { amount: Math.min(0.9, (shakeMap[combo] ?? 0.16) + (heavy ? 0.14 : 0)) });
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

  createDamageNumber(pos, amount) {
    const slot = this._numSprites.find(n => !n.spr.visible);
    if (!slot) return;
    const c = amount >= 35 ? '#ff5533' : '#ffe070';
    const ctx = this._numCtx;
    ctx.clearRect(0, 0, 128, 64);
    ctx.font = 'bold 44px Segoe UI, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(0,0,0,.85)'; ctx.strokeText(amount, 64, 32);
    ctx.fillStyle = c; ctx.fillText(amount, 64, 32);
    this._numTex.needsUpdate = true;
    slot.spr.position.copy(pos); slot.spr.visible = true;
    slot.life = 0.9; slot.vy = 1.8;
  }

  resolveMelee(attacker, weapon, combo, now = 0) {
    let baseDmg = weapon.comboDamage ? (weapon.comboDamage[combo] ?? weapon.damage) : weapon.damage;
    if (attacker._perfectBuff > 0) baseDmg *= 1.5;
    if (attacker._skill) baseDmg *= attacker._skill.totalMul(attacker.weaponIdx);
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
        const dmg = baseDmg * counterMul * (isBackstab ? 2 : 1) * comboMul;
        const lost = c.takeDamage(dmg, heavy || isBackstab, attacker, now);
        if (lost > 0) {
          this._emitHit(attacker, c, lost, weapon.name, 0xff3322, combo, heavy, now, isBackstab);
          c._curVel.addScaledVector(attacker.forward, knock * 2.5);
          if (launch) { if (launch.y) c.vy += launch.y; if (launch.rot) c._launchRot = launch.rot; }
        }
        if (!c.health.alive) this.bus.emit('combat.kill', { victim: c, team: c.team, killer: attacker });
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
        const lost = c.takeDamage(damage * (1 - d / radius), false, attacker, now);
        if (lost > 0) this._emitHit(attacker, c, lost, '冲击', 0xaa8866, 0, false, now);
        if (!c.health.alive) this.bus.emit('combat.kill', { victim: c, team: c.team, killer: attacker });
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

  spawnPierceArrow(attacker, weapon, charge) {
    const mesh = new THREE.Mesh(this._arrowGeo, this._arrowMat);
    mesh.castShadow = true;
    this._tmpOrigin.copy(attacker.position).add(this._tmpTo.set(0, 1.5, 0)).add(attacker.forward.clone().multiplyScalar(0.7));
    const vel = attacker.forward.clone().multiplyScalar(weapon.speedFor(charge) * 1.2);
    vel.y += 1.0;
    mesh.position.copy(this._tmpOrigin);
    this.scene.add(mesh);
    this.arrows.push({ mesh, pos: this._tmpOrigin.clone(), vel, team: attacker.team, damage: weapon.damageFor(charge) * 1.5, life: 4, attacker, charge, pierce: 3, hitSet: new Set() });
  }

  update(dt, terrain, now = 0) {
    for (let i = this.arrows.length - 1; i >= 0; i--) {
      const a = this.arrows[i];
      a.vel.y -= 9.5 * dt;
      a.pos.addScaledVector(a.vel, dt);
      a.life -= dt;
      a.mesh.position.copy(a.pos);
      a.mesh.lookAt(a.pos.clone().add(a.vel));
      let hit = false;
      if (a.life <= 0) hit = true;
      if (a.pos.y <= terrain.heightAt(a.pos.x, a.pos.z) - 0.2) { this.spawnHitFX(a.pos.clone(), 0xccaa66); hit = true; }
      for (const c of this.characters) {
        if (!c.alive || c.team === a.team) continue;
        const cap = c.capsule;
        if (a.pos.distanceTo(cap.center) < cap.radius + cap.halfHeight * 0.5) {
          const heavy = (a.charge ?? 0) >= 0.8;
          const lost = c.takeDamage(a.damage, heavy, a.attacker, now);
          if (lost > 0) this._emitHit(a.attacker, c, lost, '弓', 0xff5522, 0, heavy, now);
          if (!c.health.alive) this.bus.emit('combat.kill', { victim: c, team: c.team, killer: a.attacker });
          hit = true; break;
        }
      }
      if (hit) { this.scene.remove(a.mesh); this.arrows.splice(i, 1); }
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
