import http from 'node:http';
import { Server } from 'socket.io';
import cors from 'cors';
import express from 'express';
import { RoomManager } from './RoomManager.js';

const PORT = Number(process.env.PORT) || 3001;

const app = express();
app.use(cors({ origin: true }));
app.use(express.json());

const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: { origin: true, methods: ['GET', 'POST'] },
});

const rooms = new RoomManager(io);

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

io.on('connection', (socket) => {
  socket.on('host_create_room', () => {
    try {
      if (socket.data.hostRoomCode) {
        const code = socket.data.hostRoomCode;
        const room = rooms.getRoom(code);
        if (room) {
          rooms.attachHostSocket(code, socket.id);
          socket.emit('room_created', { code, role: 'host' });
          socket.emit('lobby_update', rooms.serializeLobby(room));
          return;
        }
        delete socket.data.hostRoomCode;
      }
      const { code } = rooms.createRoom(socket.id);
      socket.data.hostRoomCode = code;
      socket.emit('room_created', { code, role: 'host' });
      socket.emit('lobby_update', rooms.serializeLobby(rooms.getRoom(code)));
    } catch (e) {
      socket.emit('error_msg', { message: String(e?.message ?? e) });
    }
  });

  socket.on('host_rejoin', ({ code } = {}) => {
    const c = String(code ?? '');
    const result = rooms.attachHostSocket(c, socket.id);
    if (!result.ok) {
      socket.emit('error_msg', { code: result.error });
      return;
    }
    socket.emit('room_joined', { code: c, role: 'host' });
    socket.emit('lobby_update', rooms.serializeLobby(result.room));
  });

  socket.on('join_room', (payload = {}) => {
    const code = String(payload.code ?? '');
    const result = rooms.joinRoom(code, {
      name: payload.name,
      sessionToken: payload.sessionToken ?? null,
      socketId: socket.id,
    });
    if (!result.ok) {
      socket.emit('join_room_failed', { code: result.error });
      return;
    }
    socket.emit('room_joined', {
      code: result.room.code,
      role: 'player',
      playerId: result.playerId,
      sessionToken: result.sessionToken,
    });
    io.to(`room:${result.room.code}`).emit(
      'lobby_update',
      rooms.serializeLobby(result.room)
    );
  });

  socket.on('start_game', (payload = {}) => {
    const code = String(payload.code ?? '');
    const gameType = String(payload.gameType ?? 'common_guess');
    let r;
    try {
      r = rooms.startGame(code, socket.id, gameType, payload.options ?? {});
    } catch (e) {
      socket.emit('start_game_failed', {
        code: 'START_ERROR',
        message: String(e?.message ?? e),
      });
      return;
    }
    if (!r.ok) {
      socket.emit('start_game_failed', { code: r.error });
      return;
    }
    const lobbyPayload = rooms.serializeLobby(r.room);
    io.to(`room:${r.room.code}`).emit('lobby_update', lobbyPayload);
    // Дублируем инициатору: на случай если сокет не в socket.io room (редкий edge-case).
    socket.emit('lobby_update', lobbyPayload);
  });

  socket.on('host_game_action', (payload = {}) => {
    const code = String(payload.code ?? '');
    const r = rooms.hostGameAction(code, socket.id, payload.action ?? {});
    if (!r.ok) {
      socket.emit('host_game_action_failed', { code: r.error });
    }
  });

  socket.on('player_action', (payload = {}) => {
    const code = String(payload.code ?? '');
    const playerId = String(payload.playerId ?? '');
    const r = rooms.playerAction(code, playerId, socket.id, payload.action ?? {});
    if (!r.ok) {
      socket.emit('player_action_failed', { code: r.error });
    }
  });

  socket.on('disconnect', () => {
    rooms.leaveBySocket(socket.id);
  });
});

httpServer.listen(PORT, () => {
  console.log(`gamebase backend http://localhost:${PORT}`);
});
