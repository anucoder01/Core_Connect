"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function EmployerDashboard() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [leads, setLeads] = useState<any[]>([]);
  const [leaves, setLeaves] = useState<any[]>([]);

  useEffect(() => {
    const storedUser = localStorage.getItem('currentUser');
    if (!storedUser) {
      router.push('/');
      return;
    }
    const parsed = JSON.parse(storedUser);
    if (parsed.role !== 'EMPLOYER') {
      router.push('/');
      return;
    }
    setUser(parsed);
    fetchData();
  }, [router]);

  const fetchData = async () => {
    try {
      const [usersRes, leadsRes, leavesRes] = await Promise.all([
        fetch('http://localhost:4000/api/users'),
        fetch('http://localhost:4000/api/leads'),
        fetch('http://localhost:4000/api/leaves')
      ]);
      setUsers(await usersRes.json());
      setLeads(await leadsRes.json());
      setLeaves(await leavesRes.json());
    } catch (err) {
      console.error('Error fetching data', err);
    }
  };

  if (!user) return <div style={{ padding: '2rem' }}>Loading...</div>;

  return (
    <div style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto' }} className="animate-fade-in">
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '2rem' }}>Unified Command Center</h1>
          <p>Welcome back, {user.name} - CRM & HR Overview</p>
        </div>
        <button className="btn btn-secondary" onClick={() => {
          localStorage.removeItem('currentUser');
          router.push('/');
        }}>
          Sign Out
        </button>
      </header>

      {/* Top Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem', marginBottom: '3rem' }}>
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <h3 style={{ color: 'var(--text-secondary)', fontSize: '1rem', marginBottom: '0.5rem' }}>Active Employees</h3>
          <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: 'var(--accent-primary)' }}>
            {users.filter(u => u.role === 'EMPLOYEE').length}
          </div>
        </div>
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <h3 style={{ color: 'var(--text-secondary)', fontSize: '1rem', marginBottom: '0.5rem' }}>Active Leads (CRM)</h3>
          <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: 'var(--accent-secondary)' }}>
            {leads.length}
          </div>
        </div>
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <h3 style={{ color: 'var(--text-secondary)', fontSize: '1rem', marginBottom: '0.5rem' }}>Pending Leaves</h3>
          <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: 'var(--accent-warning)' }}>
            {leaves.filter(l => l.status === 'PENDING').length}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(500px, 1fr))', gap: '2rem' }}>
        
        {/* CRM Pipeline */}
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <h2 style={{ marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
            CRM Pipeline
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {leads.map(lead => (
              <div key={lead.id} style={{ padding: '1rem', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 'bold', color: 'white' }}>{lead.company} - {lead.name}</div>
                  <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Assignee: {lead.assignee?.name || 'Unassigned'}</div>
                </div>
                <div style={{ padding: '4px 12px', background: 'var(--accent-secondary)', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 'bold' }}>
                  {lead.status}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* HR Operations */}
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <h2 style={{ marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
            Leave Requests (HR)
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {leaves.map(leave => (
              <div key={leave.id} style={{ padding: '1rem', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 'bold', color: 'white' }}>{leave.user?.name}</div>
                  <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>{leave.type} ({new Date(leave.fromDate).toLocaleDateString()} - {new Date(leave.toDate).toLocaleDateString()})</div>
                  <div style={{ fontSize: '0.85rem', color: '#94a3b8', marginTop: '4px' }}>Reason: {leave.reason}</div>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  {leave.status === 'PENDING' ? (
                    <>
                      <button className="btn btn-primary" style={{ padding: '6px 12px', fontSize: '0.85rem', background: 'var(--accent-success)' }}>Approve</button>
                      <button className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '0.85rem', color: 'var(--accent-danger)' }}>Reject</button>
                    </>
                  ) : (
                    <span style={{ color: leave.status === 'APPROVED' ? 'var(--accent-success)' : 'var(--accent-danger)' }}>
                      {leave.status}
                    </span>
                  )}
                </div>
              </div>
            ))}
            {leaves.length === 0 && <div style={{ color: 'var(--text-secondary)' }}>No leave requests found.</div>}
          </div>
        </div>

      </div>
    </div>
  );
}
