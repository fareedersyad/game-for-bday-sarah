import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/cormorant-garamond/500.css';
import '@fontsource/cormorant-garamond/600.css';
import '@fontsource/cormorant-garamond/700.css';
import '@fontsource/cormorant-garamond/500-italic.css';
import '@fontsource/dancing-script/500.css';
import '@fontsource/dancing-script/700.css';
import '@fontsource/nunito/400.css';
import '@fontsource/nunito/600.css';
import '@fontsource/nunito/700.css';
import './styles/index.css';
import App from './App';
import { ErrorBoundary } from './components/ui/ErrorBoundary';

/** iOS Safari: 100vh includes the browser chrome; track the real height. */
function syncAppHeight() {
  document.documentElement.style.setProperty('--app-height', `${window.innerHeight}px`);
}
if (!CSS.supports('height', '100dvh')) {
  syncAppHeight();
  window.addEventListener('resize', syncAppHeight);
  window.addEventListener('orientationchange', () => setTimeout(syncAppHeight, 250));
}

// Prevent iOS double-tap zoom & pinch zoom inside the game surface.
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('dblclick', (e) => e.preventDefault());

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
