import * as THREE from 'three';

export const FORMATIONS = {
  SHIELD_WALL: 'shield_wall',
  ARCHER_LINE: 'archer_line',
  WEDGE: 'wedge'
};

export class UnitFormation {
  constructor(type, leader, members = []) {
    this.type = type;
    this.leader = leader;
    this.members = members;
    this._offsets = this._calcOffsets();
  }

  _calcOffsets() {
    const offsets = [];
    switch (this.type) {
      case FORMATIONS.SHIELD_WALL:
        for (let i = 0; i < this.members.length; i++) {
          const row = Math.floor(i / 3);
          const col = i % 3;
          offsets.push(new THREE.Vector3((col - 1) * 1.5, 0, row * 1.5));
        }
        break;
      case FORMATIONS.ARCHER_LINE:
        for (let i = 0; i < this.members.length; i++) {
          offsets.push(new THREE.Vector3((i - this.members.length / 2) * 1.8, 0, 0));
        }
        break;
      case FORMATIONS.WEDGE:
        for (let i = 0; i < this.members.length; i++) {
          const row = Math.floor(i / 2) + 1;
          const side = (i % 2 === 0) ? 1 : -1;
          offsets.push(new THREE.Vector3(side * row * 0.8, 0, row * 1.2));
        }
        break;
    }
    return offsets;
  }

  getTargetPos(memberIdx, leaderPos, leaderYaw) {
    const offset = this._offsets[memberIdx] || new THREE.Vector3();
    const cos = Math.cos(leaderYaw), sin = Math.sin(leaderYaw);
    return new THREE.Vector3(
      leaderPos.x + offset.x * cos + offset.z * sin,
      leaderPos.y,
      leaderPos.z - offset.x * sin + offset.z * cos
    );
  }

  update(members, dt) {
    if (!this.leader) return;
    const leaderPos = this.leader.root.position;
    const leaderYaw = this.leader.root.rotation.y;
    for (let i = 0; i < members.length && i < this._offsets.length; i++) {
      const m = members[i];
      if (!m || !m.alive) continue;
      const target = this.getTargetPos(i, leaderPos, leaderYaw);
      const dx = target.x - m.root.position.x;
      const dz = target.z - m.root.position.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist > 0.5) {
        m._formationTarget = target;
        m._formationYaw = Math.atan2(dx, dz);
      }
    }
  }
}

export class FormationController {
  constructor() {
    this._formations = [];
  }

  createShieldWall(leader, members) {
    const f = new UnitFormation(FORMATIONS.SHIELD_WALL, leader, members);
    this._formations.push(f);
    return f;
  }

  createArcherLine(leader, members) {
    const f = new UnitFormation(FORMATIONS.ARCHER_LINE, leader, members);
    this._formations.push(f);
    return f;
  }

  update(dt) {
    for (const f of this._formations) f.update(f.members, dt);
  }

  clear() { this._formations = []; }
}
