"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [role, setRole] = useState('EMPLOYEE');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // In a real app, this would be a POST to /api/auth
      // For now, we will fetch users and match
      const res = await fetch('http://localhost:4000/api/users');
      const users = await res.json();
      
      const user = users.find((u: any) => u.email === email && u.role === role);
      
      if (user) {
        // Store session
        localStorage.setItem('currentUser', JSON.stringify(user));
        if (role === 'EMPLOYER') {
          router.push('/dashboard/employer');
        } else {
          router.push('/dashboard/employee');
        }
      } else {
        setError('Invalid credentials or role mismatch.');
      }
    } catch (err) {
      setError('Server error. Is the backend running?');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center p-6 animate-fade-in" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: '2rem' }}>
      <div className="glass-panel" style={{ width: '100%', maxWidth: '440px', padding: '2.5rem' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <h1 style={{ marginBottom: '0.5rem', background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            CoreConnect
          </h1>
          <p>Unified HR & CRM Platform</p>
        </div>

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* Role Toggle */}
          <div style={{ display: 'flex', background: 'rgba(15,23,42,0.6)', borderRadius: 'var(--border-radius-md)', padding: '4px' }}>
            <button 
              type="button"
              onClick={() => setRole('EMPLOYEE')}
              style={{
                flex: 1, padding: '10px', borderRadius: '10px', border: 'none',
                background: role === 'EMPLOYEE' ? 'var(--accent-primary)' : 'transparent',
                color: role === 'EMPLOYEE' ? 'white' : 'var(--text-secondary)',
                transition: 'var(--transition-fast)'
              }}
            >
              Employee
            </button>
            <button 
              type="button"
              onClick={() => setRole('EMPLOYER')}
              style={{
                flex: 1, padding: '10px', borderRadius: '10px', border: 'none',
                background: role === 'EMPLOYER' ? 'var(--accent-primary)' : 'transparent',
                color: role === 'EMPLOYER' ? 'white' : 'var(--text-secondary)',
                transition: 'var(--transition-fast)'
              }}
            >
              Employer
            </button>
          </div>

          <input 
            type="email" 
            className="input-field" 
            placeholder="Email address" 
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          
          <input 
            type="password" 
            className="input-field" 
            placeholder="Password" 
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          {error && (
            <div style={{ color: 'var(--accent-danger)', fontSize: '0.9rem', textAlign: 'center' }}>
              {error}
            </div>
          )}

          <button type="submit" className="btn btn-primary" disabled={loading} style={{ marginTop: '0.5rem' }}>
            {loading ? 'Authenticating...' : 'Sign In'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
          <p>Demo Admin: admin@company.com / adminpass</p>
          <p>Demo Emp: john@company.com / pass123</p>
        </div>
      </div>
    </main>
  );
}
