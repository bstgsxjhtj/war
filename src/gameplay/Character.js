import * as THREE from 'three';
import { Health } from './Health.js';
import { Stamina } from './Stamina.js';
import { Sword } from './weapons/Sword.js';
import { Bow } from './weapons/Bow.js';
import { Spear } from './weapons/Spear.js';
import { SwordShield } from './weapons/SwordShield.js';
import { Warhammer } from './weapons/Warhammer.js';
import { TextureFactory } from '../render/TextureFactory.js';
import { deepDispose } from '../render/disposeUtils.js';
import { Skeleton } from './Skeleton.js';
import { EV } from '../core/constants/events.js';

import { COMBAT, EXECUTE, POSTURE } from '../core/constants/balance.js';

function applyFresnelRim(mat, rimColor, intensity) {
  const c = new THREE.Color(rimColor);
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uRimColor = { value: c };
    shader.uniforms.uRimIntensity = { value: intensity };
    // MeshStandardMaterial 的 vertex/fragment shader 已内置 vViewPosition varying，直接复用，切勿重复声明
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 uRimColor;\nuniform float uRimIntensity;')
      .replace('#include <lights_fragment_end>', '#include <lights_fragment_end>\nfloat rim=pow(1.0-max(dot(normal,normalize(vViewPosition)),0.0),3.0);\ngl_FragColor.rgb+=rim*uRimColor*uRimIntensity;');
  };
  mat.customProgramCacheKey = () => 'fresnelRim';
  return mat;
}

