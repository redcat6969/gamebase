import { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';

const BLANK = () => ['', '', '', '', ''];

export default function CommonGuessPlayer({ state, roomCode, socket, playerId }) {
  const [fields, setFields] = useState(BLANK);
  const [lastAck, setLastAck] = useState(null);
  const [now, setNow] = useState(Date.now());
  const fieldsRef = useRef(fields);
  const lastDeadlineRef = useRef(null);

  useEffect(() => {
    fieldsRef.current = fields;
  }, [fields]);

  const collecting = state?.phase === 'collecting';
  const results = state?.phase === 'results';

  const secLeft =
    collecting && state?.deadlineAt
      ? Math.max(0, Math.ceil((state.deadlineAt - now) / 1000))
      : 0;

  useEffect(() => {
    if (!collecting || !state?.deadlineAt) return;
    const t = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(t);
  }, [collecting, state?.deadlineAt]);

  // Новый раунд — чистые поля
  useEffect(() => {
    if (!collecting || !state?.deadlineAt) return;
    if (lastDeadlineRef.current === state.deadlineAt) return;
    lastDeadlineRef.current = state.deadlineAt;
    setFields(BLANK());
    setLastAck(null);
  }, [collecting, state?.deadlineAt]);

  const sendWords = useCallback(
    (words) => {
      if (!playerId || !roomCode) return;
      socket.emit('player_action', {
        code: roomCode,
        playerId,
        action: { words },
      });
    },
    [playerId, roomCode, socket]
  );

  useEffect(() => {
    function onAck(p) {
      if (p?.ok) setLastAck(true);
    }
    socket.on('answer_ack', onAck);
    return () => socket.off('answer_ack', onAck);
  }, [socket]);

  // Финальная отправка в конце минуты
  useEffect(() => {
    if (!collecting || !state?.deadlineAt || !playerId) return;
    const ms = state.deadlineAt - Date.now();
    if (ms <= 0) return;
    const t = setTimeout(() => {
      const raw = fieldsRef.current.map((x) => x.trim()).filter(Boolean);
      sendWords(raw);
    }, ms);
    return () => clearTimeout(t);
  }, [collecting, state?.deadlineAt, playerId, sendWords]);

  // Автосохранение при наборе (не шлём пустой массив сразу при открытии)
  useEffect(() => {
    if (!collecting || !playerId) return;
    const raw = fields.map((x) => x.trim()).filter(Boolean);
    if (raw.length === 0) return;
    const t = setTimeout(() => sendWords(raw), 450);
    return () => clearTimeout(t);
  }, [fields, collecting, playerId, sendWords]);

  function setField(i, v) {
    setFields((prev) => {
      const next = [...prev];
      next[i] = v;
      return next;
    });
    setLastAck(null);
  }

  const timeUp = collecting && secLeft <= 0;
  const disabled = !collecting || timeUp;

  if (!state) return null;

  if (results) {
    const details = state.wordDetails ?? [];
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col gap-4 max-w-md mx-auto px-4"
      >
        <p className="text-slate-400 text-sm text-center">Раунд завершён</p>
        <div className="rounded-2xl border border-slate-700 bg-slate-900/80 p-4">
          <p className="text-slate-500 text-sm mb-2">Твои слова</p>
          <ul className="space-y-1 text-left">
            {details.length === 0 && (
              <li className="text-slate-600 text-sm">Ничего не введено</li>
            )}
            {details.map((d, i) => (
              <li
                key={`${d.word}-${i}`}
                className="flex justify-between gap-2 text-slate-200 capitalize"
              >
                <span>{d.word}</span>
                <span
                  className={
                    d.matched ? 'text-emerald-400 text-sm' : 'text-slate-600 text-sm'
                  }
                >
                  {d.matched ? '+1' : '—'}
                </span>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-2xl border border-emerald-900/50 bg-emerald-950/40 p-6 text-center">
          <p className="text-slate-400 text-sm mb-1">Всего очков</p>
          <p className="text-4xl font-black text-emerald-400">{state.myScore ?? 0}</p>
          <p className="text-slate-500 text-xs mt-3">
            +1 за слово, которое ввели минимум двое
          </p>
        </div>
      </motion.div>
    );
  }

  const mm = String(Math.floor(secLeft / 60)).padStart(2, '0');
  const ss = String(secLeft % 60).padStart(2, '0');
  const maxW = state.maxWords ?? 5;

  return (
    <div className="flex flex-col gap-4 max-w-md mx-auto px-4">
      <div className="text-center">
        <p
          className={`text-4xl font-mono font-bold ${
            secLeft <= 10 && secLeft > 0 ? 'text-red-400' : 'text-white'
          }`}
        >
          {mm}:{ss}
        </p>
        <p className="text-slate-500 text-xs mt-1">
          До {maxW} слов · вопрос на экране хоста
        </p>
      </div>
      <div className="space-y-2">
        {Array.from({ length: maxW }, (_, i) => (
          <label key={i} className="block">
            <span className="text-slate-500 text-xs ml-1">Слово {i + 1}</span>
            <input
              type="text"
              value={fields[i] ?? ''}
              onChange={(e) => setField(i, e.target.value)}
              disabled={disabled}
              maxLength={56}
              className="mt-0.5 w-full rounded-xl bg-slate-900 border border-slate-700 px-4 py-3 text-lg disabled:opacity-40"
              placeholder="…"
            />
          </label>
        ))}
      </div>
      <button
        type="button"
        onClick={() => sendWords(fields.map((x) => x.trim()).filter(Boolean))}
        disabled={disabled}
        className="rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 py-3 text-lg font-semibold"
      >
        Сохранить ответы
      </button>
      {lastAck && !timeUp && (
        <p className="text-center text-emerald-400 text-sm">Сохранено на сервере</p>
      )}
      {timeUp && (
        <p className="text-center text-slate-500 text-sm">Время вышло, жди итоги…</p>
      )}
    </div>
  );
}
