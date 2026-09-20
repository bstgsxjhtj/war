import * as THREE from 'three';
import { EventBus } from './core/EventBus.js';
import { GameState, States } from './core/GameState.js';
import { Time } from './core/Time.js';
import { Renderer } from './engine/Renderer.js';
import { Scene } from './engine/Scene.js';
import { Camera } from './engine/Camera.js';
import { Terrain } from './world/Terrain.js';
import { Environment } from './world/Environment.js';
import { Water } from './world/Water.js';
import { CombatSystem } from './gameplay/CombatSystem.js';
import { ComboSystem } from './gameplay/ComboSystem.js';
import { WeaponSkills } from './gameplay/WeaponSkills.js';
import { Player } from './gameplay/Player.js';
import { AIController } from './gameplay/AIController.js';
import { HUD } from './ui/HUD.js';
import { Deathmatch, Domination, SiegeMode } from './gameplay/GameMode.js';
import { TrajectoryPreview } from './gameplay/TrajectoryPreview.js';
import { SiegeStructure } from './world/SiegeStructure.js';
import { NetClient } from './net/NetClient.js';
import { RemotePlayer } from './gameplay/RemotePlayer.js';
import { Sword } from './gameplay/weapons/Sword.js';
import { Bow } from './gameplay/weapons/Bow.js';
import { Spear } from './gameplay/weapons/Spear.js';
import { SwordShield } from './gameplay/weapons/SwordShield.js';
import { Warhammer } from './gameplay/weapons/Warhammer.js';
import { SkillTree } from './gameplay/SkillTree.js';
import { SkillTreeUI } from './ui/SkillTreeUI.js';
import { TrainingMode } from './gameplay/TrainingMode.js';
import { Tutorial } from './ui/Tutorial.js';
import { AudioEngine } from './audio/AudioEngine.js';
import { WeatherSystem } from './world/WeatherSystem.js';
import { SettingsMenu } from './ui/SettingsMenu.js';
import { WaveMode } from './gameplay/WaveMode.js';
import { ResultScreen } from './ui/ResultScreen.js';
import { SupplyPoint } from './world/SupplyPoint.js';
import { MapGenerator } from './world/MapGenerator.js';
import { MiniMap } from './ui/MiniMap.js';
import { WeaponTrail, HitDirection, HitStop } from './render/WeaponTrail.js';
import { BossEnemy, EliteEnemy } from './gameplay/BossEnemy.js';
import { Progression, ProgressionUI } from './gameplay/Progression.js';
import { CampaignMode } from './gameplay/CampaignMode.js';
import { DailyChallenge } from './gameplay/DailyChallenge.js';
import { WeaponSkins, WeaponSkinsUI } from './gameplay/WeaponSkins.js';
import { Horse, CavalryEnemy } from './gameplay/Cavalry.js';
import { FormationController } from './gameplay/UnitFormation.js';

