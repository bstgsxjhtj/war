# 关卡设计深化（Campaign Depth）

> Round 8 内容深化 · 关卡设计深化
> 日期：2026-09-20
> 状态：已确认，待实现计划

## 1. 目标

现有关卡：5 关（渡桥/山口/攻城/风雪/决战），目标全灭/攻城/Boss，spawnLayout 环形，无事件。
深化：扩 10 关 2 章节 + 6 目标类型 + 关卡事件系统 + 4 spawn 布局 + 难度曲线，增加关卡多样性与战术深度。

## 2. 关卡扩展（5→10 关，2 章节）

### 第一章（调整现有 5 关）
| # | 名称 | 地图 | 目标 | 敌数 | 天气 | 布局 | 事件 | 难度 |
|---|------|------|------|------|------|------|------|------|
| 1 | 渡桥遭遇 | bridge | 全灭 | 3 | clear | 环形 | - | 1.0 |
| 2 | 山口伏击 | pass | 全灭 | 4 | rain | 伏击 | - | 1.15 |
| 3 | 攻城战 | fortress | 攻破城门 | 5 | clear | 方阵 | - | 1.3 |
| 4 | 风雪遭遇 | field | 全灭 | 6 | snow | 线阵 | 增援0.5 | 1.45 |
| 5 | 最终决战 | field | Boss | 8 | storm | 环形 | Boss阶段0.5 | 1.6 |

### 第二章（5 新关）
| # | 名称 | 地图 | 目标 | 敌数 | 天气 | 布局 | 事件 | 难度 |
|---|------|------|------|------|------|------|------|------|
| 6 | 密林伏击 | forest | 全灭 | 7 | clear | 伏击 | 增援0.4 | 1.75 |
| 7 | 河谷护送 | river | 护送 | 6 | rain | 线阵 | 天气变化0.5→storm | 1.9 |
| 8 | 雪原生存 | snowfield | 生存 | 5波 | snow | 方阵 | 增援0.3/波 | 2.05 |
| 9 | 要塞防御 | keep | 防御 | 8 | clear | 环形 | 增援0.5 | 2.2 |
| 10 | 终局之战 | keep | Boss限时 | 10 | storm | 环形 | Boss阶段0.5+增援0.3 | 2.4 |

## 3. 目标类型（objective）

| objective | 胜利条件 | 实现 |
|-----------|----------|------|
| 全灭 | redAlive=0 | 现有 |
| 攻破城门 | siegeGate.broken | 现有 |
| Boss | Boss 二阶段血量 0 | Boss 二阶段 + checkWin |
| 护送 | escortTarget 距 goal < 5 且存活 | EscortTarget 实体 + checkWin |
| 防御 | defenseTimer 到 0 且 blueAlive | 计时器 + checkWin |
| 生存 | surviveWaves 波次全清且 blueAlive | WaveMode 集成 + checkWin |
| 限时 | timeLimit 内 redAlive=0 | 计时器 + checkWin |

每关 STAGES 加 `objective` 字段，CampaignMode.checkWin 按 objective 分支判断。

## 4. 关卡事件系统

### 4.1 增援（reinforce）
- 字段 `events: { reinforce: 0.5 }`（击杀比例达 0.5 触发）
- onTick：`if (killedCount / enemyCount >= reinforce && !reinforced) { spawn 增援; reinforced=true; }`
- 增援数 = 原敌数 * 0.3

### 4.2 Boss 阶段（bossPhase）
- 字段 `events: { bossPhase: 0.5 }`（Boss 血量 50% 触发）
- onTick：Boss alive 且 health.cur/maxHp <= 0.5 且 phase<2 → phase=2（BossEnemy 已有 _phase，加 AOE + 召唤 2 小怪）

### 4.3 天气变化（weatherShift）
- 字段 `events: { weatherShift: { at: 0.5, to: 'storm' } }`（关卡进度 0.5 触发）
- onTick：进度（击杀/敌数 或 计时/总时）>= at → weather.setMode(to)

## 5. spawnLayout 多样化

| 布局 | 实现 |
|------|------|
| 环形 | 现有（圆周分布，半径 180*0.8） |
| 线阵 | 红方排成横线（x=180, z=spread*i） |
| 方阵 | 红方方阵（grid 3×3 或 4×2） |
| 伏击点 | 红方藏地形后（z 偏移 + 散布 + 随机 angle） |

