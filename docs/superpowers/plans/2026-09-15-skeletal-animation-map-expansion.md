# 骨骼动画 + 地图扩展 Implementation Plan

> **For agentic workers:** 本游戏 Demo 无单元测试框架，验证用浏览器实测（navigate + console + snapshot）替代 TDD。步骤用 checkbox 跟踪。

**Goal:** 将角色从胶囊体升级为14骨骼驱动的程序化动画系统（10种状态），将单一地图扩展为4种战略布局（渡桥/山口/攻城/遭遇）

**Architecture:** 程序化骨骼系统在现有 CapsuleGeometry 身体上建立 Object3D 骨骼层级，无需外部GLTF。MapGenerator 作为 Terrain+Environment 工厂，定义4种地形高度函数和物体布局。两者通过明确接口集成到 Character 和 main_entry。

**Tech Stack:** Three.js 0.160, Vite 5, 纯 ES Modules

---

## File Structure

**新建：**
- `src/gameplay/Skeleton.js` — 14块骨骼层级 + 10种动画关键帧 + applyState/update
- `src/world/MapGenerator.js` — 4种地图定义（高度函数+物体布局+刷新点）+ 推荐地图

**修改：**
- `src/gameplay/Character.js` — `_build()` 末尾创建 Skeleton 并绑定部件；`update()` 调用 skeleton 驱动身体动画
- `src/gameplay/AIController.js` — 继承 Character 自动获得动画，仅调参
- `src/world/Terrain.js` — 构造函数接受可选 `heightFn`，替代内部 `_rawHeight`
- `src/world/Environment.js` — 构造函数接受可选 `layout`，按布局生成物体
- `src/main_entry.js` — bootstrap 调用 MapGenerator；M键切换模式时重载地图

---

### Task 1: 创建 Skeleton.js — 骨骼层级与部件绑定

**Files:** Create `src/gameplay/Skeleton.js`

- [ ] **Step 1: 创建骨骼层级 + bindParts 方法**

```javascript
import * as THREE from 'three';

export class Skeleton {
  constructor(root) {
    this.root = root;
    this.bones = {};
    this._curRot = {};
    this._targetRot = {};
    this._createBones();
  }

  _createBones() {
    const defs = {
      hips:       { pos: [0, 0.85, 0], parent: null },
      spine:      { pos: [0, 0.25, 0], parent: 'hips' },
      chest:      { pos: [0, 0.25, 0], parent: 'spine' },
      head:       { pos: [0, 0.75, 0], parent: 'chest' },
      shoulderR:  { pos: [0.5, 0.3, 0], parent: 'chest' },
      elbowR:     { pos: [0, -0.35, 0], parent: 'shoulderR' },
      handR:      { pos: [0, -0.35, 0], parent: 'elbowR' },
      shoulderL:  { pos: [-0.5, 0.3, 0], parent: 'chest' },
      elbowL:     { pos: [0, -0.35, 0], parent: 'shoulderL' },
      handL:      { pos: [0, -0.35, 0], parent: 'elbowL' },
      upperLegR:  { pos: [0.2, 0, 0], parent: 'hips' },
      lowerLegR:  { pos: [0, -0.35, 0], parent: 'upperLegR' },
      upperLegL:  { pos: [-0.2, 0, 0], parent: 'hips' },
      lowerLegL:  { pos: [0, -0.35, 0], parent: 'upperLegL' },
    };
    for (const [name, def] of Object.entries(defs)) {
      const bone = new THREE.Object3D();
      bone.name = name;
      bone.position.set(def.pos[0], def.pos[1], def.pos[2]);
      this.bones[name] = bone;
      this._curRot[name] = { x: 0, y: 0, z: 0 };
      this._targetRot[name] = { x: 0, y: 0, z: 0 };
    }
    for (const [name, def] of Object.entries(defs)) {
      if (def.parent) this.bones[def.parent].add(this.bones[name]);
      else this.root.add(this.bones[name]);
    }
  }

  bindParts(p) {
    if (p.rLeg) { this.bones.upperLegR.add(p.rLeg); p.rLeg.position.set(0, -0.35, 0); }
    if (p.lLeg) { this.bones.upperLegL.add(p.lLeg); p.lLeg.position.set(0, -0.35, 0); }
    if (p.torso) { this.bones.chest.add(p.torso); p.torso.position.set(0, 0, 0); }
    if (p.belt) { this.bones.hips.add(p.belt); p.belt.position.set(0, 0, 0); }
    if (p.rSho) { this.bones.shoulderR.add(p.rSho); p.rSho.position.set(0, 0, 0); }
    if (p.lSho) { this.bones.shoulderL.add(p.lSho); p.lSho.position.set(0, 0, 0); }
    if (p.rArm) { this.bones.elbowR.add(p.rArm); p.rArm.position.set(0, 0, 0); }
    if (p.lArm) { this.bones.elbowL.add(p.lArm); p.lArm.position.set(0, 0, 0); }
    if (p.head) { this.bones.head.add(p.head); p.head.position.set(0, 0, 0); }
    if (p.helm) { this.bones.head.add(p.helm); p.helm.position.set(0, 0.18, 0); }
    if (p.visor) { this.bones.head.add(p.visor); p.visor.position.set(0, 0.02, 0.28); }
    if (p.cape) { this.bones.spine.add(p.cape); p.cape.position.set(0, 0.25, -0.42); }
    if (p.weaponPivot) { this.bones.handR.add(p.weaponPivot); p.weaponPivot.position.set(0, 0.35, 0.15); }
  }
}
```