async function bootstrap() {
  const app = document.querySelector('#app');
  const canvas = document.createElement('canvas');
  app.appendChild(canvas);

  const bus = new EventBus();
  const state = new GameState(bus);
  const time = new Time(1 / 60, bus);

  const renderer = new Renderer(canvas);
  const scene = new Scene();
  const camera = new Camera(bus);
 await renderer.setup(scene.scene, camera.cam); window.__renderer = renderer;

  let currentMapKey = MapGenerator.recommendMap('死斗');
  let currentMapName = MapGenerator.MAPS[currentMapKey].name;
  let terrain, env;
  function loadMap(mapKey) {
    if (terrain) { scene.remove(terrain.mesh); }
    if (env) { scene.remove(env.group); }
    const r = MapGenerator.generate(mapKey);
    terrain = r.terrain;
    env = new Environment(terrain, r.layout);
    scene.add(terrain.mesh);
    scene.add(env.group);
    currentMapKey = mapKey;
    currentMapName = r.name;
    return r;
  }
  loadMap(currentMapKey);
  const water = new Water(currentMapKey === 'bridge' ? 360 : 100, 30);
  water.mesh.position.set(0, 0.2, 0);
  scene.add(water.mesh);
  const supply = new SupplyPoint();
  const resultScreen = new ResultScreen(bus);
  scene.add(supply.group);
  await water.init();

  const comboSys = new ComboSystem(bus);
  const weaponSkills = new WeaponSkills();
  const combat = new CombatSystem(scene.scene, bus, comboSys);
  const hud = new HUD(bus);
  const miniMap = new MiniMap(bus);
  const weaponTrail = new WeaponTrail(scene.scene);
  const hitDirection = new HitDirection();
  const hitStop = new HitStop();
  const progression = new Progression();
  const campaign = new CampaignMode(bus);
  const daily = new DailyChallenge(progression);
  const skins = new WeaponSkins(progression);
  const skinsUI = new WeaponSkinsUI(skins, bus);
  const horses = new Horse(scene.scene);
  const formations = new FormationController();
  bus.emit('daily.update', daily.challenges);
  bus.on('fx.perfectBlock', () => { if (daily.track('perfect')) bus.emit('daily.update', daily.challenges); });
  bus.on('fx.perfectDodge', () => { if (daily.track('dodge')) bus.emit('daily.update', daily.challenges); });
  const progressUI = new ProgressionUI(progression, bus);
  bus.emit('minimap.supply', (supply.points || []).map(p => ({ x: p.pos.x, z: p.pos.z })));
  bus.on('combat.hit', ({ attacker, victim, damage, combo, heavy, backstab }) => {
    if (victim && victim.isLocal && attacker) {
      const angle = Math.atan2(attacker.position.x - victim.position.x, attacker.position.z - victim.position.z);
      hitDirection.show(angle, camera.yaw || 0);
    }
    if (attacker && attacker.isLocal) {
      hitStop.trigger(heavy ? 0.12 : 0.06, 0.05);
      weaponTrail.activate(attacker._weaponMesh);
    }
    if (combo >= 3) daily.track('combo3');
    if (backstab) daily.track('backstab');
    bus.emit('daily.update', daily.challenges);
  });
  bus.on('combat.kill', ({ victim, killer }) => {
    if (killer && killer.isLocal) progression.recordKill();
    if (victim && victim.isLocal) progression.recordDeath();
    progressUI.refresh();
  });
  const siege = new SiegeStructure(scene.scene, bus);
  const trajectory = new TrajectoryPreview(scene.scene);
  const skills = new SkillTree();
  const skillUI = new SkillTreeUI(bus, skills);
  const audio = new AudioEngine();
  const weather = new WeatherSystem(scene.scene, scene.sun || null, scene.hemi || null, audio);
  const settings = new SettingsMenu(bus, audio);

  let player, ais = [], enemies = [];
  let remotes = [];
  let netInfo = null;
  const net = new NetClient('ws://127.0.0.1:3000');
  netInfo = await net.connect();
  if (netInfo) {
    hud.flash(netInfo.team === 0 ? '已连接多人：蓝方' : '已连接多人：红方');
    net.on('join', (msg) => {
      if (msg.id === net.id) return;
      if (remotes.find(r => r.netId === msg.id)) return;
      const rp = new RemotePlayer({ id: msg.id, team: msg.team });
      rp.spawn(new THREE.Vector3(0, terrain.heightAt(0, 0), 0));
      rp.setCameraRef(camera);
      scene.add(rp.root);
      remotes.push(rp);
      if (player) enemies = [player, ...ais, ...remotes];
    });
    net.on('state', (msg) => {
      const rp = remotes.find(r => r.netId === msg.id);
      if (rp) rp.setTarget(msg.pos, msg.yaw, msg.hp, msg.weapon, msg.alive, msg.anim);
    });
    net.on('leave', (msg) => {
      const i = remotes.findIndex(r => r.netId === msg.id);
      if (i >= 0) { scene.remove(remotes[i].root); remotes.splice(i, 1); if (player) enemies = [player, ...ais, ...remotes]; }
    });
    net.on('hit', (msg) => {
      if (msg.victim === net.id && player && player.alive) {
        player.takeDamage(msg.dmg, msg.heavy, null, performance.now() * 0.001);
      }
    });
    bus.on('combat.hit', ({ victim, damage, heavy }) => {
      if (victim && victim.netId && net.connected) net.sendHit(victim.netId, damage, heavy);
    });
  } else {
    hud.flash('单机模式（未连服务器）');
  }
  let scoreB = 0, scoreR = 0;
  let roundB = 0, roundR = 0;
  const targetWins = 2;
  let roundEndTimer = 0;
  let playerKills = 0, playerDamage = 0, matchStartTime = performance.now();
  let mode = new Deathmatch(bus);

  bus.on('combat.kill', ({ team, killer, victim }) => {
    if (team === 1) scoreB++; else scoreR++;
    hud.setScore(scoreB, scoreR);
    if (killer && killer.isLocal) { playerKills++; skills.addPoint(1); hud.flash('+1 技能点 (按 K 分配)'); setTimeout(() => hud.clearHint(), 1500); daily.track('kills'); if (victim && victim._isBoss) daily.track('bossKill'); bus.emit('daily.update', daily.challenges); }
  });

  function spawnAll() {
    combat.clear();
    horses.dispose();
    formations.clear();
    if (player) scene.remove(player.root);
    for (const a of ais) scene.remove(a.root);
    ais = [];
    player = new Player(camera, bus);
    player.setComboSys(comboSys);
    comboSys.count = 0; comboSys._tier = 0; comboSys._finisher = false;
    player.setWeaponSkills(weaponSkills);
    weaponSkills.reset();
    player.setWeapons([new Sword(), new Bow(), new Spear(), new Warhammer()]);
    player.setSkill(skills);
    const spawns = MapGenerator.MAPS[currentMapKey].spawns;
    const lb = spawns.blue[0];
    player.spawn(new THREE.Vector3(lb.x, terrain.heightAt(lb.x, lb.z), lb.z));
    player.setCameraRef(camera);
    scene.add(player.root);
    combat.register(player);
    if (player._weaponMesh) weaponTrail.attach(player._weaponMesh, 0xfff0a0);
    if (player._weaponMesh) skins.applyToWeapon(player._weaponMesh, player.weaponIdx);
    bus.on('skins.changed', () => { if (player._weaponMesh) skins.applyToWeapon(player._weaponMesh, player.weaponIdx); });
    const redLayout = spawns.red;
    const aiWeaponMakers = [() => new Spear(), () => new SwordShield(), () => new Warhammer(), () => new Bow()];
    const unlocks = progression.unlocks;
    for (let i = 0; i < redLayout.length; i++) {
      let ai;
      if (i === 0 && unlocks.boss && mode.name !== '训练场') {
        ai = new BossEnemy({ team: 1, type: 'warlord' });
      } else if (i === 1 && unlocks.elite && mode.name !== '训练场') {
        ai = new EliteEnemy({ team: 1 });
      } else if (i === 2 && mode.name !== '训练场' && progression.score >= 500) {
        ai = new CavalryEnemy({ team: 1 });
        const horse = horses.create();
        ai.mount(horse);
      } else {
        ai = new AIController({ team: 1, passive: mode.name === '训练场', maxHp: mode.name === '训练场' ? 500 : 90 });
      }
      const p = redLayout[i];
      ai.spawn(new THREE.Vector3(p.x, terrain.heightAt(p.x, p.z), p.z));
      ai.setWeapons([aiWeaponMakers[i % aiWeaponMakers.length]()]);
      ai.setCameraRef(camera);
      scene.add(ai.root);
      combat.register(ai);
      if (ai._weaponMesh) weaponTrail.attach(ai._weaponMesh, ai.team === 1 ? 0xff8060 : 0x60a0ff);
      ais.push(ai);
    }
    if (mode.name !== '训练场' && ais.length >= 3) {
      const shieldUsers = ais.filter(a => a.weapons && a.weapons[0] && a.weapons[0].weaponClass === 'SHIELD');
      const bowUsers = ais.filter(a => a.weapons && a.weapons[0] && a.weapons[0].weaponClass === 'BOW');
      if (shieldUsers.length >= 2) formations.createShieldWall(shieldUsers[0], shieldUsers.slice(1));
      if (bowUsers.length >= 2) formations.createArcherLine(bowUsers[0], bowUsers.slice(1));
    }
    enemies = [player, ...ais];
    hud.setRefs(player, ais, camera);
    miniMap.setRefs(player, ais, camera.cam);
    miniMap.setWorldSize(MapGenerator.MAPS[currentMapKey].size[0]);
  }

  function startRound() {
    scoreB = 0; scoreR = 0;
    playerKills = 0; playerDamage = 0; matchStartTime = performance.now();
    hud.setScore(0, 0);
    hud.clearHint();
    spawnAll();
    state.transit(States.READY);
    state.transit(States.PLAYING);
    hud.flash('遭遇战开始！点击锁定鼠标');
    setTimeout(() => hud.clearHint(), 1800);
  }

  function restart() {
    resultScreen.hide();
    roundB = 0; roundR = 0;
    hud.setRound(roundB, roundR, targetWins);
    startRound();
  }
  bus.on('round.restart', () => { if (state.current === States.ENDED) restart(); });

  window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyR') {
      if (state.current === States.ENDED) restart();
      else if (state.current === States.ROUND_END) { roundEndTimer = 0; startRound(); }
    }
    if (e.code === 'KeyM' && (state.current === States.ENDED || state.current === States.ROUND_END || state.current === States.PLAYING && !player?.alive)) {
      mode = mode.name === '死斗' ? new Domination(bus) : (mode.name === '据点' ? new SiegeMode(bus) : (mode.name === '攻城' ? new WaveMode(bus) : (mode.name === '波次' ? campaign : new Deathmatch(bus))));
      if (mode.name === '战役') {
        const layout = campaign.spawnLayout();
        loadMap(layout.mapKey);
        if (layout.weather) weather.setMode(layout.weather);
      } else {
        const newMapKey = MapGenerator.recommendMap(mode.name);
        loadMap(newMapKey);
      }
      hud.setMode(mode.name + ' · ' + currentMapName);
      restart();
    }
    if (e.code === 'Comma' && (state.current === States.ENDED || state.current === States.ROUND_END)) {
      const next = MapGenerator.cycleMap(currentMapKey);
      loadMap(next);
      hud.flash('地图：' + currentMapName);
      restart();
    }
    if (e.code === 'KeyK') { skillUI.toggle(); }
    if (e.code === 'KeyC') { hud.flash('战役：第' + (campaign.stage + 1) + '关 ' + campaign.currentStage.name); }
    if (e.code === 'KeyD') {
      const done = daily.challenges.filter(c => c.done).length;
      hud.flash('每日挑战：' + done + '/' + daily.challenges.length + ' 完成');
    }
    if (e.code === 'KeyN') { weather.toggle(); const wm = { clear: '晴', rain: '雨', night: '夜', snow: '雪', storm: '雷暴' }; hud.flash('天气：' + (wm[weather.mode] || weather.mode)); setTimeout(() => hud.clearHint(), 1500); }
    if (e.code === 'Escape') settings.toggle();
  });

  function checkWin() {
    if (state.current !== States.PLAYING) return;
    if (mode.name === '战役') {
      const winner = campaign.checkWin(player.alive, ais.some(a => a.alive), siege.gate);
      if (winner === 'blue') {
        const result = campaign.onStageClear();
        if (result === 'campaign_complete') {
          hud.flashEnd('战役通关！按 R 重玩');
          progression.recordWin('S', 0);
          state.transit(States.ENDED);
          resultScreen.show({ kills: playerKills, damage: playerDamage, time: 0, win: true });
        } else {
          const layout = campaign.spawnLayout();
          loadMap(layout.mapKey);
          if (layout.weather) weather.setMode(layout.weather);
          hud.flash('关卡通过！按 R 进入下一关');
          state.transit(States.ROUND_END);
          roundEndTimer = 3;
        }
        return;
      } else if (winner === 'red') {
        hud.flashEnd('战役失败！按 R 重试本关');
        state.transit(States.ENDED);
        resultScreen.show({ kills: playerKills, damage: playerDamage, time: 0, win: false });
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
      roundB++; hud.setRound(roundB, roundR, targetWins);
      if (roundB >= targetWins) { hud.flashEnd('蓝方获胜！按 R 重新开始'); camera.setKillCam(player); state.transit(States.ENDED); const grade = ResultScreen.gradeOf ? ResultScreen.gradeOf(playerKills, playerDamage, (performance.now() - matchStartTime) / 1000) : 'A'; progression.recordWin(grade, (performance.now() - matchStartTime) / 1000); progressUI.refresh(); resultScreen.show({ kills: playerKills, damage: playerDamage, time: (performance.now() - matchStartTime) / 1000, win: true }); if (playerDamage === 0) daily.track('noDamageWin'); const timeSec = (performance.now() - matchStartTime) / 1000; if (timeSec < 90) daily.track('speedWin', timeSec); if (grade === 'S') daily.track('winGrade'); const reward = daily.claim(); if (reward > 0) { progression.addScore(reward); hud.flash('每日挑战完成！+' + reward + '分'); progressUI.refresh(); } bus.emit('daily.update', daily.challenges); }
      else { hud.flash('蓝方赢下本局！按 R 跳过'); state.transit(States.ROUND_END); roundEndTimer = 3; }
    } else if (winner === 'red') {
      roundR++; hud.setRound(roundB, roundR, targetWins);
      if (roundR >= targetWins) { hud.flashEnd('红方获胜！按 R 重新开始'); if (player.lastAttacker) camera.setKillCam(player.lastAttacker); state.transit(States.ENDED); progression.recordLoss(); progressUI.refresh(); resultScreen.show({ kills: playerKills, damage: playerDamage, time: (performance.now() - matchStartTime) / 1000, win: false }); }
      else { hud.flash('红方赢下本局！按 R 跳过'); state.transit(States.ROUND_END); roundEndTimer = 3; }
    }
  }

  spawnAll();
  state.transit(States.PLAYING);
  hud.setRound(0, 0, targetWins);
  hud.setMode(mode.name + ' · ' + currentMapName);
  hud.flash('点击锁定鼠标 · WASD移动 · 左键攻击 · 右键格挡/蓄力 · Tab锁定 · Q闪避 · 1-4切换武器 · M切换模式');
  setTimeout(() => hud.clearHint(), 5000);
  let tutorial = null;
  try { if (!localStorage.getItem('tutorial_done')) tutorial = new Tutorial(); } catch (e) {}

  function loop() {
    time.tick(
      (dt) => {
        const now = time.now * 0.001;
        if (state.current === States.ROUND_END) {
          roundEndTimer -= dt;
          env.update(dt, now);
          water.update(dt, now);
          if (roundEndTimer <= 0) startRound();
          renderer.render();
          return;
        }
        if (state.current !== States.PLAYING) { env.update(dt, now); return; }

        if (combat.hitstop > 0) combat.hitstop = Math.max(0, combat.hitstop - dt);
        const ldt = (combat.hitstop > 0 || hitStop.active) ? 0 : dt;

        const weatherFx = weather.getCombatEffects();
        player._weatherEffects = weatherFx;
        for (const ai of ais) ai._weatherEffects = weatherFx;
        combat._weatherEffects = weatherFx;
        player.update(ldt, terrain, combat, now);
        for (const a of ais) a.update(ldt, terrain, combat, enemies, now);
        for (const rp of remotes) rp.update(ldt, terrain, combat, now);
        combat.update(ldt, terrain, now);
        comboSys.update(ldt, now);
        horses.update(ldt);
        formations.update(ldt);
        if (net.connected && player.alive) {
          net._acc = (net._acc || 0) + dt;
          if (net._acc >= 0.05) {
            net._acc = 0;
            net.sendState(player.position, player._yaw, player.health.cur, player.weaponIdx, player.alive, player._attacking ? 'attack' : 'idle');
          }
        }
        env.update(dt, now);
        water.update(dt, now);
        scene.updateCloud(now);
        supply.update(player, dt, now);
        siege.update(dt, combat);
        weaponTrail.update(dt, now);
        hitDirection.update(dt);
        hitStop.update(dt);
        miniMap.setWorldSize(MapGenerator.MAPS[currentMapKey].size[0]);
        miniMap.update(dt);
        progressUI.update(dt);
        hud.setHealth(player);
        hud.setStamina(player.stamina);
        hud.setRage(player); window.__mp = { connected: net.connected, id: net.id, remotes: remotes.length };
        hud.setCharge(player.charge);
        if (player.weapon.type === 'projectile' && player.charge > 0.05) {
          const origin = player.position.clone().add(new THREE.Vector3(0, 1.5, 0)).add(player.forward.clone().multiplyScalar(0.7));
          trajectory.show(origin, player.forward, player.weapon.speedFor ? player.weapon.speedFor(player.charge) : 50);
        } else trajectory.hide();
        hud.setWeapon(player.weaponIdx, player.weapons.length);
        hud.setCombo(player);
        hud.setSkillCooldowns(weaponSkills);
        if (mode.name === '据点') { mode.onTick(dt, combat.characters); hud.setDomination(mode); }
        hud.update(dt);
        if (mode.name === '战役') hud.setMode('战役', campaign.stageInfo);
        checkWin();
      },
      () => { renderer.render(); }
    );
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
}

bootstrap();
