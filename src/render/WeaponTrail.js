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
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const material = new THREE.LineBasicMaterial({
      color, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false
    });
    const line = new THREE.LineSegments(geometry, material);
    line.frustumCulled = false;
    this.scene.add(line);
    const trail = { line, positions, history: [], active: false, color };
    weaponMesh.userData._trail = trail;
    this._trails.push(trail);
    return trail;
  }

  activate(weaponMesh) {
    const trail = weaponMesh.userData._trail;
    if (trail) { trail.active = true; trail.history = []; }
  }

  deactivate(weaponMesh) {
    const trail = weaponMesh.userData._trail;
    if (trail) trail.active = false;
  }

  update(dt, now) {
    for (const trail of this._trails) {
      if (!trail.line.parent) continue;
      const wp = trail.line;
      if (!trail.active) {
        if (trail.history.length > 0) trail.history.shift();
        if (trail.history.length === 0) {
          wp.geometry.setDrawRange(0, 0);
          continue;
        }
      } else {
        const tail = wp.parent.localToWorld(new THREE.Vector3(0, 0, -0.6));
        const tip = wp.parent.localToWorld(new THREE.Vector3(0, 0, 0.8));
        trail.history.unshift({ tail, tip });
        if (trail.history.length > this._maxSeg) trail.history.pop();
      }
      const segs = Math.min(trail.history.length - 1, this._maxSeg - 1);
      for (let i = 0; i < segs; i++) {
        const a = trail.history[i], b = trail.history[i + 1];
        const idx = i * 6;
        trail.positions[idx] = a.tail.x; trail.positions[idx+1] = a.tail.y; trail.positions[idx+2] = a.tail.z;
        trail.positions[idx+3] = b.tail.x; trail.positions[idx+4] = b.tail.y; trail.positions[idx+5] = b.tail.z;
      }
      if (segs > 0) {
        trail.line.geometry.setDrawRange(0, segs * 2);
        trail.line.geometry.attributes.position.needsUpdate = true;
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
