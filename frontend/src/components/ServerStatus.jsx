import { useState, useEffect } from 'react';
import { useI18n } from '../context/I18nContext';
import api from '../utils/api';

export default function ServerStatus() {
  const { t } = useI18n();
  const [status, setStatus]       = useState('checking');
  const [lastCheck, setLastCheck] = useState(null);

  const check = async () => {
    setStatus('checking');
    try {
      await api.get('/status', { timeout: 3000 });
      setStatus('online');
    } catch {
      setStatus('offline');
    }
    setLastCheck(new Date());
  };

  useEffect(() => {
    check();
    const t = setInterval(check, 30000);
    return () => clearInterval(t);
  }, []);

  const cfg = {
    online:   { label: t('status.online'),   dot: '#1a7a3c', bg: '#d4f4e1', col: '#1a7a3c' },
    offline:  { label: t('status.offline'),  dot: '#ba1a1a', bg: '#ffdad6', col: '#ba1a1a' },
    checking: { label: t('status.checking'), dot: '#92600a', bg: '#fff3cd', col: '#92600a' },
  }[status];

  return (
    <div
      title={lastCheck ? `${lastCheck.toLocaleTimeString('id-ID')}` : ''}
      onClick={check}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 9px', borderRadius: 100, background: cfg.bg, cursor: 'pointer', border: `1px solid ${cfg.dot}33`, transition: 'all 0.2s', userSelect: 'none' }}
    >
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: cfg.dot, flexShrink: 0, animation: status === 'offline' ? 'blink 1s infinite' : 'none' }} />
      <span style={{ fontSize: 11, fontWeight: 700, color: cfg.col, whiteSpace: 'nowrap' }}>{cfg.label}</span>
      <style>{`@keyframes blink { 0%,100%{opacity:1} 50%{opacity:.3} }`}</style>
    </div>
  );
}
