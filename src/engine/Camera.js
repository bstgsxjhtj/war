import * as THREE from 'three';
import { EV } from '../core/constants/events.js';

// 第三人称相机：跟随 + 越肩瞄准 + 命中震动
export class Camera {
  constructor(bus) {
    this.cam = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 600);
    this.cam.position.set(0, 6, 12);
    this.yaw = 0;
    this.pitch = 0.22;
    this.distance = 6.5;
    this.height = 2.4;
    this.aimMode = false;
    this._curDist = 6.5;
    this._curHgt = 2.4;
    this._curFov = 60;
    this.target = new THREE.Vector3();
    this._shake = 0;
    this._shakeMul = 1;
    this._reducedMotion = false;
    this._shakeOffset = new THREE.Vector3();
    this._killCamTarget = null;
    this.lockTarget = null;
    window.addEventListener('resize', this._onResize = () => {
      this.cam.aspect = window.innerWidth / window.innerHeight;
      this.cam.updateProjectionMatrix();
    });
    this._unsubs = [];
    if (bus) this._unsubs.push(bus.on(EV.FX_SHAKE, ({ amount }) => this.addShake(amount)));
    if (bus) this._unsubs.push(bus.on(EV.FX_PERFECTDODGE, () => { this.addShake(0.5); if (!this._reducedMotion) { this._curFov = 52; this.timeScale = 0.5; } }));
    if (bus) this._unsubs.push(bus.on(EV.FX_PERFECTBLOCK, () => { this.addShake(0.6); if (!this._reducedMotion) this._curFov = 50; }));
    if (bus) this._unsubs.push(bus.on(EV.COMBAT_ULTIMATE, () => { if (!this._reducedMotion) this._curFov = 45; }));
  }

  dispose() {
    window.removeEventListener('resize', this._onResize);
    for (const u of this._unsubs) u();
    this._unsubs = [];
  }

  addShake(amount) { if (this._reducedMotion) return; this._shake = Math.min(0.9, this._shake + amount * this._shakeMul); }
  setShakeIntensity(v) { this._shakeMul = Math.max(0, Math.min(1, v)); }
  setReducedMotion(v) { this._reducedMotion = !!v; if (this._reducedMotion) this._shake = 0; }

  look(dx, dy, sensitivity = 0.0025) {
    this.yaw -= dx * sensitivity;
    this.pitch = THREE.MathUtils.clamp(this.pitch - dy * sensitivity, 0.08, 0.95);
  }

  setKillCam(target) { this._killCamTarget = target; this._killTimer = 1.4; }

  follow(targetPos) {
    const target = this._killCamTarget && this._killTimer > 0 ? this._killCamTarget.position : targetPos;
    this._killTimer = Math.max(0, (this._killTimer || 0) - 1 / 60);
    this.target.copy(target);
    // 锁定时相机 yaw 缓动朝向目标
    if (this.lockTarget && this.lockTarget.alive) {
      const ty = Math.atan2(this.lockTarget.position.x - target.x, this.lockTarget.position.z - target.z);
      let dy = ty - this.yaw;
      while (dy > Math.PI) dy -= Math.PI * 2;
      while (dy < -Math.PI) dy += Math.PI * 2;
      this.yaw += dy * 0.1;
    }

    const wantDist = this.aimMode ? 3.2 : this.distance;
    const wantHgt = this.aimMode ? 1.9 : this.height;
    const wantFov = this.aimMode ? 48 : 60;
    this._curDist += (wantDist - this._curDist) * 0.15;
    this._curHgt += (wantHgt - this._curHgt) * 0.15;
    this._curFov += (wantFov - this._curFov) * 0.12;
    if (Math.abs(this.cam.fov - this._curFov) > 0.01) { this.cam.fov = this._curFov; this.cam.updateProjectionMatrix(); }

    const cosp = Math.cos(this.pitch);
    const shoulder = this.aimMode ? 0.7 : 0;
    const ox = -Math.sin(this.yaw) * cosp * this._curDist + Math.cos(this.yaw) * shoulder;
    const oz = -Math.cos(this.yaw) * cosp * this._curDist - Math.sin(this.yaw) * shoulder;
    const oy = Math.sin(this.pitch) * this._curDist + this._curHgt;

    if (this._shake > 0.001) {
      this._shakeOffset.set((Math.random() - 0.5) * this._shake * 0.6, (Math.random() - 0.5) * this._shake * 0.6, (Math.random() - 0.5) * this._shake * 0.6);
      this._shake *= 0.86;
    } else this._shakeOffset.set(0, 0, 0);

    this.cam.position.set(
      this.target.x + ox + this._shakeOffset.x,
      this.target.y + oy + this._shakeOffset.y,
      this.target.z + oz + this._shakeOffset.z
    );
    this.cam.lookAt(this.target.x, this.target.y + 1.2, this.target.z);
  }

  forward(out = new THREE.Vector3()) { return out.set(Math.sin(this.yaw), 0, Math.cos(this.yaw)).normalize(); }
  right(out = new THREE.Vector3()) { return out.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw)).normalize(); }
}
