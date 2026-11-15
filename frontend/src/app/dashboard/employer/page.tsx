"use client";

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Plus, Users, HeartPulse, CalendarDays, BriefcaseBusiness, Pencil, Trash2 } from 'lucide-react';
import AuthGuard from '../../../components/AuthGuard';
import Navbar from '../../../components/Navbar';
import { api, type AuditEntry, type AuditPage, type Lead, type Leave, type PulseCheck, type Task, type User } from '../../../lib/api';

type Modal = 'lead' | 'task' | null;
const statuses: Lead['status'][] = ['NEW', 'CONTACTED', 'QUALIFIED', 'PROPOSAL', 'WON', 'LOST'];

function EmployerCenter() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [leaves, setLeaves] = useState<Leave[]>([]);
  const [pulse, setPulse] = useState<PulseCheck[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [auditCursor, setAuditCursor] = useState<string | null>(null);
  const [loadingAudit, setLoadingAudit] = useState(false);
  const [modal, setModal] = useState<Modal>(null);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const refresh = useCallback(async () => {
    try {
      const [leadRows, leaveRows, pulseRows, taskRows, people, auditPage] = await Promise.all([
        api<Lead[]>('/api/leads'), api<Leave[]>('/api/leaves'), api<PulseCheck[]>('/api/pulse'), api<Task[]>('/api/tasks'), api<User[]>('/api/users'), api<AuditPage>('/api/audit?limit=12'),
      ]);
      setError('');
      setLeads(leadRows); setLeaves(leaveRows); setPulse(pulseRows); setTasks(taskRows); setUsers(people); setAudit(auditPage.items); setAuditCursor(auditPage.nextCursor);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load dashboard data.');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    let active = true;
    Promise.all([
      api<Lead[]>('/api/leads'), api<Leave[]>('/api/leaves'), api<PulseCheck[]>('/api/pulse'), api<Task[]>('/api/tasks'), api<User[]>('/api/users'), api<AuditPage>('/api/audit?limit=12'),
    ])
      .then(([leadRows, leaveRows, pulseRows, taskRows, people, auditPage]) => {
        if (!active) return;
        setError('');
        setLeads(leadRows); setLeaves(leaveRows); setPulse(pulseRows); setTasks(taskRows); setUsers(people); setAudit(auditPage.items); setAuditCursor(auditPage.nextCursor);
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

  async function submitLead(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const body = JSON.stringify({ name: form.get('name'), company: form.get('company'), email: form.get('email'), status: form.get('status'), priority: form.get('priority'), value: form.get('value'), expectedCloseDate: form.get('expectedCloseDate') || null, notes: form.get('notes'), assigneeId: form.get('assigneeId') || null });
    try {
      await api(editingLead ? `/api/leads/${editingLead.id}` : '/api/leads', { method: editingLead ? 'PUT' : 'POST', body });
      setModal(null); setEditingLead(null); setNotice(editingLead ? 'Lead updated.' : 'Lead created.'); await refresh();
    } catch (saveError) { setError(saveError instanceof Error ? saveError.message : 'Could not save lead.'); }
  }

  async function submitTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const body = JSON.stringify({ title: form.get('title'), description: form.get('description'), clientName: form.get('clientName'), priority: form.get('priority'), status: form.get('status'), dueDate: form.get('dueDate') || null, assigneeId: form.get('assigneeId') });
    try {
      await api('/api/tasks', { method: 'POST', body });
      setModal(null); setNotice('Task assigned.'); await refresh();
    } catch (saveError) { setError(saveError instanceof Error ? saveError.message : 'Could not create task.'); }
  }

  async function updateLeave(leave: Leave, status: Leave['status']) {
    try { await api(`/api/leaves/${leave.id}`, { method: 'PUT', body: JSON.stringify({ status }) }); setNotice(`Leave ${status.toLowerCase()}.`); await refresh(); }
    catch (saveError) { setError(saveError instanceof Error ? saveError.message : 'Could not update leave.'); }
  }

  async function changeTaskStatus(task: Task, status: Task['status']) {
    try { await api(`/api/tasks/${task.id}`, { method: 'PUT', body: JSON.stringify({ status }) }); await refresh(); }
    catch (saveError) { setError(saveError instanceof Error ? saveError.message : 'Could not update task.'); }
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

  return <>
    <Navbar />
    <main className="dashboard-shell animate-fade-in">
      <header className="dashboard-heading"><div><h1>Command Center</h1><p>Live HR and CRM operations</p></div><div className="dashboard-actions"><button className="btn btn-secondary" onClick={() => { setError(''); setModal('task'); }}>Assign task</button><button className="btn btn-primary" onClick={() => { setEditingLead(null); setError(''); setModal('lead'); }}><Plus size={17} /> New lead</button></div></header>
      {error && <div className="notice notice-error" role="alert">{error}</div>}{notice && <div className="notice notice-success" role="status">{notice}</div>}
      {loading ? <p>Loading company data…</p> : <>
        <section className="data-grid data-grid-four">
          <article className="glass-panel data-card"><span><BriefcaseBusiness size={16} /> Pipeline</span><strong>{leads.length}</strong><small>{leads.filter((lead) => ['NEW', 'CONTACTED', 'QUALIFIED', 'PROPOSAL'].includes(lead.status)).length} active leads</small></article>
          <article className="glass-panel data-card"><span><CalendarDays size={16} /> Pending leave</span><strong>{leaves.filter((leave) => leave.status === 'PENDING').length}</strong><small>of {leaves.length} requests</small></article>
          <article className="glass-panel data-card"><span><HeartPulse size={16} /> Pulse responses</span><strong>{pulse.length}</strong><small>{pulse.length ? `Average score ${(pulse.reduce((sum, item) => sum + item.score, 0) / pulse.length).toFixed(1)} / 5` : 'No responses yet'}</small></article>
          <article className="glass-panel data-card"><span><Users size={16} /> Open tasks</span><strong>{tasks.filter((task) => task.status !== 'DONE').length}</strong><small>{tasks.length} total tasks</small></article>
        </section>

        <section className="glass-panel data-section"><h2>Team wellbeing</h2>{pulseByPerson.length === 0 ? <p>No pulse responses to chart yet.</p> : <div className="chart-container"><ResponsiveContainer width="100%" height="100%"><AreaChart data={pulseByPerson} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}><CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" /><XAxis dataKey="name" stroke="var(--text-secondary)" /><YAxis domain={[0, 5]} stroke="var(--text-secondary)" /><Tooltip /><Area type="monotone" dataKey="score" stroke="var(--accent-primary)" fill="rgba(79,70,229,0.14)" name="Average pulse score" /><Area type="monotone" dataKey="risk" stroke="var(--accent-warning)" fill="rgba(245,158,11,0.08)" name="Workload risk (1–4)" /></AreaChart></ResponsiveContainer></div>}</section>

        <section className="glass-panel data-section"><div className="section-heading"><h2>Leave requests</h2><span>{leaves.filter((leave) => leave.status === 'PENDING').length} awaiting review</span></div>{leaves.length === 0 ? <p>No leave requests yet.</p> : <div className="table-scroll"><table><thead><tr><th>Employee</th><th>Type and reason</th><th>Dates</th><th>Conflict assessment</th><th>Status / action</th></tr></thead><tbody>{leaves.map((leave) => <tr key={leave.id}><td>{leave.user.name}</td><td>{leave.type}<small className="cell-detail">{leave.reason}</small></td><td>{new Date(leave.fromDate).toLocaleDateString()} – {new Date(leave.toDate).toLocaleDateString()}</td><td><span className={`status-pill status-${leave.riskScore.toLowerCase()}`}>{leave.riskScore} risk</span><small className="cell-detail">{leave.riskNotes || 'No schedule conflict flagged'}{leave.coverageName ? ` · Suggested coverage: ${leave.coverageName}` : ''}</small></td><td>{leave.status === 'PENDING' ? <div className="inline-actions"><button className="btn btn-small btn-primary" onClick={() => void updateLeave(leave, 'APPROVED')}>Approve</button><button className="btn btn-small btn-danger" onClick={() => void updateLeave(leave, 'REJECTED')}>Reject</button></div> : <span className={`status-pill status-${leave.status.toLowerCase()}`}>{leave.status}</span>}</td></tr>)}</tbody></table></div>}</section>

        <section className="glass-panel data-section"><div className="section-heading"><h2>CRM pipeline</h2><button className="btn btn-small btn-primary" onClick={() => { setEditingLead(null); setError(''); setModal('lead'); }}><Plus size={15} /> Add lead</button></div>{leads.length === 0 ? <p>No CRM leads yet.</p> : <div className="table-scroll"><table><thead><tr><th>Opportunity</th><th>Owner</th><th>Stage</th><th>Priority</th><th>Value</th><th>Close date</th><th>Actions</th></tr></thead><tbody>{leads.map((lead) => <tr key={lead.id}><td><strong>{lead.name}</strong><small className="cell-detail">{lead.company} · {lead.email}</small></td><td>{lead.assignee?.name || 'Unassigned'}</td><td><select aria-label={`Stage for ${lead.name}`} value={lead.status} onChange={async (event) => { const status = event.target.value as Lead['status']; try { await api(`/api/leads/${lead.id}`, { method: 'PUT', body: JSON.stringify({ ...lead, status }) }); await refresh(); } catch (e) { setError(e instanceof Error ? e.message : 'Could not update lead.'); } }}>{statuses.map((status) => <option key={status}>{status}</option>)}</select></td><td>{lead.priority}</td><td>{lead.value == null ? '—' : new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(lead.value)}</td><td>{lead.expectedCloseDate ? new Date(lead.expectedCloseDate).toLocaleDateString() : '—'}</td><td><div className="inline-actions"><button className="icon-button" aria-label={`Edit ${lead.name}`} onClick={() => { setEditingLead(lead); setError(''); setModal('lead'); }}><Pencil size={15} /></button><button className="icon-button danger-text" aria-label={`Delete ${lead.name}`} onClick={() => void remove(`/api/leads/${lead.id}`, 'lead')}><Trash2 size={15} /></button></div></td></tr>)}</tbody></table></div>}</section>

        <section className="data-grid data-grid-two"><article className="glass-panel data-section"><h2>Tasks</h2>{tasks.length === 0 ? <p>No tasks yet.</p> : <div className="table-scroll"><table><thead><tr><th>Task</th><th>Owner</th><th>Due</th><th>Status</th><th /></tr></thead><tbody>{tasks.map((task) => <tr key={task.id}><td><strong>{task.title}</strong><small className="cell-detail">{task.clientName || 'Internal'} · {task.priority}</small></td><td>{task.assignee.name}</td><td>{task.dueDate ? new Date(task.dueDate).toLocaleDateString() : '—'}</td><td><select aria-label={`Status for ${task.title}`} value={task.status} onChange={(event) => void changeTaskStatus(task, event.target.value as Task['status'])}><option value="TODO">To do</option><option value="IN_PROGRESS">In progress</option><option value="DONE">Done</option></select></td><td><button className="icon-button danger-text" aria-label={`Delete ${task.title}`} onClick={() => void remove(`/api/tasks/${task.id}`, 'task')}><Trash2 size={15} /></button></td></tr>)}</tbody></table></div>}</article>
          <article className="glass-panel data-section"><h2>Recent pulse checks</h2>{pulse.length === 0 ? <p>No pulse checks yet.</p> : <div className="table-scroll"><table><thead><tr><th>Employee</th><th>Score</th><th>Risk</th><th>Date</th><th>Feedback</th></tr></thead><tbody>{pulse.slice(0, 12).map((item) => <tr key={item.id}><td>{item.user?.name || '—'}</td><td>{item.score}/5</td><td>{item.workloadRisk}</td><td>{new Date(item.createdAt).toLocaleDateString()}</td><td>{item.feedback || '—'}</td></tr>)}</tbody></table></div>}</article></section>

        <section className="glass-panel data-section"><div className="section-heading"><div><h2>Audit activity</h2><span>Recent changes across leave, CRM, tasks and wellbeing</span></div>{auditCursor && <button className="btn btn-small btn-secondary" onClick={() => void loadOlderAudit()} disabled={loadingAudit}>{loadingAudit ? 'Loading…' : 'Load older activity'}</button>}</div>{audit.length === 0 ? <p>No changes have been recorded yet.</p> : <div className="table-scroll"><table><thead><tr><th>When</th><th>Who</th><th>Action</th><th>Record</th><th>Details</th></tr></thead><tbody>{audit.map((entry) => <tr key={entry.id}><td>{new Date(entry.createdAt).toLocaleString()}</td><td>{entry.actor?.name || 'System'}</td><td>{entry.action}</td><td>{entry.entity}</td><td>{entry.summary}</td></tr>)}</tbody></table></div>}</section>
      </>}
    </main>

    {modal && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) { setModal(null); setEditingLead(null); } }}><section className="glass-panel modal-panel" role="dialog" aria-modal="true" aria-labelledby="center-modal-title"><div className="modal-heading"><h2 id="center-modal-title">{modal === 'lead' ? editingLead ? 'Edit lead' : 'Create lead' : 'Assign task'}</h2><button className="icon-button" aria-label="Close" onClick={() => { setModal(null); setEditingLead(null); }}>×</button></div>
      {modal === 'lead' ? <form className="form-stack" onSubmit={submitLead}><div className="form-row"><label>Lead name<input name="name" required defaultValue={editingLead?.name} /></label><label>Company<input name="company" required defaultValue={editingLead?.company} /></label></div><label>Contact email<input name="email" type="email" required defaultValue={editingLead?.email} /></label><div className="form-row"><label>Stage<select name="status" defaultValue={editingLead?.status || 'NEW'}>{statuses.map((status) => <option key={status}>{status}</option>)}</select></label><label>Priority<select name="priority" defaultValue={editingLead?.priority || 'MEDIUM'}>{['LOW', 'MEDIUM', 'HIGH', 'URGENT'].map((priority) => <option key={priority}>{priority}</option>)}</select></label></div><div className="form-row"><label>Value (USD)<input name="value" type="number" min="0" step="0.01" defaultValue={editingLead?.value ?? ''} /></label><label>Expected close<input name="expectedCloseDate" type="date" defaultValue={editingLead?.expectedCloseDate?.slice(0, 10) || ''} /></label></div><label>Assignee<select name="assigneeId" defaultValue={editingLead?.assigneeId || ''}><option value="">Unassigned</option>{users.filter((user) => user.role === 'EMPLOYEE').map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}</select></label><label>Notes<textarea name="notes" rows={3} defaultValue={editingLead?.notes || ''} /></label><button className="btn btn-primary" type="submit">{editingLead ? 'Save changes' : 'Create lead'}</button></form> : <form className="form-stack" onSubmit={submitTask}><label>Task title<input name="title" required /></label><label>Description<textarea name="description" rows={2} /></label><div className="form-row"><label>Client<input name="clientName" /></label><label>Assignee<select name="assigneeId" required defaultValue=""><option value="" disabled>Select employee</option>{users.filter((user) => user.role === 'EMPLOYEE').map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}</select></label></div><div className="form-row"><label>Priority<select name="priority" defaultValue="MEDIUM">{['LOW', 'MEDIUM', 'HIGH', 'URGENT'].map((priority) => <option key={priority}>{priority}</option>)}</select></label><label>Due date<input name="dueDate" type="date" /></label></div><button className="btn btn-primary" type="submit">Assign task</button></form>}</section></div>}
  </>;
}

export default function EmployerDashboard() {
  return <AuthGuard allowedRoles={['EMPLOYER']}><EmployerCenter /></AuthGuard>;
}
