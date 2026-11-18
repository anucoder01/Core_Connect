"use client";

import { FormEvent, useCallback, useEffect, useState } from 'react';
import {
  CheckSquare,
  BriefcaseBusiness,
  CalendarDays,
  HeartPulse,
  Clock,
  Award,
  Plus,
  Trash2,
  Printer,
  TrendingUp
} from 'lucide-react';
import AuthGuard from '../../../components/AuthGuard';
import Navbar from '../../../components/Navbar';
import {
  api,
  type Leave,
  type Lead,
  type PulseCheck,
  type Task,
  type TimeEntryItem,
  type AppraisalDossier
} from '../../../lib/api';

type TabView = 'work' | 'leave' | 'time' | 'dossier' | 'pulse';
type Modal = 'leave' | 'pulse' | 'time' | null;

function EmployeeHub() {
  const [activeTab, setActiveTab] = useState<TabView>('work');
  const [leaves, setLeaves] = useState<Leave[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [pulse, setPulse] = useState<PulseCheck[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [timeEntries, setTimeEntries] = useState<TimeEntryItem[]>([]);
  const [dossier, setDossier] = useState<AppraisalDossier | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [modal, setModal] = useState<Modal>(null);

  const refresh = useCallback(async () => {
    try {
      const [leaveRows, leadRows, pulseRows, taskRows, timeRows, dossierData] = await Promise.all([
        api<Leave[]>('/api/leaves'),
        api<Lead[]>('/api/leads'),
        api<PulseCheck[]>('/api/pulse'),
        api<Task[]>('/api/tasks'),
        api<TimeEntryItem[]>('/api/time-entries').catch(() => []),
        api<AppraisalDossier>('/api/appraisals').catch(() => null),
      ]);
      setError('');
      setLeaves(leaveRows);
      setLeads(leadRows);
      setPulse(pulseRows);
      setTasks(taskRows);
      setTimeEntries(timeRows);
      setDossier(dossierData);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load dashboard data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    Promise.all([
      api<Leave[]>('/api/leaves'),
      api<Lead[]>('/api/leads'),
      api<PulseCheck[]>('/api/pulse'),
      api<Task[]>('/api/tasks'),
      api<TimeEntryItem[]>('/api/time-entries').catch(() => []),
      api<AppraisalDossier>('/api/appraisals').catch(() => null),
    ])
      .then(([leaveRows, leadRows, pulseRows, taskRows, timeRows, dossierData]) => {
        if (!active) return;
        setError('');
        setLeaves(leaveRows);
        setLeads(leadRows);
        setPulse(pulseRows);
        setTasks(taskRows);
        setTimeEntries(timeRows);
        setDossier(dossierData);
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

  async function submitLeave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      await api('/api/leaves', {
        method: 'POST',
        body: JSON.stringify({
          type: form.get('type'),
          fromDate: form.get('fromDate'),
          toDate: form.get('toDate'),
          reason: form.get('reason')
        })
      });
      setModal(null);
      setNotice('Leave request submitted with automated schedule impact assessment.');
      await refresh();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not submit leave request.');
    }
  }

  async function submitPulse(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      await api('/api/pulse', {
        method: 'POST',
        body: JSON.stringify({
          score: Number(form.get('score')),
          workloadRisk: form.get('workloadRisk') || 'MANAGEABLE',
          feedback: form.get('feedback')
        })
      });
      setModal(null);
      setNotice('Pulse check recorded. Leadership notified of team capacity.');
      await refresh();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not record pulse check.');
    }
  }

  async function submitTimeEntry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      await api('/api/time-entries', {
        method: 'POST',
        body: JSON.stringify({
          leadId: form.get('leadId') || null,
          hours: Number(form.get('hours')),
          date: form.get('date'),
          description: form.get('description'),
          billable: form.get('billable') === 'true',
        })
      });
      setModal(null);
      setNotice('Hours logged successfully.');
      await refresh();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not log time.');
    }
  }

  async function changeTaskStatus(task: Task, status: Task['status']) {
    try {
      await api(`/api/tasks/${task.id}`, { method: 'PUT', body: JSON.stringify({ status }) });
      await refresh();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not update task.');
    }
  }

  async function deleteTimeEntry(id: string) {
    if (!window.confirm('Delete this logged time entry?')) return;
    try {
      await api(`/api/time-entries/${id}`, { method: 'DELETE' });
      setNotice('Time entry deleted.');
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete time entry.');
    }
  }

  const activeLeads = leads.filter((l) => ['NEW', 'CONTACTED', 'QUALIFIED', 'PROPOSAL'].includes(l.status));
  const activePipelineValue = activeLeads.reduce((s, l) => s + (l.value || 0), 0);
  const totalHoursLogged = timeEntries.reduce((s, t) => s + t.hours, 0);
  const billableHoursLogged = timeEntries.filter(t => t.billable).reduce((s, t) => s + t.hours, 0);
  const myUtilization = totalHoursLogged > 0 ? Math.round((billableHoursLogged / totalHoursLogged) * 100) : 85;

  return <>
    <Navbar />
    <main className="dashboard-shell animate-fade-in">
      <header className="dashboard-heading">
        <div>
          <h1>My Operations Hub</h1>
          <p>Deliverables, client pipelines, time tracking, appraisals & wellbeing</p>
        </div>
        <div className="dashboard-actions">
          <button className="btn btn-secondary" onClick={() => { setNotice(''); setError(''); setModal('time'); }}>
            <Clock size={16} /> Log Project Time
          </button>
          <button className="btn btn-secondary" onClick={() => { setNotice(''); setError(''); setModal('pulse'); }}>
            <HeartPulse size={16} /> Log Pulse Check
          </button>
          <button className="btn btn-primary" onClick={() => { setNotice(''); setError(''); setModal('leave'); }}>
            <CalendarDays size={16} /> Request Leave
          </button>
        </div>
      </header>

      {/* Subnavigation Tabs */}
      <nav className="subnav-tabs" aria-label="Employee views">
        <button
          type="button"
          onClick={() => setActiveTab('work')}
          className={`subnav-tab ${activeTab === 'work' ? 'active' : ''}`}
        >
          <CheckSquare size={15} /> My Tasks & Pipeline ({tasks.length + leads.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('leave')}
          className={`subnav-tab ${activeTab === 'leave' ? 'active' : ''}`}
        >
          <CalendarDays size={15} /> Leave & Schedule ({leaves.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('time')}
          className={`subnav-tab ${activeTab === 'time' ? 'active' : ''}`}
        >
          <Clock size={15} /> Time Tracking ({totalHoursLogged.toFixed(1)}h)
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('dossier')}
          className={`subnav-tab ${activeTab === 'dossier' ? 'active' : ''}`}
        >
          <Award size={15} /> 360° Verified Appraisal
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('pulse')}
          className={`subnav-tab ${activeTab === 'pulse' ? 'active' : ''}`}
        >
          <HeartPulse size={15} /> Wellbeing History
        </button>
      </nav>

      {error && <div className="notice notice-error" role="alert">{error}</div>}
      {notice && <div className="notice notice-success" role="status">{notice}</div>}

      {loading ? (
        <p>Loading your data…</p>
      ) : (
        <>
          {/* TAB 1: Work (Tasks + Pipeline) */}
          {activeTab === 'work' && (
            <>
              <section className="data-grid data-grid-four">
                <article className="glass-panel data-card">
                  <span><BriefcaseBusiness size={16} /> Assigned Accounts</span>
                  <strong>{leads.length}</strong>
                  <small>${activePipelineValue.toLocaleString()} active value</small>
                </article>
                <article className="glass-panel data-card">
                  <span><CheckSquare size={16} /> Open Deliverables</span>
                  <strong>{tasks.filter((task) => task.status !== 'DONE').length}</strong>
                  <small>{tasks.length} assigned tasks</small>
                </article>
                <article className="glass-panel data-card">
                  <span><Clock size={16} /> Billable Utilization</span>
                  <strong>{myUtilization}%</strong>
                  <small>{billableHoursLogged.toFixed(1)}h billable this cycle</small>
                </article>
                <article className="glass-panel data-card">
                  <span><Award size={16} /> Performance Rating</span>
                  <strong style={{ fontSize: '1.25rem', color: 'var(--accent-primary)' }}>
                    {dossier?.rating.replace('_', ' ') || 'ON TRACK'}
                  </strong>
                  <small>{dossier?.metrics.avgClientCSAT || 5.0} / 5.0 client CSAT</small>
                </article>
              </section>

              <section className="glass-panel data-section">
                <h2>My Assigned Milestones & Tasks</h2>
                {tasks.length === 0 ? (
                  <p>No tasks assigned yet.</p>
                ) : (
                  <div className="table-scroll">
                    <table>
                      <thead>
                        <tr><th>Task</th><th>Client</th><th>Priority</th><th>Due Date</th><th>Status</th></tr>
                      </thead>
                      <tbody>
                        {tasks.map((task) => (
                          <tr key={task.id}>
                            <td><strong>{task.title}</strong><small className="cell-detail">{task.description || '—'}</small></td>
                            <td>{task.clientName || 'Internal'}</td>
                            <td><span className={`status-pill status-${task.priority.toLowerCase()}`}>{task.priority}</span></td>
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
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>

              <section className="glass-panel data-section">
                <h2>Assigned Client Pipeline & Accounts</h2>
                {leads.length === 0 ? (
                  <p>No leads are assigned to you.</p>
                ) : (
                  <div className="table-scroll">
                    <table>
                      <thead>
                        <tr><th>Opportunity</th><th>Company</th><th>Stage</th><th>Priority</th><th>Value</th><th>Expected Close</th></tr>
                      </thead>
                      <tbody>
                        {leads.map((lead) => (
                          <tr key={lead.id}>
                            <td><strong>{lead.name}</strong><small className="cell-detail">{lead.email}</small></td>
                            <td>{lead.company}</td>
                            <td><span className={`status-pill status-${lead.status === 'WON' ? 'approved' : lead.status === 'LOST' ? 'rejected' : 'pending'}`}>{lead.status}</span></td>
                            <td><span className={`status-pill status-${lead.priority.toLowerCase()}`}>{lead.priority}</span></td>
                            <td>{lead.value == null ? '—' : `$${lead.value.toLocaleString()}`}</td>
                            <td>{lead.expectedCloseDate ? new Date(lead.expectedCloseDate).toLocaleDateString() : '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            </>
          )}

          {/* TAB 2: Leave & Schedule */}
          {activeTab === 'leave' && (
            <div className="glass-panel data-section">
              <div className="section-heading">
                <h2>My Leave Requests & Client Collision Check</h2>
                <button className="btn btn-small btn-primary" onClick={() => setModal('leave')}>
                  <Plus size={15} /> Apply for Leave
                </button>
              </div>

              {leaves.length === 0 ? (
                <p>No leave requests on file.</p>
              ) : (
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr><th>Type & Reason</th><th>Dates</th><th>CRM Collision Assessment</th><th>Status</th></tr>
                    </thead>
                    <tbody>
                      {leaves.map((leave) => (
                        <tr key={leave.id}>
                          <td><strong>{leave.type}</strong><small className="cell-detail">{leave.reason}</small></td>
                          <td>{new Date(leave.fromDate).toLocaleDateString()} – {new Date(leave.toDate).toLocaleDateString()}</td>
                          <td>
                            <span className={`status-pill status-${leave.riskScore.toLowerCase()}`}>{leave.riskScore} risk</span>
                            <small className="cell-detail">
                              {leave.riskNotes || 'No scheduling conflict'}
                              {leave.coverageName ? ` · Suggested coverage: ${leave.coverageName}` : ''}
                            </small>
                          </td>
                          <td>
                            <span className={`status-pill status-${leave.status.toLowerCase()}`}>{leave.status}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: Time Tracking */}
          {activeTab === 'time' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <section className="data-grid data-grid-three">
                <article className="glass-panel data-card">
                  <span><Clock size={16} /> Total Hours Logged</span>
                  <strong>{totalHoursLogged.toFixed(1)}h</strong>
                  <small>Recorded across projects</small>
                </article>
                <article className="glass-panel data-card">
                  <span><TrendingUp size={16} /> Billable Hours</span>
                  <strong style={{ color: 'var(--accent-success)' }}>{billableHoursLogged.toFixed(1)}h</strong>
                  <small>{myUtilization}% billable delivery ratio</small>
                </article>
                <article className="glass-panel data-card">
                  <span><BriefcaseBusiness size={16} /> Projects Billed</span>
                  <strong>{new Set(timeEntries.map(t => t.leadId).filter(Boolean)).size}</strong>
                  <small>Active client accounts</small>
                </article>
              </section>

              <div className="glass-panel data-section">
                <div className="section-heading">
                  <h2>My Time Logs</h2>
                  <button className="btn btn-small btn-primary" onClick={() => setModal('time')}>
                    <Plus size={15} /> Log Hours
                  </button>
                </div>

                {timeEntries.length === 0 ? (
                  <p>No hours logged yet.</p>
                ) : (
                  <div className="table-scroll">
                    <table>
                      <thead>
                        <tr><th>Date</th><th>Project / Account</th><th>Hours</th><th>Type</th><th>Description</th><th>Action</th></tr>
                      </thead>
                      <tbody>
                        {timeEntries.map((entry) => (
                          <tr key={entry.id}>
                            <td>{new Date(entry.date).toLocaleDateString()}</td>
                            <td>{entry.lead?.name ? `${entry.lead.name} (${entry.lead.company})` : 'Internal / General'}</td>
                            <td><strong>{entry.hours}h</strong></td>
                            <td>
                              <span className={`status-pill ${entry.billable ? 'status-approved' : 'status-pending'}`}>
                                {entry.billable ? 'Billable' : 'Non-Billable'}
                              </span>
                            </td>
                            <td><span style={{ fontSize: '0.86rem' }}>{entry.description || '—'}</span></td>
                            <td>
                              <button className="icon-button danger-text" aria-label="Delete entry" onClick={() => void deleteTimeEntry(entry.id)}>
                                <Trash2 size={14} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: My 360° Appraisal Dossier */}
          {activeTab === 'dossier' && (
            <div className="glass-panel dossier-panel" style={{ padding: '2rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <span className="badge badge-info">Verified Performance Dossier</span>
                    <span className="badge badge-success">
                      {dossier?.rating.replace('_', ' ') || 'EXCEEDS EXPECTATIONS'}
                    </span>
                  </div>
                  <h2 style={{ fontSize: '1.8rem' }}>Client Impact & Growth Dossier</h2>
                  <p style={{ fontSize: '0.9rem' }}>Comprehensive performance appraisal grounded in real business output.</p>
                </div>

                <button
                  type="button"
                  onClick={() => window.print()}
                  className="btn btn-secondary"
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', padding: '8px 14px' }}
                >
                  <Printer size={15} /> Print Dossier
                </button>
              </div>

              {/* 4 Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1.75rem' }}>
                <div style={{ padding: '1rem', borderRadius: '10px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>Won Revenue</span>
                  <div className="metric-highlight">${dossier?.metrics.wonRevenue.toLocaleString() || '0'}</div>
                  <small style={{ color: 'var(--accent-success)' }}>{dossier?.metrics.wonDealsCount || 0} won accounts</small>
                </div>

                <div style={{ padding: '1rem', borderRadius: '10px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>Milestone Delivery</span>
                  <div className="metric-highlight">{dossier?.metrics.taskCompletionRate || 100}%</div>
                  <small>{dossier?.metrics.completedTasks} completed tasks</small>
                </div>

                <div style={{ padding: '1rem', borderRadius: '10px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>Client CSAT</span>
                  <div className="metric-highlight">{dossier?.metrics.avgClientCSAT || 5.0} / 5</div>
                  <small>Verified review ratings</small>
                </div>

                <div style={{ padding: '1rem', borderRadius: '10px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>Billable Project Hours</span>
                  <div className="metric-highlight">{dossier?.metrics.billableHours.toFixed(1) || '0.0'}h</div>
                  <small>Direct client time</small>
                </div>
              </div>

              {/* Verified Achievements */}
              <div style={{ marginBottom: '1.5rem' }}>
                <h3 style={{ fontSize: '1.1rem', marginBottom: '0.75rem' }}>Verified Achievements & Business Outcomes</h3>
                <ul style={{ paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.9rem' }}>
                  {dossier?.achievements.map((ach, idx) => (
                    <li key={idx}>{ach}</li>
                  ))}
                </ul>
              </div>

              {/* Client Testimonials */}
              {dossier?.feedbacks && dossier.feedbacks.length > 0 && (
                <div>
                  <h3 style={{ fontSize: '1.1rem', marginBottom: '0.75rem' }}>Direct Client Feedback & Reviews</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {dossier.feedbacks.map((f) => (
                      <div key={f.id} style={{ padding: '10px 14px', borderRadius: '8px', background: 'rgba(0,0,0,0.02)', border: '1px solid var(--border-color)', fontStyle: 'italic', fontSize: '0.88rem' }}>
                        &quot;{f.feedback}&quot; — <strong style={{ fontStyle: 'normal' }}>{f.clientName} ({f.company})</strong>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 5: Pulse & Wellbeing */}
          {activeTab === 'pulse' && (
            <div className="glass-panel data-section">
              <div className="section-heading">
                <h2>My Wellbeing & Pulse History</h2>
                <button className="btn btn-small btn-primary" onClick={() => setModal('pulse')}>
                  <Plus size={15} /> Log Pulse Check
                </button>
              </div>

              {pulse.length === 0 ? (
                <p>No pulse checks recorded yet.</p>
              ) : (
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr><th>Date</th><th>Score</th><th>Workload Risk</th><th>Feedback / Context</th></tr>
                    </thead>
                    <tbody>
                      {pulse.map((item) => (
                        <tr key={item.id}>
                          <td>{new Date(item.createdAt).toLocaleDateString()}</td>
                          <td><strong>{item.score} / 5 ★</strong></td>
                          <td>
                            <span className={`status-pill ${item.workloadRisk === 'BURNOUT' ? 'status-rejected' : item.workloadRisk === 'HIGH' ? 'status-pending' : 'status-approved'}`}>
                              {item.workloadRisk}
                            </span>
                          </td>
                          <td><span style={{ fontSize: '0.86rem' }}>{item.feedback || '—'}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </main>

    {/* MODAL 1: Request Leave */}
    {modal === 'leave' && (
      <div className="modal-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) setModal(null); }}>
        <section className="glass-panel modal-panel" role="dialog" aria-modal="true" aria-labelledby="leave-modal-title">
          <div className="modal-heading">
            <h2 id="leave-modal-title">Request Leave</h2>
            <button className="icon-button" aria-label="Close" onClick={() => setModal(null)}>×</button>
          </div>
          <form className="form-stack" onSubmit={submitLeave}>
            <label>Leave Type
              <select name="type" required>
                <option>Annual Vacation</option>
                <option>Medical Leave</option>
                <option>Personal Leave</option>
                <option>Family Leave</option>
              </select>
            </label>
            <div className="form-row">
              <label>From<input name="fromDate" type="date" required /></label>
              <label>To<input name="toDate" type="date" required /></label>
            </div>
            <label>Reason
              <textarea name="reason" required rows={3} maxLength={1000} placeholder="Brief context for manager..." />
            </label>
            <button className="btn btn-primary" type="submit">Submit Request</button>
          </form>
        </section>
      </div>
    )}

    {/* MODAL 2: Log Pulse Check */}
    {modal === 'pulse' && (
      <div className="modal-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) setModal(null); }}>
        <section className="glass-panel modal-panel" role="dialog" aria-modal="true" aria-labelledby="pulse-modal-title">
          <div className="modal-heading">
            <h2 id="pulse-modal-title">Log Pulse Check</h2>
            <button className="icon-button" aria-label="Close" onClick={() => setModal(null)}>×</button>
          </div>
          <form className="form-stack" onSubmit={submitPulse}>
            <label>How are you feeling today? (Score 1 to 5)
              <select name="score" required defaultValue="4">
                <option value="5">5 — Thriving</option>
                <option value="4">4 — Good</option>
                <option value="3">3 — Neutral / Manageable</option>
                <option value="2">2 — Stretched / High Stress</option>
                <option value="1">1 — Burning Out</option>
              </select>
            </label>
            <label>Current Workload Pressure
              <select name="workloadRisk" defaultValue="MANAGEABLE">
                <option value="LIGHT">Light Capacity</option>
                <option value="MANAGEABLE">Manageable</option>
                <option value="HIGH">High Pressure</option>
                <option value="BURNOUT">Burnout Risk</option>
              </select>
            </label>
            <label>Context or Feedback
              <textarea name="feedback" rows={3} maxLength={1000} placeholder="Anything you would like leadership or your manager to know?" />
            </label>
            <button className="btn btn-primary" type="submit">Save Pulse Check</button>
          </form>
        </section>
      </div>
    )}

    {/* MODAL 3: Log Project Time */}
    {modal === 'time' && (
      <div className="modal-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) setModal(null); }}>
        <section className="glass-panel modal-panel" role="dialog" aria-modal="true" aria-labelledby="time-modal-title">
          <div className="modal-heading">
            <h2 id="time-modal-title">Log Project Time</h2>
            <button className="icon-button" aria-label="Close" onClick={() => setModal(null)}>×</button>
          </div>
          <form className="form-stack" onSubmit={submitTimeEntry}>
            <div className="form-row">
              <label>Project / Account
                <select name="leadId" defaultValue="">
                  <option value="">General Project / Internal</option>
                  {leads.map((l) => (
                    <option key={l.id} value={l.id}>{l.name} ({l.company})</option>
                  ))}
                </select>
              </label>
              <label>Hours Worked<input name="hours" type="number" min="0.25" max="24" step="0.25" required placeholder="e.g. 4.5" /></label>
            </div>
            <div className="form-row">
              <label>Date<input name="date" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} /></label>
              <label>Billing Classification
                <select name="billable" defaultValue="true">
                  <option value="true">Billable to Client</option>
                  <option value="false">Non-Billable (Internal / Overhead)</option>
                </select>
              </label>
            </div>
            <label>Work Summary / Description
              <textarea name="description" rows={2} required placeholder="Architecture design, cluster rollout, testing, etc..." />
            </label>
            <button className="btn btn-primary" type="submit">Save Time Log</button>
          </form>
        </section>
      </div>
    )}
  </>;
}

export default function EmployeeDashboard() {
  return <AuthGuard allowedRoles={['EMPLOYEE', 'EMPLOYER']}><EmployeeHub /></AuthGuard>;
}
