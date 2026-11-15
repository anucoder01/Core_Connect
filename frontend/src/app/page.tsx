"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldCheck, UserCheck, Sparkles, Building2, Terminal } from 'lucide-react';
import { api, type User } from '../lib/api';
import ThemeToggle from '../components/ThemeToggle';

interface DemoPersona {
  name: string;
  role: 'EMPLOYER' | 'EMPLOYEE';
  email: string;
  pass: string;
  title: string;
  badge: string;
}

const DEMO_PERSONAS: DemoPersona[] = [
  {
    name: 'Admin Boss',
    role: 'EMPLOYER',
    email: 'admin@company.com',
    pass: 'adminpass',
    title: 'VP Operations & Talent',
    badge: 'Executive / HR Admin'
  },
  {
    name: 'John Doe',
    role: 'EMPLOYEE',
    email: 'john@company.com',
    pass: 'pass123',
    title: 'Senior Systems Architect',
    badge: 'Active Deals & Leave Collision'
  },
  {
    name: 'Sarah Connor',
    role: 'EMPLOYEE',
    email: 'sarah@company.com',
    pass: 'pass123',
    title: 'Solutions Architect',
    badge: 'Peer Coverage Lead'
  },
  {
    name: 'Alex Rivera',
    role: 'EMPLOYEE',
    email: 'alex@company.com',
    pass: 'pass123',
    title: 'Enterprise Client Director',
    badge: 'Sales Lead'
  }
];

export default function LoginPage() {
  const router = useRouter();
  const [role, setRole] = useState<'EMPLOYEE' | 'EMPLOYER'>('EMPLOYER');
  const [email, setEmail] = useState('admin@company.com');
  const [password, setPassword] = useState('adminpass');
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

  const handleQuickDemo = (persona: DemoPersona) => {
    setRole(persona.role);
    setEmail(persona.email);
    setPassword(persona.pass);
    performLogin(persona.email, persona.pass, persona.role);
  };

  return (
    <main style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem', position: 'relative' }}>
      {/* Top right theme toggle */}
      <div style={{ position: 'fixed', top: '1.5rem', right: '1.5rem', zIndex: 10 }}>
        <ThemeToggle />
      </div>

      <div className="glass-panel animate-fade-in" style={{ width: '100%', maxWidth: '520px', padding: '2.5rem', position: 'relative' }}>

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

        {/* 1-Click Persona Quick Access */}
        <div style={{ marginBottom: '1.75rem', padding: '1rem', background: 'rgba(0,0,0,0.02)', borderRadius: 'var(--border-radius-md)', border: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Sparkles size={14} color="var(--accent-primary)" /> Quick Demo Switcher
            </span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>1-Click Instant Login</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
            {DEMO_PERSONAS.map((p) => (
              <button
                key={p.email}
                type="button"
                onClick={() => handleQuickDemo(p)}
                disabled={loading}
                style={{
                  textAlign: 'left',
                  padding: '8px 10px',
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '2px',
                  transition: 'var(--transition-fast)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                  <span style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-primary)' }}>{p.name}</span>
                  <span style={{ fontSize: '0.65rem', padding: '2px 6px', borderRadius: '4px', background: p.role === 'EMPLOYER' ? 'rgba(79, 70, 229, 0.1)' : 'rgba(6, 182, 212, 0.1)', color: p.role === 'EMPLOYER' ? 'var(--accent-primary)' : 'var(--accent-secondary)', fontWeight: 600 }}>
                    {p.role}
                  </span>
                </div>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>{p.title}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Role Toggle */}
        <div style={{ display: 'flex', background: 'var(--role-toggle-bg, rgba(0,0,0,0.05))', borderRadius: 'var(--border-radius-md)', padding: '4px', marginBottom: '1.5rem' }}>
          <button
            type="button"
            onClick={() => {
              setRole('EMPLOYER');
              setEmail('admin@company.com');
              setPassword('adminpass');
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
              setEmail('john@company.com');
              setPassword('pass123');
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
          <Terminal size={14} /> Backend active on port 4000
        </div>
      </div>
    </main>
  );
}
