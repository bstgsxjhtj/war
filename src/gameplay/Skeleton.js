import * as THREE from 'three';

export class Skeleton {
  constructor(root) {
    this.root = root;
    this.bones = {};
    this._curRot = {};
    this._targetRot = {};
    this._createBones();
  }

  _createBones() {
    const defs = {
      hips:       { pos: [0, 0.85, 0], parent: null },
      spine:      { pos: [0, 0.25, 0], parent: 'hips' },
      chest:      { pos: [0, 0.25, 0], parent: 'spine' },
      head:       { pos: [0, 0.75, 0], parent: 'chest' },
      shoulderR:  { pos: [0.5, 0.3, 0], parent: 'chest' },
      elbowR:     { pos: [0, -0.35, 0], parent: 'shoulderR' },
      handR:      { pos: [0, -0.35, 0], parent: 'elbowR' },
      shoulderL:  { pos: [-0.5, 0.3, 0], parent: 'chest' },
      elbowL:     { pos: [0, -0.35, 0], parent: 'shoulderL' },
      handL:      { pos: [0, -0.35, 0], parent: 'elbowL' },
      upperLegR:  { pos: [0.2, 0, 0], parent: 'hips' },
      lowerLegR:  { pos: [0, -0.35, 0], parent: 'upperLegR' },
      upperLegL:  { pos: [-0.2, 0, 0], parent: 'hips' },
      lowerLegL:  { pos: [0, -0.35, 0], parent: 'upperLegL' },
    };
    for (const [name, def] of Object.entries(defs)) {
      const bone = new THREE.Object3D();
      bone.name = name;
      bone.position.set(def.pos[0], def.pos[1], def.pos[2]);
      this.bones[name] = bone;
      this._curRot[name] = { x: 0, y: 0, z: 0 };
      this._targetRot[name] = { x: 0, y: 0, z: 0 };
    }
    for (const [name, def] of Object.entries(defs)) {
      if (def.parent) this.bones[def.parent].add(this.bones[name]);
      else this.root.add(this.bones[name]);
    }
  }

  bindParts(p) {
    if (p.rLeg) { this.bones.upperLegR.add(p.rLeg); p.rLeg.position.set(0, -0.35, 0); }
    if (p.lLeg) { this.bones.upperLegL.add(p.lLeg); p.lLeg.position.set(0, -0.35, 0); }
    if (p.torso) { this.bones.chest.add(p.torso); p.torso.position.set(0, 0, 0); }
    if (p.belt) { this.bones.hips.add(p.belt); p.belt.position.set(0, 0, 0); }
    if (p.rSho) { this.bones.shoulderR.add(p.rSho); p.rSho.position.set(0, 0, 0); }
    if (p.lSho) { this.bones.shoulderL.add(p.lSho); p.lSho.position.set(0, 0, 0); }
    if (p.rArm) { this.bones.elbowR.add(p.rArm); p.rArm.position.set(0, 0, 0); }
    if (p.lArm) { this.bones.elbowL.add(p.lArm); p.lArm.position.set(0, 0, 0); }
    if (p.head) { this.bones.head.add(p.head); p.head.position.set(0, 0, 0); }
    if (p.helm) { this.bones.head.add(p.helm); p.helm.position.set(0, 0.18, 0); }
    if (p.visor) { this.bones.head.add(p.visor); p.visor.position.set(0, 0.02, 0.28); }
    if (p.cape) { this.bones.spine.add(p.cape); p.cape.position.set(0, 0.25, -0.42); }
    if (p.weaponPivot) { this.bones.handR.add(p.weaponPivot); p.weaponPivot.position.set(0, 0.35, 0.15); }
  }

