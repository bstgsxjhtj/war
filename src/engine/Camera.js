import * as THREE from 'three';
import { EV } from '../core/constants/events.js';
import { CAMERA } from '../core/constants/balance.js';

// 第三人称相机：跟随 + 越肩瞄准 + 命中震动
export class Camera {
  constructor(bus) {
    this.cam = new THREE.PerspectiveCamera(CAMERA.FOV_DEFAULT, window.innerWidth / window.innerHeight, 0.1, 600);
    this.cam.position.set(0, 6, 12);
    this.yaw = 0;
    this.pitch = 0.22;
    this._targetYaw = 0;
    this._targetPitch = 0.22;
    this.distance = 7.5;
    this.height = 2.4;
    this.aimMode = false;
    this._curDist = 7.5;
    this._curHgt = 2.4;
    this._curFov = CAMERA.FOV_DEFAULT;
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
    if (bus) this._unsubs.push(bus.on(EV.FX_PERFECTDODGE, () => { this.addShake(0.5); if (!this._reducedMotion) this._curFov = CAMERA.FOV_PERFECT_DODGE; }));
    if (bus) this._unsubs.push(bus.on(EV.FX_PERFECTBLOCK, () => { this.addShake(0.6); if (!this._reducedMotion) this._curFov = CAMERA.FOV_PERFECT_BLOCK; }));
    if (bus) this._unsubs.push(bus.on(EV.COMBAT_ULTIMATE, () => { if (!this._reducedMotion) this._curFov = 45; }));
    if (bus) this._unsubs.push(bus.on(EV.HUD_BOSSPHASE, ({ phase }) => { this.addShake(0.7); if (!this._reducedMotion) this._curFov = phase >= 3 ? CAMERA.FOV_BOSS_PHASE3 : CAMERA.FOV_BOSS_PHASE2; }));
  }

  dispose() {
    window.removeEventListener('resize', this._onResize);
    for (const u of this._unsubs) u();
    this._unsubs = [];
  }

  addShake(amount) { if (this._reducedMotion) return; this._shake = Math.min(CAMERA.SHAKE_MAX, this._shake + amount * this._shakeMul); }
  setShakeIntensity(v) { this._shakeMul = Math.max(0, Math.min(1, v)); }
  setReducedMotion(v) { this._reducedMotion = !!v; if (this._reducedMotion) this._shake = 0; }

  look(dx, dy, sensitivity = CAMERA.SENSITIVITY_DEFAULT) {
    this._targetYaw -= dx * sensitivity;
    this._targetPitch = THREE.MathUtils.clamp(this._targetPitch + dy * sensitivity, CAMERA.PITCH_MIN, CAMERA.PITCH_MAX);
  }

  setKillCam(target) { this._killCamTarget = target; this._killTimer = 1.4; }

