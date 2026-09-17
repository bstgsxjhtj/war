# 骨骼动画 + 地图扩展 设计文档

> 第六轮进化。经6位专家圆桌讨论（含2名游戏策划），用户选定优先推进：骨骼动画系统和多地图系统。

## 目标

将角色从"胶囊体滑行"升级为骨骼驱动的人形动画，攻击/格挡/闪避/死亡全动画化；将单一地图扩展为4种战略布局（渡桥/山口/攻城/遭遇），增加纵向战斗和环境多样性。保持零外部资源特性——全部程序化生成，不依赖 Mixamo/GLTF 文件。

## 架构概览

```
main_entry.js
  ├── MapGenerator (新建) → 选择地图 → 生成 Terrain + Environment 布局
  ├── Character (修改) → 内建 Skeleton (新建) → 骨骼驱动身体部件
  └── AIController (修改) → 继承 Character，自动获得骨骼动画
```

两个子系统通过明确的接口与现有代码集成：
- **Skeleton**：Character 内部组件，不直接与外部系统交互
- **MapGenerator**：main_entry.js 在 bootstrap 阶段调用，替代硬编码的 Terrain/Environment 参数

---

## 组件1：骨骼动画系统

### 设计决策

**选择程序化骨骼系统而非 GLTF 加载，原因：**
1. Demo 保持零外部资源依赖——无需下载 Mixamo 模型
2. 现有 Character 已用 CapsuleGeometry 拼接身体部件，可直接绑定到骨骼
3. 程序化关键帧可根据武器类型动态调整（剑砍/枪刺/弓拉/锤砸弧度不同）
4. 无需 AnimationMixer/AnimationClip 序列化，直接在 update() 中插值

### 骨骼层级（14块骨骼）

```
root (Group, 位置+朝向)
  └─ hips (Bone, y=0.85)          — 腰部旋转
      ├─ spine (Bone, y=1.1)      — 上身前倾/侧弯
      │   ├─ chest (Bone, y=1.35) — 胸部扭转
      │   │   ├─ neck (Bone, y=1.9) → head (Bone, y=2.1) + helm + visor
      │   │   ├─ shoulderR (Bone, x=0.5, y=1.65)
      │   │   │   └─ elbowR (Bone, y=-0.35) → handR (Bone, y=-0.35) + weaponPivot
      │   │   └─ shoulderL (Bone, x=-0.5, y=1.65)
      │   │       └─ elbowL (Bone, y=-0.35) → handL (Bone, y=-0.35)
      │   └─ cape (Mesh, 跟随 spine 旋转)
      ├─ upperLegR (Bone, x=0.2, y=0.7)
      │   └─ lowerLegR (Bone, y=-0.4) → footR (Bone, y=-0.2)
      └─ upperLegL (Bone, x=-0.2, y=0.7)
          └─ lowerLegL (Bone, y=-0.4) → footL (Bone, y=-0.2)
```

### 身体部件绑定

现有几何体重新绑定到骨骼（作为骨骼的子对象）：

| 部件 | 几何体 | 绑定骨骼 |
|------|--------|----------|
| 腿×2 | CapsuleGeometry(0.16, 0.7) | upperLegR/L |
| 躯干 | CapsuleGeometry(0.42, 0.95) | chest |
| 腰带 | CylinderGeometry(0.45, 0.45, 0.18) | hips |
| 肩×2 | IcosahedronGeometry(0.28) | shoulderR/L |
| 臂×2 | CapsuleGeometry(0.12, 0.5) | elbowR/L |
| 头 | IcosahedronGeometry(0.3) | head |
| 盔 | ConeGeometry(0.34, 0.5) | head |
| 面甲 | BoxGeometry(0.34, 0.1, 0.1) | head |
| 披风 | PlaneGeometry(0.7, 1.1) + ShaderMaterial | spine |
| 武器pivot | Group + weaponMesh | handR |

### 动画状态机

```
状态流转：
  idle ←→ walk ←→ run
  any → attack1 → attack2 → attack3 → idle  (连击链)
  any → block (hold) → idle
  any → dodge → idle  (i-frame 窗口)
  any → charge → release → attack
  any → hurt → idle  (受击打断)
  any → death (终态, 直到 respawn)
  any → execute → idle  (处决动画, 1.2s)
```

### 关键帧定义

每个状态定义关键骨骼在时间点的旋转角度（欧拉角），用 lerp 插值：