- [ ] **Step 2: 验证文件无语法错误**

Run: `node -e "import('./src/gameplay/Skeleton.js').then(()=>console.log('OK')).catch(e=>console.error(e))"`
Expected: `OK`（或 Vite HMR 无报错）

---

### Task 2: Skeleton.js — 关键帧定义与 applyState

**Files:** Modify `src/gameplay/Skeleton.js`（在 bindParts 方法后追加）

- [ ] **Step 1: 追加关键帧表 + applyState + update 方法**

在 `bindParts(p)` 方法结束后、类的结束大括号前，追加以下代码：

```javascript
  static KEYFRAMES = {
    idle: [
      { t: 0,   bones: { chest: [0, 0, 0], head: [0, 0, 0] } },
      { t: 0.5, bones: { chest: [-0.03, 0, 0], head: [0.02, 0, 0] } },
      { t: 1,   bones: { chest: [0, 0, 0], head: [0, 0, 0] } },
    ],
    walk: [
      { t: 0,   bones: { upperLegR: [0.3, 0, 0], upperLegL: [-0.3, 0, 0], shoulderR: [-0.2, 0, 0], shoulderL: [0.2, 0, 0] } },
      { t: 0.5, bones: { upperLegR: [-0.3, 0, 0], upperLegL: [0.3, 0, 0], shoulderR: [0.2, 0, 0], shoulderL: [-0.2, 0, 0] } },
      { t: 1,   bones: { upperLegR: [0.3, 0, 0], upperLegL: [-0.3, 0, 0], shoulderR: [-0.2, 0, 0], shoulderL: [0.2, 0, 0] } },
    ],
    run: [
      { t: 0,   bones: { upperLegR: [-0.6, 0, 0], upperLegL: [0.6, 0, 0], shoulderR: [0.5, 0, 0], shoulderL: [-0.5, 0, 0], chest: [0.2, 0, 0], spine: [0.1, 0, 0] } },
      { t: 0.5, bones: { upperLegR: [0.8, 0, 0], upperLegL: [-0.8, 0, 0], shoulderR: [-0.6, 0, 0], shoulderL: [0.6, 0, 0], chest: [0.2, 0, 0], spine: [0.1, 0, 0] } },
      { t: 1,   bones: { upperLegR: [-0.6, 0, 0], upperLegL: [0.6, 0, 0], shoulderR: [0.5, 0, 0], shoulderL: [-0.5, 0, 0], chest: [0.2, 0, 0], spine: [0.1, 0, 0] } },
    ],
    attack1: [
      { t: 0,   bones: { shoulderR: [0, 0, -1.2], elbowR: [0, 0, 0.3], chest: [0, 0.3, 0], hips: [0, -0.2, 0] } },
      { t: 0.3, bones: { shoulderR: [0, 0, 0.8], elbowR: [0, 0, 0.1], chest: [0, -0.3, 0], hips: [0, 0.2, 0] } },
      { t: 0.6, bones: { shoulderR: [0, 0, 0.3], elbowR: [0, 0, 0], chest: [0, 0, 0], hips: [0, 0, 0] } },
      { t: 1,   bones: { shoulderR: [0, 0, 0], elbowR: [0, 0, 0], chest: [0, 0, 0], hips: [0, 0, 0] } },
    ],
    attack2: [
      { t: 0,   bones: { shoulderR: [-1.5, 0, 0], elbowR: [0.5, 0, 0], chest: [-0.2, 0, 0], spine: [-0.1, 0, 0] } },
      { t: 0.3, bones: { shoulderR: [0.8, 0, 0], elbowR: [0, 0, 0], chest: [0.2, 0, 0], spine: [0.1, 0, 0] } },
      { t: 1,   bones: { shoulderR: [0, 0, 0], elbowR: [0, 0, 0], chest: [0, 0, 0], spine: [0, 0, 0] } },
    ],
    attack3: [
      { t: 0,   bones: { chest: [0, 1.2, 0], hips: [0, 0.8, 0], shoulderR: [0, 0, -0.5], shoulderL: [0, 0, 0.5] } },
      { t: 0.4, bones: { chest: [0, -1.2, 0], hips: [0, -0.8, 0], shoulderR: [0, 0, 0.8], shoulderL: [0, 0, -0.8] } },
      { t: 1,   bones: { chest: [0, 0, 0], hips: [0, 0, 0], shoulderR: [0, 0, 0], shoulderL: [0, 0, 0] } },
    ],
    block: [
      { t: 0, bones: { shoulderR: [-0.5, 0, 0.3], elbowR: [-1.0, 0, 0], chest: [-0.1, 0, 0], spine: [-0.05, 0, 0] } },
      { t: 1, bones: { shoulderR: [-0.5, 0, 0.3], elbowR: [-1.0, 0, 0], chest: [-0.1, 0, 0], spine: [-0.05, 0, 0] } },
    ],
    dodge: [
      { t: 0,   bones: { hips: [0, 0, 0], spine: [0, 0, 0], upperLegR: [0, 0, 0], upperLegL: [0, 0, 0] } },
      { t: 0.3, bones: { hips: [0.4, 0, 0], spine: [0.8, 0, 0], upperLegR: [0.5, 0, 0], upperLegL: [-0.3, 0, 0] } },
      { t: 0.7, bones: { hips: [-0.3, 0, 0], spine: [-0.5, 0, 0], upperLegR: [-0.2, 0, 0], upperLegL: [0.4, 0, 0] } },
      { t: 1,   bones: { hips: [0, 0, 0], spine: [0, 0, 0], upperLegR: [0, 0, 0], upperLegL: [0, 0, 0] } },
    ],
    charge: [
      { t: 0, bones: { shoulderR: [0, 0, -0.3], elbowR: [-0.8, 0, 0], shoulderL: [0, 0, 0.5], elbowL: [-1.2, 0, 0], chest: [-0.15, 0.3, 0] } },
      { t: 1, bones: { shoulderR: [0, 0, -0.3], elbowR: [-0.8, 0, 0], shoulderL: [0, 0, 0.5], elbowL: [-1.2, 0, 0], chest: [-0.15, 0.3, 0] } },
    ],
    hurt: [
      { t: 0,   bones: { chest: [-0.35, 0, 0], spine: [-0.2, 0, 0], head: [-0.3, 0, 0] } },
      { t: 1,   bones: { chest: [0, 0, 0], spine: [0, 0, 0], head: [0, 0, 0] } },
    ],
    death: [
      { t: 0,   bones: { hips: [0, 0, 0], spine: [0, 0, 0], chest: [0, 0, 0], upperLegR: [0, 0, 0], upperLegL: [0, 0, 0] } },
      { t: 0.3, bones: { hips: [1.0, 0, 0], spine: [0.7, 0, 0], chest: [0.5, 0, 0], upperLegR: [-1.2, 0, 0], upperLegL: [-1.0, 0, 0] } },
      { t: 1,   bones: { hips: [1.57, 0, 0], spine: [0.3, 0, 0], chest: [0.1, 0, 0], upperLegR: [-0.3, 0, 0], upperLegL: [-0.2, 0, 0] } },
    ],
    execute: [
      { t: 0,   bones: { chest: [0.2, 0, 0], shoulderR: [-0.8, 0, 0], shoulderL: [-0.5, 0, 0] } },
      { t: 0.4, bones: { chest: [-0.3, 0, 0], shoulderR: [0.5, 0, 0], shoulderL: [0.3, 0, 0] } },
      { t: 1,   bones: { chest: [0, 0, 0], shoulderR: [0, 0, 0], shoulderL: [0, 0, 0] } },
    ],
  };

  applyState(state, t, params) {
    const kfs = Skeleton.KEYFRAMES[state] || Skeleton.KEYFRAMES.idle;
    t = Math.max(0, Math.min(1, t));
    let prev = kfs[0], next = kfs[kfs.length - 1];
    for (let i = 1; i < kfs.length; i++) {
      if (kfs[i].t >= t) { prev = kfs[i - 1]; next = kfs[i]; break; }
    }
    const span = next.t - prev.t;
    const localT = span > 0 ? (t - prev.t) / span : 0;
    const eased = localT < 0.5 ? 2 * localT * localT : 1 - Math.pow(-2 * localT + 2, 2) / 2;
    const allBones = new Set([...Object.keys(prev.bones), ...Object.keys(next.bones)]);
    for (const b of allBones) {
      const pb = prev.bones[b] || [0, 0, 0];
      const nb = next.bones[b] || [0, 0, 0];
      this._targetRot[b] = {
        x: pb[0] + (nb[0] - pb[0]) * eased,
        y: pb[1] + (nb[1] - pb[1]) * eased,
        z: pb[2] + (nb[2] - pb[2]) * eased,
      };
    }
    if (params && params.speed > 0.5 && (state === 'idle' || state === 'walk' || state === 'run')) {
      const phase = (params.now || 0) * 0.018 * (params.sprint ? 1.6 : 1);
      const sw = Math.sin(phase);
      this._targetRot.upperLegR = { x: sw * 0.5, y: 0, z: 0 };
      this._targetRot.upperLegL = { x: -sw * 0.5, y: 0, z: 0 };
      this._targetRot.shoulderR = { x: -sw * 0.3, y: 0, z: 0 };
      this._targetRot.shoulderL = { x: sw * 0.3, y: 0, z: 0 };
      this._targetRot.spine = { x: 0.05, y: 0, z: 0 };
    }
  }

  update(dt) {
    const k = 1 - Math.exp(-dt * 18);
    for (const [name, bone] of Object.entries(this.bones)) {
      const cur = this._curRot[name];
      const tgt = this._targetRot[name];
      cur.x += (tgt.x - cur.x) * k;
      cur.y += (tgt.y - cur.y) * k;
      cur.z += (tgt.z - cur.z) * k;
      bone.rotation.set(cur.x, cur.y, cur.z);
    }
  }
}
```

