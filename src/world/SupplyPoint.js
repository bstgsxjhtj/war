import * as THREE from 'three';

// 补给点：治疗篝火，靠近回血
export class SupplyPoint {
  constructor() {
    this.group = new THREE.Group();
    this.points = [];
    this._init();
  }

  _init() {
    const positions = [{ x: 18, z: 8 }, { x: -18, z: -8 }, { x: 8, z: -18 }, { x: -8, z: 18 }];
    for (const p of positions) {
      const camp = new THREE.Group();
      const stone = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.8, 0.3, 8), new THREE.MeshStandardMaterial({ color: 0x555048, roughness: 0.9 }));
      stone.position.y = 0.15; stone.castShadow = true; camp.add(stone);
      for (let i = 0; i < 5; i++) {
        const log = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.8, 6), new THREE.MeshStandardMaterial({ color: 0x4a3a2a, roughness: 0.8 }));
        log.position.set(Math.cos(i / 5 * Math.PI * 2) * 0.35, 0.3, Math.sin(i / 5 * Math.PI * 2) * 0.35);
        log.rotation.z = Math.PI / 2; log.rotation.y = i / 5 * Math.PI * 2;
        log.castShadow = true; camp.add(log);
      }
      const fire = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.5, 6), new THREE.MeshBasicMaterial({ color: 0xff8030 }));
      fire.position.y = 0.45; camp.add(fire);
      const light = new THREE.PointLight(0xff8040, 1.5, 8); light.position.y = 0.5; camp.add(light);
      camp.position.set(p.x, 0, p.z);
      this.group.add(camp);
      this.points.push({ pos: new THREE.Vector3(p.x, 0, p.z), light, fire, heal: 0 });
    }
  }

  update(player, dt, now) {
    for (const p of this.points) {
      p.fire.rotation.y = now * 3;
      p.fire.scale.y = 1 + Math.sin(now * 8) * 0.15;
      p.light.intensity = 1.5 + Math.sin(now * 10) * 0.3;
      if (player && player.alive) {
        const dx = player.position.x - p.pos.x, dz = player.position.z - p.pos.z;
        const d = Math.sqrt(dx * dx + dz * dz);
        if (d < 3) {
          p.heal += dt;
          if (p.heal > 0.5) { p.heal = 0; player.health.cur = Math.min(player.health.max, player.health.cur + 4); }
        }
      }
    }
  }
}
