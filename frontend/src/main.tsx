import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.tsx';
import './index.css';
import { logSwallowedError } from './utils/swallowedError';

async function bootstrap() {
  // In DEV we always re-run dev-login on bootstrap so that a stale JWT (e.g.
  // from a previous backend restart) never silently breaks the session.
  // /api/inngest and /api/v1/auth/dev-login are excluded from the global
  // rate limiter so this call does not burn the user-facing budget.
  if (import.meta.env.DEV) {
    // Skip auto-login if the user explicitly clicked Logout
    const isExplicitLogout = new URLSearchParams(window.location.search).get('logged_out') === '1';
    if (!isExplicitLogout) {
      try {
        const resp = await fetch('/api/v1/auth/dev-login');
        if (resp.ok) {
          const data = await resp.json();
          if (data.success && data.token) {
            localStorage.setItem('auth_token', data.token);
            localStorage.setItem('jedi_user', JSON.stringify(data.user));
            // If the app was redirected to /login (e.g. after a stale-token
            // 401), bounce straight to the dashboard so the user never sees
            // the login form during development.
            const path = window.location.pathname;
            if (path === '/login' || path === '/' || path === '') {
              window.location.replace('/terminal/dashboard');
              return;
            }
          }
        }
      } catch (err) { logSwallowedError('main', err); }
    }
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
