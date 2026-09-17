import * as THREE from 'three';

// 形态化粒子纹理：火花/血溅/烟/落叶
export class ParticleFX {
  static _radial(size, stops) {
    const c = document.createElement('canvas'); c.width = c.height = size;
    const x = c.getContext('2d');
    const g = x.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    for (const [off, col] of stops) g.addColorStop(off, col);
    x.fillStyle = g; x.fillRect(0, 0, size, size);
    return new THREE.CanvasTexture(c);
  }

  static spark(size = 64) {
    return ParticleFX._radial(size, [[0, 'rgba(255,240,180,1)'], [0.3, 'rgba(255,160,50,0.8)'], [0.7, 'rgba(200,60,10,0.3)'], [1, 'rgba(80,20,0,0)']]);
  }

  static blood(size = 64) {
    return ParticleFX._radial(size, [[0, 'rgba(220,30,20,1)'], [0.5, 'rgba(150,15,10,0.6)'], [1, 'rgba(60,5,5,0)']]);
  }

  static smoke(size = 64) {
    return ParticleFX._radial(size, [[0, 'rgba(120,120,120,0.7)'], [0.6, 'rgba(80,80,80,0.3)'], [1, 'rgba(40,40,40,0)']]);
  }

  static dust(size = 32) {
    return ParticleFX._radial(size, [[0, 'rgba(180,160,120,0.8)'], [1, 'rgba(100,80,50,0)']]);
  }
}
