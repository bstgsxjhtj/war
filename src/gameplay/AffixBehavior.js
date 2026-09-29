// 词条行为统一抽象（P3-3）：玩家/敌人共用 reflect/vampire/swift/ironhide 行为接口。
// 每个 behavior 是一个纯函数集合（onTakeDamage/onDealDamage/modifyIncoming/onSpawn），
// 消费方（AIController.takeDamage / CombatSystem._affixLeech / Spawner._applyEnemyMods）
// 经 applyEnemyBehaviors 调度器统一调用，消除散落的 _enemyMods.includes 内联分支。
// 玩家武器词条（Affixes.js）有层级/协同，暂不经此接口；未来吸血/反射可演进共用。

export const AFFIX_BEHAVIORS = {
  reflect: {
    name: 'reflect',
    onTakeDamage(victim, attacker, lost, ctx) {
      if (!attacker || !attacker.alive || lost <= 0 || victim._reflecting) return;
      attacker._reflecting = true;
      attacker.takeDamage(lost * ctx.fraction, false, victim, ctx.now);
      attacker._reflecting = false;
    }
  },
  vampire: {
    name: 'vampire',
    onDealDamage(attacker, victim, lost, ctx) {
      if (!attacker || !attacker.health || lost <= 0) return;
      attacker.health.hp = Math.min(attacker.health.maxHp, attacker.health.hp + lost * ctx.fraction);
    }
  },
  ironhide: {
    name: 'ironhide',
    modifyIncoming(victim, amount, ctx) {
      return amount * ctx.mul;
    }
  },
  swift: {
    name: 'swift',
    onSpawn(victim, ctx) {
      if (!victim.speed) return;
      victim.speed *= ctx.mul;
    }
  }
};

// 统一调度器：按 victim._enemyMods 分发到对应 behavior，ctx 携带各行为参数
export const applyEnemyBehaviors = {
  modifyIncoming(victim, amount, ctx) {
    if (!victim._enemyMods) return amount;
    let out = amount;
    if (victim._enemyMods.includes('ironhide')) out = AFFIX_BEHAVIORS.ironhide.modifyIncoming(victim, out, { mul: ctx.ironhideMul });
    return out;
  },
  onTakeDamage(victim, attacker, lost, ctx) {
    if (!victim._enemyMods) return;
    if (victim._enemyMods.includes('reflect')) AFFIX_BEHAVIORS.reflect.onTakeDamage(victim, attacker, lost, { fraction: ctx.reflectFraction, now: ctx.now });
  },
  onDealDamage(attacker, victim, lost, ctx) {
    if (!attacker._enemyMods) return;
    if (attacker._enemyMods.includes('vampire')) AFFIX_BEHAVIORS.vampire.onDealDamage(attacker, victim, lost, { fraction: ctx.vampireFraction });
  },
  onSpawn(victim, ctx) {
    if (!victim._enemyMods) return;
    if (victim._enemyMods.includes('swift')) AFFIX_BEHAVIORS.swift.onSpawn(victim, { mul: ctx.swiftMul });
  }
};
