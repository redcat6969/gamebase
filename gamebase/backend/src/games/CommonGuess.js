import { BaseGame } from './BaseGame.js';

/** До скольки слов принимаем с одного игрока */
const MAX_WORDS = 5;
const DEFAULT_ROUND_S = 60;

export class CommonGuess extends BaseGame {
  constructor(ctx) {
    super(ctx);
    this.phase = 'idle';
    this.prompt = '';
    /** @type {Map<string, string[]>} playerId -> нормализованные слова (уникальные, до MAX_WORDS) */
    this.answers = new Map();
    /** @type {Map<string, number>} playerId -> очки за раунд */
    this.scores = new Map();
    /** @type {{ key: string, count: number, playerIds: string[] }[]} */
    this.clusters = [];
    /** @type {number | null} */
    this.deadlineAt = null;
    /** @type {ReturnType<typeof setTimeout> | null} */
    this.roundTimer = null;
    /** @type {number} */
    this.roundMs = DEFAULT_ROUND_S * 1000;
  }

  /** @param {Record<string, unknown>} [options] */
  onStart(options = {}) {
    this.prompt = typeof options.prompt === 'string' ? options.prompt : '';
    const rs =
      typeof options.roundSeconds === 'number' ? options.roundSeconds : DEFAULT_ROUND_S;
    this.roundMs = Math.max(15, Math.min(rs, 600)) * 1000;

    this.phase = 'collecting';
    this.answers.clear();
    this.scores.clear();
    this.clusters = [];
    this._clearRoundTimer();

    this.deadlineAt = Date.now() + this.roundMs;
    this.roundTimer = setTimeout(() => {
      this._finalizeRound();
    }, this.roundMs);

    this._emitUpdate();
  }

  /**
   * @param {string} playerId
   * @param {Record<string, unknown>} payload
   */
  onAction(playerId, payload) {
    if (this.phase !== 'collecting') return;
    if (this.deadlineAt != null && Date.now() > this.deadlineAt) return;

    let words = [];
    if (Array.isArray(payload?.words)) {
      words = CommonGuess.normalizeWordsList(payload.words);
    } else if (typeof payload?.answer === 'string' && payload.answer.trim()) {
      words = CommonGuess.normalizeWordsList([payload.answer]);
    }

    this.answers.set(playerId, words);

    this.ctx.emitToSocket(
      this._socketIdForPlayer(playerId),
      'answer_ack',
      { ok: true }
    );
    this._emitUpdate();
  }

  /** @param {Record<string, unknown>} payload */
  onHostAction(payload) {
    const type = payload?.type;
    if (type === 'finalize_round' && this.phase === 'collecting') {
      this._finalizeRound();
    }
  }

  onEnd() {
    this.phase = 'ended';
    this._clearRoundTimer();
  }

  broadcastState() {
    this._emitUpdate();
  }

  getState() {
    return this.getHostState();
  }

  _clearRoundTimer() {
    if (this.roundTimer != null) {
      clearTimeout(this.roundTimer);
      this.roundTimer = null;
    }
  }

  _finalizeRound() {
    if (this.phase !== 'collecting') return;
    this._clearRoundTimer();
    this._computeResults();
    this.phase = 'results';
    if (typeof this.ctx.setRoomStatus === 'function') {
      this.ctx.setRoomStatus('RESULTS');
    }
    this._emitUpdate();
  }

