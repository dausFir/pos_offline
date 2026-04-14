// Trial validation helper functions
import api from './api';

// Create modal for trial limitation
export const showTrialModal = (message, title = 'Fitur Terbatas - Versi Trial', showContactForm = true) => {
  // Create modal elements
  const overlay = document.createElement('div');
  overlay.style.cssText = `
    position: fixed; top: 0; left: 0; right: 0; bottom: 0; z-index: 10000;
    background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center;
    padding: 20px; animation: fadeIn 0.2s ease;
  `;

  const modal = document.createElement('div');
  modal.style.cssText = `
    background: white; border-radius: 12px; padding: 24px; max-width: 520px; width: 100%;
    box-shadow: 0 20px 40px rgba(0,0,0,0.15); position: relative; 
    animation: slideUp 0.2s ease; transform: translateY(0); max-height: 90vh; overflow-y: auto;
  `;

  const contactFormHtml = showContactForm ? `
    <div id="trialContactForm" style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #eee;">
      <h4 style="margin: 0 0 12px 0; font-size: 16px; color: #333;">💬 Tertarik upgrade? Kami siap bantu!</h4>
      <div style="display: grid; gap: 12px;">
        <input type="text" id="contactName" placeholder="Nama Anda" 
               style="padding: 10px; border: 1px solid #ddd; border-radius: 6px; font-size: 14px;">
        <input type="email" id="contactEmail" placeholder="Email" 
               style="padding: 10px; border: 1px solid #ddd; border-radius: 6px; font-size: 14px;">
        <input type="tel" id="contactPhone" placeholder="No. WhatsApp (opsional)" 
               style="padding: 10px; border: 1px solid #ddd; border-radius: 6px; font-size: 14px;">
        <select id="contactInterest" style="padding: 10px; border: 1px solid #ddd; border-radius: 6px; font-size: 14px;">
          <option value="upgrade">Ingin upgrade versi penuh</option>
          <option value="demo">Minta demo fitur lengkap</option>
          <option value="support">Butuh bantuan teknis</option>
        </select>
        <textarea id="contactMessage" placeholder="Pesan khusus (opsional)" rows="3"
                  style="padding: 10px; border: 1px solid #ddd; border-radius: 6px; font-size: 14px; resize: vertical;"></textarea>
        <button id="submitContact" style="background: #28a745; color: white; border: none; padding: 12px 20px; 
                                         border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 14px;">
          📞 Hubungi Saya
        </button>
      </div>
    </div>
  ` : '';

  modal.innerHTML = `
    <style>
      @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
      @keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
      @keyframes fadeOut { from { opacity: 1; } to { opacity: 0; } }
      @keyframes slideDown { from { transform: translateY(0); opacity: 1; } to { transform: translateY(20px); opacity: 0; } }
    </style>
    <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 16px;">
      <div style="width: 40px; height: 40px; background: #fff3cd; border-radius: 10px; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
        <svg width="20" height="20" fill="#f39c12" viewBox="0 0 24 24"><path d="M12,2C6.48,2 2,6.48 2,12C2,17.52 6.48,22 12,22C17.52,22 22,17.52 22,12C22,6.48 17.52,2 12,2ZM13,17H11V15H13V17ZM13,13H11V7H13V13Z"/></svg>
      </div>
      <h3 style="margin: 0; font-size: 18px; font-weight: 700; color: #333;">${title}</h3>
    </div>
    <p style="margin: 0 0 20px 0; color: #666; line-height: 1.5;">${message}</p>
    ${contactFormHtml}
    <div style="display: flex; gap: 12px; justify-content: flex-end; margin-top: 20px;">
      <button id="trialModalLater" style="background: #6c757d; color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; font-weight: 600;">
        Nanti Dulu
      </button>
      <button id="trialModalOk" style="background: #f39c12; color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; font-weight: 600;">
        OK, Mengerti
      </button>
    </div>
  `;

  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  // Handle contact form submission
  if (showContactForm) {
    modal.querySelector('#submitContact').onclick = async () => {
      const name = modal.querySelector('#contactName').value;
      const email = modal.querySelector('#contactEmail').value;
      const phone = modal.querySelector('#contactPhone').value;
      const interest = modal.querySelector('#contactInterest').value;
      const message = modal.querySelector('#contactMessage').value;

      if (!name || !email) {
        alert('Nama dan email wajib diisi');
        return;
      }

      try {
        const response = await fetch('/api/trial/contact', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, email, phone, interest, message })
        });
        
        const data = await response.json();
        if (data.success) {
          alert('Terima kasih! Tim kami akan menghubungi Anda segera.');
          closeModal();
        } else {
          alert('Gagal mengirim: ' + (data.error || 'Terjadi kesalahan'));
        }
      } catch (error) {
        alert('Gagal mengirim pesan. Pastikan koneksi internet stabil.');
      }
    };
  }

  // Handle close
  const closeModal = () => {
    overlay.style.animation = 'fadeOut 0.2s ease';
    modal.style.animation = 'slideDown 0.2s ease';
    setTimeout(() => {
      if (document.body.contains(overlay)) {
        document.body.removeChild(overlay);
      }
    }, 200);
  };

  modal.querySelector('#trialModalOk').onclick = closeModal;
  modal.querySelector('#trialModalLater').onclick = closeModal;
  overlay.onclick = (e) => { if (e.target === overlay) closeModal(); };
};

