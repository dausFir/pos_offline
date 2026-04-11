import { useState, useEffect } from 'react';
import api, { formatDate } from '../utils/api';
import { useI18n } from '../context/I18nContext';
import Icon from '../components/Icon';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';

const ROLES = [
  { id: 'cashier',     label: 'Kasir',       desc: 'Hanya bisa akses menu kasir/POS',                color: 'badge-green' },
  { id: 'admin',       label: 'Admin',        desc: 'Akses produk, transaksi, laporan, pengaturan',   color: 'badge-blue' },
  { id: 'super_admin', label: 'Super Admin',  desc: 'Akses penuh termasuk manajemen pengguna',        color: 'badge-teal' },
];

export default function UsersPage() {
  const { user: currentUser } = useAuth();
  const { t } = useI18n();
  const [users,     setUsers]     = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editUser,  setEditUser]  = useState(null); // null = create, obj = edit
  const [form,      setForm]      = useState({ username: '', password: '', role: 'cashier' });
  const [saving,    setSaving]    = useState(false);
  const [showPw,    setShowPw]    = useState(false);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await api.get('/users');
      setUsers(res.data.data || []);
    } catch { toast.error('Gagal memuat pengguna'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchUsers(); }, []);

  const openCreate = () => {
    setEditUser(null);
    setForm({ username: '', password: '', role: 'cashier' });
    setShowPw(false);
    setShowModal(true);
  };

  const openEdit = (u) => {
    setEditUser(u);
    setForm({ username: u.username, password: '', role: u.role });
    setShowPw(false);
    setShowModal(true);
  };

  const handleSave = async () => {
    if (editUser) {
      // Edit mode: role change and/or password reset
      if (!form.role) { toast.error('Pilih role'); return; }
      if (form.password && form.password.length < 6) { toast.error('Password baru minimal 6 karakter'); return; }
      setSaving(true);
      try {
        await api.put(`/users/${editUser.id}`, {
          role: form.role,
          new_password: form.password || undefined,
        });
        toast.success('Pengguna berhasil diupdate');
        setShowModal(false);
        fetchUsers();
      } catch (err) {
        toast.error(err.response?.data?.error || 'Gagal update pengguna');
      } finally { setSaving(false); }
    } else {
      // Create mode
      if (!form.username || !form.password) { toast.error('Username dan password wajib diisi'); return; }
      if (form.password.length < 6) { toast.error('Password minimal 6 karakter'); return; }
      setSaving(true);
      try {
        await api.post('/users', form);
        toast.success('Pengguna berhasil ditambahkan');
        setShowModal(false);
        fetchUsers();
      } catch (err) {
        toast.error(err.response?.data?.error || 'Gagal membuat pengguna');
      } finally { setSaving(false); }
    }
  };

  const handleDelete = async (u) => {
    if (u.id === currentUser?.id) { toast.error('Tidak bisa menghapus akun sendiri'); return; }
    if (!confirm(`Hapus pengguna "${u.username}"?`)) return;
    try {
      await api.delete(`/users/${u.id}`);
      toast.success('Pengguna dihapus');
      fetchUsers();
    } catch { toast.error('Gagal menghapus pengguna'); }
  };

  const getRoleBadge = (role) => {
    const r = ROLES.find(r => r.id === role);
    return r ? <span className={`badge ${r.color}`}>{r.label}</span> : <span className="badge">{role}</span>;
  };

  const isEditable = (u) => u.role !== 'super_admin' || u.id === currentUser?.id;

  return (
    <div style={{ padding: 24 }}>
      <div className="page-header">
        <div>
          <h1 className="page-title font-headline">{t('nav.users')}</h1>
          <p className="page-subtitle">{users.length} pengguna terdaftar</p>
        </div>
        <button className="btn btn-primary" onClick={openCreate}>
          <Icon name="add" size={16} /> Tambah Pengguna
        </button>
      </div>

      {/* Role guide */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 24 }}>
        {ROLES.map(r => (
          <div key={r.id} className="card" style={{ padding: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <Icon name="security" size={14} color="var(--outline)" />
              <span className={`badge ${r.color}`}>{r.label}</span>
            </div>
            <p style={{ fontSize: 12, color: 'var(--outline)' }}>{r.desc}</p>
          </div>
        ))}
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Username</th>
                <th>Role</th>
                <th>Dibuat</th>
                <th>Diupdate</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {loading
                ? <tr><td colSpan={6} style={{ textAlign: 'center', padding: 40 }}><div className="spinner" style={{ margin: '0 auto' }} /></td></tr>
                : users.map((u, i) => (
                <tr key={u.id}>
                  <td style={{ color: 'var(--outline)', fontSize: 12 }}>{i + 1}</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 34, height: 34, borderRadius: '50%', background: u.id === currentUser?.id ? 'var(--primary)' : 'var(--surface-container-highest)', color: u.id === currentUser?.id ? '#fff' : 'var(--on-surface-variant)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 14, flexShrink: 0 }}>
                        {u.username[0]?.toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontWeight: 600 }}>{u.username}</div>
                        {u.id === currentUser?.id && <div style={{ fontSize: 10, color: 'var(--primary)', fontWeight: 700 }}>● Anda</div>}
                      </div>
                    </div>
                  </td>
                  <td>{getRoleBadge(u.role)}</td>
                  <td style={{ fontSize: 12, color: 'var(--outline)' }}>{formatDate(u.created_at)}</td>
                  <td style={{ fontSize: 12, color: 'var(--outline)' }}>{formatDate(u.updated_at)}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {u.id !== currentUser?.id && (
                        <button className="btn btn-ghost" style={{ padding: '5px 10px' }} onClick={() => openEdit(u)} title="Edit role / reset password">
                          <Icon name="edit" size={14} />
                        </button>
                      )}
                      {u.role !== 'super_admin' && u.id !== currentUser?.id
                        ? <button className="btn btn-danger" style={{ padding: '5px 10px' }} onClick={() => handleDelete(u)}>
                            <Icon name="delete" size={14} />
                          </button>
                        : <span style={{ fontSize: 12, color: 'var(--outline)', padding: '0 8px' }}>—</span>
                      }
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Modal */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <span className="modal-title">
                {editUser ? `✏️ Edit: ${editUser.username}` : '👤 Tambah Pengguna Baru'}
              </span>
              <button className="icon-btn" onClick={() => setShowModal(false)}>
                <Icon name="close" size={20} />
              </button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

                {/* Username — only show on create */}
                {!editUser && (
                  <div className="input-group">
                    <label className="input-label">Username *</label>
                    <input className="input" placeholder="cth: kasir_budi"
                      value={form.username}
                      onChange={e => setForm(f => ({ ...f, username: e.target.value }))} autoFocus />
                  </div>
                )}

                {/* Password */}
                <div className="input-group">
                  <label className="input-label">
                    {editUser ? 'Reset Password (kosongkan jika tidak ingin diubah)' : 'Password * (min. 6 karakter)'}
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input className="input" type={showPw ? 'text' : 'password'}
                      style={{ paddingRight: 44 }}
                      placeholder={editUser ? 'Kosongkan jika tidak diubah...' : 'Password aman...'}
                      value={form.password}
                      onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
                    <button type="button" className="icon-btn" style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)' }}
                      onClick={() => setShowPw(v => !v)}>
                      <Icon name={showPw ? 'visibility_off' : 'visibility'} size={17} />
                    </button>
                  </div>
                  {form.password && form.password.length < 6 && (
                    <p style={{ fontSize: 11, color: 'var(--error)', marginTop: 4 }}>Minimal 6 karakter</p>
                  )}
                </div>

                {/* Role selector */}
                <div className="input-group">
                  <label className="input-label">Role / Jabatan</label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {ROLES.map(r => (
                      <button key={r.id} type="button" onClick={() => setForm(f => ({ ...f, role: r.id }))} style={{
                        padding: '12px 14px', borderRadius: 'var(--radius-sm)', border: `2px solid ${form.role === r.id ? 'var(--primary)' : 'var(--outline-variant)'}`,
                        background: form.role === r.id ? 'var(--primary-fixed)' : 'var(--surface-container-low)',
                        cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                          <span className={`badge ${r.color}`}>{r.label}</span>
                          {form.role === r.id && <Icon name="check_circle" size={14} color="var(--primary)" />}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--outline)' }}>{r.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Info box for edit mode */}
                {editUser && (
                  <div style={{ padding: '10px 12px', background: 'var(--primary-fixed)', borderRadius: 8, fontSize: 12, color: 'var(--primary)' }}>
                    <strong>Tip:</strong> Kosongkan field password jika hanya ingin mengubah role. Isi password jika ingin reset password pengguna ini.
                  </div>
                )}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setShowModal(false)}>Batal</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                {saving
                  ? <span className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} />
                  : editUser ? 'Update Pengguna' : 'Buat Pengguna'
                }
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