  static KEYFRAMES = {
    idle: [
      { t: 0,   bones: { chest: [0, 0, 0], head: [0, 0, 0] } },
      { t: 0.5, bones: { chest: [-0.03, 0, 0], head: [0.02, 0, 0] } },
      { t: 1,   bones: { chest: [0, 0, 0], head: [0, 0, 0] } },
    ],
    walk: [
      { t: 0,   bones: { upperLegR: [0.3, 0, 0], upperLegL: [-0.3, 0, 0], shoulderR: [-0.2, 0, 0], shoulderL: [0.2, 0, 0] } },
      { t: 0.5, bones: { upperLegR: [-0.3, 0, 0], upperLegL: [0.3, 0, 0], shoulderR: [0.2, 0, 0], shoulderL: [-0.2, 0, 0] } },
      { t: 1,   bones: { upperLegR: [0.3, 0, 0], upperLegL: [-0.3, 0, 0], shoulderR: [-0.2, 0, 0], shoulderL: [0.2, 0, 0] } },
    ],
    run: [
      { t: 0,   bones: { upperLegR: [-0.6, 0, 0], upperLegL: [0.6, 0, 0], shoulderR: [0.5, 0, 0], shoulderL: [-0.5, 0, 0], chest: [0.2, 0, 0], spine: [0.1, 0, 0] } },
      { t: 0.5, bones: { upperLegR: [0.8, 0, 0], upperLegL: [-0.8, 0, 0], shoulderR: [-0.6, 0, 0], shoulderL: [0.6, 0, 0], chest: [0.2, 0, 0], spine: [0.1, 0, 0] } },
      { t: 1,   bones: { upperLegR: [-0.6, 0, 0], upperLegL: [0.6, 0, 0], shoulderR: [0.5, 0, 0], shoulderL: [-0.5, 0, 0], chest: [0.2, 0, 0], spine: [0.1, 0, 0] } },
    ],
    attack1: [
      { t: 0,   bones: { shoulderR: [0, 0, -1.2], elbowR: [0, 0, 0.3], chest: [0, 0.3, 0], hips: [0, -0.2, 0] } },
      { t: 0.3, bones: { shoulderR: [0, 0, 0.8], elbowR: [0, 0, 0.1], chest: [0, -0.3, 0], hips: [0, 0.2, 0] } },
      { t: 0.6, bones: { shoulderR: [0, 0, 0.3], elbowR: [0, 0, 0], chest: [0, 0, 0], hips: [0, 0, 0] } },
      { t: 1,   bones: { shoulderR: [0, 0, 0], elbowR: [0, 0, 0], chest: [0, 0, 0], hips: [0, 0, 0] } },
    ],
    attack2: [
      { t: 0,   bones: { shoulderR: [-1.5, 0, 0], elbowR: [0.5, 0, 0], chest: [-0.2, 0, 0], spine: [-0.1, 0, 0] } },
      { t: 0.3, bones: { shoulderR: [0.8, 0, 0], elbowR: [0, 0, 0], chest: [0.2, 0, 0], spine: [0.1, 0, 0] } },
      { t: 1,   bones: { shoulderR: [0, 0, 0], elbowR: [0, 0, 0], chest: [0, 0, 0], spine: [0, 0, 0] } },
    ],
    attack3: [
      { t: 0,   bones: { chest: [0, 1.2, 0], hips: [0, 0.8, 0], shoulderR: [0, 0, -0.5], shoulderL: [0, 0, 0.5] } },
      { t: 0.4, bones: { chest: [0, -1.2, 0], hips: [0, -0.8, 0], shoulderR: [0, 0, 0.8], shoulderL: [0, 0, -0.8] } },
      { t: 1,   bones: { chest: [0, 0, 0], hips: [0, 0, 0], shoulderR: [0, 0, 0], shoulderL: [0, 0, 0] } },
    ],
    block: [
      { t: 0, bones: { shoulderR: [-0.5, 0, 0.3], elbowR: [-1.0, 0, 0], chest: [-0.1, 0, 0], spine: [-0.05, 0, 0] } },
      { t: 1, bones: { shoulderR: [-0.5, 0, 0.3], elbowR: [-1.0, 0, 0], chest: [-0.1, 0, 0], spine: [-0.05, 0, 0] } },
    ],
    dodge: [
      { t: 0,   bones: { hips: [0, 0, 0], spine: [0, 0, 0], upperLegR: [0, 0, 0], upperLegL: [0, 0, 0] } },
      { t: 0.3, bones: { hips: [0.4, 0, 0], spine: [0.8, 0, 0], upperLegR: [0.5, 0, 0], upperLegL: [-0.3, 0, 0] } },
      { t: 0.7, bones: { hips: [-0.3, 0, 0], spine: [-0.5, 0, 0], upperLegR: [-0.2, 0, 0], upperLegL: [0.4, 0, 0] } },
      { t: 1,   bones: { hips: [0, 0, 0], spine: [0, 0, 0], upperLegR: [0, 0, 0], upperLegL: [0, 0, 0] } },
    ],
    charge: [
      { t: 0, bones: { shoulderR: [0, 0, -0.3], elbowR: [-0.8, 0, 0], shoulderL: [0, 0, 0.5], elbowL: [-1.2, 0, 0], chest: [-0.15, 0.3, 0] } },
      { t: 1, bones: { shoulderR: [0, 0, -0.3], elbowR: [-0.8, 0, 0], shoulderL: [0, 0, 0.5], elbowL: [-1.2, 0, 0], chest: [-0.15, 0.3, 0] } },
    ],
    hurt: [
      { t: 0,   bones: { chest: [-0.35, 0, 0], spine: [-0.2, 0, 0], head: [-0.3, 0, 0] } },
      { t: 1,   bones: { chest: [0, 0, 0], spine: [0, 0, 0], head: [0, 0, 0] } },
    ],
    death: [
      { t: 0,   bones: { hips: [0, 0, 0], spine: [0, 0, 0], chest: [0, 0, 0], upperLegR: [0, 0, 0], upperLegL: [0, 0, 0] } },
      { t: 0.3, bones: { hips: [1.0, 0, 0], spine: [0.7, 0, 0], chest: [0.5, 0, 0], upperLegR: [-1.2, 0, 0], upperLegL: [-1.0, 0, 0] } },
      { t: 1,   bones: { hips: [1.57, 0, 0], spine: [0.3, 0, 0], chest: [0.1, 0, 0], upperLegR: [-0.3, 0, 0], upperLegL: [-0.2, 0, 0] } },
    ],
    execute: [
      { t: 0,   bones: { chest: [0.2, 0, 0], shoulderR: [-0.8, 0, 0], shoulderL: [-0.5, 0, 0] } },
      { t: 0.4, bones: { chest: [-0.3, 0, 0], shoulderR: [0.5, 0, 0], shoulderL: [0.3, 0, 0] } },
      { t: 1,   bones: { chest: [0, 0, 0], shoulderR: [0, 0, 0], shoulderL: [0, 0, 0] } },
    ],
  };

