import * as THREE from 'three';
import { Health } from './Health.js';
import { Stamina } from './Stamina.js';
import { Sword } from './weapons/Sword.js';
import { Bow } from './weapons/Bow.js';
import { Spear } from './weapons/Spear.js';
import { SwordShield } from './weapons/SwordShield.js';
import { Warhammer } from './weapons/Warhammer.js';
import { TextureFactory } from '../render/TextureFactory.js';
import { Skeleton } from './Skeleton.js';
import { EV } from '../core/constants/events.js';

// 角色：耐力+锁定+格挡+完美闪避+击飞+涉水(第三轮进化)
export class Character {
  constructor({ team = 0, isLocal = false, speed = 8.5, sprintMul = 1.7, maxHp = 160 } = {}) {
    this.team = team;
    this.isLocal = isLocal;
    this.speed = speed;
    this.sprintMul = sprintMul;
    this.alive = true;
    this.position = new THREE.Vector3();
    this.forward = new THREE.Vector3(0, 0, 1);
    this._targetYaw = 0;
    this._yaw = 0;
    this._curVel = new THREE.Vector3();
    this.vy = 0;
    this.onGround = true;
    this.lastAttacker = null;

    this.health = new Health(maxHp);
    this._baseMaxHp = maxHp;
    this.stamina = new Stamina(100);
    this.weapons = [new Sword(), new Bow()];
    this.weaponIdx = 0;

    this._moveF = 0; this._moveR = 0; this._sprint = false;
    this._comboCount = 0; this._comboTimer = 0; this._comboWindow = 0.6;
    this._attacking = false; this._anim = 0; this._animDur = 0.42;
    this._animCombo = 0; this._hitResolved = false;
    this._pendingCombat = null; this._pendingCharge = 1; this._pendingCombo = 0;
    this._charge = 0; this._charging = false;
    this._hurt = 0; this._emisDirty = false; this._lastHurtTime = -1;
    this._dodgeTimer = 0; this._dodgeIFrame = 0; this._dodgeOverride = 0;
    this._iFrame = 0;
    this._stun = 0;
    this._deadTimer = 0;
    // 第三轮：锁定/格挡/完美闪避/击飞
    this.lockTarget = null;
    this._blocking = false; this._perfectWindow = 0;
    this._perfectDodge = false; this._perfectBuff = 0;
    this._launchRot = 0;
    this._inWater = false;
    this._rage = 0; this.maxRage = 100; this._killstreak = 0; this._killstreakTimer = 0;
    this._executing = 0; this._executingTarget = null;

    this._vRight = new THREE.Vector3();
    this._vTarget = new THREE.Vector3();
    this._vUp = new THREE.Vector3(0, 1, 0);
    this._vTmp = new THREE.Vector3();
    this._capsule = { center: new THREE.Vector3(), radius: 0.5, halfHeight: 1.0 };

    this._footstepTimer = 0;
    this._build();
  }

  get weapon() { return this.weapons[this.weaponIdx]; }
  get rage() { return this._rage; }
  addRage(amount) { this._rage = Math.min(this.maxRage, this._rage + amount); }
  get killstreak() { return this._killstreak; }
  killstreakBuffs() {
    const k = this._killstreak;
    let dmgMul = 1, cdMul = 1, lifesteal = 0;
    if (k >= 3) dmgMul = 1.1;
    if (k >= 5) { dmgMul = 1.2; cdMul = 0.8; }
    if (k >= 7) { dmgMul = 1.3; lifesteal = 0.05; }
    return { dmgMul, cdMul, lifesteal };
  }
  get canBeExecuted() { return this.alive && this.health.ratio < 0.2; }

