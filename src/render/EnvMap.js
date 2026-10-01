import * as THREE from 'three';
import { PALETTE } from '../core/constants/palette.js';

// 程序化环境反射 CubeTexture（天空+地面渐变）
export class EnvMap {
  static create() {
    const faces = [];
    for (let i = 0; i < 6; i++) {
      const c = document.createElement('canvas'); c.width = c.height = 64;
      const x = c.getContext('2d');
      const g = x.createLinearGradient(0, 0, 0, 64);
      const isSky = i === 2;
      const isGround = i === 3;
      if (isSky) { g.addColorStop(0, PALETTE.ENVMAP.SKY_TOP); g.addColorStop(1, PALETTE.ENVMAP.SKY_BOTTOM); }
      else if (isGround) { g.addColorStop(0, PALETTE.ENVMAP.GROUND_TOP); g.addColorStop(1, PALETTE.ENVMAP.GROUND_BOTTOM); }
      else { g.addColorStop(0, PALETTE.ENVMAP.SIDE_TOP); g.addColorStop(1, PALETTE.ENVMAP.SIDE_BOTTOM); }
      x.fillStyle = g; x.fillRect(0, 0, 64, 64);
      for (let j = 0; j < 30; j++) {
        x.fillStyle = `rgba(255,255,255,${Math.random() * 0.15})`;
        x.fillRect(Math.random() * 64, Math.random() * 64, 2, 2);
      }
      faces.push(c);
    }
    const tex = new THREE.CubeTexture(faces);
    tex.needsUpdate = true;
    return tex;
  }
}
