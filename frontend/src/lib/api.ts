export const API_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000').replace(/\/$/, '');

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { error?: string } | null;
    throw new Error(payload?.error || `Request failed (${response.status}).`);
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'EMPLOYER' | 'EMPLOYEE';
  department: string | null;
  position: string | null;
}

export interface Leave {
  id: string;
  type: string;
  fromDate: string;
  toDate: string;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  riskScore: 'LOW' | 'MEDIUM' | 'HIGH';
  riskNotes: string | null;
  coverageUserId: string | null;
  coverageName: string | null;
  userId: string;
  user: { id: string; name: string };
}

export interface Lead {
  id: string;
  name: string;
  company: string;
  email: string;
  status: 'NEW' | 'CONTACTED' | 'QUALIFIED' | 'PROPOSAL' | 'WON' | 'LOST';
  value: number | null;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  expectedCloseDate: string | null;
  notes: string | null;
  assigneeId: string | null;
  assignee: { id: string; name: string } | null;
}

export interface PulseCheck {
  id: string;
  score: number;
  feedback: string | null;
  workloadRisk: 'LIGHT' | 'MANAGEABLE' | 'HIGH' | 'BURNOUT';
  type: string;
  createdAt: string;
  user: { id: string; name: string } | null;
}

export interface Task {
  id: string;
  title: string;
  description: string | null;
  clientName: string | null;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  status: 'TODO' | 'IN_PROGRESS' | 'DONE';
  dueDate: string | null;
  assigneeId: string;
  assignee: { id: string; name: string };
}

export interface AuditEntry {
  id: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE';
  entity: 'LEAVE' | 'LEAD' | 'PULSE' | 'TASK';
  entityId: string | null;
  summary: string;
  createdAt: string;
  actor: { id: string; name: string; role: string } | null;
}

export interface AuditPage {
  items: AuditEntry[];
  nextCursor: string | null;
}
