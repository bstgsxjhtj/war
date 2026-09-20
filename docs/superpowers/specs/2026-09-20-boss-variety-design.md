# Boss 多样化设计（Boss Variety）

> Round 12 Boss 多样化
> 日期：2026-09-20
> 状态：已确认，待实现计划

## 1. 目标

现有：BossEnemy 2 类型（warlord 300hp / 游侠 220hp），技能相同（charge/roar/summon），main_entry:262 硬编码 `type:'warlord'`。CampaignMode 第5/10 关有 Boss 但未指定类型。
深化：4 Boss 类型（warlord/ranger/mage/behemoth）+ 差异化技能组 + 关卡分配（含 mini-boss 第3/7 关）。

## 2. 4 Boss 类型 + 差异化技能组

| Boss | 类型 | 血量 | 速度 | 技能组 |
|------|------|------|------|--------|
| 战将 warlord | 近战重装 | 300 | 5.5 | charge 冲撞 / roar 怒吼 / summon 召唤（现有） |
| 游侠 ranger | 远程敏捷 | 220 | 6.0 | rapidshot 连射 3 箭 / dodge 闪避突袭 / trap 放置陷阱 |
| 法师 mage | 远程法术 | 180 | 5.0 | fireball 火球直线 / teleport 闪现 / aoe 范围法术 |
| 巨兽 behemoth | 近战巨体 | 400 | 4.5 | slam 震地 AOE / charge 冲撞 / regenerate 血量再生 |

## 3. mini-boss（弱化版，第3/7 关）

| 关 | Boss | 类型 | 血量 | 阶段 | 技能（减一） |
|----|------|------|------|------|--------------|
| 第3关 山口伏击 | ranger mini | 游侠 | 160（70%） | 仅二阶段 | rapidshot + dodge（无 trap） |
| 第7关 雪原生存 | mage mini | 法师 | 130（70%） | 仅二阶段 | fireball + teleport（无 aoe） |

mini-boss 标志 `_isMini=true`：血量 *0.7 + 无三阶段（_phase 最多 2）+ 技能减一（无第三技能）+ scale 1.1（弱于全 Boss 1.35）。

## 4. 关卡分配（STAGES 加 bossType + mini 字段）

| 关 | 现有 | bossType | mini |
|----|------|----------|-----|
| 第3关 山口伏击 | 攻城 | ranger | true |
| 第5关 最终决战 | Boss | warlord | false |
| 第7关 雪原生存 | 生存 | mage | true |
| 第10关 终局之战 | Boss限时 | behemoth | false |

CampaignMode STAGES 加 `bossType` + `mini` 字段。checkWin 用 `ctx.boss`（已有）。onTick bossPhase 触发 enterPhase（mini 仅二阶段）。

## 5. 技能差异化实现

### 5.1 warlord（现有，Round 9）
- `_skillCharge(target, combat, now)` 冲撞 8m + 击退 + 40 伤害
- `_skillRoar(combat, now)` 范围 6m 击退 + 减速
- `_skillSummon()` emit boss.summon（spawn 2 小怪）

### 5.2 ranger
- `_skillRapidshot(target, combat, now)`：连射 3 箭扇形（combat.spawnPierceArrow × 3，角度 ±15°），8s 冷却
- `_skillDodge(target, now)`：闪避位移（远离 target 4m）+ 短暂加速，6s 冷却
- `_skillTrap(combat, now)`：放置陷阱（spawnAoE 延迟 1s 触发，5m 范围），15s 冷却，mini 跳过

### 5.3 mage
- `_skillFireball(target, combat, now)`：火球直线（spawnPierceArrow 火特效，伤害 50），7s 冷却
- `_skillTeleport(target, now)`：闪现到 target 附近 5m（root.position = target.pos - forward*5），10s 冷却
- `_skillAoe(combat, now)`：范围法术（spawnAoE 8m，伤害 35），12s 冷却，mini 跳过

### 5.4 behemoth
- `_skillSlam(combat, now)`：震地 AOE（spawnAoE 8m + 击倒 _knockdownTimer），6s 冷却
- `_skillCharge`：复用 warlord（8m 冲撞 + 40 伤害），10s 冷却
- `_skillRegenerate(dt)`：血量再生（_phase>=2 时每秒 +5hp，封顶 maxHp），被动

