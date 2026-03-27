import { AnimatePresence, motion } from 'framer-motion';
import CommonGuessHost from '../games/commonGuess/CommonGuessHost.jsx';
import CommonGuessPlayer from '../games/commonGuess/CommonGuessPlayer.jsx';

const HOST_VIEWS = {
  common_guess: CommonGuessHost,
};

const PLAYER_VIEWS = {
  common_guess: CommonGuessPlayer,
};

/**
 * @param {{ role: 'host' | 'player', gameType: string | null, gameState: object | null, roomCode: string, socket: import('socket.io-client').Socket, playerId?: string | null }}
 */
export default function GameContainer({
  role,
  gameType,
  gameState,
  roomCode,
  socket,
  playerId,
}) {
  const views = role === 'host' ? HOST_VIEWS : PLAYER_VIEWS;
  const Cmp = gameType ? views[gameType] : null;

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={gameType ?? 'lobby'}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.25 }}
        className="min-h-[50vh]"
      >
        {Cmp ? (
          <Cmp
            state={gameState}
            roomCode={roomCode}
            socket={socket}
            playerId={playerId}
          />
        ) : (
          <p className="text-slate-400 text-center py-8">
            Ожидание выбора игры…
          </p>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
