# 连击系统设计（ComboSystem）

> Round 8 内容深化 · 玩法机制深化 · 第一个子项目
> 日期：2026-09-18
> 状态：已确认，待实现计划

## 1. 目标

为战斗增加操作纵深与重玩动机：连续命中累积连击数，触发伤害加成 / 视觉特效 / 连击终结爆发。与现有克制矩阵、近战硬直、天气系统协同，让战斗从"能跑"到"手感对"。

## 2. 核心机制

### 2.1 累积
- 每次成功命中 +1
- 克制命中（`CombatSystem._counterMul > 1.2`）+2
- 完美格挡反击 +3

### 2.2 中断
- 受击掉血 → 立即归零
- 3s 未命中 → 线性衰减（每秒 -2，到 0 为止）

### 2.3 层级与奖励

| 连击数 | tier | 伤害倍率 | 视觉反馈 |
|--------|------|---------|---------|
| 0-4 | 0 | ×1.0 | 白 |
| 5-9 | 1 | ×1.1 | 白→金过渡 |
| 10-19 | 2 | ×1.2 + 命中金火花特效 | 金 |
| 20+ | 3 | ×1.3 + 连击终结 buff | 红 |

**连击终结 buff**：tier 升到 3 的那次命中设 `_finisher=true`（标记下次爆发）；下次命中伤害额外 ×1.5（单次爆发），消耗后 `_finisher=false`。连击数不归零。掉出 tier 3 再升回时重新触发一次。

## 3. 数据流

```
CombatSystem.hit（成功命中）
  → combo.onHit(countered, perfect)  返回本次 damageMul
  → CombatSystem 将 damageMul 乘入伤害
  → if tier 变化: bus.emit('combo.tier', { tier, count })
  → if 升 tier3: bus.emit('combo.finisher')  (UI 可提示"终结就绪")

Character.onHurt（掉血）
  → combo.onHurt()
  → combo 归零
  → bus.emit('combo.break', { count })

Time.tick onFixed
  → combo.update(dt, now)
  → 衰减: 若 now - lastHit > 3s, count -= 2*(dt) / 1  (每秒 -2)
  → if count <= 0: count=0, bus.emit('combo.break')
```

## 4. 组件

### 4.1 src/gameplay/ComboSystem.js（新增，独立可测）

```js
export class ComboSystem {
  constructor(bus) {
    this._bus = bus;
    this.count = 0;
    this._lastHit = 0;       // performance.now() / 1000
    this._tier = 0;
    this._finisher = false;
    this._decayDelay = 3;   // 3s 未命中开始衰减
    this._decayRate = 2;    // 每秒 -2
    this._tiers = [          // [minCount, mul]
      [0, 1.0], [5, 1.1], [10, 1.2], [20, 1.3]
    ];
  }

  onHit(countered, perfect, now) {
    const oldTier = this._tier;
    this.count += countered ? 2 : (perfect ? 3 : 1);
    this._lastHit = now;
    this._updateTier();
    let mul = this._tiers[this._tier][1];
    if (this._finisher) { mul *= 1.5; this._finisher = false; }   // 上次设的爆发本次消耗
    if (oldTier < 3 && this._tier >= 3) {
      this._finisher = true;                                    // 升 tier3 设下次爆发
      this._bus?.emit('combo.finisher');
    }
    if (this._tier !== oldTier) this._bus?.emit('combo.tier', { tier: this._tier, count: this.count });
    return mul;
  }

  onHurt() {
    if (this.count > 0) {
      this.count = 0;
      this._tier = 0;
      this._finisher = false;
      this._bus?.emit('combo.break', { count: 0 });
    }
  }

  update(dt, now) {
    if (this.count <= 0) return;
    if (now - this._lastHit > this._decayDelay) {
      this.count -= this._decayRate * dt;
      if (this.count <= 0) {
        this.count = 0;
        this._tier = 0;
        this._finisher = false;
        this._bus?.emit('combo.break', { count: 0 });
      } else {
        this._updateTier();
      }
    }
  }

  _updateTier() {
    let t = 0;
    for (let i = 0; i < this._tiers.length; i++) if (this.count >= this._tiers[i][0]) t = i;
    this._tier = t;
  }

  get tier() { return this._tier; }
  get damageMul() { return this._tiers[this._tier][1]; }  // 当前层级基础倍率（不含 finisher，测试用）
  get hasFinisher() { return this._finisher; }
}
```

### 4.2 CombatSystem 集成
- `hit(...)` 成功命中时：调 `this._combo.onHit(countered, perfect, now)` 取回 `mul`，乘入最终伤害
- 构造接收 `combo` 参数（main_entry 传入）

### 4.3 Character / AIController 集成
- combo 由 main_entry 传给 Player（构造参数或 `setCombo(combo)`），Character 层持有 `this._combo`（Player 继承 Character 或委托）
- `Character.onHurt`（掉血路径）调 `this._combo?.onHurt()`（仅玩家实例有 combo，AI 的 `_combo` 为 null）

### 4.4 HUD 集成
- 新增连击数显示（屏幕右侧大字 + tier 色：白/金/红）
- 监听 `combo.tier` / `combo.break` 更新；衰减时数字闪烁（update 内根据 count 衰减态）

### 4.5 main_entry 集成
- 实例化 `const combo = new ComboSystem(bus);`
- 传 `combo` 给 `new CombatSystem(scene, bus, combo)`
- 传 `combo` 给 `new Player(camera, bus, combo)`（Player 内传 Character 或持有）
- 主循环 onFixed 内 `combo.update(dt, now)`

## 5. 测试

### 5.1 单元测试 tests/gameplay/ComboSystem.test.js
- `onHit` 普通命中 +1、克制 +2、完美反击 +3
- `tier` 阈值跳变（5→1, 10→2, 20→3）
- `damageMul` 各层级倍率
- `onHurt` 归零 + combo.break 事件
- `update` 衰减：3s 内不衰减、3s 后线性衰减、衰减到 0 归零 + break
- `finisher`：升 tier3 设 hasFinisher、下次命中 mul×1.5 + 消耗
- 掉 tier3 再升回重新触发 finisher

### 5.2 冒烟 e2e/smoke.spec.js 增断言
- 连击 UI 元素 `#combo` 存在
- 派发攻击命中后 `#combo` 文本变化

## 6. 与现有系统协同

- **克制矩阵**：克制命中 +2 连击（奖励正确武器选择）
- **近战硬直**：高连击需控硬直，硬直期间无法命中→连击中断风险
- **天气**：雨天弓术降精度→远程连击维持更难
- **皮肤/成就**（预留）：高连击解锁皮肤、连击里程碑成就

## 7. 边界与错误处理

- `combo` 可为 null（AI 无 combo），CombatSystem/Character 调用处用 `?.` 或 `if (this._combo)`
- `onHit` 的 `now` 参数缺省用 `performance.now()/1000`
- 衰减只在 PLAYING 状态主循环推进（update 由 onFixed 调，暂停时不调）
- 连击数上限不设硬顶（tier3 后继续涨只维持，不额外奖励，避免数值膨胀）

## 8. 不做的事（YAGNI）

- 不做连击技能树（连击只给伤害/特效，不解锁新技能）
- 不做多人连击（AI 无 combo）
- 不做连击排行榜（成就系统预留，本轮不做）
- 不重写 CombatSystem 伤害计算（只在最终伤害乘 damageMul）