## 6. 组件

### 6.1 src/gameplay/BossEnemy.js（修改）
- constructor 加 4 类型分支：
  ```js
  constructor({ team = 1, type = 'warlord', mini = false } = {}) {
    super({ team });
    this._isBoss = true; this._bossType = type; this._isMini = mini;
    this._phase = 1; this._maxHp = ({warlord:300,ranger:220,mage:180,behemoth:400})[type] || 300;
    if (mini) this._maxHp = Math.round(this._maxHp * 0.7);
    this.maxHp = this._maxHp; this.hp = this._maxHp;
    this.speed = ({warlord:5.5,ranger:6.0,mage:5.0,behemoth:4.5})[type] || 5.5;
    this._name = ({warlord:'战将',ranger:'游侠',mage:'法师',behemoth:'巨兽'})[type] || '战将';
    this._skillSet = ({warlord:['charge','roar','summon'],ranger:['rapidshot','dodge','trap'],mage:['fireball','teleport','aoe'],behemoth:['slam','charge','regenerate']})[type];
    if (mini) this._skillSet = this._skillSet.slice(0, 2); // 减一
    // ... 现有 _slamTimer/_aoeRadius/_chargeCd/_roarCd/_summoned + 新 _rapidCd/_dodgeCd/_trapCd/_fireballCd/_teleportCd/_aoeSkillCd/_slamCd/_regenAcc
  }
  ```
- 各类型技能方法（§5）
- update 按 _skillSet + _phase 触发各技能（if _skillSet.includes('charge') && _chargeCd<=0）
- enterPhase：mini 最多 2（`this._phase = Math.min(this._phase, mini ? 2 : 3)` 不，enterPhase(p) 设 _phase=p，但 mini 限 2）
- scale：mini 1.1 / 全 1.35

### 6.2 src/gameplay/CampaignMode.js（修改）
- STAGES 第3/5/7/10 关加 `bossType` + `mini` 字段（第3/7 改 objective 为 'Boss' 或保留现有+bossType）
- spawnLayout/checkWin 兼容 mini-boss（ctx.boss 判定已有）

### 6.3 src/main_entry.js（修改）
- 262 行 `new BossEnemy({ team:1, type: campaign.currentStage.bossType || 'warlord', mini: campaign.currentStage.mini || false })`
- 第3/7 关也 spawn Boss（mini）—— 需改 spawnAll 逻辑：若 stage.bossType 则 spawn BossEnemy（而非普通 AIController）

## 7. 测试

### 7.1 单测 tests/gameplay/BossEnemy.test.js
- 4 类型构造（warlord/ranger/mage/behemoth）：血量/速度/_name/_skillSet 正确
- mini=true：血量 *0.7 + _skillSet 减一 + scale 1.1
- enterPhase：全 Boss 升 3 / mini 限 2
- 各技能方法存在（_skillRapidshot/_skillFireball/_skillSlam 等）

### 7.2 冒烟 e2e/smoke.spec.js
- Boss 关不崩溃（0 error，已有断言覆盖）

## 8. 与现有系统协同

- 成就：击杀各 Boss 类型成就（4 击杀 + mini 2 击杀）
- 词条/皮肤：Boss 掉落
- 关卡：Boss 按关分配（CampaignMode STAGES）
- AI 协作：Boss 呼叫增援（Round 9 AIManager）
- 音效：Boss 技能音效（Round 10 audio）
- BossEnemy enterPhase：CampaignMode.onTick bossPhase 触发

## 9. 边界与错误处理

- bossType 未知默认 warlord
- mini 技能减一（slice(0,2)）
- regenerate 封顶 maxHp（不超
- teleport 不卡墙（简化直接闪现，地形后续）
- trap 延迟触发（spawnAoE now+1s，简化用 setTimeout 或 _trapTimer）

## 10. 不做的事（YAGNI）

- 不做 Boss 多阶段切换模型（仅属性/技能差异）
- 不做 Boss 专属 BGM
- 不做 Boss 过场动画
- 不做 Boss 难度叠加（用 AI 难度系数）
- 不做 Boss 专属掉落表（通用词条掉落）
