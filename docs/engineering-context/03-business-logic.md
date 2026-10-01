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

**攻击缓冲对齐冷却 + 命中帧后取消后摇**（C1-2，2026-10-01）：旧 `Player.update` 攻击缓冲固定 0.25s，重锤（cooldown 1.2s）有 ~0.78s 死区吞输入；`tryAttack` 在 `_attacking` 期间一律拒绝，连招须掐点等动画全结束。修复两处：
- `Player._attackQueued` 缓冲时长改为 `max(0.25, weapon.cooldown + 0.2)`——覆盖武器冷却期，重锤缓冲 1.4s，消除死区。
- `Character.tryAttack` 在 `_attacking` 期间不再一律拒绝：命中帧后（`t >= weapon.hitFrame`）且 `weapon.ready` 时允许取消后摇立即接下一段连招（Hades 式提前排队）；弓/法杖（projectile）不参与取消；命中帧前段（`t < hitFrame`）仍不可取消。冷却约束保留，避免重锤连发破坏平衡。

**噩梦敌人词条**（P0-1，2026-09-28；P3-3 统一抽象，2026-09-29）：`currentStage.enemyMods`（reflect/vampire/lucky/swift/ironhide）由 Spawner._applyEnemyMods 注入非 Boss 敌人（AIController.setEnemyMods），行为经 `AffixBehavior` 统一接口（`AFFIX_BEHAVIORS` 纯函数集 + `applyEnemyBehaviors` 调度器）分发，消除散落的 `_enemyMods.includes` 内联分支：
- 受击侧（AIController.takeDamage → applyEnemyBehaviors.modifyIncoming/onTakeDamage）：ironhide 受伤 ×0.75；reflect 反弹 10% 给攻击者（_reflecting 守卫防双方递归）。
- 攻击侧（CombatSystem._affixLeech → applyEnemyBehaviors.onDealDamage）：vampire 吸血 15%（与玩家吸血/连击/技能吸血分步 clamp maxHp，结果等价）。lucky 暴击 +15%（×2）仍由 _affixApply 内联（暴击路径独立，不经 behavior 接口）。
- 生成侧（Spawner._applyEnemyMods → applyEnemyBehaviors.onSpawn）：swift speed ×1.2（behavior 内 `if (!victim.speed) return` 守卫空速度）。
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
- **架势条（Posture，只狼式）**：格挡/受击/攻击累积削韧（POSTURE 常量），满 100 崩防（_postureBroken=1.2s 硬直+震屏），崩防期间 canBeExecuted 开启处决窗口（与 HP<20% 处决并行）。不格挡/不攻击/不受击 0.6s 后恢复（REGEN_RATE 18/s）。Warhammer armorPierce +20 破乌龟流。AIController 自身 posture>70 触发 _adaptRetreat 后撤恢复。HUD setPosture 渲染玩家架势条（满红闪）。与耐力共存：耐力管动作消耗，架势管防御博弈。
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
- **e2e 覆盖新系统 + UpgradePicker 回调修复**（P2-7，2026-09-29）：新增三组 e2e 覆盖——①键位重绑流程（`KeyBindings._load` 损坏 JSON 静默回退默认、冲突检测归还旧动作默认并持久化重载恢复、自身默认键码短路保存）；②存档损坏恢复（合法 JSON 缺字段时 `{...defaults, ...migrated}` 合并补齐、旧键逐项 try/catch 容错使单键损坏不阻断其他迁移）；③战役 3 选 1 升级（`UpgradePicker` show 渲染 3 卡片 + 重选按钮、点击 apply+buffSelect+hide+回调、重选消耗 reroll 重新渲染、重选用完隐藏按钮）。覆盖过程中发现并修复 `UpgradePicker` 真实 bug：点击卡片后 `hide()` 先于 `_callback` 检查执行，导致回调被 null 吞掉、下一关 spawnLayout 永不触发；修复为先捕获 `cb = this._callback` 再 `hide()` 再 `cb()`。
- **AI 涌现行为：连续被完美格挡后变招**（P3-2，2026-09-29）：`Character.takeDamage` 完美格挡分支新增 `attacker._wasPerfectBlocked = true` 标记（与既有 `attacker._hurt` 弹刀并列，无 bus 监听器、无生命周期泄漏）。`AIController.update` 每帧消费该标记：`_perfectBlockCount` 累加，达 2 次即触发变招——立即 `bus.emit(AI_CALLREINFORCE)` 叫援军 + 进入 `_adaptRetreat=2.5s` 适应撤退（远离最近敌人、state='retreat'、不攻击）；计数 4 秒无新增则衰减归零（避免单次格挡后永不重置）。低血量逃窜（`health.ratio<0.3`）优先于适应撤退（HP retreat 分支先执行）。
- **词条行为统一抽象**（P3-3，2026-09-29）：新增 `src/gameplay/AffixBehavior.js`——`AFFIX_BEHAVIORS` 对象（reflect/vampire/ironhide/swift 四个纯函数 behavior，各含 onTakeDamage/onDealDamage/modifyIncoming/onSpawn 钩子）+ `applyEnemyBehaviors` 调度器（按 `victim._enemyMods` 分发，ctx 携带各行为参数）。三个消费方收敛：AIController.takeDamage 经 `modifyIncoming`+`onTakeDamage`（ironhide+reflect）；CombatSystem._affixLeech 经 `onDealDamage`（vampire，移除内联 `includes('vampire')` 分支）；Spawner._applyEnemyMods 经 `onSpawn`（swift，移除内联 `includes('swift')` 分支）。玩家武器词条（Affixes.js，中文键 + 层级/协同）暂不经此接口；未来反射/吸血可演进共用。
- **Boss 阶段转换演出**（P3-4，2026-09-29）：BossEnemy HP 低于阈值触发 `HUD_BOSSPHASE`（phase 2 < 60%、phase 3 < 30%）时，三路演出同时触发——①镜头拉近：Camera 新增 `bus.on(HUD_BOSSPHASE)` 订阅，按 phase 收缩 FOV（phase 2→45°/phase 3→40°，balance.js `FOV_BOSS_PHASE2/3`）+ 震屏 0.7，`_reducedMotion` 时跳过 FOV 仅保留震屏（与 PERFECTBLOCK/ULTIMATE 模式一致）。②吼叫音效：EventWiring HUD_BOSSPHASE 处理器已播 `bossRoar` + `bgmIntensity{2}`（复用既有接线）。③环境光照：EventWiring HUD_BOSSPHASE 处理器扩展，调用 `weather.setMode`（phase 2→storm 雷暴、phase 3→night 夜色）即时切换天气光照（WeatherSystem.setMode 即时 apply + audio.environment 通知）。

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

