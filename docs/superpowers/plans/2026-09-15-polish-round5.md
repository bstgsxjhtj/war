# 第五轮品质打磨 Implementation Plan

> **For agentic workers:** 本游戏 Demo 无单元测试框架，验证用浏览器实测（navigate + console + STATE 数据）替代 TDD。步骤用 checkbox 跟踪。

**Goal:** 修复测试发现的残留问题 + 按专家讨论进化画面/手感/机制/可玩性

**Architecture:** Three.js + Vite，模块化 ES Modules，SearchReplace 修改现有文件为主

**Tech Stack:** Three.js 0.160, Vite 5, cannon-es, WebSocket

---

## 测试发现的问题（必修）
- TextureFactory/ParticleFX/EnvMap/AudioEngine not defined（Vite optimize 边缘模块，STATE 正常但 console 报错）
- CSM 'far' warn（CSMFrustum 初始化）
- 'sun' TypeError（WeatherSystem userData 访问）

## 任务列表

### Task 1: CSM 'far' 修复 + 阴影分档
**Files:** Modify `src/engine/Renderer.js`
- [ ] 移除 CSM（fallback 单阴影 + 分档 1024/2048/4096 按 settings.quality）

### Task 2: Bloom 降强度 + 角色护甲细节
**Files:** Modify `src/engine/Renderer.js`, `src/entity/Character.js`
- [ ] Bloom strength 0.32→0.2, threshold 1.05→1.2
- [ ] Character 加腰带扣/护甲纹饰（小几何体细节）

### Task 3: 战斗反馈（格挡耐力闪红 + 受击方向指示）
**Files:** Modify `src/ui/HUD.js`, `src/gameplay/Character.js`
- [ ] 格挡耐力<30% 时耐力条闪红
- [ ] 受击时画面边缘红色方向指示器

### Task 4: 结算页
**Files:** Create `src/ui/ResultScreen.js`, Modify `src/main_entry.js`
- [ ] 每局结束显示击杀/伤害/用时/评分

### Task 5: 补给点（治疗篝火）
**Files:** Create `src/world/SupplyPoint.js`, Modify `src/main_entry.js`
- [ ] 场景加治疗篝火，靠近回血

### Task 6: 地图扩大 + 掩体
**Files:** Modify `src/world/Terrain.js`, `src/world/Environment.js`
- [ ] 地形 220→320，加掩体分布

### Task 7: 验证
- [ ] navigate + console 无致命错误 + STATE 完整
