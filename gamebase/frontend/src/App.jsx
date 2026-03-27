import { Routes, Route, Navigate } from 'react-router-dom';
import HomePage from './pages/HomePage.jsx';
import HostRoomPage from './pages/HostRoomPage.jsx';
import PlayRoomPage from './pages/PlayRoomPage.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/room/:code/host" element={<HostRoomPage />} />
      <Route path="/room/:code/play" element={<PlayRoomPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
