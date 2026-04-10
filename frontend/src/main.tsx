import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.tsx';
import './index.css';

async function bootstrap() {
  if (!localStorage.getItem('auth_token')) {
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

  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <App />
      </BrowserRouter>
    </React.StrictMode>
  );
}

bootstrap();
