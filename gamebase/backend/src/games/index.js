import { CommonGuess } from './CommonGuess.js';

/** @type {Record<string, typeof import('./BaseGame.js').BaseGame>} */
export const GAME_REGISTRY = {
  common_guess: CommonGuess,
};

export function createGame(gameType, ctx) {
  const Ctor = GAME_REGISTRY[gameType];
  if (!Ctor) throw new Error(`Unknown game type: ${gameType}`);
  return new Ctor(ctx);
}