**攻击三连击（剑为例）：**
```
attack1 (横砍, 0.42s):
  t=0.0: { shoulderR: [0, 0, -1.2], elbowR: [0, 0, 0.3], chest: [0, 0.3, 0], hips: [0, -0.2, 0] }
  t=0.3: { shoulderR: [0, 0, 0.8],  elbowR: [0, 0, 0.1], chest: [0, -0.3, 0], hips: [0, 0.2, 0] }  ← 出力点
  t=0.6: { shoulderR: [0, 0, 0.3],  elbowR: [0, 0, 0],   chest: [0, 0, 0],    hips: [0, 0, 0] }
  t=1.0: { shoulderR: [0, 0, 0],    elbowR: [0, 0, 0],   chest: [0, 0, 0],    hips: [0, 0, 0] }  ← 回归

attack2 (纵劈, 0.38s):
  t=0.0: { shoulderR: [-1.5, 0, 0], elbowR: [0.5, 0, 0], chest: [-0.2, 0, 0] }  ← 举高
  t=0.3: { shoulderR: [0.8, 0, 0],  elbowR: [0, 0, 0],   chest: [0.2, 0, 0] }   ← 劈下
  t=1.0: { shoulderR: [0, 0, 0],    elbowR: [0, 0, 0],   chest: [0, 0, 0] }

attack3 (回旋, 0.5s):
  t=0.0: { chest: [0, 1.2, 0], hips: [0, 0.8, 0], shoulderR: [0, 0, -0.5] }
  t=0.4: { chest: [0, -1.2, 0], hips: [0, -0.8, 0], shoulderR: [0, 0, 0.8] }  ← 回旋出力
  t=1.0: { chest: [0, 0, 0], hips: [0, 0, 0], shoulderR: [0, 0, 0] }
```

**弓箭拉弦：**
```
charge (拉弓, hold):
  shoulderR: [0, 0, -0.3], elbowR: [-0.8, 0, 0]  ← 弓臂伸直
  shoulderL: [0, 0, 0.5], elbowL: [-1.2, 0, 0]  ← 拉弦臂后拉
  chest: [-0.15, 0.3, 0]  ← 身体微侧
```

**格挡：**
```
block (hold):
  shoulderR: [-0.5, 0, 0.3], elbowR: [-1.0, 0, 0]  ← 手臂上举
  chest: [-0.1, 0, 0]  ← 微后仰
```

**闪避翻滚：**
```
dodge (0.4s):
  t=0.0: { hips: [0, 0, 0], spine: [0, 0, 0] }
  t=0.3: { hips: [0.4, 0, 0], spine: [0.8, 0, 0] }  ← 前扑蜷缩
  t=0.7: { hips: [-0.3, 0, 0], spine: [-0.5, 0, 0] }  ← 着地缓冲
  t=1.0: { hips: [0, 0, 0], spine: [0, 0, 0] }
```

**死亡：**
```
death (1.0s, 终态):
  t=0.0: 全部归零
  t=0.3: { hips: [1.2, 0, 0], spine: [0.8, 0, 0], knees: [-1.5, 0, 0] }  ← 前扑倒
  t=1.0: { hips: [1.57, 0, 0], 全身松弛 }  ← 趴伏
  root.rotation 随机左/右倾倒 ±0.3
```

### 与现有动画系统集成

现有 Character.update() 已有：
- `_anim` 计时器（从 `_animDur` 递减到 0）
- `t = 1 - _anim / _animDur`（0→1 进度）
- 直接修改 `rLeg.rotation.x`、`torso.rotation.x`

改造方式：
- `_anim` 计时器保留不变
- 新增 `this.skeleton = new Skeleton(this.root)` 在 `_build()` 末尾
- `_updateAnim()` 方法改为调用 `this.skeleton.applyState(state, t, params)` 
- 移动手动 bone rotation 代码，改为 Skeleton 内部处理
- 走路动画：Skeleton 根据移动速度自动计算腿臂摆动

### Skeleton.js 接口

```js
export class Skeleton {
  constructor(rootGroup)
  // 创建骨骼层级，将传入的 mesh 部件绑定到骨骼
  bindParts({ legs, torso, belt, shoulders, arms, head, helm, visor, cape, weaponPivot })

  // 设置当前动画状态
  // state: 'idle'|'walk'|'run'|'attack1'|'attack2'|'attack3'|'block'|'dodge'|'charge'|'hurt'|'death'|'execute'
  // t: 0→1 进度
  // params: { speed, comboStep, weaponClass, yaw, dirX, dirZ }
  applyState(state, t, params)

  // 每帧调用，插值到目标姿态
  update(dt)
}
```

---

## 组件2：多地图系统

### 设计决策

**选择 MapGenerator 多布局系统而非单一大地形，原因：**
1. 4张地图提供战略多样性——渡桥咽喉、山口高低、攻城非对称、遭遇开阔
2. 每张地图有独立地形高度函数和物体分布，玩法体验截然不同
3. M键切换模式时自动加载对应地图，无需额外UI
4. MapGenerator 作为 Terrain + Environment 的工厂，保持现有接口不变

