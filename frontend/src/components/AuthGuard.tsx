"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, type User } from '../lib/api';

interface AuthGuardProps {
  children: React.ReactNode;
  allowedRoles?: string[];
}

export default function AuthGuard({ children, allowedRoles }: AuthGuardProps) {
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);
  const allowedRoleKey = allowedRoles?.join(',') || '';

  useEffect(() => {
    let active = true;
    api<{ user: User }>('/api/auth/me')
      .then(({ user }) => {
        if (!active) return;
        if (allowedRoleKey && !allowedRoleKey.split(',').includes(user.role)) {
          router.replace(user.role === 'EMPLOYER' ? '/dashboard/employer' : '/dashboard/employee');
          return;
        }
        setAuthorized(true);
      })
      .catch(() => router.replace('/'));
    return () => { active = false; };
  }, [allowedRoleKey, router]);

  if (!authorized) {
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', color: 'var(--text-secondary)' }}>Authenticating...</div>;
  }

  return <>{children}</>;
}
