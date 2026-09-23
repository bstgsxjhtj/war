import * as THREE from 'three';
import { TextureFactory } from './render/TextureFactory.js';
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
import { Progression } from './gameplay/Progression.js';
import { ProgressionUI } from './ui/ProgressionUI.js';
import { CampaignMode } from './gameplay/CampaignMode.js';
import { DailyChallenge } from './gameplay/DailyChallenge.js';
import { WeaponSkins } from './gameplay/WeaponSkins.js';
import { WeaponSkinsUI } from './ui/WeaponSkinsUI.js';
import { Horse, CavalryEnemy } from './gameplay/Cavalry.js';
import { FormationController } from './gameplay/UnitFormation.js';
import { SaveManager } from './gameplay/SaveManager.js';
import { SaveUI } from './ui/SaveUI.js';
import { MatchController } from './app/MatchController.js';
import { SaveOrchestrator } from './app/SaveOrchestrator.js';
import { Spawner } from './gameplay/Spawner.js';
import { wireAchievements } from './app/AchievementWiring.js';
import { InputRouter } from './app/InputRouter.js';
import { installUIStackEscape } from './ui/UIStack.js';
import { EV } from './core/constants/events.js';
import { LS } from './core/constants/storage-keys.js';

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
  let _lastMiniMapKey = null;
  let terrain, env;
  const _terrainTextures = {
    map: TextureFactory.noise(256, 256, '#5a6a3a', 30, 24),
    normalMap: TextureFactory.normal(256, 256, 0.4)
  };
  function loadMap(mapKey) {
    if (terrain) { scene.remove(terrain.mesh); }
    if (env) { scene.remove(env.group); }
    const r = MapGenerator.generate(mapKey, { textures: _terrainTextures });
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
  const achievements = new Achievements(bus);
  const combat = new CombatSystem(scene.scene, bus, comboSys);
  const aiManager = new AIManager(bus);
  const AI_DIFFICULTY = 'normal';
  aiManager.setDifficulty(AI_DIFFICULTY);
  const hud = new HUD(bus);
  bus.on(EV.COMBAT_KILL, (p) => { if (p && p.killer && p.killer.isLocal) achievements.check(EV.COMBAT_KILL, p); });
  bus.on(EV.COMBO_TIER, (p) => achievements.check(EV.COMBO_TIER, p));
  bus.on(EV.SKILL_CAST, (p) => { achievements.check(EV.SKILL_CAST, p); audio.playSound('ultimate'); });
  bus.on(EV.CAMPAIGN_CLEAR, (p) => achievements.check(EV.CAMPAIGN_CLEAR, p));
  bus.on(EV.CAMPAIGN_PERFECT, (p) => achievements.check(EV.CAMPAIGN_PERFECT, p));
  bus.on(EV.COMBAT_BACKSTAB, (p) => achievements.check(EV.COMBAT_BACKSTAB, p));
  bus.on(EV.COMBAT_PERFECTBLOCK, (p) => achievements.check(EV.COMBAT_PERFECTBLOCK, p));
  bus.on(EV.COMBAT_DODGE, (p) => achievements.check(EV.COMBAT_DODGE, p));
  bus.on(EV.COMBAT_CAVALRYKILL, (p) => achievements.check(EV.COMBAT_CAVALRYKILL, p));
  bus.on(EV.DAILY_COMPLETED, (p) => achievements.check(EV.DAILY_COMPLETED, p));
  bus.on(EV.ACHIEVEMENT_UNLOCK, ({ name, reward }) => {
    if (reward.skillPoint) skills.addPoint(reward.skillPoint);
    if (reward.affix) affixes.grant(reward.affix[0], reward.affix[1]);
    if (reward.skin && skins) skins.unlock(reward.skin);
    hud.flash('成就解锁：' + name);
    audio.playSound('achievement');
  });
  bus.on(EV.AFFIX_DROP, ({ type, tier }) => hud.flash('词条掉落：' + type));
  bus.on(EV.BOSS_SUMMON, ({ pos, team, count }) => {
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
  const daily = new DailyChallenge(progression, bus);
  const skins = new WeaponSkins(progression);
  const skinsUI = new WeaponSkinsUI(skins, bus);
  const horses = new Horse(scene.scene);
  const formations = new FormationController();
  bus.emit(EV.DAILY_UPDATE, daily.challenges);
  bus.on(EV.FX_PERFECTBLOCK, () => { if (daily.track('perfect')) bus.emit(EV.DAILY_UPDATE, daily.challenges); bus.emit(EV.COMBAT_PERFECTBLOCK, {}); audio.playSound('block'); hitStop.trigger(0.3, 0.05); bus.emit(EV.FX_SHAKE, { amount: 0.6 }); });
  bus.on(EV.FX_PERFECTDODGE, () => { if (daily.track('dodge')) bus.emit(EV.DAILY_UPDATE, daily.challenges); bus.emit(EV.COMBAT_DODGE, {}); audio.playSound('dodge'); });
  const progressUI = new ProgressionUI(progression, bus);
  bus.emit(EV.MINIMAP_SUPPLY, (supply.points || []).map(p => ({ x: p.pos.x, z: p.pos.z })));
  bus.on(EV.COMBAT_HIT, ({ attacker, victim, damage, combo, heavy, backstab }) => {
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
    if (backstab) { daily.track('backstab'); if (attacker && attacker.isLocal) bus.emit(EV.COMBAT_BACKSTAB, { attacker, victim }); }
    bus.emit(EV.DAILY_UPDATE, daily.challenges);
    audio.playSound('swing');
    audio.playSound('hit', { heavy, combo });
  });
  bus.on(EV.COMBAT_KILL, ({ victim, killer }) => {
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
  const weather = new WeatherSystem(scene.scene, scene.sun || null, scene.hemi || null, audio);
  weather.setAudio(audio);
  const settings = new SettingsMenu(bus, audio);
  bus.on(EV.SETTINGS_QUALITY, ({ quality }) => { if (renderer) renderer.setQuality(quality); });
  bus.on(EV.SETTINGS_SENSITIVITY, ({ sensitivity }) => { if (player) player.lookSensitivity = sensitivity; });
  bus.on(EV.SETTINGS_DIFFICULTY, ({ difficulty }) => { if (aiManager) aiManager.setDifficulty(difficulty); });
  // 启动应用延后到 player/aiManager 赋值后避免 TDZ
  bus.on(EV.HUD_BOSSPHASE, () => audio.playSound('ultimate'));
  bus.on(EV.COMBAT_ULTIMATE, () => audio.playSound('ultimate'));
  bus.on(EV.COMBAT_COUNTER, () => audio.playSound('counter'));
  bus.on(EV.COMBO_TIER, (p) => audio.playSound('hit', { combo: p.combo || 0 }));

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
    bus.on(EV.COMBAT_HIT, ({ victim, damage, heavy }) => {
      if (victim && victim.netId && net.connected) net.sendHit(victim.netId, damage, heavy);
    });
  } else {
    hud.flash('单机模式（未连服务器）');
  }
  let mode = new Deathmatch(bus);
  const saveOrch = new SaveOrchestrator({
    bus, state, hud, saveManager, progression, campaign, skills, affixes, daily, skins, achievements,
    getPlayer: () => player,
    getMode: () => mode
  });
  const match = new MatchController({
    bus, state, hud, resultScreen, camera, progression, progressUI, daily, skills, campaign, siege, weather, affixes,
    spawnAll: () => spawnAll(),
    saveNow: () => saveOrch.saveNow(),
    loadMap: (k) => loadMap(k),
    mapName: () => currentMapName,
    getPlayer: () => player,
    getAis: () => ais,
    getMode: () => mode
  });
  const saveUI = new SaveUI(bus, saveManager, () => saveOrch.capture(), () => saveOrch.reset());
  bus.on(EV.SKINS_CHANGED, ({ weaponIdx }) => { if (player && player._weaponMesh) skins.applyToWeapon(player._weaponMesh, weaponIdx); });
  // 启动加载应用存档 + 定时/卸载自动存档
  saveOrch.applyOnBoot();
  saveOrch.startTimers();
  // 存档恢复后刷新依赖模块的 UI/事件（模块不再自加载，applyOnBoot 才注入数据）
  bus.emit(EV.DAILY_UPDATE, daily.challenges);
  progressUI.refresh();

  const spawner = new Spawner({ scene, camera, terrain, combat, aiManager, formations, weaponTrail, horses, audio, bus, progression, campaign });

  function spawnRed(redLayout, { bossWave = false } = {}) {
    spawner.spawnRed(redLayout, ais, { bossWave, modeName: mode.name });
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

  const inputRouter = new InputRouter({
    bus, state, hud, campaign, daily, weather, settings, audio, match,
    getMode: () => mode,
    setMode: (m) => { mode = m; },
    loadMap: (k) => loadMap(k),
    mapName: () => currentMapName,
    currentMapKey: () => currentMapKey,
    getPlayer: () => player
  });
  inputRouter.install();
  installUIStackEscape();


  spawnAll();
  window.__game = { get player() { return player; }, get ais() { return ais; }, combat, get match() { return match; }, get state() { return state; } };
  window.__mp = { get connected() { return net.connected; }, get id() { return net.id; }, get remotes() { return remotes.length; } };
  const affixesUI = new AffixesUI(affixes, player);
  const achievementsUI = new AchievementsUI(achievements);
  state.transit(States.PLAYING);
  hud.setRound(0, 0, match.targetWins);
  hud.setMode(mode.name + ' · ' + currentMapName);
  hud.flash('点击锁定鼠标 · WASD移动 · 左键攻击 · 右键格挡/蓄力 · Tab锁定 · Q闪避 · 1-4切换武器 · M切换模式');
  setTimeout(() => hud.clearHint(), 5000);
  let tutorial = null;
  try { if (!localStorage.getItem(LS.TUTORIAL_DONE)) tutorial = new Tutorial(); } catch (e) {}

  const _trajOrigin = new THREE.Vector3();
  const _trajOffset = new THREE.Vector3(0, 1.5, 0);
  const _trajFwd = new THREE.Vector3();

  function loop() {
    time.tick(
      (dt) => {
        const now = time.now * 0.001;
        if (state.current === States.ROUND_END) {
          match.roundEndTimer -= dt;
          env.update(dt, now);
          water.update(dt, now);
          if (match.roundEndTimer <= 0) match.startRound();
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
        if (_lastMiniMapKey !== currentMapKey) { _lastMiniMapKey = currentMapKey; miniMap.setWorldSize(MapGenerator.MAPS[currentMapKey].size[0]); }
        miniMap.update(dt);
        progressUI.update(dt);
        hud.setHealth(player);
        hud.setStamina(player.stamina);
        hud.setRage(player);
        hud.setCharge(player.charge);
        if (player.weapon.type === 'projectile' && player.charge > 0.05) {
          _trajOrigin.copy(player.position).add(_trajOffset);
          _trajFwd.copy(player.forward).multiplyScalar(0.7);
          _trajOrigin.add(_trajFwd);
          trajectory.show(_trajOrigin, player.forward, player.weapon.speedFor ? player.weapon.speedFor(player.charge) : 50);
        } else trajectory.hide();
        hud.setWeapon(player.weaponIdx, player.weapons.length);
        hud.setCombo(player);
        hud.setSkillCooldowns(weaponSkills);
        if (mode.name === '据点') { mode.onTick(dt, combat.characters); hud.setDomination(mode); }
        hud.update(dt);
        if (mode.name === '战役') {
          hud.setMode('战役', campaign.stageInfo);
          let redAlive = 0;
          for (const a of ais) if (a.alive) redAlive++;
          if (match.defenseTimer > 0) match.defenseTimer -= dt;
          if (match.timeLimit > 0) match.timeLimit -= dt;
          if (match.surviveTimer > 0) {
            match.surviveTimer -= dt;
            if (match.surviveTimer <= 0 && !match.surviveWavesDone) { match.surviveWavesDone = true; hud.flash('生存时间达成！'); setTimeout(() => hud.clearHint(), 1500); }
          }
          if (match.escortTarget) match.escortTarget.update(dt, player);
          campaign.onTick(dt, {
            redAlive,
            spawnReinforce: (n) => spawner.spawnReinforce(n, ais),
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
