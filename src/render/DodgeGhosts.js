import * as THREE from 'three';

// 闪避残影：闪避期间在角色身后留下半透明幻影拖尾
export class DodgeGhosts {
  constructor(parent) {
    this._parent = parent || null;
    this._ghosts = [];
    this._follow = null; // { char, sample, life }
    this._geo = new THREE.CapsuleGeometry(0.35, 0.9, 4, 8);
  }

  begin(char, duration = 0.32) {
    if (!char) return;
    this._follow = { char, sample: 0, life: duration };
  }

  spawnGhost(pos) {
    if (!this._parent) return;
    const mat = new THREE.MeshBasicMaterial({
      color: 0x66ddff, transparent: true, opacity: 0.45,
      blending: THREE.AdditiveBlending, depthWrite: false
    });
    const mesh = new THREE.Mesh(this._geo, mat);
    mesh.position.copy(pos);
    this._parent.add(mesh);
    this._ghosts.push({ mesh, t: 0, dur: 0.4 });
  }

  update(dt) {
    if (this._follow) {
      const f = this._follow;
      f.sample += dt;
      f.life -= dt;
      if (f.sample >= 0.08) {
        f.sample = 0;
        this.spawnGhost(f.char.position);
      }
      if (f.life <= 0) this._follow = null;
    }
    for (let i = this._ghosts.length - 1; i >= 0; i--) {
      const g = this._ghosts[i];
      g.t += dt;
      const p = Math.min(1, g.t / g.dur);
      g.mesh.material.opacity = 0.45 * (1 - p);
      g.mesh.position.y += dt * 0.4; // 轻微上浮消散
      if (p >= 1) {
        this._parent.remove(g.mesh);
        g.mesh.material.dispose();
        this._ghosts.splice(i, 1);
      }
    }
  }

  dispose() {
    for (const g of this._ghosts) {
      if (this._parent) this._parent.remove(g.mesh);
      g.mesh.material.dispose();
    }
    this._ghosts.length = 0;
    this._follow = null;
  }
}
