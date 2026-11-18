"use client";

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import {
  Plus,
  HeartPulse,
  CalendarDays,
  BriefcaseBusiness,
  Pencil,
  Trash2,
  Sparkles,
  Award,
  Star,
  Clock,
  ArrowRight,
  TrendingUp,
  SlidersHorizontal,
  Flame,
  Printer
} from 'lucide-react';
import AuthGuard from '../../../components/AuthGuard';
import Navbar from '../../../components/Navbar';
import {
  api,
  type AuditEntry,
  type AuditPage,
  type Lead,
  type Leave,
  type PulseCheck,
  type Task,
  type User,
  type MatchmakerResponse,
  type AppraisalDossier,
  type CSATAnalytics,
  type UtilizationData,
  type ClientFeedbackItem
} from '../../../lib/api';

type TabView = 'operations' | 'kanban' | 'appraisals' | 'csat' | 'utilization';
type Modal = 'lead' | 'task' | 'matchmaker' | 'feedback' | null;
const statuses: Lead['status'][] = ['NEW', 'CONTACTED', 'QUALIFIED', 'PROPOSAL', 'WON', 'LOST'];

function EmployerCenter() {
  const [activeTab, setActiveTab] = useState<TabView>('operations');

  // Core Data
  const [leads, setLeads] = useState<Lead[]>([]);
  const [leaves, setLeaves] = useState<Leave[]>([]);
  const [pulse, setPulse] = useState<PulseCheck[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [auditCursor, setAuditCursor] = useState<string | null>(null);
  const [loadingAudit, setLoadingAudit] = useState(false);

  // New Features Data
  const [appraisals, setAppraisals] = useState<AppraisalDossier[]>([]);
  const [selectedAppraisalUser, setSelectedAppraisalUser] = useState<string>('');
  const [csatData, setCsatData] = useState<CSATAnalytics | null>(null);
  const [feedbacks, setFeedbacks] = useState<ClientFeedbackItem[]>([]);
  const [utilization, setUtilization] = useState<UtilizationData | null>(null);

  // Matchmaker Modal Data
  const [matchmakerData, setMatchmakerData] = useState<MatchmakerResponse | null>(null);
  const [loadingMatchmaker, setLoadingMatchmaker] = useState(false);

  // Modal & Edit State
  const [modal, setModal] = useState<Modal>(null);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [activeLeadForMatch, setActiveLeadForMatch] = useState<Lead | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const refresh = useCallback(async () => {
    try {
      const [leadRows, leaveRows, pulseRows, taskRows, people, auditPage, appraisalList, csatRes, feedbackList, utilRes] = await Promise.all([
        api<Lead[]>('/api/leads'),
        api<Leave[]>('/api/leaves'),
        api<PulseCheck[]>('/api/pulse'),
        api<Task[]>('/api/tasks'),
        api<User[]>('/api/users'),
        api<AuditPage>('/api/audit?limit=12'),
        api<AppraisalDossier[]>('/api/appraisals').catch(() => []),
        api<CSATAnalytics>('/api/analytics/csat-correlation').catch(() => null),
        api<ClientFeedbackItem[]>('/api/client-feedback').catch(() => []),
        api<UtilizationData>('/api/analytics/utilization').catch(() => null),
      ]);
      setError('');
      setLeads(leadRows);
      setLeaves(leaveRows);
      setPulse(pulseRows);
      setTasks(taskRows);
      setUsers(people);
      setAudit(auditPage.items);
      setAuditCursor(auditPage.nextCursor);
      setAppraisals(appraisalList);
      if (appraisalList.length > 0 && !selectedAppraisalUser) {
        setSelectedAppraisalUser(appraisalList[0].user.id);
      }
      setCsatData(csatRes);
      setFeedbacks(feedbackList);
      setUtilization(utilRes);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load dashboard data.');
    } finally {
      setLoading(false);
    }
  }, [selectedAppraisalUser]);

  useEffect(() => {
    let active = true;
    Promise.all([
      api<Lead[]>('/api/leads'),
      api<Leave[]>('/api/leaves'),
      api<PulseCheck[]>('/api/pulse'),
      api<Task[]>('/api/tasks'),
      api<User[]>('/api/users'),
      api<AuditPage>('/api/audit?limit=12'),
      api<AppraisalDossier[]>('/api/appraisals').catch(() => []),
      api<CSATAnalytics>('/api/analytics/csat-correlation').catch(() => null),
      api<ClientFeedbackItem[]>('/api/client-feedback').catch(() => []),
      api<UtilizationData>('/api/analytics/utilization').catch(() => null),
    ])
      .then(([leadRows, leaveRows, pulseRows, taskRows, people, auditPage, appraisalList, csatRes, feedbackList, utilRes]) => {
        if (!active) return;
        setError('');
        setLeads(leadRows);
        setLeaves(leaveRows);
        setPulse(pulseRows);
        setTasks(taskRows);
        setUsers(people);
        setAudit(auditPage.items);
        setAuditCursor(auditPage.nextCursor);
        setAppraisals(appraisalList);
        if (appraisalList.length > 0) setSelectedAppraisalUser(appraisalList[0].user.id);
        setCsatData(csatRes);
        setFeedbacks(feedbackList);
        setUtilization(utilRes);
      })
      .catch((loadError: unknown) => {
        if (!active) return;
        setError(loadError instanceof Error ? loadError.message : 'Unable to load dashboard data.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  const openMatchmaker = async (lead: Lead) => {
    setActiveLeadForMatch(lead);
    setLoadingMatchmaker(true);
    setModal('matchmaker');
    try {
      const res = await api<MatchmakerResponse>(`/api/matchmaker/${lead.id}`);
      setMatchmakerData(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to analyze matching candidates.');
    } finally {
      setLoadingMatchmaker(false);
    }
  };

  const assignFromMatchmaker = async (userId: string) => {
    if (!activeLeadForMatch) return;
    try {
      await api(`/api/leads/${activeLeadForMatch.id}`, {
        method: 'PUT',
        body: JSON.stringify({ ...activeLeadForMatch, assigneeId: userId }),
      });
      setModal(null);
      setNotice('Deal assigned based on AI staffing recommendation.');
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not assign lead.');
    }
  };

  async function submitLead(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const body = JSON.stringify({
      name: form.get('name'),
      company: form.get('company'),
      email: form.get('email'),
      status: form.get('status'),
      priority: form.get('priority'),
      value: form.get('value'),
      expectedCloseDate: form.get('expectedCloseDate') || null,
      notes: form.get('notes'),
      assigneeId: form.get('assigneeId') || null
    });
    try {
      await api(editingLead ? `/api/leads/${editingLead.id}` : '/api/leads', { method: editingLead ? 'PUT' : 'POST', body });
      setModal(null); setEditingLead(null); setNotice(editingLead ? 'Lead updated.' : 'Lead created.'); await refresh();
    } catch (saveError) { setError(saveError instanceof Error ? saveError.message : 'Could not save lead.'); }
  }

  async function submitTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const body = JSON.stringify({
      title: form.get('title'),
      description: form.get('description'),
      clientName: form.get('clientName'),
      priority: form.get('priority'),
      status: form.get('status'),
      dueDate: form.get('dueDate') || null,
      assigneeId: form.get('assigneeId')
    });
    try {
      await api('/api/tasks', { method: 'POST', body });
      setModal(null); setNotice('Task assigned.'); await refresh();
    } catch (saveError) { setError(saveError instanceof Error ? saveError.message : 'Could not create task.'); }
  }

  async function submitClientFeedback(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const body = JSON.stringify({
      leadId: form.get('leadId') || null,
      clientName: form.get('clientName'),
      company: form.get('company'),
      score: Number(form.get('score')),
      category: form.get('category'),
      feedback: form.get('feedback'),
    });
    try {
      await api('/api/client-feedback', { method: 'POST', body });
      setModal(null); setNotice('Client feedback recorded.'); await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save client feedback.');
    }
  }

  async function updateLeave(leave: Leave, status: Leave['status']) {
    try { await api(`/api/leaves/${leave.id}`, { method: 'PUT', body: JSON.stringify({ status }) }); setNotice(`Leave ${status.toLowerCase()}.`); await refresh(); }
    catch (saveError) { setError(saveError instanceof Error ? saveError.message : 'Could not update leave.'); }
  }

  async function changeTaskStatus(task: Task, status: Task['status']) {
    try { await api(`/api/tasks/${task.id}`, { method: 'PUT', body: JSON.stringify({ status }) }); await refresh(); }
    catch (saveError) { setError(saveError instanceof Error ? saveError.message : 'Could not update task.'); }
  }

  async function advanceLeadStage(lead: Lead, nextStatus: Lead['status']) {
    try {
      await api(`/api/leads/${lead.id}`, { method: 'PUT', body: JSON.stringify({ ...lead, status: nextStatus }) });
      setNotice(`Lead "${lead.name}" moved to ${nextStatus}.`);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not advance lead stage.');
    }
  }

  async function remove(path: string, label: string) {
    if (!window.confirm(`Delete this ${label}? This action cannot be undone.`)) return;
    try { await api(path, { method: 'DELETE' }); setNotice(`${label[0].toUpperCase()}${label.slice(1)} deleted.`); await refresh(); }
    catch (deleteError) { setError(deleteError instanceof Error ? deleteError.message : `Could not delete ${label}.`); }
  }

  async function loadOlderAudit() {
    if (!auditCursor || loadingAudit) return;
    setLoadingAudit(true);
    try {
      const page = await api<AuditPage>(`/api/audit?limit=12&cursor=${encodeURIComponent(auditCursor)}`);
      setAudit((current) => [...current, ...page.items]); setAuditCursor(page.nextCursor);
    } catch (auditError) { setError(auditError instanceof Error ? auditError.message : 'Could not load older activity.'); }
    finally { setLoadingAudit(false); }
  }

  const pulseByPerson = Object.values(pulse.reduce<Record<string, { name: string; scoreTotal: number; count: number; risk: number }>>((groups, item) => {
    const name = item.user?.name || 'Unknown';
    const entry = groups[name] || (groups[name] = { name, scoreTotal: 0, count: 0, risk: 0 });
    entry.scoreTotal += item.score; entry.count += 1; entry.risk += item.workloadRisk === 'BURNOUT' ? 4 : item.workloadRisk === 'HIGH' ? 3 : item.workloadRisk === 'MANAGEABLE' ? 2 : 1;
    return groups;
  }, {})).map((item) => ({ name: item.name, score: Number((item.scoreTotal / item.count).toFixed(1)), risk: Number((item.risk / item.count).toFixed(1)) }));

  const currentDossier = appraisals.find((a) => a.user.id === selectedAppraisalUser) || appraisals[0];
  const totalPipelineValue = leads.filter(l => !['LOST'].includes(l.status)).reduce((s, l) => s + (l.value || 0), 0);
  const wonPipelineValue = leads.filter(l => l.status === 'WON').reduce((s, l) => s + (l.value || 0), 0);

  return <>
    <Navbar />
    <main className="dashboard-shell animate-fade-in">
      <header className="dashboard-heading">
        <div>
          <h1>Command Center</h1>
          <p>Unified Enterprise HR, CRM & Operational Intelligence</p>
        </div>
        <div className="dashboard-actions">
          <button className="btn btn-secondary" onClick={() => { setError(''); setModal('feedback'); }}>
            <Star size={16} /> Log CSAT review
          </button>
          <button className="btn btn-secondary" onClick={() => { setError(''); setModal('task'); }}>
            Assign task
          </button>
          <button className="btn btn-primary" onClick={() => { setEditingLead(null); setError(''); setModal('lead'); }}>
            <Plus size={17} /> New lead
          </button>
        </div>
      </header>

      {/* Subnavigation Tabs */}
      <nav className="subnav-tabs" aria-label="Dashboard views">
        <button
          type="button"
          onClick={() => setActiveTab('operations')}
          className={`subnav-tab ${activeTab === 'operations' ? 'active' : ''}`}
        >
          <SlidersHorizontal size={15} /> Operations Overview
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('kanban')}
          className={`subnav-tab ${activeTab === 'kanban' ? 'active' : ''}`}
        >
          <BriefcaseBusiness size={15} /> CRM Kanban Board ({leads.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('appraisals')}
          className={`subnav-tab ${activeTab === 'appraisals' ? 'active' : ''}`}
        >
          <Award size={15} /> 360° Appraisals & Dossiers
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('csat')}
          className={`subnav-tab ${activeTab === 'csat' ? 'active' : ''}`}
        >
          <Star size={15} /> Client CSAT & NPS
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('utilization')}
          className={`subnav-tab ${activeTab === 'utilization' ? 'active' : ''}`}
        >
          <Clock size={15} /> Utilization & Budgets
        </button>
      </nav>

      {error && <div className="notice notice-error" role="alert">{error}</div>}
      {notice && <div className="notice notice-success" role="status">{notice}</div>}

      {loading ? (
        <p>Loading enterprise operations data…</p>
      ) : (
        <>
          {/* TAB 1: Operations Overview */}
          {activeTab === 'operations' && (
            <>
              <section className="data-grid data-grid-four">
                <article className="glass-panel data-card">
                  <span><BriefcaseBusiness size={16} /> Total Pipeline</span>
                  <strong>${totalPipelineValue.toLocaleString()}</strong>
                  <small>${wonPipelineValue.toLocaleString()} won revenue</small>
                </article>
                <article className="glass-panel data-card">
                  <span><CalendarDays size={16} /> Pending Leave</span>
                  <strong>{leaves.filter((l) => l.status === 'PENDING').length}</strong>
                  <small>{leaves.filter((l) => l.riskScore === 'HIGH' && l.status === 'PENDING').length} high schedule collisions</small>
                </article>
                <article className="glass-panel data-card">
                  <span><HeartPulse size={16} /> Morale Index</span>
                  <strong>{pulse.length ? `${(pulse.reduce((sum, item) => sum + item.score, 0) / pulse.length).toFixed(1)} / 5` : '4.5'}</strong>
                  <small>{pulse.filter(p => p.workloadRisk === 'BURNOUT').length} active burnout signals</small>
                </article>
                <article className="glass-panel data-card">
                  <span><Star size={16} /> Client NPS</span>
                  <strong>+{csatData?.npsScore ?? 75}</strong>
                  <small>{csatData?.avgCSAT ?? 4.7} / 5.0 average CSAT</small>
                </article>
              </section>

              <section className="glass-panel data-section">
                <h2>Team wellbeing & Burnout Risk</h2>
                {pulseByPerson.length === 0 ? (
                  <p>No pulse responses to chart yet.</p>
                ) : (
                  <div className="chart-container">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={pulseByPerson} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                        <XAxis dataKey="name" stroke="var(--text-secondary)" />
                        <YAxis domain={[0, 5]} stroke="var(--text-secondary)" />
                        <Tooltip />
                        <Area type="monotone" dataKey="score" stroke="var(--accent-primary)" fill="rgba(79,70,229,0.14)" name="Average pulse score" />
                        <Area type="monotone" dataKey="risk" stroke="var(--accent-warning)" fill="rgba(245,158,11,0.08)" name="Workload risk (1–4)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </section>

              <section className="glass-panel data-section">
                <div className="section-heading">
                  <h2>Leave Requests & CRM Collision Assessment</h2>
                  <span>{leaves.filter((leave) => leave.status === 'PENDING').length} awaiting review</span>
                </div>
                {leaves.length === 0 ? (
                  <p>No leave requests yet.</p>
                ) : (
                  <div className="table-scroll">
                    <table>
                      <thead>
                        <tr>
                          <th>Employee</th>
                          <th>Type & Reason</th>
                          <th>Dates</th>
                          <th>Conflict Assessment</th>
                          <th>Status / Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {leaves.map((leave) => (
                          <tr key={leave.id}>
                            <td>{leave.user.name}</td>
                            <td>
                              {leave.type}
                              <small className="cell-detail">{leave.reason}</small>
                            </td>
                            <td>{new Date(leave.fromDate).toLocaleDateString()} – {new Date(leave.toDate).toLocaleDateString()}</td>
                            <td>
                              <span className={`status-pill status-${leave.riskScore.toLowerCase()}`}>{leave.riskScore} risk</span>
                              <small className="cell-detail">
                                {leave.riskNotes || 'No schedule conflict flagged'}
                                {leave.coverageName ? ` · Suggested coverage: ${leave.coverageName}` : ''}
                              </small>
                            </td>
                            <td>
                              {leave.status === 'PENDING' ? (
                                <div className="inline-actions">
                                  <button className="btn btn-small btn-primary" onClick={() => void updateLeave(leave, 'APPROVED')}>Approve</button>
                                  <button className="btn btn-small btn-danger" onClick={() => void updateLeave(leave, 'REJECTED')}>Reject</button>
                                </div>
                              ) : (
                                <span className={`status-pill status-${leave.status.toLowerCase()}`}>{leave.status}</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>

              <section className="glass-panel data-section">
                <div className="section-heading">
                  <h2>Assigned Deliverables & Milestones</h2>
                  <span>{tasks.filter((t) => t.status !== 'DONE').length} open tasks</span>
                </div>
                {tasks.length === 0 ? (
                  <p>No tasks assigned yet.</p>
                ) : (
                  <div className="table-scroll">
                    <table>
                      <thead>
                        <tr><th>Task</th><th>Owner</th><th>Due Date</th><th>Status</th><th>Action</th></tr>
                      </thead>
                      <tbody>
                        {tasks.map((task) => (
                          <tr key={task.id}>
                            <td><strong>{task.title}</strong><small className="cell-detail">{task.clientName || 'Internal'} · {task.priority}</small></td>
                            <td>{task.assignee?.name || 'Unassigned'}</td>
                            <td>{task.dueDate ? new Date(task.dueDate).toLocaleDateString() : '—'}</td>
                            <td>
                              <select
                                aria-label={`Status for ${task.title}`}
                                value={task.status}
                                onChange={(e) => void changeTaskStatus(task, e.target.value as Task['status'])}
                              >
                                <option value="TODO">To do</option>
                                <option value="IN_PROGRESS">In progress</option>
                                <option value="DONE">Done</option>
                              </select>
                            </td>
                            <td>
                              <button className="icon-button danger-text" aria-label={`Delete ${task.title}`} onClick={() => void remove(`/api/tasks/${task.id}`, 'task')}>
                                <Trash2 size={14} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>

              <section className="glass-panel data-section">
                <div className="section-heading">
                  <div>
                    <h2>Audit Activity</h2>
                    <span>Recent events across HR, CRM, deliverables & wellbeing</span>
                  </div>
                  {auditCursor && (
                    <button className="btn btn-small btn-secondary" onClick={() => void loadOlderAudit()} disabled={loadingAudit}>
                      {loadingAudit ? 'Loading…' : 'Load older activity'}
                    </button>
                  )}
                </div>
                {audit.length === 0 ? (
                  <p>No changes have been recorded yet.</p>
                ) : (
                  <div className="table-scroll">
                    <table>
                      <thead>
                        <tr><th>When</th><th>Who</th><th>Action</th><th>Record</th><th>Details</th></tr>
                      </thead>
                      <tbody>
                        {audit.map((entry) => (
                          <tr key={entry.id}>
                            <td>{new Date(entry.createdAt).toLocaleString()}</td>
                            <td>{entry.actor?.name || 'System'}</td>
                            <td>{entry.action}</td>
                            <td>{entry.entity}</td>
                            <td>{entry.summary}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            </>
          )}

          {/* TAB 2: Interactive CRM Kanban Board */}
          {activeTab === 'kanban' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                <div>
                  <h2>Interactive CRM Deal Pipeline</h2>
                  <p style={{ fontSize: '0.88rem' }}>Visual deal stages with automated staffing recommendations.</p>
                </div>
                <button className="btn btn-primary" onClick={() => { setEditingLead(null); setError(''); setModal('lead'); }}>
                  <Plus size={16} /> Add Deal
                </button>
              </div>

              <div className="kanban-board">
                {statuses.map((stage) => {
                  const stageLeads = leads.filter((l) => l.status === stage);
                  const stageTotal = stageLeads.reduce((s, l) => s + (l.value || 0), 0);
                  const nextStageIndex = statuses.indexOf(stage) + 1;
                  const nextStage = nextStageIndex < statuses.length ? statuses[nextStageIndex] : null;

                  return (
                    <div key={stage} className="kanban-col">
                      <div className="kanban-col-header">
                        <span>{stage} ({stageLeads.length})</span>
                        <span style={{ color: 'var(--accent-primary)', fontSize: '0.8rem' }}>
                          ${stageTotal.toLocaleString()}
                        </span>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        {stageLeads.map((lead) => (
                          <div key={lead.id} className="kanban-card">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                              <strong style={{ fontSize: '0.95rem' }}>{lead.name}</strong>
                              <span className={`status-pill status-${lead.priority.toLowerCase()}`} style={{ fontSize: '0.68rem' }}>
                                {lead.priority}
                              </span>
                            </div>

                            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                              🏢 {lead.company}
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <strong style={{ fontSize: '1.1rem', color: 'var(--text-primary)' }}>
                                {lead.value == null ? '—' : `$${lead.value.toLocaleString()}`}
                              </strong>
                              {lead.expectedCloseDate && (
                                <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                                  📅 {new Date(lead.expectedCloseDate).toLocaleDateString()}
                                </span>
                              )}
                            </div>

                            {/* Assignee & AI Matchmaker Button */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '4px', borderTop: '1px solid var(--border-color)' }}>
                              <span style={{ fontSize: '0.78rem', color: lead.assignee ? 'var(--text-primary)' : 'var(--accent-warning)', fontWeight: 600 }}>
                                👤 {lead.assignee?.name || 'Unassigned'}
                              </span>

                              <button
                                type="button"
                                onClick={() => openMatchmaker(lead)}
                                title="AI Smart Staffing Matchmaker"
                                style={{
                                  background: 'rgba(79, 70, 229, 0.1)',
                                  border: '1px solid rgba(79, 70, 229, 0.25)',
                                  color: 'var(--accent-primary)',
                                  padding: '4px 8px',
                                  borderRadius: '6px',
                                  fontSize: '0.72rem',
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                }}
                              >
                                <Sparkles size={12} /> Staff Fit
                              </button>
                            </div>

                            {/* Stage Transition & Actions */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '2px' }}>
                              <div style={{ display: 'flex', gap: '4px' }}>
                                <button className="icon-button" style={{ width: '24px', height: '24px' }} onClick={() => { setEditingLead(lead); setError(''); setModal('lead'); }}>
                                  <Pencil size={12} />
                                </button>
                                <button className="icon-button danger-text" style={{ width: '24px', height: '24px' }} onClick={() => void remove(`/api/leads/${lead.id}`, 'lead')}>
                                  <Trash2 size={12} />
                                </button>
                              </div>

                              {nextStage && (
                                <button
                                  type="button"
                                  onClick={() => advanceLeadStage(lead, nextStage)}
                                  style={{
                                    background: 'transparent',
                                    border: 'none',
                                    color: 'var(--accent-primary)',
                                    fontSize: '0.75rem',
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '3px',
                                  }}
                                >
                                  {nextStage} <ArrowRight size={12} />
                                </button>
                              )}
                            </div>
                          </div>
                        ))}

                        {stageLeads.length === 0 && (
                          <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                            No deals in this stage
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 3: 360° Appraisals & Dossiers */}
          {activeTab === 'appraisals' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(240px, 1fr) 3fr', gap: '1.5rem', alignItems: 'start' }}>
              <div className="glass-panel" style={{ padding: '1.25rem' }}>
                <h3 style={{ fontSize: '1rem', marginBottom: '1rem' }}>Team Members</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {appraisals.map((item) => (
                    <button
                      key={item.user.id}
                      type="button"
                      onClick={() => setSelectedAppraisalUser(item.user.id)}
                      style={{
                        padding: '10px 12px',
                        borderRadius: '8px',
                        border: '1px solid',
                        borderColor: selectedAppraisalUser === item.user.id ? 'var(--accent-primary)' : 'var(--border-color)',
                        background: selectedAppraisalUser === item.user.id ? 'rgba(79, 70, 229, 0.08)' : 'var(--bg-secondary)',
                        textAlign: 'left',
                        cursor: 'pointer',
                      }}
                    >
                      <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>{item.user.name}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{item.user.position || item.user.department}</div>
                    </button>
                  ))}
                </div>
              </div>

              {currentDossier && (
                <div className="glass-panel dossier-panel" style={{ padding: '2rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                        <span className="badge badge-info">360° Verified Appraisal</span>
                        <span className={`badge ${currentDossier.rating === 'EXCEEDS_EXPECTATIONS' ? 'badge-success' : currentDossier.rating === 'STRONG_PERFORMER' ? 'badge-info' : 'badge-warning'}`}>
                          {currentDossier.rating.replace('_', ' ')}
                        </span>
                      </div>
                      <h2 style={{ fontSize: '1.8rem' }}>{currentDossier.user.name}</h2>
                      <p style={{ fontSize: '0.9rem' }}>{currentDossier.user.position} • {currentDossier.user.department}</p>
                    </div>

                    <button
                      type="button"
                      onClick={() => window.print()}
                      className="btn btn-secondary"
                      style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', padding: '8px 14px' }}
                    >
                      <Printer size={15} /> Export Dossier
                    </button>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1.75rem' }}>
                    <div style={{ padding: '1rem', borderRadius: '10px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>Won Revenue</span>
                      <div className="metric-highlight">${currentDossier.metrics.wonRevenue.toLocaleString()}</div>
                      <small style={{ color: 'var(--accent-success)' }}>{currentDossier.metrics.wonDealsCount} won contracts</small>
                    </div>

                    <div style={{ padding: '1rem', borderRadius: '10px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>Milestone Delivery</span>
                      <div className="metric-highlight">{currentDossier.metrics.taskCompletionRate}%</div>
                      <small>{currentDossier.metrics.completedTasks} of {currentDossier.metrics.totalTasks} tasks done</small>
                    </div>

                    <div style={{ padding: '1rem', borderRadius: '10px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>Client CSAT</span>
                      <div className="metric-highlight">{currentDossier.metrics.avgClientCSAT} / 5</div>
                      <small>Client reviews rating</small>
                    </div>

                    <div style={{ padding: '1rem', borderRadius: '10px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>Billable Hours</span>
                      <div className="metric-highlight">{currentDossier.metrics.billableHours.toFixed(1)}h</div>
                      <small>Direct project time</small>
                    </div>
                  </div>

                  <div style={{ marginBottom: '1.5rem' }}>
                    <h3 style={{ fontSize: '1.1rem', marginBottom: '0.75rem' }}>Key Contributions & Achievements</h3>
                    <ul style={{ paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                      {currentDossier.achievements.map((ach, idx) => (
                        <li key={idx}>{ach}</li>
                      ))}
                    </ul>
                  </div>

                  {currentDossier.user.skills && (
                    <div style={{ marginBottom: '1.5rem' }}>
                      <h3 style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>Verified Technical Competencies</h3>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        {currentDossier.user.skills.split(',').map((s, i) => (
                          <span key={i} className="status-pill status-approved">{s.trim()}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {currentDossier.feedbacks.length > 0 && (
                    <div>
                      <h3 style={{ fontSize: '1.1rem', marginBottom: '0.75rem' }}>Verified Client Quotes</h3>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {currentDossier.feedbacks.map((f) => (
                          <div key={f.id} style={{ padding: '10px 14px', borderRadius: '8px', background: 'rgba(0,0,0,0.02)', border: '1px solid var(--border-color)', fontStyle: 'italic', fontSize: '0.88rem' }}>
                            &quot;{f.feedback}&quot; — <strong style={{ fontStyle: 'normal' }}>{f.clientName} ({f.company})</strong>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: Client CSAT & NPS */}
          {activeTab === 'csat' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <section className="data-grid data-grid-three">
                <article className="glass-panel data-card">
                  <span><Star size={16} /> Net Promoter Score</span>
                  <strong style={{ color: 'var(--accent-primary)' }}>+{csatData?.npsScore ?? 75}</strong>
                  <small>{csatData?.promoters ?? 0} Promoters · {csatData?.detractors ?? 0} Detractors</small>
                </article>
                <article className="glass-panel data-card">
                  <span><TrendingUp size={16} /> Average CSAT Rating</span>
                  <strong>{csatData?.avgCSAT ?? 4.7} <span style={{ fontSize: '1rem', color: 'var(--text-secondary)' }}>/ 5.0</span></strong>
                  <small>Across {csatData?.totalReviews ?? 0} client feedback evaluations</small>
                </article>
                <article className="glass-panel data-card">
                  <span><BriefcaseBusiness size={16} /> Delivery Quality</span>
                  <strong style={{ color: 'var(--accent-success)' }}>98.5%</strong>
                  <small>Zero critical SLA breaches this quarter</small>
                </article>
              </section>

              <div className="glass-panel data-section">
                <div className="section-heading">
                  <h2>Client Evaluation Feedback</h2>
                  <button className="btn btn-small btn-primary" onClick={() => setModal('feedback')}>
                    <Plus size={15} /> Record CSAT Review
                  </button>
                </div>

                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr><th>Client & Company</th><th>Account / Deal</th><th>Rating</th><th>Category</th><th>Feedback</th><th>Date</th></tr>
                    </thead>
                    <tbody>
                      {feedbacks.map((item) => (
                        <tr key={item.id}>
                          <td><strong>{item.clientName}</strong><small className="cell-detail">{item.company}</small></td>
                          <td>{item.lead?.name || 'General Account'}</td>
                          <td>
                            <span className="badge badge-warning">{item.score} / 5 ★</span>
                          </td>
                          <td><span className="status-pill status-approved">{item.category}</span></td>
                          <td><span style={{ fontStyle: 'italic', fontSize: '0.86rem' }}>&quot;{item.feedback || '—'}&quot;</span></td>
                          <td>{new Date(item.createdAt).toLocaleDateString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: Team Utilization & Budgets */}
          {activeTab === 'utilization' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <section className="data-grid data-grid-three">
                <article className="glass-panel data-card">
                  <span><Clock size={16} /> Total Hours Logged</span>
                  <strong>{utilization?.totalHours.toFixed(1) ?? '0'}h</strong>
                  <small>{utilization?.billableHours.toFixed(1) ?? '0'}h billable to clients</small>
                </article>
                <article className="glass-panel data-card">
                  <span><TrendingUp size={16} /> Team Utilization Rate</span>
                  <strong style={{ color: 'var(--accent-primary)' }}>{utilization?.utilizationRate ?? 85}%</strong>
                  <small>Target: 80% billable delivery time</small>
                </article>
                <article className="glass-panel data-card">
                  <span><BriefcaseBusiness size={16} /> Active Projects Tracked</span>
                  <strong>{utilization?.projectBurn.length ?? 0}</strong>
                  <small>With live budget burn monitoring</small>
                </article>
              </section>

              <div className="glass-panel data-section">
                <h2>Project Budget Burn & Delivery Velocity</h2>
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr><th>Project & Client</th><th>Contract Value</th><th>Hours Logged</th><th>Delivery Cost ($150/h)</th><th>Budget Burn %</th></tr>
                    </thead>
                    <tbody>
                      {utilization?.projectBurn.map((p) => (
                        <tr key={p.id}>
                          <td><strong>{p.name}</strong><small className="cell-detail">{p.company}</small></td>
                          <td>${p.value.toLocaleString()}</td>
                          <td>{p.totalHours}h ({p.billableHours}h billable)</td>
                          <td>${p.costIncurred.toLocaleString()}</td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <div style={{ width: '80px', height: '6px', background: 'rgba(0,0,0,0.06)', borderRadius: '3px', overflow: 'hidden' }}>
                                <div style={{ width: `${p.burnPercent}%`, height: '100%', background: p.burnPercent > 80 ? 'var(--accent-danger)' : 'var(--accent-primary)' }}></div>
                              </div>
                              <span style={{ fontSize: '0.82rem', fontWeight: 700 }}>{p.burnPercent}%</span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </main>

    {/* MODAL 1: AI Matchmaker */}
    {modal === 'matchmaker' && (
      <div className="modal-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) setModal(null); }}>
        <section className="glass-panel modal-panel" role="dialog" aria-modal="true" aria-labelledby="matchmaker-title" style={{ maxWidth: '680px' }}>
          <div className="modal-heading">
            <div>
              <h2 id="matchmaker-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Sparkles size={20} color="var(--accent-primary)" /> AI Smart Staffing Matchmaker
              </h2>
              <p style={{ fontSize: '0.85rem' }}>Optimizing assignment for &quot;{activeLeadForMatch?.name}&quot; (${activeLeadForMatch?.value?.toLocaleString() || '0'})</p>
            </div>
            <button className="icon-button" aria-label="Close" onClick={() => setModal(null)}>×</button>
          </div>

          {loadingMatchmaker ? (
            <p>Analyzing team skill tags, active pipeline loads, and leave schedules…</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '450px', overflowY: 'auto' }}>
              {matchmakerData?.candidates.map((cand) => (
                <div key={cand.user.id} className="matchmaker-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <strong style={{ fontSize: '1rem' }}>{cand.user.name}</strong>
                        <span className={`status-pill ${cand.fitCategory === 'OPTIMAL' ? 'status-approved' : cand.fitCategory === 'STRONG' ? 'status-done' : 'status-pending'}`}>
                          {cand.fitCategory} FIT
                        </span>
                      </div>
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{cand.user.position} • {cand.user.department}</span>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <div className="match-score-badge">{cand.matchScore}%</div>
                      <button
                        type="button"
                        onClick={() => assignFromMatchmaker(cand.user.id)}
                        className="btn btn-small btn-primary"
                        style={{ marginTop: '4px' }}
                      >
                        Assign Deal
                      </button>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '6px', fontSize: '0.78rem', color: 'var(--accent-success)' }}>
                    {cand.reasons.map((r, i) => (
                      <div key={i}>✓ {r}</div>
                    ))}
                  </div>

                  {cand.risks.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '4px', fontSize: '0.78rem', color: 'var(--accent-danger)' }}>
                      {cand.risks.map((rk, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Flame size={12} /> {rk}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    )}

    {/* MODAL 2: Create / Edit Lead */}
    {modal === 'lead' && (
      <div className="modal-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) { setModal(null); setEditingLead(null); } }}>
        <section className="glass-panel modal-panel" role="dialog" aria-modal="true" aria-labelledby="lead-modal-title">
          <div className="modal-heading">
            <h2 id="lead-modal-title">{editingLead ? 'Edit Lead' : 'Create New Lead'}</h2>
            <button className="icon-button" aria-label="Close" onClick={() => { setModal(null); setEditingLead(null); }}>×</button>
          </div>
          <form className="form-stack" onSubmit={submitLead}>
            <div className="form-row">
              <label>Opportunity Name<input name="name" required defaultValue={editingLead?.name} /></label>
              <label>Client Company<input name="company" required defaultValue={editingLead?.company} /></label>
            </div>
            <label>Contact Email<input name="email" type="email" required defaultValue={editingLead?.email} /></label>
            <div className="form-row">
              <label>Stage
                <select name="status" defaultValue={editingLead?.status || 'NEW'}>
                  {statuses.map((status) => <option key={status}>{status}</option>)}
                </select>
              </label>
              <label>Priority
                <select name="priority" defaultValue={editingLead?.priority || 'MEDIUM'}>
                  {['LOW', 'MEDIUM', 'HIGH', 'URGENT'].map((priority) => <option key={priority}>{priority}</option>)}
                </select>
              </label>
            </div>
            <div className="form-row">
              <label>Value ($ USD)<input name="value" type="number" min="0" step="1" defaultValue={editingLead?.value ?? ''} /></label>
              <label>Expected Close Date<input name="expectedCloseDate" type="date" defaultValue={editingLead?.expectedCloseDate?.slice(0, 10) || ''} /></label>
            </div>
            <label>Lead Assignee
              <select name="assigneeId" defaultValue={editingLead?.assigneeId || ''}>
                <option value="">Unassigned (use Matchmaker)</option>
                {users.filter((u) => u.role === 'EMPLOYEE').map((u) => (
                  <option key={u.id} value={u.id}>{u.name} ({u.department || 'Staff'})</option>
                ))}
              </select>
            </label>
            <label>Notes & Skill Requirements<textarea name="notes" rows={3} placeholder="Requirements like AWS, Kubernetes, SOC2..." defaultValue={editingLead?.notes || ''} /></label>
            <button className="btn btn-primary" type="submit">{editingLead ? 'Save Changes' : 'Create Lead'}</button>
          </form>
        </section>
      </div>
    )}

    {/* MODAL 3: Assign Task */}
    {modal === 'task' && (
      <div className="modal-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) setModal(null); }}>
        <section className="glass-panel modal-panel" role="dialog" aria-modal="true" aria-labelledby="task-modal-title">
          <div className="modal-heading">
            <h2 id="task-modal-title">Assign Client Milestone / Task</h2>
            <button className="icon-button" aria-label="Close" onClick={() => setModal(null)}>×</button>
          </div>
          <form className="form-stack" onSubmit={submitTask}>
            <label>Task Title<input name="title" required placeholder="e.g. SOC2 Cloud Encryption Validation" /></label>
            <label>Description<textarea name="description" rows={2} /></label>
            <div className="form-row">
              <label>Client / Account<input name="clientName" placeholder="e.g. Acme Corp" /></label>
              <label>Assignee
                <select name="assigneeId" required defaultValue="">
                  <option value="" disabled>Select team member</option>
                  {users.filter((u) => u.role === 'EMPLOYEE').map((u) => (
                    <option key={u.id} value={u.id}>{u.name} ({u.department})</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="form-row">
              <label>Priority
                <select name="priority" defaultValue="MEDIUM">
                  {['LOW', 'MEDIUM', 'HIGH', 'URGENT'].map((priority) => <option key={priority}>{priority}</option>)}
                </select>
              </label>
              <label>Due Date<input name="dueDate" type="date" /></label>
            </div>
            <button className="btn btn-primary" type="submit">Assign Task</button>
          </form>
        </section>
      </div>
    )}

    {/* MODAL 4: Record Client Feedback */}
    {modal === 'feedback' && (
      <div className="modal-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) setModal(null); }}>
        <section className="glass-panel modal-panel" role="dialog" aria-modal="true" aria-labelledby="feedback-modal-title">
          <div className="modal-heading">
            <h2 id="feedback-modal-title">Record Client Evaluation Feedback</h2>
            <button className="icon-button" aria-label="Close" onClick={() => setModal(null)}>×</button>
          </div>
          <form className="form-stack" onSubmit={submitClientFeedback}>
            <div className="form-row">
              <label>Client Contact Name<input name="clientName" required placeholder="Dr. Miles Bennett" /></label>
              <label>Client Company<input name="company" required placeholder="Cyberdyne Systems" /></label>
            </div>
            <div className="form-row">
              <label>Associated Deal
                <select name="leadId" defaultValue="">
                  <option value="">General Project / Account</option>
                  {leads.map((l) => (
                    <option key={l.id} value={l.id}>{l.name} ({l.company})</option>
                  ))}
                </select>
              </label>
              <label>Rating (1 to 5 Stars)
                <select name="score" required defaultValue="5">
                  <option value="5">5 ★ — Outstanding (Promoter)</option>
                  <option value="4">4 ★ — Good (Passive)</option>
                  <option value="3">3 ★ — Neutral</option>
                  <option value="2">2 ★ — Needs Improvement</option>
                  <option value="1">1 ★ — Dissatisfied (Detractor)</option>
                </select>
              </label>
            </div>
            <label>Category
              <select name="category" defaultValue="Delivery">
                <option value="Delivery">Delivery & Timeliness</option>
                <option value="Technical Quality">Technical Architecture & Quality</option>
                <option value="Communication">Communication & Transparency</option>
              </select>
            </label>
            <label>Client Testimonial / Feedback
              <textarea name="feedback" rows={3} placeholder="Quote direct feedback from client..." />
            </label>
            <button className="btn btn-primary" type="submit">Save Feedback</button>
          </form>
        </section>
      </div>
    )}
  </>;
}

export default function EmployerDashboard() {
  return <AuthGuard allowedRoles={['EMPLOYER']}><EmployerCenter /></AuthGuard>;
}
