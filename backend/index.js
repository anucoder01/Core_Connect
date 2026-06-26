const express = require('express');
const cors = require('cors');
const { PrismaClient } = require('@prisma/client');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());
app.use(helmet());

// Apply rate limiting to all requests
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again after 15 minutes'
});
app.use(limiter);

// Basic sanity check route
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Unified HR/CRM Backend is running' });
});

// --- HR Routes ---

// Get all users (employees/employers)
app.get('/api/users', async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: { id: true, name: true, email: true, role: true, department: true, position: true }
    });
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Get leaves
app.get('/api/leaves', async (req, res) => {
  try {
    const leaves = await prisma.leaveRequest.findMany({
      include: { user: { select: { name: true } } }
    });
    res.json(leaves);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch leaves' });
  }
});

// --- CRM Routes ---

// Get all leads
app.get('/api/leads', async (req, res) => {
  try {
    const leads = await prisma.lead.findMany({
      include: { assignee: { select: { name: true } } }
    });
    res.json(leads);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch leads' });
  }
});

// --- Pulse Check (Sentiment) Routes ---

app.get('/api/pulse', async (req, res) => {
  try {
    const pulseChecks = await prisma.pulseCheck.findMany({
      include: { user: { select: { name: true } } }
    });
    res.json(pulseChecks);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch pulse checks' });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
