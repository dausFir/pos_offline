import { useEffect, useState } from 'react';
import api from '../utils/api';
import toast from 'react-hot-toast';

export default function Operations() {
  const [diagnostics, setDiagnostics] = useState(null);
  const [events, setEvents] = useState([]);
  const load = async () => {
    try {
      const [diag, audit] = await Promise.all([api.get('/diagnostics'), api.get('/audit-events', { params: { limit: 50 } })]);
      setDiagnostics(diag.data.data); setEvents(audit.data.data || []);
    } catch { toast.error('Gagal memuat data operasional'); }
  };
  useEffect(() => { load(); }, []);
  return <div style={{ padding: 32, maxWidth: 1100 }}>
    <div className="page-header"><div><h1 className="page-title font-headline">Audit & Diagnostik</h1><p className="page-subtitle">Pantau integritas database, backup otomatis, dan aktivitas perubahan data.</p></div><button className="btn btn-primary" onClick={load}>Muat Ulang</button></div>
    {diagnostics && <div className="card" style={{ marginBottom: 20 }}><div style={{ display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))',gap:12 }}>
      {[['Integritas DB', diagnostics.database_integrity],['Audit Chain', diagnostics.audit_chain_valid ? 'Valid' : 'TIDAK VALID'],['Ukuran Database', `${Math.round((diagnostics.database_size_bytes || 0)/1024)} KB`],['Backup Otomatis Terakhir', diagnostics.last_auto_backup_at || 'Belum ada']].map(([label,value]) => <div key={label} style={{ background:'var(--surface-container-low)',padding:14,borderRadius:10 }}><div style={{ fontSize:11,color:'var(--outline)',fontWeight:700,textTransform:'uppercase' }}>{label}</div><div style={{ marginTop:6,fontWeight:800,color:value==='TIDAK VALID'?'var(--error)':'var(--primary)' }}>{value}</div></div>)}
    </div></div>}
    <section className="card"><h2 style={{ fontSize:16,fontWeight:800,marginBottom:12 }}>Audit Perubahan Terbaru</h2><div style={{ overflowX:'auto' }}><table className="table"><thead><tr><th>Waktu</th><th>User</th><th>Aksi</th><th>Resource</th><th>Hasil</th></tr></thead><tbody>{events.map(e=><tr key={e.id}><td>{e.created_at}</td><td>{e.username || '-'}</td><td>{e.action}</td><td>{e.resource}</td><td>{e.detail}</td></tr>)}{events.length===0&&<tr><td colSpan="5">Belum ada event.</td></tr>}</tbody></table></div></section>
  </div>;
}
