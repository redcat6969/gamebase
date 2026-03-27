import { createGame } from './games/index.js';

/** @typedef {'LOBBY' | 'PLAYING' | 'RESULTS'} RoomStatus */

/**
 * @typedef {Object} PlayerRecord
 * @property {string} id
 * @property {string} name
 * @property {string} socketId
 * @property {string} sessionToken
 */

/**
 * @typedef {Object} Room
 * @property {string} code
 * @property {RoomStatus} status
 * @property {string | null} hostSocketId
 * @property {Map<string, PlayerRecord>} players
 * @property {string | null} gameType
 * @property {import('./games/BaseGame.js').BaseGame | null} game
 * @property {ReturnType<typeof setTimeout> | null} [orphanTimer]
 */

function randomDigits4() {
  return String(Math.floor(1000 + Math.random() * 9000));
}

export class RoomManager {
  /** @param {import('socket.io').Server} io */
  constructor(io) {
    this.io = io;
    /** @type {Map<string, Room>} */
    this.rooms = new Map();
  }

  /** @param {string} socketId */
  createRoom(socketId) {
    let code = randomDigits4();
    let guard = 0;
    while (this.rooms.has(code) && guard++ < 50) {
      code = randomDigits4();
    }
    if (this.rooms.has(code)) {
      throw new Error('Could not allocate room code');
    }

    /** @type {Room} */
    const room = {
      code,
      status: 'LOBBY',
      hostSocketId: socketId,
      players: new Map(),
      gameType: null,
      game: null,
      orphanTimer: null,
    };
    this.rooms.set(code, room);
    this._joinSocketRoom(socketId, code);
    return { code };
  }

  /** @param {string} code */
  getRoom(code) {
    const c = this._normalizeCode(code);
    if (!c) return null;
    return this.rooms.get(c) ?? null;
  }

  /**
   * @param {string} code
   * @param {{ name: string, sessionToken?: string | null, socketId: string }} payload
   * @returns {{ ok: true, playerId: string, sessionToken: string, room: Room } | { ok: false, error: string }}
   */
  joinRoom(code, payload) {
    const c = this._normalizeCode(code);
    if (!c) return { ok: false, error: 'ROOM_NOT_FOUND' };
    const room = this.rooms.get(c);
    if (!room) return { ok: false, error: 'ROOM_NOT_FOUND' };

    const name = String(payload.name ?? '').trim().slice(0, 32);
    if (!name) return { ok: false, error: 'NAME_REQUIRED' };

    const token = payload.sessionToken ? String(payload.sessionToken) : null;

    if (token) {
      for (const p of room.players.values()) {
        if (p.sessionToken === token) {
          p.socketId = payload.socketId;
          this._clearOrphanTimer(room);
          this._joinSocketRoom(payload.socketId, room.code);
          return { ok: true, playerId: p.id, sessionToken: p.sessionToken, room };
        }
      }
    }

    // Один WebSocket = один игрок в комнате: иначе с той же вкладки
    // накапливались записи с одним socketId или «залипал» старый токен.
    for (const [pid, p] of [...room.players]) {
      if (p.socketId === payload.socketId) {
        room.players.delete(pid);
      }
    }

    const id = crypto.randomUUID();
    const sessionToken = crypto.randomUUID();
    /** @type {PlayerRecord} */
    const player = {
      id,
      name,
      socketId: payload.socketId,
      sessionToken,
    };
    room.players.set(id, player);
    this._clearOrphanTimer(room);
    this._joinSocketRoom(payload.socketId, room.code);
    return { ok: true, playerId: id, sessionToken, room };
  }

  /**
   * Хост переподключается к той же комнате (тот же код + опционально токен в будущем).
   * @param {string} code
   * @param {string} socketId
   */
  attachHostSocket(code, socketId) {
    const c = this._normalizeCode(code);
    if (!c) return { ok: false, error: 'ROOM_NOT_FOUND' };
    const room = this.rooms.get(c);
    if (!room) return { ok: false, error: 'ROOM_NOT_FOUND' };
    room.hostSocketId = socketId;
    this._clearOrphanTimer(room);
    this._joinSocketRoom(socketId, room.code);
    return { ok: true, room };
  }

  /** @param {string} socketId */
  leaveBySocket(socketId) {
    for (const room of this.rooms.values()) {
      let touched = false;
      if (room.hostSocketId === socketId) {
        room.hostSocketId = null;
        touched = true;
      }
      for (const [pid, p] of room.players) {
        if (p.socketId === socketId) {
          room.players.delete(pid);
          touched = true;
          break;
        }
      }
      if (!touched) continue;

      this.io.sockets.sockets.get(socketId)?.leave(this._roomChannel(room.code));
      if (room.players.size === 0 && !room.hostSocketId) {
        if (room.status === 'LOBBY') {
          // «Пустая» лобби-комната без сокета хоста — не удаляем сразу: игрок успевает зайти
          // (раньше комната исчезала при любом disconnect хоста → ROOM_NOT_FOUND).
          this._scheduleLobbyOrphanCleanup(room);
        } else {
          this._clearOrphanTimer(room);
          this.rooms.delete(room.code);
        }
      }
      this.io
        .to(this._roomChannel(room.code))
        .emit('lobby_update', this.serializeLobby(room));
      return;
    }
  }