- [ ] **Step 2: 验证语法**

Run: `node -e "import('./src/gameplay/Skeleton.js').then(m=>{const s=new m.Skeleton({add(){}}); console.log('bones:',Object.keys(s.bones).length); console.log('states:',Object.keys(m.Skeleton.KEYFRAMES).length)}).catch(e=>console.error(e))"`
Expected: `bones: 14` 和 `states: 12`

---

### Task 3: Character.js — 集成 Skeleton 到 _build()

**Files:** Modify `src/gameplay/Character.js`

- [ ] **Step 1: 在文件头部添加 Skeleton 导入**

在 `import { TextureFactory } from '../render/TextureFactory.js';` 之后添加：

```javascript
import { Skeleton } from './Skeleton.js';
```

- [ ] **Step 2: 修改 _build() 方法——在末尾创建 Skeleton 并绑定部件**

将 `_build()` 方法末尾的 `this.root.add(this.rLeg, this.lLeg, this.torso, belt, this.rSho, this.lSho, this.rArm, this.lArm, this.head, helm, visor, this.cape, this.weaponPivot, this._hpBar, this._hpBarBg, this._lockMark);` 替换为：

```javascript
    this.skeleton = new Skeleton(this.root);
    this.skeleton.bindParts({
      rLeg: this.rLeg, lLeg: this.lLeg, torso: this.torso, belt,
      rSho: this.rSho, lSho: this.lSho, rArm: this.rArm, lArm: this.lArm,
      head: this.head, helm, visor, cape: this.cape, weaponPivot: this.weaponPivot,
    });
    this.root.add(this._hpBar, this._hpBarBg, this._lockMark);
```

