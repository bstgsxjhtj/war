# 设置面板深化设计（Settings Panel Enhancement）

> Round 11 设置面板深化
> 日期：2026-09-20
> 状态：已确认，待实现计划（跳过键位重绑）

## 1. 目标

现有：SettingsMenu.js 48 行（画质 select + 音量 slider + 灵敏度 slider），但：① 音量用旧接口 `audio.setVolume(v)`（新 AudioEngine 是 `setVolume(type,v)`，需适配）② 画质/灵敏度事件未绑定 main_entry ③ 无难度选择 ④ 无 localStorage 持久化 ⑤ 无分类型音量。
深化：音量分类型（4 slider）+ 画质绑定（Renderer.setQuality）+ 灵敏度绑定 + 难度选择 + localStorage 持久化。

## 2. 音量控制（分类型，适配新 AudioEngine）

4 slider：
| slider | 字段 | 调用 |
|--------|------|------|
| 主音量 | _vol | audio.setVolume('master', v) |
| 音效 | _sfx | audio.setVolume('sfx', v) |
| BGM | _bgm | audio.setVolume('bgm', v) |
| 环境 | _env | audio.setVolume('env', v) |

默认值：master 0.7 / sfx 0.8 / bgm 0.5 / env 0.4（与 AudioEngine 默认一致）

## 3. 画质绑定（Renderer.setQuality）

| 画质 | pixelRatio | shadowMap.enabled | shadowMapSize |
|------|------------|-------------------|---------------|
| high | min(dpr,2) | true | 4096 |
| mid | 1 | true | 2048 |
| low | 0.7 | false | - |

- Renderer 加 `setQuality(q)` 方法：apply pixelRatio + shadowMap + shadowMapSize
- main_entry 绑定 `bus.on('settings.quality', ({ quality }) => renderer.setQuality(quality))`

## 4. 灵敏度绑定

- settings.sensitivity 事件 → main_entry 应用到 player/camera look
- 鼠标灵敏度乘数（默认 1.0，范围 0.3-3.0）
- main_entry 绑定 `bus.on('settings.sensitivity', ({ sensitivity }) => { player.lookSensitivity = sensitivity; })` 或 camera 旋转乘数
- 需 Grep player/camera look 逻辑确认字段名

## 5. 难度选择

- easy/normal/hard select → `aiManager.setDifficulty(d)`
- `bus.on('settings.difficulty', ({ difficulty }) => aiManager.setDifficulty(difficulty))`
- 默认 normal

## 6. localStorage 持久化统一

- 键 `settings` 存 `{ quality, volume: { master, sfx, bgm, env }, sensitivity, difficulty }`
- SettingsMenu 启动 `_load()` 读 + 应用到 UI 控件 + emit 事件
- 任一控件 change/input → `_save()` 持久化

## 7. 组件

### 7.1 src/ui/SettingsMenu.js（修改）
- constructor 加 `this._sfx/_bgm/_env` slider + `this._diff` select
- 音量 slider 改 4 个（master/sfx/bgm/env），各调 `audio.setVolume(type, v)`
- 难度 select（easy/normal/hard），emit `settings.difficulty`
- 灵敏度 slider emit `settings.sensitivity`（已有，补 emit 事件）
- 画质 select emit `settings.quality`（已有）
- `_load()/_save()` localStorage
- show() 时 `_applyAll()`（emit 当前值，确保 main_entry 应用）

### 7.2 src/engine/Renderer.js（修改）
- 加 `setQuality(q)` 方法：
  ```js
  setQuality(q) {
    if (q === 'low') { this.webgl.shadowMap.enabled = false; this.webgl.setPixelRatio(0.7); }
    else if (q === 'mid') { this.webgl.shadowMap.enabled = true; this.webgl.shadowMap.mapSize.set(2048, 2048); this.webgl.setPixelRatio(1); }
    else { this.webgl.shadowMap.enabled = true; this.webgl.shadowMap.mapSize.set(4096, 4096); this.webgl.setPixelRatio(Math.min(window.devicePixelRatio, 2)); }
  }
  ```

### 7.3 src/main_entry.js（修改）
- 绑定 `bus.on('settings.quality'/'settings.sensitivity'/'settings.difficulty')`
- quality → renderer.setQuality
- sensitivity → player.lookSensitivity（Grep 确认字段）或 camera 乘数
- difficulty → aiManager.setDifficulty
- 启动时 settings.show() 一次 _applyAll 或直接 emit 初始值（确保应用）

## 8. 测试

### 8.1 单测 tests/ui/SettingsMenu.test.js
- 音量 4 slider change → audio.setVolume(type, v) 调用 + _save 持久化
- 画质 change → emit settings.quality + _save
- 难度 change → emit settings.difficulty + _save
- 灵敏度 change → emit settings.sensitivity + _save
- _load 启动加载（localStorage mock）

### 8.2 冒烟 e2e/smoke.spec.js
- 设置面板渲染（Escape 切换 + #set-close + 4 slider + 难度 select）

## 9. 与现有系统协同

- AudioEngine：分类型音量（Round 10 已建）
- AIManager：难度选择（Round 9 已建）
- Renderer：画质动态调整
- main_entry：事件绑定 + 应用

## 10. 边界与错误处理

- audio/aiManager/renderer 可为 null（注入前），事件 handler 内 if 守卫
- localStorage 无则用默认
- 灵敏度字段不存在则 console.warn（不崩）
- 画质未知值忽略

## 11. 不做的事（YAGNI）

- 键位重绑（本轮跳过，核心键固定）
- 辅助功能（色盲/字幕）
- 多语言
- 控制器支持
- BGM 音量实际应用（BGM 未实现，slider 仅存配置）