  /**
   * @param {string} code
   * @param {string} hostSocketId
   * @param {string} gameType
   * @param {Record<string, unknown>} [options]
   */
  startGame(code, hostSocketId, gameType, options = {}) {
    const c = this._normalizeCode(code);
    if (!c) return { ok: false, error: 'ROOM_NOT_FOUND' };
    const room = this.rooms.get(c);
    if (!room) return { ok: false, error: 'ROOM_NOT_FOUND' };
    if (room.hostSocketId !== hostSocketId) {
      return { ok: false, error: 'NOT_HOST' };
    }
    if (room.players.size < 1) {
      return { ok: false, error: 'NEED_PLAYERS' };
    }

    room.gameType = gameType;
    room.status = 'PLAYING';

    const ctx = {
      code: room.code,
      getPlayers: () => room.players,
      getHostSocketId: () => room.hostSocketId ?? '',
      getRoomStatus: () => room.status,
      setRoomStatus: (/** @type {RoomStatus} */ s) => {
        room.status = s;
      },
      broadcast: (event, payload) => {
        this.io.to(this._roomChannel(room.code)).emit(event, payload);
      },
      emitToSocket: (targetSocketId, event, payload) => {
        if (!targetSocketId) return;
        // Прямой emit надёжнее, чем io.to(id) в некоторых конфигурациях прокси/клиента.
        this.io.sockets.sockets.get(targetSocketId)?.emit(event, payload);
      },
    };

    room.game = createGame(gameType, ctx);
    room.game.onStart(options);

    return { ok: true, room };
  }

  /**
   * @param {string} code
   * @param {string} hostSocketId
   * @param {Record<string, unknown>} payload
   */
  hostGameAction(code, hostSocketId, payload) {
    const c = this._normalizeCode(code);
    if (!c) return { ok: false, error: 'ROOM_NOT_FOUND' };
    const room = this.rooms.get(c);
    if (!room?.game) return { ok: false, error: 'NO_GAME' };
    if (room.hostSocketId !== hostSocketId) {
      return { ok: false, error: 'NOT_HOST' };
    }
    if (typeof room.game.onHostAction === 'function') {
      room.game.onHostAction(payload);
    }
    return { ok: true, room };
  }

  /**
   * @param {string} code
   * @param {string} playerId
   * @param {string} socketId
   * @param {Record<string, unknown>} payload
   */
  playerAction(code, playerId, socketId, payload) {
    const c = this._normalizeCode(code);
    if (!c) return { ok: false, error: 'NO_GAME' };
    const room = this.rooms.get(c);
    if (!room?.game) return { ok: false, error: 'NO_GAME' };
    const p = room.players.get(playerId);
    if (!p || p.socketId !== socketId) return { ok: false, error: 'NOT_YOUR_PLAYER' };

    room.game.onAction(playerId, payload);
    return { ok: true };
  }

  /** @param {string} code */
  endGameResults(code) {
    const c = this._normalizeCode(code);
    if (!c) return { ok: false, error: 'NO_GAME' };
    const room = this.rooms.get(c);
    if (!room?.game) return { ok: false, error: 'NO_GAME' };
    room.status = 'RESULTS';
    room.game.onEnd();
    if (typeof room.game.broadcastState === 'function') {
      room.game.broadcastState();
    } else {
      this.io.to(this._roomChannel(room.code)).emit('game_update', {
        roomCode: room.code,
        state: room.game.getState(),
        roomStatus: room.status,
      });
    }
    return { ok: true, room };
  }

  /** @param {unknown} code */
  _normalizeCode(code) {
    const digits = String(code ?? '').replace(/\D/g, '');
    return digits.length === 4 ? digits : null;
  }

  /** @param {Room} room */
  _clearOrphanTimer(room) {
    if (room.orphanTimer != null) {
      clearTimeout(room.orphanTimer);
      room.orphanTimer = null;
    }
  }

  /** @param {Room} room */
  _scheduleLobbyOrphanCleanup(room) {
    this._clearOrphanTimer(room);
    const ORPHAN_MS = 45 * 60 * 1000;
    room.orphanTimer = setTimeout(() => {
      room.orphanTimer = null;
      const r = this.rooms.get(room.code);
      if (!r) return;
      if (r.status === 'LOBBY' && r.players.size === 0 && !r.hostSocketId) {
        this.rooms.delete(r.code);
      }
    }, ORPHAN_MS);
  }

  _roomChannel(code) {
    return `room:${code}`;
  }

  /** @param {string} socketId @param {string} code */
  _joinSocketRoom(socketId, code) {
    const sock = this.io.sockets.sockets.get(socketId);
    sock?.join(this._roomChannel(code));
  }

  /** Публичный снимок комнаты для клиентов */
  serializeLobby(room) {
    return {
      code: room.code,
      status: room.status,
      gameType: room.gameType,
      players: [...room.players.values()].map((p) => ({
        id: p.id,
        name: p.name,
      })),
    };
  }
}