- [ ] **Step 3: 验证浏览器加载无报错**

navigate → http://localhost:5174/ → console 无 ReferenceError → snapshot 显示角色画面

---

### Task 4: Character.js — 在 update() 中驱动骨骼动画

**Files:** Modify `src/gameplay/Character.js`

- [ ] **Step 1: 修改行走动画段——移除直接 leg rotation，改为 skeleton 驱动**

将 lines 384-390 的行走动画：
```javascript
    const moving = Math.hypot(this._curVel.x, this._curVel.z);
    if (moving > 0.5 && this.onGround && this._dodgeTimer <= 0) {
      const f = this._sprint ? 1.6 : 1;
      const sw = Math.sin(now * 0.018 * f);
      this.root.position.y += sw * 0.05;
      this.rLeg.rotation.x = sw * 0.5; this.lLeg.rotation.x = -sw * 0.5;
    } else { this.rLeg.rotation.x *= 0.8; this.lLeg.rotation.x *= 0.8; }
```
替换为：
```javascript
    const moving = Math.hypot(this._curVel.x, this._curVel.z);
    if (moving > 0.5 && this.onGround && this._dodgeTimer <= 0) {
      const f = this._sprint ? 1.6 : 1;
      const sw = Math.sin(now * 0.018 * f);
      this.root.position.y += sw * 0.05;
    }
```

- [ ] **Step 2: 修改攻击/格挡段——保留 weaponPivot 但追加骨骼驱动**

在现有 `if (this._blocking) { ... } else if (this._attacking) { ... } else { ... }` 段之后（约 line 417），追加骨骼状态判断：

```javascript
    let skelState = 'idle';
    let skelT = 0;
    if (!this.alive) { skelState = 'death'; skelT = Math.min(1, this._deadTimer / 1.0); }
    else if (this._executing > 0) { skelState = 'execute'; skelT = 1 - this._executing / 1.2; }
    else if (this._hurt > 0) { skelState = 'hurt'; skelT = 1 - this._hurt / 0.3; }
    else if (this._dodgeTimer > 0) { skelState = 'dodge'; skelT = 1 - this._dodgeTimer / 0.4; }
    else if (this._blocking) { skelState = 'block'; skelT = 1; }
    else if (this._charging) { skelState = 'charge'; skelT = 1; }
    else if (this._attacking) {
      skelState = 'attack' + (this._animCombo + 1);
      skelT = 1 - Math.max(0, this._anim) / this._animDur;
    } else if (moving > 0.5) {
      skelState = this._sprint ? 'run' : 'walk';
      skelT = ((now * 0.018 * (this._sprint ? 1.6 : 1)) % Math.PI) / Math.PI;
    }
    this.skeleton.applyState(skelState, skelT, { speed: moving, sprint: this._sprint, now: now * 0.001 });
    this.skeleton.update(dt);
```

- [ ] **Step 3: 移除旧的 torso/hurt 直接 rotation（已由 skeleton 驱动）**

