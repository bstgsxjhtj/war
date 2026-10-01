import { AIController } from './AIController.js';
import * as THREE from 'three';
import { EV } from '../core/constants/events.js';

const BOSS_TYPES = {
  warlord:  { hp: 300, speed: 5.5, name: '战将', skills: ['charge', 'roar', 'summon'], phase3: null,      signature: 'warcry',    weakness: 'backstab', weaknessMul: 1.5, weaknessDesc: '弱点：背刺' },
  ranger:   { hp: 220, speed: 6.0, name: '游侠', skills: ['rapidshot', 'dodge', 'trap'], phase3: 'clone', signature: 'volley',    weakness: 'melee', weaknessMul: 1.5, weaknessDesc: '弱点：近战' },
  mage:     { hp: 180, speed: 5.0, name: '法师', skills: ['fireball', 'teleport', 'aoe'], phase3: 'meteor', signature: 'frostnova', weakness: 'interrupt', weaknessMul: 2.0, weaknessDesc: '弱点：施法时打断' },
  behemoth: { hp: 400, speed: 4.5, name: '巨兽', skills: ['slam', 'charge', 'regenerate'], phase3: 'quake', signature: 'boulder',   weakness: 'projectile', weaknessMul: 1.5, weaknessDesc: '弱点：远程' },
};
// 技能阶段门槛：基础技阶段 1 开放，未列出的默认阶段 2，summon 阶段 3
const PHASE_GATE = { slam: 1, dodge: 1, summon: 3 };
const PHASE3_CD_RATE = 1.4;

export class BossEnemy extends AIController {
  constructor({ team = 1, type = 'warlord', mini = false } = {}) {
    super({ team });
    const cfg = BOSS_TYPES[type] || BOSS_TYPES.warlord;
    this._isBoss = true;
    this._bossType = type;
    this._isMini = mini;
    this._phase = 1;
    this._maxHp = mini ? Math.round(cfg.hp * 0.7) : cfg.hp;
    this.maxHp = this._maxHp;
    this.hp = this._maxHp;
    this.speed = cfg.speed;
    this._phaseTimer = 0;
    this._enrageTimer = 0;
    this._aoeRadius = 6;
    this._name = cfg.name;
    this._skillSet = mini ? cfg.skills.slice(0, 2) : cfg.skills.slice();
    this._phase3Skill = cfg.phase3 || null;
    this._meshScaled = false;
    this.damageReduction = 0;
    this._chargeCd = 0;
    this._roarCd = 0;
    this._summoned = false;
    this._chargeDir = new THREE.Vector3();
    this._rapidCd = 0;
    this._dodgeCd = 0;
    this._trapCd = 0;
    this._trapTimer = 0;
    this._trapPos = null;
    this._fireballCd = 0;
    this._teleportCd = 0;
    this._aoeSkillCd = 0;
    this._slamCd = 0;
    this._regenAcc = 0;
    this._quakeCd = 0;
    this._meteorCd = 0;
    this._cloneCd = 0;
    this._weakness = cfg.weakness || null;
    this._weaknessMul = cfg.weaknessMul || 1;
    this._weaknessDesc = cfg.weaknessDesc || '';
    this._signature = cfg.signature || null;
    this._sigCd = 0;
    this._castingTimer = 0;
    if (this.root) {
      const s = mini ? 1.1 : 1.35;
      this.root.scale.set(s, s, s);
      this._meshScaled = true;
    }
  }

  get displayName() { return '【Boss】' + this._name + (this._weaknessDesc ? ' · ' + this._weaknessDesc : ''); }

