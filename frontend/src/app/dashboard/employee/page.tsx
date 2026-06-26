"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function EmployeeDashboard() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [leads, setLeads] = useState<any[]>([]);

  useEffect(() => {
    const storedUser = localStorage.getItem('currentUser');
    if (!storedUser) {
      router.push('/');
      return;
    }
    const parsed = JSON.parse(storedUser);
    if (parsed.role !== 'EMPLOYEE') {
      router.push('/');
      return;
    }
    setUser(parsed);
    fetchData(parsed.id);
  }, [router]);

  const fetchData = async (userId: string) => {
    try {
      // In real app, filter leads by user id on backend
      const res = await fetch('http://localhost:4000/api/leads');
      const allLeads = await res.json();
      setLeads(allLeads.filter((l: any) => l.assigneeId === userId));
    } catch (err) {
      console.error('Error fetching data', err);
    }
  };

  if (!user) return <div style={{ padding: '2rem' }}>Loading...</div>;

  return (
    <div style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto' }} className="animate-fade-in">
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '2rem' }}>Employee Portal</h1>
          <p>Welcome back, {user.name} ({user.position})</p>
        </div>
        <button className="btn btn-secondary" onClick={() => {
          localStorage.removeItem('currentUser');
          router.push('/');
        }}>
          Sign Out
        </button>
      </header>

      {/* Top Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', marginBottom: '3rem' }}>
        <div className="glass-panel" style={{ padding: '1.5rem', textAlign: 'center' }}>
          <h3 style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '0.5rem' }}>Leave Balance</h3>
          <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: 'var(--accent-primary)' }}>15</div>
        </div>
        <div className="glass-panel" style={{ padding: '1.5rem', textAlign: 'center' }}>
          <h3 style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '0.5rem' }}>Active Clients</h3>
          <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: 'var(--accent-success)' }}>{leads.length}</div>
        </div>
        <div className="glass-panel" style={{ padding: '1.5rem', textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <button className="btn btn-primary" style={{ width: '100%' }}>Mark Attendance</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '2rem' }}>
        
        {/* CRM Tasks */}
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <h2 style={{ marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
            My Assigned Leads (CRM)
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {leads.length > 0 ? leads.map(lead => (
              <div key={lead.id} style={{ padding: '1rem', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 'bold', color: 'white' }}>{lead.company}</div>
                  <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Contact: {lead.email}</div>
                </div>
                <div style={{ padding: '4px 12px', background: 'var(--accent-secondary)', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 'bold' }}>
                  {lead.status}
                </div>
              </div>
            )) : (
              <div style={{ color: 'var(--text-secondary)' }}>No leads assigned to you.</div>
            )}
          </div>
        </div>

        {/* HR Operations */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          <div className="glass-panel" style={{ padding: '1.5rem' }}>
            <h2 style={{ marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
              Apply for Leave
            </h2>
            <form style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }} onSubmit={(e) => { e.preventDefault(); alert('Leave submitted!'); }}>
              <select className="input-field" required>
                <option value="">Select Leave Type</option>
                <option value="annual">Annual Leave</option>
                <option value="sick">Sick Leave</option>
              </select>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <input type="date" className="input-field" required />
                <input type="date" className="input-field" required />
              </div>
              <textarea className="input-field" placeholder="Reason..." rows={3} required></textarea>
              <button type="submit" className="btn btn-primary">Submit Application</button>
            </form>
          </div>

          <div className="glass-panel" style={{ padding: '1.5rem', border: '1px solid rgba(139, 92, 246, 0.4)' }}>
            <h2 style={{ marginBottom: '1rem', color: 'var(--accent-secondary)' }}>
              Submit Pulse Check
            </h2>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
              How are you feeling about work today? Your feedback helps us improve the workplace.
            </p>
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
              {[1,2,3,4,5].map(score => (
                <button key={score} className="btn btn-secondary" style={{ flex: 1, padding: '0.5rem' }}>
                  {score}
                </button>
              ))}
            </div>
            <button className="btn btn-primary" style={{ width: '100%', background: 'linear-gradient(135deg, var(--accent-secondary) 0%, #4c1d95 100%)' }}>Submit Pulse</button>
          </div>
        </div>

      </div>
    </div>
  );
}
