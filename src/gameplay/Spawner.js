import * as THREE from 'three';
import { AIController } from './AIController.js';
import { BossEnemy, EliteEnemy } from './BossEnemy.js';
import { CavalryEnemy } from './Cavalry.js';
import { Spear } from './weapons/Spear.js';
import { SwordShield } from './weapons/SwordShield.js';
import { Warhammer } from './weapons/Warhammer.js';
import { Bow } from './weapons/Bow.js';

const AI_WEAPON_MAKERS = [() => new Spear(), () => new SwordShield(), () => new Warhammer(), () => new Bow()];
const ELITE_SKILLS = ['blockCounter', 'dodgeStrike', 'enrage'];
const ELITE_CHANCE = 0.15;
const BASE_AI_HP = 90;
const CAVALRY_SCORE_GATE = 500;
const TRAINING_DUMMY_HP = 500;

export class Spawner {
  constructor({ scene, camera, terrain, combat, aiManager, formations, weaponTrail, horses, audio, bus, progression, campaign, lod }) {
    this.scene = scene; this.camera = camera; this.terrain = terrain;
    this.combat = combat; this.aiManager = aiManager; this.formations = formations;
    this.weaponTrail = weaponTrail; this.horses = horses; this.audio = audio; this.bus = bus;
    this.progression = progression; this.campaign = campaign; this.lod = lod;
  }

  _maybeElite(ai, eliteChanceMul = 1) {
    if (!ai._isBoss && !ai._isElite && Math.random() < ELITE_CHANCE * eliteChanceMul) {
      ai.setIsElite(true);
      ai._eliteSkill = ELITE_SKILLS[Math.floor(Math.random() * ELITE_SKILLS.length)];
    }
  }

  _finalize(ai, x, z, ais, eliteChanceMul = 1) {
    ai.spawn(new THREE.Vector3(x, this.terrain.heightAt(x, z), z));
    ai.setCameraRef(this.camera);
    ai.setAIManager(this.aiManager);
    this._maybeElite(ai, eliteChanceMul);
    this.scene.add(ai.root);
    this.combat.register(ai);
    if (ai._weaponMesh) this.weaponTrail.attach(ai._weaponMesh, ai.team === 1 ? 0xff8060 : 0x60a0ff);
    if (this.lod) this.lod.register(ai);
    ais.push(ai);
  }

  spawnRed(redLayout, ais, { bossWave = false, modeName = '', modifier = null, stageDifficulty = 1 } = {}) {
    const unlocks = this.progression.unlocks;
    const isTraining = modeName === '训练场';
    const hpMul = modifier ? (modifier.hpMul || 1) : 1;
    const speedMul = modifier ? (modifier.speedMul || 1) : 1;
    const eliteChanceMul = modifier ? (modifier.eliteChanceMul || 1) : 1;
    for (let i = 0; i < redLayout.length; i++) {
      let ai;
      if (i === 0 && (this.campaign.currentStage.bossType || bossWave) && !isTraining) {
        ai = new BossEnemy({ team: 1, type: bossWave ? 'warlord' : (this.campaign.currentStage.bossType || 'warlord'), mini: bossWave ? false : (this.campaign.currentStage.mini || false) });
      } else if (i === 1 && unlocks.elite && !isTraining) {
        ai = new EliteEnemy({ team: 1 });
      } else if (i === 2 && !isTraining && this.progression.score >= CAVALRY_SCORE_GATE) {
        ai = new CavalryEnemy({ team: 1 });
        ai.mount(this.horses.create());
      } else {
        ai = new AIController({ team: 1, passive: isTraining, maxHp: isTraining ? TRAINING_DUMMY_HP : Math.round(BASE_AI_HP * this.aiManager.difficulty().maxHpMul * hpMul * stageDifficulty) });
      }
      const p = redLayout[i];
      ai.setWeapons([AI_WEAPON_MAKERS[i % AI_WEAPON_MAKERS.length]()]);
      this._finalize(ai, p.x, p.z, ais, eliteChanceMul);
      if (speedMul !== 1 && ai.speed) ai.speed *= speedMul;
      if ((hpMul !== 1 || stageDifficulty !== 1) && (ai._isBoss || ai._isElite) && ai.health) { ai.health.maxHp = Math.round(ai.health.maxHp * hpMul * stageDifficulty); ai.health.cur = ai.health.maxHp; }
    }
    this.aiManager.assignSquad(ais);
    if (!isTraining && ais.length >= 3) {
      const shieldUsers = ais.filter(a => a.weapons && a.weapons[0] && a.weapons[0].weaponClass === 'SHIELD');
      const bowUsers = ais.filter(a => a.weapons && a.weapons[0] && a.weapons[0].weaponClass === 'BOW');
      if (shieldUsers.length >= 2) this.formations.createShieldWall(shieldUsers[0], shieldUsers.slice(1));
      if (bowUsers.length >= 2) this.formations.createArcherLine(bowUsers[0], bowUsers.slice(1));
    }
    for (const ai of ais) ai.setAudio(this.audio);
  }

  spawnReinforce(n, ais) {
    for (let i = 0; i < n; i++) {
      const e = new AIController({ team: 1, passive: false, maxHp: Math.round(BASE_AI_HP * (this.campaign.currentStage.difficulty || 1)) });
      e.setBus(this.bus);
      e.setWeapons([new Spear()]);
      this._finalize(e, 160 + (Math.random() - 0.5) * 40, (Math.random() - 0.5) * 120, ais);
    }
  }
}