  getWeaknessMul(attacker) {
    if (!this._weakness || !attacker) return 1;
    switch (this._weakness) {
      case 'backstab': {
        const dx = attacker.position.x - this.position.x;
        const dz = attacker.position.z - this.position.z;
        const dist2 = dx * dx + dz * dz;
        if (dist2 < 0.01) return 1;
        const fwdDot = (dx * this.forward.x + dz * this.forward.z) / Math.sqrt(dist2);
        return fwdDot < -0.3 ? this._weaknessMul : 1;
      }
      case 'melee':
        return (attacker.weapon && attacker.weapon.type === 'melee') ? this._weaknessMul : 1;
      case 'interrupt':
        return this._castingTimer > 0 ? this._weaknessMul : 1;
      case 'projectile':
        return (attacker.weapon && attacker.weapon.type === 'projectile') ? this._weaknessMul : 1;
      default:
        return 1;
    }
  }

  _phaseGate(skill) { return PHASE_GATE[skill] ?? 2; }

  enterPhase(p) {
    if (this._isMini) p = Math.min(p, 2);
    if (p > this._phase) { this._phase = p; this.speed *= 1.15; this._enrageTimer = 5; }
  }

  _skillCharge(target, combat, now) {
    if (!target) return;
    this._chargeDir.subVectors(target.position, this.position).setY(0).normalize();
    this.position.add(this._chargeDir.clone().multiplyScalar(8));
    const enemies = combat.characters || [];
    for (const e of enemies) {
      if (!e.alive || e.team === this.team) continue;
      if (e.position.distanceTo(this.position) < 2.5) {
        e.position.add(this._chargeDir.clone().multiplyScalar(3));
        e.takeDamage(40, true, this, now);
      }
    }
    this._bus && this._bus.emit(EV.FX_SHAKE, { amount: 0.3 });
  }

  _skillRoar(combat, now) {
    const enemies = combat.characters || [];
    for (const e of enemies) {
      if (!e.alive || e.team === this.team) continue;
      const d = e.position.distanceTo(this.position);
      if (d < 6) {
        const back = new THREE.Vector3().subVectors(e.position, this.position).setY(0).normalize().multiplyScalar(4);
        e.position.add(back);
        e._slowTimer = (e._slowTimer || 0) + 1.5;
      }
    }
    combat.spawnAoE && combat.spawnAoE(this.root.position, 6, 15, this, now);
    this._bus && this._bus.emit(EV.FX_BOSSROAR, { boss: this });
    this._bus && this._bus.emit(EV.FX_SHAKE, { amount: 0.5 });
  }

  _skillSummon() {
    if (this._summoned) return;
    this._summoned = true;
    this._bus && this._bus.emit(EV.BOSS_SUMMON, { pos: this.root.position.clone(), team: this.team, count: 2 });
  }

  _skillRapidshot(target, combat, now) {
    if (!target) return;
    const dir = new THREE.Vector3().subVectors(target.position, this.root.position).setY(0).normalize();
    const axis = new THREE.Vector3(0, 1, 0);
    for (let i = -1; i <= 1; i++) {
      const a = dir.clone().applyAxisAngle(axis, i * 0.26);
      combat.spawnPierceArrow && combat.spawnPierceArrow(this, this.weapon, 1, { origin: this.root.position, dir: a, damage: 30 });
    }
    this._rapidCd = 8;
  }

  _skillDodge(target, now) {
    if (!target) return;
    const back = new THREE.Vector3().subVectors(this.position, target.position).setY(0).normalize().multiplyScalar(4);
    this.position.add(back);
    this._dodgeCd = 6;
  }

  _skillTrap(combat, now) {
    this._trapPos = this.root.position.clone();
    this._trapTimer = 1;
    this._trapCd = 15;
  }

  _skillFireball(target, combat, now) {
    if (!target) return;
    const dir = new THREE.Vector3().subVectors(target.position, this.root.position).setY(0).normalize();
    combat.spawnPierceArrow && combat.spawnPierceArrow(this, this.weapon, 1, { origin: this.root.position, dir, damage: 50 });
    this._castingTimer = 0.8;
    this._fireballCd = 7;
  }

  _skillTeleport(target, now) {
    if (!target) return;
    const fwd = new THREE.Vector3().subVectors(target.position, this.position).setY(0).normalize().multiplyScalar(-5);
    this.position.copy(target.position).add(fwd);
    this._castingTimer = 0.8;
    this._teleportCd = 10;
  }

