// 简单事件总线，解耦模块间通信
export class EventBus {
  constructor() {
    this._map = new Map();
  }

  on(event, handler) {
    if (!this._map.has(event)) this._map.set(event, new Set());
    this._map.get(event).add(handler);
    return () => this.off(event, handler);
  }

  off(event, handler) {
    this._map.get(event)?.delete(handler);
  }

  emit(event, payload) {
    const set = this._map.get(event);
    if (!set) return;
    for (const h of set) {
      try { h(payload); } catch (e) { console.error(`[EventBus] ${event}`, e); }
    }
  }
}