  applyState(state, t, params) {
    const kfs = Skeleton.KEYFRAMES[state] || Skeleton.KEYFRAMES.idle;
    t = Math.max(0, Math.min(1, t));
    let prev = kfs[0], next = kfs[kfs.length - 1];
    for (let i = 1; i < kfs.length; i++) {
      if (kfs[i].t >= t) { prev = kfs[i - 1]; next = kfs[i]; break; }
    }
    const span = next.t - prev.t;
    const localT = span > 0 ? (t - prev.t) / span : 0;
    const eased = localT < 0.5 ? 2 * localT * localT : 1 - Math.pow(-2 * localT + 2, 2) / 2;
    // 预分配骨骼名并集，避免每帧 new Set([...keys]) 分配
    const cacheKey = prev.t + ':' + next.t + ':' + state;
    let allBones = this._boneSetCache && this._boneSetCacheKey === cacheKey ? this._boneSetCache : null;
    if (!allBones) {
      allBones = Object.keys(prev.bones);
      for (const k of Object.keys(next.bones)) if (allBones.indexOf(k) < 0) allBones.push(k);
      this._boneSetCache = allBones; this._boneSetCacheKey = cacheKey;
    }
    for (const b of allBones) {
      const pb = prev.bones[b] || [0, 0, 0];
      const nb = next.bones[b] || [0, 0, 0];
      this._targetRot[b] = {
        x: pb[0] + (nb[0] - pb[0]) * eased,
        y: pb[1] + (nb[1] - pb[1]) * eased,
        z: pb[2] + (nb[2] - pb[2]) * eased,
      };
    }
    if (params && params.speed > 0.5 && (state === 'idle' || state === 'walk' || state === 'run')) {
      const phase = (params.now || 0) * 0.018 * (params.sprint ? 1.6 : 1);
      const sw = Math.sin(phase);
      this._targetRot.upperLegR = { x: sw * 0.5, y: 0, z: 0 };
      this._targetRot.upperLegL = { x: -sw * 0.5, y: 0, z: 0 };
      this._targetRot.shoulderR = { x: -sw * 0.3, y: 0, z: 0 };
      this._targetRot.shoulderL = { x: sw * 0.3, y: 0, z: 0 };
      this._targetRot.spine = { x: 0.05, y: 0, z: 0 };
    }
  }

  update(dt) {
    const k = 1 - Math.exp(-dt * 18);
    for (const [name, bone] of Object.entries(this.bones)) {
      const cur = this._curRot[name];
      const tgt = this._targetRot[name];
      cur.x += (tgt.x - cur.x) * k;
      cur.y += (tgt.y - cur.y) * k;
      cur.z += (tgt.z - cur.z) * k;
      bone.rotation.set(cur.x, cur.y, cur.z);
    }
  }
}
