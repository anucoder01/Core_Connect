"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldCheck, UserCheck, Building2, Terminal } from 'lucide-react';
import { api, type User } from '../lib/api';

export default function LoginPage() {
  const router = useRouter();
  const [role, setRole] = useState<'EMPLOYEE' | 'EMPLOYER'>('EMPLOYEE');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const performLogin = async (userEmail: string, userPass: string, selectedRole: string) => {
    setLoading(true);
    setError('');

    try {
      const data = await api<{ user: User }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: userEmail, password: userPass, role: selectedRole }),
      });
      router.push(data.user.role === 'EMPLOYER' ? '/dashboard/employer' : '/dashboard/employee');
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message || 'Server error. Please ensure the backend is running on port 4000.');
      } else {
        setError('Server error. Please ensure the backend is running on port 4000.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    performLogin(email, password, role);
  };

  return (
    <main style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
      <div className="glass-panel animate-fade-in" style={{ width: '100%', maxWidth: '520px', padding: '2.5rem' }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
          <div style={{ display: 'inline-flex', padding: '10px', background: 'rgba(79, 70, 229, 0.1)', borderRadius: '16px', color: 'var(--accent-primary)', marginBottom: '12px' }}>
            <Building2 size={32} />
          </div>
          <h1 style={{ fontSize: '2.2rem', marginBottom: '0.4rem', background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            CoreConnect
          </h1>
          <p style={{ fontSize: '0.95rem' }}>The Unified HR & CRM Intelligence Platform</p>
        </div>

        {/* Role Toggle */}
        <div style={{ display: 'flex', background: 'rgba(0,0,0,0.05)', borderRadius: 'var(--border-radius-md)', padding: '4px', marginBottom: '1.5rem' }}>
          <button
            type="button"
            onClick={() => {
              setRole('EMPLOYER');
              setEmail('');
              setPassword('');
            }}
            style={{
              flex: 1, padding: '10px', borderRadius: '10px', border: 'none',
              background: role === 'EMPLOYER' ? 'var(--accent-primary)' : 'transparent',
              color: role === 'EMPLOYER' ? 'white' : 'var(--text-secondary)',
              fontWeight: role === 'EMPLOYER' ? '600' : '400',
              transition: 'var(--transition-fast)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px'
            }}
          >
            <ShieldCheck size={16} /> Employer (Admin)
          </button>
          <button
            type="button"
            onClick={() => {
              setRole('EMPLOYEE');
              setEmail('');
              setPassword('');
            }}
            style={{
              flex: 1, padding: '10px', borderRadius: '10px', border: 'none',
              background: role === 'EMPLOYEE' ? 'var(--accent-primary)' : 'transparent',
              color: role === 'EMPLOYEE' ? 'white' : 'var(--text-secondary)',
              fontWeight: role === 'EMPLOYEE' ? '600' : '400',
              transition: 'var(--transition-fast)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px'
            }}
          >
            <UserCheck size={16} /> Employee
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleFormSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px', color: 'var(--text-secondary)' }}>
              Work Email
            </label>
            <input
              type="email"
              className="input-field"
              placeholder="e.g. name@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px', color: 'var(--text-secondary)' }}>
              Password
            </label>
            <input
              type="password"
              className="input-field"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {error && (
            <div style={{ padding: '12px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.25)', borderRadius: 'var(--border-radius-md)', color: '#dc2626', fontSize: '0.88rem' }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading}
            style={{ width: '100%', marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            {loading ? 'Authenticating...' : `Sign in as ${role === 'EMPLOYER' ? 'Employer' : 'Employee'}`}
          </button>
        </form>

        <div style={{ marginTop: '1.5rem', textAlign: 'center', fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
          <Terminal size={14} /> Secure sign-in with an HTTP-only session
        </div>
      </div>
    </main>
  );
}
