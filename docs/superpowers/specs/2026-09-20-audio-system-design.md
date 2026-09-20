# 音效系统深化设计（Audio System Enhancement）

> Round 10 音效系统深化
> 日期：2026-09-20
> 状态：已确认，待实现计划

## 1. 目标

现有：AudioEngine 程序化 WebAudio 引擎（swing/hit/footstep/block/ultimate/dodge 6 音效）+ main_entry 实例化 + Character.setAudio。但**未绑定事件**（combat.hit/combat.kill/fx.* 等无 audio 调用），Character.setAudio 未调用。
深化：事件绑定（8 事件 → 音效）+ 新音效（环境/UI/脚步/连击音调）+ 音量控制（分类型）+ AudioContext resume，补全音效闭环。

## 2. 事件绑定（核心补全）

| 事件 | 音效 | 触发点 |
|------|------|--------|
| combat.hit | swing（attacker）+ hit（victim，heavy） | main_entry bus.on('combat.hit') |
| combat.kill | ultimate | main_entry bus.on('combat.kill') |
| fx.perfectDodge | dodge | main_entry bus.on('fx.perfectDodge') |
| fx.perfectBlock | block | main_entry bus.on('fx.perfectBlock') |
| skill.cast | ultimate | main_entry bus.on('skill.cast') |
| achievement.unlock | achievement（上扬旋律） | main_entry bus.on('achievement.unlock') |
| boss.summon | ultimate | main_entry bus.on('boss.summon') |
| hud.bossPhase | ultimate | main_entry bus.on('hud.bossPhase') |
| combo.tier | hit 音调递增（combo 数 *50Hz） | main_entry bus.on('combo.tier') |

## 3. 新音效（扩展）

### 3.1 环境音（WeatherSystem 绑定）
- rain：白噪 lowpass 800Hz 持续
- snow：白噪 lowpass 400Hz 持续（低沉风声）
- storm：白噪 lowpass 1200Hz + 随机雷鸣（_tone 80Hz sawtooth）
- night：无环境音或虫鸣（简化为无）
- clear：无环境音
- 实现：AudioEngine.environment(mode) 启动/切换持续噪音源（_envSource），setMode 时切换

### 3.2 UI 音
- click：_tone(600, 0.05, 'square', 0.15, 400)（面板开关）
- achievement：3 音上扬（_tone 523/659/784 顺序，0.12s 间隔）

### 3.3 脚步音
- Character 移动时 footstep（_footstepTimer 0.35s 间隔，移动中触发）
- 绑定 Character.setAudio + update 内 _footstepTimer 递减

### 3.4 连击音调
- combo.tier 事件：combo 数 *50Hz + hit 音调（hit 音 freq = 250 + combo*50，封顶 800）

## 4. 音量控制（分类型）

| 类型 | 字段 | 默认 |
|------|------|------|
| master | _vol | 0.7 |
| sfx | _sfxVol | 0.8 |
| bgm | _bgmVol | 0.5 |
| env | _envVol | 0.4 |

- `setVolume(type, v)`：type 为 master/sfx/bgm/env，v 0-1
- 实际音量 = master * typeVol
- localStorage 'audio_volume' 持久化 `{ master, sfx, bgm, env }`
- 静音切换（本轮常量 false，设置面板后续）

## 5. AudioContext resume（浏览器自动播放策略）

- 用户首次交互（首次 keydown 或 mousedown）→ audio.resume()
- main_entry 加一次性监听：`const _resumeOnce = () => { audio.resume(); window.removeEventListener('keydown', _resumeOnce); window.removeEventListener('mousedown', _resumeOnce); }; window.addEventListener('keydown', _resumeOnce); window.addEventListener('mousedown', _resumeOnce);`

## 6. 组件

### 6.1 src/audio/AudioEngine.js（修改）
- constructor 加 `_sfxVol=0.8; _bgmVol=0.5; _envVol=0.4; _envSource=null; _loadVolume();`
- `setVolume(type, v)` + `_volOf(type)` 辅助（master * typeVol）
- `playSound(type, opts)` 统一接口：
  - 'swing'/'hit'/'block'/'dodge'/'ultimate' → 现有方法（_volOf('sfx')）
  - 'click'/'achievement' → 新 UI 音
  - 'environment' → 环境音切换
  - 'kill' → ultimate
  - opts.combo 用于 hit 音调递增
- 现有方法改用 `_volOf('sfx')` 代替 `_vol`
- 新方法 `environment(mode)` 启停持续噪音源
- 新方法 `click()` / `achievement()`
- `_loadVolume()/_saveVolume()` localStorage

### 6.2 src/main_entry.js（修改）
- bus.on 事件绑定音效（§2 表，9 事件）
- 首次交互 resume（§5）
- Character.setAudio 注入：`player.setAudio(audio); for (const ai of ais) ai.setAudio(audio);`
- WeatherSystem setMode 时 audio.environment(mode)（或 bus.on weather 事件）

### 6.3 src/gameplay/Character.js（修改）
- constructor 加 `_footstepTimer = 0;`
- update 加：移动中（_moving && _footstepTimer<=0）→ `this._audio?.footstep(); _footstepTimer = 0.35;`
- _footstepTimer 递减

### 6.4 src/world/WeatherSystem.js（修改）
- setMode 后 `this._audio?.environment(mode)`（或 main_entry 绑定 weather 事件）

## 7. 测试

### 7.1 单测 tests/audio/AudioEngine.test.js
- playSound 各 type（mock ctx，验证 _tone/_noise 调用）
- setVolume 分类型 + 持久化
- resume（mock ctx.state）
- environment 切换（mock _envSource stop/start）
- achievement 上扬 3 音

### 7.2 冒烟 e2e/smoke.spec.js
- 0 error（音效在测试环境 ctx=null 安全，不崩溃）

## 8. 与现有系统协同

- 连击：combo.tier 音调递增
- 成就：解锁上扬音
- 天气：环境音切换
- Boss/AI：技能音效（boss.summon/bossPhase）
- 战斗：combat.hit/kill 全音效反馈
- 移动：footstep 移动音

## 9. 边界与错误处理

- AudioContext 可为 null（浏览器不支持），所有方法 if (!this.ctx) return
- _envSource 可为 null，environment 切换时 if stop
- playSound 未知 type 忽略
- 音量 0 时静音（_volOf 返 0，_tone/_noise vol=0 无声）
- localStorage 无则用默认

## 10. 不做的事（YAGNI）

- 不做 3D 空间音效（距离衰减）
- 不做音效资源文件（全程程序化 WebAudio）
- 不做 BGM 复杂作曲（简单和弦循环或跳过，本轮跳过 BGM 仅环境音）
- 不做音效设置面板（本轮常量 + localStorage，面板后续）
- 不做语音/旁白
