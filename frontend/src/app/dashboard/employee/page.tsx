"use client";

import { FormEvent, useCallback, useEffect, useState } from 'react';
import AuthGuard from '../../../components/AuthGuard';
import Navbar from '../../../components/Navbar';
import { api, type Leave, type Lead, type PulseCheck, type Task } from '../../../lib/api';

function EmployeeHub() {
  const [leaves, setLeaves] = useState<Leave[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [pulse, setPulse] = useState<PulseCheck[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [modal, setModal] = useState<'leave' | 'pulse' | null>(null);

  const refresh = useCallback(async () => {
    setError('');
    try {
      const [leaveRows, leadRows, pulseRows, taskRows] = await Promise.all([
        api<Leave[]>('/api/leaves'), api<Lead[]>('/api/leads'), api<PulseCheck[]>('/api/pulse'), api<Task[]>('/api/tasks'),
      ]);
      setLeaves(leaveRows); setLeads(leadRows); setPulse(pulseRows); setTasks(taskRows);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load dashboard data.');
    } finally { setLoading(false); }
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void refresh(); }, [refresh]);

  async function submitLeave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      await api('/api/leaves', { method: 'POST', body: JSON.stringify({ type: form.get('type'), fromDate: form.get('fromDate'), toDate: form.get('toDate'), reason: form.get('reason') }) });
      setModal(null); setNotice('Leave request submitted.'); await refresh();
    } catch (saveError) { setError(saveError instanceof Error ? saveError.message : 'Could not submit leave request.'); }
  }

  async function submitPulse(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      await api('/api/pulse', { method: 'POST', body: JSON.stringify({ score: Number(form.get('score')), feedback: form.get('feedback') }) });
      setModal(null); setNotice('Pulse check recorded.'); await refresh();
    } catch (saveError) { setError(saveError instanceof Error ? saveError.message : 'Could not record pulse check.'); }
  }

  async function changeTaskStatus(task: Task, status: Task['status']) {
    try { await api(`/api/tasks/${task.id}`, { method: 'PUT', body: JSON.stringify({ status }) }); await refresh(); }
    catch (saveError) { setError(saveError instanceof Error ? saveError.message : 'Could not update task.'); }
  }

  return <>
    <Navbar />
    <main className="dashboard-shell animate-fade-in">
      <header className="dashboard-heading">
        <div><h1>My Hub</h1><p>Your leave, assigned client work, tasks and wellbeing</p></div>
        <div className="dashboard-actions"><button className="btn btn-secondary" onClick={() => { setNotice(''); setModal('pulse'); }}>Log pulse check</button><button className="btn btn-primary" onClick={() => { setNotice(''); setModal('leave'); }}>Request leave</button></div>
      </header>
      {error && <div className="notice notice-error" role="alert">{error}</div>}
      {notice && <div className="notice notice-success" role="status">{notice}</div>}
      {loading ? <p>Loading your data…</p> : <>
        <section className="data-grid data-grid-three">
          <article className="glass-panel data-card"><span>Assigned leads</span><strong>{leads.length}</strong><small>{leads.filter((lead) => ['NEW', 'CONTACTED', 'QUALIFIED', 'PROPOSAL'].includes(lead.status)).length} active in pipeline</small></article>
          <article className="glass-panel data-card"><span>Pending leave</span><strong>{leaves.filter((leave) => leave.status === 'PENDING').length}</strong><small>{leaves.length} total requests</small></article>
          <article className="glass-panel data-card"><span>Open tasks</span><strong>{tasks.filter((task) => task.status !== 'DONE').length}</strong><small>{tasks.length} assigned tasks</small></article>
        </section>
        <section className="glass-panel data-section">
          <h2>My tasks</h2>
          {tasks.length === 0 ? <p>No tasks assigned yet.</p> : <div className="table-scroll"><table><thead><tr><th>Task</th><th>Client</th><th>Priority</th><th>Due</th><th>Status</th></tr></thead><tbody>{tasks.map((task) => <tr key={task.id}><td><strong>{task.title}</strong><small className="cell-detail">{task.description || '—'}</small></td><td>{task.clientName || '—'}</td><td>{task.priority}</td><td>{task.dueDate ? new Date(task.dueDate).toLocaleDateString() : '—'}</td><td><select aria-label={`Status for ${task.title}`} value={task.status} onChange={(event) => void changeTaskStatus(task, event.target.value as Task['status'])}><option value="TODO">To do</option><option value="IN_PROGRESS">In progress</option><option value="DONE">Done</option></select></td></tr>)}</tbody></table></div>}
        </section>
        <section className="glass-panel data-section">
          <h2>Assigned client pipeline</h2>
          {leads.length === 0 ? <p>No leads are assigned to you.</p> : <div className="table-scroll"><table><thead><tr><th>Lead</th><th>Company</th><th>Status</th><th>Priority</th><th>Value</th><th>Expected close</th></tr></thead><tbody>{leads.map((lead) => <tr key={lead.id}><td><strong>{lead.name}</strong><small className="cell-detail">{lead.email}</small></td><td>{lead.company}</td><td>{lead.status}</td><td>{lead.priority}</td><td>{lead.value == null ? '—' : new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(lead.value)}</td><td>{lead.expectedCloseDate ? new Date(lead.expectedCloseDate).toLocaleDateString() : '—'}</td></tr>)}</tbody></table></div>}
        </section>
        <section className="data-grid data-grid-two">
          <article className="glass-panel data-section"><h2>My leave requests</h2>{leaves.length === 0 ? <p>No leave requests yet.</p> : <div className="table-scroll"><table><thead><tr><th>Type</th><th>Dates</th><th>Schedule impact</th><th>Status</th></tr></thead><tbody>{leaves.map((leave) => <tr key={leave.id}><td>{leave.type}<small className="cell-detail">{leave.reason}</small></td><td>{new Date(leave.fromDate).toLocaleDateString()} – {new Date(leave.toDate).toLocaleDateString()}</td><td><span className={`status-pill status-${leave.riskScore.toLowerCase()}`}>{leave.riskScore} risk</span><small className="cell-detail">{leave.riskNotes}{leave.coverageName ? ` · Suggested teammate: ${leave.coverageName}` : ''}</small></td><td><span className={`status-pill status-${leave.status.toLowerCase()}`}>{leave.status}</span></td></tr>)}</tbody></table></div>}</article>
          <article className="glass-panel data-section"><h2>Pulse history</h2>{pulse.length === 0 ? <p>No pulse checks yet.</p> : <div className="table-scroll"><table><thead><tr><th>Date</th><th>Score</th><th>Workload</th><th>Feedback</th></tr></thead><tbody>{pulse.map((item) => <tr key={item.id}><td>{new Date(item.createdAt).toLocaleDateString()}</td><td>{item.score}/5</td><td>{item.workloadRisk}</td><td>{item.feedback || '—'}</td></tr>)}</tbody></table></div>}</article>
        </section>
      </>}
    </main>
    {modal && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setModal(null); }}><section className="glass-panel modal-panel" role="dialog" aria-modal="true" aria-labelledby="employee-modal-title"><div className="modal-heading"><h2 id="employee-modal-title">{modal === 'leave' ? 'Request leave' : 'Log pulse check'}</h2><button className="icon-button" aria-label="Close" onClick={() => setModal(null)}>×</button></div>{modal === 'leave' ? <form className="form-stack" onSubmit={submitLeave}><label>Leave type<select name="type" required><option>Annual Leave</option><option>Medical Leave</option><option>Personal Leave</option><option>Family Leave</option></select></label><div className="form-row"><label>From<input name="fromDate" type="date" required /></label><label>To<input name="toDate" type="date" required /></label></div><label>Reason<textarea name="reason" required rows={3} maxLength={1000} /></label><button className="btn btn-primary" type="submit">Submit request</button></form> : <form className="form-stack" onSubmit={submitPulse}><label>How are you feeling today?<select name="score" required defaultValue="3"><option value="1">1 — Struggling</option><option value="2">2 — Stretched</option><option value="3">3 — Okay</option><option value="4">4 — Good</option><option value="5">5 — Great</option></select></label><label>Workload<textarea name="feedback" rows={3} maxLength={1000} placeholder="Anything you would like your manager to know?" /></label><button className="btn btn-primary" type="submit">Save pulse check</button></form>}</section></div>}
  </>;
}

export default function EmployeeDashboard() {
  return <AuthGuard allowedRoles={['EMPLOYEE', 'EMPLOYER']}><EmployeeHub /></AuthGuard>;
}
