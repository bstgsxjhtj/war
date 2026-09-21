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
import { AIManager } from './gameplay/AIManager.js';
import { EscortTarget } from './gameplay/EscortTarget.js';
import { DefensePoint } from './gameplay/DefensePoint.js';
import { Affixes } from './gameplay/Affixes.js';
import { Achievements } from './gameplay/Achievements.js';
import { AffixesUI } from './ui/AffixesUI.js';
import { AchievementsUI } from './ui/AchievementsUI.js';
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
import { SaveManager } from './gameplay/SaveManager.js';
import { SaveUI } from './ui/SaveUI.js';

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
  const affixes = new Affixes();
  const achievements = new Achievements();
  achievements.setBus(bus);
  const combat = new CombatSystem(scene.scene, bus, comboSys);
  const aiManager = new AIManager(bus);
  const AI_DIFFICULTY = 'normal';
  aiManager.setDifficulty(AI_DIFFICULTY);
  const hud = new HUD(bus);
  bus.on('combat.kill', (p) => { if (p && p.killer && p.killer.isLocal) achievements.check('combat.kill', p); });
  bus.on('combo.tier', (p) => achievements.check('combo.tier', p));
  bus.on('skill.cast', (p) => { achievements.check('skill.cast', p); audio.playSound('ultimate'); });
  bus.on('campaign.clear', (p) => achievements.check('campaign.clear', p));
  bus.on('campaign.perfect', (p) => achievements.check('campaign.perfect', p));
  bus.on('combat.backstab', (p) => achievements.check('combat.backstab', p));
  bus.on('combat.perfectblock', (p) => achievements.check('combat.perfectblock', p));
  bus.on('combat.dodge', (p) => achievements.check('combat.dodge', p));
  bus.on('combat.cavalrykill', (p) => achievements.check('combat.cavalrykill', p));
  bus.on('daily.completed', (p) => achievements.check('daily.completed', p));
  bus.on('achievement.unlock', ({ name, reward }) => {
    if (reward.skillPoint) skills.addPoint(reward.skillPoint);
    if (reward.affix) affixes.grant(reward.affix[0], reward.affix[1]);
    if (reward.skin && skins) skins.unlock(reward.skin);
    hud.flash('成就解锁：' + name);
    audio.playSound('achievement');
  });
  bus.on('affix.drop', ({ type, tier }) => hud.flash('词条掉落：' + type));
  bus.on('boss.summon', ({ pos, team, count }) => {
    for (let i = 0; i < count; i++) {
      const e = new AIController({ team, passive: false, maxHp: Math.round(50 * aiManager.difficulty().maxHpMul) });
      e.setBus(bus); e.setWeapons([new Sword()]); e.setAIManager(aiManager);
      const px = pos.x + (Math.random()-0.5)*6, pz = pos.z + (Math.random()-0.5)*6;
      e.spawn(new THREE.Vector3(px, terrain.heightAt(px, pz), pz));
      e.setCameraRef(camera); scene.add(e.root); combat.register(e); ais.push(e);
    }
    audio.playSound('ultimate');
  });
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
  bus.on('fx.perfectBlock', () => { if (daily.track('perfect')) bus.emit('daily.update', daily.challenges); bus.emit('combat.perfectblock', {}); audio.playSound('block'); });
  bus.on('fx.perfectDodge', () => { if (daily.track('dodge')) bus.emit('daily.update', daily.challenges); bus.emit('combat.dodge', {}); audio.playSound('dodge'); });
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
      match.playerDamage += damage || 0;
    }
    if (victim && victim.isLocal) match.playerTaken += damage || 0;
    if (backstab) { daily.track('backstab'); if (attacker && attacker.isLocal) bus.emit('combat.backstab', { attacker, victim }); }
    bus.emit('daily.update', daily.challenges);
    audio.playSound('swing');
    audio.playSound('hit', { heavy, combo });
  });
  bus.on('combat.kill', ({ victim, killer }) => {
    if (killer && killer.isLocal) progression.recordKill();
    if (victim && victim.isLocal) progression.recordDeath();
    progressUI.refresh();
    audio.playSound('ultimate');
  });
  const siege = new SiegeStructure(scene.scene, bus);
  const trajectory = new TrajectoryPreview(scene.scene);
  const skills = new SkillTree();
  const skillUI = new SkillTreeUI(bus, skills);
  const saveManager = new SaveManager();
  const audio = new AudioEngine();
  const _resumeOnce = () => { audio.resume(); window.removeEventListener('keydown', _resumeOnce); window.removeEventListener('mousedown', _resumeOnce); };
  window.addEventListener('keydown', _resumeOnce); window.addEventListener('mousedown', _resumeOnce);
  const weather = new WeatherSystem(scene.scene, scene.sun || null, scene.hemi || null, audio);
  weather.setAudio(audio);
  const settings = new SettingsMenu(bus, audio);
  bus.on('settings.quality', ({ quality }) => { if (renderer) renderer.setQuality(quality); });
  bus.on('settings.sensitivity', ({ sensitivity }) => { if (player) player.lookSensitivity = sensitivity; });
  bus.on('settings.difficulty', ({ difficulty }) => { if (aiManager) aiManager.setDifficulty(difficulty); });
  // 启动应用延后到 player/aiManager 赋值后避免 TDZ
  bus.on('hud.bossPhase', () => audio.playSound('ultimate'));
  bus.on('combo.tier', (p) => audio.playSound('hit', { combo: p.combo || 0 }));

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
  let mode = new Deathmatch(bus);
  const match = new MatchController({
    bus, state, hud, resultScreen, camera, progression, progressUI, daily, skills, campaign, siege, weather, audio,
    saveManager,
    spawnAll: () => spawnAll(),
    saveNow: () => saveManager.save(captureSave()),
    loadMap: (k) => loadMap(k),
    mapName: () => currentMapName,
    getPlayer: () => player,
    getAis: () => ais,
    getMode: () => mode
  });

  let playTimeSec = 0;
  const captureSave = () => {
    const slots = {};
    if (player && player.weapons) {
      for (const w of player.weapons) {
        if (w && w.affixes) slots[w.weaponClass] = w.affixes.map(a => a ? { type: a.type, tier: a.tier } : null);
      }
    }
    return {
      mode: mode.name,
      stage: campaign.stage,
      campaignCompleted: campaign.cleared >= campaign.maxStages,
      score: progression.score,
      kills: progression.kills,
      bestGrade: progression.getStats().bestGrade,
      affixSlots: slots,
      skillPoints: skills.points,
      skillTree: skills.serialize(),
      playTime: playTimeSec
    };
  };
  const resetSave = () => {
    saveManager.reset();
    progression.reset();
    campaign.reset(); campaign.cleared = 0; campaign._saveCleared();
    skills.reset(); skills.points = 0; skills._save();
    affixes.inventory = []; affixes._save();
    daily._data = { date: '', challenges: [], progress: {}, claimed: false }; daily._save();
    skins._data = { unlocked: { default: true }, equipped: { 0: 'default', 1: 'default', 2: 'default', 3: 'default' } }; skins._save();
    achievements._data = {}; achievements._save();
    ['campaign_cleared', 'progression_v1', 'skilltree_v1', 'achievements', 'affixes', 'daily_challenge', 'weapon_skins', 'tutorial_done', 'settings', 'audio_volume'].forEach(k => { try { localStorage.removeItem(k); } catch (e) {} });
    playTimeSec = 0;
    if (player && player.weapons) for (const w of player.weapons) w.affixes = [null, null];
      hud.flash('进度已重置');
    };
  const saveUI = new SaveUI(bus, saveManager, captureSave, resetSave);
  bus.on('skins.changed', ({ weaponIdx }) => { if (player && player._weaponMesh) skins.applyToWeapon(player._weaponMesh, weaponIdx); });
  // 启动加载应用存档
  const _saved = saveManager.load();
  if (_saved) {
    if (_saved.mode === '战役' && typeof _saved.stage === 'number') campaign.stage = Math.min(_saved.stage, campaign.maxStages - 1);
    progression.restore(_saved);
    if (_saved.skillTree) { skills.restore(_saved.skillTree); } else if (typeof _saved.skillPoints === 'number') { skills.points = _saved.skillPoints; }
    playTimeSec = _saved.playTime || 0;
  }
  setInterval(() => { if (state.current === States.PLAYING) playTimeSec++; }, 1000);
  setInterval(() => { if (state.current === States.PLAYING) saveManager.save(captureSave()); }, 60000);
  window.addEventListener('beforeunload', () => { try { saveManager.save(captureSave()); } catch (e) { /* ignore */ } });

  function spawnRed(redLayout, { bossWave = false } = {}) {
    const aiWeaponMakers = [() => new Spear(), () => new SwordShield(), () => new Warhammer(), () => new Bow()];
    const unlocks = progression.unlocks;
    for (let i = 0; i < redLayout.length; i++) {
      let ai;
      if (i === 0 && (campaign.currentStage.bossType || bossWave) && mode.name !== '训练场') {
        ai = new BossEnemy({ team: 1, type: bossWave ? 'warlord' : (campaign.currentStage.bossType || 'warlord'), mini: bossWave ? false : (campaign.currentStage.mini || false) });
      } else if (i === 1 && unlocks.elite && mode.name !== '训练场') {
        ai = new EliteEnemy({ team: 1 });
      } else if (i === 2 && mode.name !== '训练场' && progression.score >= 500) {
        ai = new CavalryEnemy({ team: 1 });
        const horse = horses.create();
        ai.mount(horse);
      } else {
        ai = new AIController({ team: 1, passive: mode.name === '训练场', maxHp: mode.name === '训练场' ? 500 : Math.round(90 * aiManager.difficulty().maxHpMul) });
      }
      const p = redLayout[i];
      ai.spawn(new THREE.Vector3(p.x, terrain.heightAt(p.x, p.z), p.z));
      ai.setWeapons([aiWeaponMakers[i % aiWeaponMakers.length]()]);
      ai.setCameraRef(camera);
      ai.setAIManager(aiManager);
      if (!ai._isBoss && !ai._isElite && Math.random() < 0.15) { ai.setIsElite(true); ai._eliteSkill = ['blockCounter','dodgeStrike','enrage'][Math.floor(Math.random()*3)]; }
      scene.add(ai.root);
      combat.register(ai);
      if (ai._weaponMesh) weaponTrail.attach(ai._weaponMesh, ai.team === 1 ? 0xff8060 : 0x60a0ff);
      ais.push(ai);
    }
    aiManager.assignSquad(ais);
    if (mode.name !== '训练场' && ais.length >= 3) {
      const shieldUsers = ais.filter(a => a.weapons && a.weapons[0] && a.weapons[0].weaponClass === 'SHIELD');
      const bowUsers = ais.filter(a => a.weapons && a.weapons[0] && a.weapons[0].weaponClass === 'BOW');
      if (shieldUsers.length >= 2) formations.createShieldWall(shieldUsers[0], shieldUsers.slice(1));
      if (bowUsers.length >= 2) formations.createArcherLine(bowUsers[0], bowUsers.slice(1));
    }
    for (const ai of ais) ai.setAudio(audio);
  }

  function spawnAll() {
    combat.clear();
    horses.dispose();
    formations.clear();
    if (player) { if (player.dispose) player.dispose(); scene.remove(player.root); }
    for (const a of ais) scene.remove(a.root);
    ais = [];
    player = new Player(camera, bus);
    player.setComboSys(comboSys);
    comboSys.count = 0; comboSys._tier = 0; comboSys._finisher = false;
    player.setWeaponSkills(weaponSkills);
    weaponSkills.reset();
    combat.setAffixes(affixes);
    player.setAffixes(affixes);
    player.setWeapons([new Sword(), new Bow(), new Spear(), new Warhammer()]);
    const _savedAff = saveManager.load();
    if (_savedAff && _savedAff.affixSlots) {
      for (const w of player.weapons) {
        if (w && _savedAff.affixSlots[w.weaponClass]) w.affixes = _savedAff.affixSlots[w.weaponClass].map(a => a ? { ...a } : null);
      }
    }
    player.setSkill(skills);
    const spawns = MapGenerator.MAPS[currentMapKey].spawns;
    const lb = spawns.blue[0];
    player.spawn(new THREE.Vector3(lb.x, terrain.heightAt(lb.x, lb.z), lb.z));
    player.setCameraRef(camera);
    scene.add(player.root);
    combat.register(player);
    if (player._weaponMesh) weaponTrail.attach(player._weaponMesh, 0xfff0a0);
    if (player._weaponMesh) skins.applyToWeapon(player._weaponMesh, player.weaponIdx);
    let redLayout, bossWave = false;
    if (mode.name === '战役') redLayout = campaign.spawnLayout().red;
    else if (mode.name === '波次') { const lay = mode.spawnLayout(); redLayout = lay.red; bossWave = lay.isBoss; }
    else redLayout = spawns.red;
    spawnRed(redLayout, { bossWave });
    if (mode.name === '战役') {
      match.escortTarget = null; match.defenseTimer = 0; match.timeLimit = 0; match.surviveWavesDone = false; match.surviveTimer = 0;
      const s = campaign.currentStage;
      if (s.objective === '护送') { match.escortTarget = new EscortTarget({ x: -160, z: 0 }, { x: 160, z: 0 }, 80); scene.add(match.escortTarget.root); }
      if (s.objective === '防御') { match.defenseTimer = 60; }
      if (s.objective === 'Boss限时') { match.timeLimit = 120; }
      if (s.objective === '生存') { match.surviveTimer = s.surviveTime || 90; }
    }
    enemies = [player, ...ais];
    hud.setRefs(player, ais, camera);
    miniMap.setRefs(player, ais, camera.cam);
    miniMap.setWorldSize(MapGenerator.MAPS[currentMapKey].size[0]);
    player.setAudio(audio); for (const ai of ais) ai.setAudio(audio);
  }

  window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyR') {
      if (state.current === States.ENDED) match.restart();
      else if (state.current === States.ROUND_END) { match.roundEndTimer = 0; match.startRound(); }
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
    if (e.code === 'KeyC') { hud.flash('战役：第' + (campaign.stage + 1) + '关 ' + campaign.currentStage.name); }
    if (e.code === 'KeyD') {
      const done = daily.challenges.filter(c => c.done).length;
      hud.flash('每日挑战：' + done + '/' + daily.challenges.length + ' 完成');
    }
    if (e.code === 'KeyN') { weather.toggle(); const wm = { clear: '晴', rain: '雨', night: '夜', snow: '雪', storm: '雷暴' }; hud.flash('天气：' + (wm[weather.mode] || weather.mode)); setTimeout(() => hud.clearHint(), 1500); }
    if (e.code === 'Escape') settings.toggle();
  });


  spawnAll();
  const affixesUI = new AffixesUI(affixes, player);
  const achievementsUI = new AchievementsUI(achievements);
  state.transit(States.PLAYING);
  hud.setRound(0, 0, match.targetWins);
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
          match.roundEndTimer -= dt;
          env.update(dt, now);
          water.update(dt, now);
          if (match.roundEndTimer <= 0) match.startRound();
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
        if (mode.name === '战役') {
          const redAlive = ais.filter(a => a.alive).length;
          if (match.defenseTimer > 0) match.defenseTimer -= dt;
          if (match.timeLimit > 0) match.timeLimit -= dt;
          if (match.surviveTimer > 0) {
            match.surviveTimer -= dt;
            if (match.surviveTimer <= 0 && !match.surviveWavesDone) { match.surviveWavesDone = true; hud.flash('生存时间达成！'); setTimeout(() => hud.clearHint(), 1500); }
          }
          if (match.escortTarget) match.escortTarget.update(dt, player);
          campaign.onTick(dt, {
            redAlive,
            spawnReinforce: (n) => { for (let i = 0; i < n; i++) { const e = new AIController({ team: 1, passive: false, maxHp: Math.round(90 * (campaign.currentStage.difficulty || 1)) }); e.setBus(bus); e.setWeapons([new Spear()]); e.setAIManager(aiManager); if (!e._isBoss && !e._isElite && Math.random() < 0.15) { e.setIsElite(true); e._eliteSkill = ['blockCounter','dodgeStrike','enrage'][Math.floor(Math.random()*3)]; } const px = 160 + (Math.random() - 0.5) * 40; const pz = (Math.random() - 0.5) * 120; e.spawn(new THREE.Vector3(px, terrain.heightAt(px, pz), pz)); e.setCameraRef(camera); scene.add(e.root); combat.register(e); ais.push(e); } },
            boss: ais.find(a => a instanceof BossEnemy),
            progress: redAlive / (campaign.currentStage.enemyCount || 1),
            setWeather: (w) => weather.setMode(w),
          });
        }
        if (mode.name === '波次' && ais.length > 0 && !ais.some(a => a.alive) && mode.wave < mode.targetWave) {
          const lay = mode.spawnLayout();
          spawnRed(lay.red, { bossWave: lay.isBoss });
          enemies = [player, ...ais];
          hud.flash('第 ' + mode.wave + ' 波来袭！');
          setTimeout(() => hud.clearHint(), 1500);
        }
        match.checkWin();
      },
      () => { renderer.render(); }
    );
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
}

bootstrap();
