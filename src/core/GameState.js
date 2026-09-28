// 状态机：准备/进行中/暂停/回合结束/结束（支持多局制）

export const States = {
  READY: 'ready',
  PLAYING: 'playing',
  PAUSED: 'paused',
  ROUND_END: 'round_end',
  ENDED: 'ended'
};

export class GameState {
  constructor(bus) {
    this.bus = bus;
    this._state = States.READY;
    this._transitions = new Map();
    this._defineTransitions();
  }

  _defineTransitions() {
    const T = (from, to) => {
      if (!this._transitions.has(from)) this._transitions.set(from, new Set());
      this._transitions.get(from).add(to);
    };
    T(States.READY, States.PLAYING);
    T(States.PLAYING, States.PAUSED);
    T(States.PLAYING, States.ROUND_END);
    T(States.PLAYING, States.ENDED);
    T(States.PAUSED, States.PLAYING);
    T(States.ROUND_END, States.PLAYING);
    T(States.ROUND_END, States.READY);
    T(States.ROUND_END, States.ENDED);
    T(States.ENDED, States.READY);
  }

  get current() { return this._state; }

  canTransit(to) { return this._transitions.get(this._state)?.has(to) ?? false; }

  transit(to) {
    if (!this.canTransit(to)) {
      console.warn(`[GameState] illegal ${this._state}->${to}`);
      return false;
    }
    this._state = to;
    return true;
  }
}
