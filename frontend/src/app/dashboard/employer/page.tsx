"use client";

import AuthGuard from '../../../components/AuthGuard';
import Navbar from '../../../components/Navbar';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { Users, AlertTriangle, TrendingUp, CheckCircle } from 'lucide-react';

const burnoutData = [
  { name: 'Engineering', risk: 85, velocity: 120 },
  { name: 'Design', risk: 40, velocity: 85 },
  { name: 'Sales', risk: 65, velocity: 90 },
  { name: 'Marketing', risk: 30, velocity: 70 },
  { name: 'Product', risk: 75, velocity: 110 },
];

const allocationData = [
  { client: 'Acme Corp', project: 'Cloud Migration', required: 15, available: 12, status: 'Shortage' },
  { client: 'Globex', project: 'CRM Integration', required: 8, available: 10, status: 'Optimal' },
  { client: 'Initech', project: 'Mobile App', required: 5, available: 5, status: 'Optimal' },
];

const appraisalData = [
  { emp: 'Sarah Connor', clientFeedback: 4.8, velocityScore: 92, status: 'Promotion Ready' },
  { emp: 'John Smith', clientFeedback: 4.2, velocityScore: 78, status: 'On Track' },
  { emp: 'Jane Doe', clientFeedback: 3.5, velocityScore: 60, status: 'Needs Support' },
];

export default function EmployerDashboard() {
  return (
    <AuthGuard allowedRoles={['EMPLOYER']}>
      <Navbar />
      <main style={{ padding: '0 2rem 2rem 2rem', maxWidth: '1400px', margin: '0 auto' }} className="animate-fade-in">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <h1>Command Center</h1>
          <button className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <TrendingUp size={18} /> Generate Enterprise Report
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '2rem', marginBottom: '2rem' }}>
          
          {/* Predictive Burnout Heatmap */}
          <div className="glass-panel" style={{ padding: '1.5rem', gridColumn: '1 / -1' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1.5rem' }}>
              <AlertTriangle size={24} color="var(--accent-warning)" /> Predictive Burnout Heatmap
            </h3>
            <div style={{ height: '300px', width: '100%' }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={burnoutData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorRisk" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--accent-danger)" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="var(--accent-danger)" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="name" stroke="var(--text-secondary)" />
                  <YAxis stroke="var(--text-secondary)" />
                  <Tooltip contentStyle={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'var(--text-primary)' }} />
                  <Area type="monotone" dataKey="risk" stroke="var(--accent-danger)" fillOpacity={1} fill="url(#colorRisk)" name="Risk Score" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Dynamic Resource Allocation Matrix */}
          <div className="glass-panel" style={{ padding: '1.5rem' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1.5rem' }}>
              <Users size={24} color="var(--accent-primary)" /> Dynamic Resource Matrix
            </h3>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <th style={{ padding: '12px 0', color: 'var(--text-secondary)', fontWeight: 600 }}>Client Pipeline</th>
                    <th style={{ padding: '12px 0', color: 'var(--text-secondary)', fontWeight: 600 }}>Required</th>
                    <th style={{ padding: '12px 0', color: 'var(--text-secondary)', fontWeight: 600 }}>Available</th>
                    <th style={{ padding: '12px 0', color: 'var(--text-secondary)', fontWeight: 600 }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {allocationData.map((row, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <td style={{ padding: '12px 0' }}>
                        <div style={{ fontWeight: 600 }}>{row.project}</div>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{row.client}</div>
                      </td>
                      <td style={{ padding: '12px 0' }}>{row.required}</td>
                      <td style={{ padding: '12px 0' }}>{row.available}</td>
                      <td style={{ padding: '12px 0' }}>
                        <span style={{ 
                          padding: '4px 12px', borderRadius: '20px', fontSize: '0.85rem', fontWeight: 600,
                          background: row.status === 'Shortage' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                          color: row.status === 'Shortage' ? 'var(--accent-danger)' : 'var(--accent-success)'
                        }}>
                          {row.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Automated Appraisal Hub */}
          <div className="glass-panel" style={{ padding: '1.5rem' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1.5rem' }}>
              <CheckCircle size={24} color="var(--accent-secondary)" /> Automated Appraisal Hub
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {appraisalData.map((item, i) => (
                <div key={i} style={{ background: 'var(--bg-secondary)', padding: '1rem', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)' }}>
                  <div>
                    <h4 style={{ margin: '0 0 4px 0', fontSize: '1.1rem' }}>{item.emp}</h4>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Client Feedback: <strong style={{color:'var(--text-primary)'}}>{item.clientFeedback}</strong>/5.0</span>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 'bold', fontSize: '1.1rem', color: item.velocityScore > 80 ? 'var(--accent-success)' : (item.velocityScore < 70 ? 'var(--accent-warning)' : 'var(--text-primary)') }}>
                      Velocity: {item.velocityScore}
                    </div>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{item.status}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </AuthGuard>
  );
}
