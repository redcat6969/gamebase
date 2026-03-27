/**
 * Базовый контракт игры. Каждая игра в /games расширяет этот класс.
 * RoomManager создаёт экземпляр и проксирует onStart / onAction / onEnd.
 */
export class BaseGame {
  /**
   * @param {{ code: string, getPlayers: () => Map<string, { id: string, socketId: string }>, broadcast: (event: string, payload: unknown) => void, emitToSocket: (socketId: string, event: string, payload: unknown) => void }} ctx
   */
  constructor(ctx) {
    this.ctx = ctx;
    this.code = ctx.code;
  }

  /** @param {Record<string, unknown>} [options] */
  onStart(options) {
    throw new Error(`${this.constructor.name} must implement onStart()`);
  }

  /**
   * @param {string} playerId
   * @param {Record<string, unknown>} payload
   */
  onAction(playerId, payload) {
    throw new Error(`${this.constructor.name} must implement onAction()`);
  }

  onEnd() {
    // по умолчанию — no-op
  }

  /** Действия с экрана хоста (кнопки раунда и т.д.) */
  onHostAction(_payload) {
    // no-op
  }

  /** Состояние для клиентов (host + players) */
  getState() {
    return {};
  }
}
