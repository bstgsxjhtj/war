# 03 · 业务架构（领域模型）

## 1. 核心领域模型

玩家（Player/Character）携带多把武器（Weapon，含 2 个词条槽），在游戏模式中与 AI 敌人（普通/精英/Boss/骑兵）战斗。CombatSystem 结算伤害、克制矩阵与连击；Health 管理生死；击杀经 EventBus 广播。战斗产出驱动四条元进度线：Progression（积分/军衔/解锁）、SkillTree（技能点→技能/武器等级）、Achievements（事件计数→奖励）、DailyChallenge（每日任务→积分）。SaveManager（savegame_v1）为游戏进度唯一事实来源，各领域模块通过 serialize/restore 由 SaveOrchestrator 统一采集与恢复（不再自写 localStorage）；GameState 状态机驱动回合与关卡推进。

## 2. 战斗管线

```
输入 → Player → CombatSystem.resolveMelee / 箭矢 / spawnAoE
     → 克制矩阵 + 词条效果 + 连击加成
     → Character.takeDamage（格挡/完美闪避判定）
     → bus.emit('combat.hit'|'combat.kill', ...)
     → Progression / Achievements / DailyChallenge / HUD 各自消费
```

词条效果必须在**所有伤害路径**（近战/箭矢/AOE）一致生效。

**近战倍率上限钳制**（P2-1，2026-09-28）：乘算堆叠（_perfectBuff×1.5 / skill.totalMul / _runDmgMul / killstreak / branchDamageMul / branchCrit×2 / counterMul / 背刺×2 / comboMul / 词条锋锐 / 暴怒暴击×2）无上限曾催生秒杀最优解。`resolveMelee` 在 `_affixApply` 后对最终伤害 `Math.min(dmg, weapon.damage * COMBAT.DMG_MUL_MAX)`（=6× 武器基础伤害）钳制后再传入 `takeDamage`。仅作用于近战结算（箭矢/AOE/大招保留各自平衡，不共用此钳制）；数值收敛 `balance.js COMBAT.DMG_MUL_MAX = 6.0`。

**Boss AOE 预警 + 延迟结算**（P1-1，2026-09-28）：`CombatSystem.spawnAoE(origin, radius, damage, attacker, now, delay=0)`——`delay>0` 时先在地面投放单位环预警（按 radius 缩放，脉冲透明度），推入 `_pendingStrikes` 队列，由 `update(dt)` 递减 delay，到期调 `_resolveAoE` 结算（仍走词条加伤/吸血/克制链）；`delay=0` 立即结算（向后兼容，玩家大招/连击 AOE 仍即时）。Boss 全部 AOE 技能（quake 三段 0.4/0.7/1.0s、meteor 0.6s、slam 0.3s、aoe 0.35s）均带 delay，移除 quake 原裸 setTimeout（不再脱离 timeScale/clear）。玩家获得可闪避窗口。

**AI 闪避 i 帧**（P0-2，2026-09-28）：AIController.takeDamage 顶部 `if (this._dodgeTimer > 0) return 0;`——闪避期间完全免伤并跳过格挡/反击/ironhide/reflect 全链，与玩家 `_dodgeIFrame` 对称（AI 不复用 `_dodgeIFrame` 以免触发玩家专属的完美闪避逻辑）。

**噩梦敌人词条**（P0-1，2026-09-28）：`currentStage.enemyMods`（reflect/vampire/lucky/swift/ironhide）由 Spawner._applyEnemyMods 注入非 Boss 敌人（AIController.setEnemyMods），行为分挂战斗管线两侧：
- 受击侧（AIController.takeDamage）：ironhide 受伤 ×0.75；reflect 反弹 10% 给攻击者（_reflecting 守卫防双方递归）。
- 攻击侧（CombatSystem._affixApply/_affixLeech）：lucky 暴击 +15%（×2）；vampire 吸血 15%；swift 由 Spawner 直接 speed ×1.2。
- Boss 不注入（阶段机制独立）；数值收敛 balance.js ENEMY_MODS。

## 3. 战役模式规则

- STAGES 数组定义每关 objective、敌人配置、Boss 关须有 `bossType`。
- objective 类型与 checkWin 的对应（P2-4 审计确认：7 种变奏已全部实现且有测试覆盖）：全灭→redAlive=0；攻破城门→siegeGate.broken；Boss→ctx.boss 死亡；护送→目标存活到达终点；生存→surviveWavesDone（surviveTimer 倒计时 90s，main_entry 推进）；防御→defenseTimer≤0（60s 倒计时）；Boss限时→boss 死亡或 timeLimit≤0（120s）。
- `onStageClear()` 推进 stage；通关后 stage 回 0（配合 cleared 记录历史最高）。
- main_entry 的 checkWin 直接调用 `campaign.onStageClear()`（CampaignMode 不发事件）。
- **噩梦战役**：`CampaignMode(bus, nightmare=true)`，难度 ×1.35、敌数 +2，name 保持 '战役'（复用全部战役分支逻辑），displayName 为 '噩梦战役'；战役通关后 M 键循环解锁。每关生成 `enemyMods`（2 条词条注入非 Boss 敌人，见 §2）与 `hazardBoost`（>1，由 EnvironmentHazards.setHazardBoost 放大水/墙/毒/闪电/油料伤害；main_entry spawnRed 包装器按 currentStage.hazardBoost 注入，非噩梦回退 1）。

## 3.1 本轮玩法增强（2026-09-23 P0-P3）

