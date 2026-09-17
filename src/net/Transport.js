// 多人扩展预留：抽象输入/状态同步接口
// 单机：LocalTransport 直接返回本地输入，不做网络通信
// 多人：替换为 WebSocketTransport，sendIntent/onRemoteState 同步，核心战斗逻辑不变
export class Transport {
  constructor() {
    this._handlers = new Map();
  }

  onRemoteIntent(handler) { this._set('intent', handler); }
  onRemoteState(handler) { this._set('state', handler); }

  sendIntent(_intent) { /* 单机：no-op */ }
  sendState(_snapshot) { /* 单机：no-op */ }

  _set(key, fn) { this._handlers.set(key, fn); }
  _emit(key, data) { this._handlers.get(key)?.(data); }
}

export class LocalTransport extends Transport {
  // 本地输入直接驱动，无需网络
}
