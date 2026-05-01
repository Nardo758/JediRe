import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.tsx';
import './index.css';

async function bootstrap() {
  // In DEV we always re-run dev-login on bootstrap. If we only ran it when
  // no token was cached, a stale JWT for a throwaway test user (e.g. one
  // auto-created by a test harness) would persist across refreshes and
  // silently keep the workspace empty — even after the backend's dev-login
  // started picking the correct, data-rich user. Re-fetching keeps the
  // session in sync with whichever user the server considers the dev owner.
  if (import.meta.env.DEV) {
    try {
      const resp = await fetch('/api/v1/auth/dev-login');
      if (resp.ok) {
        const data = await resp.json();
        if (data.success && data.token) {
          localStorage.setItem('auth_token', data.token);
          localStorage.setItem('jedi_user', JSON.stringify(data.user));
        }
      }
    } catch {}
  }

  if (!localStorage.getItem('auth_token')) {
    // In production (or if dev-login failed) redirect to login page instead of showing blank terminal
    if (!window.location.pathname.startsWith('/login')) {
      window.location.replace('/login');
      return;
    }
  }

  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <App />
      </BrowserRouter>
    </React.StrictMode>
  );
}

bootstrap();