将 lines 419-430 的 hurt + torso rotation 段：
```javascript
    if (this._hurt > 0) {
      this._hurt -= dt;
      const k = Math.max(0, this._hurt) / 0.3;
      this.torso.rotation.x = -0.35 * Math.min(1, k * 2);
      const flash = 0.6 * Math.min(1, k * 2);
      for (const m of this._mats) { m.emissive.setRGB(flash, 0, 0); m.emissiveIntensity = 0.12 + flash; }
      this._emisDirty = true;
    } else if (this._emisDirty) {
      for (const m of this._mats) { m.emissive.setRGB(0, 0, 0); m.emissiveIntensity = m === this._mats[0] ? 0.12 : 0; }
      this._emisDirty = false;
    }
    this.torso.rotation.x *= 0.8;
```
替换为（仅保留 emissive 闪烁，移除 torso rotation）：
```javascript
    if (this._hurt > 0) {
      this._hurt -= dt;
      const k = Math.max(0, this._hurt) / 0.3;
      const flash = 0.6 * Math.min(1, k * 2);
      for (const m of this._mats) { m.emissive.setRGB(flash, 0, 0); m.emissiveIntensity = 0.12 + flash; }
      this._emisDirty = true;
    } else if (this._emisDirty) {
      for (const m of this._mats) { m.emissive.setRGB(0, 0, 0); m.emissiveIntensity = m === this._mats[0] ? 0.12 : 0; }
      this._emisDirty = false;
    }
```

- [ ] **Step 4: 验证浏览器——角色有呼吸/走路/攻击动画**

navigate → console 无报错 → 角色静止时轻微呼吸 → WASD 移动时腿臂摆动 → 左键攻击时手臂挥砍 → Q闪避时身体前扑

---

### Task 5: AIController.js — 确保继承动画

**Files:** Modify `src/gameplay/AIController.js`

- [ ] **Step 1: 确认 AIController 继承 Character 的 skeleton（无需代码修改）**

AIController extends Character，`_build()` 和 `update()` 都继承。Skeleton 在 Character._build() 中创建，AIController 自动获得。仅需验证。

- [ ] **Step 2: 验证浏览器——AI 角色也有动画**

navigate → 观察 3 个红方 AI → 移动时腿臂摆动 → 攻击时手臂挥砍 → 死亡时倒地

---

### Task 6: Terrain.js — 接受外部高度函数

**Files:** Modify `src/world/Terrain.js`

- [ ] **Step 1: 修改构造函数签名，接受可选 heightFn + riverDef + plateauDef**

将 `constructor(size = 220, seg = 110) {` 改为：

```javascript
  constructor(size = 220, seg = 110, opts = {}) {
    this.size = size;
    this._extHeight = opts.heightFn || null;
    this._river = opts.river || { zMin: -10, zMax: 10, depth: 1.5, flowDir: new THREE.Vector3(1, 0, 0), flowSpeed: 1.5 };
    this._bridge = opts.bridge || { xMin: -4, xMax: 4 };
    this._plateaus = opts.plateaus || [
      { cx: -40, cz: -30, r: 14, h: 7 },
      { cx: 45, cz: 35, r: 12, h: 6 }
    ];
```

- [ ] **Step 2: 修改 _rawHeight 优先使用外部函数**

在 `_rawHeight(x, z) {` 方法开头添加：

```javascript
  _rawHeight(x, z) {
    if (this._extHeight) return this._extHeight(x, z, this);
```

- [ ] **Step 3: 修改 isWater 使其可被外部函数覆盖**

在 `isWater(x, z) {` 方法开头添加：

```javascript
  isWater(x, z) {
    if (this._extHeight && this._extWater) return this._extWater(x, z);
```

（_extWater 在 MapGenerator 中按需设置）

- [ ] **Step 4: 验证——默认参数下现有地形不变**

navigate → console 无报错 → 地形与之前一致（默认参数 fallback）

---

### Task 7: MapGenerator.js — 4种地图定义

**Files:** Create `src/world/MapGenerator.js`

- [ ] **Step 1: 创建 MapGenerator 类 + 4种地图高度函数 + 布局 + 接口**

