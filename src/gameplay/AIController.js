import * as THREE from 'three';
import { Character } from './Character.js';
import { EV } from '../core/constants/events.js';
import { ENEMY_MODS, POSTURE } from '../core/constants/balance.js';
import { TelegraphIndicator } from '../render/TelegraphIndicator.js';
import { applyEnemyBehaviors } from './AffixBehavior.js';

export class AIController extends Character {
  constructor({ team = 1, passive = false, maxHp = 90 } = {}) {
    super({ team, isLocal: false, speed: 6.2, maxHp });
    this._passive = passive;
    this._state = 'patrol';
    this._patrolTarget = new THREE.Vector3();
    this._formationTarget = null;
    this._formationYaw = null;
    this._retargetTimer = 0;
    this._reactTimer = 0;
    this._swordReactTimer = 0;
    this._strafePhase = 0;
    this._focusTarget = null;
    this._focusTimer = 0;
    this._vDir = new THREE.Vector3();
    this._vFlank = new THREE.Vector3();
    this._vFlankRet = new THREE.Vector3();
    this._vCover = new THREE.Vector3();
    this._dodgeTimer = 0;
    this._blockTimer = 0;
    this._dodgeCd = 0;
    this._blockCd = 0;
    this._counterTimer = 0;
    this._siegeTarget = null;
    this._callReinforceCd = 0;
    this._spotCd = 0;
    this._isElite = false;
    this._eliteSkill = null;
    this._squadId = null;
    this._squadRole = null;
    this._aiManager = null;
    this._windupDur = 0.45;
    this._windupTimer = 0;
    this._telegraph = new TelegraphIndicator(this.root);
    this._enemyMods = null;
    this._reflecting = false;
    this._perfectBlockCount = 0;
    this._perfectBlockDecay = 0;
    this._adaptRetreat = 0;
    this._pickPatrol();
  }

  setAIManager(m) { this._aiManager = m; }
  setIsElite(v) { this._isElite = v; if (v) this.root.scale.set(1.15, 1.15, 1.15); }
  setSiegeTarget(pos) { this._siegeTarget = pos ? pos.clone() : null; }
  setEnemyMods(mods) { this._enemyMods = mods ? [...mods] : null; }
  hasMod(name) { return !!this._enemyMods && this._enemyMods.includes(name); }

  _pickPatrol(center) {
    const base = center || this.position;
    const a = Math.random() * Math.PI * 2;
    const r = 6 + Math.random() * 14;
    this._patrolTarget.set(base.x + Math.cos(a) * r, 0, base.z + Math.sin(a) * r);
  }

  // 复用预分配向量，避免每帧 clone/new 分配
  _calcFlankDir(target, allAllies) {
    if (this._squadRole === 'ranged') {
      this._vFlank.subVectors(this.position, target.position).setY(0).normalize();
      return this._vFlank;
    }
    this._vFlank.subVectors(target.position, this.position).setY(0).normalize();
    let cover = 0;
    for (const a of allAllies) {
      if (a === this || !a.alive) continue;
      const d = this._vCover.subVectors(a.position, target.position).setY(0).normalize();
      const dot = d.dot(this._vFlank);
      if (dot > 0.3) cover += 1;
    }
    if (cover >= 2) {
      this._vFlankRet.set(-this._vFlank.z, 0, this._vFlank.x);
      return this._vFlankRet.multiplyScalar(Math.sin(this._strafePhase) > 0 ? 1 : -1);
    }
    return this._vFlank;
  }

  takeDamage(amount, heavy, attacker, now) {
    if (this._dodgeTimer > 0) return 0;
    if (this._blockTimer > 0) amount *= 0.3;
    amount = applyEnemyBehaviors.modifyIncoming(this, amount, { ironhideMul: ENEMY_MODS.IRONHIDE_DMG_TAKEN_MUL });
    const lost = super.takeDamage(amount, heavy, attacker, now);
    applyEnemyBehaviors.onTakeDamage(this, attacker, lost, { reflectFraction: ENEMY_MODS.REFLECT_FRACTION, now });
    if (this._blockTimer > 0 && this.alive) {
      const counterChance = (this._isElite && this._eliteSkill === 'blockCounter') ? 1.0 : 0.5;
      if (Math.random() < counterChance) {
        this._counterTimer = 0.3;
      }
    }
    return lost;
  }

  _startWindup() {
    this._windupTimer = this._windupDur;
    if (this._telegraph) this._telegraph.show(this._windupDur);
  }

  _strikeFromWindup(combat) {
    this.tryAttack(combat, 1);
    this._swordReactTimer = 0.5 + Math.random() * 0.4;
    if (this._telegraph) this._telegraph.hide();
  }

