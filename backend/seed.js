const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const prisma = new PrismaClient();

async function main() {
  console.log('Seeding CoreConnect Unified Database...');

  // Clean existing tables in reverse dependency order
  await prisma.task.deleteMany();
  await prisma.pulseCheck.deleteMany();
  await prisma.leaveRequest.deleteMany();
  await prisma.lead.deleteMany();
  await prisma.user.deleteMany();

  // 1. Create Core Personas
  const admin = await prisma.user.create({
    data: {
      email: 'admin@company.com',
      password: await bcrypt.hash('adminpass', 12),
      name: 'Admin Boss',
      role: 'EMPLOYER',
      department: 'Management',
      position: 'VP of Operations',
      salary: 160000
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
      salary: 125000
    }
  });

  const sarah = await prisma.user.create({
    data: {
      email: 'sarah@company.com',
      password: 'pass123',
      name: 'Sarah Connor',
      role: 'EMPLOYEE',
      department: 'Engineering',
      position: 'Tech Lead & Solutions Architect',
      salary: 130000
    }
  });

  const alex = await prisma.user.create({
    data: {
      email: 'alex@company.com',
      password: 'pass123',
      name: 'Alex Rivera',
      role: 'EMPLOYEE',
      department: 'Sales',
      position: 'Enterprise Client Director',
      salary: 110000
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
      notes: 'Final RFP defense scheduled. Critical milestone for Q4.',
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
      notes: 'Requiring senior architectural validation and security sign-off.',
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
      notes: 'Demo requested for logistics routing agent.',
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
      notes: 'Contract signed. Deployment running smoothly with 99.99% SLA.',
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
      notes: 'Incoming lead from website contact form.',
      assigneeId: sarah.id
    }
  });

  console.log('Seeded CRM Leads');

  // 3. Create HR Leave Requests (Demonstrating HR-CRM conflict detection)
  // John's leave request collides right with Acme Corp ($75k) and FinTech ($120k) close dates!
  await prisma.leaveRequest.create({
    data: {
      type: 'Annual Leave',
      fromDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
      toDate: new Date(Date.now() + 12 * 24 * 60 * 60 * 1000),
      reason: 'Family summer vacation abroad',
      status: 'PENDING',
      riskScore: 'HIGH',
      riskNotes: 'CRITICAL CONFLICT: Overlaps with 2 high-priority deals (Acme Corp $75k, FinTech Nexus $120k) totaling $195,000 at risk during this period.',
      coverageUserId: sarah.id,
      userId: john.id
    }
  });

  // Sarah's upcoming medical leave with low conflict
  await prisma.leaveRequest.create({
    data: {
      type: 'Medical Leave',
      fromDate: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000),
      toDate: new Date(Date.now() + 22 * 24 * 60 * 60 * 1000),
      reason: 'Routine outpatient recovery',
      status: 'APPROVED',
      riskScore: 'LOW',
      riskNotes: 'Minimal client impact. Cyberdyne contract already WON, no deals closing.',
      coverageUserId: john.id,
      userId: sarah.id
    }
  });

  console.log('Seeded Leave Requests with Conflict Intelligence');

  // 4. Create Pulse Checks (Sentiment & Burnout tracking)
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