  _skillAoe(combat, now) {
    combat.spawnAoE && combat.spawnAoE(this.root.position, 8, 35, this, now, 0.35);
    this._castingTimer = 0.8;
    this._aoeSkillCd = 12;
  }

  _skillSlam(combat, now) {
    combat.spawnAoE && combat.spawnAoE(this.root.position, 8, 30, this, now, 0.3);
    this._slamCd = 6;
    this._bus && this._bus.emit(EV.FX_SHAKE, { amount: 0.5 });
  }

  _skillRegenerate(dt) {
    if (this._phase >= 2 && this.hp < this._maxHp) {
      this._regenAcc += dt;
      if (this._regenAcc >= 1) { this.hp = Math.min(this._maxHp, this.hp + 5); this._regenAcc = 0; }
    }
  }

  // 阶段 3 专属机制
  _skillQuake(combat, now) {
    if (!combat.spawnAoE) return;
    const p = this.root.position;
    combat.spawnAoE(p, 6, 20, this, now, 0.4);
    combat.spawnAoE(p, 9, 20, this, now, 0.7);
    combat.spawnAoE(p, 12, 25, this, now, 1.0);
    this._quakeCd = 14;
    this._bus && this._bus.emit(EV.FX_SHAKE, { amount: 0.7 });
  }

  _skillMeteor(target, combat, now) {
    if (!target || !combat.spawnAoE) return;
    combat.spawnAoE(target.position, 5, 40, this, now, 0.6);
    this._castingTimer = 1.0;
    this._meteorCd = 12;
    this._bus && this._bus.emit(EV.FX_SHAKE, { amount: 0.5 });
  }

  _skillClone() {
    this._bus && this._bus.emit(EV.BOSS_SUMMON, { pos: this.root.position.clone(), team: this.team, count: 2 });
    this._cloneCd = 16;
  }

  // 阶段跃迁演出：范围击退 + 双段延迟冲击波预警 + 短暂无敌窗口
  _phaseBurst(phase, combat, now) {
    const enemies = (combat && combat.characters) || [];
    for (const e of enemies) {
      if (!e.alive || e.team === this.team) continue;
      if (e.position.distanceTo(this.position) < 8) {
        const back = new THREE.Vector3().subVectors(e.position, this.position).setY(0).normalize().multiplyScalar(5);
        e.position.add(back);
        e.takeDamage && e.takeDamage(phase === 3 ? 25 : 15, true, this, now);
      }
    }
    if (combat && combat.spawnAoE) {
      combat.spawnAoE(this.root.position, 7, phase === 3 ? 30 : 22, this, now, 0.5);
      combat.spawnAoE(this.root.position, 10, phase === 3 ? 30 : 22, this, now, 0.9);
    }
    this._iFrame = Math.max(this._iFrame || 0, 0.8);
    this._bus && this._bus.emit(EV.FX_BOSSROAR, { boss: this });
    this._bus && this._bus.emit(EV.FX_SHAKE, { amount: phase === 3 ? 0.8 : 0.6 });
  }

  // 战将签名技：战吼震慑 —— 范围震慑（击退 + 眩晕 + 自身狂暴）
  _skillWarcry(combat, now) {
    const enemies = (combat && combat.characters) || [];
    for (const e of enemies) {
      if (!e.alive || e.team === this.team) continue;
      if (e.position.distanceTo(this.position) < 9) {
        const back = new THREE.Vector3().subVectors(e.position, this.position).setY(0).normalize().multiplyScalar(4);
        e.position.add(back);
        if (typeof e._stun === 'number') e._stun = Math.max(e._stun, 1.2);
        e.takeDamage && e.takeDamage(15, true, this, now);
      }
    }
    this._enrageTimer = Math.max(this._enrageTimer, 3);
    this._sigCd = 14;
    this._bus && this._bus.emit(EV.FX_BOSSROAR, { boss: this });
    this._bus && this._bus.emit(EV.FX_SHAKE, { amount: 0.6 });
  }

