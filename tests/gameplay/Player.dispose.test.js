// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/render/TextureFactory.js', () => ({
  TextureFactory: {
    noise: () => ({ isTexture: true }),
    rough: () => ({ isTexture: true })
  }
}));

import { Player } from '../../src/gameplay/Player.js';

function makeCamera() {
  return {
    forward: () => ({ x: 0, z: -1, clone: () => ({ x: 0, z: -1 }) }),
    right: () => ({ x: 1, z: 0, clone: () => ({ x: 1, z: 0 }) }),
    look: vi.fn(),
    follow: vi.fn(),
    setKillCam: vi.fn(),
    yaw: 0, aimMode: false, lockTarget: null
  };
}

describe('Player.dispose', () => {
  let bus;
  beforeEach(() => {
    document.body.innerHTML = '<div id="app"></div>';
    bus = { on: vi.fn(), emit: vi.fn() };
  });

  it('构造后绑定 8 个输入监听，dispose 后逐条移除', () => {
    const p = new Player(makeCamera(), bus);
    expect(p._handlers.length).toBe(8);

    p.dispose();
    expect(p._handlers.length).toBe(0);

    // dispose 后按键不再进入 _keys
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' }));
    expect(p._keys.has('KeyW')).toBe(false);
  });
});