### 4种地图定义

#### 地图1：渡桥战（River Crossing）
```
尺寸: 360 × 200
地形高度:
  - 两岸平地 (z < -15 或 z > 15): h = fbm(x, z) * 2 + 0.5
  - 河床 (z ∈ [-15, 15]): h = -1.5 + sin(x * 0.1) * 0.3 (低于水面)
  - 桥面 (x ∈ [-5, 5], z ∈ [-15, 15]): h = 0.3 (固定桥面高度)
河流: zMin=-15, zMax=15, depth=1.8
物体:
  - 两岸: 树木40棵(散布), 岩石15(岸边), 旗帜×2(两岸高点)
  - 桥头: 木栅栏掩体×4, 补给点×1(桥中央侧)
  - 河中: 露出水面的岩石×3 (可站立的踏脚石)
刷新点:
  - 蓝方: x=-160, z=±40
  - 红方: x=160, z=±40
模式关联: 死斗/据点
```

#### 地图2：山口战（Mountain Pass）
```
尺寸: 280 × 160
地形高度:
  - 左山 (x < -40): h = 12 + fbm(x*0.3, z*0.3) * 4 (陡峭山壁)
  - 右山 (x > 40): h = 12 + fbm(x*0.3, z*0.3) * 4
  - 谷道 (x ∈ [-40, 40]): h = fbm(x, z) * 2 (缓坡谷底)
  - 山壁过渡: x∈[-50,-30]和[30,50]为斜坡
河流: 无 (干枯谷道)
物体:
  - 山顶: 松树×20(仅高处), 瞭望塔×2(两侧山顶)
  - 谷道: 岩石群×30, 灌木丛×15
  - 谷口: 旗帜×2, 木栅栏×4(防御工事)
  - 山壁: 洞穴入口装饰×2(不可进入,纯装饰)
刷新点:
  - 蓝方: x=-120, z=0 (谷道一端)
  - 红方: x=120, z=0 (谷道另一端)
模式关联: 死斗/据点
战略: 高地弓兵射程+视野加成, 低地步兵推进
```

#### 地图3：攻城战（Fortress Siege）
```
尺寸: 320 × 220
地形高度:
  - 外围: h = fbm(x, z) * 1.5 (平缓原野)
  - 城墙基座 (环形, r=35-38): h = 8 (城墙高度)
  - 城内: h = 0.5 (平整地面)
  - 城门通道 (x ∈ [-6, 6], z ∈ [35, 42]): h = 0 (通道)
河流: 无
物体:
  - 城墙: 垛口×40(顶面), 射击孔(侧面纹理)
  - 城门: 厚木门(可破坏, HP=500)
  - 城内: 建筑×3(多房间, CQB), 瞭望塔×1(中央)
  - 城外: 攻城营地(帐篷×6, 补给点×1), 投石车装饰×2
  - 旗帜: 城墙上(守方), 营地(攻方)
刷新点:
  - 蓝方(攻): x=-140, z=0 (营地)
  - 红方(守): x=0, z=0 (城内中央)
模式关联: 攻城
战略: 非对称攻防, 城墙高地优势, 室内近战
```

#### 地图4：遭遇战（Open Field）
```
尺寸: 400 × 240
地形高度:
  - 全图: h = fbm(x*0.5, z*0.5) * 3 (缓坡起伏)
  - 无河流, 无城墙
  - 散布小丘陵: 5处 r=8-12 h=3-5
物体:
  - 散布: 树木×50(稀疏), 岩石群×30(掩体), 灌木丛×20
  - 中央: 废墟残墙×4(低矮掩体, 可翻越)
  - 补给点: ×3(地图1/3点位)
  - 旗帜: ×2(双方后方)
刷新点:
  - 蓝方: x=-180, z=0
  - 红方: x=180, z=0
模式关联: 死斗/据点/波次
战略: 开阔机动, 利用掩体推进, 无咽喉限制
```

### MapGenerator.js 接口

```js
export class MapGenerator {
  static MAPS = {
    bridge:  { name: '渡桥', size: [360, 200], heightFn: ..., layout: ..., modes: ['死斗','据点'] },
    pass:    { name: '山口', size: [280, 160], heightFn: ..., layout: ..., modes: ['死斗','据点'] },
    fortress:{ name: '攻城', size: [320, 220], heightFn: ..., layout: ..., modes: ['攻城'] },
    field:   { name: '遭遇', size: [400, 240], heightFn: ..., layout: ..., modes: ['死斗','据点','波次'] }
  }

  // 生成地图：返回 Terrain + Environment 布局数据
  static generate(mapKey) {
    const def = this.MAPS[mapKey]
    const terrain = new Terrain(def.size[0], def.size[1], def.heightFn)
    const layout = def.layout  // { trees, rocks, flags, supply, buildings, spawns, siege }
    return { terrain, layout, name: def.name }
  }

  // 根据游戏模式推荐地图
  static recommendMap(modeName) {
    for (const [key, def] of Object.entries(this.MAPS)) {
      if (def.modes.includes(modeName)) return key
    }
    return 'field'
  }
}
```

