import * as THREE from 'three';

export class WeaponTrail {
  constructor(scene) {
    this.scene = scene;
    this._trails = [];
    this._maxSeg = 24;
  }

  attach(weaponMesh, color = 0xfff0a0) {
    if (weaponMesh.userData._trail) return weaponMesh.userData._trail;
    const positions = new Float32Array(this._maxSeg * 2 * 3);
    const colors = new Float32Array(this._maxSeg * 2 * 3);
    const baseColor = new THREE.Color(color);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const material = new THREE.LineBasicMaterial({
      vertexColors: true, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false
    });
    const line = new THREE.LineSegments(geometry, material);
    line.frustumCulled = false;
    this.scene.add(line);
    const history = [];
    for (let i = 0; i < this._maxSeg; i++) history.push({ tail: new THREE.Vector3(), tip: new THREE.Vector3() });
    const trail = { line, positions, colors, baseColor, history, head: 0, count: 0, active: false, color, weaponMesh };
    weaponMesh.userData._trail = trail;
    this._trails.push(trail);
    return trail;
  }

  activate(weaponMesh) {
    const trail = weaponMesh.userData._trail;
    if (trail) { trail.active = true; trail.head = 0; trail.count = 0; trail.deactivateTimer = 0.5; }
  }

  deactivate(weaponMesh) {
    const trail = weaponMesh.userData._trail;
    if (trail) trail.active = false;
  }

  // 清理全部 trail（回合/关卡切换时调用，防止 LineSegments 泄漏与悬挂武器引用）
  clear() {
    for (const trail of this._trails) {
      if (trail.line.parent) trail.line.parent.remove(trail.line);
      trail.line.geometry.dispose();
      trail.line.material.dispose();
      if (trail.weaponMesh && trail.weaponMesh.userData) delete trail.weaponMesh.userData._trail;
    }
    this._trails.length = 0;
  }

  // 按武器 mesh 移除单条 trail（波次尸体清理时调用，避免误清玩家 trail）
  detach(weaponMesh) {
    if (!weaponMesh) return;
    const i = this._trails.findIndex(t => t.weaponMesh === weaponMesh);
    if (i < 0) return;
    const trail = this._trails[i];
    if (trail.line.parent) trail.line.parent.remove(trail.line);
    trail.line.geometry.dispose();
    trail.line.material.dispose();
    if (weaponMesh.userData) delete weaponMesh.userData._trail;
    this._trails.splice(i, 1);
  }

  update(dt, now) {
    const tmpT = this._tmpT || (this._tmpT = new THREE.Vector3());
    const tmpP = this._tmpP || (this._tmpP = new THREE.Vector3());
    for (const trail of this._trails) {
      if (!trail.line.parent) continue;
      const wp = trail.line;
      if (!trail.active) {
        if (trail.count > 0) { trail.head = (trail.head + 1) % this._maxSeg; trail.count--; }
        if (trail.count === 0) {
          wp.geometry.setDrawRange(0, 0);
          continue;
        }
      } else {
        trail.deactivateTimer -= dt;
        if (trail.deactivateTimer <= 0) { trail.active = false; }
        else {
        trail.head = (trail.head - 1 + this._maxSeg) % this._maxSeg;
        if (trail.count < this._maxSeg) trail.count++;
        const slot = trail.history[trail.head];
        const weapon = trail.weaponMesh || wp.parent;
        weapon.updateWorldMatrix(true, false);
        const mw = weapon.matrixWorld;
        slot.tail.copy(tmpT.set(0, 0, -0.6).applyMatrix4(mw));
        slot.tip.copy(tmpP.set(0, 0, 0.8).applyMatrix4(mw));
        }
      }
      const segs = Math.min(trail.count - 1, this._maxSeg - 1);
      const bc = trail.baseColor;
      for (let i = 0; i < segs; i++) {
        const a = trail.history[(trail.head + i) % this._maxSeg], b = trail.history[(trail.head + i + 1) % this._maxSeg];
        const idx = i * 6;
        trail.positions[idx] = a.tail.x; trail.positions[idx+1] = a.tail.y; trail.positions[idx+2] = a.tail.z;
        trail.positions[idx+3] = b.tail.x; trail.positions[idx+4] = b.tail.y; trail.positions[idx+5] = b.tail.z;
        const fadeA = 1 - i / segs, fadeB = 1 - (i + 1) / segs;
        trail.colors[idx]   = bc.r * fadeA; trail.colors[idx+1] = bc.g * fadeA; trail.colors[idx+2] = bc.b * fadeA;
        trail.colors[idx+3] = bc.r * fadeB; trail.colors[idx+4] = bc.g * fadeB; trail.colors[idx+5] = bc.b * fadeB;
      }
      if (segs > 0) {
        trail.line.geometry.setDrawRange(0, segs * 2);
        trail.line.geometry.attributes.position.needsUpdate = true;
        trail.line.geometry.attributes.color.needsUpdate = true;
      } else trail.line.geometry.setDrawRange(0, 0);
    }
  }
}

export class HitDirection {
  constructor() {
    this.el = document.createElement('div');
    this.el.id = 'hit-direction';
    Object.assign(this.el.style, {
      position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
      width: '120px', height: '120px', pointerEvents: 'none', zIndex: 14, display: 'none'
    });
    document.body.appendChild(this.el);
    this._ind = document.createElement('div');
    Object.assign(this._ind.style, {
      position: 'absolute', top: '0', left: '50%', transform: 'translateX(-50%)',
      width: '0', height: '0',
      borderLeft: '10px solid transparent', borderRight: '10px solid transparent',
      borderBottom: '16px solid rgba(255,40,40,.85)',
      filter: 'drop-shadow(0 0 4px rgba(255,0,0,.6))'
    });
    this.el.appendChild(this._ind);
    this._timer = 0;
  }

  show(anglesToAttacker, camYaw) {
    const rel = anglesToAttacker - camYaw;
    const deg = ((rel * 180 / Math.PI) + 360) % 360;
    this.el.style.display = 'block';
    this._ind.style.transform = `translateX(-50%) rotate(${deg}deg)`;
    this._ind.style.transformOrigin = `50% 60px`;
    this._timer = 1.2;
  }

  update(dt) {
    if (this._timer > 0) {
      this._timer -= dt;
      if (this._timer <= 0) this.el.style.display = 'none';
    }
  }
}

export class HitStop {
  constructor() {
    this._timer = 0; this._scale = 1;
  }
  trigger(duration = 0.08, scale = 0.05) { this._timer = duration; this._scale = scale; }
  update(dt) {
    if (this._timer > 0) { this._timer -= dt; if (this._timer < 0) this._timer = 0; }
  }
  get active() { return this._timer > 0; }
  get timeScale() { return this.active ? this._scale : 1; }
}
