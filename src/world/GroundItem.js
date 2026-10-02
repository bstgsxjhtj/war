import * as THREE from 'three';
import { EV } from '../core/constants/events.js';

// P2-2 地面装备拾取：发光球体，玩家靠近自动拾取，掉落词缀或药水
export class GroundItem {
  constructor(pos, type = 'affix') {
    this.type = type; // 'affix' | 'potion'
    this.collected = false;
    const geom = new THREE.SphereGeometry(0.35, 12, 8);
    const mat = new THREE.MeshBasicMaterial({
      color: type === 'potion' ? 0xff4466 : 0xffdd44,
      transparent: true, opacity: 0.85,
    });
    this.mesh = new THREE.Mesh(geom, mat);
    this.mesh.position.set(pos.x, pos.y + 0.8, pos.z);
    const haloGeom = new THREE.RingGeometry(0.5, 0.9, 16);
    const haloMat = new THREE.MeshBasicMaterial({ color: mat.color, transparent: true, opacity: 0.3, side: THREE.DoubleSide });
    this.halo = new THREE.Mesh(haloGeom, haloMat);
    this.halo.rotation.x = -Math.PI / 2;
    this.halo.position.copy(this.mesh.position);
    this._t = 0;
    this.group = new THREE.Group();
    this.group.add(this.mesh);
    this.group.add(this.halo);
  }

  update(dt, player) {
    if (this.collected) return false;
    this._t += dt;
    this.mesh.position.y = 0.8 + Math.sin(this._t * 3) * 0.15;
    this.halo.rotation.z += dt * 1.5;
    if (player && player.alive) {
      const dx = player.root.position.x - this.mesh.position.x;
      const dz = player.root.position.z - this.mesh.position.z;
      if (dx * dx + dz * dz < 4) {
        this.collected = true;
        return true;
      }
    }
    return false;
  }

  dispose() {
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
    this.halo.geometry.dispose();
    this.halo.material.dispose();
  }
}

export class GroundItemManager {
  constructor(scene, bus, terrain) {
    this.scene = scene; this.bus = bus; this.terrain = terrain;
    this.items = [];
  }

  spawn(pos, type) {
    const item = new GroundItem(pos, type);
    this.scene.add(item.group);
    this.items.push(item);
  }

  spawnRandom(count, worldSize) {
    for (let i = 0; i < count; i++) {
      const x = (Math.random() - 0.5) * worldSize * 0.8;
      const z = (Math.random() - 0.5) * worldSize * 0.8;
      const y = this.terrain.heightAt(x, z);
      this.spawn({ x, y, z }, Math.random() < 0.3 ? 'potion' : 'affix');
    }
  }

  update(dt, player) {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const item = this.items[i];
      const picked = item.update(dt, player);
      if (picked) {
        if (item.type === 'potion') {
          if (player.potions) player.potions.hp = Math.min(5, player.potions.hp + 1);
          this.bus.emit(EV.HUD_FLASH, { text: '拾得药水' });
        } else {
          this.bus.emit(EV.AFFIX_DROP, { affix: null, source: 'ground' });
        }
        this.scene.remove(item.group);
        item.dispose();
        this.items.splice(i, 1);
      }
    }
  }

  clear() {
    for (const item of this.items) {
      this.scene.remove(item.group);
      item.dispose();
    }
    this.items = [];
  }
}