// 角色：耐力+锁定+格挡+完美闪避+击飞+涉水(第三轮进化)
export class Character {
  constructor({ team = 0, isLocal = false, speed = 8.5, sprintMul = 1.7, maxHp = 160, maxStamina = 100, classType = null, classColor = null } = {}) {
    this.team = team;
    this.isLocal = isLocal;
    this.speed = speed;
    this.sprintMul = sprintMul;
    this._classType = classType;
    this._classColor = classColor;
    this.alive = true;
    // P2: AI 动画降频——非本地角色 skeleton.update 降至 30fps（玩家满帧保证响应），
    // _animAccum 累积 dt 达到 _animInterval 才执行一次骨骼矩阵更新
    this._animAccum = 0;
    this._animInterval = isLocal ? 0 : 1 / 30;
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
    this.stamina = new Stamina(maxStamina);
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
    this._slowTimer = 0;
    this._weaponTrail = null; this._weaponTrailColor = 0;
    this._deadTimer = 0;
    // 第三轮：锁定/格挡/完美闪避/击飞
    this.lockTarget = null;
    this._blocking = false; this._perfectWindow = 0;
    this._perfectDodge = false; this._perfectBuff = 0;
    this._launchRot = 0;
    this._inWater = false;
    this._posture = 0; this._postureBroken = 0; this._postureRegenDelay = 0;
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
  // hp/maxHp 访问器转发到 health，消除实例字段与 health 的双真相（BossEnemy/EliteEnemy 依赖）
  get hp() { return this.health.hp; }
  set hp(v) { this.health.hp = v; }
  get maxHp() { return this.health.maxHp; }
  set maxHp(v) { this.health.maxHp = v; }
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
  get canBeExecuted() { return this.alive && (this.health.ratio < COMBAT.EXECUTE_HP_RATIO + (this._runExecBonus || 0) || this._postureBroken > 0); }

  _build() {
    const teamColor = this.team === 0 ? 0x2f5fa8 : 0xa83030;
    const armor = this.team === 0 ? 0x3a6fd0 : 0xd03a3a;
    const trim = this.team === 0 ? 0xd4b25a : 0xe0c060;
    const skin = 0xc89060;
    this.root = new THREE.Group();
    const matBody = new THREE.MeshStandardMaterial({ color: teamColor, roughness: 0.55, metalness: 0.35, emissive: teamColor, emissiveIntensity: 0.12 });
    const matArmor = new THREE.MeshStandardMaterial({ color: armor, map: TextureFactory.noise(256, 256, '#4a4a4a', 18, 4), normalMap: TextureFactory.normal(256, 256, 0.4), normalScale: new THREE.Vector2(0.6, 0.6), roughnessMap: TextureFactory.rough(256, 256, 0.5), roughness: 0.4, metalness: 0.6 });
    const matTrim = new THREE.MeshStandardMaterial({ color: trim, roughness: 0.5, metalness: 0.7 });
    applyFresnelRim(matArmor, 0xffb060, 0.5); applyFresnelRim(matTrim, 0xffb060, 0.6);
    const matSkin = new THREE.MeshStandardMaterial({ color: skin, roughness: 0.8 });
    const matHelm = new THREE.MeshStandardMaterial({ color: this.team === 0 ? 0x7a9fd0 : 0x4a4a52, roughness: 0.3, metalness: 0.85 });
    applyFresnelRim(matHelm, 0xaaccff, 0.5);
    const matEyeW = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const matEyeP = new THREE.MeshBasicMaterial({ color: 0x111111 });
    this._eyeMats = [matEyeW, matEyeP];
    this._mats = [matBody, matArmor, matTrim, matSkin, matHelm];

    const legGeo = new THREE.CapsuleGeometry(0.20, 0.40, 4, 12);
    this.rLeg = new THREE.Mesh(legGeo, matArmor); this.rLeg.position.set(0.2, 0.5, 0); this.rLeg.castShadow = true;
    this.lLeg = new THREE.Mesh(legGeo, matArmor); this.lLeg.position.set(-0.2, 0.5, 0); this.lLeg.castShadow = true;
    this.torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.50, 0.50, 6, 16), matArmor); this.torso.position.y = 1.35; this.torso.castShadow = true;
    const belt = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.52, 0.15, 12), matTrim); belt.position.y = 0.85;
    const shoGeo = new THREE.IcosahedronGeometry(0.32, 1);
    this.rSho = new THREE.Mesh(shoGeo, matArmor); this.rSho.position.set(0.5, 1.65, 0); this.rSho.castShadow = true;
    this.lSho = new THREE.Mesh(shoGeo, matArmor); this.lSho.position.set(-0.5, 1.65, 0); this.lSho.castShadow = true;
    const armGeo = new THREE.CapsuleGeometry(0.16, 0.30, 4, 12);
    this.rArm = new THREE.Mesh(armGeo, matBody); this.rArm.position.set(0.5, 1.3, 0); this.rArm.castShadow = true;
    this.lArm = new THREE.Mesh(armGeo, matBody); this.lArm.position.set(-0.5, 1.3, 0); this.lArm.castShadow = true;
    this.head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.42, 2), matSkin); this.head.position.y = 2.1; this.head.castShadow = true;
    const eyeGeoW = new THREE.SphereGeometry(0.095, 10, 10);
    const eyeGeoP = new THREE.SphereGeometry(0.052, 8, 8);
    const eyeL = new THREE.Mesh(eyeGeoW, matEyeW); eyeL.position.set(-0.16, 0.06, 0.36);
    const pupilL = new THREE.Mesh(eyeGeoP, matEyeP); pupilL.position.set(-0.16, 0.06, 0.43);
    const eyeR = new THREE.Mesh(eyeGeoW, matEyeW); eyeR.position.set(0.16, 0.06, 0.36);
    const pupilR = new THREE.Mesh(eyeGeoP, matEyeP); pupilR.position.set(0.16, 0.06, 0.43);
    const browGeo = new THREE.BoxGeometry(0.15, 0.035, 0.02);
    const browMat = new THREE.MeshBasicMaterial({ color: 0x2a1a08 });
    const browL = new THREE.Mesh(browGeo, browMat); browL.position.set(-0.16, 0.17, 0.39); browL.rotation.z = -0.15;
    const browR = new THREE.Mesh(browGeo, browMat); browR.position.set(0.16, 0.17, 0.39); browR.rotation.z = 0.15;
    this.head.add(eyeL, pupilL, eyeR, pupilR, browL, browR);
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.09, 6), matSkin);
    nose.position.set(0, -0.03, 0.43); nose.rotation.x = Math.PI / 2;
    this.head.add(nose);
    const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.03, 0.02), new THREE.MeshBasicMaterial({ color: 0x3a2010 }));
    mouth.position.set(0, -0.15, 0.40);
    this.head.add(mouth);
    this._face = { eyeL, eyeR, pupilL, pupilR, mouth, browL, browR, mouthMat: mouth.material };
    this._blinkTimer = 2 + Math.random() * 3;
    this._blinkPhase = 0;
    this._faceState = "idle";
    // 阵营头部装饰：蓝方野蛮人（牛角盔+金色大胡子） / 红方骑士（暗铁盔+红色盔缨）
    if (this.team === 0) {
      const hornGeo = new THREE.TorusGeometry(0.14, 0.045, 6, 10, Math.PI * 0.85);
      const hornMat = new THREE.MeshStandardMaterial({ color: 0xe8e0d0, roughness: 0.55 });
      const hornL = new THREE.Mesh(hornGeo, hornMat); hornL.position.set(-0.38, 0.30, 0); hornL.rotation.z = Math.PI * 0.5; hornL.castShadow = true;
      const hornR = new THREE.Mesh(hornGeo, hornMat); hornR.position.set(0.38, 0.30, 0); hornR.rotation.z = -Math.PI * 0.35; hornR.castShadow = true;
      this.head.add(hornL, hornR);
      const beardMat = new THREE.MeshStandardMaterial({ color: 0xd8a030, roughness: 0.85 });
      const beard = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.30, 8), beardMat);
      beard.position.set(0, -0.32, 0.28); beard.rotation.x = Math.PI;
      this.head.add(beard);
      const mustGeo = new THREE.BoxGeometry(0.14, 0.045, 0.04);
      const mustL = new THREE.Mesh(mustGeo, beardMat); mustL.position.set(-0.11, -0.17, 0.39); mustL.rotation.z = 0.35; mustL.rotation.y = -0.3;
      const mustR = new THREE.Mesh(mustGeo, beardMat); mustR.position.set(0.11, -0.17, 0.39); mustR.rotation.z = -0.35; mustR.rotation.y = 0.3;
      this.head.add(mustL, mustR);
    } else {
      const crest = new THREE.Mesh(
        new THREE.BoxGeometry(0.08, 0.22, 0.55),
        new THREE.MeshStandardMaterial({ color: 0xd03030, roughness: 0.7 })
      );
      crest.position.set(0, 0.62, -0.05); crest.castShadow = true;
      this.head.add(crest);
    }
    const helmPoints = [
      new THREE.Vector2(0.46, 0), new THREE.Vector2(0.44, 0.05),
      new THREE.Vector2(0.40, 0.12), new THREE.Vector2(0.34, 0.25),
      new THREE.Vector2(0.24, 0.38), new THREE.Vector2(0.12, 0.46),
      new THREE.Vector2(0, 0.50),
    ];
    const helm = new THREE.Mesh(new THREE.LatheGeometry(helmPoints, 16), matHelm); helm.position.y = 2.28; helm.castShadow = true;
    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.08, 0.14), matHelm); visor.position.set(0, 2.26, 0.32);
    const rPauldron = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.35, 12), matTrim); rPauldron.position.set(0.5, 1.82, 0); rPauldron.castShadow = true;
    const lPauldron = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.35, 12), matTrim); lPauldron.position.set(-0.5, 1.82, 0); lPauldron.castShadow = true;
    const rKneeguard = new THREE.Mesh(new THREE.IcosahedronGeometry(0.16, 1), matTrim); rKneeguard.position.set(0.2, 0.28, 0.05); rKneeguard.castShadow = true;
    const lKneeguard = new THREE.Mesh(new THREE.IcosahedronGeometry(0.16, 1), matTrim); lKneeguard.position.set(-0.2, 0.28, 0.05); lKneeguard.castShadow = true;
    const chestplate = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.50, 0.38), matArmor); chestplate.position.set(0, 1.45, 0.05); chestplate.castShadow = true;
    const emblemGeo = new THREE.CircleGeometry(0.12, 16);
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
    this._hpBar.position.y = 2.8; this._hpBarBg.position.y = 2.8;
    this._hpBar.renderOrder = 999; this._hpBarBg.renderOrder = 998;
    this._postureBar = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0xc8a060, transparent: true, opacity: 0, depthTest: false }));
    this._postureBarBg = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0x111111, transparent: true, opacity: 0.6, depthTest: false }));
    this._postureBar.scale.set(0.9, 0.05, 1); this._postureBarBg.scale.set(0.94, 0.09, 1);
    this._postureBar.position.y = 2.95; this._postureBarBg.position.y = 2.95;
    this._postureBar.renderOrder = 1005; this._postureBarBg.renderOrder = 1004;
    // 锁定标记
    this._lockMark = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0xffd070, transparent: true, opacity: 0, depthTest: false }));
    this._lockMark.scale.set(0.5, 0.5, 1); this._lockMark.position.y = 3.10; this._lockMark.renderOrder = 1001;
    // 色弱模式：头顶形状标记（友军圆环 / 敌军方块），非本地单位默认隐藏，由 setColorblind 控制
    const markGeo = this.team === 0 ? new THREE.TorusGeometry(0.16, 0.045, 6, 14) : new THREE.BoxGeometry(0.24, 0.24, 0.24);
    this._teamMark = new THREE.Mesh(
      markGeo,
      new THREE.MeshBasicMaterial({ color: this.team === 0 ? 0x66aaff : 0xff6666, transparent: true, opacity: 0.9, depthTest: false })
    );
    this._teamMark.position.y = 3.35; this._teamMark.renderOrder = 1002; this._teamMark.visible = false;
    const showBar = !this.isLocal;
    this._hpBar.visible = showBar; this._hpBarBg.visible = showBar; this._postureBar.visible = showBar; this._postureBarBg.visible = showBar;
    this.skeleton = new Skeleton(this.root);
    this.skeleton.bindParts({
      rLeg: this.rLeg, lLeg: this.lLeg, torso: this.torso, belt,
      rSho: this.rSho, lSho: this.lSho, rArm: this.rArm, lArm: this.lArm,
      head: this.head, helm, visor, cape: this.cape, weaponPivot: this.weaponPivot,
      rPauldron, lPauldron, rKneeguard, lKneeguard, chestplate, emblem, factionFlag
    });
    if (this._bossType) this._customizeBoss(this._bossType);
    if (this._isElite) this._customizeElite();
    if (this._classType) this._customizeClass(this._classType);
    this.root.add(this._hpBar, this._hpBarBg, this._postureBar, this._postureBarBg, this._lockMark, this._teamMark);
  }

  _customizeBoss(type) {
    const b = this.skeleton.bones;
    if (type === 'warlord') {
      const hornGeo = new THREE.ConeGeometry(0.07, 0.22, 8);
      const hornMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.3, metalness: 0.9 });
      const hornL = new THREE.Mesh(hornGeo, hornMat); hornL.position.set(-0.20, 0.42, 0); hornL.rotation.z = 0.35;
      const hornR = new THREE.Mesh(hornGeo, hornMat); hornR.position.set(0.20, 0.42, 0); hornR.rotation.z = -0.35;
      b.head.add(hornL, hornR);
    } else if (type === 'ranger') {
      const hood = new THREE.Mesh(new THREE.ConeGeometry(0.50, 0.55, 12, 1, true), new THREE.MeshStandardMaterial({ color: 0x2a5a3a, roughness: 0.7, side: THREE.DoubleSide }));
      hood.position.set(0, 0.18, -0.02); b.head.add(hood);
      const quiver = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.06, 0.35, 8), new THREE.MeshStandardMaterial({ color: 0x4a3a1a, roughness: 0.8 }));
      quiver.position.set(0.22, 0, -0.3); quiver.rotation.z = 0.2; b.spine.add(quiver);
    } else if (type === 'mage') {
      const crystal = new THREE.Mesh(new THREE.IcosahedronGeometry(0.10, 0), new THREE.MeshStandardMaterial({ color: 0x9a5aff, emissive: 0x7a3aff, emissiveIntensity: 0.9, roughness: 0.2, metalness: 0.1 }));
      crystal.position.set(0, 0.12, 0.28); b.chest.add(crystal);
      if (this.cape) this.cape.scale.set(1.3, 1.4, 1);
    } else if (type === 'behemoth') {
      const bumpMat = new THREE.MeshStandardMaterial({ color: 0x5a5a5a, roughness: 0.9, map: TextureFactory.noise(128, 128, '#4a4a4a', 20, 4) });
      const bumpGeo = new THREE.DodecahedronGeometry(0.14, 0);
      const bL = new THREE.Mesh(bumpGeo, bumpMat); bL.position.set(0.12, 0.10, 0); b.shoulderR.add(bL);
      const bR = new THREE.Mesh(bumpGeo, bumpMat); bR.position.set(-0.12, 0.10, 0); b.shoulderL.add(bR);
    }
  }
  _customizeElite() {
    if (this.skeleton && this.skeleton.bones.head) {
      const glowMat = new THREE.MeshBasicMaterial({ color: 0xff2200, transparent: true, opacity: 0.75 });
      const gL = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 8), glowMat); gL.position.set(-0.16, 0.06, 0.42);
      const gR = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 8), glowMat); gR.position.set(0.16, 0.06, 0.42);
      this.skeleton.bones.head.add(gL, gR);
    }
  }

  _customizeClass(type) {
    const b = this.skeleton.bones;
    const accent = this._classColor || 0xcc4422;

    if (type === 'warrior') {
      const steelMat = new THREE.MeshStandardMaterial({ color: 0x8a8a92, metalness: 0.9, roughness: 0.25 });
      const goldMat = new THREE.MeshStandardMaterial({ color: 0xd4b25a, metalness: 0.85, roughness: 0.3 });

      const rPaul = new THREE.Mesh(new THREE.IcosahedronGeometry(0.38, 1), steelMat);
      rPaul.position.y = 0.12; rPaul.castShadow = true; b.shoulderR.add(rPaul);
      const lPaul = new THREE.Mesh(new THREE.IcosahedronGeometry(0.38, 1), steelMat);
      lPaul.position.y = 0.12; lPaul.castShadow = true; b.shoulderL.add(lPaul);

      const rSpike = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.25, 6), steelMat);
      rSpike.position.set(0, 0.35, 0); b.shoulderR.add(rSpike);
      const lSpike = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.25, 6), steelMat);
      lSpike.position.set(0, 0.35, 0); b.shoulderL.add(lSpike);

      const emblem = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.19, 0.04, 6), goldMat);
      emblem.rotation.x = Math.PI / 2; emblem.position.z = 0.22; b.chest.add(emblem);

      const rGaunt = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.13, 0.28, 8), steelMat);
      rGaunt.position.y = -0.22; b.elbowR.add(rGaunt);
      const lGaunt = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.13, 0.28, 8), steelMat);
      lGaunt.position.y = -0.22; b.elbowL.add(lGaunt);

      if (this.cape) this.cape.material.uniforms.uColor.value.setHex(accent);
    }

    else if (type === 'mage') {
      const clothMat = new THREE.MeshStandardMaterial({ color: 0x2a2a5a, roughness: 0.8 });
      const crystalMat = new THREE.MeshStandardMaterial({ color: 0x88ddff, emissive: 0x4488ff, emissiveIntensity: 0.8, roughness: 0.2, metalness: 0.3 });

      const hat = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.6, 12), clothMat);
      hat.position.set(0, 0.45, 0); hat.castShadow = true;
      const hatBrim = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.04, 12), clothMat);
      hatBrim.position.set(0, 0.18, 0);
      b.head.add(hat, hatBrim);

      const crystal = new THREE.Mesh(new THREE.IcosahedronGeometry(0.12, 0), crystalMat);
      crystal.position.set(0, 0.08, 0.25); b.chest.add(crystal);

      if (this.cape) {
        this.cape.scale.set(1.4, 1.6, 1);
        this.cape.material.uniforms.uColor.value.setHex(accent);
      }

      const rBracer = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.03, 6, 10), crystalMat);
      rBracer.position.y = -0.15; rBracer.rotation.x = Math.PI / 2; b.elbowR.add(rBracer);
      const lBracer = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.03, 6, 10), crystalMat);
      lBracer.position.y = -0.15; lBracer.rotation.x = Math.PI / 2; b.elbowL.add(lBracer);
    }

    else if (type === 'archer') {
      const leatherMat = new THREE.MeshStandardMaterial({ color: 0x4a3a1a, roughness: 0.8 });
      const greenMat = new THREE.MeshStandardMaterial({ color: 0x2a5a3a, roughness: 0.7 });
      const boneMat = new THREE.MeshStandardMaterial({ color: 0xddccaa, roughness: 0.6 });

      const hood = new THREE.Mesh(new THREE.ConeGeometry(0.45, 0.5, 10, 1, true), greenMat);
      hood.position.set(0, 0.15, -0.02); b.head.add(hood);

      const quiver = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.07, 0.4, 8), leatherMat);
      quiver.position.set(0.25, 0, -0.3); quiver.rotation.z = 0.2; b.spine.add(quiver);
      const arrow = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.5, 4), boneMat);
      arrow.position.set(0.25, 0.15, -0.3); b.spine.add(arrow);

      const rGuard = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.11, 0.22, 8), leatherMat);
      rGuard.position.y = -0.15; b.elbowR.add(rGuard);
      const lGuard = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.11, 0.22, 8), leatherMat);
      lGuard.position.y = -0.15; b.elbowL.add(lGuard);

      if (this.cape) {
        this.cape.scale.set(0.9, 1, 1);
        this.cape.material.uniforms.uColor.value.setHex(accent);
      }
    }
  }
  spawn(pos) {
    this.position.copy(pos); this.root.position.copy(pos);
    this.health.revive(); this.stamina.cur = this.stamina.max; this.alive = true; this.root.visible = true;
    this.root.rotation.x = 0; this.root.rotation.z = 0; this.root.position.y = pos.y;
    this._comboCount = 0; this._anim = 0; this._attacking = false; this._hurt = 0; this._deadTimer = 0;
    this._dodgeTimer = 0; this._dodgeIFrame = 0; this._iFrame = 0; this._stun = 0;
    this._dodgeOverride = 0;
    this._blocking = false; this._perfectWindow = 0; this._perfectDodge = false; this._perfectBuff = 0; this._launchRot = 0;
    this._updateHpBar();
  }

  setLook(yaw) { this._targetYaw = yaw; }
  setMove(f, r) { this._moveF = f; this._moveR = r; }
  dispose() { deepDispose(this.root); }
  setSprint(v) { this._sprint = v; }
  setCharging(v) { this._charging = v; if (!v && this.weapon.pullString) this.weapon.pullString(0); }
  get charge() { return this._charge; }
  get comboCount() { return this._comboCount; }
  get comboTimer() { return this._comboTimer; }
  get comboWindow() { return this._comboWindow; }

  switchWeapon(idx) {
    if (idx < 0 || idx >= this.weapons.length || idx === this.weaponIdx) return;
    if (this._weaponTrail) this._weaponTrail.detach(this._weaponMesh);
    this.weaponIdx = idx;
    this.weaponPivot.remove(this._weaponMesh);
    deepDispose(this._weaponMesh);
    this._weaponMesh = this.weapon.createMesh();
    this.weaponPivot.add(this._weaponMesh);
    if (this._weaponTrail) this._weaponTrail.attach(this._weaponMesh, this._weaponTrailColor || 0xfff0a0);
    this._applyAffixMaxHp();
    this._comboCount = 0; this._attacking = false; this._blocking = false;
  }

  setWeapons(arr) { this.weapons = arr; this.weaponIdx = 0; this.weaponPivot.remove(this._weaponMesh); deepDispose(this._weaponMesh); this._weaponMesh = this.weapon.createMesh(); this.weaponPivot.add(this._weaponMesh); }

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
    if (!this.alive) return false;
    const isBow = this.weapon.type === 'projectile';
    // 战役一#2：命中帧后允许取消后摇接下一段连招（Hades 式提前排队），消除"掐点"断连；
    // 仍受 weapon.ready 冷却约束，避免重锤连发破坏平衡
    if (this._attacking) {
      if (isBow) return false;
      const t = 1 - Math.max(0, this._anim) / this._animDur;
      const hitT = this.weapon.hitFrame ?? 0.35;
      if (t < hitT) return false;
      if (!this.weapon.ready) return false;
    } else if (!this.weapon.ready) return false;
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
      this._comboWindow = Math.max(0.6, this.weapon.cooldown + 0.3);
      this._comboCount = (this._comboCount + 1) % 3;
      this._comboTimer = this._comboWindow;
    }
    if (this._audio) this._audio.swing(this.weapon?.weaponClass);
    this._addPosture(this.weapon.armorPierce ? POSTURE.ATTACK_HEAVY : POSTURE.ATTACK_LIGHT);
    return true;
  }

  tryDodge(dir) {
    if (!this.alive || this._dodgeTimer > 0) return false;
    if (this._attacking && this._anim >= this._animDur * 0.5) return false;
    this._attacking = false; this._hitResolved = true; this._blocking = false;
    // 完美闪避：闪避后0.12s内被攻击时触发(在takeDamage检测)
    this._dodgeTimer = 0.32 * (this._runDodgeCdMul || 1); this._dodgeIFrame = 0.25 + (this._skill?.dodgeIFrameBonus || 0); this._dodgeOverride = 0.18;
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

  _addPosture(n) {
    if (!this.alive || this._postureBroken > 0 || n <= 0) return;
    this._posture = Math.min(POSTURE.MAX, this._posture + n);
    this._postureRegenDelay = POSTURE.REGEN_DELAY;
    if (this._posture >= POSTURE.MAX) {
      this._postureBroken = POSTURE.BROKEN_STUN;
      this._posture = POSTURE.BROKEN_RECOVER;
      this._stun = Math.max(this._stun || 0, POSTURE.BROKEN_STUN);
      if (this._bus) this._bus.emit(EV.FX_SHAKE, { amount: 0.6 });
    }
  }

  takeDamage(amount, heavy = false, attacker = null, now = 0) {
    let blocked = false;
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
    if (!this._blocking && this._skill && this._skill.branchDodgeChance > 0 && Math.random() < this._skill.branchDodgeChance) return 0;
    if (this._blocking && attacker) {
      const dx = attacker.position.x - this.position.x;
      const dz = attacker.position.z - this.position.z;
      const dist2 = dx * dx + dz * dz;
      if (dist2 > 0.01) {
        const fwdDot = (dx * this.forward.x + dz * this.forward.z) / Math.sqrt(dist2);
        if (fwdDot > 0.5) { // 攻击者在前方±60°
          if (this._perfectWindow > 0) {
            attacker._hurt = Math.max(attacker._hurt, 0.4); // 弹刀
            attacker._wasPerfectBlocked = true;
            attacker._addPosture?.(POSTURE.PARRY_DEALT);
            this._perfectRebound = true; // 弹反标记：下次反击触发连击 perfect 加成
            this.stamina.consume(0);
            this.addRage(15);
            if (this._bus) this._bus.emit(EV.FX_PERFECTBLOCK, { char: this });
            return 0;
          }
          if (!attacker.weapon.armorPierce) {
            amount *= 0.3;
            blocked = true;
            this._addPosture(POSTURE.BLOCK_TAKEN);
            attacker._addPosture?.(POSTURE.BLOCK_DEALT);
            this.stamina.consume(12);
            if (this._bus) this._bus.emit(EV.FX_BLOCK, { char: this });
          } else {
            this._addPosture(POSTURE.ARMORPIERCE);
          }
        }
      }
    }
    if (this.damageReduction) amount *= (1 - this.damageReduction);
    if (this._runArmorMul) amount *= this._runArmorMul;
    if (this._skill && this._skill.branchDefenseMul) amount *= this._skill.branchDefenseMul;
    if (this._skill && this._skill.branchIronwall && this._skill.branchIronwall < 1) amount *= this._skill.branchIronwall;
    const wMul = this.getWeaknessMul ? this.getWeaknessMul(attacker) : 1;
    if (wMul > 1) {
      amount *= wMul;
      if (this._bus) this._bus.emit(EV.FX_SHAKE, { amount: 0.15 });
    }
    if (!blocked) this._addPosture(POSTURE.HIT_TAKEN);
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
    this._hpBar.visible = false; this._hpBarBg.visible = false; this._postureBar.visible = false; this._postureBarBg.visible = false; this._lockMark.material.opacity = 0;
  }

  setBus(b) { this._bus = b; }
  setComboSys(cs) { this._comboSys = cs; }
  setAudio(a) { this._audio = a; }
  setWeaponTrail(t, color = 0) { this._weaponTrail = t; this._weaponTrailColor = color; }
  setSkill(s) { this._skill = s; if (s) { this._applyAffixMaxHp(); this.health.cur = this.health.maxHp; this.stamina.max += s.maxStaminaBonus; this.stamina.cur = this.stamina.max; } }

  setAffixes(a) { this._affixes = a; this._applyAffixMaxHp(); }
  _applyAffixMaxHp() {
    if (!this._affixes) return;
    const bonus = this._affixes.affixBonus(this.weapon, '坚韧');
    const skillBonus = this._skill ? this._skill.maxHpBonus : 0;
    this.health.maxHp = this._baseMaxHp + bonus + skillBonus;
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
    if (this._runRegen && this.alive) { this._regenAcc = (this._regenAcc || 0) + dt; if (this._regenAcc >= 1) { this.health.hp = Math.min(this.health.maxHp, this.health.hp + this._runRegen); this._regenAcc -= 1; this._updateHpBar(); } }
    if (this._skill && this._skill.branchRegen && this.alive) { this.health.hp = Math.min(this.health.maxHp, this.health.hp + this._skill.branchRegen * dt); this._updateHpBar(); }
    if (this._postureBroken > 0) {
      this._postureBroken -= dt;
      if (this._postureBroken <= 0) { this._postureBroken = 0; this._posture = 0; }
    } else {
      if (this._postureRegenDelay > 0) { this._postureRegenDelay -= dt; if (this._postureRegenDelay < 0) this._postureRegenDelay = 0; }
      if (this._postureRegenDelay <= 0 && !this._blocking && !this._attacking && (this._hurt || 0) <= 0) this._posture = Math.max(0, this._posture - POSTURE.REGEN_RATE * dt);
    }
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
      this.weaponPivot.rotation.z = Math.sin((EXECUTE.DURATION - this._executing) * Math.PI / EXECUTE.DURATION) * 1.5;
    }
    if (this._executing <= 0) {
      if (this._executingTarget && this._executingTarget.alive) this._executingTarget.takeDamage(EXECUTE.DAMAGE, true, this, now);
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
    if (this._slowTimer > 0) {
      this._slowTimer -= dt;
      spd *= 0.5;
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
    // 地图边界：限制在 terrain.size 范围内
    if (terrain.size) {
      const bound = terrain.size * 0.48;
      if (this.position.x > bound) { this.position.x = bound; this._curVel.x = 0; }
      else if (this.position.x < -bound) { this.position.x = -bound; this._curVel.x = 0; }
      if (this.position.z > bound) { this.position.z = bound; this._curVel.z = 0; }
      else if (this.position.z < -bound) { this.position.z = -bound; this._curVel.z = 0; }
    }
    // 圆形碰撞体阻挡（岩石/树/城墙）
    if (terrain.colliders) {
      for (const c of terrain.colliders) {
        const dx = this.position.x - c.x;
        const dz = this.position.z - c.z;
        const d = Math.hypot(dx, dz);
        const minD = c.r + 0.5;
        if (d < minD && d > 0.01) {
          const push = (minD - d);
          this.position.x += (dx / d) * push;
          this.position.z += (dz / d) * push;
        }
      }
    }
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
    if (this.position.y <= ground) {
      const k = this.onGround ? Math.min(1, dt * 20) : 1;
      this.position.y += (ground - this.position.y) * k;
      this.vy = 0; this.onGround = true; this._launchRot = 0;
    } else this.onGround = false;
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
        if (this._perfectBuff > 0) dmg *= 1.5;
      if (this._skill && this._skill.branchSpellpower > 1) dmg *= this._skill.branchSpellpower;
      if (this._skill && this._skill.branchPrecision > 1) dmg *= this._skill.branchPrecision;
        this.weapon._perform(this, this._pendingCombat, { combo: this._pendingCombo, charge: this._pendingCharge, now, dmg });
        this.weapon._timer = this.weapon.cooldown * this.killstreakBuffs().cdMul * (this._skill && this._skill.branchAttackSpeedMul ? this._skill.branchAttackSpeedMul : 1) * (this._runAtkSpdMul || 1);
        if (this.weapon.comboLunge) this._curVel.addScaledVector(this.forward, this.weapon.comboLunge[combo] ?? 3);
      }
      if (this._anim <= 0) this._attacking = false;
    } else {
      this.weaponPivot.rotation.x += (0 - this.weaponPivot.rotation.x) * 0.2;
      this.weaponPivot.rotation.y += (0 - this.weaponPivot.rotation.y) * 0.2;
      this.weaponPivot.rotation.z += (0 - this.weaponPivot.rotation.z) * 0.2;
    }
  }

  _tickFace(dt, skelState) {
    if (!this._face) return;
    const f = this._face;
    // Blink: periodic eye close
    this._blinkTimer -= dt;
    if (this._blinkPhase === 0 && this._blinkTimer <= 0) { this._blinkPhase = 1; this._blinkTimer = 0.08; }
    if (this._blinkPhase > 0) {
      if (this._blinkPhase === 1) {
        const s = Math.max(0.1, this._blinkTimer / 0.04);
        f.eyeL.scale.y = s; f.eyeR.scale.y = s; f.pupilL.scale.y = s; f.pupilR.scale.y = s;
        if (this._blinkTimer <= 0) { this._blinkPhase = 2; this._blinkTimer = 0.04; }
      } else {
        const s = Math.max(0.1, 1 - this._blinkTimer / 0.04);
        f.eyeL.scale.y = s; f.eyeR.scale.y = s; f.pupilL.scale.y = s; f.pupilR.scale.y = s;
        if (this._blinkTimer <= 0) { this._blinkPhase = 0; this._blinkTimer = 2 + Math.random() * 3; f.eyeL.scale.y = 1; f.eyeR.scale.y = 1; f.pupilL.scale.y = 1; f.pupilR.scale.y = 1; }
      }
    }
    // Mouth expression
    const st = skelState || 'idle';
    if (st !== this._faceState) {
      this._faceState = st;
      if (st === 'attack1' || st === 'attack2' || st === 'attack3') { f.mouth.scale.set(1.5, 2.5, 1); f.mouthMat.color.setHex(0x2a1010); }
      else if (st === 'hurt') { f.mouth.scale.set(1.8, 0.4, 1); f.mouthMat.color.setHex(0x5a2010); }
      else if (st === 'death') { f.mouth.scale.set(1.2, 3.0, 1); f.mouthMat.color.setHex(0x2a1010); }
      else if (st === 'run' || st === 'charge') { f.mouth.scale.set(1.3, 1.8, 1); f.mouthMat.color.setHex(0x3a2010); }
      else if (st === 'block') { f.mouth.scale.set(0.8, 0.5, 1); f.mouthMat.color.setHex(0x4a2010); }
      else { f.mouth.scale.set(1, 1, 1); f.mouthMat.color.setHex(0x3a2010); }
    }
    // Eyebrow expression
    if (st === 'attack1' || st === 'attack2' || st === 'attack3' || st === 'charge') {
      f.browL.rotation.z = -0.35; f.browR.rotation.z = 0.35; f.browL.position.y = 0.15; f.browR.position.y = 0.15;
    } else if (st === 'hurt' || st === 'death') {
      f.browL.rotation.z = 0.20; f.browR.rotation.z = -0.20; f.browL.position.y = 0.20; f.browR.position.y = 0.20;
    } else if (st === 'block' || st === 'dodge') {
      f.browL.rotation.z = -0.25; f.browR.rotation.z = 0.25; f.browL.position.y = 0.16; f.browR.position.y = 0.16;
    } else {
      f.browL.rotation.z = -0.15; f.browR.rotation.z = 0.15; f.browL.position.y = 0.17; f.browR.position.y = 0.17;
    }
    // Pupil tracking: look toward forward direction
    if (this.forward) {
      const lx = THREE.MathUtils.clamp(this.forward.x * 0.03, -0.03, 0.03);
      const ly = THREE.MathUtils.clamp(this.forward.y * 0.02 - 0.01, -0.02, 0.03);
      f.pupilL.position.x = -0.16 + lx; f.pupilL.position.y = 0.06 + ly;
      f.pupilR.position.x = 0.16 + lx; f.pupilR.position.y = 0.06 + ly;
    }
  }
  _tickAnimState(dt, now, moving) {
    let skelState = 'idle';
    let skelT = 0;
    if (!this.alive) { skelState = 'death'; skelT = Math.min(1, this._deadTimer / 1.0); }
    else if (this._executing > 0) { skelState = 'execute'; skelT = 1 - this._executing / EXECUTE.DURATION; }
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
    // P2: AI 动画降频——累积 dt 达到间隔才更新骨骼矩阵，跳帧时姿态保持上一帧（30fps 仍流畅）
    if (this._animInterval > 0) {
      this._animAccum += dt;
      if (this._animAccum < this._animInterval) { this._tickFace(dt, skelState); return; }
      this.skeleton.update(this._animAccum);
      this._animAccum = 0;
    } else {
      this.skeleton.update(dt);
    }
    this._tickFace(dt, skelState);
  }

  _tickHurtFlash(dt) {
    if (this._hurt > 0) {
      this._hurt -= dt;
      const k = Math.max(0, this._hurt) / 0.3;
      const flash = 0.6 * Math.min(1, k * 2);
      for (const m of this._mats) { m.emissive.setRGB(flash, 0, 0); m.emissiveIntensity = 0.12 + flash; }
      if (this._eyeMats) this._eyeMats[1].color.setHex(flash > 0.1 ? 0xff0000 : 0x111111);
      this._emisDirty = true;
    } else if (this._emisDirty) {
      for (const m of this._mats) { m.emissive.setRGB(0, 0, 0); m.emissiveIntensity = m === this._mats[0] ? 0.12 : 0; }
      if (this._eyeMats) this._eyeMats[1].color.setHex(0x111111);
      this._emisDirty = false;
    }
  }

  _updateHpBar() {
    const r = Math.max(0, this.health.ratio);
    this._hpBar.scale.x = r * 0.9;
    this._hpBar.position.x = -(1 - r) * 0.45;
    const pr = Math.min(1, this._posture / POSTURE.MAX);
    this._postureBar.scale.x = pr * 0.9;
    this._postureBar.position.x = -(1 - pr) * 0.45;
    this._postureBar.material.color.setHex(this._postureBroken > 0 ? 0xff0000 : (pr > 0.7 ? 0xff4400 : 0xc8a060));
    this._postureBar.material.opacity = (pr > 0 || this._postureBroken > 0) ? 0.9 : 0;
    this._postureBarBg.material.opacity = (pr > 0 || this._postureBroken > 0) ? 0.6 : 0;
  }

  setCameraRef(cam) { this._cam = cam.cam || cam; }
  setLockMark(v) { this._lockMark.material.opacity = v ? 0.9 : 0; }
  setColorblind(v) { if (this._teamMark) this._teamMark.visible = !!v && !this.isLocal; }
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
        combat.arrows.push({ mesh, pos: pos.clone(), vel, team: this.team, damage: 50, life: 3.5, attacker: this, charge: 1, pierce: 99, hitSet: new Set() });
      }
    } else if (w.weaponClass === 'HEAVY') {
      combat.spawnAoE(this.position, 6, 60, this, performance.now() * 0.001);
    } else if (w.weaponClass === 'SPEAR') {
      this._curVel.addScaledVector(this.forward, 30);
      combat.ultimateLine(this.position, this.forward, 5, 50, this);
    } else if (w.weaponClass === 'STAFF') {
      const now2 = performance.now() * 0.001;
      for (let i = 0; i < 5; i++) {
        const ang = (i / 5) * Math.PI * 2;
        const r = 4 + i * 0.5;
        const p = this.position.clone().add(new THREE.Vector3(Math.cos(ang) * r, 0, Math.sin(ang) * r));
        combat.spawnAoE(p, 5, 45, this, now2, i * 0.15);
      }
    } else {
      combat.ultimateMelee(this, Math.PI * 2, 5, 6);
    }
    combat.hitstop = 0.2;
    if (this._bus) { this._bus.emit(EV.FX_SHAKE, { amount: 1.5 }); this._bus.emit(EV.COMBAT_ULTIMATE, { char: this }); }
    return true;
  }
  startExecute(target) {
    if (!target || !target.canBeExecuted || this._executing > 0) return false;
    this._executing = EXECUTE.DURATION; this._executingTarget = target;
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