```javascript
import * as THREE from 'three';

function hash(x, y) { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); }
function smooth(t) { return t * t * (3 - 2 * t); }
function vn(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const v00 = hash(xi, yi), v10 = hash(xi + 1, yi), v01 = hash(xi, yi + 1), v11 = hash(xi + 1, yi + 1);
  const u = smooth(xf), v = smooth(yf);
  return THREE.MathUtils.lerp(THREE.MathUtils.lerp(v00, v10, u), THREE.MathUtils.lerp(v01, v11, u), v);
}
function fbm(x, y) { let a = 0, amp = 1, freq = 1, sum = 0; for (let i = 0; i < 4; i++) { a += vn(x * freq, y * freq) * amp; sum += amp; amp *= 0.5; freq *= 2; } return a / sum; }

export class MapGenerator {
  static MAPS = {
    bridge: {
      name: '渡桥', size: [360, 200],
      heightFn: (x, z, t) => {
        if (z > -15 && z < 15) {
          if (x > -5 && x < 5) return 0.3;
          return -1.5 + Math.sin(x * 0.1) * 0.3;
        }
        return fbm(x * 0.06, z * 0.06) * 2 + 0.5;
      },
      waterFn: (x, z) => z > -15 && z < 15 && !(x > -5 && x < 5),
      river: { zMin: -15, zMax: 15, depth: 1.8, flowDir: new THREE.Vector3(1, 0, 0), flowSpeed: 1.5 },
      bridge_: { xMin: -5, xMax: 5 },
      layout: {
        trees: 40, rocks: 15, tents: 4, flags: [{ x: -160, z: 0, c: 0x2f5fa8 }, { x: 160, z: 0, c: 0xa83030 }],
        supply: [{ x: 0, z: 20 }], campfires: [{ x: -140, z: 30 }, { x: 140, z: -30 }],
        bridgeStones: 3, mode: '死斗',
      },
      spawns: { blue: [{ x: -160, z: 40 }, { x: -160, z: -40 }], red: [{ x: 160, z: 40 }, { x: 160, z: -40 }] },
    },
    pass: {
      name: '山口', size: [280, 160],
      heightFn: (x, z, t) => {
        if (x < -40) return 12 + fbm(x * 0.3, z * 0.3) * 4;
        if (x > 40) return 12 + fbm(x * 0.3, z * 0.3) * 4;
        if (x < -30) { const k = (x + 40) / 10; return (12 + fbm(x * 0.3, z * 0.3) * 4) * (1 - k) + fbm(x, z) * 2 * k; }
        if (x > 30) { const k = (40 - x) / 10; return (12 + fbm(x * 0.3, z * 0.3) * 4) * (1 - k) + fbm(x, z) * 2 * k; }
        return fbm(x, z) * 2;
      },
      waterFn: () => false,
      river: { zMin: 999, zMax: 999, depth: 0, flowDir: new THREE.Vector3(0, 0, 0), flowSpeed: 0 },
      bridge_: { xMin: 999, xMax: 999 },
      layout: {
        trees: 20, rocks: 30, tents: 3, flags: [{ x: -120, z: 0, c: 0x2f5fa8 }, { x: 120, z: 0, c: 0xa83030 }],
        supply: [{ x: 0, z: 0 }], campfires: [{ x: -100, z: 10 }, { x: 100, z: -10 }],
        towers: 2, mode: '死斗',
      },
      spawns: { blue: [{ x: -120, z: 0 }], red: [{ x: 120, z: 0 }] },
    },
    fortress: {
      name: '攻城', size: [320, 220],
      heightFn: (x, z, t) => {
        const r = Math.hypot(x, z);
        if (r > 35 && r < 38) return 8;
        if (r < 35) return 0.5;
        return fbm(x * 0.06, z * 0.06) * 1.5;
      },
      waterFn: () => false,
      river: { zMin: 999, zMax: 999, depth: 0, flowDir: new THREE.Vector3(0, 0, 0), flowSpeed: 0 },
      bridge_: { xMin: 999, xMax: 999 },
      layout: {
        trees: 30, rocks: 10, tents: 6, flags: [{ x: 0, z: 0, c: 0xa83030 }, { x: -140, z: 0, c: 0x2f5fa8 }],
        supply: [{ x: -140, z: 5 }], campfires: [{ x: -120, z: 0 }],
        walls: true, gate: { x: 0, z: 37, hp: 500 }, buildings: 3, mode: '攻城',
      },
      spawns: { blue: [{ x: -140, z: 0 }], red: [{ x: 0, z: 0 }] },
    },
    field: {
      name: '遭遇', size: [400, 240],
      heightFn: (x, z, t) => fbm(x * 0.5, z * 0.5) * 3,
      waterFn: () => false,
      river: { zMin: 999, zMax: 999, depth: 0, flowDir: new THREE.Vector3(0, 0, 0), flowSpeed: 0 },
      bridge_: { xMin: 999, xMax: 999 },
      layout: {
        trees: 50, rocks: 30, tents: 0, flags: [{ x: -180, z: 0, c: 0x2f5fa8 }, { x: 180, z: 0, c: 0xa83030 }],
        supply: [{ x: -60, z: 0 }, { x: 60, z: 0 }, { x: 0, z: 80 }], campfires: [{ x: -100, z: 20 }, { x: 100, z: -20 }],
        mode: '死斗',
      },
      spawns: { blue: [{ x: -180, z: 0 }], red: [{ x: 180, z: 0 }] },
    },
  };

  static generate(mapKey) {
    const def = this.MAPS[mapKey] || this.MAPS.field;
    const terrain = new Terrain(def.size[0], def.size[1], {
      heightFn: def.heightFn,
      river: def.river,
      bridge: def.bridge_,
      plateaus: [],
    });
    terrain._extWater = def.waterFn;
    return { terrain, layout: def.layout, name: def.name, spawns: def.spawns, size: def.size };
  }

  static recommendMap(modeName) {
    const order = { '攻城': 'fortress', '死斗': 'field', '据点': 'bridge', '波次': 'field', '训练场': 'field' };
    return order[modeName] || 'field';
  }

  static cycleMap(currentKey) {
    const keys = Object.keys(this.MAPS);
    const idx = keys.indexOf(currentKey);
    return keys[(idx + 1) % keys.length];
  }
}
```