## 6. 可玩性能力补齐（P1，2026-10-01）

> 圆桌会议对比 9 款标杆（Hades/PoE/LE + D4/LE/GD + FE/TW/M&B）后，针对科技树/装备路线/相克三类能力补齐。设计原则：新增正交维度相乘而非替换，向后兼容旧 save/旧测试。

### 6.1 科技树深化（P1-A，SkillTree.js）

- **req 数组表达式**：`req` 从字符串 `'power'` 升级为数组 `['power>=2','berserk>=1']`，支持 `>= > <= < ==` 运算符；`_checkReqs` 解析、`_nodeLevel` 同时查 skills/branches，支持网状多前置依赖（向后兼容旧字符串按 `>=2`）。
- **Tier3 冠顶节点**：新增 4 个（warlord/bastion/druid/tempest），需基础满级 + 本系分支已点，给予天花板回报（类 Hades Legendary）。
- **Keystone 机制改写**：新增 2 个（colossus 禁闪避+减伤+移速降 / overload 耐力减半+法伤，法师专属），改变核心机制而非纯数值（类 PoE Keystone）。
- **分支渐进化**：berserk/guardian 从 max:1 改为 max:3，系数 15%/级、10%/级，技能点经济有纵深。

### 6.2 装备词条扩展（P1-B，Affixes.js）

- **greater 品质分层**：drop 新增 greater 标记（数值 ×1.5，掉率 8% 受 luck 加成），affixBonus 读 greater 放大（类 D4 Greater Affix）。
- **协同扩展到 6 条**：新增 3 条行为改变协同——嗜血（锋锐+吸血→处决阈值+0.08）、荆棘（坚韧+幸运→受击反伤 15%）、风暴（暴怒+迅捷→暴伤倍率+0.5）。

### 6.3 相克多维化（P1-C，CombatSystem.js）

- **伤害类型 × 护甲类型表**：`DAMAGE_ARMOR_TABLE`（cut/pierce/blunt × light/medium/heavy，钝>刺>切 对重甲），`WEAPON_DAMAGE_TYPE` 映射武器类→伤害类型（类 M&B）。
- **职业相克第三维**：`CLASS_COUNTER`（assassin>mage>warrior>assassin，×1.3，类 FE 三角）。
- **多元输出**：`_counterMulFull` 返回 `{damageMul, postureMul, weaponMul, dmgTypeMul, classMul}`，三表正交相乘设上限 `COUNTER_TOTAL_MAX=2.5`；postureMul 接已有架势条（克制时削韧加成）。
- **向后兼容**：victim 无 armorType/classType 时 dmgTypeMul=classMul=1，等价原 `_counterMul`；`_counterMul` 保留供 _emitHit 显示武器克制；resolveMelee 改用 `_counterMulFull.damageMul` 算伤害、`.weaponMul` 判 countered 显示。