- **大招（怒气）**：受击 +5 / 完美格挡/闪避 +15 / 命中 +3，满 100 后 T 键释放（Character.tryUltimate），COMBAT_ULTIMATE 事件。
- **连击护盾**：受击连击数减半而非清零（ComboSystem.onHurt）。
- **克制可视化**：克制伤害数字青色 (#66ddff) + counter 音效（COMBAT_COUNTER）。
- **天气预告**：非战役模式每 30-60s 随机换天气，HUD `#wforecast` 倒计时显示（WeatherSystem.scheduleNext）。
- **环境杀**：EnvironmentHazards——深水 40 DPS、城墙碰撞 15 DPS、雷暴落雷半径 6 内 50 伤害、毒沼 25 DPS（field/forest）、油渍雷击引燃 80 爆发（bridge/river，引燃后消耗）。
- **无尽模式**：WaveMode(bus, true)，敌人增长更快（上限 12），历史最高波数存 wave_best。
- **投石机争夺**：靠近自动占领/夺占（SiegeStructure.tryOccupy），占领后轰击最近敌方。
- **动态难度辅助**：DifficultyAssist——连续 2 次死亡降一档（easy 为下限），获胜逐步恢复，HUD 提示。

## 3.2 第二轮玩法增强（2026-09-24 P0-P3）

- **完美格挡/大招表现强化**：完美格挡触发 HitStop 顿帧（timeScale 0.3，持续 0.15s）+ FOV 收紧 50 + 震屏；大招触发 FOV 收紧 45。
- **无尽波次修饰词**：每 3 波随机激活修饰（狂暴/坚韧/蜂拥/精锐/暗夜），HUD 预告下一修饰；Spawner 应用 hpMul/speedMul/eliteChanceMul。
- **无尽里程碑奖励**：每 5 波发放积分奖励（wave×10），破纪录额外 wave×15。
- **AI争夺投石机**：AIController.setSiegeTarget 注入巡逻分支，敌人主动前往投石机占领。
- **死因统计扩展**：MatchController 追踪 deathCauses/deathCount/counterDeaths，结算屏展示 top3 死因 + 被克制致死占比。
- **词条协同一期**：Affixes.SYNERGIES（狂战=锋锐+暴怒→伤害+15%、不灭=吸血+坚韧→吸血+10%、幸运一击=迅捷+幸运→暴击+10%），CombatSystem._affixApply/_affixLeech 应用协同加成。
- **环境杀地图扩散**：毒沼（field/forest，25 DPS）和油渍（bridge/river，雷击引燃 80 爆发，引燃后消耗）扩散到多张地图。
- **每日挑战×新模式**：DailyChallenge 新增 endlessWave/nightmareWin/nightmareKills 模式专属挑战，_regenerate 保证每日至少 1 个模式专属挑战。
- **噩梦专属奖励**：通关噩梦战役解锁 nightmare_clear 成就，奖励传说皮肤（forceUnlock 免分解锁）+ 三级幸运词条 + 3 技能点。
- **正反馈音效**（P2-3，2026-09-28）：AudioEngine 新增 4 个 WebAudio 合成音效——pickup（880→1320Hz triangle 双音上行，词条掉落）、levelup（C 大调琶音 523/659/784/1047 triangle，技能点+1）、buffSelect（660Hz sine 确认音，选 buff）、stageStart（330/440/660 sawtooth 三音上行，关卡开始）。接线点：MatchController.combat.kill 内 levelup/pickup、MatchController.startRound 内 stageStart、UpgradePicker 点击 buffSelect。kill/ultimate 音效仍由 main_entry 进度处理器单一播放（不重复）。
- **游戏时钟延迟设施**（P2-5，2026-09-28）：`app/GameClock` 提供 `schedule(delay, fn)` → 返回取消函数；`update(dt)` 以 `dt*timeScale` 递减剩余时间，到期触发；`clear()` 清空全部待执行。main_entry 游戏循环每帧 `gameClock.update(ldt)`（ldt 已含 hitStop.timeScale 缩放），spawnAll 时 `gameClock.clear()`。Boss quake 已使用 spawnAoE 的 _pendingStrikes 机制（dt 倒计时，自带 timeScale 缩放），无需额外迁移。
- **箭矢对象池 + LOD tick 降频**（P2-6，2026-09-29）：CombatSystem `spawnArrow`/`spawnPierceArrow` 改用 `_acquireArrow()` 从池（上限 64）复用 `{mesh, pos, vel}` 对象，`_releaseArrow()` 回收入池，消除每发箭的 Mesh/Vector3 分配；复用时按箭型重置 `pierce`/`hitSet`，避免穿透命中集合残留。LODManager `tick(dt)` 内部累积 dt 到 `_accumDt`，未达 0.25s 直接返回，达阈值才执行一次全量距离/降级/proxy 写入；无参 `tick()` 跳过节流（向后兼容现有测试与一次性调用）。

## 4. 成就事件契约

成就系统监听的事件必须由真实行为发射：

| 事件 | 发射点 |
|---|---|
| combat.kill | CombatSystem/致死处（成就侧须过滤 killer.isLocal） |
| campaign.clear / campaign.perfect | 战役通关处 |
| campaign.nightmare_clear | 噩梦战役通关处（MatchController 在 campaign.nightmare 时额外发射） |
| combat.backstab | 背刺命中处 |
| combat.perfectblock / combat.dodge | 完美格挡/闪避处（现有 fx.perfectBlock/fx.perfectDodge，可桥接） |
| combat.cavalrykill | 骑杀处 |
| daily.completed | 每日挑战完成翻转时（不可用 daily.update 计数） |

## 5. 统计口径

- `playerDamage`：本地玩家本场造成的伤害，combat.hit 且 attacker.isLocal 时累加；用于结算评级 gradeOf 与无伤判定。
- 无伤判定应用"玩家本场承伤"，而非 playerDamage。
