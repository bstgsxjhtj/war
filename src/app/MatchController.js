// 对局控制器：比分/回合/胜负判定/开局重开（自 main_entry 拆出，只搬代码不改行为）
import { States } from '../core/GameState.js';
import { BossEnemy } from '../gameplay/BossEnemy.js';
import { CavalryEnemy } from '../gameplay/Cavalry.js';
import { ResultScreen } from '../ui/ResultScreen.js';
import { WaveMode } from '../gameplay/WaveMode.js';
import { COUNTER_MATRIX } from '../gameplay/CombatSystem.js';
import { EV } from '../core/constants/events.js';

export class MatchController {
  constructor(deps) {
    this.deps = deps;
    this.scoreB = 0;
    this.scoreR = 0;
    this.roundB = 0;
    this.roundR = 0;
    this.targetWins = 2;
    this.roundEndTimer = 0;
    this.playerKills = 0;
    this.playerDamage = 0;
    this.playerTaken = 0;
    this.playerMaxCombo = 0;
    this.playerPerfectBlocks = 0;
    this.playerPerfectDodges = 0;
    this.playerExecutes = 0;
    this.playerCrits = 0;
    this.playerHits = 0;
    this.playerMisses = 0;
    this.playerDeathCause = null;
    this.deathCauses = {};
    this.deathCount = 0;
    this.counterDeaths = 0;
    this.matchStartTime = performance.now();
    // 战役目标状态（spawnAll 重置、主循环推进、checkWin 判定）
    this.escortTarget = null;
    this.defenseTimer = 0;
    this.timeLimit = 0;
    this.surviveWavesDone = false;
    this.surviveTimer = 0;

    const { bus } = deps;
    bus.on(EV.COMBAT_HIT, ({ attacker, combo, crit } = {}) => {
      if (!attacker || !attacker.isLocal) return;
      this.playerHits++;
      if (crit) this.playerCrits++;
      if (combo > this.playerMaxCombo) this.playerMaxCombo = combo;
    });
    bus.on(EV.HUD_MISS, () => { this.playerMisses++; });
    bus.on(EV.FX_PERFECTBLOCK, ({ char } = {}) => { if (char && char.isLocal) this.playerPerfectBlocks++; });
    bus.on(EV.FX_PERFECTDODGE, ({ char } = {}) => { if (char && char.isLocal) this.playerPerfectDodges++; });
    bus.on(EV.COMBAT_EXECUTE, ({ char } = {}) => { if (char && char.isLocal) this.playerExecutes++; });
    bus.on(EV.COMBAT_KILL, ({ team, killer, victim }) => {
      if (team === 1) this.scoreB++; else this.scoreR++;
      this.deps.hud.setScore(this.scoreB, this.scoreR);
      if (killer && killer.isLocal) {
        this.playerKills++; this.deps.skills.addPoint(1); this.deps.hud.flash('+1 技能点 (按 K 分配)'); setTimeout(() => this.deps.hud.clearHint(), 1500); this.deps.daily.track('kills');
        if (this.deps.campaign.nightmare) this.deps.daily.track('nightmareKills');
        if (victim && victim._isBoss) {
          this.deps.daily.track('bossKill'); this.deps.saveNow();
          const tier = this.deps.affixes ? (Math.random() < 0.4 ? 2 : 1) : 0;
          const types = ['锋锐', '迅捷', '暴怒', '吸血', '坚韧', '幸运'];
          const affixType = types[Math.floor(Math.random() * types.length)];
          const granted = this.deps.affixes?.grant(affixType, tier);
          if (granted) { bus.emit(EV.AFFIX_DROP, { type: affixType, tier, boss: true }); this.deps.hud.flash('Boss 掉落词缀！'); setTimeout(() => this.deps.hud.clearHint(), 2000); }
        } else if (this.deps.affixes) {
          const luck = this.deps.affixes.affixBonus(killer.weapon, '幸运');
          const dropped = this.deps.affixes.drop(luck);
          if (dropped) { bus.emit(EV.AFFIX_DROP, { ...dropped, boss: false }); this.deps.hud.flash('词缀掉落！'); setTimeout(() => this.deps.hud.clearHint(), 1500); }
        }
        if (victim instanceof CavalryEnemy) bus.emit(EV.COMBAT_CAVALRYKILL, { killer, victim });
        bus.emit(EV.DAILY_UPDATE, this.deps.daily.challenges);
      }
      if (victim && victim.isLocal && killer) {
        const cause = killer.weapon?.name || killer._name || '未知';
        this.deathCauses[cause] = (this.deathCauses[cause] || 0) + 1;
        this.deathCount++;
        const mul = COUNTER_MATRIX[killer.weapon?.weaponClass]?.[victim.weapon?.weaponClass] ?? 1;
        if (mul > 1.2) this.counterDeaths++;
      }
    });
    bus.on(EV.ROUND_RESTART, () => { if (this.deps.state.current === States.ENDED && !this._restarting) this.restart(); });
  }

