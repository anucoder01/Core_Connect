/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { LogOut, User, Building2 } from 'lucide-react';

export default function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<{name: string, role: string} | null>(null);

  useEffect(() => {
    const userStr = localStorage.getItem('currentUser');
    if (userStr) {
      try {
        setUser(JSON.parse(userStr));
      } catch {
        // ignore
      }
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('currentUser');
    router.push('/');
  };

  const toggleDashboard = () => {
    if (pathname.includes('/employer')) {
      router.push('/dashboard/employee');
    } else {
      if (user?.role === 'EMPLOYER') {
        router.push('/dashboard/employer');
      } else {
        alert("Unauthorized: Admin privileges required.");
      }
    }
  };

  if (!user) return null;

  return (
    <nav className="glass-panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 2rem', marginBottom: '2rem', borderRadius: '0 0 var(--border-radius-lg) var(--border-radius-lg)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <h2 style={{ background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', margin: 0 }}>CoreConnect</h2>
        <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>| {user.name} ({user.role})</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        {user.role === 'EMPLOYER' && (
          <button onClick={toggleDashboard} className="btn btn-secondary" style={{ padding: '8px 16px', display: 'flex', gap: '8px', alignItems: 'center' }}>
            {pathname.includes('/employer') ? <><User size={18} /> View as Employee</> : <><Building2 size={18} /> View as Employer</>}
          </button>
        )}
        <button onClick={handleLogout} className="btn" style={{ background: 'transparent', color: 'var(--text-secondary)', border: '1px solid var(--border-color)', padding: '8px 16px', display: 'flex', gap: '8px', alignItems: 'center' }}>
          <LogOut size={18} /> Logout
        </button>
      </div>
    </nav>
  );
}
