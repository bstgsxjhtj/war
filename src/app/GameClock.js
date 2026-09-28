export class GameClock {
  constructor() { this._tasks = []; this._timeScale = 1; }
  get timeScale() { return this._timeScale; }
  setTimeScale(ts) { this._timeScale = ts; }
  schedule(delay, fn) {
    const task = { remaining: delay, fn };
    this._tasks.push(task);
    return () => {
      const i = this._tasks.indexOf(task);
      if (i >= 0) this._tasks.splice(i, 1);
    };
  }
  update(dt) {
    const scaled = dt * this._timeScale;
    for (let i = this._tasks.length - 1; i >= 0; i--) {
      this._tasks[i].remaining -= scaled;
      if (this._tasks[i].remaining <= 0) {
        const fn = this._tasks[i].fn;
        this._tasks.splice(i, 1);
        fn();
      }
    }
  }
  clear() { this._tasks.length = 0; }
}