  startRound() {
    this.scoreB = 0; this.scoreR = 0;
    this.playerKills = 0; this.playerDamage = 0; this.playerTaken = 0; this.playerDeathCause = null; this.deathCauses = {}; this.deathCount = 0; this.counterDeaths = 0; this.matchStartTime = performance.now();
    this.playerMaxCombo = 0; this.playerPerfectBlocks = 0; this.playerPerfectDodges = 0; this.playerExecutes = 0; this.playerCrits = 0; this.playerHits = 0; this.playerMisses = 0;
    const mode = this.deps.getMode();
    if (mode.name === '波次' || mode.name === '无尽') {
      this.targetWins = 1;
      mode.wave = 0; mode.alive = 0;
    } else {
      this.targetWins = 2;
    }
    this.deps.hud.setScore(0, 0);
    this.deps.hud.clearHint();
    this.deps.spawnAll();
    this.deps.state.transit(States.READY);
    this.deps.state.transit(States.PLAYING);
    this.deps.hud.flash('遭遇战开始！点击锁定鼠标');
    setTimeout(() => this.deps.hud.clearHint(), 1800);
  }

  restart() {
    if (this._restarting) return;
    this._restarting = true;
    this.deps.resultScreen.hide();
    this.roundB = 0; this.roundR = 0;
    this.deps.hud.setRound(this.roundB, this.roundR, this.targetWins);
    this.startRound();
    this._restarting = false;
  }

  // 结算屏表现复盘数据快照
  _stats() {
    return {
      taken: this.playerTaken,
      maxCombo: this.playerMaxCombo,
      perfectBlocks: this.playerPerfectBlocks,
      perfectDodges: this.playerPerfectDodges,
      executes: this.playerExecutes,
      crits: this.playerCrits,
      hits: this.playerHits,
      misses: this.playerMisses,
    };
  }