  _computeResults() {
    /** @type {Map<string, Set<string>>} слово -> игроки, у кого оно есть */
    const wordPlayers = new Map();

    for (const [pid, words] of this.answers) {
      const seen = new Set(words);
      for (const w of seen) {
        if (!wordPlayers.has(w)) wordPlayers.set(w, new Set());
        wordPlayers.get(w).add(pid);
      }
    }

    this.clusters = [...wordPlayers.entries()]
      .map(([key, pidSet]) => ({
        key,
        count: pidSet.size,
        playerIds: [...pidSet],
      }))
      .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));

    this.scores.clear();
    for (const c of this.clusters) {
      if (c.count < 2) continue;
      for (const pid of c.playerIds) {
        this.scores.set(pid, (this.scores.get(pid) ?? 0) + 1);
      }
    }
  }

  getHostState() {
    const players = this.ctx.getPlayers();
    const clusters = this.clusters.map((c) => ({
      key: c.key,
      count: c.count,
      answers: c.playerIds.map((pid) => {
        const p = players.get(pid);
        return {
          playerId: pid,
          name: p?.name ?? '?',
          answer: c.key,
        };
      }),
    }));

    let submittedPlayers = 0;
    let totalWords = 0;
    for (const words of this.answers.values()) {
      if (words.length > 0) submittedPlayers += 1;
      totalWords += words.length;
    }

    const leaderboard = [...players.values()]
      .map((p) => ({
        playerId: p.id,
        name: p.name,
        score: this.scores.get(p.id) ?? 0,
      }))
      .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));

    return {
      gameType: 'common_guess',
      view: 'host',
      phase: this.phase,
      prompt: this.prompt,
      maxWords: MAX_WORDS,
      roundSeconds: Math.round(this.roundMs / 1000),
      deadlineAt: this.deadlineAt,
      answerCount: submittedPlayers,
      totalWords,
      clusters,
      leaderboard,
    };
  }

  /** @param {string} playerId */
  getPlayerState(playerId) {
    const myWords = this.answers.get(playerId) ?? [];
    const score = this.scores.get(playerId) ?? 0;

    const wordPlayers = new Map();
    for (const [pid, words] of this.answers) {
      for (const w of new Set(words)) {
        if (!wordPlayers.has(w)) wordPlayers.set(w, new Set());
        wordPlayers.get(w).add(pid);
      }
    }

    const wordDetails = myWords.map((w) => {
      const set = wordPlayers.get(w);
      const matched = set != null && set.size >= 2;
      return { word: w, matched };
    });

    return {
      gameType: 'common_guess',
      view: 'player',
      phase: this.phase,
      prompt: this.prompt,
      maxWords: MAX_WORDS,
      roundSeconds: Math.round(this.roundMs / 1000),
      deadlineAt: this.deadlineAt,
      myWords,
      myScore: score,
      wordDetails,
      submitted: myWords.length > 0,
    };
  }

  /**
   * @param {unknown[]} raw
   * @returns {string[]}
   */
  static normalizeWordsList(raw) {
    const out = [];
    const seen = new Set();
    for (const item of raw) {
      if (out.length >= MAX_WORDS) break;
      const w = CommonGuess.normalizeWord(item);
      if (!w || seen.has(w)) continue;
      seen.add(w);
      out.push(w);
    }
    return out;
  }

  /** Одно слово: нижний регистр, первый токен, обрезка пунктуации по краям */
  static normalizeWord(text) {
    const s = String(text ?? '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ');
    if (!s) return '';
    const first = (s.split(/\s+/)[0] ?? '').replace(
      /^[\s"«».,!?;:'—–-]+|[\s"».,!?;:'—–-]+/g,
      ''
    );
    return first.slice(0, 48);
  }

  _socketIdForPlayer(playerId) {
    const p = this.ctx.getPlayers().get(playerId);
    return p?.socketId ?? '';
  }

  _emitUpdate() {
    const roomStatus =
      typeof this.ctx.getRoomStatus === 'function'
        ? this.ctx.getRoomStatus()
        : 'PLAYING';

    const hostId = this.ctx.getHostSocketId
      ? this.ctx.getHostSocketId()
      : '';

    if (hostId) {
      this.ctx.emitToSocket(hostId, 'game_update', {
        roomCode: this.code,
        roomStatus,
        state: this.getHostState(),
      });
    }

    for (const [pid, p] of this.ctx.getPlayers()) {
      this.ctx.emitToSocket(p.socketId, 'game_update', {
        roomCode: this.code,
        roomStatus,
        state: this.getPlayerState(pid),
      });
    }
  }
}
