// 对局控制器：比分/回合/胜负判定/开局重开（自 main_entry 拆出，只搬代码不改行为）
import { States } from '../core/GameState.js';
import { BossEnemy } from '../gameplay/BossEnemy.js';
import { CavalryEnemy } from '../gameplay/Cavalry.js';
import { ResultScreen } from '../ui/ResultScreen.js';

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
    this.matchStartTime = performance.now();
    // 战役目标状态（spawnAll 重置、主循环推进、checkWin 判定）
    this.escortTarget = null;
    this.defenseTimer = 0;
    this.timeLimit = 0;
    this.surviveWavesDone = false;
    this.surviveTimer = 0;

    const { bus } = deps;
    bus.on('combat.kill', ({ team, killer, victim }) => {
      if (team === 1) this.scoreB++; else this.scoreR++;
      this.deps.hud.setScore(this.scoreB, this.scoreR);
      if (killer && killer.isLocal) {
        this.playerKills++; this.deps.skills.addPoint(1); this.deps.hud.flash('+1 技能点 (按 K 分配)'); setTimeout(() => this.deps.hud.clearHint(), 1500); this.deps.daily.track('kills');
        if (victim && victim._isBoss) { this.deps.daily.track('bossKill'); this.deps.saveNow(); }
        if (victim instanceof CavalryEnemy) bus.emit('combat.cavalrykill', { killer, victim });
        bus.emit('daily.update', this.deps.daily.challenges);
      }
      this.deps.audio.playSound('ultimate');
    });
    bus.on('round.restart', () => { if (this.deps.state.current === States.ENDED) this.restart(); });
  }

  startRound() {
    this.scoreB = 0; this.scoreR = 0;
    this.playerKills = 0; this.playerDamage = 0; this.matchStartTime = performance.now();
    this.deps.hud.setScore(0, 0);
    this.deps.hud.clearHint();
    this.deps.spawnAll();
    this.deps.state.transit(States.READY);
    this.deps.state.transit(States.PLAYING);
    this.deps.hud.flash('遭遇战开始！点击锁定鼠标');
    setTimeout(() => this.deps.hud.clearHint(), 1800);
  }

  restart() {
    this.deps.resultScreen.hide();
    this.roundB = 0; this.roundR = 0;
    this.deps.hud.setRound(this.roundB, this.roundR, this.targetWins);
    this.startRound();
  }

  checkWin() {
    const { state, hud, campaign, siege, progression, progressUI, daily, bus, resultScreen, camera, saveNow } = this.deps;
    const mode = this.deps.getMode();
    const player = this.deps.getPlayer();
    const ais = this.deps.getAis();
    if (state.current !== States.PLAYING) return;
    if (mode.name === '战役') {
      const winner = campaign.checkWin(player.alive, ais.some(a => a.alive), siege.gate, { boss: ais.find(a => a instanceof BossEnemy), escortTarget: this.escortTarget, defenseTimer: this.defenseTimer, surviveWavesDone: this.surviveWavesDone, timeLimit: this.timeLimit, redAlive: ais.filter(a => a.alive).length });
      if (winner === 'blue') {
        const result = campaign.onStageClear();
        saveNow();
        if (result === 'campaign_complete') {
          hud.flashEnd('战役通关！按 R 重玩');
          bus.emit('campaign.clear', { stages: campaign.maxStages });
          if (this.playerTaken === 0) bus.emit('campaign.perfect', {});
          progression.recordWin('S', 0);
          const _creward = daily.claim(); if (_creward > 0) { progression.addScore(_creward); hud.flash('每日挑战完成！+' + _creward + '分'); }
          bus.emit('daily.update', daily.challenges);
          state.transit(States.ENDED);
          resultScreen.show({ kills: this.playerKills, damage: this.playerDamage, time: 0, win: true });
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
        resultScreen.show({ kills: this.playerKills, damage: this.playerDamage, time: 0, win: false });
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
    if (winner === 'blue') {
      this.roundB++; hud.setRound(this.roundB, this.roundR, this.targetWins);
      if (this.roundB >= this.targetWins) {
        hud.flashEnd('蓝方获胜！按 R 重新开始'); camera.setKillCam(player); state.transit(States.ENDED);
        const grade = ResultScreen.gradeOf ? ResultScreen.gradeOf(this.playerKills, this.playerDamage, (performance.now() - this.matchStartTime) / 1000) : 'A';
        progression.recordWin(grade, (performance.now() - this.matchStartTime) / 1000); progressUI.refresh();
        resultScreen.show({ kills: this.playerKills, damage: this.playerDamage, time: (performance.now() - this.matchStartTime) / 1000, win: true });
        if (this.playerTaken === 0) daily.track('noDamageWin');
        const timeSec = (performance.now() - this.matchStartTime) / 1000;
        if (timeSec < 90) daily.track('speedWin', timeSec);
        if (grade === 'S') daily.track('winGrade');
        const reward = daily.claim(); if (reward > 0) { progression.addScore(reward); hud.flash('每日挑战完成！+' + reward + '分'); progressUI.refresh(); }
        bus.emit('daily.update', daily.challenges);
      }
      else { hud.flash('蓝方赢下本局！按 R 跳过'); state.transit(States.ROUND_END); this.roundEndTimer = 3; }
    } else if (winner === 'red') {
      this.roundR++; hud.setRound(this.roundB, this.roundR, this.targetWins);
      if (this.roundR >= this.targetWins) {
        hud.flashEnd('红方获胜！按 R 重新开始');
        if (player.lastAttacker) camera.setKillCam(player.lastAttacker);
        state.transit(States.ENDED); progression.recordLoss(); progressUI.refresh();
        resultScreen.show({ kills: this.playerKills, damage: this.playerDamage, time: (performance.now() - this.matchStartTime) / 1000, win: false });
      }
      else { hud.flash('红方赢下本局！按 R 跳过'); state.transit(States.ROUND_END); this.roundEndTimer = 3; }
    }
  }
}
