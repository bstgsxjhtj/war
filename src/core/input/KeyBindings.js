import { LS } from '../constants/storage-keys.js';

export const DEFAULT_BINDINGS = {
  forward: 'KeyW',
  back: 'KeyS',
  left: 'KeyA',
  right: 'KeyD',
  sprint: 'ShiftLeft',
  jump: 'Space',
  dodge: 'KeyQ',
  skill: 'KeyF',
  ultimate: 'KeyT',
  execute: 'KeyE',
  lock: 'Tab',
  weapon1: 'Digit1',
  weapon2: 'Digit2',
  weapon3: 'Digit3',
  weapon4: 'Digit4'
};

export const BINDING_LABELS = {
  forward: '前进',
  back: '后退',
  left: '左移',
  right: '右移',
  sprint: '冲刺',
  jump: '跳跃',
  dodge: '闪避',
  skill: '技能',
  ultimate: '大招',
  execute: '处决',
  lock: '锁定',
  weapon1: '武器1',
  weapon2: '武器2',
  weapon3: '武器3',
  weapon4: '武器4'
};

export const BINDING_ORDER = [
  'forward', 'back', 'left', 'right', 'sprint', 'jump',
  'dodge', 'skill', 'ultimate', 'execute', 'lock',
  'weapon1', 'weapon2', 'weapon3', 'weapon4'
];

export class KeyBindings {
  constructor() {
    this._bindings = { ...DEFAULT_BINDINGS };
    this._load();
  }
  get(action) { return this._bindings[action] ?? DEFAULT_BINDINGS[action]; }
  getAll() { return { ...this._bindings }; }
  set(action, code) {
    if (!DEFAULT_BINDINGS[action]) return;
    if (code === DEFAULT_BINDINGS[action]) {
      this._bindings[action] = code;
      this._save();
      return;
    }
    for (const [a, c] of Object.entries(this._bindings)) {
      if (c === code && a !== action) this._bindings[a] = DEFAULT_BINDINGS[a] ?? c;
    }
    this._bindings[action] = code;
    this._save();
  }
  reset() {
    this._bindings = { ...DEFAULT_BINDINGS };
    this._save();
  }
  _load() {
    try {
      const d = localStorage.getItem(LS.KEYBINDINGS);
      if (!d) return;
      const v = JSON.parse(d);
      for (const k of Object.keys(DEFAULT_BINDINGS)) {
        if (v[k]) this._bindings[k] = v[k];
      }
    } catch (e) {}
  }
  _save() {
    try { localStorage.setItem(LS.KEYBINDINGS, JSON.stringify(this._bindings)); } catch (e) {}
  }
}
