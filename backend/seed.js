const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const prisma = new PrismaClient();

async function main() {
  console.log('Seeding CoreConnect Unified Database...');

  // Clean existing tables in reverse dependency order
  await prisma.timeEntry.deleteMany();
  await prisma.clientFeedback.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.task.deleteMany();
  await prisma.pulseCheck.deleteMany();
  await prisma.leaveRequest.deleteMany();
  await prisma.lead.deleteMany();
  await prisma.user.deleteMany();

  // 1. Create Core Personas with Technical & Domain Skills
  const admin = await prisma.user.create({
    data: {
      email: 'admin@company.com',
      password: await bcrypt.hash('adminpass', 12),
      name: 'Admin Boss',
      role: 'EMPLOYER',
      department: 'Management',
      position: 'VP of Operations',
      salary: 160000,
      skills: 'Executive Leadership, Resource Allocation, Financial Forecasting, Team Health'
    }
  });

  const john = await prisma.user.create({
    data: {
      email: 'john@company.com',
      password: await bcrypt.hash('pass123', 12),
      name: 'John Doe',
      role: 'EMPLOYEE',
      department: 'Engineering',
      position: 'Senior Systems Architect & Delivery Lead',
      salary: 125000,
      skills: 'AWS, Cloud Migration, Distributed Systems, Redis, Kafka, Systems Architecture'
    }
  });

  const sarah = await prisma.user.create({
    data: {
      email: 'sarah@company.com',
      password: await bcrypt.hash('pass123', 12),
      name: 'Sarah Connor',
      role: 'EMPLOYEE',
      department: 'Engineering',
      position: 'Tech Lead & Solutions Architect',
      salary: 130000,
      skills: 'Kubernetes, SOC2 Compliance, Microservices, Python, AI Agent Infrastructure, Docker'
    }
  });

  const alex = await prisma.user.create({
    data: {
      email: 'alex@company.com',
      password: await bcrypt.hash('pass123', 12),
      name: 'Alex Rivera',
      role: 'EMPLOYEE',
      department: 'Sales',
      position: 'Enterprise Client Director',
      salary: 110000,
      skills: 'Enterprise Sales, Client Relations, Deal Negotiation, Contract Closing, B2B SaaS'
    }
  });

  console.log('Seeded Users: Admin, John, Sarah, Alex');

  // 2. Create CRM Leads with close dates & values
  const now = new Date();
  const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const nextTwoWeeks = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
  const nextMonth = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  const lead1 = await prisma.lead.create({
    data: {
      name: 'Enterprise Cloud Migration',
      company: 'Acme Global Corp',
      email: 'vp.tech@acmeglobal.com',
      status: 'PROPOSAL',
      value: 75000,
      priority: 'HIGH',
      expectedCloseDate: nextWeek,
      notes: 'Final RFP defense scheduled. Critical milestone for AWS and cloud migration.',
      assigneeId: john.id
    }
  });

  const lead2 = await prisma.lead.create({
    data: {
      name: 'Realtime Data Pipeline Expansion',
      company: 'FinTech Nexus',
      email: 'cto@fintechnexus.io',
      status: 'QUALIFIED',
      value: 120000,
      priority: 'URGENT',
      expectedCloseDate: nextTwoWeeks,
      notes: 'Requiring senior architectural validation and SOC2 compliance sign-off.',
      assigneeId: john.id
    }
  });

  const lead3 = await prisma.lead.create({
    data: {
      name: 'AI Agent Helpdesk Integration',
      company: 'Globex Logistics',
      email: 'procurement@globex.com',
      status: 'CONTACTED',
      value: 45000,
      priority: 'MEDIUM',
      expectedCloseDate: nextMonth,
      notes: 'Demo requested for automated logistics routing agent.',
      assigneeId: alex.id
    }
  });

  const lead4 = await prisma.lead.create({
    data: {
      name: 'Multi-Region Kubernetes Setup',
      company: 'Cyberdyne Systems',
      email: 'engineering@cyberdyne.com',
      status: 'WON',
      value: 150000,
      priority: 'HIGH',
      expectedCloseDate: now,
      notes: 'Contract signed. Multi-region Kubernetes deployment running smoothly with 99.99% SLA.',
      assigneeId: sarah.id
    }
  });

  const lead5 = await prisma.lead.create({
    data: {
      name: 'Legacy Microservice Refactor',
      company: 'Initech Financial',
      email: 'it@initech.com',
      status: 'NEW',
      value: 35000,
      priority: 'LOW',
      expectedCloseDate: nextMonth,
      notes: 'Incoming lead from contact form requesting Python microservice refactoring.',
      assigneeId: null // Unassigned so the matchmaker can be tested immediately!
    }
  });

  console.log('Seeded CRM Leads');

  // 3. Create HR Leave Requests with Conflict Intelligence
  await prisma.leaveRequest.create({
    data: {
      type: 'Annual Leave',
      fromDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
      toDate: new Date(Date.now() + 12 * 24 * 60 * 60 * 1000),
      reason: 'Family summer vacation abroad',
      status: 'PENDING',
      riskScore: 'HIGH',
      riskNotes: '2 active deals close during this leave (combined value $195,000). 1 open task is due during this leave. recent workload check-in is burnout.',
      coverageUserId: sarah.id,
      userId: john.id
    }
  });

  await prisma.leaveRequest.create({
    data: {
      type: 'Medical Leave',
      fromDate: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000),
      toDate: new Date(Date.now() + 22 * 24 * 60 * 60 * 1000),
      reason: 'Routine outpatient recovery',
      status: 'APPROVED',
      riskScore: 'LOW',
      riskNotes: 'No deal or task deadlines overlap these dates.',
      coverageUserId: john.id,
      userId: sarah.id
    }
  });

  console.log('Seeded Leave Requests');

  // 4. Create Pulse Checks
  await prisma.pulseCheck.create({
    data: {
      score: 2,
      workloadRisk: 'BURNOUT',
      feedback: 'Handling both architecture for FinTech and client RFP for Acme concurrently. Feel stretched thin this month.',
      type: 'EMPLOYEE',
      userId: john.id
    }
  });

  await prisma.pulseCheck.create({
    data: {
      score: 5,
      workloadRisk: 'MANAGEABLE',
      feedback: 'Cyberdyne deal closure went smoothly. Great team alignment and clear client expectations.',
      type: 'EMPLOYEE',
      userId: sarah.id
    }
  });

  await prisma.pulseCheck.create({
    data: {
      score: 4,
      workloadRisk: 'LIGHT',
      feedback: 'Good pipeline momentum. Preparing Globex demo.',
      type: 'EMPLOYEE',
      userId: alex.id
    }
  });

  console.log('Seeded Pulse Checks');

  // 5. Create Client-Linked Tasks
  await prisma.task.create({
    data: {
      title: 'Finalize Architecture Defense Deck',
      description: 'Prepare latency benchmarks and disaster recovery specs for RFP defense.',
      clientName: 'Acme Global Corp',
      priority: 'HIGH',
      status: 'IN_PROGRESS',
      dueDate: nextWeek,
      assigneeId: john.id
    }
  });

  await prisma.task.create({
    data: {
      title: 'Security Compliance Sign-off (SOC2)',
      description: 'Review FinTech cloud encryption standards with InfoSec.',
      clientName: 'FinTech Nexus',
      priority: 'URGENT',
      status: 'TODO',
      dueDate: nextTwoWeeks,
      assigneeId: john.id
    }
  });

  await prisma.task.create({
    data: {
      title: 'Post-Deployment Health Audit',
      description: 'Verify 99.99% SLA metrics on production cluster.',
      clientName: 'Cyberdyne Systems',
      priority: 'MEDIUM',
      status: 'DONE',
      dueDate: now,
      assigneeId: sarah.id
    }
  });

  // 6. Create Client Feedback & CSAT / NPS
  await prisma.clientFeedback.create({
    data: {
      leadId: lead4.id,
      clientName: 'Dr. Miles Bennett',
      company: 'Cyberdyne Systems',
      score: 5,
      npsCategory: 'PROMOTER',
      category: 'Delivery',
      feedback: 'Sarah delivered our multi-region Kubernetes cluster ahead of schedule with 99.99% verified uptime. Outstanding technical rigor.'
    }
  });

  await prisma.clientFeedback.create({
    data: {
      leadId: lead1.id,
      clientName: 'Evelyn Reed',
      company: 'Acme Global Corp',
      score: 4,
      npsCategory: 'PROMOTER',
      category: 'Technical Quality',
      feedback: 'Architecture presentation was thorough. Looking forward to completing the RFP defense.'
    }
  });

  await prisma.clientFeedback.create({
    data: {
      leadId: lead3.id,
      clientName: 'Marcus Vance',
      company: 'Globex Logistics',
      score: 4,
      npsCategory: 'PASSIVE',
      category: 'Communication',
      feedback: 'Sales demo was well structured. Clarifying API security requirements with Alex.'
    }
  });

  console.log('Seeded Client Feedback');

  // 7. Create Time Tracking Entries
  await prisma.timeEntry.create({
    data: {
      userId: john.id,
      leadId: lead1.id,
      hours: 18.5,
      description: 'Architecting caching module & RFP defense latency benchmarks',
      billable: true,
      date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
    }
  });

  await prisma.timeEntry.create({
    data: {
      userId: john.id,
      leadId: lead2.id,
      hours: 14.0,
      description: 'FinTech Nexus real-time data streaming schema design',
      billable: true,
      date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000)
    }
  });

  await prisma.timeEntry.create({
    data: {
      userId: sarah.id,
      leadId: lead4.id,
      hours: 32.0,
      description: 'Multi-region Kubernetes deployment and SLA health validation',
      billable: true,
      date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
    }
  });

  await prisma.timeEntry.create({
    data: {
      userId: sarah.id,
      leadId: null,
      hours: 6.0,
      description: 'Internal infrastructure & CI/CD pipeline optimization',
      billable: false,
      date: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000)
    }
  });

  await prisma.timeEntry.create({
    data: {
      userId: alex.id,
      leadId: lead3.id,
      hours: 15.0,
      description: 'Globex Logistics contract discovery and routing agent proposal',
      billable: true,
      date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
    }
  });

  console.log('Seeded Time Tracking Entries');

  // 8. Create In-App Notifications
  await prisma.notification.create({
    data: {
      userId: admin.id,
      title: '🚨 High Conflict Leave Request',
      message: 'John Doe submitted leave overlapping with $195,000 in closing deals (Acme Corp & FinTech Nexus). Peer coverage suggested: Sarah Connor.',
      type: 'LEAVE',
      read: false
    }
  });

  await prisma.notification.create({
    data: {
      userId: admin.id,
      title: '⚠️ Team Wellbeing Alert',
      message: 'John Doe logged a pulse check with self-reported BURNOUT workload.',
      type: 'BURNOUT',
      read: false
    }
  });

  await prisma.notification.create({
    data: {
      userId: admin.id,
      title: '🎉 Enterprise Deal Won!',
      message: 'Cyberdyne Systems Multi-Region Kubernetes ($150,000) was marked WON by Sarah Connor.',
      type: 'LEAD',
      read: true
    }
  });

  await prisma.notification.create({
    data: {
      userId: john.id,
      title: '📋 New Deliverable Assigned',
      message: 'You were assigned "Security Compliance Sign-off (SOC2)" for FinTech Nexus.',
      type: 'TASK',
      read: false
    }
  });

  await prisma.notification.create({
    data: {
      userId: sarah.id,
      title: '⭐ New Client CSAT Review',
      message: 'Dr. Miles Bennett from Cyberdyne Systems gave a 5/5 CSAT rating for your multi-region deployment.',
      type: 'ALERT',
      read: false
    }
  });

  console.log('Seeded Notifications');

  // 9. Initial Audit Logs
  await prisma.auditLog.create({
    data: {
      actorId: admin.id,
      action: 'CREATE',
      entity: 'LEAD',
      entityId: lead4.id,
      summary: 'System initialized with demo dataset across HR and CRM domains.'
    }
  });

  console.log('Seeding finished successfully!');
}

main()
  .catch((e) => {
    console.error('Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
