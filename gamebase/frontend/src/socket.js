import { io } from 'socket.io-client';

const URL = import.meta.env.VITE_SOCKET_URL || '';

/** Одно соединение на вкладку — чтобы при client-side навигации не рвать сессию хоста. */
let instance = null;

export function getSocket() {
  if (!instance) {
    instance = io(URL, {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
    });
  }
  return instance;
}
