// 轻量 ECS：实体=ID，组件=数据，系统=逻辑
// 设计要点：数据与逻辑分离，便于多人时只同步数据快照

let _eid = 0;

export class ECS {
  constructor() {
    this._entities = new Map();      // id -> Set(componentTypes)
    this._components = new Map();     // componentType -> Map(id, data)
    this._systems = [];              // [{ query, fn }]
  }

  createEntity() {
    const id = ++_eid;
    this._entities.set(id, new Set());
    return id;
  }

  removeEntity(id) {
    const types = this._entities.get(id);
    if (!types) return;
    for (const t of types) {
      this._components.get(t)?.delete(id);
    }
    this._entities.delete(id);
  }

  addComponent(id, type, data = {}) {
    if (!this._components.has(type)) this._components.set(type, new Map());
    this._components.get(type).set(id, { ...data });
    this._entities.get(id)?.add(type);
  }

  getComponent(id, type) {
    return this._components.get(type)?.get(id) ?? null;
  }

  hasComponent(id, type) {
    return this._entities.get(id)?.has(type) ?? false;
  }

  updateComponent(id, type, patch) {
    const c = this.getComponent(id, type);
    if (c) Object.assign(c, patch);
  }

  removeComponent(id, type) {
    this._components.get(type)?.delete(id);
    this._entities.get(id)?.delete(type);
  }

  // 查询拥有全部 required 组件的实体
  query(required = []) {
    if (required.length === 0) return [...this._entities.keys()];
    const out = [];
    for (const id of this._entities.keys()) {
      let ok = true;
      for (const t of required) {
        if (!this._entities.get(id).has(t)) { ok = false; break; }
      }
      if (ok) out.push(id);
    }
    return out;
  }

  registerSystem(required, fn) {
    this._systems.push({ required, fn });
  }

  runSystems(ctx) {
    for (const s of this._systems) {
      const ids = this.query(s.required);
      s.fn(this, ids, ctx);
    }
  }
}
