import * as THREE from 'three';
import { deepDispose } from '../render/disposeUtils.js';

// 程序化环境：树/石/旗(顶点波动)/篝火(粒子火苗+烟)/帐篷/残骸/血迹/烟柱
// 尘埃用 ShaderMaterial uTime 位移(CPU 0 上传)
export class Environment {
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

  dispose() { deepDispose(this.group); }

  // 画质降级：缩减草实例与尘埃/落叶粒子绘制数量（不重建资源）
  setQuality(q) {
    const f = q === 'low' ? 0.35 : q === 'mid' ? 0.7 : 1;
    if (this._grassMeshes) for (const m of this._grassMeshes) m.count = Math.max(1, Math.floor((m.userData.baseCount || m.count) * f));
    if (this._dustPts) this._dustPts.geometry.setDrawRange(0, Math.max(1, Math.floor((this._dustPts.userData.baseCount || 600) * f)));
    if (this._leavesPts) this._leavesPts.geometry.setDrawRange(0, Math.max(1, Math.floor((this._leavesPts.userData.baseCount || 60) * f)));
  }

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

  _scatterTrees(n) {
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4a2f1a, roughness: 1 });
    const leafColors = [0x355028, 0x3a4a20, 0x446030].map(c => new THREE.Color(c));
    const leafMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1 });
    const trunkGeo = new THREE.CylinderGeometry(0.25, 0.42, 2.6, 8);
    const leafGeos = [0, 1, 2].map(j => new THREE.ConeGeometry(1.8 - j * 0.35, 1.6, 8));
    const trunkMesh = new THREE.InstancedMesh(trunkGeo, trunkMat, n);
    trunkMesh.castShadow = true;
    const leafMeshes = leafGeos.map(g => new THREE.InstancedMesh(g, leafMat, n));
    leafMeshes.forEach(m => m.castShadow = true);
    const dummy = new THREE.Object3D();
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, r = 32 + Math.random() * 60;
      const x = Math.cos(a) * r, z = Math.sin(a) * r, y = this.terrain.heightAt(x, z);
      const rot = Math.random() * Math.PI;
      const scale = 0.85 + Math.random() * 0.5;
      dummy.position.set(x, y + 1.3 * scale, z);
      dummy.rotation.y = rot;
      dummy.scale.setScalar(scale);
      dummy.updateMatrix();
      trunkMesh.setMatrixAt(i, dummy.matrix);
      for (let j = 0; j < 3; j++) {
        dummy.position.set(x, y + (2.6 + j * 0.9) * scale, z);
        dummy.updateMatrix();
        leafMeshes[j].setMatrixAt(i, dummy.matrix);
      }
      const lc = leafColors[Math.floor(Math.random() * 3)];
      leafMeshes.forEach(m => m.setColorAt(i, lc));
      (this._collidables ||= []).push({ x, z, r: 0.6 * scale });
    }
    trunkMesh.instanceMatrix.needsUpdate = true;
    leafMeshes.forEach(m => { m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; });
    this._treeMeshes = [trunkMesh, ...leafMeshes];
    this.group.add(...this._treeMeshes);
  }

  _scatterRocks(n) {
    const mat = new THREE.MeshStandardMaterial({ color: 0x6b6862, roughness: 1 });
    const geo = new THREE.DodecahedronGeometry(1, 1);
    const mesh = new THREE.InstancedMesh(geo, mat, n);
    mesh.castShadow = true; mesh.receiveShadow = true;
    const dummy = new THREE.Object3D();
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, r = 14 + Math.random() * 75;
      const x = Math.cos(a) * r, z = Math.sin(a) * r, y = this.terrain.heightAt(x, z);
      const s = 0.5 + Math.random() * 1.8;
      dummy.position.set(x, y + s * 0.3, z);
      dummy.rotation.set(Math.random(), Math.random(), Math.random());
      dummy.scale.setScalar(s);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      if (s > 0.8) (this._collidables ||= []).push({ x, z, r: s });
    }
    mesh.instanceMatrix.needsUpdate = true;
    this._rockMesh = mesh;
    this.group.add(mesh);
  }

  get collisionBoxes() {
    const boxes = [];
    for (const c of (this._collidables || [])) {
      boxes.push({ minX: c.x - c.r, maxX: c.x + c.r, minZ: c.z - c.r, maxZ: c.z + c.r });
    }
    return boxes;
  }

  _grass(n) {
    const mats = [0x4a6030, 0x5a6a38, 0x3e5628].map(c => new THREE.MeshStandardMaterial({ color: c, roughness: 1, side: THREE.DoubleSide }));
    const geoA = new THREE.PlaneGeometry(0.18, 0.7, 1, 2);
    const geoB = geoA.clone(); geoB.rotateY(Math.PI / 2); // 十字双面防侧面消失
    for (let m = 0; m < 3; m++) {
      const cnt = Math.floor(n / 3);
      for (const g of [geoA, geoB]) {
        const mesh = new THREE.InstancedMesh(g, mats[m], cnt);
        const mtx = new THREE.Matrix4();
        for (let i = 0; i < cnt; i++) {
          const a = Math.random() * Math.PI * 2, r = 5 + Math.random() * 80;
          const x = Math.cos(a) * r, z = Math.sin(a) * r, y = this.terrain.heightAt(x, z);
          mtx.makeRotationY(Math.random() * Math.PI);
          mtx.setPosition(x, y + 0.35, z);
          mesh.setMatrixAt(i, mtx);
        }
        mesh.castShadow = false; mesh.receiveShadow = true;
        mesh.userData.baseCount = cnt;
        this._grassMeshes = this._grassMeshes || []; this._grassMeshes.push(mesh);
        this.group.add(mesh);
      }
    }
  }

  _ruins() {
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x6a6258, roughness: 0.9 });
    for (let i = 0; i < 8; i++) {
      const a = Math.random() * Math.PI * 2, r = 18 + Math.random() * 30;
      const x = Math.cos(a) * r, z = Math.sin(a) * r, y = this.terrain.heightAt(x, z);
      const w = new THREE.Mesh(new THREE.BoxGeometry(2 + Math.random() * 2, 3 + Math.random() * 2, 0.6), wallMat);
      w.position.set(x, y + 1.5, z); w.rotation.set((Math.random() - 0.5) * 0.3, Math.random() * Math.PI, (Math.random() - 0.5) * 0.4);
      w.castShadow = true; w.receiveShadow = true; this.group.add(w);
      for (let j = 0; j < 3; j++) {
        const r2 = new THREE.Mesh(new THREE.DodecahedronGeometry(0.3 + Math.random() * 0.4, 1), wallMat);
        r2.position.set(x + (Math.random() - 0.5) * 3, y + 0.2, z + (Math.random() - 0.5) * 3);
        r2.castShadow = true; this.group.add(r2);
      }
    }
  }

  _landmarks() {
    const mat = new THREE.MeshStandardMaterial({ color: 0x8a8278, roughness: 0.85 });
    const mat2 = new THREE.MeshStandardMaterial({ color: 0x5a3a1a, roughness: 0.8 });
    for (const [tx, tz] of [[-38, -28], [40, 32]]) {
      const y = this.terrain.heightAt(tx, tz);
      const tower = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.5, 10, 8, 1, true), mat);
      tower.position.set(tx, y + 5, tz); tower.castShadow = true; this.group.add(tower);
      const floor = new THREE.Mesh(new THREE.CircleGeometry(1.4, 8), mat);
      floor.rotation.x = -Math.PI / 2; floor.position.set(tx, y + 0.1, tz); this.group.add(floor);
      const top = new THREE.Mesh(new THREE.ConeGeometry(2, 2, 8), mat2);
      top.position.set(tx, y + 11, tz); this.group.add(top);
      for (let i = 0; i < 4; i++) {
        const w = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.8, 0.2), new THREE.MeshStandardMaterial({ color: 0x202028, emissive: 0x402010, emissiveIntensity: 0.4 }));
        const a = i * Math.PI / 2;
        w.position.set(tx + Math.cos(a) * 1.4, y + 6 + i * 0.5, tz + Math.sin(a) * 1.4);
        w.lookAt(tx, y + 6, tz); this.group.add(w);
      }
    }
  }

  _tents() {
    const tentMat = (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.7, side: THREE.DoubleSide });
    for (let i = 0; i < 4; i++) {
      const x = -18 - i * 3, z = -8 + (i % 2) * 5, y = this.terrain.heightAt(x, z);
      const t = new THREE.Mesh(new THREE.ConeGeometry(1.5, 2.2, 6), tentMat(0x2f5fa8));
      t.position.set(x, y + 1.1, z); t.castShadow = true; this.group.add(t);
    }
    for (let i = 0; i < 4; i++) {
      const x = 22 + i * 3, z = 8 + (i % 2) * 5, y = this.terrain.heightAt(x, z);
      const t = new THREE.Mesh(new THREE.ConeGeometry(1.5, 2.2, 6), tentMat(0xa83030));
      t.position.set(x, y + 1.1, z); t.castShadow = true; this.group.add(t);
    }
  }

  _flag(x, z, color) {
    const y = this.terrain.heightAt(x, z);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 6.5, 6), new THREE.MeshStandardMaterial({ color: 0x3a2a20, roughness: 1 }));
    pole.position.set(x, y + 3.25, z); pole.castShadow = true;
    const clothMat = new THREE.ShaderMaterial({
      side: THREE.DoubleSide,
      uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color(color) } },
      vertexShader: `uniform float uTime; varying vec2 vUv; void main(){ vUv=uv; vec3 p=position; float w=sin(p.x*2.0+uTime*3.0)*0.18*uv.x; p.z+=w; p.y+=w*0.3; gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.0);} `,
      fragmentShader: `uniform vec3 uColor; varying vec2 vUv; void main(){ gl_FragColor=vec4(uColor,1.0);} `
    });
    const cloth = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 1.3, 8, 5), clothMat);
    cloth.position.set(x + 1.0, y + 5.3, z);
    this.group.add(pole, cloth);
    this._flags = this._flags || []; this._flags.push(cloth);
  }

  _campfire(x, z) {
    const y = this.terrain.heightAt(x, z);
    const logMat = new THREE.MeshStandardMaterial({ color: 0x3a2a1a, roughness: 1 });
    for (let i = 0; i < 5; i++) {
      const log = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 1.7, 6), logMat);
      log.position.set(x, y + 0.22, z);
      log.rotation.z = Math.PI / 2; log.rotation.y = (i / 5) * Math.PI;
      this.group.add(log);
    }
    const fire = new THREE.Mesh(new THREE.ConeGeometry(0.55, 1.4, 10), new THREE.MeshStandardMaterial({ color: 0xff7030, emissive: 0xff5020, emissiveIntensity: 2.5 }));
    fire.position.set(x, y + 0.8, z);
    this.group.add(fire); this._fire = this._fire || []; this._fire.push(fire);
    // 火苗粒子
    const N = 40;
    const geo = new THREE.BufferGeometry();
    const arr = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) { arr[i * 3] = x; arr[i * 3 + 1] = y + 0.8; arr[i * 3 + 2] = z; }
    geo.setAttribute('position', new THREE.BufferAttribute(arr, 3));
    const pm = new THREE.PointsMaterial({ color: 0xff8030, size: 0.15, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false });
    const pts = new THREE.Points(geo, pm);
    this.group.add(pts);
    this._embers = this._embers || []; this._embers.push({ pts, base: new THREE.Vector3(x, y + 0.8, z), parts: Array.from({ length: N }, () => ({ life: Math.random() * 0.6, vy: 1 + Math.random() * 2, vx: (Math.random() - 0.5) * 1.5, vz: (Math.random() - 0.5) * 1.5 })) });
    // 烟
    const smoke = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 1.2, 4, 6), new THREE.MeshStandardMaterial({ color: 0x4a4a4a, transparent: true, opacity: 0.25, depthWrite: false }));
    smoke.position.set(x, y + 2.5, z);
    this.group.add(smoke); this._smokes = this._smokes || []; this._smokes.push(smoke);
    const light = new THREE.PointLight(0xff8030, 2.5, 28, 2);
    light.position.set(x, y + 1.6, z);
    this.group.add(light);
  }

  _tents(n) {
    const clothMat = new THREE.MeshStandardMaterial({ color: 0x6a5a3a, roughness: 1, side: THREE.DoubleSide });
    for (let i = 0; i < n; i++) {
      const ang = Math.random() * Math.PI * 2, r = 24 + Math.random() * 16;
      const x = Math.cos(ang) * r, z = Math.sin(ang) * r, y = this.terrain.heightAt(x, z);
      const g = new THREE.Group();
      const tent = new THREE.Mesh(new THREE.ConeGeometry(2.2, 2.0, 10), clothMat);
      tent.position.y = 1.0; tent.castShadow = true;
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 3, 5), new THREE.MeshStandardMaterial({ color: 0x3a2a20 }));
      pole.position.y = 1.5;
      g.add(tent, pole);
      g.position.set(x, y, z); g.rotation.y = Math.random() * Math.PI;
      this.group.add(g);
    }
  }

  _wreckage(n) {
    const shieldMat = new THREE.MeshStandardMaterial({ color: 0x6a6258, roughness: 1, side: THREE.DoubleSide });
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x3a2a1a, roughness: 1 });
    const shieldGeo = new THREE.CylinderGeometry(0.5, 0.5, 0.06, 6);
    const spearGeo = new THREE.BoxGeometry(0.05, 0.05, 1.5);
    const items = [];
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, r = 8 + Math.random() * 12;
      const x = Math.cos(a) * r, z = Math.sin(a) * r, y = this.terrain.heightAt(x, z);
      items.push({ x, y, z, isShield: Math.random() > 0.5, rot: Math.random() * Math.PI });
    }
    const shields = items.filter(it => it.isShield);
    const spears = items.filter(it => !it.isShield);
    const dummy = new THREE.Object3D();
    const meshes = [];
    if (shields.length) {
      const sm = new THREE.InstancedMesh(shieldGeo, shieldMat, shields.length);
      shields.forEach((it, i) => {
        dummy.position.set(it.x, it.y + 0.05, it.z);
        dummy.rotation.set(Math.PI / 2, 0, it.rot);
        dummy.scale.setScalar(1);
        dummy.updateMatrix();
        sm.setMatrixAt(i, dummy.matrix);
      });
      sm.instanceMatrix.needsUpdate = true;
      meshes.push(sm);
    }
    if (spears.length) {
      const pm = new THREE.InstancedMesh(spearGeo, woodMat, spears.length);
      spears.forEach((it, i) => {
        dummy.position.set(it.x, it.y + 0.05, it.z);
        dummy.rotation.set(0, it.rot, Math.PI / 2);
        dummy.scale.setScalar(1);
        dummy.updateMatrix();
        pm.setMatrixAt(i, dummy.matrix);
      });
      pm.instanceMatrix.needsUpdate = true;
      meshes.push(pm);
    }
    this._wreckMeshes = meshes;
    this.group.add(...meshes);
  }

  _bloodstains(n) {
    const mat = new THREE.MeshStandardMaterial({ color: 0x3a0808, roughness: 1, transparent: true, opacity: 0.55, depthWrite: false });
    const geo = new THREE.PlaneGeometry(2.5, 2.5);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, r = 4 + Math.random() * 16;
      const x = Math.cos(a) * r, z = Math.sin(a) * r, y = this.terrain.heightAt(x, z);
      const m = new THREE.Mesh(geo, mat);
      m.rotation.x = -Math.PI / 2; m.rotation.z = Math.random() * Math.PI;
      m.position.set(x, y + 0.02, z);
      this.group.add(m);
    }
  }

  _smokeColumns(n) {
    const mat = new THREE.MeshStandardMaterial({ color: 0x3a3a3a, transparent: true, opacity: 0.3, depthWrite: false });
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, r = 60 + Math.random() * 30;
      const x = Math.cos(a) * r, z = Math.sin(a) * r, y = this.terrain.heightAt(x, z);
      const col = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 0.4, 18, 10), mat);
      col.position.set(x, y + 9, z);
      this.group.add(col);
    }
  }

  _dust() {
    const N = 600;
    const geo = new THREE.BufferGeometry();
    const arr = new Float32Array(N * 3);
    const seed = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      arr[i * 3] = (Math.random() - 0.5) * 120;
      arr[i * 3 + 1] = Math.random() * 16;
      arr[i * 3 + 2] = (Math.random() - 0.5) * 120;
      seed[i * 3] = (Math.random() - 0.5) * 0.3;
      seed[i * 3 + 1] = 0.05 + Math.random() * 0.12;
      seed[i * 3 + 2] = (Math.random() - 0.5) * 0.3;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(arr, 3));
    geo.setAttribute('seed', new THREE.BufferAttribute(seed, 3));
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      uniforms: { uTime: { value: 0 } },
      vertexShader: `attribute vec3 seed; uniform float uTime; varying float vY; void main(){ vec3 p=position; p.x+=seed.x*uTime; p.z+=seed.z*uTime; p.y=mod(p.y+seed.y*uTime, 16.0); vY=p.y; gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.0); gl_PointSize=2.5;} `,
      fragmentShader: `varying float vY; void main(){ float a=0.5*(1.0-vY/16.0)+0.2; gl_FragColor=vec4(1.0,0.88,0.7,a);} `
    });
    this._dustPts = new THREE.Points(geo, mat);
    this._dustPts.userData.baseCount = N;
    this.group.add(this._dustPts);
  }

  _leaves() {
    const N = 60;
    const geo = new THREE.BufferGeometry();
    const arr = new Float32Array(N * 3);
    const seed = new Float32Array(N * 4);
    for (let i = 0; i < N; i++) {
      arr[i * 3] = (Math.random() - 0.5) * 80;
      arr[i * 3 + 1] = 5 + Math.random() * 10;
      arr[i * 3 + 2] = (Math.random() - 0.5) * 80;
      seed[i * 4] = Math.random() * Math.PI * 2;
      seed[i * 4 + 1] = 0.5 + Math.random();
      seed[i * 4 + 2] = (Math.random() - 0.5) * 2;
      seed[i * 4 + 3] = 0.4 + Math.random() * 0.4;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(arr, 3));
    geo.setAttribute('seed', new THREE.BufferAttribute(seed, 4));
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      uniforms: { uTime: { value: 0 } },
      vertexShader: `attribute vec4 seed; uniform float uTime; void main(){ vec3 p=position; p.y=mod(15.0 - p.y + uTime*seed.y*0.3, 15.0); p.x+=sin(uTime*1.5+seed.x)*seed.z; p.z+=cos(uTime*1.3+seed.x)*seed.z; gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.0); gl_PointSize=4.0;} `,
      fragmentShader: `void main(){ gl_FragColor=vec4(0.55,0.35,0.16,0.9);} `
    });
    this._leavesPts = new THREE.Points(geo, mat);
    this._leavesPts.userData.baseCount = N;
    this.group.add(this._leavesPts);
  }

  _godrays() {
    const mat = new THREE.MeshBasicMaterial({ color: 0xffd090, transparent: true, opacity: 0.06, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    const ray = new THREE.Mesh(new THREE.CylinderGeometry(7, 7, 130, 8, 1, true), mat);
    ray.position.set(40, 60, 22);
    ray.lookAt(0, 0, 0);
    ray.rotateX(Math.PI / 2);
    this.group.add(ray);
  }

  update(dt, time) {
    this._t += dt;
    if (this._flags) for (const c of this._flags) c.material.uniforms.uTime.value = time;
    if (this._dustPts) this._dustPts.material.uniforms.uTime.value = time;
    if (this._leavesPts) this._leavesPts.material.uniforms.uTime.value = time;
    if (this._fire) for (const f of this._fire) f.scale.y = 1 + Math.sin(time * 0.02) * 0.12;
    if (this._smokes) for (const s of this._smokes) s.rotation.y += dt * 0.2;
    // 火苗粒子
    if (this._embers) {
      for (const e of this._embers) {
        const pos = e.pts.geometry.attributes.position;
        for (let i = 0; i < e.parts.length; i++) {
          const p = e.parts[i];
          p.life -= dt;
          if (p.life <= 0) { p.life = 0.6; pos.setXYZ(i, e.base.x, e.base.y, e.base.z); p.vy = 1 + Math.random() * 2; }
          else { pos.setXYZ(i, pos.getX(i), pos.getY(i) + p.vy * dt, pos.getZ(i)); p.vy -= 1.5 * dt; }
        }
        pos.needsUpdate = true;
      }
    }
  }
}
