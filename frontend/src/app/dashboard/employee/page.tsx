"use client";

import AuthGuard from '../../../components/AuthGuard';
import Navbar from '../../../components/Navbar';
import { Target, Calendar, Award, ArrowUpRight } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

const leaveData = [
  { month: 'Jul', crmDemand: 80 },
  { month: 'Aug', crmDemand: 40 },
  { month: 'Sep', crmDemand: 90 },
  { month: 'Oct', crmDemand: 60 },
  { month: 'Nov', crmDemand: 30 },
  { month: 'Dec', crmDemand: 85 },
];

export default function EmployeeDashboard() {
  return (
    <AuthGuard allowedRoles={['EMPLOYEE', 'EMPLOYER']}>
      <Navbar />
      <main style={{ padding: '0 2rem 2rem 2rem', maxWidth: '1400px', margin: '0 auto' }} className="animate-fade-in">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <div>
            <h1>My Hub</h1>
            <span style={{ color: 'var(--text-secondary)', display: 'block', marginTop: '4px' }}>Synced with Live CRM Data</span>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '2rem', marginBottom: '2rem' }}>
          
          {/* Client Impact Tracker */}
          <div className="glass-panel" style={{ padding: '1.5rem' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1.5rem' }}>
              <Target size={24} color="var(--accent-primary)" /> Client Impact Tracker
            </h3>
            <div style={{ background: 'linear-gradient(135deg, rgba(79, 70, 229, 0.05), rgba(6, 182, 212, 0.05))', padding: '1.5rem', borderRadius: '12px', border: '1px solid rgba(79, 70, 229, 0.1)' }}>
              <h4 style={{ margin: '0 0 10px 0', fontSize: '1.1rem' }}>Acme Corp - Q3 Deliverables</h4>
              <p style={{ margin: '0 0 15px 0', fontSize: '0.95rem', color: 'var(--text-secondary)' }}>&quot;Your deployed caching module reduced client API latency by 40%.&quot;</p>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <div style={{ flex: 1, background: 'var(--bg-secondary)', padding: '10px', borderRadius: '8px', textAlign: 'center', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)' }}>
                  <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--accent-success)' }}>-40%</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Latency</div>
                </div>
                <div style={{ flex: 1, background: 'var(--bg-secondary)', padding: '10px', borderRadius: '8px', textAlign: 'center', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)' }}>
                  <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--accent-primary)' }}>99.9%</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Uptime</div>
                </div>
              </div>
            </div>
          </div>

          {/* Career & Skill Mapping */}
          <div className="glass-panel" style={{ padding: '1.5rem' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1.5rem' }}>
              <Award size={24} color="var(--accent-warning)" /> Career & Skill Roadmap
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ fontWeight: 600 }}>AWS Certified Solutions Architect</span>
                  <span style={{ color: 'var(--accent-warning)', fontWeight: 'bold' }}>75%</span>
                </div>
                <div style={{ width: '100%', height: '8px', background: 'rgba(0,0,0,0.05)', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ width: '75%', height: '100%', background: 'var(--accent-warning)', transition: 'width 1s ease-in-out' }}></div>
                </div>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <ArrowUpRight size={14} color="var(--accent-warning)" /> High demand in upcoming pipeline (Q4)
                </p>
              </div>
              
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ fontWeight: 600 }}>GraphQL Microservices</span>
                  <span style={{ color: 'var(--accent-primary)', fontWeight: 'bold' }}>40%</span>
                </div>
                <div style={{ width: '100%', height: '8px', background: 'rgba(0,0,0,0.05)', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ width: '40%', height: '100%', background: 'var(--accent-primary)', transition: 'width 1s ease-in-out' }}></div>
                </div>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <ArrowUpRight size={14} color="var(--accent-primary)" /> Required for Globex project
                </p>
              </div>
            </div>
          </div>

          {/* Smart Leave & Capacity Engine */}
          <div className="glass-panel" style={{ padding: '1.5rem', gridColumn: '1 / -1' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1.5rem' }}>
              <Calendar size={24} color="var(--accent-secondary)" /> Smart Leave & Capacity Engine
            </h3>
            <p style={{ marginBottom: '1.5rem', color: 'var(--text-secondary)' }}>Based on CRM demand forecasts, <strong style={{color:'var(--text-primary)'}}>August</strong> and <strong style={{color:'var(--text-primary)'}}>November</strong> are optimal months for extended PTO.</p>
            <div style={{ height: '300px', width: '100%' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={leaveData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" vertical={false} />
                  <XAxis dataKey="month" stroke="var(--text-secondary)" />
                  <YAxis stroke="var(--text-secondary)" />
                  <Tooltip cursor={{ fill: 'rgba(0,0,0,0.02)' }} contentStyle={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'var(--text-primary)' }} />
                  <Bar dataKey="crmDemand" fill="var(--accent-secondary)" radius={[6, 6, 0, 0]} name="CRM Pipeline Demand (%)" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

        </div>
      </main>
    </AuthGuard>
  );
}