- [ ] **Step 2: 验证语法**

Run: `node -e "import('./src/world/MapGenerator.js').then(m=>{console.log('maps:',Object.keys(m.MapGenerator.MAPS)); const r=m.MapGenerator.generate('bridge'); console.log('bridge terrain size:',r.size, 'name:',r.name)}).catch(e=>console.error(e))"`
Expected: `maps: [ 'bridge', 'pass', 'fortress', 'field' ]` 和 `bridge terrain size: [ 360, 200 ] name: 渡桥`

---

### Task 8: Environment.js — 接受外部布局参数

**Files:** Modify `src/world/Environment.js`

- [ ] **Step 1: 修改构造函数接受可选 layout**

将 `constructor(terrain) {` 改为：

```javascript
  constructor(terrain, layout = null) {
    this.terrain = terrain;
    this.group = new THREE.Group();
    this._t = 0;
    this._layout = layout;
    this._build();
    this._dust();
    this._leaves();
    this._godrays();
  }
```

- [ ] **Step 2: 修改 _build() 使用 layout 参数（若提供）**

将 `_build()` 方法改为：

```javascript
  _build() {
    if (this._layout) {
      this._buildFromLayout(this._layout);
      return;
    }
    this._scatterTrees(34);
    this._scatterRocks(24);
    this._flag(-30, 0, 0x2f5fa8);
    this._flag(30, 0, 0xa83030);
    this._campfire(0, 0);
    this._campfire(-42, 26);
    this._campfire(42, -26);
    this._tents(6);
    this._wreckage(16);
    this._bloodstains(10);
    this._smokeColumns(4);
    this._grass(5000);
  }

  _buildFromLayout(layout) {
    const t = this.terrain;
    if (layout.trees) this._scatterTrees(layout.trees);
    if (layout.rocks) this._scatterRocks(layout.rocks);
    if (layout.flags) layout.flags.forEach(f => this._flag(f.x, f.z, f.c));
    if (layout.campfires) layout.campfires.forEach(c => this._campfire(c.x, c.z));
    if (layout.supply) layout.supply.forEach(s => this._campfire(s.x, s.z));
    if (layout.tents) this._tents(layout.tents);
    this._wreckage(10);
    this._bloodstains(8);
    this._smokeColumns(3);
    this._grass(4000);
  }
```

- [ ] **Step 3: 验证——默认参数下环境不变**

navigate → console 无报错 → 环境（树/石/旗帜/篝火）与之前一致

---

### Task 9: main_entry.js — 集成 MapGenerator + 地图切换

**Files:** Modify `src/main_entry.js`

- [ ] **Step 1: 添加 MapGenerator 导入**

在 `import { SupplyPoint } from './world/SupplyPoint.js';` 之后添加：

```javascript
import { MapGenerator } from './world/MapGenerator.js';
```

- [ ] **Step 2: 添加全局变量跟踪当前地图**

在 `let mode = new Deathmatch(bus);` 之后添加：

```javascript
  let currentMapKey = 'field';
  let currentMapName = '遭遇';
```

- [ ] **Step 3: 修改 bootstrap 中的 terrain/env 创建段**

将：
```javascript
  const terrain = new Terrain(220, 110);
  scene.add(terrain.mesh);
  const env = new Environment(terrain);
  scene.add(env.group);
```
替换为：

```javascript
  let terrain, env;
  function loadMap(mapKey) {
    if (terrain) { scene.remove(terrain.mesh); }
    if (env) { scene.remove(env.group); }
    const r = MapGenerator.generate(mapKey);
    terrain = r.terrain;
    env = new Environment(terrain, r.layout);
    scene.add(terrain.mesh);
    scene.add(env.group);
    currentMapKey = mapKey;
    currentMapName = r.name;
    return r;
  }
  let mapData = loadMap(MapGenerator.recommendMap(mode.name));
  let terrain = mapData.terrain;
  let env = mapData.env;
  scene.add(terrain.mesh);
  scene.add(env.group);
```

Wait — `terrain` and `env` are declared twice. Fix:

```javascript
  let terrain, env;
  function loadMap(mapKey) {
    if (terrain) { scene.remove(terrain.mesh); }
    if (env) { scene.remove(env.group); }
    const r = MapGenerator.generate(mapKey);
    terrain = r.terrain;
    env = new Environment(terrain, r.layout);
    scene.add(terrain.mesh);
    scene.add(env.group);
    currentMapKey = mapKey;
    currentMapName = r.name;
    return r;
  }
  loadMap(MapGenerator.recommendMap(mode.name));
```

- [ ] **Step 4: 修改 spawnAll 使用地图刷新点**

在 `spawnAll()` 中，将硬编码的 spawn 位置改为使用 `MapGenerator.MAPS[currentMapKey].spawns`：