  // 游侠签名技：箭雨 —— 目标点四段延迟落箭
  _skillVolley(target, combat, now) {
    if (!target || !combat.spawnAoE) return;
    const p = target.position;
    combat.spawnAoE(p, 3, 15, this, now, 0.4);
    combat.spawnAoE(p, 3, 15, this, now, 0.8);
    combat.spawnAoE(p, 4, 20, this, now, 1.2);
    combat.spawnAoE(p, 4, 20, this, now, 1.6);
    this._sigCd = 13;
  }

  // 法师签名技：冰霜新星 —— 范围减速 + 冰霜伤害
  _skillFrostnova(combat, now) {
    const enemies = (combat && combat.characters) || [];
    for (const e of enemies) {
      if (!e.alive || e.team === this.team) continue;
      if (e.position.distanceTo(this.position) < 8) {
        e._slowTimer = (e._slowTimer || 0) + 2.5;
        e.takeDamage && e.takeDamage(20, false, this, now);
      }
    }
    this._castingTimer = 0.7;
    this._sigCd = 11;
    this._bus && this._bus.emit(EV.FX_SHAKE, { amount: 0.35 });
  }

  // 巨兽签名技：投掷巨石 —— 高伤远程抛射
  _skillBoulder(target, combat, now) {
    if (!target || !combat.spawnPierceArrow) return;
    const dir = new THREE.Vector3().subVectors(target.position, this.root.position).setY(0).normalize();
    combat.spawnPierceArrow(this, this.weapon, 1, { origin: this.root.position, dir, damage: 45, speed: 22 });
    this._sigCd = 12;
    this._bus && this._bus.emit(EV.FX_SHAKE, { amount: 0.3 });
  }

  // 签名技调度：阶段 2 起解锁（mini 不携带签名技）
  _castSignature(combat, now, target) {
    switch (this._signature) {
      case 'warcry': this._skillWarcry(combat, now); break;
      case 'frostnova': this._skillFrostnova(combat, now); break;
      case 'volley': if (target) this._skillVolley(target, combat, now); break;
      case 'boulder': if (target) this._skillBoulder(target, combat, now); break;
      default: break;
    }
  }