  update(dt, terrain, combat, enemies, now) {
    if (!this.alive) {
      if (this._windupTimer > 0) { this._windupTimer = 0; if (this._telegraph) this._telegraph.hide(); }
      super.update(dt, terrain, combat, now); return;
    }
    if (this._passive) { this.setMove(0, 0); this.setSprint(false); super.update(dt, terrain, combat, now); return; }
    this._strafePhase += dt * 1.2;
    if (this._swordReactTimer > 0) this._swordReactTimer -= dt;
    this._focusTimer -= dt;
    if (this._dodgeTimer > 0) this._dodgeTimer -= dt;
    if (this._blockTimer > 0) this._blockTimer -= dt;
    if (this._dodgeCd > 0) this._dodgeCd -= dt;
    if (this._blockCd > 0) this._blockCd -= dt;
    if (this._callReinforceCd > 0) this._callReinforceCd -= dt;
    if (this._spotCd > 0) this._spotCd -= dt;
    if (this._windupTimer > 0) {
      this._windupTimer -= dt;
      if (this._windupTimer <= 0) { this._windupTimer = 0; this._strikeFromWindup(combat); }
    }
    if (this._telegraph) this._telegraph.update(dt);
    if (this._counterTimer > 0) { this._counterTimer -= dt; if (this._swordReactTimer <= 0 && this.weapon && this.weapon.ready) { this.tryAttack(combat, 1); this._swordReactTimer = 0.5; } }

    // P3-2 涌现：连续被完美格挡后变招（拉开距离 + 叫援军）
    if (this._wasPerfectBlocked) {
      this._wasPerfectBlocked = false;
      this._perfectBlockCount++;
      this._perfectBlockDecay = 4;
      if (this._perfectBlockCount >= 2) {
        this._perfectBlockCount = 0;
        this._adaptRetreat = 2.5;
        if (this._bus) this._bus.emit(EV.AI_CALLREINFORCE, { pos: this.position.clone(), team: this.team, id: this });
      }
    }
    if (this._perfectBlockDecay > 0) {
      this._perfectBlockDecay -= dt;
      if (this._perfectBlockDecay <= 0) { this._perfectBlockDecay = 0; this._perfectBlockCount = 0; }
    }

    if (this._posture > POSTURE.MAX * 0.7 && this.alive && this._postureBroken <= 0) {
      this._adaptRetreat = Math.max(this._adaptRetreat, 1.5);
    }

    if (this._isElite && this._eliteSkill === 'enrage' && this.health.ratio < 0.5) {
      this._swordReactTimer *= 0.5;
      this._eliteSkill = null;
    }

    if (this._focusTimer <= 0) {
      this._focusTimer = 2;
      let best = null, minHp = Infinity;
      for (const e of enemies) {
        if (!e.alive || e.team === this.team) continue;
        if (e.health.ratio < minHp) { minHp = e.health.ratio; best = e; }
      }
      this._focusTarget = best;
    }

    if (this.health.ratio < 0.3) {
      this._state = 'retreat';
      if (this._windupTimer > 0) { this._windupTimer = 0; if (this._telegraph) this._telegraph.hide(); }
      let nearest = null, minD = Infinity;
      for (const e of enemies) {
        if (!e.alive || e.team === this.team) continue;
        const d = e.position.distanceTo(this.position);
        if (d < minD) { minD = d; nearest = e; }
      }
      if (nearest) {
        this._vDir.subVectors(this.position, nearest.position).setY(0).normalize();
        this.setLook(Math.atan2(this._vDir.x, this._vDir.z));
        this.setMove(1, 0);
        this.setSprint(true);
        super.update(dt, terrain, combat, now);
        return;
      }
    }

    // P3-2 涌现变招：适应撤退（被连续完美格挡后拉开距离，不攻击）
    if (this._adaptRetreat > 0) {
      this._adaptRetreat -= dt;
      this._state = 'retreat';
      if (this._windupTimer > 0) { this._windupTimer = 0; if (this._telegraph) this._telegraph.hide(); }
      let nearest = null, minD = Infinity;
      for (const e of enemies) {
        if (!e.alive || e.team === this.team) continue;
        const d = e.position.distanceTo(this.position);
        if (d < minD) { minD = d; nearest = e; }
      }
      if (nearest) {
        this._vDir.subVectors(this.position, nearest.position).setY(0).normalize();
        this.setLook(Math.atan2(this._vDir.x, this._vDir.z));
        this.setMove(1, 0);
        this.setSprint(true);
        super.update(dt, terrain, combat, now);
        return;
      }
    }

    let target = this._focusTarget && this._focusTarget.alive ? this._focusTarget : null;
    let minDist = target ? target.position.distanceTo(this.position) : Infinity;
    if (!target) {
      for (const e of enemies) {
        if (!e.alive || e.team === this.team) continue;
        const d = e.position.distanceTo(this.position);
        if (d < minDist) { minDist = d; target = e; }
      }
    }

    const w = this.weapon;
    const isBow = w && w.type === 'projectile';
    const engageRange = isBow ? 40 : (w ? w.range * 0.9 : 12);

    if (target) {
      this._reactTimer -= dt;
      this._vDir.subVectors(target.position, this.position);
      this._vDir.y = 0;
      const dist = this._vDir.length();
      this._vDir.normalize();
      this.setLook(Math.atan2(this._vDir.x, this._vDir.z));

      const diff = this._aiManager ? this._aiManager.difficulty() : null;
      if (this._dodgeCd <= 0 && dist < engageRange && Math.random() < (diff ? diff.dodgeChance : 0)) {
        this._dodgeTimer = 0.3; this._dodgeCd = 2;
        const back = new THREE.Vector3().subVectors(this.position, target.position).setY(0).normalize().multiplyScalar(4);
        this.position.add(back);
        if (this._isElite && this._eliteSkill === 'dodgeStrike') {
          this._counterTimer = 0.3;
        }
      }
      if (this.weapon && this.weapon.weaponClass === 'SHIELD' && this._blockCd <= 0 && Math.random() < (diff ? diff.blockChance : 0)) {
        this._blockTimer = 0.4; this._blockCd = 3;
      }

      if (isBow && dist < 14) {
        this._state = 'retreat';
        this.setMove(-0.8, Math.sin(this._strafePhase) * 0.4);
        this.setSprint(true);
      } else if (dist > engageRange) {
        this._state = 'chase';
        this.setMove(1, 0);
        this.setSprint(dist > 18);
      } else {
        this._state = 'attack';
        if (this._callReinforceCd <= 0) {
          this._callReinforceCd = diff ? diff.callReinforceCd : 60;
          if (this._bus) this._bus.emit(EV.AI_CALLREINFORCE, { pos: this.position.clone(), team: this.team, id: this });
        }
        if (this._spotCd <= 0) {
          this._spotCd = 15;
          if (this._bus) this._bus.emit(EV.AI_SPOTPLAYER, { target, team: this.team, id: this });
        }
        if (isBow) {
          this.setMove(dist < 18 ? -0.5 : 0, Math.sin(this._strafePhase) * 0.5);
          this.setSprint(false);
          if (this._reactTimer <= 0 && w.ready) {
            const savedYaw = this._targetYaw;
            this.setLook(savedYaw + (Math.random() - 0.5) * 0.28);
            this.tryAttack(combat, 0.3);
            this.setLook(savedYaw);
            this._reactTimer = (diff ? diff.reactTime : 0.3) + Math.random() * 0.8;
          }
        } else {
          if (this._windupTimer > 0) {
            this.setMove(0, 0);
            this.setSprint(false);
          } else {
            const allies = enemies.filter(e => e.team === this.team);
            const flank = this._calcFlankDir(target, allies);
            this.setMove(flank.dot(this.forward) > 0 ? 1 : 0.3, Math.sin(this._strafePhase) * 0.4);
            this.setSprint(false);
            if (this._swordReactTimer <= 0 && w.ready) {
              this._startWindup();
            }
          }
        }
      }
    } else {
      this._state = 'patrol';
      if (this._siegeTarget) {
        this._vDir.subVectors(this._siegeTarget, this.position);
        this._vDir.y = 0;
        const sd = this._vDir.length();
        if (sd < 3) { this._siegeTarget = null; this._pickPatrol(this.position); }
        else { this._vDir.normalize(); this.setLook(Math.atan2(this._vDir.x, this._vDir.z)); this.setMove(1, 0); this.setSprint(true); }
      } else {
        if (this._formationTarget) {
          this._patrolTarget.copy(this._formationTarget);
          if (this._formationYaw !== null) this.setLook(this._formationYaw);
        }
        this._vDir.subVectors(this._patrolTarget, this.position);
        this._vDir.y = 0;
        const dist = this._vDir.length();
        if (dist < 1.5 || this._retargetTimer <= 0) {
          this._pickPatrol(this.position);
          this._retargetTimer = 4 + Math.random() * 4;
        } else {
          this._vDir.normalize();
          this.setLook(Math.atan2(this._vDir.x, this._vDir.z));
          this.setMove(1, 0);
          this.setSprint(false);
        }
      }
    }

    this._retargetTimer -= dt;
    super.update(dt, terrain, combat, now);
  }
}
