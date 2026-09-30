// 全局输入路由：R/M/,/C/D/N/Escape 按键与音频解锁（自 main_entry 拆出，只搬代码不改行为）
// 注意：面板键 I/J/V/H/K 由面板组件自监听，此处不得绑定（见 04-ui-design 按键表）
import { States } from '../core/GameState.js';
import { UIStack } from '../ui/UIStack.js';
import { MapGenerator } from '../world/MapGenerator.js';
import { createMode, nextModeName } from '../gameplay/gameModes.js';

export class InputRouter {
  constructor(deps) {
    this.deps = deps;
    this._installed = false;
  }

  install() {
    if (this._installed) return;
    this._installed = true;
    const { audio } = this.deps;
    const _resumeOnce = () => { audio.resume(); window.removeEventListener('keydown', _resumeOnce); window.removeEventListener('mousedown', _resumeOnce); };
    window.addEventListener('keydown', _resumeOnce);
    window.addEventListener('mousedown', _resumeOnce);
    window.addEventListener('keydown', (e) => this._onKey(e));
  }

  _onKey(e) {
    const { state, hud, campaign, daily, weather, settings, match } = this.deps;
    if (e.code === 'KeyR') {
      if (state.current === States.ENDED) match.restart();
      else if (state.current === States.ROUND_END) { match.roundEndTimer = 0; match.startRound(); }
    }
    if (e.code === (this.deps.kb ? this.deps.kb.get('mode') : 'KeyM') && (state.current === States.ENDED || state.current === States.ROUND_END || state.current === States.PLAYING && !this.deps.getPlayer()?.alive)) {
      this._rotateMode();
    }
    if (e.code === 'Comma' && (state.current === States.ENDED || state.current === States.ROUND_END)) {
      const next = MapGenerator.cycleMap(this.deps.currentMapKey());
      this.deps.loadMap(next);
      hud.flash('地图：' + this.deps.mapName());
      match.restart();
    }
    if (e.code === 'KeyC') { hud.flash('战役：第' + (campaign.stage + 1) + '关 ' + campaign.currentStage.name); }
    if (e.code === 'KeyD') {
      const done = daily.challenges.filter(c => c.done).length;
      hud.flash('每日挑战：' + done + '/' + daily.challenges.length + ' 完成');
    }
    if (e.code === (this.deps.kb ? this.deps.kb.get('weather') : 'KeyN')) { weather.toggle(); const wm = { clear: '晴', rain: '雨', night: '夜', snow: '雪', storm: '雷暴' }; hud.flash('天气：' + (wm[weather.mode] || weather.mode)); setTimeout(() => hud.clearHint(), 1500); }
    if (e.code === (this.deps.kb ? this.deps.kb.get('settings') : 'Escape') && UIStack.empty) {
      // 统一游戏菜单（含玩法模式/职业/设置入口）；未注入时回退到设置面板
      if (this.deps.openMenu) this.deps.openMenu();
      else settings.show();
    }
  }

  // 切换到名为 name 的玩法模式：换模式实例 → 载入对应地图 → 刷新 HUD → 重开对局
  applyModeByName(name) {
    const { bus, campaign, setMode, loadMap, mapName, hud, match, weather } = this.deps;
    setMode(createMode(name, { bus, campaign }));
    const newMode = this.deps.getMode();
    if (newMode.name === '战役') {
      const layout = campaign.spawnLayout();
      loadMap(layout.mapKey);
      if (layout.weather) weather.setMode(layout.weather);
    } else {
      loadMap(MapGenerator.recommendMap(newMode.name));
    }
    hud.setMode(newMode.name + ' · ' + mapName());
    match.restart();
    return newMode;
  }

  // M 键：按 MODE_ORDER 轮换到下一个模式（战役全通后先触发噩梦）
  _rotateMode() {
    const { campaign, hud } = this.deps;
    const mode = this.deps.getMode();
    if (mode.name === '战役' && !campaign.nightmare && campaign.cleared >= campaign.maxStages) {
      campaign.nightmare = true; campaign.reset();
      hud.flash('噩梦战役开启：敌人更强！'); setTimeout(() => hud.clearHint(), 2500);
      this.applyModeByName('战役');
      return;
    }
    this.applyModeByName(nextModeName(mode.name));
  }
}
