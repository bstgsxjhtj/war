import * as THREE from 'three';
import { EventBus } from './core/EventBus.js';
import { GameState, States } from './core/GameState.js';
import { Time } from './core/Time.js';
import { Renderer } from './engine/Renderer.js';
import { Scene } from './engine/Scene.js';
import { Camera } from './engine/Camera.js';
import { Terrain } from './world/Terrain.js';
import { Environment } from './world/Environment.js';
import { CombatSystem } from './gameplay/CombatSystem.js';
import { Player } from './gameplay/Player.js';
import { AIController } from './gameplay/AIController.js';
import { HUD } from './ui/HUD.js';

// 入口：组装引擎/世界/玩法/UI，启动主循环
// cache-bust marker v3
function bootstrap() {
  const app = document.querySelector('#app');
  const canvas = document.createElement('canvas');
  app.appendChild(canvas);

  const bus = new EventBus();
  const state = new GameState(bus);
  const time = new Time();

  const renderer = new Renderer(canvas);
  const scene = new Scene();
  const camera = new Camera(bus);
  renderer.setup(scene.scene, camera.cam);

  const terrain = new Terrain(240, 120);
  scene.add(terrain.mesh);
  const env = new Environment(terrain);
  scene.add(env.group);

  const combat = new CombatSystem(scene.scene, bus);
  const hud = new HUD(bus);

  let player, ais = [];
  let scoreB = 0, scoreR = 0;

  bus.on('combat.kill', ({ team }) => {
    if (team === 1) scoreB++; else scoreR++;
    hud.setScore(scoreB, scoreR);
  });

  function spawnAll() {
    combat.clear();
    if (player) scene.remove(player.root);
    for (const a of ais) scene.remove(a.root);
    ais = [];

    player = new Player(camera);
    const px = -14, pz = 0;
    player.spawn(new THREE.Vector3(px, terrain.heightAt(px, pz), pz));
    scene.add(player.root);
    combat.register(player);

    const n = 4;
    for (let i = 0; i < n; i++) {
      const ang = (i / n) * Math.PI * 2;
      const ax = 16 + Math.cos(ang) * 3;
      const az = Math.sin(ang) * 7;
      const ai = new AIController({ team: 1 });
      ai.spawn(new THREE.Vector3(ax, terrain.heightAt(ax, az), az));
      ai.switchWeapon(i % 2); // 半刀半弑
      scene.add(ai.root);
      combat.register(ai);
      ais.push(ai);
    }
  }

  function restart() {
    scoreB = 0; scoreR = 0;
    hud.setScore(0, 0);
    hud.clearHint();
    spawnAll();
    state.transit(States.READY);
    state.transit(States.PLAYING);
    hud.flash('遭遇战开始！点击锁定鼠标');
    setTimeout(() => hud.clearHint(), 1800);
  }

  window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyR' && state.current === States.ENDED) restart();
  });

  function checkWin() {
    if (state.current !== States.PLAYING) return;
    const blueAlive = player.alive;
    const redAlive = ais.some(a => a.alive);
    if (!redAlive) { hud.flashEnd('蓝方胜利！按 R 重新开战'); state.transit(States.ENDED); }
    else if (!blueAlive) { hud.flashEnd('红方胜利！按 R 重新开战'); state.transit(States.ENDED); }
  }

  spawnAll();
  state.transit(States.PLAYING);
  hud.flash('点击锁定鼠标 · WASD移动 · 左键刀三连 · 右键蓄力射箭 · 1刀2弓 · Shift冲刺 空格跳');
  setTimeout(() => hud.clearHint(), 4000);

  function loop() {
    time.tick(
      (dt) => {
        if (state.current !== States.PLAYING) return;
        const slow = combat.hitstop > 0 ? 0.35 : 1; // 命中顿帧慢放
        const ldt = dt * slow;
        player.update(ldt, terrain, combat);
        const enemies = [player, ...ais];
        for (const a of ais) a.update(ldt, terrain, combat, enemies);
        combat.update(dt, terrain);
        env.update(dt);
        hud.setHealth(player);
        hud.setCharge(player.charge);
        hud.setWeapon(player.weaponIdx);
        checkWin();
      },
      () => { renderer.render(); }
    );
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
}

bootstrap();
