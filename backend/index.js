require('dotenv').config();

const express = require('express');
const cors = require('cors');
const { PrismaClient } = require('@prisma/client');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET || (process.env.NODE_ENV === 'production' ? null : 'local-development-only-change-this-secret-before-deploying');
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
const COOKIE_NAME = 'coreconnect_session';
const COOKIE_SAMESITE = process.env.NODE_ENV === 'production' ? 'None' : 'Lax';
const COOKIE_OPTIONS = `Path=/; HttpOnly; SameSite=${COOKIE_SAMESITE}; Max-Age=604800${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`;

if (!JWT_SECRET) throw new Error('JWT_SECRET must be configured in production.');
if (process.env.NODE_ENV === 'production' && JWT_SECRET.length < 32) throw new Error('JWT_SECRET must contain at least 32 characters in production.');

app.use(helmet());
app.use(cors({ origin: FRONTEND_URL, credentials: true }));
app.use(express.json({ limit: '64kb' }));
app.use((req, res, next) => {
  if (req.headers.origin && req.headers.origin !== FRONTEND_URL) return res.status(403).json({ error: 'Origin is not allowed.' });
  return next();
});
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 200, message: { error: 'Too many requests. Please try again later.' } }));
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, standardHeaders: true, legacyHeaders: false, message: { error: 'Too many sign-in attempts. Please try again later.' } });

const asyncRoute = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
const cleanUser = ({ id, email, name, role, department, position, skills }) => ({ id, email, name, role, department, position, skills });
const isEmployer = (req) => req.user.role === 'EMPLOYER';
const invalid = (res, message) => res.status(400).json({ error: message });

function readCookie(req, name) {
  const header = req.headers.cookie || '';
  const pair = header.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${name}=`));
  if (!pair) return null;
  try { return decodeURIComponent(pair.slice(name.length + 1)); } catch { return null; }
}

function requireAuth(req, res, next) {
  const token = readCookie(req, COOKIE_NAME) || (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) return res.status(401).json({ error: 'Authentication required.' });
  try {
    req.user = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'], issuer: 'coreconnect' });
    return next();
  } catch {
    return res.status(401).json({ error: 'Session expired. Please sign in again.' });
  }
}

function requireEmployer(req, res, next) {
  if (!isEmployer(req)) return res.status(403).json({ error: 'Employer access required.' });
  return next();
}

async function recordAudit(req, action, entity, entityId, summary) {
  try {
    await prisma.auditLog.create({ data: { actorId: req.user.id, action, entity, entityId, summary } });
  } catch (error) {
    console.error('Audit write failed:', error.message);
  }
}

async function createNotification(userId, title, message, type = 'INFO', link = null) {
  try {
    await prisma.notification.create({ data: { userId, title, message, type, link } });
  } catch (error) {
    console.error('Notification write failed:', error.message);
  }
}

async function notifyEmployers(title, message, type = 'ALERT', link = null) {
  try {
    const employers = await prisma.user.findMany({ where: { role: 'EMPLOYER' }, select: { id: true } });
    await Promise.all(employers.map((e) => createNotification(e.id, title, message, type, link)));
  } catch (error) {
    console.error('Notify employers failed:', error.message);
  }
}

function dayStart(value) {
  const date = new Date(value);
  date.setUTCHours(0, 0, 0, 0);
  return date;
}

function dayEnd(value) {
  const date = new Date(value);
  date.setUTCHours(23, 59, 59, 999);
  return date;
}

async function assessLeaveImpact(userId, fromDate, toDate) {
  const from = dayStart(fromDate);
  const to = dayEnd(toDate);
  const recentSince = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const [deals, dueTasks, recentPulse, employees, requester, openLeads, openTasks, overlappingLeaves] = await Promise.all([
    prisma.lead.findMany({ where: { assigneeId: userId, status: { notIn: ['WON', 'LOST'] }, expectedCloseDate: { gte: from, lte: to } }, select: { name: true, company: true, value: true, priority: true, expectedCloseDate: true } }),
    prisma.task.findMany({ where: { assigneeId: userId, status: { not: 'DONE' }, dueDate: { gte: from, lte: to } }, select: { title: true, priority: true, dueDate: true } }),
    prisma.pulseCheck.findFirst({ where: { userId, createdAt: { gte: recentSince } }, orderBy: { createdAt: 'desc' }, select: { workloadRisk: true, score: true } }),
    prisma.user.findMany({ where: { role: 'EMPLOYEE', id: { not: userId } }, select: { id: true, name: true, department: true } }),
    prisma.user.findUnique({ where: { id: userId }, select: { department: true } }),
    prisma.lead.findMany({ where: { assigneeId: { not: null }, status: { notIn: ['WON', 'LOST'] } }, select: { assigneeId: true, priority: true, value: true } }),
    prisma.task.findMany({ where: { status: { not: 'DONE' } }, select: { assigneeId: true, priority: true } }),
    prisma.leaveRequest.findMany({ where: { status: { in: ['PENDING', 'APPROVED'] }, fromDate: { lte: to }, toDate: { gte: from } }, select: { userId: true } }),
  ]);

  const activeDealValue = deals.reduce((sum, deal) => sum + (deal.value || 0), 0);
  const urgentDealCount = deals.filter((deal) => ['HIGH', 'URGENT'].includes(deal.priority)).length;
  const hasBurnoutSignal = recentPulse && ['HIGH', 'BURNOUT'].includes(recentPulse.workloadRisk);
  const impactScore = deals.length * 2 + dueTasks.length + urgentDealCount * 2 + (activeDealValue >= 100000 ? 3 : activeDealValue >= 50000 ? 1 : 0) + (hasBurnoutSignal ? 2 : 0);

  const notes = [];
  if (deals.length) {
    const total = Math.round(activeDealValue);
    notes.push(`${deals.length} active deal${deals.length === 1 ? '' : 's'} close during this leave${total ? ` (combined value $${total.toLocaleString('en-US')})` : ''}`);
  }
  if (dueTasks.length) notes.push(`${dueTasks.length} open task${dueTasks.length === 1 ? '' : 's'} are due during this leave`);
  if (hasBurnoutSignal) notes.push(`recent workload check-in is ${recentPulse.workloadRisk.toLowerCase()}`);
  if (!notes.length) notes.push('No deal or task deadlines overlap these dates');

  const unavailable = new Set(overlappingLeaves.map((leave) => leave.userId));
  const activeLoad = new Map();
  for (const lead of openLeads) {
    const id = lead.assigneeId;
    if (id) activeLoad.set(id, (activeLoad.get(id) || 0) + (lead.priority === 'URGENT' ? 3 : lead.priority === 'HIGH' ? 2 : 1));
  }
  for (const task of openTasks) activeLoad.set(task.assigneeId, (activeLoad.get(task.assigneeId) || 0) + (task.priority === 'URGENT' ? 3 : task.priority === 'HIGH' ? 2 : 1));
  const availableEmployees = employees.filter((employee) => !unavailable.has(employee.id));
  const peersInDepartment = availableEmployees.filter((employee) => employee.department && employee.department === requester?.department);
  const candidates = peersInDepartment.length ? peersInDepartment : availableEmployees;
  candidates.sort((left, right) => (activeLoad.get(left.id) || 0) - (activeLoad.get(right.id) || 0) || left.name.localeCompare(right.name));
  const coverageGap = candidates.length === 0;
  if (coverageGap) notes.push('No teammate is available for coverage during these dates');
  const riskScore = coverageGap || impactScore >= 6 ? 'HIGH' : impactScore > 0 ? 'MEDIUM' : 'LOW';

  return { riskScore, riskNotes: notes.join('. '), coverageUserId: candidates[0]?.id || null };
}

app.get('/api/health', (_req, res) => res.json({ status: 'ok', message: 'Unified HR/CRM Backend is running' }));

// --- Authentication ---

app.post('/api/auth/login', loginLimiter, asyncRoute(async (req, res) => {
  const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const password = typeof req.body.password === 'string' ? req.body.password : '';
  const role = req.body.role;
  if (!email || !password || !['EMPLOYEE', 'EMPLOYER'].includes(role)) return invalid(res, 'Email, password and role are required.');

  const user = await prisma.user.findUnique({ where: { email } });
  const passwordIsBcrypt = user?.password.startsWith('$2');
  const validPassword = user && (passwordIsBcrypt
    ? await bcrypt.compare(password, user.password)
    : user.password === password);
  if (!validPassword || user.role !== role) return res.status(401).json({ error: 'Invalid email, password or role.' });

  if (!passwordIsBcrypt) {
    await prisma.user.update({ where: { id: user.id }, data: { password: await bcrypt.hash(password, 12) } });
  }
  const safeUser = cleanUser(user);
  const token = jwt.sign(safeUser, JWT_SECRET, { expiresIn: '7d', issuer: 'coreconnect' });
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=${encodeURIComponent(token)}; ${COOKIE_OPTIONS}`);
  res.json({ user: safeUser });
}));

