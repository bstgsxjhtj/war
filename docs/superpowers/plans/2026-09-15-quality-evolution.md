# 品质进化实施计划（画面/场景/手感/可玩）

> **执行须知：** 本计划面向冷兵器 TPS Demo 的第四轮进化。游戏无单元测试，以"实现 + 浏览器运行验证"替代 TDD。每任务含目标、文件、关键实现、验证。

**Goal:** 根治"画面粗糙+场景简陋"两大痛点，补齐 PBR 贴图/环境反射/抗锯齿/粒子形态、地形多层纹理/植被密度/建筑丰富/河流细节/天气系统、程序化音效、波次生存模式与设置菜单，使画面与可玩性向成品靠近。

**Architecture:** 新建 TextureFactory（程序化 PBR 纹理生成）、EnvMap（环境反射）、ParticleFX（形态化粒子）、WeatherSystem（雨/雾/日夜）、AudioEngine（WebAudio 程序化音效）、WaveMode（波次生存）、SettingsMenu（设置）。改造 Terrain（splat 多层）、Environment（植被/建筑/河流细节）、Character（PBR 材质）、Renderer（MSAA+阴影）。

**Tech Stack:** Three.js + Canvas2D（程序化纹理）+ WebAudio API + Vite。

---

## File Structure

**新建：**
- `src/render/TextureFactory.js` — 程序化生成法线/粗糙度/漫反射贴图（Canvas2D）
- `src/render/EnvMap.js` — 程序化 CubeTexture 环境反射
- `src/render/ParticleFX.js` — 命中火花/烟雾 Sprite 纹理 + 池化
- `src/world/WeatherSystem.js` — 雨粒子 + 雾密度 + 日夜光照循环
- `src/audio/AudioEngine.js` — WebAudio 程序化挥砍/命中/脚步/受击音效
- `src/gameplay/WaveMode.js` — 波次生存（递增难度 + Boss）
- `src/ui/SettingsMenu.js` — 画质/音量/键位/灵敏度设置

**修改：**
- `src/engine/Renderer.js` — MSAA antialias + 阴影范围/CSM 简化
- `src/world/Terrain.js` — splat 多层纹理（草/泥/碎石/沙）+ 细节贴图
- `src/world/Environment.js` — 植被密度 5000+ + 灌木/岩石群/落叶 + 建筑废墟/地标塔/营帐 + 河岸/水花/倒影
- `src/gameplay/Character.js` — PBR 材质（贴图应用）+ envMap
- `src/main_entry.js` — 注册新系统 + 模式切换（含波次）

---

## Task 1: 程序化 PBR 纹理工厂

**目标：** Canvas2D 生成法线/粗糙度/漫反射贴图，供角色/建筑/地形使用，消除纯色"塑料感"。

**Files:** Create `src/render/TextureFactory.js`

**关键实现：**
```js
import * as THREE from 'three';
export class TextureFactory {
  static noise(w=256,h=256,base='#6a5a3a',amp=30){const c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d');x.fillStyle=base;x.fillRect(0,0,w,h);for(let i=0;i<2000;i++){const r=parseInt(base.slice(1,3),16)+(Math.random()-0.5)*amp;const g=parseInt(base.slice(3,5),16)+(Math.random()-0.5)*amp;const b=parseInt(base.slice(5,7),16)+(Math.random()-0.5)*amp;x.fillStyle=`rgb(${r|0},${g|0},${b|0})`;x.fillRect(Math.random()*w,Math.random()*h,2,2);}const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;return t;}
  static normal(w=256,h=256){const c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d');const id=x.createImageData(w,h);for(let i=0;i<w*h;i++){const n=(Math.random()-0.5)*0.3;id.data[i*4]=128+n*255;id.data[i*4+1]=128;id.data[i*4+2]=255;id.data[i*4+3]=255;}x.putImageData(id,0,0);const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;return t;}
  static rough(w=256,h=256,base=0.7){const c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d');const id=x.createImageData(w,h);for(let i=0;i<w*h;i++){const v=(base+(Math.random()-0.5)*0.3)*255;id.data[i*4]=v;id.data[i*4+1]=v;id.data[i*4+2]=v;id.data[i*4+3]=255;}x.putImageData(id,0,0);const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;return t;}
}
```

**验证：** 控制台 `TextureFactory.noise()` 返回 CanvasTexture，无报错。

---

## Task 2: 环境反射 envMap

**目标：** 程序化 CubeTexture，金属盔甲反射天空/地面，消除塑料感。

**Files:** Create `src/render/EnvMap.js`; Modify `Renderer.js`

