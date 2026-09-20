# 敌人 AI 增强设计（Enemy AI Enhancement）

> Round 9 敌人 AI 增强
> 日期：2026-09-20
> 状态：已确认，待实现计划

## 1. 目标

现有 AI：状态机（patrol/retreat/attack/chase）+ 集火（血量最低）+ 撤退（低血量）+ 包抄（侧翼）+ 反应延迟 + 巡逻。BossEnemy 三阶段（血量 0.6/0.3）+ AOE slam。
增强：协作（呼叫增援/集火信号/小队）+ 敌方技能（Boss 技能/精英）+ 闪避格挡反应 + 难度分级，提升群体智能与博弈感。

## 2. AI 协作增强（群体智能）

### 2.1 呼叫增援（callReinforce）
- 触发：AI health.ratio < 0.4 或发现玩家（首次进入 attack）
- 事件：`bus.emit('ai.callReinforce', { pos, team })`
- 响应：附近 AI（距 < 30）_reinforceTarget 设为呼叫点，转 chase 趋近
- 冷却：每 AI 60s 一次（_callReinforceCd）

### 2.2 集火信号（spotPlayer）
- 触发：AI 发现玩家（dist < engageRange）首次
- 事件：`bus.emit('ai.spotPlayer', { target, team })`
- 响应：附近 AI（距 < 25）_focusTarget 设为 target
- 冷却：每 AI 15s 一次

### 2.3 小队战术（squad）
- AIManager 分配小队：每 3 AI 一组，_squadId
- 小队分工：1 主攻（近战冲锋）/1 包抄（侧翼）/1 远程（弓兵压制）
- 分工由 _squadRole 字段（'assault'/'flank'/'ranged'）影响 _calcFlankDir/移动

## 3. 敌方技能（个体深度）

### 3.1 Boss 技能（BossEnemy 二阶段）
| 技能 | 触发 | 效果 |
|------|------|------|
| 冲撞 charge | _phase>=2, 8s 冷却 | 直线突进 8m，命中击退 + 伤害 |
| 怒吼 roar | _phase>=2, 12s 冷却 | 范围 6m 击退 + 短暂减速 |
| 召唤 summon | _phase>=3, 一次 | spawn 2 小怪（AIController 弱化） |

BossEnemy 加 `enterPhase(p)` 方法（CampaignMode.onTick 调用，补现有缺失）。

### 3.2 精英敌人（AIController 精英）
- spawn 时 15% 概率 _isElite=true（main_entry spawn 时设）
- 精英技能（随机 1 种）：
  - 格挡反击 blockCounter：受击 30% 概率格挡（减伤 70%）+ 反击
  - 闪避突袭 dodgeStrike：玩家攻击 windup 内 40% 概率闪避 + 突袭
  - 狂暴 enrage：血量 < 50% 时攻速 +50%（_swordReactTimer * 0.5）
- 精英视觉：root.scale * 1.15 + 红色标记

## 4. AI 闪避/格挡反应（博弈感）

### 4.1 闪避（dodge）
- 检测：玩家攻击 windup（weapon.windup 期内，dist < engageRange）
- 概率：dodgeChance（难度参数）
- 效果：_dodgeTimer 0.3s，向后位移 4m（_vDodge = player.position 反方向 * 4）
- 冷却：_dodgeCd 2s

### 4.2 格挡（block）
- 检测：玩家攻击命中前（windup 内，持盾 SHIELD 类）
- 概率：blockChance（难度参数）
- 效果：_blockTimer 0.4s，受击减伤 70%（Character.takeDamage 内 if _blockTimer>0 *0.3）
- 冷却：_blockCd 3s

### 4.3 反击（counter）
- 格挡成功后 50% 概率反击：_counterTimer 0.3s 窗口，tryAttack

## 5. AI 难度分级

| 难度 | reactTime | dodgeChance | blockChance | maxHpMul | callReinforceCd |
|------|-----------|-------------|-------------|----------|------------------|
| easy | 0.5s | 0.10 | 0.10 | 0.8 | 90s |
| normal | 0.3s | 0.20 | 0.20 | 1.0 | 60s |
| hard | 0.15s | 0.35 | 0.30 | 1.2 | 45s |

main_entry 常量 `const AI_DIFFICULTY = 'normal'`（本轮常量，设置面板后续）。

## 6. 数据流

```
AI update → 检测玩家 weapon.windup → 概率闪避/格挡（_dodgeTimer/_blockTimer）
AI health<0.4 或发现玩家 → bus ai.callReinforce/ai.spotPlayer → AIManager 广播 → 附近 AI 响应
Boss _phase>=2 → skill(charge/roar/summon) → CombatSystem 范围伤害/spawn 小怪
精英 AI → 精英技能（blockCounter/dodgeStrike/enrage）
AIManager → 分配小队 _squadId/_squadRole → 影响包抄/移动
```