  checkWin() {
    const { state, hud, campaign, siege, progression, progressUI, daily, bus, resultScreen, camera, saveNow, assist } = this.deps;
    const mode = this.deps.getMode();
    const player = this.deps.getPlayer();
    const ais = this.deps.getAis();
    if (state.current !== States.PLAYING) return;
    if (!player.alive && !this.playerDeathCause && player.lastAttacker) this.playerDeathCause = (player.lastAttacker.weapon?.name) || '未知';
    const deathStats = this.deathCount > 0 ? {
      causes: Object.entries(this.deathCauses).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([name, count]) => ({ name, count })),
      total: this.deathCount,
      countered: this.counterDeaths
    } : null;
    if (mode.name === '战役') {
      const winner = campaign.checkWin(player.alive, ais.some(a => a.alive), siege.gate, { boss: ais.find(a => a instanceof BossEnemy), escortTarget: this.escortTarget, defenseTimer: this.defenseTimer, surviveWavesDone: this.surviveWavesDone, timeLimit: this.timeLimit, redAlive: ais.filter(a => a.alive).length });
      if (winner === 'blue') {
        const result = campaign.onStageClear();
        saveNow();
        if (result === 'campaign_complete') {
          hud.flashEnd('战役通关！按 R 重玩');
          bus.emit(EV.CAMPAIGN_CLEAR, { stages: campaign.maxStages });
        if (campaign.nightmare) bus.emit(EV.CAMPAIGN_NIGHTMARE_CLEAR, { stages: campaign.maxStages });
        if (this.playerTaken === 0) bus.emit(EV.CAMPAIGN_PERFECT, {});
          progression.recordWin('S', 0);
          if (campaign.nightmare) daily.track('nightmareWin');
          const _creward = daily.claim(); if (_creward > 0) { progression.addScore(_creward); hud.flash('每日挑战完成！+' + _creward + '分'); }
          bus.emit(EV.DAILY_UPDATE, daily.challenges);
          state.transit(States.ENDED);
          resultScreen.show({ kills: this.playerKills, damage: this.playerDamage, time: 0, win: true, deathCause: this.playerDeathCause, deathStats, stats: this._stats() });
        } else {
          const layout = campaign.spawnLayout();
          this.deps.loadMap(layout.mapKey);
          if (layout.weather) this.deps.weather.setMode(layout.weather);
          hud.flash('关卡通过！按 R 进入下一关');
          state.transit(States.ROUND_END);
          this.roundEndTimer = 3;
        }
        return;
      } else if (winner === 'red') {
        hud.flashEnd('战役失败！按 R 重试本关');
        state.transit(States.ENDED);
        resultScreen.show({ kills: this.playerKills, damage: this.playerDamage, time: 0, win: false, deathCause: this.playerDeathCause, deathStats, stats: this._stats() });
        return;
      }
      return;
    }
    let winner = null;
    if (mode.name === '攻城') {
      if (siege.gate.broken) winner = 'blue';
      else if (!player.alive) winner = 'red';
    } else if (mode.name === '据点') {
      winner = mode.checkWin();
      if (!ais.some(a => a.alive)) winner = 'blue';
      else if (!player.alive) winner = 'red';
    } else {
      winner = mode.checkWin(player.alive, ais.some(a => a.alive));
    }
    let _wave, _bestWave;
    if (mode.name === '波次' || mode.name === '无尽') {
      WaveMode.saveBest(mode.wave);
      _wave = mode.wave;
      _bestWave = WaveMode.loadBest();
    }
    if (winner === 'blue') {
      this.roundB++; hud.setRound(this.roundB, this.roundR, this.targetWins);
      if (this.roundB >= this.targetWins) {
        if (assist) assist.onPlayerWin();
        hud.flashEnd('蓝方获胜！按 R 重新开始'); camera.setKillCam(player); state.transit(States.ENDED);
        const grade = ResultScreen.gradeOf ? ResultScreen.gradeOf(this.playerKills, this.playerDamage, (performance.now() - this.matchStartTime) / 1000, this._stats()) : 'A';
        progression.recordWin(grade, (performance.now() - this.matchStartTime) / 1000); progressUI.refresh();
        resultScreen.show({ kills: this.playerKills, damage: this.playerDamage, time: (performance.now() - this.matchStartTime) / 1000, win: true, deathCause: this.playerDeathCause, wave: _wave, bestWave: _bestWave, deathStats, stats: this._stats() });
        if (this.playerTaken === 0) daily.track('noDamageWin');
        const timeSec = (performance.now() - this.matchStartTime) / 1000;
        if (timeSec < 90) daily.track('speedWin', timeSec);
        if (grade === 'S') daily.track('winGrade');
        const reward = daily.claim(); if (reward > 0) { progression.addScore(reward); hud.flash('每日挑战完成！+' + reward + '分'); progressUI.refresh(); }
        bus.emit(EV.DAILY_UPDATE, daily.challenges);
      }
      else { hud.flash('蓝方赢下本局！按 R 跳过'); state.transit(States.ROUND_END); this.roundEndTimer = 3; }
    } else if (winner === 'red') {
      this.roundR++; hud.setRound(this.roundB, this.roundR, this.targetWins);
      if (this.roundR >= this.targetWins) {
        hud.flashEnd('红方获胜！按 R 重新开始');
        if (player.lastAttacker) camera.setKillCam(player.lastAttacker);
        state.transit(States.ENDED); progression.recordLoss(); progressUI.refresh();
        resultScreen.show({ kills: this.playerKills, damage: this.playerDamage, time: (performance.now() - this.matchStartTime) / 1000, win: false, deathCause: this.playerDeathCause, wave: _wave, bestWave: _bestWave, deathStats, stats: this._stats() });
      }
      else { hud.flash('红方赢下本局！按 R 跳过'); state.transit(States.ROUND_END); this.roundEndTimer = 3; }
    }
  }
}