### 与现有系统集成

当前 main_entry.js bootstrap:
```js
const terrain = new Terrain(220, 110);     // 硬编码
scene.add(terrain.mesh);
const env = new Environment(terrain);       // 内部硬编码布局
scene.add(env.group);
```

改造后:
```js
const mapKey = MapGenerator.recommendMap(mode.name);
const { terrain, layout, name } = MapGenerator.generate(mapKey);
scene.add(terrain.mesh);
const env = new Environment(terrain, layout);  // 接受外部布局
scene.add(env.group);
hud.flash('地图：' + name);
```

Terrain 改造：
- 构造函数接受可选 `heightFn` 参数
- 若传入，用 `heightFn(x, z)` 替代内部 `_rawHeight()` 的地形计算
- 河流/台地等特殊地形由 `heightFn` 内部处理

Environment 改造：
- 构造函数接受可选 `layout` 参数
- 若传入，按 `layout.trees/n` 数量及位置生成物体，而非随机散布
- 保留现有程序化生成逻辑作为 fallback

地图切换：
- M键切换模式后，调用 `restartMap()` 重新生成地形和环境
- `restartMap()` 清除旧 terrain/env，调用 MapGenerator.generate，重新添加到场景

---

## 数据流

```
玩家按 M 键
  → main_entry.js: mode 切换 (Deathmatch → Domination → ...)
  → MapGenerator.recommendMap(mode.name) → mapKey
  → restartMap(mapKey)
    → scene.remove(old terrain, old env)
    → MapGenerator.generate(mapKey) → { terrain, layout }
    → scene.add(terrain.mesh)
    → new Environment(terrain, layout) → scene.add(env.group)
    → spawnAll() (使用新地图的刷新点)
  → hud.flash('地图：' + name + ' 模式：' + mode.name)

角色 update() 每帧:
  → Character.update(dt, terrain, combat, ...)
    → 判断动画状态 (idle/walk/run/attack/block/dodge/charge/hurt/death)
    → 计算 t 进度 (0→1)
    → this.skeleton.applyState(state, t, { speed, comboStep, weaponClass })
    → this.skeleton.update(dt)  // 插值到目标姿态
    → 武器跟随 handR 骨骼位置
```

## 错误处理

1. **骨骼绑定失败**：Skeleton.constructor 中若部件缺失，fallback 到现有直接 rotation 方式（打印 warn，不崩溃）
2. **地图生成失败**：MapGenerator.generate 若 heightFn 抛错，fallback 到默认平地地形
3. **地图切换时角色引用旧地形**：restartMap 中先清除角色，再重新 spawnAll
4. **Environment 布局参数缺失**：每个布局字段有默认值，缺失时用随机散布 fallback

## 测试方案

无单元测试框架，以浏览器实测验证：

1. **骨骼动画验证**：
   - navigate → 按 1/2/3/4 切换武器，确认每种武器攻击动画不同（剑横砍/枪直刺/弓拉弦/锤纵劈）
   - 连续左键3次，确认三连击动画连贯无穿模
   - 右键格挡，确认手臂上举
   - Q闪避，确认前扑蜷缩
   - 被击杀，确认死亡倒地动画
   - 控制台无 ReferenceError

2. **地图扩展验证**：
   - 按 M 切换模式，确认每次切换加载不同地图
   - 渡桥战：确认河流+桥面+两岸旗帜
   - 山口战：确认两侧山壁+谷道
   - 攻城战：确认城墙+城门+城内建筑
   - 遭遇战：确认开阔+散布掩体
   - 走到地图边缘确认无掉落
   - 控制台无 TypeError

3. **集成验证**：
   - AI角色也有骨骼动画（attack/walk/idle）
   - 多人模式下 RemotePlayer 动画同步
   - 性能：4个AI+玩家+骨骼动画保持30fps+

## 范围边界

**本次包含：**
- Skeleton 骨骼系统 + 10种动画状态
- MapGenerator 4种地图布局
- Character/AIController/Terrain/Environment/main_entry 集成

**本次不含（留后续轮次）：**
- 武器拖尾 Trail（手感强化，单独轮次）
- 画面震动/受击方向指示（手感强化）
- 持久进度/装备配装（系统策划方向）
- 敌人分级/Boss多阶段（系统策划方向）
- GLTF 高精度模型加载（资源量大，后续可选）
- 布料模拟/贴花系统（技术美术方向）
