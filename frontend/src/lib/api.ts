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
  skills?: string | null;
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
  user: { id: string; name: string; department?: string | null } | null;
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
  entity: string;
  entityId: string | null;
  summary: string;
  createdAt: string;
  actor: { id: string; name: string; role: string } | null;
}

export interface AuditPage {
  items: AuditEntry[];
  nextCursor: string | null;
}

export interface NotificationItem {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: 'ALERT' | 'LEAD' | 'LEAVE' | 'BURNOUT' | 'SYSTEM' | 'TASK' | 'INFO';
  read: boolean;
  link: string | null;
  createdAt: string;
}

export interface ClientFeedbackItem {
  id: string;
  leadId: string | null;
  clientName: string;
  company: string;
  score: number;
  npsCategory: 'PROMOTER' | 'PASSIVE' | 'DETRACTOR';
  category: string;
  feedback: string | null;
  createdAt: string;
  lead?: { id: string; name: string; company: string; assignee?: { id: string; name: string } | null } | null;
}

export interface TimeEntryItem {
  id: string;
  userId: string;
  leadId: string | null;
  hours: number;
  date: string;
  description: string | null;
  billable: boolean;
  createdAt: string;
  user?: { id: string; name: string; department?: string | null };
  lead?: { id: string; name: string; company: string } | null;
}

export interface MatchCandidate {
  user: {
    id: string;
    name: string;
    email: string;
    department: string | null;
    position: string | null;
    skills: string | null;
  };
  matchScore: number;
  fitCategory: 'OPTIMAL' | 'STRONG' | 'MODERATE' | 'AT_CAPACITY';
  activeDealsCount: number;
  openTasksCount: number;
  reasons: string[];
  risks: string[];
}

export interface MatchmakerResponse {
  lead: Lead;
  candidates: MatchCandidate[];
}

export interface AppraisalDossier {
  user: User;
  metrics: {
    wonDealsCount: number;
    wonRevenue: number;
    activeDealsCount: number;
    activePipelineValue: number;
    totalTasks: number;
    completedTasks: number;
    taskCompletionRate: number;
    avgClientCSAT: number;
    avgPulseScore: number;
    billableHours: number;
  };
  rating: 'EXCEEDS_EXPECTATIONS' | 'STRONG_PERFORMER' | 'ON_TRACK' | 'NEEDS_SUPPORT';
  achievements: string[];
  feedbacks: ClientFeedbackItem[];
}

export interface UtilizationData {
  totalHours: number;
  billableHours: number;
  nonBillableHours: number;
  utilizationRate: number;
  projectBurn: Array<{
    id: string;
    name: string;
    company: string;
    value: number;
    totalHours: number;
    billableHours: number;
    costIncurred: number;
    burnPercent: number;
  }>;
}

export interface CSATAnalytics {
  npsScore: number;
  avgCSAT: number;
  totalReviews: number;
  promoters: number;
  detractors: number;
  categoryStats: Array<{
    category: string;
    avgScore: number;
    count: number;
  }>;
  recentFeedbacks: ClientFeedbackItem[];
}
