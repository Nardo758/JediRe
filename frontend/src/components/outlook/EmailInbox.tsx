import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function EmailInbox() {
  const navigate = useNavigate();

  useEffect(() => {
    navigate('/dashboard/email', { replace: true });
  }, [navigate]);

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      background: '#0a0f1a',
      color: '#8891a5',
      fontFamily: "'IBM Plex Sans', sans-serif",
    }}>
      Redirecting to COMMS Hub...
    </div>
  );
}