  _build() {
    const teamColor = this.team === 0 ? 0x2f5fa8 : 0xa83030;
    const armor = this.team === 0 ? 0x3a6fd0 : 0xd03a3a;
    const trim = this.team === 0 ? 0xd4b25a : 0xe0c060;
    const skin = 0xc89060;
    this.root = new THREE.Group();
    const matBody = new THREE.MeshStandardMaterial({ color: teamColor, roughness: 0.55, metalness: 0.35, flatShading: true, emissive: teamColor, emissiveIntensity: 0.12 });
    const matArmor = new THREE.MeshStandardMaterial({ color: armor, map: TextureFactory.noise(256, 256, '#4a4a4a', 18, 4), roughnessMap: TextureFactory.rough(256, 256, 0.5), roughness: 0.4, metalness: 0.6, flatShading: true });
    const matTrim = new THREE.MeshStandardMaterial({ color: trim, roughness: 0.5, metalness: 0.7, flatShading: true });
    const matSkin = new THREE.MeshStandardMaterial({ color: skin, roughness: 0.8, flatShading: true });
    this._mats = [matBody, matArmor, matTrim, matSkin];

    const legGeo = new THREE.CapsuleGeometry(0.16, 0.7, 3, 6);
    this.rLeg = new THREE.Mesh(legGeo, matArmor); this.rLeg.position.set(0.2, 0.5, 0); this.rLeg.castShadow = true;
    this.lLeg = new THREE.Mesh(legGeo, matArmor); this.lLeg.position.set(-0.2, 0.5, 0); this.lLeg.castShadow = true;
    this.torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.42, 0.95, 4, 10), matArmor); this.torso.position.y = 1.35; this.torso.castShadow = true;
    const belt = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.18, 8), matTrim); belt.position.y = 0.85;
    const shoGeo = new THREE.IcosahedronGeometry(0.28, 0);
    this.rSho = new THREE.Mesh(shoGeo, matArmor); this.rSho.position.set(0.5, 1.65, 0); this.rSho.castShadow = true;
    this.lSho = new THREE.Mesh(shoGeo, matArmor); this.lSho.position.set(-0.5, 1.65, 0); this.lSho.castShadow = true;
    const armGeo = new THREE.CapsuleGeometry(0.12, 0.5, 3, 6);
    this.rArm = new THREE.Mesh(armGeo, matBody); this.rArm.position.set(0.5, 1.3, 0); this.rArm.castShadow = true;
    this.lArm = new THREE.Mesh(armGeo, matBody); this.lArm.position.set(-0.5, 1.3, 0); this.lArm.castShadow = true;
    this.head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.3, 0), matSkin); this.head.position.y = 2.1; this.head.castShadow = true;
    const helm = new THREE.Mesh(new THREE.ConeGeometry(0.34, 0.5, 8), matTrim); helm.position.y = 2.28; helm.castShadow = true;
    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.1, 0.1), matArmor); visor.position.set(0, 2.12, 0.28);
    const rPauldron = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.3, 6), matTrim); rPauldron.position.set(0.5, 1.82, 0); rPauldron.castShadow = true;
    const lPauldron = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.3, 6), matTrim); lPauldron.position.set(-0.5, 1.82, 0); lPauldron.castShadow = true;
    const rKneeguard = new THREE.Mesh(new THREE.IcosahedronGeometry(0.14, 0), matTrim); rKneeguard.position.set(0.2, 0.28, 0.05); rKneeguard.castShadow = true;
    const lKneeguard = new THREE.Mesh(new THREE.IcosahedronGeometry(0.14, 0), matTrim); lKneeguard.position.set(-0.2, 0.28, 0.05); lKneeguard.castShadow = true;
    const chestplate = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.6, 0.35), matArmor); chestplate.position.set(0, 1.45, 0.05); chestplate.castShadow = true;
    const emblemGeo = new THREE.CircleGeometry(0.12, 6);
    const emblemMat = new THREE.MeshBasicMaterial({ color: trim, side: THREE.DoubleSide });
    const emblem = new THREE.Mesh(emblemGeo, emblemMat); emblem.position.set(0, 1.5, 0.23);
    const factionFlag = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.4), new THREE.MeshStandardMaterial({ color: teamColor, roughness: 0.6, side: THREE.DoubleSide, emissive: teamColor, emissiveIntensity: 0.2 }));
    factionFlag.position.set(0, 1.8, -0.5); factionFlag.castShadow = true;
    this.cape = new THREE.Mesh(
      new THREE.PlaneGeometry(0.7, 1.1, 4, 10),
      new THREE.ShaderMaterial({
        side: THREE.DoubleSide,
        uniforms: { uTime: { value: 0 }, uMove: { value: 0 }, uColor: { value: new THREE.Color(teamColor) } },
        vertexShader: `uniform float uTime; uniform float uMove; varying vec2 vUv; void main(){ vUv=uv; vec3 p=position; float wave=sin(p.y*3.0+uTime*4.0)*0.12*(1.0-uv.y); p.z+=wave+uMove*0.05*(1.0-uv.y); gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.0);} `,
        fragmentShader: `uniform vec3 uColor; varying vec2 vUv; void main(){ gl_FragColor=vec4(uColor,1.0);} `
      })
    );
    this.cape.position.set(0, 1.35, -0.42); this.cape.rotation.x = -0.12;

    this.weaponPivot = new THREE.Group(); this.weaponPivot.position.set(0.5, 1.3, 0.15);
    this._weaponMesh = this.weapon.createMesh(); this.weaponPivot.add(this._weaponMesh);

    this._hpBar = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0xff3030, transparent: true, opacity: 0.9, depthTest: false }));
    this._hpBarBg = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0x111111, transparent: true, opacity: 0.7, depthTest: false }));
    this._hpBar.scale.set(0.9, 0.09, 1); this._hpBarBg.scale.set(0.94, 0.13, 1);
    this._hpBar.position.y = 2.6; this._hpBarBg.position.y = 2.6;
    this._hpBar.renderOrder = 999; this._hpBarBg.renderOrder = 998;
    // 锁定标记
    this._lockMark = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0xffd070, transparent: true, opacity: 0, depthTest: false }));
    this._lockMark.scale.set(0.5, 0.5, 1); this._lockMark.position.y = 2.9; this._lockMark.renderOrder = 1001;
    const showBar = !this.isLocal;
    this._hpBar.visible = showBar; this._hpBarBg.visible = showBar;
    this.skeleton = new Skeleton(this.root);
    this.skeleton.bindParts({
      rLeg: this.rLeg, lLeg: this.lLeg, torso: this.torso, belt,
      rSho: this.rSho, lSho: this.lSho, rArm: this.rArm, lArm: this.lArm,
      head: this.head, helm, visor, cape: this.cape, weaponPivot: this.weaponPivot,
      rPauldron, lPauldron, rKneeguard, lKneeguard, chestplate, emblem, factionFlag
    });
    this.root.add(this._hpBar, this._hpBarBg, this._lockMark);
  }

  spawn(pos) {
    this.position.copy(pos); this.root.position.copy(pos);
    this.health.revive(); this.stamina.cur = this.stamina.max; this.alive = true; this.root.visible = true;
    this.root.rotation.x = 0; this.root.rotation.z = 0; this.root.position.y = pos.y;
    this._comboCount = 0; this._anim = 0; this._attacking = false; this._hurt = 0; this._deadTimer = 0;
    this._dodgeTimer = 0; this._dodgeIFrame = 0; this._iFrame = 0; this._stun = 0; this._dodgeOverride = 0;
    this._blocking = false; this._perfectWindow = 0; this._perfectDodge = false; this._perfectBuff = 0; this._launchRot = 0;
    this._updateHpBar();
  }

  setLook(yaw) { this._targetYaw = yaw; }
  setMove(f, r) { this._moveF = f; this._moveR = r; }
  setSprint(v) { this._sprint = v; }
  setCharging(v) { this._charging = v; if (!v && this.weapon.pullString) this.weapon.pullString(0); }
  get charge() { return this._charge; }
  get comboCount() { return this._comboCount; }
  get comboTimer() { return this._comboTimer; }
  get comboWindow() { return this._comboWindow; }

  switchWeapon(idx) {
    if (idx < 0 || idx >= this.weapons.length || idx === this.weaponIdx) return;
    this.weaponIdx = idx;
    this.weaponPivot.remove(this._weaponMesh);
    this._weaponMesh = this.weapon.createMesh();
    this.weaponPivot.add(this._weaponMesh);
    this._comboCount = 0; this._attacking = false; this._blocking = false;
  }

  setWeapons(arr) { this.weapons = arr; this.weaponIdx = 0; this.weaponPivot.remove(this._weaponMesh); this._weaponMesh = this.weapon.createMesh(); this.weaponPivot.add(this._weaponMesh); }

  tickCombo(dt) {
    if (this._comboTimer > 0) { this._comboTimer -= dt; if (this._comboTimer <= 0) this._comboCount = 0; }
  }

  _softLock(combat) {
    if (!combat) return;
    // 硬锁定优先
    if (this.lockTarget && this.lockTarget.alive) {
      const d = this.lockTarget.position.distanceTo(this.position);
      if (d < 15) {
        this._targetYaw = Math.atan2(this.lockTarget.position.x - this.position.x, this.lockTarget.position.z - this.position.z);
        return;
      } else this.lockTarget = null;
    }
    // 软锁定：5m 内 ±30°
    let best = null, bestAng = Math.PI / 6;
    for (const c of combat.characters) {
      if (!c.alive || c.team === this.team) continue;
      const d = c.position.distanceTo(this.position);
      if (d > 5) continue;
      const dx = c.position.x - this.position.x, dz = c.position.z - this.position.z;
      let ang = Math.atan2(dx, dz) - this._yaw;
      while (ang > Math.PI) ang -= Math.PI * 2;
      while (ang < -Math.PI) ang += Math.PI * 2;
      const a = Math.abs(ang);
      if (a < bestAng) { bestAng = a; best = c; }
    }
    if (best) this._targetYaw = Math.atan2(best.position.x - this.position.x, best.position.z - this.position.z);
  }

  tryAttack(combat, charge = 1) {
    if (!this.alive || this._attacking || !this.weapon.ready) return false;
    const isBow = this.weapon.type === 'projectile';
    if (isBow && charge < 0.15) return false;
    if (isBow && !this.stamina.consume(5)) return false;
    if (!isBow) this._softLock(combat);
    this._attacking = true;
    this._anim = this._animDur;
    this._animCombo = isBow ? 0 : this._comboCount;
    this._hitResolved = false;
    this._pendingCombat = combat;
    this._pendingCharge = charge;
    this._pendingCombo = this._animCombo;
    if (!isBow) {
      this._comboCount = (this._comboCount + 1) % 3;
      this._comboTimer = this._comboWindow;
    }
    if (this._audio) this._audio.swing();
    return true;
  }

  tryDodge(dir) {
    if (!this.alive || this._dodgeTimer > 0) return false;
    if (this._attacking && this._anim < this._animDur * 0.5) return false;
    this._attacking = false; this._hitResolved = true; this._blocking = false;
    // 完美闪避：闪避后0.12s内被攻击时触发(在takeDamage检测)
    this._dodgeTimer = 0.32; this._dodgeIFrame = 0.25; this._dodgeOverride = 0.18;
    if (!this.stamina.consume(25)) { this._dodgeIFrame = 0; } // 耐力不足：无iFrame翻滚
    this._vTmp.copy(dir).setY(0).normalize();
    this._curVel.addScaledVector(this._vTmp, 13);
    if (this._audio && this.isLocal) this._audio.dodge();
    if (this._bus) this._bus.emit(EV.FX_DODGE, { char: this });
    return true;
  }

  tryBlock() {
    if (!this.alive || this.weapon.type === 'projectile') return false;
    this._blocking = true; this._perfectWindow = 0.15;
    return true;
  }
  releaseBlock() { this._blocking = false; }

  takeDamage(amount, heavy = false, attacker = null, now = 0) {
    if (this._dodgeIFrame > 0 || this._iFrame > 0 || !this.alive) {
      // 完美闪避：闪避刚开始0.12s内(_dodgeTimer>0.2)被攻击
      if (this._dodgeIFrame > 0 && this._dodgeTimer > 0.2 && !this._perfectDodge) {
        this._perfectDodge = true; this._perfectBuff = 2; this._dodgeIFrame = 0.45;
        this.addRage(15);
        if (this._bus) this._bus.emit(EV.FX_PERFECTDODGE, { char: this });
      }
      return 0;
    }
    // 格挡判定
    if (this._blocking && attacker) {
      const dx = attacker.position.x - this.position.x;
      const dz = attacker.position.z - this.position.z;
      const dist2 = dx * dx + dz * dz;
      if (dist2 > 0.01) {
        const fwdDot = (dx * this.forward.x + dz * this.forward.z) / Math.sqrt(dist2);
        if (fwdDot > 0.5) { // 攻击者在前方±60°
          if (this._perfectWindow > 0) {
            attacker._hurt = Math.max(attacker._hurt, 0.4); // 弹刀
            this.stamina.consume(0);
            this.addRage(15);
            if (this._bus) this._bus.emit(EV.FX_PERFECTBLOCK, { char: this });
            return 0;
          }
          if (!attacker.weapon.armorPierce) {
            amount *= 0.3;
            this.stamina.consume(12);
          }
        }
      }
    }
    if (this.damageReduction) amount *= (1 - this.damageReduction);
    if (this._skill && this._skill.branchDefenseMul) amount *= this._skill.branchDefenseMul;
    const lost = this.health.damage(amount);
    if (attacker) this.lastAttacker = attacker;
    if (!this.health.alive && this.alive) { this.die(attacker); }
    else if (lost > 0 && this.alive) {
      this.addRage(5);
      if (this._comboSys) this._comboSys.onHurt();
      const recent = (now - this._lastHurtTime) < 0.5;
      const base = heavy ? 0.3 : 0.22;
      this._hurt = recent ? base * 0.5 : base;
      if (heavy) { this._attacking = false; this._hitResolved = true; this._blocking = false; }
      this._iFrame = 0.15;
      this._stun = heavy ? 0.3 : 0.15;
      this._lastHurtTime = now;
      this._updateHpBar();
    }
    return lost;
  }

  die(attacker = null) {
    this.alive = false;
    this._deadTimer = 1.2;
    this.lastAttacker = attacker;
    this._hpBar.visible = false; this._hpBarBg.visible = false; this._lockMark.material.opacity = 0;
  }

  setBus(b) { this._bus = b; }
  setComboSys(cs) { this._comboSys = cs; }
  setAudio(a) { this._audio = a; }
  setSkill(s) { this._skill = s; if (s) { this.health.maxHp += s.maxHpBonus; this.health.cur = this.health.maxHp; this.stamina.max += s.maxStaminaBonus; this.stamina.cur = this.stamina.max; } }

  setAffixes(a) { this._affixes = a; this._applyAffixMaxHp(); }
  _applyAffixMaxHp() {
    if (!this._affixes) return;
    const bonus = this._affixes.affixBonus(this.weapon, '坚韧');
    this.health.maxHp = this._baseMaxHp + bonus;
    if (this.health.cur > this.health.maxHp) this.health.cur = this.health.maxHp;
  }

  update(dt, terrain, combat, now) {
    for (const w of this.weapons) w.tick(dt);
    this.tickCombo(dt);
    if (this._killstreakTimer > 0) { this._killstreakTimer -= dt; if (this._killstreakTimer <= 0) this._killstreak = 0; }
    if (this._beingExecuted) return;
    if (this._executing > 0) { this._tickExecuting(dt, now); return; }
    this._tickTimers(dt);
    this.stamina.regen(dt * ((this._weatherEffects && this._weatherEffects.staminaRegenMul) || 1), this._attacking || this._dodgeTimer > 0 || this._blocking);
    if (this._charging) this._charge = Math.min(1, this._charge + dt / 1.2);
    if (this.weapon.pullString) this.weapon.pullString(this._charging ? this._charge : 0);

    if (!this.alive) { this._tickDeath(dt); return; }

    if (this._dodgeTimer > 0) {
      this._dodgeTimer -= dt;
      if (this._dodgeIFrame > 0) this._dodgeIFrame -= dt;
    }

    this._tickYaw(dt);
    const spd = this._calcSpeed(dt);
    this._tickPhysics(dt, terrain, combat, spd);

    const moving = Math.hypot(this._curVel.x, this._curVel.z);
    if (moving > 0.5 && this.onGround && this._dodgeTimer <= 0) {
      const f = this._sprint ? 1.6 : 1;
      const sw = Math.sin(now * 0.018 * f);
      this.root.position.y += sw * 0.05;
    }

    this._tickAttackPose(dt, now);
    this._tickAnimState(dt, now, moving);
    this._tickHurtFlash(dt);

    this.cape.material.uniforms.uTime.value = now;
    this.cape.material.uniforms.uMove.value = moving;
    // 脚步音
    if (this._footstepTimer > 0) this._footstepTimer -= dt;
    if (moving > 0.5 && this.onGround && this._audio && !this._attacking && this._dodgeTimer <= 0 && this._footstepTimer <= 0) {
      if (this.isLocal) this._audio.footstep();
      this._footstepTimer = 0.35;
    }
  }

  _tickExecuting(dt, now) {
    this._executing -= dt;
    if (this._executingTarget && this._executingTarget.alive) {
      this._tmpExec = this._tmpExec || new THREE.Vector3();
      this._tmpExec.copy(this.position).addScaledVector(this.forward, 1.2);
      this._executingTarget.position.lerp(this._tmpExec, 0.3);
      this.weaponPivot.rotation.z = Math.sin((1.2 - this._executing) * Math.PI / 1.2) * 1.5;
    }
    if (this._executing <= 0) {
      if (this._executingTarget && this._executingTarget.alive) this._executingTarget.takeDamage(9999, true, this, now);
      if (this._executingTarget) this._executingTarget._beingExecuted = false;
      this.weaponPivot.rotation.z = 0;
    }
  }

  _tickTimers(dt) {
    if (this._iFrame > 0) this._iFrame -= dt;
    if (this._dodgeOverride > 0) this._dodgeOverride -= dt;
    if (this._perfectWindow > 0) this._perfectWindow -= dt;
    if (this._perfectBuff > 0) this._perfectBuff -= dt;
  }

  _tickDeath(dt) {
    if (this._deadTimer > 0) {
      this._deadTimer -= dt;
      const k = Math.min(1, (1.2 - this._deadTimer) / 0.4);
      this.root.rotation.x = -Math.PI / 2 * k;
      this.root.position.y = this.position.y - 0.3 * k;
      if (this._deadTimer <= 0) this.root.visible = false;
    }
  }

  _tickYaw(dt) {
    let dy = this._targetYaw - this._yaw;
    while (dy > Math.PI) dy -= Math.PI * 2;
    while (dy < -Math.PI) dy += Math.PI * 2;
    this._yaw += dy * Math.min(1, dt * 12);
    this.forward.set(Math.sin(this._yaw), 0, Math.cos(this._yaw)).normalize();
    this.root.rotation.y = this._yaw;
  }

  // 移动限速：攻击分段 + 涉水减速 + 格挡减速
  _calcSpeed(dt) {
    let spd = this.speed * (this._sprint ? this.sprintMul : 1);
    if (this._skill && this._skill.branchMoveSpeedMul) spd *= this._skill.branchMoveSpeedMul;
    if (this._attacking) {
      const t = 1 - Math.max(0, this._anim) / this._animDur;
      const hitT = this.weapon.hitFrame ?? 0.35;
      spd *= t < hitT ? 0.3 : 0.7;
    }
    if (this._charging) spd *= 0.4;
    if (this._blocking) spd *= 0.5;
    if (this._hurt > 0.1 && this._dodgeOverride <= 0) spd *= 0;
    if (this._stun > 0) {
      this._stun -= dt;
      this._hurt = Math.max(this._hurt, 0.4);
      spd *= 0.3;
      if (this._attacking) this._attacking = false;
    }
    return spd;
  }

  _tickPhysics(dt, terrain, combat, spd) {
    // 涉水减速
    this._inWater = terrain.isWater ? terrain.isWater(this.position.x, this.position.z) : false;
    if (this._inWater) { spd *= 0.6; if (this._sprint) spd = this.speed * 0.6; }
    if (this._weatherEffects) spd *= (this._weatherEffects.speedMul || 1);

    this._vRight.crossVectors(this.forward, this._vUp).normalize();
    this._vTarget.set(0, 0, 0).addScaledVector(this.forward, this._moveF).addScaledVector(this._vRight, this._moveR);
    if (this._vTarget.lengthSq() > 1) this._vTarget.normalize();
    this._vTarget.multiplyScalar(spd);
    const accel = this.onGround ? 10 : 4;
    const lerpK = (this._hurt > 0.1 && this._dodgeOverride <= 0) ? 0 : Math.min(1, dt * accel);
    this._curVel.x += (this._vTarget.x - this._curVel.x) * lerpK;
    this._curVel.z += (this._vTarget.z - this._curVel.z) * lerpK;

    this.position.x += this._curVel.x * dt;
    this.position.z += this._curVel.z * dt;
    // 涉水流速推移
    if (this._inWater && terrain.flowDir && terrain.flowSpeed) {
      this.position.addScaledVector(terrain.flowDir, terrain.flowSpeed * dt);
    }
    this.vy -= 22 * dt;
    this.position.y += this.vy * dt;
    const ground = terrain.heightAt(this.position.x, this.position.z);
    // 落地震动
    if (this.position.y <= ground && this.vy < -6) {
      if (this._bus) this._bus.emit(EV.FX_SHAKE, { amount: 0.3 });
      this._launchRot = 0;
    }
    if (this.position.y <= ground) { this.position.y = ground; this.vy = 0; this.onGround = true; this._launchRot = 0; }
    else this.onGround = false;
    // 深水溺水
    if (this._inWater && terrain.waterDepth(this.position.x, this.position.z) > 1.2) {
      this.health.damage(2 * dt); this._updateHpBar();
    }

    // 角色间碰撞回退
    if (combat) {
      for (const other of combat.characters) {
        if (other === this || !other.alive) continue;
        const dx = this.position.x - other.position.x;
        const dz = this.position.z - other.position.z;
        const d = Math.hypot(dx, dz);
        if (d < 1.0 && d > 0.01) {
          const push = (1.0 - d) * 0.5;
          this.position.x += (dx / d) * push;
          this.position.z += (dz / d) * push;
        }
      }
    }
    this.root.position.copy(this.position);
    if (this._launchRot) this.root.rotation.z += this._launchRot * dt;
  }

  // 攻击/格挡姿态
  _tickAttackPose(dt, now) {
    if (this._blocking) {
      this.weaponPivot.rotation.set(-0.8, 0, 0.3);
    } else if (this._attacking) {
      this._anim -= dt;
      const t = 1 - Math.max(0, this._anim) / this._animDur;
      const combo = this._animCombo;
      const swing = Math.sin(t * Math.PI);
      if (combo === 0) this.weaponPivot.rotation.set(-0.15, 1.2 - swing * 2.4, 0);
      else if (combo === 1) this.weaponPivot.rotation.set(-1.0 + swing * 0.8, swing * 0.4, 0);
      else this.weaponPivot.rotation.set(-0.8 + swing * 2.0, 0, 0);
      const hitT = this.weapon.hitFrame ?? 0.35;
      if (!this._hitResolved && t >= hitT) {
        this._hitResolved = true;
        let dmg = this.weapon.comboDamage ? this.weapon.comboDamage[combo] ?? this.weapon.damage : this.weapon.damage;
        if (this._perfectBuff > 0) dmg *= 1.5; // 完美闪避后攻击加成
        this.weapon._perform(this, this._pendingCombat, { combo: this._pendingCombo, charge: this._pendingCharge, now, dmg });
        this.weapon._timer = this.weapon.cooldown * this.killstreakBuffs().cdMul * (this._skill && this._skill.branchAttackSpeedMul ? this._skill.branchAttackSpeedMul : 1);
        if (this.weapon.comboLunge) this._curVel.addScaledVector(this.forward, this.weapon.comboLunge[combo] ?? 3);
      }
      if (this._anim <= 0) this._attacking = false;
    } else {
      this.weaponPivot.rotation.x += (0 - this.weaponPivot.rotation.x) * 0.2;
      this.weaponPivot.rotation.y += (0 - this.weaponPivot.rotation.y) * 0.2;
      this.weaponPivot.rotation.z += (0 - this.weaponPivot.rotation.z) * 0.2;
    }
  }

  _tickAnimState(dt, now, moving) {
    let skelState = 'idle';
    let skelT = 0;
    if (!this.alive) { skelState = 'death'; skelT = Math.min(1, this._deadTimer / 1.0); }
    else if (this._executing > 0) { skelState = 'execute'; skelT = 1 - this._executing / 1.2; }
    else if (this._hurt > 0) { skelState = 'hurt'; skelT = 1 - this._hurt / 0.3; }
    else if (this._dodgeTimer > 0) { skelState = 'dodge'; skelT = 1 - this._dodgeTimer / 0.4; }
    else if (this._blocking) { skelState = 'block'; skelT = 1; }
    else if (this._charging) { skelState = 'charge'; skelT = 1; }
    else if (this._attacking) {
      skelState = 'attack' + (this._animCombo + 1);
      skelT = 1 - Math.max(0, this._anim) / this._animDur;
    } else if (moving > 0.5) {
      skelState = this._sprint ? 'run' : 'walk';
      skelT = ((now * 0.018 * (this._sprint ? 1.6 : 1)) % Math.PI) / Math.PI;
    }
    this.skeleton.applyState(skelState, skelT, { speed: moving, sprint: this._sprint, now: now * 0.001 });
    this.skeleton.update(dt);
  }

  _tickHurtFlash(dt) {
    if (this._hurt > 0) {
      this._hurt -= dt;
      const k = Math.max(0, this._hurt) / 0.3;
      const flash = 0.6 * Math.min(1, k * 2);
      for (const m of this._mats) { m.emissive.setRGB(flash, 0, 0); m.emissiveIntensity = 0.12 + flash; }
      this._emisDirty = true;
    } else if (this._emisDirty) {
      for (const m of this._mats) { m.emissive.setRGB(0, 0, 0); m.emissiveIntensity = m === this._mats[0] ? 0.12 : 0; }
      this._emisDirty = false;
    }
  }

  _updateHpBar() {
    const r = Math.max(0, this.health.ratio);
    this._hpBar.scale.x = r * 0.9;
    this._hpBar.position.x = -(1 - r) * 0.45;
  }

  setCameraRef(cam) { this._cam = cam.cam || cam; }
  setLockMark(v) { this._lockMark.material.opacity = v ? 0.9 : 0; }
  tryUltimate(combat) {
    if (this._rage < this.maxRage || !this.alive || this._executing > 0) return false;
    this._rage = 0;
    const w = this.weapon;
    if (w.weaponClass === 'BOW') {
      for (const off of [-0.26, 0, 0.26]) {
        const yaw = this._yaw + off;
        const fwd = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
        const mesh = new THREE.Mesh(combat._arrowGeo, combat._arrowMat);
        const pos = this.position.clone().add(new THREE.Vector3(0, 1.5, 0)).add(fwd.clone().multiplyScalar(0.7));
        const vel = fwd.multiplyScalar(70); vel.y += 1.8;
        mesh.position.copy(pos); mesh.castShadow = true; combat.scene.add(mesh);
        combat.arrows.push({ mesh, pos: pos.clone(), vel, team: this.team, damage: 50, life: 3.5, attacker: this, charge: 1, pierce: true });
      }
    } else if (w.weaponClass === 'HEAVY') {
      combat.spawnAoE(this.position, 6, 60, this, performance.now() * 0.001);
    } else if (w.weaponClass === 'SPEAR') {
      this._curVel.addScaledVector(this.forward, 30);
      combat.ultimateLine(this.position, this.forward, 5, 50, this);
    } else {
      combat.ultimateMelee(this, Math.PI * 2, 5, 6);
    }
    combat.hitstop = 0.2;
    if (this._bus) { this._bus.emit(EV.FX_SHAKE, { amount: 1.5 }); this._bus.emit(EV.COMBAT_ULTIMATE, { char: this }); }
    return true;
  }
  startExecute(target) {
    if (!target || !target.canBeExecuted || this._executing > 0) return false;
    this._executing = 1.2; this._executingTarget = target;
    target._beingExecuted = true;
    if (this._bus) this._bus.emit(EV.COMBAT_EXECUTE, { char: this, target });
    return true;
  }
  jump() { if (this.onGround && this.alive && this._dodgeTimer <= 0) { this.vy = 8.2; this.onGround = false; } }
  get capsule() {
    this._capsule.center.copy(this.position).addScaledVector(this._vUp, 1.3);
    return this._capsule;
  }
}