## 7. 组件

### 7.1 src/gameplay/AIManager.js（新增）
```js
export const DIFFICULTY = {
  easy: { reactTime: 0.5, dodgeChance: 0.10, blockChance: 0.10, maxHpMul: 0.8, callReinforceCd: 90 },
  normal: { reactTime: 0.3, dodgeChance: 0.20, blockChance: 0.20, maxHpMul: 1.0, callReinforceCd: 60 },
  hard: { reactTime: 0.15, dodgeChance: 0.35, blockChance: 0.30, maxHpMul: 1.2, callReinforceCd: 45 },
};

export class AIManager {
  constructor(bus) {
    this.bus = bus;
    this._difficulty = DIFFICULTY.normal;
    this._squads = new Map();
    this._lastReinforce = new Map();
    this._lastSpot = new Map();
    this._bind();
  }
  setDifficulty(d) { this._difficulty = DIFFICULTY[d] || DIFFICULTY.normal; }
  difficulty() { return this._difficulty; }
  assignSquad(ais) { /* 每 3 AI 一组，分配 _squadId + _squadRole */
  _bind() {
    this.bus.on('ai.callReinforce', ({ pos, team, id }) => { /* 广播附近 AI */ });
    this.bus.on('ai.spotPlayer', ({ target, team, id }) => { /* 广播附近 AI */ });
  }
}
```

### 7.2 src/gameplay/AIController.js（修改）
- constructor 加 `_dodgeTimer=0; _blockTimer=0; _dodgeCd=0; _blockCd=0; _callReinforceCd=0; _spotCd=0; _isElite=false; _squadId=null; _squadRole=null; _aiManager=null;`
- setAIManager(m) 方法
- update 加：检测玩家 windup → 闪避/格挡；health<0.4 呼叫增援；发现玩家集火信号
- takeDamage 加：if _blockTimer>0 damage*0.3 + 格挡反击
- _calcFlankDir 受 _squadRole 影响（ranged 保持距离）

### 7.3 src/gameplay/BossEnemy.js（修改）
- 加 `enterPhase(p) { this._phase = Math.max(this._phase, p); }` 方法（补现有缺失，CampaignMode.onTick 调用）
- 二阶段加 skill 方法：`_skillCharge(target, now)` / `_skillRoar(now)` / `_skillSummon(scene, combat, now)`
- update 内按 _phase + 冷却触发技能

### 7.4 src/main_entry.js（修改）
- 实例化 `const aiManager = new AIManager(bus);`
- spawnAll 内：ai.setAIManager(aiManager) + aiManager.assignSquad(ais) + 精英概率 ai._isElite = Math.random() < 0.15
- AIController 构造 maxHp 用 `90 * aiManager.difficulty().maxHpMul`
- 常量 `const AI_DIFFICULTY = 'normal'; aiManager.setDifficulty(AI_DIFFICULTY);`

## 8. 测试

### 8.1 单测 tests/gameplay/AIManager.test.js
- setDifficulty 参数
- assignSquad 分配（3 AI 一组 + role）
- callReinforce 广播（mock bus.emit + 附近 AI 响应）
- spotPlayer 广播

### 8.2 单测 tests/gameplay/AIController 闪避格挡（可选，若 mock 简单）
- dodge 概率（mock windup + Math.random）
- block 减伤

### 8.3 冒烟 e2e/smoke.spec.js
- AI 行为不崩溃（0 error，已有断言覆盖）

## 9. 与现有系统协同

- 连击系统：AI 闪避/格挡提升玩家连击维持难度（中断风险）
- 装备词条/成就：精英/Boss 击杀成就 + 掉落
- 关卡事件：增援事件（campaign.onTick spawnReinforce）+ AI 呼叫增援协同（双重增援来源，不冲突）
- 武器主动技：AI 闪避增加技能命中难度
- BossEnemy _phase：enterPhase 补齐后，CampaignMode.onTick bossPhase 事件真正生效

## 10. 边界与错误处理

- AIManager 可为 null（注入前），AIController 用 `this._aiManager?.difficulty()`
- 闪避/格挡概率 0-1，无词条影响（AI 无词条）
- 小队分配：AI 少于 3 也分配（1-2 AI 一组）
- Boss 技能冷却不重置（Boss 死即止）
- 精英概率 15%，spawn 时定
- 呼叫增援/集火信号冷却防止刷屏

## 11. 不做的事（YAGNI）

- 不做 AI 行为树重构（现有状态机 + 协作/反应够用）
- 不做 AI 学习/自适应（固定难度参数）
- 不做 AI 语音/聊天（无音效系统）
- 不做 AI 多武器切换（现有单武器够用）
- 不做 AI 连击（AI 不连击，仅玩家连击）
- 不做 AI 寻路（现有直线 + 地形高度够用）
