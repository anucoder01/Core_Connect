/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface AuthGuardProps {
  children: React.ReactNode;
  allowedRoles?: string[];
}

export default function AuthGuard({ children, allowedRoles }: AuthGuardProps) {
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    const userStr = localStorage.getItem('currentUser');
    if (!userStr) {
      router.push('/');
      return;
    }

    try {
      const user = JSON.parse(userStr);
      if (allowedRoles && !allowedRoles.includes(user.role)) {
        // Redirect unauthorized users
        if (user.role === 'EMPLOYEE') {
          router.push('/dashboard/employee');
        } else {
          router.push('/');
        }
        return;
      }
      setAuthorized(true);
    } catch {
      router.push('/');
    }
  }, [allowedRoles, router]);

  if (!authorized) {
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', color: 'var(--text-secondary)' }}>Authenticating...</div>;
  }

  return <>{children}</>;
}
