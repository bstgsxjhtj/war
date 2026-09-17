import { WebSocketServer } from 'ws';

const wss = new WebSocketServer({ port: 3000 });
const players = new Map();
const lobbies = new Map();
let nextId = 1;
const MAX_HP = 200;
const MAX_DMG = 80;
const RATE_LIMIT = { state: 30, hit: 5, attack: 5 };
const rateTrack = new Map();

function broadcast(msg, except) {
  const s = JSON.stringify(msg);
  for (const [, p] of players) {
    if (p.ws !== except && p.ws.readyState === 1) {
      try { p.ws.send(s); } catch (e) {}
    }
  }
}

function broadcastLobby(lobbyId, msg, except) {
  const lobby = lobbies.get(lobbyId);
  if (!lobby) return;
  const s = JSON.stringify(msg);
  for (const pid of lobby.members) {
    const p = players.get(pid);
    if (p && p.ws !== except && p.ws.readyState === 1) {
      try { p.ws.send(s); } catch (e) {}
    }
  }
}

function checkRate(id, type) {
  const now = Date.now();
  const key = id + ':' + type;
  const track = rateTrack.get(key) || { count: 0, reset: now + 1000 };
  if (now > track.reset) { track.count = 0; track.reset = now + 1000; }
  track.count++;
  rateTrack.set(key, track);
  return track.count <= RATE_LIMIT[type];
}

function validateState(state) {
  if (!state) return null;
  const pos = state.pos;
  if (!Array.isArray(pos) || pos.length !== 3) return null;
  if (typeof pos[0] !== 'number' || typeof pos[1] !== 'number' || typeof pos[2] !== 'number') return null;
  if (Math.abs(pos[0]) > 500 || Math.abs(pos[2]) > 500) return null;
  const hp = Math.max(0, Math.min(MAX_HP, Number(state.hp) || 0));
  return { pos, yaw: Number(state.yaw) || 0, hp, weapon: Math.max(0, Math.min(4, Number(state.weapon) || 0)), alive: !!state.alive, anim: state.anim || 'idle' };
}

function validateHit(msg, attackerId) {
  const dmg = Number(msg.dmg);
  if (!isFinite(dmg) || dmg <= 0 || dmg > MAX_DMG) {
    console.warn(`[server] invalid damage ${dmg} from ${attackerId}`);
    return false;
  }
  const victimId = Number(msg.victimId);
  if (!victimId || !players.has(victimId)) return false;
  const victim = players.get(victimId);
  if (victim.team === players.get(attackerId)?.team) return false;
  return true;
}

wss.on('connection', (ws) => {
  const id = nextId++;
  const team = id % 2;
  players.set(id, { ws, team, state: null, lobbyId: null, hp: MAX_HP });
  ws.send(JSON.stringify({ type: 'welcome', id, team, maxHp: MAX_HP }));
  for (const [pid, p] of players) {
    if (pid !== id && p.state) {
      ws.send(JSON.stringify({ type: 'state', id: pid, team: p.team, ...p.state }));
    }
  }
  broadcast({ type: 'join', id, team }, ws);
  console.log(`[server] player ${id} joined team ${team} (total ${players.size})`);

  ws.on('message', (data) => {
    let msg;
    try { msg = JSON.parse(data); } catch { return; }
    if (msg.type === 'state') {
      if (!checkRate(id, 'state')) return;
      const valid = validateState(msg);
      if (!valid) return;
      const p = players.get(id);
      if (!p) return;
      p.state = valid;
      p.hp = valid.hp;
      broadcast({ type: 'state', id, team: p.team, ...valid }, ws);
    } else if (msg.type === 'hit') {
      if (!checkRate(id, 'hit')) return;
      if (!validateHit(msg, id)) return;
      broadcast({ ...msg, from: id }, ws);
    } else if (msg.type === 'lobby.create') {
      const lobbyId = 'L' + (nextId++);
      lobbies.set(lobbyId, { id: lobbyId, members: new Set([id]), host: id, mode: msg.mode || 'dm', maxPlayers: msg.maxPlayers || 8 });
      players.get(id).lobbyId = lobbyId;
      ws.send(JSON.stringify({ type: 'lobby.created', lobbyId }));
    } else if (msg.type === 'lobby.join') {
      const lobby = lobbies.get(msg.lobbyId);
      if (lobby && lobby.members.size < lobby.maxPlayers) {
        lobby.members.add(id);
        players.get(id).lobbyId = msg.lobbyId;
        broadcastLobby(msg.lobbyId, { type: 'lobby.update', lobbyId: msg.lobbyId, members: lobby.members.size, mode: lobby.mode });
        ws.send(JSON.stringify({ type: 'lobby.joined', lobbyId: msg.lobbyId, mode: lobby.mode }));
      }
    } else if (msg.type === 'lobby.leave') {
      const p = players.get(id);
      if (p && p.lobbyId) {
        const lobby = lobbies.get(p.lobbyId);
        if (lobby) { lobby.members.delete(id); if (lobby.members.size === 0) lobbies.delete(p.lobbyId); }
        p.lobbyId = null;
      }
    } else {
      if (msg.type === 'attack' && !checkRate(id, 'attack')) return;
      broadcast({ ...msg, from: id }, ws);
    }
  });

  ws.on('close', () => {
    const p = players.get(id);
    if (p && p.lobbyId) {
      const lobby = lobbies.get(p.lobbyId);
      if (lobby) { lobby.members.delete(id); if (lobby.members.size === 0) lobbies.delete(p.lobbyId); }
    }
    players.delete(id);
    broadcast({ type: 'leave', id });
    console.log(`[server] player ${id} left (total ${players.size})`);
  });
});

setInterval(() => {
  const now = Date.now();
  for (const [key, track] of rateTrack) {
    if (now > track.reset + 5000) rateTrack.delete(key);
  }
}, 10000);

console.log('[server] Multiplayer server on ws://localhost:3000 (with validation + lobby)');