app.post('/api/auth/logout', (_req, res) => {
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=${COOKIE_SAMESITE}; Max-Age=0${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`);
  res.status(204).end();
});

app.get('/api/auth/me', requireAuth, asyncRoute(async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  if (!user) return res.status(401).json({ error: 'Account no longer exists.' });
  res.json({ user: cleanUser(user) });
}));

// --- Audit & Users ---

app.get('/api/audit', requireAuth, requireEmployer, asyncRoute(async (req, res) => {
  const parsedLimit = Number.parseInt(req.query.limit, 10);
  const limit = Number.isInteger(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), 100) : 25;
  const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : undefined;
  const entries = await prisma.auditLog.findMany({
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    include: { actor: { select: { id: true, name: true, role: true } } },
  });
  const hasMore = entries.length > limit;
  const page = hasMore ? entries.slice(0, limit) : entries;
  res.json({ items: page, nextCursor: hasMore ? page[page.length - 1].id : null });
}));

app.get('/api/users', requireAuth, requireEmployer, asyncRoute(async (_req, res) => {
  const users = await prisma.user.findMany({ select: { id: true, name: true, email: true, role: true, department: true, position: true, skills: true }, orderBy: { name: 'asc' } });
  res.json(users);
}));

// --- Leave Requests ---

app.get('/api/leaves', requireAuth, asyncRoute(async (req, res) => {
  const leaves = await prisma.leaveRequest.findMany({
    where: isEmployer(req) ? undefined : { userId: req.user.id },
    include: { user: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'desc' },
  });
  const coverageIds = [...new Set(leaves.map((leave) => leave.coverageUserId).filter(Boolean))];
  const coverPeople = coverageIds.length ? await prisma.user.findMany({ where: { id: { in: coverageIds } }, select: { id: true, name: true } }) : [];
  const names = new Map(coverPeople.map((person) => [person.id, person.name]));
  res.json(leaves.map((leave) => ({ ...leave, coverageName: leave.coverageUserId ? names.get(leave.coverageUserId) || null : null })));
}));

app.post('/api/leaves', requireAuth, asyncRoute(async (req, res) => {
  const { type, fromDate, toDate, reason } = req.body;
  const from = new Date(fromDate);
  const to = new Date(toDate);
  if (typeof type !== 'string' || !type.trim() || !reason?.trim() || !Number.isFinite(+from) || !Number.isFinite(+to) || from > to) return invalid(res, 'Provide a leave type, valid date range and reason.');
  const impact = await assessLeaveImpact(req.user.id, from, to);
  const leave = await prisma.leaveRequest.create({ data: { type: type.trim(), fromDate: from, toDate: to, reason: reason.trim(), ...impact, userId: req.user.id }, include: { user: { select: { id: true, name: true } } } });
  await recordAudit(req, 'CREATE', 'LEAVE', leave.id, `Leave request submitted for ${from.toLocaleDateString()} through ${to.toLocaleDateString()} (${impact.riskScore} schedule risk)`);
  
  // Notification: notify employers
  await notifyEmployers(
    impact.riskScore === 'HIGH' ? '🚨 High Risk Leave Collision' : '📅 New Leave Request',
    `${leave.user.name} requested leave from ${from.toLocaleDateString()} to ${to.toLocaleDateString()}. ${impact.riskNotes}`,
    impact.riskScore === 'HIGH' ? 'ALERT' : 'LEAVE'
  );

  res.status(201).json(leave);
}));

app.put('/api/leaves/:id', requireAuth, asyncRoute(async (req, res) => {
  const leave = await prisma.leaveRequest.findUnique({ where: { id: req.params.id } });
  if (!leave) return res.status(404).json({ error: 'Leave request not found.' });
  if (isEmployer(req)) {
    if (!['PENDING', 'APPROVED', 'REJECTED'].includes(req.body.status)) return invalid(res, 'Status must be PENDING, APPROVED or REJECTED.');
    const updated = await prisma.leaveRequest.update({ where: { id: leave.id }, data: { status: req.body.status }, include: { user: { select: { id: true, name: true } } } });
    await recordAudit(req, 'UPDATE', 'LEAVE', leave.id, `Leave request for ${updated.user.name} marked ${updated.status}`);
    
    // Notify employee of approval/rejection
    await createNotification(
      leave.userId,
      `Leave Request ${updated.status}`,
      `Your ${updated.type} for ${new Date(updated.fromDate).toLocaleDateString()} has been ${updated.status.toLowerCase()}.`,
      updated.status === 'APPROVED' ? 'SYSTEM' : 'ALERT'
    );

    return res.json(updated);
  }
  if (leave.userId !== req.user.id || leave.status !== 'PENDING') return res.status(403).json({ error: 'Only your pending requests can be edited.' });
  const { type, fromDate, toDate, reason } = req.body;
  const from = new Date(fromDate);
  const to = new Date(toDate);
  if (typeof type !== 'string' || !type.trim() || !reason?.trim() || !Number.isFinite(+from) || !Number.isFinite(+to) || from > to) return invalid(res, 'Provide a leave type, valid date range and reason.');
  const impact = await assessLeaveImpact(req.user.id, from, to);
  const updated = await prisma.leaveRequest.update({ where: { id: leave.id }, data: { type: type.trim(), fromDate: from, toDate: to, reason: reason.trim(), ...impact }, include: { user: { select: { id: true, name: true } } } });
  await recordAudit(req, 'UPDATE', 'LEAVE', leave.id, `Leave request updated (${impact.riskScore} schedule risk)`);
  res.json(updated);
}));

app.delete('/api/leaves/:id', requireAuth, asyncRoute(async (req, res) => {
  const leave = await prisma.leaveRequest.findUnique({ where: { id: req.params.id } });
  if (!leave) return res.status(404).json({ error: 'Leave request not found.' });
  if (!isEmployer(req) && (leave.userId !== req.user.id || leave.status !== 'PENDING')) return res.status(403).json({ error: 'Only your pending requests can be deleted.' });
  await prisma.leaveRequest.delete({ where: { id: leave.id } });
  await recordAudit(req, 'DELETE', 'LEAVE', leave.id, `Leave request deleted (${leave.status})`);
  res.status(204).end();
}));

// --- CRM Leads ---

app.get('/api/leads', requireAuth, asyncRoute(async (req, res) => {
  const leads = await prisma.lead.findMany({
    where: isEmployer(req) ? undefined : { assigneeId: req.user.id },
    include: { assignee: { select: { id: true, name: true, email: true, department: true } } },
    orderBy: { updatedAt: 'desc' },
  });
  res.json(leads);
}));

app.post('/api/leads', requireAuth, requireEmployer, asyncRoute(async (req, res) => {
  const { name, company, email, status, value, notes, assigneeId } = req.body;
  if (!name?.trim() || !company?.trim() || !email?.trim()) return invalid(res, 'Lead name, company and email are required.');
  if (value !== undefined && value !== '' && (!Number.isFinite(Number(value)) || Number(value) < 0)) return invalid(res, 'Lead value must be a non-negative number.');
  const allowedStatuses = ['NEW', 'CONTACTED', 'QUALIFIED', 'PROPOSAL', 'WON', 'LOST'];
  const allowedPriorities = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];
  const expectedCloseDate = req.body.expectedCloseDate ? new Date(req.body.expectedCloseDate) : null;
  if (!allowedStatuses.includes(status || 'NEW') || !allowedPriorities.includes(req.body.priority || 'MEDIUM') || (expectedCloseDate && !Number.isFinite(+expectedCloseDate))) return invalid(res, 'Lead status, priority or close date is invalid.');
  const lead = await prisma.lead.create({ data: { name: name.trim(), company: company.trim(), email: email.trim(), status: status || 'NEW', priority: req.body.priority || 'MEDIUM', expectedCloseDate, value: value === '' || value == null ? null : Number(value), notes: notes?.trim() || null, assigneeId: assigneeId || null }, include: { assignee: { select: { id: true, name: true } } } });
  await recordAudit(req, 'CREATE', 'LEAD', lead.id, `Lead created: ${lead.name} at ${lead.company}`);
  
  if (lead.assigneeId) {
    await createNotification(lead.assigneeId, '💼 New Deal Assigned', `You were assigned as lead owner for "${lead.name}" (${lead.company}).`, 'LEAD');
  }

  res.status(201).json(lead);
}));

app.put('/api/leads/:id', requireAuth, requireEmployer, asyncRoute(async (req, res) => {
  const allowedStatuses = ['NEW', 'CONTACTED', 'QUALIFIED', 'PROPOSAL', 'WON', 'LOST'];
  const allowedPriorities = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];
  const { name, company, email, status, value, notes, assigneeId } = req.body;
  const expectedCloseDate = req.body.expectedCloseDate ? new Date(req.body.expectedCloseDate) : null;
  if (!name?.trim() || !company?.trim() || !email?.trim() || !allowedStatuses.includes(status) || !allowedPriorities.includes(req.body.priority) || (expectedCloseDate && !Number.isFinite(+expectedCloseDate))) return invalid(res, 'Lead details, status, priority or close date are invalid.');
  if (value !== undefined && value !== '' && (!Number.isFinite(Number(value)) || Number(value) < 0)) return invalid(res, 'Lead value must be a non-negative number.');
  try {
    const existing = await prisma.lead.findUnique({ where: { id: req.params.id } });
    const updated = await prisma.lead.update({ where: { id: req.params.id }, data: { name: name.trim(), company: company.trim(), email: email.trim(), status, priority: req.body.priority, expectedCloseDate, value: value === '' || value == null ? null : Number(value), notes: notes?.trim() || null, assigneeId: assigneeId || null }, include: { assignee: { select: { id: true, name: true } } } });
    await recordAudit(req, 'UPDATE', 'LEAD', updated.id, `Lead updated: ${updated.name} moved to ${updated.status}`);
    
    // Notifications on stage change or assignment change
    if (updated.status === 'WON' && existing?.status !== 'WON') {
      const valStr = updated.value ? ` ($${updated.value.toLocaleString()})` : '';
      await notifyEmployers('🎉 Deal Closed Won!', `Deal "${updated.name}" at ${updated.company}${valStr} has been won!`, 'LEAD');
      if (updated.assigneeId) {
        await createNotification(updated.assigneeId, '🏆 Deal Won Celebration!', `Congratulations! Your deal "${updated.name}" has been marked WON!`, 'LEAD');
      }
    } else if (assigneeId && assigneeId !== existing?.assigneeId) {
      await createNotification(assigneeId, '🤝 Lead Reassigned', `You are now the account owner for "${updated.name}" (${updated.company}).`, 'LEAD');
    }

    res.json(updated);
  } catch (error) {
    if (error.code === 'P2025') return res.status(404).json({ error: 'Lead not found.' });
    throw error;
  }
}));

app.delete('/api/leads/:id', requireAuth, requireEmployer, asyncRoute(async (req, res) => {
  let deleted;
  try { deleted = await prisma.lead.delete({ where: { id: req.params.id } }); }
  catch (error) { if (error.code === 'P2025') return res.status(404).json({ error: 'Lead not found.' }); throw error; }
  await recordAudit(req, 'DELETE', 'LEAD', deleted.id, `Lead deleted: ${deleted.name} at ${deleted.company}`);
  res.status(204).end();
}));

// --- Pulse Check & Sentiment ---

app.get('/api/pulse', requireAuth, asyncRoute(async (req, res) => {
  const pulseChecks = await prisma.pulseCheck.findMany({
    where: isEmployer(req) ? undefined : { userId: req.user.id },
    include: { user: { select: { id: true, name: true, department: true } } },
    orderBy: { createdAt: 'desc' },
  });
  res.json(pulseChecks);
}));

app.post('/api/pulse', requireAuth, asyncRoute(async (req, res) => {
  const score = Number(req.body.score);
  if (!Number.isInteger(score) || score < 1 || score > 5) return invalid(res, 'Score must be an integer from 1 to 5.');
  const workloadRisk = req.body.workloadRisk || 'MANAGEABLE';
  if (!['LIGHT', 'MANAGEABLE', 'HIGH', 'BURNOUT'].includes(workloadRisk)) return invalid(res, 'Workload risk is invalid.');
  const pulse = await prisma.pulseCheck.create({ data: { score, workloadRisk, feedback: typeof req.body.feedback === 'string' ? req.body.feedback.trim() || null : null, type: 'EMPLOYEE', userId: req.user.id }, include: { user: { select: { id: true, name: true } } } });
  await recordAudit(req, 'CREATE', 'PULSE', pulse.id, `Pulse check recorded with score ${pulse.score} and ${pulse.workloadRisk.toLowerCase()} workload risk`);
  
  if (pulse.workloadRisk === 'BURNOUT' || pulse.score <= 2) {
    await notifyEmployers(
      '⚠️ Team Wellbeing Warning',
      `${pulse.user.name} logged a pulse rating of ${pulse.score}/5 with ${pulse.workloadRisk.toLowerCase()} workload risk.`,
      'BURNOUT'
    );
  }

  res.status(201).json(pulse);
}));

// --- Tasks / Deliverables ---

app.get('/api/tasks', requireAuth, asyncRoute(async (req, res) => {
  const tasks = await prisma.task.findMany({ where: isEmployer(req) ? undefined : { assigneeId: req.user.id }, include: { assignee: { select: { id: true, name: true } } }, orderBy: { createdAt: 'desc' } });
  res.json(tasks);
}));

app.post('/api/tasks', requireAuth, requireEmployer, asyncRoute(async (req, res) => {
  const { title, description, clientName, priority, status, dueDate, assigneeId } = req.body;
  if (!title?.trim() || !assigneeId) return invalid(res, 'Task title and assignee are required.');
  if (dueDate && !Number.isFinite(+new Date(dueDate))) return invalid(res, 'Due date is invalid.');
  if (!['TODO', 'IN_PROGRESS', 'DONE'].includes(status || 'TODO') || !['LOW', 'MEDIUM', 'HIGH', 'URGENT'].includes(priority || 'MEDIUM')) return invalid(res, 'Task status or priority is invalid.');
  const task = await prisma.task.create({ data: { title: title.trim(), description: description?.trim() || null, clientName: clientName?.trim() || null, priority: priority || 'MEDIUM', status: status || 'TODO', dueDate: dueDate ? new Date(dueDate) : null, assigneeId }, include: { assignee: { select: { id: true, name: true } } } });
  await recordAudit(req, 'CREATE', 'TASK', task.id, `Task assigned to ${task.assignee.name}: ${task.title}`);
  
  await createNotification(assigneeId, '📋 New Deliverable Assigned', `You were assigned: "${task.title}"${task.clientName ? ` for ${task.clientName}` : ''}.`, 'TASK');

  res.status(201).json(task);
}));

app.put('/api/tasks/:id', requireAuth, asyncRoute(async (req, res) => {
  const task = await prisma.task.findUnique({ where: { id: req.params.id } });
  if (!task) return res.status(404).json({ error: 'Task not found.' });
  if (!isEmployer(req) && task.assigneeId !== req.user.id) return res.status(403).json({ error: 'You can only update your own tasks.' });
  const allowedStatuses = ['TODO', 'IN_PROGRESS', 'DONE'];
  if (!allowedStatuses.includes(req.body.status)) return invalid(res, 'Status must be TODO, IN_PROGRESS or DONE.');
  if (isEmployer(req) && !['LOW', 'MEDIUM', 'HIGH', 'URGENT'].includes(req.body.priority || task.priority)) return invalid(res, 'Task priority is invalid.');
  if (isEmployer(req) && req.body.dueDate && !Number.isFinite(+new Date(req.body.dueDate))) return invalid(res, 'Due date is invalid.');
  const data = isEmployer(req)
    ? { title: req.body.title?.trim() || task.title, description: req.body.description === undefined ? task.description : req.body.description?.trim() || null, clientName: req.body.clientName === undefined ? task.clientName : req.body.clientName?.trim() || null, priority: req.body.priority || task.priority, status: req.body.status, dueDate: req.body.dueDate === undefined ? task.dueDate : req.body.dueDate ? new Date(req.body.dueDate) : null, assigneeId: req.body.assigneeId || task.assigneeId }
    : { status: req.body.status };
  const updated = await prisma.task.update({ where: { id: task.id }, data, include: { assignee: { select: { id: true, name: true } } } });
  await recordAudit(req, 'UPDATE', 'TASK', task.id, `Task updated: ${updated.title} is ${updated.status.toLowerCase().replace('_', ' ')}`);
  res.json(updated);
}));

app.delete('/api/tasks/:id', requireAuth, requireEmployer, asyncRoute(async (req, res) => {
  let deleted;
  try { deleted = await prisma.task.delete({ where: { id: req.params.id } }); }
  catch (error) { if (error.code === 'P2025') return res.status(404).json({ error: 'Task not found.' }); throw error; }
  await recordAudit(req, 'DELETE', 'TASK', deleted.id, `Task deleted: ${deleted.title}`);
  res.status(204).end();
}));

// ==========================================
// NEW FEATURE 1: Notifications Center
// ==========================================

app.get('/api/notifications', requireAuth, asyncRoute(async (req, res) => {
  const notifications = await prisma.notification.findMany({
    where: { userId: req.user.id },
    orderBy: { createdAt: 'desc' },
    take: 40,
  });
  const unreadCount = await prisma.notification.count({
    where: { userId: req.user.id, read: false },
  });
  res.json({ items: notifications, unreadCount });
}));

app.put('/api/notifications/:id/read', requireAuth, asyncRoute(async (req, res) => {
  await prisma.notification.updateMany({
    where: { id: req.params.id, userId: req.user.id },
    data: { read: true },
  });
  res.json({ success: true });
}));

app.put('/api/notifications/read-all', requireAuth, asyncRoute(async (req, res) => {
  await prisma.notification.updateMany({
    where: { userId: req.user.id, read: false },
    data: { read: true },
  });
  res.json({ success: true });
}));

// ==========================================
// NEW FEATURE 2: AI Smart Staffing & Deal Matchmaker
// ==========================================

app.get('/api/matchmaker/:leadId', requireAuth, requireEmployer, asyncRoute(async (req, res) => {
  const lead = await prisma.lead.findUnique({
    where: { id: req.params.leadId },
    include: { assignee: true },
  });
  if (!lead) return res.status(404).json({ error: 'Lead not found.' });

  const leadText = `${lead.name} ${lead.company} ${lead.notes || ''}`.toLowerCase();
  
  // Extract key technical/domain keywords
  const keywords = ['aws', 'cloud', 'migration', 'kubernetes', 'k8s', 'docker', 'soc2', 'security', 'compliance', 'microservice', 'python', 'ai', 'agent', 'sales', 'data', 'pipeline', 'redis', 'kafka', 'distributed', 'architecture', 'b2b'];
  const matchedLeadKeywords = keywords.filter((k) => leadText.includes(k));

  const employees = await prisma.user.findMany({
    where: { role: 'EMPLOYEE' },
    include: {
      managedLeads: { where: { status: { notIn: ['WON', 'LOST'] } } },
      assignedTasks: { where: { status: { not: 'DONE' } } },
      leaves: {
        where: {
          status: { in: ['PENDING', 'APPROVED'] },
          toDate: { gte: new Date() },
        },
      },
      pulseChecks: { orderBy: { createdAt: 'desc' }, take: 1 },
      clientFeedbacks: { take: 5 },
    },
  });

  const candidates = employees.map((emp) => {
    let score = 50; // base score
    const reasons = [];
    const risks = [];

    // 1. Skill & Domain alignment (up to +35 pts)
    const empSkills = (emp.skills || '').toLowerCase();
    const matchingSkills = matchedLeadKeywords.filter((k) => empSkills.includes(k));
    if (matchingSkills.length > 0) {
      const pts = Math.min(matchingSkills.length * 12, 35);
      score += pts;
      reasons.push(`Direct skill match on: ${matchingSkills.join(', ')}`);
    } else if (lead.priority === 'HIGH' || lead.priority === 'URGENT') {
      risks.push('No direct skill tags matched with lead requirements');
    }

    // 2. Department alignment (up to +15 pts)
    if (leadText.includes('sales') && emp.department === 'Sales') {
      score += 15;
      reasons.push('Sales department alignment');
    } else if (!leadText.includes('sales') && emp.department === 'Engineering') {
      score += 10;
      reasons.push('Technical engineering alignment');
    }

    // 3. Workload & Capacity (up to +15 pts or -25 pts)
    const activeDeals = emp.managedLeads.length;
    const openTasks = emp.assignedTasks.length;
    if (activeDeals === 0 && openTasks <= 1) {
      score += 15;
      reasons.push('Maximum availability: Zero competing deals');
    } else if (activeDeals === 1) {
      score += 8;
      reasons.push('Moderate availability: 1 active deal in progress');
    } else if (activeDeals >= 3) {
      score -= 20;
      risks.push(`Heavy workload: Already managing ${activeDeals} active pipeline accounts`);
    } else if (activeDeals >= 2) {
      score -= 10;
      risks.push(`Moderate load: Managing ${activeDeals} active pipeline accounts`);
    }

    // 4. Leave collision check (+10 pts or -30 pts)
    if (lead.expectedCloseDate) {
      const closeDate = new Date(lead.expectedCloseDate);
      const hasConflict = emp.leaves.some((l) => {
        const from = new Date(l.fromDate);
        const to = new Date(l.toDate);
        return closeDate >= from && closeDate <= to;
      });
      if (hasConflict) {
        score -= 30;
        risks.push('Scheduled leave overlaps with expected contract close date!');
      } else {
        score += 10;
        reasons.push('Schedule clear during critical close date');
      }
    }

    // 5. Wellbeing / Burnout check (+5 pts or -15 pts)
    const recentPulse = emp.pulseChecks[0];
    if (recentPulse?.workloadRisk === 'BURNOUT') {
      score -= 25;
      risks.push('Recent pulse check flagged BURNOUT workload');
    } else if (recentPulse?.score >= 4) {
      score += 5;
      reasons.push('High morale and delivery energy (recent pulse score 4-5)');
    }

    // Bound final score between 10 and 99
    const finalScore = Math.min(Math.max(score, 12), 98);
    const fitCategory = finalScore >= 80 ? 'OPTIMAL' : finalScore >= 65 ? 'STRONG' : finalScore >= 45 ? 'MODERATE' : 'AT_CAPACITY';

    return {
      user: {
        id: emp.id,
        name: emp.name,
        email: emp.email,
        department: emp.department,
        position: emp.position,
        skills: emp.skills,
      },
      matchScore: finalScore,
      fitCategory,
      activeDealsCount: activeDeals,
      openTasksCount: openTasks,
      reasons,
      risks,
    };
  });

  candidates.sort((a, b) => b.matchScore - a.matchScore);
  res.json({ lead, candidates });
}));

// ==========================================
// NEW FEATURE 3: Automated 360° Performance Appraisal Engine
// ==========================================

app.get('/api/appraisals', requireAuth, asyncRoute(async (req, res) => {
  const targetUserId = isEmployer(req) ? req.query.userId : req.user.id;
  const where = targetUserId ? { id: String(targetUserId) } : { role: 'EMPLOYEE' };

  const employees = await prisma.user.findMany({
    where,
    include: {
      managedLeads: true,
      assignedTasks: true,
      pulseChecks: { orderBy: { createdAt: 'desc' } },
      timeEntries: true,
    },
    orderBy: { name: 'asc' },
  });

  const dossiers = await Promise.all(
    employees.map(async (emp) => {
      const wonDeals = emp.managedLeads.filter((l) => l.status === 'WON');
      const wonValue = wonDeals.reduce((sum, l) => sum + (l.value || 0), 0);
      const activeDeals = emp.managedLeads.filter((l) => !['WON', 'LOST'].includes(l.status));
      const activeValue = activeDeals.reduce((sum, l) => sum + (l.value || 0), 0);

      const totalTasks = emp.assignedTasks.length;
      const doneTasks = emp.assignedTasks.filter((t) => t.status === 'DONE').length;
      const taskCompletionRate = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 100;

      // Client feedback for this employee's won/active deals
      const dealIds = emp.managedLeads.map((l) => l.id);
      const feedbacks = await prisma.clientFeedback.findMany({
        where: { leadId: { in: dealIds } },
      });
      const avgCSAT = feedbacks.length > 0 ? (feedbacks.reduce((s, f) => s + f.score, 0) / feedbacks.length).toFixed(1) : '5.0';

      const avgPulse = emp.pulseChecks.length > 0 ? (emp.pulseChecks.reduce((s, p) => s + p.score, 0) / emp.pulseChecks.length).toFixed(1) : '4.0';
      const billableHours = emp.timeEntries.filter((t) => t.billable).reduce((s, t) => s + t.hours, 0);

      // Performance Evaluation Category
      let rating = 'ON_TRACK';
      if (wonValue >= 100000 || (taskCompletionRate >= 80 && Number(avgCSAT) >= 4.8)) {
        rating = 'EXCEEDS_EXPECTATIONS';
      } else if (wonValue > 0 || taskCompletionRate >= 70) {
        rating = 'STRONG_PERFORMER';
      } else if (taskCompletionRate < 50 || Number(avgCSAT) < 3.5) {
        rating = 'NEEDS_SUPPORT';
      }

      // Highlights synthesis
      const achievements = [];
      if (wonValue > 0) {
        achievements.push(`Closed $${wonValue.toLocaleString()} in contracted revenue across ${wonDeals.length} won enterprise deal${wonDeals.length === 1 ? '' : 's'}.`);
      }
      if (taskCompletionRate >= 75) {
        achievements.push(`High deliverable reliability: completed ${doneTasks} of ${totalTasks} client milestones (${taskCompletionRate}% completion rate).`);
      }
      if (Number(avgCSAT) >= 4.5) {
        achievements.push(`Outstanding client satisfaction: average CSAT rating of ${avgCSAT} / 5.0 across client accounts.`);
      }
      if (billableHours >= 20) {
        achievements.push(`Logged ${billableHours.toFixed(1)} billable client hours with high project dedication.`);
      }
      if (achievements.length === 0) {
        achievements.push('Actively onboarding and ramping up client pipeline commitments.');
      }

      return {
        user: cleanUser(emp),
        metrics: {
          wonDealsCount: wonDeals.length,
          wonRevenue: wonValue,
          activeDealsCount: activeDeals.length,
          activePipelineValue: activeValue,
          totalTasks,
          completedTasks: doneTasks,
          taskCompletionRate,
          avgClientCSAT: Number(avgCSAT),
          avgPulseScore: Number(avgPulse),
          billableHours,
        },
        rating,
        achievements,
        feedbacks,
      };
    })
  );

  res.json(targetUserId ? dossiers[0] || null : dossiers);
}));

// ==========================================
// NEW FEATURE 4: Client CSAT & NPS Portal
// ==========================================

app.get('/api/client-feedback', requireAuth, asyncRoute(async (req, res) => {
  const feedbacks = await prisma.clientFeedback.findMany({
    include: {
      lead: { select: { id: true, name: true, company: true, assignee: { select: { id: true, name: true } } } },
    },
    orderBy: { createdAt: 'desc' },
  });
  res.json(feedbacks);
}));

app.post('/api/client-feedback', requireAuth, asyncRoute(async (req, res) => {
  const { leadId, clientName, company, score, category, feedback } = req.body;
  if (!clientName?.trim() || !company?.trim()) return invalid(res, 'Client name and company are required.');
  const numScore = Number(score);
  if (!Number.isInteger(numScore) || numScore < 1 || numScore > 5) return invalid(res, 'Score must be an integer between 1 and 5.');

  const npsCategory = numScore >= 5 ? 'PROMOTER' : numScore === 4 ? 'PASSIVE' : 'DETRACTOR';
  const entry = await prisma.clientFeedback.create({
    data: {
      leadId: leadId || null,
      clientName: clientName.trim(),
      company: company.trim(),
      score: numScore,
      npsCategory,
      category: category?.trim() || 'Delivery',
      feedback: feedback?.trim() || null,
    },
    include: {
      lead: { select: { name: true, assigneeId: true } },
    },
  });

  await recordAudit(req, 'CREATE', 'FEEDBACK', entry.id, `Client feedback recorded: ${entry.company} rated ${entry.score}/5 (${entry.npsCategory})`);

  // Notify account owner if assigned
  if (entry.lead?.assigneeId) {
    await createNotification(
      entry.lead.assigneeId,
      '⭐ New Client Review',
      `${entry.clientName} from ${entry.company} submitted a ${entry.score}/5 CSAT review: "${entry.feedback || 'Great work!'}"`,
      'ALERT'
    );
  }

  res.status(201).json(entry);
}));

app.get('/api/analytics/csat-correlation', requireAuth, requireEmployer, asyncRoute(async (_req, res) => {
  const feedbacks = await prisma.clientFeedback.findMany({ orderBy: { createdAt: 'asc' } });
  const pulseChecks = await prisma.pulseCheck.findMany({ orderBy: { createdAt: 'asc' } });

  const totalReviews = feedbacks.length;
  const promoters = feedbacks.filter((f) => f.npsCategory === 'PROMOTER').length;
  const detractors = feedbacks.filter((f) => f.npsCategory === 'DETRACTOR').length;
  const npsScore = totalReviews > 0 ? Math.round(((promoters - detractors) / totalReviews) * 100) : 75;
  const avgCSAT = totalReviews > 0 ? Number((feedbacks.reduce((s, f) => s + f.score, 0) / totalReviews).toFixed(1)) : 4.7;

  const categories = ['Delivery', 'Technical Quality', 'Communication'];
  const categoryStats = categories.map((cat) => {
    const items = feedbacks.filter((f) => f.category.toLowerCase().includes(cat.toLowerCase()));
    const avg = items.length > 0 ? (items.reduce((s, i) => s + i.score, 0) / items.length).toFixed(1) : '4.5';
    return { category: cat, avgScore: Number(avg), count: items.length };
  });

  res.json({
    npsScore,
    avgCSAT,
    totalReviews,
    promoters,
    detractors,
    categoryStats,
    recentFeedbacks: feedbacks.slice(-6),
  });
}));

// ==========================================
// NEW FEATURE 5: Time Tracking & Billable Utilization
// ==========================================

app.get('/api/time-entries', requireAuth, asyncRoute(async (req, res) => {
  const where = isEmployer(req) ? {} : { userId: req.user.id };
  const entries = await prisma.timeEntry.findMany({
    where,
    include: {
      user: { select: { id: true, name: true, department: true } },
      lead: { select: { id: true, name: true, company: true } },
    },
    orderBy: { date: 'desc' },
    take: 50,
  });
  res.json(entries);
}));

app.post('/api/time-entries', requireAuth, asyncRoute(async (req, res) => {
  const { leadId, hours, date, description, billable } = req.body;
  const numHours = Number(hours);
  if (!Number.isFinite(numHours) || numHours <= 0 || numHours > 24) return invalid(res, 'Hours must be a number between 0.25 and 24.');
  const entryDate = date ? new Date(date) : new Date();
  if (!Number.isFinite(+entryDate)) return invalid(res, 'Invalid date.');

  const entry = await prisma.timeEntry.create({
    data: {
      userId: req.user.id,
      leadId: leadId || null,
      hours: numHours,
      date: entryDate,
      description: description?.trim() || null,
      billable: billable !== undefined ? Boolean(billable) : true,
    },
    include: {
      user: { select: { name: true } },
      lead: { select: { name: true, company: true } },
    },
  });

  await recordAudit(req, 'CREATE', 'TIME', entry.id, `Logged ${entry.hours}h (${entry.billable ? 'billable' : 'non-billable'}) by ${entry.user.name}`);
  res.status(201).json(entry);
}));

app.delete('/api/time-entries/:id', requireAuth, asyncRoute(async (req, res) => {
  const entry = await prisma.timeEntry.findUnique({ where: { id: req.params.id } });
  if (!entry) return res.status(404).json({ error: 'Time entry not found.' });
  if (!isEmployer(req) && entry.userId !== req.user.id) return res.status(403).json({ error: 'You can only delete your own time entries.' });
  await prisma.timeEntry.delete({ where: { id: entry.id } });
  await recordAudit(req, 'DELETE', 'TIME', entry.id, `Deleted time entry (${entry.hours}h)`);
  res.status(204).end();
}));

app.get('/api/analytics/utilization', requireAuth, asyncRoute(async (req, res) => {
  const where = isEmployer(req) ? {} : { userId: req.user.id };
  const entries = await prisma.timeEntry.findMany({
    where,
    include: {
      user: { select: { id: true, name: true, department: true } },
      lead: { select: { id: true, name: true, company: true, value: true } },
    },
  });

  const totalHours = entries.reduce((s, e) => s + e.hours, 0);
  const billableHours = entries.filter((e) => e.billable).reduce((s, e) => s + e.hours, 0);
  const utilizationRate = totalHours > 0 ? Math.round((billableHours / totalHours) * 100) : 85;

  // Budget burn per project (using standard $150/hr billing benchmark)
  const projectMap = new Map();
  for (const e of entries) {
    if (!e.lead) continue;
    const item = projectMap.get(e.lead.id) || {
      id: e.lead.id,
      name: e.lead.name,
      company: e.lead.company,
      value: e.lead.value || 0,
      totalHours: 0,
      billableHours: 0,
    };
    item.totalHours += e.hours;
    if (e.billable) item.billableHours += e.hours;
    projectMap.set(e.lead.id, item);
  }

  const projectBurn = Array.from(projectMap.values()).map((p) => {
    const costIncurred = p.billableHours * 150;
    const burnPercent = p.value > 0 ? Math.min(Math.round((costIncurred / p.value) * 100), 100) : 0;
    return { ...p, costIncurred, burnPercent };
  });

  res.json({
    totalHours,
    billableHours,
    nonBillableHours: totalHours - billableHours,
    utilizationRate,
    projectBurn,
  });
}));

// --- Error Handler & Server Start ---

app.use((error, _req, res, _next) => {
  console.error(error);
  if (!res.headersSent) res.status(500).json({ error: 'An unexpected server error occurred.' });
});

const server = app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
async function shutdown() {
  server.close();
  await prisma.$disconnect();
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