// Handle API trial errors
export const handleTrialError = (error) => {
  console.log('handleTrialError called with error:', error);
  console.log('Error response status:', error.response?.status);
  console.log('Error response data:', error.response?.data);
  
  // Handle blob response that might contain JSON error
  if (error.response?.status === 403 && error.response?.data instanceof Blob) {
    console.log('Detected blob response, parsing...');
    // Try to parse blob response as JSON
    error.response.data.text().then(text => {
      try {
        const data = JSON.parse(text);
        console.log('Parsed blob data:', data);
        if (data.data?.is_trial_limit) {
          console.log('Showing trial modal from blob response');
          showTrialModal(data.error || 'Fitur terbatas di versi trial');
        }
      } catch (e) {
        console.log('Error parsing blob as JSON:', e);
        // Not JSON, ignore
      }
    });
    return true;
  }
  
  if (error.response?.data?.data?.is_trial_limit) {
    console.log('Detected trial limit error, showing modal');
    console.log('Error message:', error.response.data.error);
    showTrialModal(error.response.data.error);
    return true;
  }
  
  console.log('Not a trial error, returning false');
  return false;
};

// Wrapper for export functions
export const trialSafeExport = async (exportFunction) => {
  try {
    return await exportFunction();
  } catch (error) {
    if (!handleTrialError(error)) {
      // Re-throw if not a trial error
      throw error;
    }
  }
};

// Get trial status
export const getTrialStatus = async () => {
  try {
    const res = await api.get('/api/settings');
    return res.data.success ? res.data.data : null;
  } catch (err) {
    return null;
  }
};

