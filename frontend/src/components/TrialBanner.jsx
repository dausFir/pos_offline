import { useState, useEffect } from 'react';
import Icon from './Icon';
import api from '../utils/api';
import { showLicenseActivationModal } from '../utils/trial';

export default function TrialBanner() {
  const [trialInfo, setTrialInfo] = useState(null);
  const [isVisible, setIsVisible] = useState(true);
  const [showStats, setShowStats] = useState(false);

  useEffect(() => {
    const getTrialInfo = async () => {
      try {
        const res = await api.get('/api/settings');
        if (res.data.success && res.data.data.is_trial_version) {
          setTrialInfo(res.data.data);
        }
      } catch (err) {
        console.error('Failed to get trial info:', err);
      }
    };
    getTrialInfo();
  }, []);

  if (!trialInfo?.is_trial_version || !isVisible) {
    return null;
  }

  const isExpired = trialInfo.is_trial_expired;
  const daysLeft = trialInfo.trial_days_left || 0;
  const stats = trialInfo.trial_usage_stats;

  const getBannerColor = () => {
    if (isExpired) return { bg: '#ffebee', border: '#f44336', text: '#c62828' };
    if (daysLeft <= 1) return { bg: '#fff3e0', border: '#ff9800', text: '#ef6c00' };
    if (daysLeft <= 3) return { bg: '#fff8e1', border: '#ffc107', text: '#f57c00' };
    return { bg: '#e8f5e8', border: '#4caf50', text: '#2e7d32' };
  };

  const colors = getBannerColor();

  return (
    <div style={{
      background: colors.bg,
      border: `1px solid ${colors.border}`,
      borderLeft: `4px solid ${colors.border}`,
      borderRadius: 8,
      padding: '16px 20px',
      margin: '0 0 16px 0',
      fontSize: 14,
      color: colors.text
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: showStats ? 12 : 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Icon name={isExpired ? "error" : "schedule"} size={22} color={colors.border} />
          <div>
            <div style={{ fontWeight: 700, marginBottom: 2, fontSize: 15 }}>
              {isExpired ? '⏰ Trial Version Berakhir' : `⏰ Trial Version - ${daysLeft} hari tersisa`}
            </div>
            <div style={{ fontSize: 13, opacity: 0.85 }}>
              {isExpired ? 
                'Upgrade sekarang untuk melanjutkan.' : 
                `Batas: ${trialInfo.max_products} produk | Sudah digunakan ${stats?.days_used || 0} hari dari 7 hari`
              }
            </div>
          </div>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button 
            onClick={() => setShowStats(!showStats)}
            style={{ 
              background: 'rgba(255,255,255,0.2)', 
              border: `1px solid ${colors.border}`, 
              color: colors.text,
              padding: '6px 10px',
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            📊 {showStats ? 'Sembunyikan' : 'Lihat'} Stats
          </button>
          
          <button 
            onClick={showLicenseActivationModal}
            style={{ 
              background: colors.border, 
              border: 'none', 
              color: 'white',
              padding: '8px 14px',
              borderRadius: 6,
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            🔑 Upgrade Sekarang
          </button>
          
          <button 
            onClick={() => setIsVisible(false)}
            style={{ 
              background: 'none', 
              border: 'none', 
              color: colors.text, 
              cursor: 'pointer',
              padding: 4,
              display: 'flex',
              opacity: 0.6,
              marginLeft: 4
            }}
          >
            <Icon name="close" size={16} />
          </button>
        </div>
      </div>

      {/* Trial Usage Stats */}
      {showStats && stats && (
        <div style={{
          background: 'rgba(255,255,255,0.3)',
          borderRadius: 6,
          padding: '12px 16px',
          marginTop: 12,
          border: `1px solid rgba(${colors.border.replace('#', '')}, 0.3)`,
        }}>
          <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 13 }}>📈 Penggunaan Trial Anda:</div>
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', 
            gap: 12,
            fontSize: 12
          }}>
            <div>
              <div style={{ opacity: 0.8 }}>Produk Dibuat</div>
              <div style={{ fontWeight: 700, fontSize: 14 }}>
                {stats.products_created} / {trialInfo.max_products}
              </div>
            </div>
            <div>
              <div style={{ opacity: 0.8 }}>Transaksi</div>
              <div style={{ fontWeight: 700, fontSize: 14 }}>{stats.transactions_count}</div>
            </div>
            <div>
              <div style={{ opacity: 0.8 }}>Total Omset</div>
              <div style={{ fontWeight: 700, fontSize: 14 }}>
                {new Intl.NumberFormat('id-ID', { 
                  style: 'currency', 
                  currency: 'IDR',
                  minimumFractionDigits: 0 
                }).format(stats.total_revenue)}
              </div>
            </div>
            <div>
              <div style={{ opacity: 0.8 }}>Hari Digunakan</div>
              <div style={{ fontWeight: 700, fontSize: 14 }}>{stats.days_used} hari</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}