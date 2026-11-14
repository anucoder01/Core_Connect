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
app.use(express.json({ limit: '32kb' }));
app.use((req, res, next) => {
  if (req.headers.origin && req.headers.origin !== FRONTEND_URL) return res.status(403).json({ error: 'Origin is not allowed.' });
  return next();
});
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 100, message: { error: 'Too many requests. Please try again later.' } }));
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, standardHeaders: true, legacyHeaders: false, message: { error: 'Too many sign-in attempts. Please try again later.' } });

const asyncRoute = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
const cleanUser = ({ id, email, name, role, department, position }) => ({ id, email, name, role, department, position });
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
    // An audit outage should not turn a successful business operation into a failed request.
    console.error('Audit write failed:', error.message);
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

  // Upgrade old demo database records at first successful login.
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
  const users = await prisma.user.findMany({ select: { id: true, name: true, email: true, role: true, department: true, position: true }, orderBy: { name: 'asc' } });
  res.json(users);
}));

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
  res.status(201).json(leave);
}));

app.put('/api/leaves/:id', requireAuth, asyncRoute(async (req, res) => {
  const leave = await prisma.leaveRequest.findUnique({ where: { id: req.params.id } });
  if (!leave) return res.status(404).json({ error: 'Leave request not found.' });
  if (isEmployer(req)) {
    if (!['PENDING', 'APPROVED', 'REJECTED'].includes(req.body.status)) return invalid(res, 'Status must be PENDING, APPROVED or REJECTED.');
    const updated = await prisma.leaveRequest.update({ where: { id: leave.id }, data: { status: req.body.status }, include: { user: { select: { id: true, name: true } } } });
    await recordAudit(req, 'UPDATE', 'LEAVE', leave.id, `Leave request for ${updated.user.name} marked ${updated.status}`);
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

app.get('/api/leads', requireAuth, asyncRoute(async (req, res) => {
  const leads = await prisma.lead.findMany({
    where: isEmployer(req) ? undefined : { assigneeId: req.user.id },
    include: { assignee: { select: { id: true, name: true } } },
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
    const updated = await prisma.lead.update({ where: { id: req.params.id }, data: { name: name.trim(), company: company.trim(), email: email.trim(), status, priority: req.body.priority, expectedCloseDate, value: value === '' || value == null ? null : Number(value), notes: notes?.trim() || null, assigneeId: assigneeId || null }, include: { assignee: { select: { id: true, name: true } } } });
    await recordAudit(req, 'UPDATE', 'LEAD', updated.id, `Lead updated: ${updated.name} moved to ${updated.status}`);
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

app.get('/api/pulse', requireAuth, asyncRoute(async (req, res) => {
  const pulseChecks = await prisma.pulseCheck.findMany({
    where: isEmployer(req) ? undefined : { userId: req.user.id },
    include: { user: { select: { id: true, name: true } } },
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
  res.status(201).json(pulse);
}));

app.put('/api/pulse/:id', requireAuth, asyncRoute(async (req, res) => {
  const pulse = await prisma.pulseCheck.findUnique({ where: { id: req.params.id } });
  if (!pulse) return res.status(404).json({ error: 'Pulse check not found.' });
  if (!isEmployer(req) && pulse.userId !== req.user.id) return res.status(403).json({ error: 'You can only update your own pulse checks.' });
  const score = Number(req.body.score);
  const workloadRisk = req.body.workloadRisk;
  if (!Number.isInteger(score) || score < 1 || score > 5 || !['LIGHT', 'MANAGEABLE', 'HIGH', 'BURNOUT'].includes(workloadRisk)) return invalid(res, 'Score or workload risk is invalid.');
  const updated = await prisma.pulseCheck.update({ where: { id: pulse.id }, data: { score, workloadRisk, feedback: typeof req.body.feedback === 'string' ? req.body.feedback.trim() || null : null }, include: { user: { select: { id: true, name: true } } } });
  await recordAudit(req, 'UPDATE', 'PULSE', pulse.id, `Pulse check updated with score ${updated.score} and ${updated.workloadRisk.toLowerCase()} workload risk`);
  res.json(updated);
}));

app.delete('/api/pulse/:id', requireAuth, asyncRoute(async (req, res) => {
  const pulse = await prisma.pulseCheck.findUnique({ where: { id: req.params.id } });
  if (!pulse) return res.status(404).json({ error: 'Pulse check not found.' });
  if (!isEmployer(req) && pulse.userId !== req.user.id) return res.status(403).json({ error: 'You can only delete your own pulse checks.' });
  await prisma.pulseCheck.delete({ where: { id: pulse.id } });
  await recordAudit(req, 'DELETE', 'PULSE', pulse.id, 'Pulse check deleted');
  res.status(204).end();
}));

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