  update(dt, terrain, combat, enemies, now, spatialHash = null) {
    if (!this._meshScaled && this.root) {
      const s = this._isMini ? 1.1 : 1.35;
      this.root.scale.set(s, s, s);
      this._meshScaled = true;
    }
    const hpPct = this.hp / this._maxHp;
    if (this._phase === 1 && hpPct < 0.6) {
      this._phase = 2; this.speed *= 1.2; this._enrageTimer = 5;
      this._bus && this._bus.emit(EV.HUD_BOSSPHASE, { boss: this, phase: 2 });
      this._phaseBurst(2, combat, now);
    }
    if (!this._isMini && this._phase === 2 && hpPct < 0.3) {
      this._phase = 3; this.speed *= 1.15; this._enrageTimer = 8;
      this._bus && this._bus.emit(EV.HUD_BOSSPHASE, { boss: this, phase: 3 });
      this._phaseBurst(3, combat, now);
    }
    if (this._enrageTimer > 0) {
      this._enrageTimer -= dt;
      this.damageReduction = 0.4;
    } else this.damageReduction = 0;
    const cdRate = this._phase >= 3 ? PHASE3_CD_RATE : 1;
    this._chargeCd -= dt * cdRate;
    this._roarCd -= dt * cdRate;
    this._rapidCd -= dt * cdRate;
    this._dodgeCd -= dt * cdRate;
    this._trapCd -= dt * cdRate;
    this._fireballCd -= dt * cdRate;
    this._teleportCd -= dt * cdRate;
    this._aoeSkillCd -= dt * cdRate;
    this._slamCd -= dt * cdRate;
    this._quakeCd -= dt * cdRate;
    this._meteorCd -= dt * cdRate;
    this._cloneCd -= dt * cdRate;
    this._sigCd -= dt * cdRate;
    if (this._castingTimer > 0) this._castingTimer -= dt;
    if (this._trapTimer > 0) {
      this._trapTimer -= dt;
      if (this._trapTimer <= 0 && this._trapPos) {
        combat.spawnAoE && combat.spawnAoE(this._trapPos, 5, 25, this, now);
        this._trapPos = null;
      }
    }
    const tgt = enemies ? enemies.find(e => e.alive && e.team !== this.team) : null;
    if (this._phase >= this._phaseGate('charge') && this._skillSet.includes('charge') && this._chargeCd <= 0 && tgt) {
      this._skillCharge(tgt, combat, now); this._chargeCd = 8;
    }
    if (this._phase >= this._phaseGate('roar') && this._skillSet.includes('roar') && this._roarCd <= 0) {
      this._skillRoar(combat, now); this._roarCd = 12;
    }
    if (this._phase >= 3 && this._skillSet.includes('summon') && !this._summoned) {
      this._skillSummon();
    }
    if (this._phase >= this._phaseGate('rapidshot') && this._skillSet.includes('rapidshot') && this._rapidCd <= 0 && tgt) this._skillRapidshot(tgt, combat, now);
    if (this._phase >= this._phaseGate('dodge') && this._skillSet.includes('dodge') && this._dodgeCd <= 0 && tgt) this._skillDodge(tgt, now);
    if (this._phase >= this._phaseGate('trap') && this._skillSet.includes('trap') && this._trapCd <= 0) this._skillTrap(combat, now);
    if (this._phase >= this._phaseGate('fireball') && this._skillSet.includes('fireball') && this._fireballCd <= 0 && tgt) this._skillFireball(tgt, combat, now);
    if (this._phase >= this._phaseGate('teleport') && this._skillSet.includes('teleport') && this._teleportCd <= 0 && tgt) this._skillTeleport(tgt, now);
    if (this._phase >= this._phaseGate('aoe') && this._skillSet.includes('aoe') && this._aoeSkillCd <= 0) this._skillAoe(combat, now);
    if (this._phase >= this._phaseGate('slam') && this._skillSet.includes('slam') && this._slamCd <= 0 && tgt) this._skillSlam(combat, now);
    if (this._skillSet.includes('regenerate')) this._skillRegenerate(dt);
    // P3-1 阶段 3 专属机制
    if (this._phase >= 3 && this._phase3Skill === 'quake' && this._quakeCd <= 0) this._skillQuake(combat, now);
    if (this._phase >= 3 && this._phase3Skill === 'meteor' && this._meteorCd <= 0 && tgt) this._skillMeteor(tgt, combat, now);
    if (this._phase >= 3 && this._phase3Skill === 'clone' && this._cloneCd <= 0) this._skillClone();
    // 签名技：阶段 2 起解锁（mini 不携带）
    if (!this._isMini && this._phase >= 2 && this._signature && this._sigCd <= 0) this._castSignature(combat, now, tgt);
    super.update(dt, terrain, combat, enemies, now, spatialHash);
  }
}

export class EliteEnemy extends AIController {
  constructor({ team = 1 } = {}) {
    super({ team });
    this._isElite = true;
    this._maxHp = 140;
    this.maxHp = this._maxHp;
    this.hp = this._maxHp;
    this.speed = 6.8;
    this._name = '精兵';
    this._meshScaled = false;
    this._dodgeChance = 0.25;
  }

  get displayName() { return '【精英】' + this._name; }

  update(dt, terrain, combat, enemies, now, spatialHash = null) {
    if (!this._meshScaled && this.root) {
      this.root.scale.set(1.15, 1.15, 1.15);
      this._meshScaled = true;
    }
    super.update(dt, terrain, combat, enemies, now, spatialHash);
  }

  takeDamage(amount, heavy = false, attacker = null, now = 0) {
    if (Math.random() < this._dodgeChance && this.alive && this._dodgeIFrame <= 0) {
      this._bus && this._bus.emit(EV.HUD_MISS, { target: this });
      return 0;
    }
    return super.takeDamage(amount, heavy, attacker, now);
  }
}
