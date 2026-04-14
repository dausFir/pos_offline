import { useEffect, useState } from 'react';
import Icon from '../components/Icon';
import { showLicenseActivationModal } from '../utils/trial';

export default function TrialExpired() {
  const [timeLeft, setTimeLeft] = useState('');

  useEffect(() => {
    // Update time every second
    const timer = setInterval(() => {
      const now = new Date();
      const formatted = now.toLocaleTimeString('id-ID', { 
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit',
        timeZone: 'Asia/Jakarta'
      });
      setTimeLeft(formatted);
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 20,
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      <div style={{
        background: 'white',
        borderRadius: 20,
        padding: '40px 32px',
        maxWidth: 480,
        width: '100%',
        textAlign: 'center',
        boxShadow: '0 20px 40px rgba(0,0,0,0.1)',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Background Pattern */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 4,
          background: 'linear-gradient(90deg, #ff6b6b, #feca57, #48dbfb, #ff9ff3)'
        }} />

        {/* Clock Icon */}
        <div style={{
          width: 80,
          height: 80,
          background: 'linear-gradient(135deg, #ff6b6b 0%, #ee5a52 100%)',
          borderRadius: '50%',
          margin: '0 auto 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 8px 24px rgba(255,107,107,0.3)'
        }}>
          <Icon name="schedule" size={36} color="white" />
        </div>

        {/* Title */}
        <h1 style={{
          fontSize: 24,
          fontWeight: 800,
          color: '#2c3e50',
          marginBottom: 8,
          lineHeight: 1.2
        }}>
          ⏰ Trial Period Berakhir
        </h1>

        {/* Subtitle */}
        <p style={{
          fontSize: 16,
          color: '#7f8c8d',
          marginBottom: 24,
          lineHeight: 1.4
        }}>
          7 hari trial Anda telah habis. Semua fitur telah terkunci hingga Anda mengaktifkan versi penuh.
        </p>

        {/* Current Time */}
        <div style={{
          background: '#f8f9fa',
          padding: '12px 20px',
          borderRadius: 12,
          marginBottom: 24,
          border: '2px dashed #dee2e6'
        }}>
          <div style={{ fontSize: 12, color: '#6c757d', marginBottom: 4 }}>
            Waktu saat ini
          </div>
          <div style={{ 
            fontSize: 20,
            fontWeight: 700,
            color: '#495057',
            fontFamily: 'monospace'
          }}>
            {timeLeft}
          </div>
        </div>

        {/* Features List */}
        <div style={{
          background: '#f8f9fa',
          padding: 20,
          borderRadius: 12,
          marginBottom: 24,
          textAlign: 'left'
        }}>
          <h3 style={{ 
            fontSize: 16, 
            fontWeight: 700, 
            color: '#495057',
            marginBottom: 12,
            textAlign: 'center'
          }}>
            🚀 Fitur Versi Penuh
          </h3>
          <ul style={{
            margin: 0,
            paddingLeft: 20,
            color: '#6c757d',
            fontSize: 14,
            lineHeight: 1.6
          }}>
            <li>✅ Unlimited produk dan transaksi</li>
            <li>✅ Export data ke Excel/CSV</li>
            <li>✅ Backup & restore database</li>
            <li>✅ Laporan lanjutan & analytics</li>
            <li>✅ Import produk bulk CSV</li>
            <li>✅ Support prioritas 24/7</li>
          </ul>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: 12 }}>
          <button
            onClick={showLicenseActivationModal}
            style={{
              flex: 1,
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white',
              border: 'none',
              padding: '14px 24px',
              borderRadius: 10,
              fontSize: 16,
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              transition: 'transform 0.2s ease',
            }}
            onMouseDown={(e) => e.target.style.transform = 'scale(0.98)'}
            onMouseUp={(e) => e.target.style.transform = 'scale(1)'}
            onMouseLeave={(e) => e.target.style.transform = 'scale(1)'}
          >
            <Icon name="key" size={18} />
            Aktivasi License Key
          </button>
        </div>

        {/* Contact Info */}
        <div style={{
          marginTop: 20,
          padding: 16,
          background: 'rgba(103, 126, 234, 0.1)',
          borderRadius: 10,
          fontSize: 13,
          color: '#6c757d'
        }}>
          <p style={{ margin: '0 0 8px 0' }}>
            💬 <strong>Butuh bantuan?</strong>
          </p>
          <p style={{ margin: 0 }}>
            Hubungi kami untuk demo dan penawaran khusus
          </p>
        </div>
      </div>
    </div>
  );
}