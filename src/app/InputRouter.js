// 全局输入路由：R/M/,/C/D/N/Escape 按键与音频解锁（自 main_entry 拆出，只搬代码不改行为）
// 注意：面板键 I/J/V/H/K 由面板组件自监听，此处不得绑定（见 04-ui-design 按键表）
import { States } from '../core/GameState.js';
import { UIStack } from '../ui/UIStack.js';
import { Deathmatch, Domination, SiegeMode } from '../gameplay/GameMode.js';
import { WaveMode } from '../gameplay/WaveMode.js';
import { BattlefieldMode } from '../gameplay/BattlefieldMode.js';
import { MapGenerator } from '../world/MapGenerator.js';

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
      const { bus, getMode, setMode, loadMap, mapName } = this.deps;
      const mode = getMode();
      let next;
      if (mode.name === '死斗') next = new Domination(bus);
      else if (mode.name === '据点') next = new SiegeMode(bus);
      else if (mode.name === '攻城') next = new WaveMode(bus);
      else if (mode.name === '波次') next = new BattlefieldMode(bus);
      else if (mode.name === '战场') next = new WaveMode(bus, true);
      else if (mode.name === '无尽') next = campaign;
      else if (mode.name === '战役' && !campaign.nightmare && campaign.cleared >= campaign.maxStages) {
        campaign.nightmare = true; campaign.reset(); next = campaign;
        hud.flash('噩梦战役开启：敌人更强！'); setTimeout(() => hud.clearHint(), 2500);
      }
      else next = new Deathmatch(bus);
      setMode(next);
      const newMode = getMode();
      if (newMode.name === '战役') {
        const layout = campaign.spawnLayout();
        loadMap(layout.mapKey);
        if (layout.weather) weather.setMode(layout.weather);
      } else {
        const newMapKey = MapGenerator.recommendMap(newMode.name);
        loadMap(newMapKey);
      }
      hud.setMode(newMode.name + ' · ' + mapName());
      match.restart();
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
    if (e.code === (this.deps.kb ? this.deps.kb.get('settings') : 'Escape') && UIStack.empty) settings.show();
  }
}