  follow(targetPos, dt = 1 / 60) {
    const target = this._killCamTarget && this._killTimer > 0 ? this._killCamTarget.position : targetPos;
    this._killTimer = Math.max(0, (this._killTimer || 0) - dt);
    this.target.x = target.x;
    this.target.z = target.z;
    // 战役一#4：所有缓动 dt 化——factor = 1-pow(1-k, dt*60) 使 60fps 行为不变，
    // 低帧率（30fps）时缓动更慢更平滑而非每帧固定比例跳变，高帧率（144Hz）时不再过快漂移
    const dt60 = Math.min(dt, 0.1) * 60;
    this.target.y += (target.y - this.target.y) * (1 - Math.pow(0.75, dt60));
    const lookF = 1 - Math.pow(1 - CAMERA.LERP_LOOK, dt60);
    this.yaw += (this._targetYaw - this.yaw) * lookF;
    this.pitch += (this._targetPitch - this.pitch) * lookF;
    // 锁定时相机 yaw+pitch 缓动朝向目标
    if (this.lockTarget && this.lockTarget.alive) {
      const ty = Math.atan2(this.lockTarget.position.x - target.x, this.lockTarget.position.z - target.z);
      let dy = ty - this._targetYaw;
      while (dy > Math.PI) dy -= Math.PI * 2;
      while (dy < -Math.PI) dy += Math.PI * 2;
      this._targetYaw += dy * (1 - Math.pow(0.9, dt60));
      // P1：锁定也调整 pitch（高低处敌人）
      const dyh = (this.lockTarget.position.y || 0) - target.y;
      const tp = THREE.MathUtils.clamp(0.22 + dyh * 0.04, CAMERA.PITCH_MIN, CAMERA.PITCH_MAX);
      this._targetPitch += (tp - this._targetPitch) * (1 - Math.pow(0.92, dt60));
    } else if (this.lockTarget && !this.lockTarget.alive) {
      // P1：目标死亡自动释放锁定
      this.lockTarget = null;
    }

    const wantDist = this.aimMode ? 3.2 : this.distance;
    const wantHgt = this.aimMode ? 1.9 : this.height;
    const wantFov = this.aimMode ? CAMERA.FOV_AIM : CAMERA.FOV_DEFAULT;
    this._curDist += (wantDist - this._curDist) * (1 - Math.pow(1 - CAMERA.LERP_DIST, dt60));
    this._curHgt += (wantHgt - this._curHgt) * (1 - Math.pow(1 - CAMERA.LERP_HGT, dt60));
    this._curFov += (wantFov - this._curFov) * (1 - Math.pow(1 - CAMERA.LERP_FOV, dt60));
    if (Math.abs(this.cam.fov - this._curFov) > 0.01) { this.cam.fov = this._curFov; this.cam.updateProjectionMatrix(); }

    const cosp = Math.cos(this.pitch);
    const shoulder = this.aimMode ? 0.7 : 0;
    const ox = -Math.sin(this.yaw) * cosp * this._curDist + Math.cos(this.yaw) * shoulder;
    const oz = -Math.cos(this.yaw) * cosp * this._curDist - Math.sin(this.yaw) * shoulder;
    const oy = Math.sin(this.pitch) * this._curDist + this._curHgt;

    if (this._shake > 0.001) {
      this._shakeOffset.set((Math.random() - 0.5) * this._shake * CAMERA.SHAKE_LERP, (Math.random() - 0.5) * this._shake * CAMERA.SHAKE_LERP, 0);
      this._shake *= Math.pow(CAMERA.SHAKE_DECAY, dt60);
    } else this._shakeOffset.set(0, 0, 0);

    this.cam.position.set(
      this.target.x + ox + this._shakeOffset.x,
      this.target.y + oy + this._shakeOffset.y,
      this.target.z + oz + this._shakeOffset.z
    );
    this.cam.lookAt(this.target.x, this.target.y + 1.2, this.target.z);

    // P1：锁定目标屏幕标记——投影锁定目标世界坐标到屏幕，通知 HUD 绘制 reticle
    if (!this.bus) return;
    if (this.lockTarget && this.lockTarget.alive) {
      const sp = this.lockTarget.position.clone();
      sp.y += 1.0;
      sp.project(this.cam);
      if (sp.z < 1) {
        const sx = (sp.x + 1) * 0.5 * window.innerWidth;
        const sy = (-sp.y + 1) * 0.5 * window.innerHeight;
        this.bus.emit(EV.FX_LOCK_MARKER, { visible: true, x: sx, y: sy });
      } else {
        this.bus.emit(EV.FX_LOCK_MARKER, { visible: false });
      }
    } else {
      this.bus.emit(EV.FX_LOCK_MARKER, { visible: false });
    }
  }

  forward(out = new THREE.Vector3()) { return out.set(Math.sin(this.yaw), 0, Math.cos(this.yaw)).normalize(); }
  right(out = new THREE.Vector3()) { return out.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw)).normalize(); }
}
