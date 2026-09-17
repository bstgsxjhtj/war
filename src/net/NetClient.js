// 客户端网络层：连接服务器 + 输入/状态上报 + 远端状态接收
export class NetClient {
  constructor(url) {
    this.url = url;
    this.ws = null;
    this.id = null;
    this.team = 0;
    this.connected = false;
    this.handlers = {};
  }

  connect() {
    return new Promise((resolve) => {
      try {
        this.ws = new WebSocket(this.url);
      } catch (e) { resolve(null); return; }
      const to = setTimeout(() => { resolve(null); }, 3000);
      this.ws.onopen = () => { this.connected = true; };
      this.ws.onmessage = (e) => {
        let msg;
        try { msg = JSON.parse(e.data); } catch { return; }
        if (msg.type === 'welcome') {
          this.id = msg.id; this.team = msg.team;
          clearTimeout(to); resolve(msg);
        } else if (this.handlers[msg.type]) {
          this.handlers[msg.type](msg);
        }
      };
      this.ws.onerror = () => { clearTimeout(to); resolve(null); };
      this.ws.onclose = () => { this.connected = false; if (this.handlers['disconnect']) this.handlers['disconnect'](); };
    });
  }

  on(type, fn) { this.handlers[type] = fn; }
  send(msg) {
    if (this.ws && this.connected) {
      try { this.ws.send(JSON.stringify(msg)); } catch (e) {}
    }
  }
  sendState(pos, yaw, hp, weapon, alive, anim) {
    this.send({ type: 'state', pos: { x: pos.x, y: pos.y, z: pos.z }, yaw, hp, weapon, alive, anim });
  }
  sendHit(victimId, dmg, heavy) { this.send({ type: 'hit', victim: victimId, dmg, heavy }); }
  sendKill(victimId) { this.send({ type: 'kill', victim: victimId }); }
  sendAttack(weapon, combo) { this.send({ type: 'attack', weapon, combo }); }
  createLobby(mode = 'dm', maxPlayers = 8) { this.send({ type: 'lobby.create', mode, maxPlayers }); }
  joinLobby(lobbyId) { this.send({ type: 'lobby.join', lobbyId }); }
  leaveLobby() { this.send({ type: 'lobby.leave' }); }
}