每关 STAGES 加 `layout` 字段，CampaignMode.spawnLayout 按 layout 分支。

## 6. 难度曲线

- 敌人 maxHp `= baseHp * difficulty`（difficulty 见关卡表）
- 敌人武器：stage 3+ 用 Spear/Warhammer（SpearWielder/WarhammerWielder）
- 现有 AIController.maxHp 由 spawnAll 设（main_entry 调 spawnAll 传 maxHp 倍率）

## 7. 组件

### 7.1 src/gameplay/CampaignMode.js（修改）
- STAGES 扩 10 关（每关字段：mapKey/objective/enemyCount/weather/layout/events/difficulty/weapons）
- spawnLayout()：按 stage.layout 分支（环形/线阵/方阵/伏击）
- checkWin(blueAlive, redAlive, siegeGate, ctx)：按 objective 分支（全灭/攻城/Boss/护送/防御/生存/限时）
- onTick(dt, ctx)：事件触发（增援/Boss 阶段/天气变化）
- currentStage.info → stageInfo（main_entry hud.setMode 用）
- 新增 escortGoal/defenseTimer/surviveWaves/timeLimit 字段（按 objective 初始化）

### 7.2 src/world/MapGenerator.js（修改）
- MAPS 加 forest/river/snowfield/keep 4 地图（heightFn/waterFn/river/layout/spawns）
  - forest：密林（多树，平坦）
  - river：河谷（河流 + 桥）
  - snowfield：雪原（积雪，开阔）
  - keep：要塞（城墙，塔楼）

### 7.3 src/gameplay/EscortTarget.js（新增，简化）
- position（THREE.Vector3）+ health + goal（THREE.Vector3）
- 跟随玩家（距玩家 5m 内跟随，否则停）+ 到达 goal 判胜
- takeDamage（被敌方攻击）

### 7.4 src/gameplay/DefensePoint.js（新增，简化）
- position + radius + health
- 驻守点（蓝方需在半径内，否则失败？简化为：计时器到 0 且 blueAlive 即胜，不强制驻守）

### 7.5 src/main_entry.js（修改）
- checkWin 战役分支：传 ctx（escortTarget/defenseTimer/surviveWaves/timeLimit + boss）给 campaign.checkWin
- onTick：campaign.onTick(dt, ctx)（增援/Boss 阶段/天气变化触发）
- 护送/防御模式：spawnAll spawn escortTarget/defensePoint
- 生存模式：spawnAll 用 WaveMode 波次
- C 键：显示 10 关（campaign.stage 0-9）

## 8. 测试

### 8.1 单测 tests/gameplay/CampaignMode.test.js
- STAGES 10 项
- spawnLayout 4 布局（环形/线阵/方阵/伏击）位置正确
- checkWin 各 objective 分支（全灭/攻城/Boss/护送/防御/生存/限时）
- onTick 事件触发（增援/Boss 阶段/天气变化）
- onStageClear 10 关循环 + campaign_complete
- 难度 difficulty 应用

### 8.2 冒烟 e2e/smoke.spec.js
- C 键显示"战役：第1关"
- M 键切到战役模式 + #modeName 含"战役"

## 9. 与现有系统协同

- BossEnemy：Boss 阶段二阶段（_phase 机制已有，加召唤小怪）
- WaveMode：生存模式集成（surviveWaves）
- WeatherSystem：天气 + 天气变化事件
- 成就系统：campaign.clear/campaign.perfect 事件（战役通关/无伤）
- 地图：MapGenerator 4 新地图

## 10. 边界与错误处理

- campaign.stage 0-9（10 关），onStageClear 到 10 → campaign_complete
- 护送：escortTarget 死亡 → 失败（red 胜）
- 防御：defenseTimer > 0 且 blueAlive → 继续；到 0 → blue 胜
- 生存：surviveWaves 波次 + blueAlive
- 限时：timeLimit 内全灭 → blue 胜；超时 → red 胜
- onTick 事件只触发一次（reinforced/phaseShifted/weatherShifted 标志）

## 11. 不做的事（YAGNI）

- 不做关卡编辑器（固定 10 关）
- 不做随机生成关卡（固定设计）
- 不做多分支剧情（线性 10 关）
- 不做环境 Hazard（陷阱/可破坏物）
- 不做护送 NPC 复杂 AI（简化跟随）
- 不做防御点强制驻守（简化计时）