**关键实现：**
```js
export class EnvMap {
  static create(scene){const tex=new THREE.CubeTexture(EnvMap._faces());tex.needsUpdate=true;return tex;}
  static _faces(){const a=[];for(let i=0;i<6;i++){const c=document.createElement('canvas');c.width=c.height=64;const x=c.getContext('2d');const g=x.createLinearGradient(0,0,0,64);g.addColorStop(0,i<2?'#3a4a6a':'#1a2030');g.addColorStop(1,'#5a6a4a');x.fillStyle=g;x.fillRect(0,0,64,64);a.push(c);}return a;}
}
```
- Renderer.setup：`scene.environment = EnvMap.create(scene)`（PBR 自动反射）

**验证：** 角色盔甲金属部分反射环境色，非纯色。

---

## Task 3: MSAA 抗锯齿 + 阴影调优

**目标：** 消除边缘锯齿，阴影远距不失真。

**Files:** Modify `Renderer.js`

**关键实现：**
- WebGLRenderer `{ antialias: true }`（若已 false 改 true）
- shadowMap `THREE.PCFSoftShadowMap` + `renderer.shadowMap.autoUpdate=true`
- 主光 shadow.camera 范围 ±130，shadow.mapSize 4096

**验证：** 角色边缘/城墙轮廓平滑无锯齿。

---

## Task 4: 粒子形态化（火花/烟雾）

**目标：** 命中粒子从 Points 方块改为 Sprite 纹理（火花/血溅/烟），形态真实。

**Files:** Create `src/render/ParticleFX.js`; Modify `CombatSystem.js`

**关键实现：**
```js
export class ParticleFX {
  static spark(size=64){const c=document.createElement('canvas');c.width=c.height=size;const x=c.getContext('2d');const g=x.createRadialGradient(size/2,size/2,0,size/2,size/2,size/2);g.addColorStop(0,'rgba(255,220,120,1)');g.addColorStop(0.4,'rgba(255,120,40,0.6)');g.addColorStop(1,'rgba(80,20,0,0)');x.fillStyle=g;x.fillRect(0,0,size,size);return new THREE.CanvasTexture(c);}
  static blood(size=64){/* 红色径向 */}
  static smoke(size=64){/* 灰色径向软 */}
}
```
- CombatSystem 命中粒子改 Sprite（spark/blood/smoke 纹理），池化 40 个

**验证：** 命中时火花/血溅形态为光晕非方块。

---

## Task 5: 地形多层 splat 纹理

**目标：** 地形按高度/坡度混合草地/泥土/碎石/沙四层纹理，非纯顶点色。

**Files:** Modify `Terrain.js`

**关键实现：**
- TextureFactory 生成 grass/dirt/stone/sand 漫反射+法线
- Terrain 构造：按顶点高度/坡度选择 4 层纹理混合，ShaderMaterial 或 MeshStandardMaterial（vertexColors + 细节贴图）
- 细节层：repeat 16x 增密度

**验证：** 地形近看有纹理细节，草/泥/碎石区域分明。

---

## Task 6: 植被密度 + 种类

**目标：** 草 5000+、灌木、岩石群、落叶堆，场景不再空旷。

**Files:** Modify `Environment.js`

**关键实现：**
- 草 InstancedMesh 1400→5000，加灌木（球体 + 叶片）
- 岩石群（DodecahedronGeometry 散布 30+）
- 落叶堆（Plane 旋转贴地）
- 树增 3 种形态（高松/宽冠/枯木）

**验证：** 场景植被丰富，无大片空地。

---

## Task 7: 建筑丰富（废墟/地标/营帐）

**目标：** 城墙有垛口纹理、废墟残墙、地标瞭望塔、营帐群，场景有叙事感。

**Files:** Modify `Environment.js` + `SiegeStructure.js`

**关键实现：**
- 城墙加垛口 + 纹理贴图（TextureFactory 砖石）
- 废墟：残墙 BoxGeometry 倾斜 + 碎块
- 地标瞭望塔（CylinderGeometry 高塔 + 顶棚）
- 营帐群（ConeGeometry 帐篷 5-8 个，队色）

**验证：** 战场有建筑层次，非空旷。

---

## Task 8: 河流细节（水花/河岸/倒影）

**目标：** 河流水花粒子、河岸侵蚀纹理、水面倒影。

**Files:** Modify `Water.js` + `Environment.js`

**关键实现：**
- Water 加水花粒子（白色 Points 沿河面）
- 河岸：Terrain 水边加沙/湿泥纹理
- 倒影：ReflectorPass 或简化（镜像角色 y 反射，opacity 0.3）

**验证：** 河面有水花动态，河岸湿润感，水面映角色倒影。

---

## Task 9: 天气系统（雨/雾/日夜）

**目标：** 可切换雨/晴/夜，雨粒子+雾密度+光照变化，氛围层次。

**Files:** Create `src/world/WeatherSystem.js`; Modify `main_entry.js`

