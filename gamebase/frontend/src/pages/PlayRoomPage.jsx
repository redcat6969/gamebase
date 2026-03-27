import { useParams } from 'react-router-dom';
import { useEffect, useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { getSocket } from '../socket.js';
import GameContainer from '../components/GameContainer.jsx';

/** sessionStorage — отдельно на каждую вкладку; localStorage ломал мульти-вкладки (общий sessionToken). */
function storageKeySession(code) {
  return `gamebase_session_${code}`;
}

function readSession(code) {
  try {
    const raw = sessionStorage.getItem(storageKeySession(code));
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export default function PlayRoomPage() {
  const { code } = useParams();
  const [socket] = useState(() => getSocket());
  const [name, setName] = useState('');
  const nameRef = useRef('');
  const [joined, setJoined] = useState(false);
  const [playerId, setPlayerId] = useState(null);
  const [lobby, setLobby] = useState(null);
  const [gameState, setGameState] = useState(null);
  const [roomStatus, setRoomStatus] = useState(null);
  const [joinError, setJoinError] = useState('');

  useEffect(() => {
    nameRef.current = name;
  }, [name]);

  useEffect(() => {
    const saved = readSession(code);
    if (saved?.name && saved?.sessionToken) {
      setName(saved.name);
    }
  }, [code]);

  useEffect(() => {
    function onLobby(p) {
      setLobby(p);
      setRoomStatus(p?.status ?? null);
    }
    function onGameUpdate(p) {
      setGameState(p?.state ?? null);
      if (p?.roomStatus) setRoomStatus(p.roomStatus);
    }
    function onJoined(p) {
      if (p.role !== 'player') return;
      setPlayerId(p.playerId);
      setJoined(true);
      sessionStorage.setItem(
        storageKeySession(code),
        JSON.stringify({
          name: nameRef.current.trim(),
          sessionToken: p.sessionToken,
        })
      );
    }
    function onFail(p) {
      setJoinError(p?.code ?? 'JOIN_FAILED');
    }

    socket.on('lobby_update', onLobby);
    socket.on('game_update', onGameUpdate);
    socket.on('room_joined', onJoined);
    socket.on('join_room_failed', onFail);

    return () => {
      socket.off('lobby_update', onLobby);
      socket.off('game_update', onGameUpdate);
      socket.off('room_joined', onJoined);
      socket.off('join_room_failed', onFail);
    };
  }, [code, socket]);

  function submitJoin(e) {
    e.preventDefault();
    setJoinError('');
    const trimmed = name.trim();
    const data = readSession(code);
    const token =
      data?.sessionToken &&
      data?.name &&
      data.name.trim().toLowerCase() === trimmed.toLowerCase()
        ? data.sessionToken
        : null;
    socket.emit('join_room', {
      code,
      name: trimmed,
      sessionToken: token || null,
    });
  }

  const inGame = roomStatus === 'PLAYING' || roomStatus === 'RESULTS';
  const gameType = lobby?.gameType ?? (inGame ? 'common_guess' : null);

  if (!joined) {
    return (
      <div className="min-h-screen flex flex-col justify-center px-4 py-8">
        <motion.form
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          onSubmit={submitJoin}
          className="max-w-md mx-auto w-full flex flex-col gap-4"
        >
          <h1 className="text-2xl font-bold text-center">Комната {code}</h1>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Твоё имя"
            className="rounded-xl bg-slate-900 border border-slate-700 px-4 py-4 text-lg"
            maxLength={32}
            required
          />
          <button
            type="submit"
            className="rounded-xl bg-violet-600 py-4 text-lg font-semibold"
          >
            Войти
          </button>
          {joinError && (
            <p className="text-red-400 text-sm text-center">{joinError}</p>
          )}
        </motion.form>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 pb-10">
      <p className="text-center text-slate-500 text-sm mb-4">
        {name} · {code}
      </p>
      <GameContainer
        role="player"
        gameType={inGame ? gameType : null}
        gameState={gameState}
        roomCode={code}
        socket={socket}
        playerId={playerId}
      />
    </div>
  );
}
