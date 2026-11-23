import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { GameRoot } from './components/GameRoot';

/**
 * HashRouter keeps every route under "#/", so refreshing on GitHub Pages
 * never hits a server-side 404.
 */
export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<GameRoot />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  );
}