**关键实现：**
```js
export class WeatherSystem {
  constructor(scene){this.scene=scene;this._rain=null;this._mode='clear';this._time=0;}
  setRain(on){/* Points 2000 雨滴，y 下落循环 */}
  setFog(density){this.scene.fog.density=density;}
  setDayNight(t){/* sun.intensity + color 随 t 变化 */}
  update(dt,now){/* rain 粒子下落 + 日夜慢循环 */}
}
```
- main：WeatherSystem 实例 + 按 N 切换天气

**验证：** 按 N 切雨/晴/夜，雨滴下落 + 雾变浓 + 光照变暗。

---

## Task 10: 程序化音效（WebAudio）

**目标：** 挥砍/命中/脚步/受击/格挡音效，补打击感一半。

**Files:** Create `src/audio/AudioEngine.js`; Modify `Character.js`/`CombatSystem.js`/`main_entry.js`

**关键实现：**
```js
export class AudioEngine {
  constructor(){this.ctx=null;this._init();}
  _init(){try{this.ctx=new (window.AudioContext||window.webkitAudioContext)();}catch(e){}}
  swing(){this._tone(180,0.08,'sine',0.15);}
  hit(heavy){this._noise(heavy?0.25:0.12,heavy?400:200);}
  footstep(){this._noise(0.05,80);}
  block(){this._tone(600,0.1,'square',0.2);}
  _tone(f,dur,type,vol){if(!this.ctx)return;const o=this.ctx.createOscillator();const g=this.ctx.createGain();o.type=type;o.frequency.value=f;g.gain.setValueAtTime(vol,this.ctx.currentTime);g.gain.exponentialRampToValueAtTime(0.001,this.ctx.currentTime+dur);o.connect(g).connect(this.ctx.destination);o.start();o.stop(this.ctx.currentTime+dur);}
  _noise(dur,filter){if(!this.ctx)return;const b=this.ctx.createBuffer(1,this.ctx.sampleRate*dur,this.ctx.sampleRate);const d=b.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;const s=this.ctx.createBufferSource();s.buffer=b;const f=this.ctx.createBiquadFilter();f.type='lowpass';f.frequency.value=filter;s.connect(f).connect(this.ctx.destination);s.start();}
}
```
- Character 攻击 hitFrame 调 audio.swing，CombatSystem._emitHit 调 audio.hit，Character 移动调 audio.footstep

**验证：** 攻击/命中/移动有程序化音效，无静默。

---

## Task 11: 波次生存模式 + Boss

**目标：** 新增波次模式，每波递增敌数/强度，第 5 波 Boss（高血+特殊技能）。

**Files:** Create `src/gameplay/WaveMode.js`; Modify `main_entry.js`/`GameMode.js`

**关键实现：**
```js
export class WaveMode {
  constructor(){this.wave=0;this.alive=0;this.spawning=false;}
  nextWave(){this.wave++;const count=3+this.wave*2;const isBoss=this.wave%5===0;return{count,isBoss,wave:this.wave};}
  onKill(){this.alive--;}
  checkWin(){return false;}
}
```
- main：M 切换含波次；spawnAll 波次生成；Boss 高血 500 + 重锤

**验证：** 选波次模式，每波递增，第 5 波出 Boss。

---

## Task 12: 设置菜单（画质/音量）

**目标：** 可调画质（低/中/高影响 shadow/像素比）、音量、鼠标灵敏度。

**Files:** Create `src/ui/SettingsMenu.js`; Modify `main_entry.js`

**关键实现：**
- DOM 面板：画质 select（low: shadow off + pixelRatio 0.5；high: shadow 4096 + pixelRatio 2）、音量 slider、灵敏度 slider
- 按 Esc 打开（pointerlock 退出时）
- 灵敏度影响 camera.look 的 yaw/pitch 乘数

**验证：** 按 Esc 弹设置，调画质/音量/灵敏度生效。

---

## Self-Review

**1. Spec coverage：** 画面（PBR1/envMap2/MSAA3/粒子4）✓ 场景（地形5/植被6/建筑7/河流8/天气9）✓ 手感（音效10）✓ 可玩（波次11/设置12）✓。缺口：技能树/训练场/新手引导（列为后续轮次，工程量大）。

**2. Placeholder scan：** 无 TBD/TODO，关键代码已给骨架。

**3. Type consistency：** TextureFactory.noise/normal/rough、EnvMap.create、ParticleFX.spark/blood/smoke、WeatherSystem.setRain、AudioEngine.swing/hit、WaveMode.nextWave 命名一致。✓

**4. 优先级取舍：** 12 项聚焦画面/场景（用户痛点 9 项）+ 音效 + 可玩 2 项。技能树/训练场列为后续。