// License activation function
export const showLicenseActivationModal = () => {
  const overlay = document.createElement('div');
  overlay.style.cssText = `
    position: fixed; top: 0; left: 0; right: 0; bottom: 0; z-index: 10000;
    background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center;
    padding: 20px; animation: fadeIn 0.2s ease;
  `;

  const modal = document.createElement('div');
  modal.style.cssText = `
    background: white; border-radius: 12px; padding: 24px; max-width: 520px; width: 100%;
    box-shadow: 0 20px 40px rgba(0,0,0,0.15); position: relative; 
    animation: slideUp 0.2s ease; transform: translateY(0);
  `;

  modal.innerHTML = `
    <style>
      @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
      @keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
      @keyframes fadeOut { from { opacity: 1; } to { opacity: 0; } }
      @keyframes slideDown { from { transform: translateY(0); opacity: 1; } to { transform: translateY(20px); opacity: 0; } }
    </style>
    <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 16px;">
      <div style="width: 40px; height: 40px; background: #d4edda; border-radius: 10px; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
        <svg width="20" height="20" fill="#28a745" viewBox="0 0 24 24"><path d="M9,20.42L2.79,14.21L5.62,11.38L9,14.77L18.88,4.88L21.71,7.71L9,20.42Z"/></svg>
      </div>
      <h3 style="margin: 0; font-size: 18px; font-weight: 700; color: #333;">🔑 Aktivasi License Key</h3>
    </div>
    <p style="margin: 0 0 20px 0; color: #666; line-height: 1.5;">Masukkan license key untuk upgrade ke versi penuh dan unlock semua fitur:</p>
    
    <div style="display: grid; gap: 12px; margin-bottom: 20px;">
      <input type="text" id="licenseKey" placeholder="KASIR-XXXX-XXXX-XXXX" 
             style="padding: 10px; border: 1px solid #ddd; border-radius: 6px; font-size: 14px; font-family: monospace;">
      <input type="text" id="storeName" placeholder="Nama Toko" 
             style="padding: 10px; border: 1px solid #ddd; border-radius: 6px; font-size: 14px;">
      <input type="email" id="storeEmail" placeholder="Email Toko" 
             style="padding: 10px; border: 1px solid #ddd; border-radius: 6px; font-size: 14px;">
      <input type="tel" id="storePhone" placeholder="Nomor Telepon" 
             style="padding: 10px; border: 1px solid #ddd; border-radius: 6px; font-size: 14px;">
    </div>

    <div style="background: #f8f9fa; padding: 12px; border-radius: 6px; margin-bottom: 20px;">
      <h4 style="margin: 0 0 8px 0; font-size: 14px; color: #495057;">✨ Fitur Versi Penuh:</h4>
      <ul style="margin: 0; padding-left: 16px; color: #6c757d; font-size: 13px; line-height: 1.4;">
        <li>Unlimited produk dan transaksi</li>
        <li>Export data Excel/CSV lengkap</li>
        <li>Backup otomatis database</li>
        <li>Laporan lanjutan dan analytics</li>
        <li>Support teknis prioritas</li>
      </ul>
    </div>

    <div style="display: flex; gap: 12px; justify-content: flex-end;">
      <button id="licenseCancel" style="background: #6c757d; color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; font-weight: 600;">
        Batal
      </button>
      <button id="licenseActivate" style="background: #28a745; color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; font-weight: 600;">
        🔑 Aktivasi License
      </button>
    </div>
  `;

  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  const closeModal = () => {
    overlay.style.animation = 'fadeOut 0.2s ease';
    modal.style.animation = 'slideDown 0.2s ease';
    setTimeout(() => {
      if (document.body.contains(overlay)) {
        document.body.removeChild(overlay);
      }
    }, 200);
  };

  modal.querySelector('#licenseCancel').onclick = closeModal;
  modal.querySelector('#licenseActivate').onclick = async () => {
    const licenseKey = modal.querySelector('#licenseKey').value;
    const storeName = modal.querySelector('#storeName').value;
    const email = modal.querySelector('#storeEmail').value;
    const phone = modal.querySelector('#storePhone').value;

    if (!licenseKey || !storeName || !email) {
      alert('License key, nama toko, dan email wajib diisi');
      return;
    }

    try {
      modal.querySelector('#licenseActivate').textContent = 'Mengaktifkan...';
      modal.querySelector('#licenseActivate').disabled = true;

      const response = await api.post('/license/activate', {
        license_key: licenseKey,
        store_name: storeName,
        email: email,
        phone: phone
      });

      if (response.data.success) {
        alert('🎉 ' + response.data.message);
        closeModal();
        // Refresh page to update trial status
        window.location.reload();
      } else {
        alert('Gagal aktivasi: ' + (response.data.error || 'Terjadi kesalahan'));
        modal.querySelector('#licenseActivate').textContent = '🔑 Aktivasi License';
        modal.querySelector('#licenseActivate').disabled = false;
      }
    } catch (error) {
      alert('Gagal aktivasi: ' + (error.response?.data?.error || error.message));
      modal.querySelector('#licenseActivate').textContent = '🔑 Aktivasi License';
      modal.querySelector('#licenseActivate').disabled = false;
    }
  };

  overlay.onclick = (e) => { if (e.target === overlay) closeModal(); };
};