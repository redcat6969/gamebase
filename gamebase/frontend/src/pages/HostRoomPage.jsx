import { useParams, useNavigate } from 'react-router-dom';
import { useEffect, useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import QRCode from 'qrcode';
import { getSocket } from '../socket.js';
import GameContainer from '../components/GameContainer.jsx';

function normalizeRoomCode(code) {
  const d = String(code ?? '').replace(/\D/g, '');
  return d.length === 4 ? d : '';
}

export default function HostRoomPage() {
  const { code: codeParam } = useParams();
  const nav = useNavigate();
  const [socket] = useState(() => getSocket());
  const [lobby, setLobby] = useState(null);
  const [gameState, setGameState] = useState(null);
  const [roomStatus, setRoomStatus] = useState(null);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [hostError, setHostError] = useState('');
  const [startError, setStartError] = useState('');

  const code =
    codeParam === 'new' ? null : normalizeRoomCode(codeParam) || codeParam;

  const playUrl = useMemo(() => {
    if (typeof window === 'undefined' || !code) return '';
    return `${window.location.origin}/room/${code}/play`;
  }, [code]);

  useEffect(() => {
    if (!code || !playUrl) return;
    QRCode.toDataURL(playUrl, { margin: 1, width: 220 }).then(setQrDataUrl);
  }, [code, playUrl]);

  useEffect(() => {
    function onLobby(p) {
      setLobby(p);
      setRoomStatus(p?.status ?? null);
      setHostError('');
      if (p?.status === 'PLAYING' || p?.status === 'RESULTS') setStartError('');
    }
    function onGameUpdate(p) {
      setGameState(p?.state ?? null);
      if (p?.roomStatus) setRoomStatus(p.roomStatus);
    }
    function onRoomCreated({ code: created }) {
      nav(`/room/${created}/host`, { replace: true });
    }
    function onErr(p) {
      setHostError(p?.message ?? p?.code ?? 'Ошибка');
    }
    function onStartFailed(p) {
      const map = {
        NOT_HOST: 'Это не сессия хоста. Закрой лишние вкладки с этой комнатой и обнови страницу (F5).',
        NEED_PLAYERS: 'Нужен хотя бы один игрок в комнате.',
        ROOM_NOT_FOUND: 'Комната не найдена на сервере (перезапусти бэкенд или создай комнату заново).',
      };
      setStartError(map[p?.code] ?? p?.message ?? p?.code ?? 'Не удалось начать игру');
    }

    socket.on('lobby_update', onLobby);
    socket.on('game_update', onGameUpdate);
    socket.on('room_created', onRoomCreated);
    socket.on('error_msg', onErr);
    socket.on('start_game_failed', onStartFailed);

    if (codeParam === 'new') {
      socket.emit('host_create_room');
    } else if (code) {
      socket.emit('host_rejoin', { code: normalizeRoomCode(code) || code });
    }

    return () => {
      socket.off('lobby_update', onLobby);
      socket.off('game_update', onGameUpdate);
      socket.off('room_created', onRoomCreated);
      socket.off('error_msg', onErr);
      socket.off('start_game_failed', onStartFailed);
    };
  }, [code, codeParam, nav, socket]);

  function startGame() {
    const c = normalizeRoomCode(code);
    if (!c) {
      setStartError('Некорректный код комнаты');
      return;
    }
    setStartError('');
    socket.emit('start_game', {
      code: c,
      gameType: 'common_guess',
      options: {
        prompt: 'Назовите что-нибудь популярное',
        roundSeconds: 60,
      },
    });
  }

  const inGame = roomStatus === 'PLAYING' || roomStatus === 'RESULTS';
  const gameType = lobby?.gameType ?? (inGame ? 'common_guess' : null);

  if (codeParam === 'new') {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-400">
        {hostError || 'Создаём комнату…'}
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6 md:p-10">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="max-w-3xl mx-auto"
      >
        {(hostError || startError) && (
          <div className="mb-6 rounded-xl border border-amber-700/50 bg-amber-950/40 px-4 py-3 text-amber-100 text-sm">
            {startError || hostError}
          </div>
        )}
        <header className="flex flex-wrap items-end justify-between gap-4 mb-8">
          <div>
            <p className="text-slate-500 text-sm uppercase tracking-wider">Комната</p>
            <p className="text-5xl font-black font-mono tracking-widest text-white">{code}</p>
          </div>
          {!inGame && (
            <div className="flex flex-col items-center">
              {qrDataUrl ? (
                <img src={qrDataUrl} alt="QR" className="rounded-xl border border-slate-700" />
              ) : (
                <div className="w-[220px] h-[220px] bg-slate-900 rounded-xl animate-pulse" />
              )}
              <p className="text-xs text-slate-500 mt-2 break-all max-w-[220px]">{playUrl}</p>
            </div>
          )}
        </header>

        <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 mb-6">
          <h2 className="text-lg font-semibold text-slate-300 mb-3">Игроки</h2>
          <ul className="space-y-2">
            {(lobby?.players ?? []).map((p) => (
              <li key={p.id} className="text-slate-200">
                {p.name}
              </li>
            ))}
            {(!lobby?.players || lobby.players.length === 0) && (
              <li className="text-slate-500">Пока никого…</li>
            )}
          </ul>
        </section>

        {!inGame && (
          <button
            type="button"
            onClick={startGame}
            className="w-full rounded-2xl bg-fuchsia-600 hover:bg-fuchsia-500 py-4 text-xl font-bold mb-8"
          >
            Начать Common Guess
          </button>
        )}

        <GameContainer
          role="host"
          gameType={inGame ? gameType : null}
          gameState={gameState}
          roomCode={code}
          socket={socket}
        />
      </motion.div>
    </div>
  );
}
