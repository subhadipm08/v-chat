import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';

// ─── Global unhandled error/promise guards ────────────────────────────────
// These catch crashes that happen OUTSIDE the React component tree
// (e.g. in Web Workers, event callbacks, setTimeout, etc.)

window.addEventListener('unhandledrejection', (event) => {
  // Prevent the browser default (red console error with full stack)
  event.preventDefault();
  if (import.meta.env.DEV) {
    console.error('[Unhandled Promise Rejection]', event.reason);
  }
  // In production: fail silently — the UI error boundary or local
  // error states should already have shown the user something.
});

window.addEventListener('error', (event) => {
  if (import.meta.env.DEV) {
    console.error('[Global Error]', event.error);
  }
  // Prevent default browser error overlay in production
  event.preventDefault();
});

// ─── Root render — wrapped in ErrorBoundary ───────────────────────────────
createRoot(document.getElementById('root')).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
);
