"use client";

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { LogOut, User, Building2, Activity } from 'lucide-react';
import { api, type User as CurrentUser } from '../lib/api';
import ThemeToggle from './ThemeToggle';

export default function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<CurrentUser | null>(null);

  useEffect(() => {
    api<{ user: CurrentUser }>('/api/auth/me').then(({ user }) => setUser(user)).catch(() => router.replace('/'));
  }, [router]);

  const handleLogout = async () => {
    await api<void>('/api/auth/logout', { method: 'POST' }).catch(() => undefined);
    setUser(null);
    router.replace('/');
  };

  const toggleDashboard = () => {
    if (pathname.includes('/employer')) {
      router.push('/dashboard/employee');
    } else {
      if (user?.role === 'EMPLOYER') {
        router.push('/dashboard/employer');
      } else {
        alert("Admin privileges required to access the Employer Command Center.");
      }
    }
  };

  if (!user) return null;

  return (
    <nav className="glass-panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.9rem 2rem', marginBottom: '1.75rem', borderRadius: '0 0 var(--border-radius-lg) var(--border-radius-lg)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }} onClick={() => router.push(user.role === 'EMPLOYER' ? '/dashboard/employer' : '/dashboard/employee')}>
          <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
            <Activity size={18} />
          </div>
          <span style={{ fontSize: '1.25rem', fontWeight: 700, background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            CoreConnect
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderLeft: '1px solid var(--border-color)', paddingLeft: '1rem' }}>
          <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>{user.name}</span>
          <span className={`badge ${user.role === 'EMPLOYER' ? 'badge-info' : 'badge-success'}`}>
            {user.role}
          </span>
          {user.department && (
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>• {user.department}</span>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <ThemeToggle />
        {user.role === 'EMPLOYER' && (
          <button onClick={toggleDashboard} className="btn btn-secondary" style={{ padding: '7px 14px', fontSize: '0.88rem', display: 'flex', gap: '6px', alignItems: 'center' }}>
            {pathname.includes('/employer') ? (
              <><User size={16} /> View as Employee</>
            ) : (
              <><Building2 size={16} /> View as Employer</>
            )}
          </button>
        )}
        <button onClick={handleLogout} className="btn" style={{ background: 'transparent', color: 'var(--text-secondary)', border: '1px solid var(--border-color)', padding: '7px 14px', fontSize: '0.88rem', display: 'flex', gap: '6px', alignItems: 'center' }}>
          <LogOut size={16} /> Sign out
        </button>
      </div>
    </nav>
  );
}