将：
```javascript
    const lb = mode.spawnLayout().blue[0];
    player.spawn(new THREE.Vector3(lb.x, terrain.heightAt(lb.x, lb.z), lb.z));
```
改为：
```javascript
    const spawns = MapGenerator.MAPS[currentMapKey].spawns;
    const lb = spawns.blue[0];
    player.spawn(new THREE.Vector3(lb.x, terrain.heightAt(lb.x, lb.z), lb.z));
```

将红方 AI 的 layout：
```javascript
    const redLayout = mode.spawnLayout().red;
```
改为：
```javascript
    const redLayout = MapGenerator.MAPS[currentMapKey].spawns.red;
```

- [ ] **Step 5: 修改 M键切换——切换模式时重载地图**

在 M键处理段中，将：
```javascript
    if (e.code === 'KeyM' && (state.current === States.ENDED || state.current === States.ROUND_END || state.current === States.PLAYING && !player?.alive)) {
      mode = mode.name === '死斗' ? new Domination(bus) : (mode.name === '据点' ? new SiegeMode(bus) : (mode.name === '攻城' ? new WaveMode(bus) : new Deathmatch(bus)));
      hud.setMode(mode.name);
      restart();
    }
```
改为：
```javascript
    if (e.code === 'KeyM' && (state.current === States.ENDED || state.current === States.ROUND_END || state.current === States.PLAYING && !player?.alive)) {
      mode = mode.name === '死斗' ? new Domination(bus) : (mode.name === '据点' ? new SiegeMode(bus) : (mode.name === '攻城' ? new WaveMode(bus) : new Deathmatch(bus)));
      const newMapKey = MapGenerator.recommendMap(mode.name);
      loadMap(newMapKey);
      hud.setMode(mode.name + ' · ' + currentMapName);
      restart();
    }
```

- [ ] **Step 6: 添加逗号键切换地图（可选）**

在 M键处理段之后添加：

```javascript
    if (e.code === 'Comma' && (state.current === States.ENDED || state.current === States.ROUND_END)) {
      const next = MapGenerator.cycleMap(currentMapKey);
      loadMap(next);
      hud.flash('地图：' + currentMapName);
      restart();
    }
```

- [ ] **Step 7: 修改 water 创建——使用地图河流信息**

在 bootstrap 中，将：
```javascript
  const water = new Water(220, 20);
  water.mesh.position.set(0, 0.2, 0);
```
改为根据地图尺寸调整：
```javascript
  const water = new Water(currentMapKey === 'bridge' ? 360 : 100, 30);
  water.mesh.position.set(0, 0.2, 0);
```

- [ ] **Step 8: 验证——M键切换模式时加载不同地图**

navigate → 按 M 切换模式 → console 无 TypeError → HUD 显示 "模式 · 地图名" → 地形/物体变化

---

### Task 10: 整体验证

- [ ] **Step 1: 骨骼动画验证**

navigate → http://localhost:5174/ → console 无 error → 验证：
- 角色静止时轻微呼吸（chest 微动）
- WASD 移动时腿臂摆动
- 左键攻击3次，三连击动画不同（横砍→纵劈→回旋）
- 右键格挡，手臂上举
- Q闪避，身体前扑蜷缩
- 被击杀，倒地动画
- AI角色也有相同动画

- [ ] **Step 2: 地图验证**

按 M 切换模式 → 验证4种地图：
- 死斗→遭遇战：400×240 开阔平原
- 据点→渡桥战：360×200 河流+桥
- 攻城→攻城战：320×220 城墙
- 波次→遭遇战：400×240

- [ ] **Step 3: 性能验证**

4个AI+玩家+骨骼动画 → FPS ≥ 30（console 无 WebGL performance warning）

- [ ] **Step 4: 回归验证**

技能树(K键)、新手引导、设置(Esc)、补给点回血 → 全部正常工作

---

## Self-Review

**1. Spec coverage:**
- 14骨骼层级 ✓ Task 1
- 10种动画关键帧 ✓ Task 2 (idle/walk/run/attack1-3/block/dodge/charge/hurt/death/execute)
- Character _build() 集成 ✓ Task 3
- Character update() 驱动 ✓ Task 4
- AIController 继承 ✓ Task 5
- Terrain heightFn ✓ Task 6
- 4种地图定义 ✓ Task 7
- Environment layout ✓ Task 8
- main_entry MapGenerator 集成 ✓ Task 9
- 整体验证 ✓ Task 10

**2. Placeholder scan:** 无 TBD/TODO。所有代码完整给出。Task 9 Step 3 的重复声明已修复（`let terrain, env` 一次声明，loadMap 赋值）。

**3. Type consistency:**
- `Skeleton.bindParts()` 参数对象 keys 与 Character._build() 传入的部件一致 ✓
- `MapGenerator.generate()` 返回 { terrain, layout, name, spawns, size } — main_entry 使用一致 ✓
- `MapGenerator.recommendMap(modeName)` 和 `cycleMap(currentKey)` — main_entry 调用一致 ✓
- `Terrain` 构造函数第三参数 opts: { heightFn, river, bridge, plateaus } — MapGenerator 传入一致 ✓
