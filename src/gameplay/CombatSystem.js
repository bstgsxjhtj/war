import * as THREE from 'three';
import { ParticleFX } from '../render/ParticleFX.js';
import { EV } from '../core/constants/events.js';
import { COMBAT, ENEMY_MODS } from '../core/constants/balance.js';
import { applyEnemyBehaviors } from './AffixBehavior.js';
import { SpatialHash } from '../core/SpatialHash.js';

// 克制矩阵：attacker.weaponClass -> victim.weaponClass -> 倍率（导出供单测引用，构造时复用同一引用）
export const COUNTER_MATRIX = {
  HEAVY: { SHIELD: 1.8, SWORD: 1.2 },
  SPEAR: { SHIELD: 1.5, SWORD: 1.2 },
  SHIELD: { HEAVY: 1.3 },
  SWORD: { HEAVY: 1.2 }
};

// P1-C 相克多维化：在 4×4 武器类矩阵之上新增两张正交小表相乘（类 M&B 伤害类型×护甲 + FE 职业三角）
// 伤害类型 × 护甲类型 减伤系数（钝>刺>切 对重甲；切割破轻甲）
export const DAMAGE_ARMOR_TABLE = {
  cut:    { light: 1.0, medium: 0.75, heavy: 0.50 },
  pierce: { light: 1.0, medium: 0.85, heavy: 0.70 },
  blunt:  { light: 0.85, medium: 0.95, heavy: 1.0 },
};
// 武器类 → 伤害类型映射（同一武器类固定一种伤害类型；未来可按招式切换）
export const WEAPON_DAMAGE_TYPE = {
  SWORD: 'cut', SPEAR: 'pierce', HEAVY: 'blunt', SHIELD: 'blunt',
  BOW: 'pierce', STAFF: 'pierce', DAGGER: 'cut',
};
// 职业相克第三维（刺客>法师>重装>刺客，类 FE 武器三角）
export const CLASS_COUNTER = { assassin: { mage: 1.3 }, mage: { warrior: 1.3 }, warrior: { assassin: 1.3 } };
// 三表正交相乘总倍率上限（防爆增）
export const COUNTER_TOTAL_MAX = 2.5;

const ARROW_POOL_MAX = 64;
const MAX_HIT_RADIUS = 2;

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
    this._spatialHash = new SpatialHash(10);
    this._spatialStamp = NaN;
    this._tmpOrigin = new THREE.Vector3();
    this._tmpTo = new THREE.Vector3();
    this._tmpAim = new THREE.Vector3();
    this._tmpPrev = new THREE.Vector3();
    this._tmpDir = new THREE.Vector3();
    this._tmpVec = new THREE.Vector3();
    this._arrowPool = [];
    this._fxRings = [];
    this._projMatCache = {};

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

    // P1-1: 延迟 AOE 预警——共享单位环（按 radius 缩放），待结算队列
    this._aoeRingGeo = new THREE.RingGeometry(0.85, 1.0, 32);
    this._aoeRingMat = new THREE.MeshBasicMaterial({ color: 0xff5533, transparent: true, opacity: 0.4, side: THREE.DoubleSide, depthWrite: false });
    this._pendingStrikes = [];
    // 攻城结构引用（可选）：投石落地轰击城门、近战可砍城门
    this.siege = null;
  }

  register(c) { this.characters.push(c); if (c.setBus) c.setBus(this.bus); }

  _ensureSpatial(now) {
    if (this._spatialStamp === now) return;
    const h = this._spatialHash;
    h.clear();
    for (let i = 0; i < this.characters.length; i++) h.insert(this.characters[i]);
    this._spatialStamp = now;
  }
  // 池化：复用 arrow 对象（mesh + pos/vel 向量），避免每次发射重复分配
  _acquireArrow() {
    const a = this._arrowPool.pop() || { mesh: null, pos: new THREE.Vector3(), vel: new THREE.Vector3() };
    if (!a.mesh) {
      a.mesh = new THREE.Mesh(this._arrowGeo, this._arrowMat);
      a.mesh.castShadow = true;
    }
    this.scene.add(a.mesh);
    return a;
  }
  _releaseArrow(a) {
    if (!a || !a.mesh) return;
    if (a.isSiege) { if (a.mesh.geometry) a.mesh.geometry.dispose(); if (a.mesh.material) a.mesh.material.dispose(); this.scene.remove(a.mesh); return; }
    this.scene.remove(a.mesh);
    if (this._arrowPool.length < ARROW_POOL_MAX) this._arrowPool.push(a);
  }
  clear() {
    for (const a of this.arrows) this.scene.remove(a.mesh);
    this.arrows.length = 0;
    for (const s of this._partSlots) s.active = false;
    this._partPts.visible = false;
    for (const n of this._numSprites) n.spr.visible = false;
    for (const s of this._pendingStrikes) { if (s.mesh) this.scene.remove(s.mesh); if (s.mat) s.mat.dispose(); }
    this._pendingStrikes.length = 0;
    for (const r of this._fxRings) { this.scene.remove(r.mesh); r.mat.dispose(); }
    this._fxRings.length = 0;
    for (const k in this._projMatCache) this._projMatCache[k].dispose();
    this._projMatCache = {};
    this.characters.length = 0;
    this._spatialHash.clear();
    this._spatialStamp = NaN;
  }

  dispose() {
    this.clear();
    if (this._arrowGeo) this._arrowGeo.dispose();
    if (this._arrowMat) this._arrowMat.dispose();
    if (this._partGeo) this._partGeo.dispose();
    if (this._partMat) this._partMat.dispose();
    if (this._partMat && this._partMat.map && typeof this._partMat.map.dispose === 'function') this._partMat.map.dispose();
    if (this._numTex) this._numTex.dispose();
    for (const n of this._numSprites) {
      this.scene.remove(n.spr);
      if (n.spr.material) n.spr.material.dispose();
    }
    if (this._aoeRingGeo) this._aoeRingGeo.dispose();
    if (this._aoeRingMat) this._aoeRingMat.dispose();
    this.scene.remove(this._partPts);
  }

  _counterMul(atkW, vicW, attacker) {
    const a = atkW?.weaponClass, v = vicW?.weaponClass;
    if (!a || !v) return 1;
    const base = this._counterMatrix[a]?.[v] ?? 1;
    return base > 1 ? base * (attacker?._runCounterMul || 1) : base;
  }

  // P1-C：伤害类型 × 护甲类型 减伤（类 M&B：钝>刺>切 对重甲）
  _damageTypeMul(atkW, victim) {
    const dt = WEAPON_DAMAGE_TYPE[atkW?.weaponClass];
    if (!dt) return 1;
    const at = victim?.armorType;
    if (!at) return 1; // 未设护甲类型则不减伤（向后兼容现有 mockChar/无护甲单位）
    return DAMAGE_ARMOR_TABLE[dt]?.[at] ?? 1;
  }

  // P1-C：职业相克第三维（类 FE 三角：刺客>法师>重装>刺客）
  _classCounterMul(attacker, victim) {
    const ac = attacker?.classType, vc = victim?.classType;
    if (!ac || !vc) return 1;
    return CLASS_COUNTER[ac]?.[vc] ?? 1;
  }

  // P1-C：多维克制合成，返回 {damageMul, postureMul}（克制时削韧加成，接已有架势条）
  _counterMulFull(atkW, vicW, attacker, victim) {
    const weaponMul = this._counterMul(atkW, vicW, attacker);
    const dmgTypeMul = this._damageTypeMul(atkW, victim);
    const classMul = this._classCounterMul(attacker, victim);
    const damageMul = Math.min(COUNTER_TOTAL_MAX, weaponMul * dmgTypeMul * classMul);
    const postureMul = weaponMul > 1 ? weaponMul : 1;
    return { damageMul, postureMul, weaponMul, dmgTypeMul, classMul };
  }

  _emitHit(attacker, victim, damage, weaponName, color, combo = 0, heavy = false, now = 0, backstab = false, crit = false) {
    if (attacker && attacker.addRage) attacker.addRage(3);
    const counterMul = this._counterMul(attacker.weapon, victim.weapon, attacker);
    if (counterMul > 1.2) this.bus.emit(EV.COMBAT_COUNTER, { attacker, victim, mul: counterMul });
    this.bus.emit(EV.COMBAT_HIT, { attacker, victim, damage, weapon: weaponName, combo, heavy, backstab, crit });
    this._tmpOrigin.copy(victim.position).add(this._tmpTo.set(0, 1.6, 0));
    const wHit = attacker && attacker.weapon;
    const fxColor = (wHit && wHit.hitColor != null) ? wHit.hitColor : color;
    this.spawnHitFX(this._tmpOrigin, fxColor);
    if (wHit && wHit.hitEffect === 'magic') this._spawnMagicRing(this._tmpOrigin, fxColor);
    this.createDamageNumber(this._tmpOrigin, Math.round(damage), counterMul > COMBAT.COUNTER_THRESHOLD, crit);
    this.bus.emit(EV.FX_SHAKE, { amount: Math.min(COMBAT.SHAKE_MAX, (COMBAT.SHAKE_MAP[combo] ?? COMBAT.SHAKE_MAP[0]) + (heavy ? COMBAT.HEAVY_SHAKE_BONUS : 0)) });
    this.hitstop = Math.min(COMBAT.HITSTOP_MAX, this.hitstop + (COMBAT.HITSTOP_MAP[combo] ?? COMBAT.HITSTOP_MAP[0]) + (heavy ? COMBAT.HEAVY_HITSTOP_BONUS : 0));
  }

  _spawnMagicRing(pos, color) {
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.7, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(this._aoeRingGeo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(pos.x, 0.08, pos.z);
    mesh.scale.set(0.3, 0.3, 0.3);
    this.scene.add(mesh);
    this._fxRings.push({ mesh, mat, life: 0.35, max: 0.35, expand: 5 });
  }

  _getProjectileMat(color) {
    if (!this._projMatCache[color]) {
      this._projMatCache[color] = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.5 });
    }
    return this._projMatCache[color];
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
    let out = dmg;
    if (this._affixes && weapon) {
      out = dmg * (1 + this._affixes.affixBonus(weapon, '锋锐') + this._affixes.synergyBonus(weapon, 'damage'));
      const critChance = (this._affixes ? this._affixes.affixBonus(weapon, '暴怒') + this._affixes.synergyBonus(weapon, 'crit') : 0) + (attacker?._runCritChance || 0);
      if (Math.random() < critChance) { out *= 2; this._lastAffixCrit = true; }
    }
    if (attacker && attacker._enemyMods && attacker._enemyMods.includes('lucky') && !this._lastAffixCrit && Math.random() < ENEMY_MODS.LUCKY_CRIT_CHANCE) { out *= ENEMY_MODS.LUCKY_CRIT_MUL; this._lastAffixCrit = true; }
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
    applyEnemyBehaviors.onDealDamage(attacker, null, lost, { vampireFraction: ENEMY_MODS.VAMPIRE_LIFESTEAL });
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
    this._ensureSpatial(now);
    const nearby = this._spatialHash.queryRadius(attacker.position, weapon.range);
    for (const c of nearby) {
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
        const counter = this._counterMulFull(attacker.weapon, c.weapon, attacker, c);
        const countered = counter.weaponMul > 1.2;
        const perfect = !!attacker._perfectRebound;
        if (perfect) attacker._perfectRebound = false;
        const comboMul = this._comboSys ? this._comboSys.onHit(countered, perfect, now) : 1;
        const dmg = this._affixApply(attacker, weapon, baseDmg * counter.damageMul * (isBackstab ? 2 : 1) * comboMul);
        const finalDmg = Math.min(dmg, weapon.damage * COMBAT.DMG_MUL_MAX);
        const lost = c.takeDamage(finalDmg, heavy || isBackstab, attacker, now);
        if (lost > 0) {
          this._emitHit(attacker, c, lost, weapon.name, 0xff3322, combo, heavy, now, isBackstab, branchCrit || this._lastAffixCrit);
          this._affixLeech(attacker, lost);
          c._curVel.addScaledVector(attacker.forward, knock * 2.5);
          if (launch) { if (launch.y) c.vy += launch.y; if (launch.rot) c._launchRot = launch.rot; }
        }
        if (!c.health.alive) this.bus.emit(EV.COMBAT_KILL, { victim: c, team: c.team, killer: attacker });
      }
    }
    // 近战攻击城门：攻城方（非防守 team 1）在城门正面范围内可造成伤害
    if (this.siege && !this.siege.gate.broken && attacker.team !== 1) {
      const gp = this.siege.gate.position;
      const gdx = gp.x - attacker.position.x;
      const gdz = gp.z - attacker.position.z;
      const gHoriz = Math.sqrt(gdx * gdx + gdz * gdz);
      if (gHoriz <= weapon.range + 2 && gHoriz > 0.01) {
        const gDot = (gdx * attacker.forward.x + gdz * attacker.forward.z) / gHoriz;
        if (gDot > 0.3) {
          this.siege.damageGate(baseDmg, attacker);
          this.spawnHitFX(this._tmpOrigin.copy(gp).add(this._tmpTo.set(0, 1, 0)), 0xccaa66);
        }
      }
    }
    // 下劈 AOE
    if (combo === 2 && weapon.comboLaunch && weapon.comboLaunch[2]?.aoe) {
      this.spawnAoE(attacker.position, weapon.comboLaunch[2].aoe, baseDmg * 0.5, attacker, now);
    }
  }

  spawnAoE(origin, radius, damage, attacker, now = 0, delay = 0) {
    if (delay > 0) {
      const mat = this._aoeRingMat.clone();
      const mesh = new THREE.Mesh(this._aoeRingGeo, mat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(origin.x || 0, 0.08, origin.z || 0);
      mesh.scale.set(radius, radius, radius);
      this.scene.add(mesh);
      const o = origin.clone ? origin.clone() : new THREE.Vector3(origin.x || 0, 0, origin.z || 0);
      this._pendingStrikes.push({ origin: o, radius, damage, attacker, now, delay, mesh, mat });
      return;
    }
    this._resolveAoE(origin, radius, damage, attacker, now);
  }

  _resolveAoE(origin, radius, damage, attacker, now) {
    this._ensureSpatial(now);
    const nearby = this._spatialHash.queryRadius(origin, radius);
    for (const c of nearby) {
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
    const a = this._acquireArrow();
    this._tmpOrigin.copy(attacker.position).add(this._tmpTo.set(0, 1.5, 0)).addScaledVector(attacker.forward, 0.7);
    a.pos.copy(this._tmpOrigin);
    a.vel.copy(attacker.forward).multiplyScalar(weapon.speedFor(charge));
    a.vel.y += 1.8;
    const weatherFx = this._weatherEffects || { bowAccuracy: 1.0 };
    const accuracy = weatherFx.bowAccuracy;
    if (accuracy < 1.0) {
      const spread = (1 - accuracy) * COMBAT.BOW_SPREAD_FACTOR;
      a.vel.x += (Math.random() - 0.5) * spread * 10;
      a.vel.y += (Math.random() - 0.5) * spread * 10;
      a.vel.z += (Math.random() - 0.5) * spread * 10;
    }
    a.mesh.position.copy(this._tmpOrigin);
    a.mesh.material = (weapon.projectileColor != null) ? this._getProjectileMat(weapon.projectileColor) : this._arrowMat;
    a.team = attacker.team;
    a.damage = weapon.damageFor(charge);
    a.life = COMBAT.ARROW_LIFE;
    a.attacker = attacker;
    a.charge = charge;
    a.pierce = 0;
    a.hitSet = null;
    a.isSiege = false;
    this.arrows.push(a);
  }

  spawnPierceArrow(attacker, weapon, charge, opts = {}) {
    const a = this._acquireArrow();
    const origin = opts.origin || attacker.position;
    const dir = opts.dir || attacker.forward;
    this._tmpOrigin.copy(origin).add(this._tmpTo.set(0, 1.5, 0)).addScaledVector(dir, 0.7);
    const speed = opts.speed || (weapon ? weapon.speedFor(charge) * 1.2 : 45);
    a.pos.copy(this._tmpOrigin);
    a.vel.copy(dir).multiplyScalar(speed);
    a.vel.y += 1.0;
    const damage = opts.damage ?? (weapon ? weapon.damageFor(charge) * 1.5 : 30);
    a.mesh.position.copy(this._tmpOrigin);
    a.team = attacker.team;
    a.damage = damage;
    a.life = COMBAT.PIERCE_ARROW_LIFE;
    a.attacker = attacker;
    a.charge = charge;
    a.pierce = COMBAT.PIERCE_ARROW_PIERCE;
    a.hitSet = new Set();
    a.isSiege = false;
    this.arrows.push(a);
  }

  // 全向大招：360° 范围多段伤害
  ultimateMelee(attacker, arc, range, dmg, now = 0) {
    this._ensureSpatial(now);
    const nearby = this._spatialHash.queryRadius(attacker.position, range);
    for (const c of nearby) {
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
    this._ensureSpatial(now);
    const nearby = this._spatialHash.queryRadius(origin, length + 1);
    for (const c of nearby) {
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
    this._ensureSpatial(now);
    for (let i = this._fxRings.length - 1; i >= 0; i--) {
      const r = this._fxRings[i];
      r.life -= dt;
      const t = 1 - r.life / r.max;
      const s = 0.3 + t * r.expand;
      r.mesh.scale.set(s, s, s);
      r.mat.opacity = (1 - t) * 0.7;
      if (r.life <= 0) { this.scene.remove(r.mesh); r.mat.dispose(); this._fxRings.splice(i, 1); }
    }
    for (let i = this.arrows.length - 1; i >= 0; i--) {
      const a = this.arrows[i];
      this._tmpPrev.copy(a.pos);
      a.vel.y -= 9.5 * dt;
      a.pos.addScaledVector(a.vel, dt);
      a.life -= dt;
      a.mesh.position.copy(a.pos);
      this._tmpAim.copy(a.pos).add(a.vel);
      a.mesh.lookAt(this._tmpAim);
      let hit = false;
      if (a.life <= 0) hit = true;
      if (a.pos.y <= terrain.heightAt(a.pos.x, a.pos.z) - 0.2) {
        this.spawnHitFX(a.pos, 0xccaa66);
        if (a.isSiege && this.siege) this.siege.onSiegeHit(a.pos);
        hit = true;
      }
      const arrowNearby = this._spatialHash.queryRadius(a.pos, a.vel.length() * dt + MAX_HIT_RADIUS);
      for (const c of arrowNearby) {
        if (!c.alive || c.team === a.team) continue;
        if (a.hitSet && a.hitSet.has(c)) continue;
        const cap = c.capsule;
        const hitR = cap.radius + cap.halfHeight * 0.5;
        // 线段-点扫掠命中：检测 prev→pos 线段到 capsule.center 的最近距离，避免高速箭矢穿隧
        this._tmpDir.copy(a.pos).sub(this._tmpPrev);
        const lenSq = this._tmpDir.lengthSq();
        let distSq;
        if (lenSq < 1e-8) {
          distSq = a.pos.distanceToSquared(cap.center);
        } else {
          this._tmpVec.copy(cap.center).sub(this._tmpPrev);
          let t = this._tmpVec.dot(this._tmpDir) / lenSq;
          if (t < 0) t = 0; else if (t > 1) t = 1;
          this._tmpVec.copy(this._tmpPrev).addScaledVector(this._tmpDir, t);
          distSq = this._tmpVec.distanceToSquared(cap.center);
        }
        if (distSq < hitR * hitR) {
          const heavy = (a.charge ?? 0) >= 0.8;
          // 投石等无 attacker 的抛射物：跳过词缀/吸血/命中事件中对 attacker 的依赖
          const lost = c.takeDamage(a.attacker ? this._affixApply(a.attacker, a.attacker.weapon, a.damage) : a.damage, heavy, a.attacker, now);
          if (lost > 0 && a.attacker) { this._emitHit(a.attacker, c, lost, '弓', 0xff5522, 0, heavy, now, false, this._lastAffixCrit); this._affixLeech(a.attacker, lost); }
          else if (lost > 0) this.spawnHitFX(this._tmpOrigin.copy(c.position).add(this._tmpTo.set(0, 1.6, 0)), 0xff5522);
          if (!c.health.alive) this.bus.emit(EV.COMBAT_KILL, { victim: c, team: c.team, killer: a.attacker });
          if (a.pierce > 0) { a.pierce -= 1; a.hitSet.add(c); continue; }
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

    for (let i = this._pendingStrikes.length - 1; i >= 0; i--) {
      const s = this._pendingStrikes[i];
      s.delay -= dt;
      if (s.mat) s.mat.opacity = 0.3 + 0.35 * Math.abs(Math.sin(s.delay * 18));
      if (s.delay <= 0) {
        this._resolveAoE(s.origin, s.radius, s.damage, s.attacker, s.now);
        if (s.mesh) this.scene.remove(s.mesh);
        if (s.mat) s.mat.dispose();
        this._pendingStrikes.splice(i, 1);
      }
    }
  }
}
